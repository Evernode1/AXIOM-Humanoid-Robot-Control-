#!/usr/bin/env python3
"""
AXIOM Humanoid Subnet — Universal Miner
=========================================
Connect ANY humanoid robot to the AXIOM network.

Supported robot SDKs (auto-detected):
  - Unitree H1 / G1 / H1-2  (unitree_sdk2py)
  - ROS2 (any /joint_states publisher)
  - Simulation (fallback — no hardware needed)

Setup:
  pip install substrate-interface numpy python-dotenv requests
  export KNX_MNEMONIC="your twelve word mnemonic"
  python miner.py

With Unitree robot:
  pip install unitree_sdk2py
  python miner.py --robot unitree --unitree-interface eth0

With ROS2 robot:
  source /opt/ros/humble/setup.bash
  python miner.py --robot ros2 --ros2-topic /joint_states

Simulation (no hardware):
  python miner.py --robot sim
"""

import os, sys, json, time, math, hashlib, argparse, logging, threading
from datetime import datetime, timezone
from typing import Optional, Dict, List

import numpy as np

try:
    from substrateinterface import SubstrateInterface, Keypair
except ImportError:
    print("[ERROR] pip install substrate-interface")
    sys.exit(1)

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s \033[36m[AXIOM-MINER]\033[0m %(message)s',
    handlers=[logging.StreamHandler()]
)
log = logging.getLogger('axiom.miner')

# ── Constants ─────────────────────────────────────────────────────────────────
RPC_ENDPOINTS = [
    'wss://testnet-rpc1.konnex.world:39944',
    'wss://testnet-rpc1.konnex.world',
]
HTTP_API   = 'https://testnet-rpc1.konnex.world'
EXPLORER   = 'https://subnets.testnet.konnex.world'
SUBNET_ID  = int(os.getenv('KNX_SUBNET_ID', '4'))
POLL_S     = int(os.getenv('KNX_POLL_S', '8'))

# 16 DOF — matches AXIOM website exactly
JOINT_NAMES = [
    'spine_yaw', 'spine_pitch',
    'l_shoulder', 'l_elbow', 'l_wrist', 'l_grip',
    'r_shoulder', 'r_elbow', 'r_wrist', 'r_grip',
    'l_hip',  'l_knee',  'r_hip',  'r_knee',
    'head_yaw', 'head_pitch',
]
JOINT_RANGES = {
    'spine_yaw':(-45,45), 'spine_pitch':(-30,30),
    'l_shoulder':(-90,90), 'l_elbow':(0,150), 'l_wrist':(-60,60), 'l_grip':(0,100),
    'r_shoulder':(-90,90), 'r_elbow':(0,150), 'r_wrist':(-60,60), 'r_grip':(0,100),
    'l_hip':(-60,60),  'l_knee':(0,120),  'r_hip':(-60,60),  'r_knee':(0,120),
    'head_yaw':(-60,60), 'head_pitch':(-30,30),
}
JOINT_NOMINAL = {
    'spine_yaw':0,'spine_pitch':0,
    'l_shoulder':-20,'l_elbow':45,'l_wrist':0,'l_grip':0,
    'r_shoulder':20,'r_elbow':45,'r_wrist':0,'r_grip':0,
    'l_hip':0,'l_knee':10,'r_hip':0,'r_knee':10,
    'head_yaw':0,'head_pitch':-5,
}
TASK_PRIMARY = {
    'hum_pick_place':        ['r_shoulder','r_elbow','r_wrist','r_grip'],
    'hum_bimanual_assemble': ['l_shoulder','l_elbow','l_wrist','l_grip','r_shoulder','r_elbow','r_wrist','r_grip'],
    'hum_loco_navigate':     ['l_hip','l_knee','r_hip','r_knee','spine_pitch','spine_yaw'],
    'hum_handover':          ['r_shoulder','r_elbow','r_wrist','r_grip','head_yaw','head_pitch'],
    'hum_inspection':        ['head_yaw','head_pitch','spine_yaw','l_shoulder','r_shoulder'],
    'hum_whole_body_reach':  ['spine_pitch','spine_yaw','l_shoulder','l_elbow','l_wrist','l_grip'],
}

# ══════════════════════════════════════════════════════════════════════════════
# ROBOT ADAPTERS — plug your robot in here
# ══════════════════════════════════════════════════════════════════════════════

class RobotAdapter:
    """Base class — all adapters must implement read_joints()"""
    name = 'base'

    def connect(self): pass
    def disconnect(self): pass

    def read_joints(self) -> Dict[str, dict]:
        """
        Returns dict of joint_id -> {angle_deg, torque_nm, active}
        Must return all 16 joints from JOINT_NAMES
        """
        raise NotImplementedError


class SimulationAdapter(RobotAdapter):
    """
    Software simulation — no hardware needed.
    Used when no robot is connected.
    Good for testing the full PoPW pipeline.
    """
    name = 'simulation'

    def __init__(self, task_type='hum_pick_place', elapsed=0.0, timeout=30.0):
        self.task_type = task_type
        self.elapsed   = elapsed
        self.timeout   = timeout

    def set_task(self, task_type: str, elapsed: float, timeout: float):
        self.task_type = task_type
        self.elapsed   = elapsed
        self.timeout   = timeout

    def read_joints(self) -> Dict[str, dict]:
        prog    = min(1.0, self.elapsed / max(self.timeout, 1))
        primary = TASK_PRIMARY.get(self.task_type, [])
        rng     = np.random.default_rng(int(time.time_ns() % 2**32))
        joints  = {}
        for jid in JOINT_NAMES:
            lo, hi  = JOINT_RANGES[jid]
            nom     = JOINT_NOMINAL[jid]
            active  = jid in primary
            motion  = math.sin(prog * math.pi * 2) * (hi-lo)*0.25 if active else 0.0
            noise   = float(rng.normal(0, 3 if active else 0.8))
            angle   = float(np.clip(nom + motion + noise, lo, hi))
            torque  = float(abs(motion) * rng.uniform(0.3, 2.0) if active else rng.uniform(0, 0.08))
            joints[jid] = {'angle_deg': round(angle,3), 'torque_nm': round(torque,4), 'active': active}
        return joints


class UnitreeAdapter(RobotAdapter):
    """
    Unitree H1 / G1 / H1-2 via unitree_sdk2py.

    Install: pip install unitree_sdk2py
    Docs:    https://github.com/unitreerobotics/unitree_sdk2_python

    Unitree joint order (29 joints total for H1):
    We map the first 16 relevant joints to AXIOM's JOINT_NAMES.

    H1 motor index mapping:
      0:  left_hip_yaw         → l_hip
      1:  left_hip_roll
      2:  left_hip_pitch
      3:  left_knee            → l_knee
      4:  left_ankle
      5:  right_hip_yaw        → r_hip
      6:  right_hip_roll
      7:  right_hip_pitch
      8:  right_knee           → r_knee
      9:  right_ankle
      10: waist_yaw            → spine_yaw
      11: waist_roll
      12: waist_pitch          → spine_pitch
      13: left_shoulder_pitch  → l_shoulder
      14: left_shoulder_roll
      15: left_elbow           → l_elbow
      16: left_wrist_yaw       → l_wrist
      17: right_shoulder_pitch → r_shoulder
      18: right_shoulder_roll
      19: right_elbow          → r_elbow
      20: right_wrist_yaw      → r_wrist
    """
    name = 'unitree'

    # Unitree motor index → AXIOM joint name
    MOTOR_MAP = {
        0:  'l_hip',
        3:  'l_knee',
        5:  'r_hip',
        8:  'r_knee',
        10: 'spine_yaw',
        12: 'spine_pitch',
        13: 'l_shoulder',
        15: 'l_elbow',
        16: 'l_wrist',
        17: 'r_shoulder',
        19: 'r_elbow',
        20: 'r_wrist',
    }

    def __init__(self, network_interface: str = 'eth0', task_type: str = 'hum_pick_place'):
        self.interface  = network_interface
        self.task_type  = task_type
        self._state     = None
        self._sub       = None
        self._lock      = threading.Lock()

    def connect(self):
        try:
            import unitree_sdk2py.core.channel as channel
            from unitree_sdk2py.idl.unitree_hg.msg.dds_ import LowState_

            channel.ChannelFactoryInitialize(0, self.interface)
            self._sub = channel.ChannelSubscriber("rt/lowstate", LowState_)
            self._sub.Init(self._on_state, 10)
            time.sleep(0.5)  # wait for first message
            log.info(f"[Unitree] Connected on interface {self.interface}")
        except ImportError:
            raise ImportError("pip install unitree_sdk2py")
        except Exception as e:
            raise ConnectionError(f"Unitree connection failed: {e}\n"
                                  f"Make sure robot is on and network interface is correct.")

    def _on_state(self, msg):
        with self._lock:
            self._state = msg

    def disconnect(self):
        if self._sub:
            self._sub.Close()

    def read_joints(self) -> Dict[str, dict]:
        with self._lock:
            state = self._state

        if state is None:
            log.warning("[Unitree] No state received yet — using nominal values")
            return {jid: {'angle_deg': JOINT_NOMINAL[jid], 'torque_nm': 0.0, 'active': False}
                    for jid in JOINT_NAMES}

        primary = TASK_PRIMARY.get(self.task_type, [])
        joints  = {}

        # Map Unitree motors → AXIOM joints
        for motor_idx, jid in self.MOTOR_MAP.items():
            try:
                motor = state.motor_state[motor_idx]
                angle_deg = math.degrees(motor.q)
                torque_nm = abs(float(motor.tau_est))
                lo, hi    = JOINT_RANGES.get(jid, (-180, 180))
                angle_deg = float(np.clip(angle_deg, lo, hi))
                joints[jid] = {
                    'angle_deg': round(angle_deg, 3),
                    'torque_nm': round(min(torque_nm, 50.0), 4),
                    'active':    jid in primary,
                }
            except (IndexError, AttributeError):
                joints[jid] = {'angle_deg': JOINT_NOMINAL.get(jid, 0), 'torque_nm': 0.0, 'active': False}

        # Fill in unmapped joints with nominal
        for jid in JOINT_NAMES:
            if jid not in joints:
                joints[jid] = {'angle_deg': JOINT_NOMINAL[jid], 'torque_nm': 0.0, 'active': False}

        # Grip — Unitree H1 gripper (if equipped)
        joints['l_grip'] = {'angle_deg': 0.0, 'torque_nm': 0.0, 'active': 'l_grip' in primary}
        joints['r_grip'] = {'angle_deg': 0.0, 'torque_nm': 0.0, 'active': 'r_grip' in primary}
        joints['head_yaw']   = {'angle_deg': 0.0, 'torque_nm': 0.0, 'active': 'head_yaw'   in primary}
        joints['head_pitch'] = {'angle_deg': -5.0,'torque_nm': 0.0, 'active': 'head_pitch' in primary}

        return joints

    def set_task(self, task_type: str, elapsed: float, timeout: float):
        self.task_type = task_type


class ROS2Adapter(RobotAdapter):
    """
    ROS2 robot via /joint_states topic.
    Works with any ROS2-compatible humanoid:
    Agility Digit, Fourier GR1, SCHAFT, custom robots.

    Install:
      source /opt/ros/humble/setup.bash
      pip install rclpy

    Usage:
      python miner.py --robot ros2 --ros2-topic /joint_states

    Your robot must publish sensor_msgs/JointState on the topic.
    Joint names in the message must match or be mappable to AXIOM joint names.
    """
    name = 'ros2'

    def __init__(self, topic: str = '/joint_states', task_type: str = 'hum_pick_place'):
        self.topic      = topic
        self.task_type  = task_type
        self._latest    = None
        self._node      = None
        self._lock      = threading.Lock()
        self._thread    = None

    def connect(self):
        try:
            import rclpy
            from rclpy.node import Node
            from sensor_msgs.msg import JointState

            class _Listener(Node):
                def __init__(inner, topic, cb):
                    super().__init__('axiom_miner')
                    inner.create_subscription(JointState, topic, cb, 10)

            rclpy.init()
            self._node = _Listener(self.topic, self._on_joint_state)
            self._thread = threading.Thread(target=rclpy.spin, args=(self._node,), daemon=True)
            self._thread.start()
            time.sleep(1.0)
            log.info(f"[ROS2] Subscribed to {self.topic}")
        except ImportError:
            raise ImportError("ROS2 not found. source /opt/ros/humble/setup.bash")
        except Exception as e:
            raise ConnectionError(f"ROS2 connection failed: {e}")

    def _on_joint_state(self, msg):
        with self._lock:
            self._latest = msg

    def disconnect(self):
        try:
            import rclpy
            if self._node: self._node.destroy_node()
            rclpy.shutdown()
        except: pass

    def _map_ros_joint(self, name: str) -> Optional[str]:
        """
        Map ROS2 joint name → AXIOM joint name.
        Customize this mapping for your robot's joint naming convention.
        """
        mappings = {
            # Common ROS2 naming conventions
            'left_hip_yaw':          'l_hip',
            'left_knee_joint':       'l_knee',
            'right_hip_yaw':         'r_hip',
            'right_knee_joint':      'r_knee',
            'torso_yaw':             'spine_yaw',
            'torso_pitch':           'spine_pitch',
            'left_shoulder_pitch':   'l_shoulder',
            'left_elbow_joint':      'l_elbow',
            'left_wrist_yaw':        'l_wrist',
            'left_gripper':          'l_grip',
            'right_shoulder_pitch':  'r_shoulder',
            'right_elbow_joint':     'r_elbow',
            'right_wrist_yaw':       'r_wrist',
            'right_gripper':         'r_grip',
            'head_pan':              'head_yaw',
            'head_tilt':             'head_pitch',
            # Direct matches
            **{jid: jid for jid in JOINT_NAMES},
        }
        return mappings.get(name)

    def read_joints(self) -> Dict[str, dict]:
        with self._lock:
            msg = self._latest

        primary = TASK_PRIMARY.get(self.task_type, [])
        joints  = {jid: {'angle_deg': JOINT_NOMINAL[jid], 'torque_nm': 0.0, 'active': jid in primary}
                   for jid in JOINT_NAMES}

        if msg is None:
            log.warning("[ROS2] No joint_states received yet")
            return joints

        for i, ros_name in enumerate(msg.name):
            axiom_name = self._map_ros_joint(ros_name)
            if axiom_name is None: continue
            try:
                angle_deg = math.degrees(msg.position[i]) if i < len(msg.position) else 0.0
                torque_nm = abs(float(msg.effort[i]))     if i < len(msg.effort)   else 0.0
                lo, hi    = JOINT_RANGES.get(axiom_name, (-180,180))
                joints[axiom_name] = {
                    'angle_deg': round(float(np.clip(angle_deg, lo, hi)), 3),
                    'torque_nm': round(min(torque_nm, 50.0), 4),
                    'active':    axiom_name in primary,
                }
            except (IndexError, ValueError):
                pass

        return joints

    def set_task(self, task_type: str, elapsed: float, timeout: float):
        self.task_type = task_type


# ══════════════════════════════════════════════════════════════════════════════
# TELEMETRY ENGINE
# ══════════════════════════════════════════════════════════════════════════════

def collect_telemetry(adapter: RobotAdapter, task_type: str,
                      elapsed: float, timeout: float) -> dict:
    """
    Collect telemetry from robot adapter + compute PoPW metrics.
    Works identically whether robot is real or simulated.
    """
    if hasattr(adapter, 'set_task'):
        adapter.set_task(task_type, elapsed, timeout)

    joints      = adapter.read_joints()
    prog        = min(1.0, elapsed / max(timeout, 1))
    completion  = prog * 100.0

    # Safety: detect joint limit violations
    violations = 0
    for jid, val in joints.items():
        lo, hi = JOINT_RANGES.get(jid, (-180,180))
        if not (lo <= val['angle_deg'] <= hi):
            violations += 1
    safety = max(0.5, 1.0 - violations * 0.1)

    # Efficiency: how much time used vs timeout
    efficiency = max(0.5, 1.0 - (elapsed / max(timeout,1)) * 0.3)

    # Weighted PoPW score
    popw = (completion/100.0)*0.40 + safety*0.35 + efficiency*0.25

    return {
        'joints':         joints,
        'completion_pct': round(completion, 2),
        'safety_score':   round(safety, 4),
        'efficiency':     round(efficiency, 4),
        'popw_raw':       round(popw, 4),
        'elapsed_s':      round(elapsed, 2),
        'timestamp_ms':   int(time.time() * 1000),
        'dof':            len(joints),
        'robot_adapter':  adapter.name,
    }

def compute_hash(robot_id: str, task_type: str, telemetry: dict, ts: int) -> str:
    payload = json.dumps(
        {'robot_id':robot_id,'task_type':task_type,'tel':telemetry,'ts':ts},
        sort_keys=True, separators=(',',':')
    )
    return '0x' + hashlib.sha3_256(payload.encode()).hexdigest()

def compute_score(tel: dict) -> int:
    return int(
        tel['completion_pct']*0.40 +
        tel['safety_score']*100*0.35 +
        tel['efficiency']*100*0.25
    )


# ══════════════════════════════════════════════════════════════════════════════
# KONNEX MINER
# ══════════════════════════════════════════════════════════════════════════════

class HumanoidMiner:
    def __init__(self, mnemonic: str, adapter: RobotAdapter, rpc: str = RPC_ENDPOINTS[0]):
        self.keypair    = Keypair.create_from_mnemonic(mnemonic)
        self.address    = self.keypair.ss58_address
        self.substrate  = None
        self.rpc        = rpc
        self.adapter    = adapter
        self.done_count = 0

    def connect_chain(self):
        for url in [self.rpc] + [e for e in RPC_ENDPOINTS if e != self.rpc]:
            try:
                log.info(f"Connecting to Konnex: {url}")
                self.substrate = SubstrateInterface(url=url, ss58_format=42)
                log.info(f"Chain: {self.substrate.chain} v{self.substrate.version}")
                self.rpc = url
                return
            except Exception as e:
                log.warning(f"Failed {url}: {e}")
        raise ConnectionError("All Konnex RPC endpoints unreachable")

    def get_balance(self) -> float:
        try:
            r = self.substrate.query('System','Account',[self.address])
            return r.value['data']['free'] / 1e6
        except: return 0.0

    def submit_extrinsic(self, module: str, fn: str, params: dict) -> Optional[str]:
        try:
            call = self.substrate.compose_call(
                call_module=module, call_function=fn, call_params=params)
        except:
            log.warning(f"{module}.{fn} not in runtime — system.remark fallback")
            call = self.substrate.compose_call(
                call_module='System', call_function='remark',
                call_params={'remark': json.dumps({
                    'axiom': True, 'method':f'{module}.{fn}',
                    'params':params,'ts':int(time.time()*1000)
                }).encode()})
        ext     = self.substrate.create_signed_extrinsic(call=call, keypair=self.keypair)
        receipt = self.substrate.submit_extrinsic(ext, wait_for_inclusion=True)
        log.info(f"  ✓ tx: {receipt.extrinsic_hash[:20]}… | block: {receipt.block_hash[:12]}…")
        return receipt.extrinsic_hash

    def fetch_open_tasks(self) -> list:
        # Try pallet storage
        try:
            tasks = self.substrate.query_map('Axiom','HumanoidTasks',[SUBNET_ID])
            result = [v.value for _,v in tasks if v.value.get('status')=='open']
            if result: return result
        except: pass
        # Try HTTP API
        try:
            import urllib.request
            url = f"{HTTP_API}/api/v1/tasks?subnet={SUBNET_ID}&status=open&limit=5"
            with urllib.request.urlopen(url, timeout=5) as r:
                return json.loads(r.read())
        except: pass
        return []

    def execute_task(self, task: dict) -> dict:
        task_id   = task.get('task_id', f"HUM-{int(time.time()):X}")
        task_type = task.get('task_type', 'hum_pick_place')
        timeout   = float(task.get('timeout_s', 30.0))
        robot_id  = self.address[:32]
        ts        = int(time.time() * 1000)

        log.info(f"━━ TASK: {task_id} [{task_type}]")
        log.info(f"   Robot adapter: {self.adapter.name}")

        # 1. Execute control loop — collect real telemetry
        log.info(f"→ Executing {min(timeout,10):.0f}s control loop @ {self.adapter.name}")
        exec_dur = min(timeout, 10.0)
        start    = time.time()

        samples = []
        while time.time() - start < exec_dur:
            elapsed = time.time() - start
            tel     = collect_telemetry(self.adapter, task_type, elapsed, timeout)
            samples.append(tel)
            time.sleep(0.1)  # 10Hz sampling (increase for real robot)

        # Use final telemetry sample
        final_tel  = samples[-1] if samples else collect_telemetry(self.adapter, task_type, exec_dur, timeout)
        popw_score = compute_score(final_tel)
        tel_hash   = compute_hash(robot_id, task_type, final_tel, ts)

        log.info(f"  completion: {final_tel['completion_pct']:.1f}%")
        log.info(f"  safety:     {final_tel['safety_score']*100:.1f}%")
        log.info(f"  PoPW score: {popw_score}")
        log.info(f"  hash:       {tel_hash[:20]}…")

        # 2. Phase 1 — commit hash onchain
        log.info("→ Phase 1: commitHumanoidPoPW")
        commit_tx = self.submit_extrinsic('Axiom','commit_humanoid_po_pw',{
            'robot_id':robot_id[:32],'task_type':task_type,
            'telemetry_hash':tel_hash,'timestamp':ts,'subnet_id':SUBNET_ID,
        })

        # 3. IPFS upload (stub — replace with real IPFS client)
        cid = 'Qm' + tel_hash[2:46]
        log.info(f"→ IPFS: {cid[:28]}… (stub — use ipfshttpclient in production)")
        # Real IPFS:
        # import ipfshttpclient
        # client = ipfshttpclient.connect('/ip4/127.0.0.1/tcp/5001')
        # res = client.add_json({'telemetry': final_tel, 'samples': len(samples)})
        # cid = res['Hash']

        # 4. Phase 3 — settle onchain
        block = self.substrate.get_block_number(self.substrate.get_chain_head())
        log.info("→ Phase 3: writeHumanoidMemory")
        score_tx = self.submit_extrinsic('Axiom','write_humanoid_memory',{
            'task_id':task_id[:16],'robot_id':robot_id[:16],
            'task_type':task_type,'telemetry_hash':tel_hash,
            'popw_score':popw_score,'ipfs_cid':cid[:20],
            'block_number':block,'subnet_id':SUBNET_ID,
        })

        self.done_count += 1
        result = {
            'task_id':task_id,'task_type':task_type,
            'robot_id':robot_id,'robot_adapter':self.adapter.name,
            'telemetry_hash':tel_hash,'ipfs_cid':cid,
            'popw_score':popw_score,'block_number':block,
            'commit_tx':commit_tx,'score_tx':score_tx,
            'outcome':'SUCCESS' if popw_score>=65 else 'FAILED',
            'completed_at':datetime.now(timezone.utc).isoformat(),
            'samples_collected':len(samples),
        }
        outcome_color = '\033[32m' if result['outcome']=='SUCCESS' else '\033[31m'
        log.info(f"━━ {outcome_color}{result['outcome']}\033[0m | PoPW {popw_score} | {EXPLORER}/explorer?tx={score_tx}")
        return result

    def run(self):
        print("\n" + "═"*60)
        print("  AXIOM Humanoid Subnet — Miner")
        print(f"  Wallet   : {self.address}")
        print(f"  Robot    : {self.adapter.name}")
        print(f"  Subnet   : {SUBNET_ID} (Humanoid Control)")
        print(f"  Explorer : {EXPLORER}")
        print("═"*60 + "\n")

        self.connect_chain()
        self.adapter.connect()

        bal = self.get_balance()
        log.info(f"Balance: {bal:.4f} testKNX")
        if bal < 1.0:
            log.warning("Low balance — get testKNX at: subnets.testnet.konnex.world")

        log.info(f"Polling every {POLL_S}s for tasks on subnet {SUBNET_ID}…\n")

        while True:
            try:
                tasks = self.fetch_open_tasks()
                if tasks:
                    log.info(f"{len(tasks)} open task(s)")
                    for t in tasks[:1]:
                        self.execute_task(t)
                else:
                    log.info("No open tasks — waiting…")
            except KeyboardInterrupt:
                log.info(f"\nStopped. Tasks completed: {self.done_count}")
                self.adapter.disconnect()
                break
            except Exception as e:
                log.error(f"Error: {e}", exc_info=True)
            time.sleep(POLL_S)


# ── CLI ───────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description='AXIOM Humanoid Subnet Miner — Connect any robot to Konnex',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  Simulation (no hardware):
    python miner.py --robot sim

  Unitree H1/G1:
    python miner.py --robot unitree --unitree-interface eth0

  ROS2 robot:
    python miner.py --robot ros2 --ros2-topic /joint_states

  Dry run (test without submitting txs):
    python miner.py --robot sim --dry-run
        """
    )
    parser.add_argument('--mnemonic',          default=os.getenv('KNX_MNEMONIC'),   help='12-word wallet mnemonic')
    parser.add_argument('--robot',             default='sim',                        help='Robot adapter: sim | unitree | ros2')
    parser.add_argument('--unitree-interface', default='eth0',                       help='Network interface for Unitree (default: eth0)')
    parser.add_argument('--ros2-topic',        default='/joint_states',              help='ROS2 JointState topic (default: /joint_states)')
    parser.add_argument('--subnet',            type=int, default=SUBNET_ID)
    parser.add_argument('--rpc',               default=RPC_ENDPOINTS[0])
    parser.add_argument('--dry-run',           action='store_true',                  help='Test without submitting transactions')
    args = parser.parse_args()

    if not args.mnemonic:
        print("\n[ERROR] Wallet mnemonic required")
        print("  Option 1: export KNX_MNEMONIC='twelve word mnemonic here'")
        print("  Option 2: python miner.py --mnemonic 'twelve word mnemonic here'")
        print(f"\n  Get testKNX: {EXPLORER}")
        sys.exit(1)

    # Build adapter
    if args.robot == 'unitree':
        adapter = UnitreeAdapter(network_interface=args.unitree_interface)
    elif args.robot == 'ros2':
        adapter = ROS2Adapter(topic=args.ros2_topic)
    else:
        adapter = SimulationAdapter()

    if args.dry_run:
        log.info("DRY RUN — no transactions submitted")
        adapter.connect()
        adapter.set_task('hum_pick_place', 5.0, 30.0)
        tel   = collect_telemetry(adapter, 'hum_pick_place', 5.0, 30.0)
        score = compute_score(tel)
        h     = compute_hash('TEST', 'hum_pick_place', tel, int(time.time()*1000))
        print(json.dumps({
            'robot_adapter': adapter.name,
            'popw_score':    score,
            'telemetry_hash':h,
            'sample': {
                'completion_pct': tel['completion_pct'],
                'safety_score':   tel['safety_score'],
                'efficiency':     tel['efficiency'],
                'sample_joints':  {k:v for k,v in list(tel['joints'].items())[:4]},
            }
        }, indent=2))
        adapter.disconnect()
        return

    miner = HumanoidMiner(args.mnemonic, adapter, args.rpc)
    miner.run()

if __name__ == '__main__':
    main()
