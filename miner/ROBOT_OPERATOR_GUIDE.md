# AXIOM Humanoid — Robot Operator Guide
## Connect your robot in 5 minutes

---

## What is this?

AXIOM is an open humanoid robot control network on Konnex.
Anyone with a compatible robot can:
1. Download the miner script
2. Connect their robot
3. Automatically pick up tasks from the network
4. Submit verified Proof of Physical Work (PoPW) onchain
5. Earn testKNX rewards

---

## Supported Robots

| Robot            | SDK             | Setup time |
|------------------|-----------------|-----------|
| Unitree H1       | unitree_sdk2py  | ~5 min    |
| Unitree G1       | unitree_sdk2py  | ~5 min    |
| Unitree H1-2     | unitree_sdk2py  | ~5 min    |
| Any ROS2 robot   | rclpy           | ~10 min   |
| No robot (sim)   | none            | ~2 min    |

---

## Quick Start

### Step 1 — Get testKNX
Visit https://subnets.testnet.konnex.world and get free testKNX from the faucet.
Your wallet address is from SubWallet or Talisman (Substrate format: 5Fxx…).

### Step 2 — Install dependencies

```bash
pip install substrate-interface numpy python-dotenv
```

### Step 3 — Set your wallet mnemonic

```bash
export KNX_MNEMONIC="word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12"
```

### Step 4 — Run the miner

**No robot (simulation):**
```bash
python miner.py --robot sim
```

**Unitree H1/G1:**
```bash
pip install unitree_sdk2py
python miner.py --robot unitree --unitree-interface eth0
```

**ROS2 robot:**
```bash
source /opt/ros/humble/setup.bash
python miner.py --robot ros2 --ros2-topic /joint_states
```

---

## Test without submitting transactions

```bash
python miner.py --robot sim --dry-run
```

Output:
```json
{
  "robot_adapter": "simulation",
  "popw_score": 74,
  "telemetry_hash": "0xabcdef...",
  "sample": {
    "completion_pct": 85.3,
    "safety_score": 0.921,
    "efficiency": 0.810
  }
}
```

---

## What happens when miner runs

```
1. Connects to Konnex testnet (wss://testnet-rpc1.konnex.world:39944)
2. Polls for open humanoid tasks every 8 seconds
3. When task found → starts executing:
   a. Reads real joint telemetry from your robot (16 DOF)
   b. Computes SHA3-256 hash of telemetry stream
   c. Submits commitHumanoidPoPW() transaction → hash anchored onchain
   d. Uploads full telemetry to IPFS (content-addressed, private)
   e. Submits writeHumanoidMemory() → 96-byte record onchain forever
4. Result visible on: https://axiom-humanoid.vercel.app/history
```

---

## PoPW Scoring

Your robot is scored on 3 metrics:

| Metric          | Weight | How it's measured                     |
|-----------------|--------|---------------------------------------|
| completion_pct  | 40%    | Did the robot complete the task?      |
| safety_score    | 35%    | No joint limit violations             |
| efficiency      | 25%    | Time taken vs timeout                 |

Score ≥ 65 = SUCCESS | Score < 65 = FAILED

---

## Adding your own robot SDK

Edit `miner.py` — find the `SimulationAdapter` class and create a new class:

```python
class MyRobotAdapter(RobotAdapter):
    name = 'my_robot'

    def connect(self):
        # Connect to your robot SDK
        self.sdk = MyRobotSDK.connect()

    def read_joints(self) -> dict:
        # Read current joint state from your robot
        state = self.sdk.get_joint_state()
        return {
            'l_shoulder': {'angle_deg': state.left_shoulder, 'torque_nm': 0.5, 'active': True},
            'r_shoulder': {'angle_deg': state.right_shoulder, 'torque_nm': 0.5, 'active': True},
            # ... all 16 joints
        }
```

Then in `main()`:
```python
if args.robot == 'my_robot':
    adapter = MyRobotAdapter()
```

---

## Network interface — Unitree

Find your network interface:
```bash
# Linux
ip addr show
# or
ifconfig

# Common names: eth0, ens3, enp2s0, wlan0
```

The Unitree robot connects via ethernet. Use the interface connected to the robot.

---

## Troubleshooting

**"All Konnex RPC endpoints unreachable"**
→ Check internet connection. Try: `ping testnet-rpc1.konnex.world`

**"No accounts found"**
→ Mnemonic is wrong or empty. Check: `echo $KNX_MNEMONIC`

**"Unitree connection failed"**
→ Check: robot powered on? ethernet cable connected? correct interface name?

**"No open tasks — waiting"**
→ Normal. Post a task on https://axiom-humanoid.vercel.app/control first.

**Low balance warning**
→ Get testKNX at https://subnets.testnet.konnex.world

---

## Links

- Website: https://axiom-humanoid.vercel.app
- Explorer: https://subnets.testnet.konnex.world
- Konnex docs: https://docs.konnex.world
