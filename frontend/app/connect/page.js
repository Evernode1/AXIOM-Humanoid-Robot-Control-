'use client';
import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle, Copy, Terminal, Cpu, Network, ChevronRight, Zap, Globe, Shield, Activity } from 'lucide-react';

const ROBOTS = [
  {
    id: 'unitree',
    name: 'Unitree H1 / G1 / H1-2',
    logo: '🤖',
    desc: 'Official Unitree humanoid robots via unitree_sdk2py',
    difficulty: 'Easy',
    diffColor: '#4ADE80',
    steps: [
      { title: 'Install SDK', code: 'pip install unitree_sdk2py substrate-interface numpy python-dotenv' },
      { title: 'Set wallet mnemonic', code: 'export KNX_MNEMONIC="your twelve word mnemonic here"' },
      { title: 'Download miner', code: 'curl -O https://raw.githubusercontent.com/your-repo/axiom-humanoid/main/miner/miner.py' },
      { title: 'Connect robot (replace eth0 with your network interface)', code: 'python miner.py --robot unitree --unitree-interface eth0' },
    ],
    notes: [
      'Robot must be powered on and connected via ethernet',
      'Network interface is usually eth0 (Linux) or en0 (Mac)',
      'Run ifconfig or ip addr to find your interface name',
      'Supports H1, G1, H1-2 — all use same SDK',
    ],
    joints: 'spine(2) + arms(8) + legs(4) + head(2) = 16 DOF',
  },
  {
    id: 'ros2',
    name: 'ROS2 Compatible Robot',
    logo: '⚙️',
    desc: 'Any robot publishing sensor_msgs/JointState on ROS2',
    difficulty: 'Medium',
    diffColor: '#FFB547',
    steps: [
      { title: 'Install ROS2 (Humble)', code: 'sudo apt install ros-humble-desktop\nsource /opt/ros/humble/setup.bash' },
      { title: 'Install dependencies', code: 'pip install substrate-interface numpy python-dotenv' },
      { title: 'Set wallet mnemonic', code: 'export KNX_MNEMONIC="your twelve word mnemonic here"' },
      { title: 'Run miner with your topic', code: 'python miner.py --robot ros2 --ros2-topic /joint_states' },
    ],
    notes: [
      'Your robot must publish sensor_msgs/JointState',
      'Default topic is /joint_states — change with --ros2-topic',
      'Joint names are auto-mapped to AXIOM 16-DOF schema',
      'Compatible: Agility Digit, Fourier GR1, custom robots',
    ],
    joints: 'Any joints auto-mapped via ROS2 joint name convention',
  },
  {
    id: 'sim',
    name: 'Simulation (No Hardware)',
    logo: '💻',
    desc: 'Test the full PoPW pipeline without physical robot',
    difficulty: 'Instant',
    diffColor: '#00E5FF',
    steps: [
      { title: 'Install dependencies', code: 'pip install substrate-interface numpy python-dotenv' },
      { title: 'Set wallet mnemonic', code: 'export KNX_MNEMONIC="your twelve word mnemonic here"' },
      { title: 'Test first (dry run)', code: 'python miner.py --robot sim --dry-run' },
      { title: 'Run simulation miner', code: 'python miner.py --robot sim' },
    ],
    notes: [
      'No robot hardware needed',
      'Full PoPW pipeline runs with simulated telemetry',
      'Real Konnex transactions submitted',
      'Good for testing and development',
    ],
    joints: 'Simulated 16 DOF — physically accurate motion curves',
  },
];

function CodeBlock({ code }) {
  const [copied, setCopied] = useState(false);
  const lines = code.split('\n');

  function copy() {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ position: 'relative', background: '#020408', border: '1px solid rgba(0,229,255,0.1)', borderRadius: 6, padding: '0.7rem 1rem', marginTop: '0.4rem' }}>
      <button onClick={copy} style={{ position: 'absolute', top: 8, right: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: copied ? '#4ADE80' : 'var(--textdim)', display: 'flex', alignItems: 'center', gap: 4 }}>
        {copied ? <CheckCircle size={12} color="#4ADE80" /> : <Copy size={12} />}
        <span className="f-mono" style={{ fontSize: '0.5rem' }}>{copied ? 'COPIED' : 'COPY'}</span>
      </button>
      {lines.map((line, i) => (
        <div key={i} className="f-mono" style={{ fontSize: '0.68rem', color: '#00E5FF', lineHeight: 1.7 }}>
          <span style={{ color: 'rgba(0,229,255,0.3)', marginRight: 8, userSelect: 'none' }}>$</span>
          {line}
        </div>
      ))}
    </div>
  );
}

export default function ConnectPage() {
  const [selected, setSelected] = useState('unitree');
  const robot = ROBOTS.find(r => r.id === selected);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }} className="grid-bg">

      {/* Header */}
      <div style={{ padding: '0.85rem 1.5rem', borderBottom: '1px solid rgba(0,229,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(6,12,18,0.95)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <Link href="/" style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '0.6rem', color: 'rgba(0,229,255,0.4)', letterSpacing: '0.2em', textDecoration: 'none' }}>AXIOM HUMANOID</Link>
          <span style={{ color: 'rgba(0,229,255,0.2)' }}>/</span>
          <span className="f-mono" style={{ fontSize: '0.65rem', color: 'var(--cyan)' }}>CONNECT ROBOT</span>
        </div>
        <Link href="/control" style={{ padding: '5px 14px', background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)', borderRadius: 5, fontFamily: "'Share Tech Mono',monospace", fontSize: '0.6rem', color: 'var(--cyan)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Zap size={10} /> Control Panel
        </Link>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '3rem 1.5rem' }}>

        {/* Hero */}
        <div style={{ marginBottom: '3rem' }}>
          <div className="htag htag-cyan" style={{ display: 'inline-flex', marginBottom: '1rem', fontSize: '0.58rem' }}>
            Open Network — Anyone Can Join
          </div>
          <h1 className="f-display" style={{ fontSize: 'clamp(2rem,5vw,3.5rem)', color: 'var(--text)', lineHeight: 1.1, marginBottom: '1rem' }}>
            CONNECT YOUR<br/>
            <span style={{ color: 'var(--cyan)', textShadow: '0 0 20px rgba(0,229,255,0.4)' }}>HUMANOID ROBOT</span>
          </h1>
          <p style={{ fontSize: '0.95rem', color: 'var(--textdim)', maxWidth: 560, lineHeight: 1.75, marginBottom: '1.5rem' }}>
            Run our open-source miner on your machine. Your robot picks up tasks
            posted on the AXIOM network, executes them, and submits verified
            Proof of Physical Work to Konnex — earning testKNX rewards.
          </p>

          {/* How it works flow */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'wrap', gap: '0.4rem' }}>
            {[
              { label: 'Task posted onchain',    color: 'var(--amber)' },
              { label: 'Your robot executes',    color: 'var(--teal)'  },
              { label: 'PoPW verified',          color: 'var(--cyan)'  },
              { label: 'Reward earned',          color: 'var(--green)' },
            ].map((s, i, arr) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <div style={{ padding: '5px 12px', background: `${s.color}08`, border: `1px solid ${s.color}25`, borderRadius: 5 }}>
                  <span className="f-mono" style={{ fontSize: '0.58rem', color: s.color }}>{s.label}</span>
                </div>
                {i < arr.length - 1 && <ChevronRight size={13} color="var(--muted)" />}
              </div>
            ))}
          </div>
        </div>

        {/* Robot selector */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem', marginBottom: '2rem' }}>
          {ROBOTS.map(r => (
            <button key={r.id} onClick={() => setSelected(r.id)} style={{
              padding: '1.1rem', textAlign: 'left', cursor: 'pointer',
              background: selected === r.id ? 'rgba(0,229,255,0.06)' : 'var(--bg2)',
              border: `1px solid ${selected === r.id ? 'rgba(0,229,255,0.3)' : 'rgba(0,229,255,0.08)'}`,
              borderTop: `3px solid ${selected === r.id ? 'var(--cyan)' : 'transparent'}`,
              borderRadius: 8, transition: 'all 0.2s',
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{r.logo}</div>
              <div className="f-display" style={{ fontSize: '0.95rem', color: selected === r.id ? 'var(--cyan)' : 'var(--text)', marginBottom: '0.3rem' }}>{r.name}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--textdim)', marginBottom: '0.5rem' }}>{r.desc}</div>
              <span className="f-mono" style={{ fontSize: '0.52rem', color: r.diffColor, background: `${r.diffColor}10`, padding: '2px 7px', borderRadius: 3, border: `1px solid ${r.diffColor}25` }}>
                {r.difficulty}
              </span>
            </button>
          ))}
        </div>

        {/* Selected robot detail */}
        {robot && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', alignItems: 'start' }}>

            {/* Steps */}
            <div className="hcard" style={{ borderRadius: 8, padding: '1.75rem' }}>
              <div className="f-mono" style={{ fontSize: '0.6rem', color: 'var(--cyan)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Terminal size={12} /> Setup: {robot.name}
              </div>

              {robot.steps.map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ flexShrink: 0, width: 24, height: 24, borderRadius: '50%', background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                    <span className="f-mono" style={{ fontSize: '0.6rem', color: 'var(--cyan)' }}>{i + 1}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text)', marginBottom: '0.2rem' }}>{step.title}</div>
                    <CodeBlock code={step.code} />
                  </div>
                </div>
              ))}

              {/* After running */}
              <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(74,222,128,0.04)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: 7 }}>
                <div className="f-mono" style={{ fontSize: '0.58rem', color: '#4ADE80', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
                  ✅ After running you will see:
                </div>
                {[
                  '━━ AXIOM Humanoid Subnet — Miner',
                  'Wallet   : 5Fxx...xxxx',
                  'Robot    : ' + robot.id,
                  'Chain: Konnex Testnet connected',
                  'Polling every 8s for tasks on subnet 4…',
                  '',
                  '━━ TASK: HUM-A1B2C3D4 [hum_pick_place]',
                  '→ Phase 1: commitHumanoidPoPW',
                  '  ✓ tx: 0xabc123… | block: 0xdef456…',
                  '→ Phase 3: writeHumanoidMemory',
                  '  ✓ tx: 0x789xyz…',
                  '━━ SUCCESS | PoPW 78',
                ].map((line, i) => (
                  <div key={i} className="f-mono" style={{ fontSize: '0.6rem', color: line.startsWith('━━') ? '#4ADE80' : line.startsWith('→') ? 'var(--cyan)' : line.startsWith('  ✓') ? 'var(--teal)' : 'var(--textdim)', lineHeight: 1.65, minHeight: line === '' ? '0.5rem' : 'auto' }}>
                    {line}
                  </div>
                ))}
              </div>
            </div>

            {/* Info panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* DOF info */}
              <div className="hcard" style={{ borderRadius: 8, padding: '1.25rem' }}>
                <div className="f-mono" style={{ fontSize: '0.56rem', color: 'var(--amber)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                  <Activity size={10} style={{ display: 'inline', marginRight: 5 }} />
                  Joint Telemetry
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--textdim)', lineHeight: 1.6, marginBottom: '0.75rem' }}>{robot.joints}</div>
                {[
                  { group: 'Head',      joints: 'head_yaw, head_pitch',             color: 'var(--textdim)' },
                  { group: 'Torso',     joints: 'spine_yaw, spine_pitch',           color: '#FFB547' },
                  { group: 'Left arm',  joints: 'shoulder, elbow, wrist, grip',     color: '#00E5FF' },
                  { group: 'Right arm', joints: 'shoulder, elbow, wrist, grip',     color: '#00FFB2' },
                  { group: 'Legs',      joints: 'l_hip, l_knee, r_hip, r_knee',     color: '#B794F4' },
                ].map(g => (
                  <div key={g.group} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <span className="f-mono" style={{ fontSize: '0.55rem', color: g.color }}>{g.group}</span>
                    <span className="f-mono" style={{ fontSize: '0.52rem', color: 'var(--muted)' }}>{g.joints}</span>
                  </div>
                ))}
              </div>

              {/* Notes */}
              <div className="hcard" style={{ borderRadius: 8, padding: '1.25rem' }}>
                <div className="f-mono" style={{ fontSize: '0.56rem', color: 'var(--cyan)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Notes</div>
                {robot.notes.map((note, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <span style={{ color: 'var(--cyan)', fontSize: '0.6rem', flexShrink: 0, marginTop: 1 }}>·</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--textdim)', lineHeight: 1.55 }}>{note}</span>
                  </div>
                ))}
              </div>

              {/* What happens onchain */}
              <div className="hcard" style={{ borderRadius: 8, padding: '1.25rem' }}>
                <div className="f-mono" style={{ fontSize: '0.56rem', color: 'var(--teal)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                  <Shield size={10} style={{ display: 'inline', marginRight: 5 }} />
                  Onchain Record
                </div>
                {[
                  { l: 'task_id',        c: 'var(--text)' },
                  { l: 'telemetry_hash', c: 'var(--teal)' },
                  { l: 'popw_score',     c: 'var(--amber)' },
                  { l: 'ipfs_cid',       c: 'var(--cyan)' },
                  { l: 'block_number',   c: 'var(--text)' },
                ].map(f => (
                  <div key={f.l} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                    <CheckCircle size={9} color="var(--teal)" />
                    <span className="f-mono" style={{ fontSize: '0.56rem', color: f.c }}>{f.l}</span>
                  </div>
                ))}
                <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '8px 0' }} />
                <div className="f-mono" style={{ fontSize: '0.54rem', color: 'var(--textdim)', lineHeight: 1.6 }}>
                  Raw joint traces → IPFS only<br />
                  Never stored onchain. Proprietary data stays private.
                </div>
              </div>

              {/* Get testKNX */}
              <div style={{ padding: '1rem', background: 'rgba(255,181,71,0.05)', border: '1px solid rgba(255,181,71,0.2)', borderRadius: 8 }}>
                <div className="f-mono" style={{ fontSize: '0.56rem', color: 'var(--amber)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Need testKNX?
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--textdim)', marginBottom: '0.6rem', lineHeight: 1.5 }}>
                  Get free testKNX from the Konnex faucet — needed to submit transactions.
                </div>
                <a href="https://subnets.testnet.konnex.world" target="_blank" rel="noreferrer"
                  style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: '0.62rem', color: 'var(--amber)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Globe size={11} /> subnets.testnet.konnex.world ↗
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Bottom CTA */}
        <div style={{ marginTop: '3rem', padding: '2rem', background: 'var(--bg2)', border: '1px solid rgba(0,229,255,0.1)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div className="f-display" style={{ fontSize: '1.3rem', color: 'var(--text)', marginBottom: '0.3rem' }}>Robot connected?</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--textdim)' }}>Open the control panel — post a task and watch your robot execute it onchain.</div>
          </div>
          <Link href="/control" style={{
            padding: '11px 24px', background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.35)',
            borderRadius: 7, fontFamily: "'Share Tech Mono',monospace", fontSize: '0.7rem',
            color: 'var(--cyan)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8,
            letterSpacing: '0.08em',
          }}>
            <Zap size={13} /> OPEN CONTROL PANEL <ChevronRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
}
