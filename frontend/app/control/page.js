'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  loadDB, DB, CHAIN, WALLET, initChain, connectWallet,
  chainHash, ipfsCid, shortHash, now,
  commitHumanoidPoPW, writeHumanoidMemory, postHumanoidTask,
  fbSaveMemory, fbSaveTask, fbUpdateTask,
  sendExtrinsic, on, off,
} from '@/lib/chain';
import {
  JOINTS, TASK_PRESETS, VLA_MODELS, PIPELINE_STAGES,
  simTelemetry, buildValidators,
} from '@/lib/robot';
import {
  Play, Square, CheckCircle, AlertTriangle, Database, Globe,
  Wifi, WifiOff, Activity, Cpu, Shield, Network,
  ChevronRight, Lock, Terminal, Zap, Plus, Clock,
} from 'lucide-react';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const CHARS = '0123456789abcdef';
const randHex = () => '0x' + Array.from({length:32}, ()=>CHARS[Math.floor(Math.random()*16)]).join('');

// ─── Humanoid SVG ─────────────────────────────────────────────────────────────
function HumanoidSVG({ tel, running, done }) {
  const j = tel?.joints || {};
  const ls  = ((j['l_shoulder']?.angle  || -20) * Math.PI/180);
  const rs  = ((j['r_shoulder']?.angle  || 20)  * Math.PI/180);
  const le  = ((j['l_elbow']?.angle     || 45)  * Math.PI/180);
  const re  = ((j['r_elbow']?.angle     || 45)  * Math.PI/180);
  const lh  = ((j['l_hip']?.angle       || 0)   * Math.PI/180);
  const rh  = ((j['r_hip']?.angle       || 0)   * Math.PI/180);
  const lk  = ((j['l_knee']?.angle      || 10)  * Math.PI/180);
  const rk  = ((j['r_knee']?.angle      || 10)  * Math.PI/180);
  const hy  = (j['head_yaw']?.angle     || 0);
  const sp  = (j['spine_pitch']?.angle  || 0);

  const LAx = 82  + Math.sin(ls)*38, LAy = 108 + Math.cos(ls)*38;
  const RAx = 118 - Math.sin(rs)*38, RAy = 108 + Math.cos(rs)*38;
  const LEx = LAx + Math.sin(ls+le)*32, LEy = LAy + Math.cos(ls+le)*32;
  const REx = RAx - Math.sin(rs+re)*32, REy = RAy + Math.cos(rs+re)*32;
  const LUx = 92  + Math.sin(lh)*28,  LUy = 198 + Math.cos(lh)*42;
  const RUx = 108 - Math.sin(rh)*28,  RUy = 198 + Math.cos(rh)*42;
  const LLx = LUx + Math.sin(lh+lk)*32, LLy = LUy + Math.cos(lh+lk)*32;
  const RLx = RUx - Math.sin(rh+rk)*32, RLy = RUy + Math.cos(rh+rk)*32;

  const glow   = running ? '#00E5FF' : done ? '#00FFB2' : '#1A2530';
  const joint  = running ? '#FFB547' : done ? '#00FFB2' : '#1A2530';
  const stroke = running ? '#00E5FF' : done ? '#00FFB2' : '#1A2530';

  return (
    <svg viewBox="0 0 200 310" style={{ width:'100%', maxWidth:160, filter:running?'drop-shadow(0 0 15px rgba(0,229,255,0.5))':done?'drop-shadow(0 0 10px rgba(0,255,178,0.3))':'none', transition:'all 0.5s' }}>
      {/* Ground */}
      {(running||done) && <ellipse cx="100" cy="300" rx="40" ry="6" fill={`${glow}15`}/>}
      {/* Spine */}
      <line x1={100+sp*0.3} y1="97" x2="100" y2="192" stroke={stroke} strokeWidth="2.5" strokeLinecap="round"/>
      {/* Torso */}
      <rect x="84" y={97+sp*0.3} width="32" height="54" rx="4" fill="var(--bg3)" stroke={stroke} strokeWidth="1.2"/>
      {/* Hip */}
      <rect x="86" y="185" width="28" height="12" rx="3" fill="var(--bg3)" stroke={stroke} strokeWidth="1"/>
      {/* Head */}
      <rect x={91+hy*0.12} y="67" width="18" height="24" rx="5" fill="var(--bg3)" stroke={stroke} strokeWidth="1.2"/>
      {/* Eyes */}
      <circle cx={96+hy*0.08} cy="76" r="2.2" fill={running?'var(--cyan)':done?'var(--teal)':'var(--muted)'}/>
      <circle cx={104+hy*0.08} cy="76" r="2.2" fill={running?'var(--cyan)':done?'var(--teal)':'var(--muted)'}/>
      {running && <circle cx={96+hy*0.08} cy="76" r="2.2" fill="var(--cyan)" opacity="0.6" style={{animation:'pulse 1s infinite'}}/>}
      {/* Neck */}
      <line x1="100" y1="91" x2={100+sp*0.3} y2="97" stroke={stroke} strokeWidth="2"/>
      {/* Shoulders */}
      <circle cx="84" cy="107" r="4" fill={joint}/><circle cx="116" cy="107" r="4" fill={joint}/>
      {/* Left arm */}
      <line x1="84" y1="107" x2={LAx} y2={LAy} stroke={stroke} strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx={LAx} cy={LAy} r="3.5" fill={joint}/>
      <line x1={LAx} y1={LAy} x2={LEx} y2={LEy} stroke={stroke} strokeWidth="2" strokeLinecap="round"/>
      <circle cx={LEx} cy={LEy} r="2.5" fill={joint}/>
      {/* Right arm */}
      <line x1="116" y1="107" x2={RAx} y2={RAy} stroke={stroke} strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx={RAx} cy={RAy} r="3.5" fill={joint}/>
      <line x1={RAx} y1={RAy} x2={REx} y2={REy} stroke={stroke} strokeWidth="2" strokeLinecap="round"/>
      <circle cx={REx} cy={REy} r="2.5" fill={joint}/>
      {/* Hip joints */}
      <circle cx="92" cy="197" r="4" fill={joint}/><circle cx="108" cy="197" r="4" fill={joint}/>
      {/* Left leg */}
      <line x1="92" y1="197" x2={LUx} y2={LUy} stroke={stroke} strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx={LUx} cy={LUy} r="3.5" fill={joint}/>
      <line x1={LUx} y1={LUy} x2={LLx} y2={LLy} stroke={stroke} strokeWidth="2" strokeLinecap="round"/>
      {/* Right leg */}
      <line x1="108" y1="197" x2={RUx} y2={RUy} stroke={stroke} strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx={RUx} cy={RUy} r="3.5" fill={joint}/>
      <line x1={RUx} y1={RUy} x2={RLx} y2={RLy} stroke={stroke} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

// ─── Joint bar ────────────────────────────────────────────────────────────────
function JointBar({ j, val }) {
  if (!val) return null;
  const [lo,hi] = j.range;
  const pct = ((val.angle - lo)/(hi-lo))*100;
  const nomPct = ((j.nom - lo)/(hi-lo))*100;
  return (
    <div style={{ marginBottom:5 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
        <span className="f-mono" style={{ fontSize:'0.55rem', color:val.active?'var(--text)':'var(--muted)' }}>{j.label}</span>
        <div style={{ display:'flex', gap:8 }}>
          <span className="f-mono" style={{ fontSize:'0.55rem', color:val.active?j.color:'var(--muted)' }}>
            {val.angle>=0?'+':''}{val.angle.toFixed(1)}°
          </span>
          <span className="f-mono" style={{ fontSize:'0.52rem', color:'var(--textdim)' }}>{val.torque.toFixed(2)}Nm</span>
        </div>
      </div>
      <div style={{ height:2, background:'rgba(255,255,255,0.04)', borderRadius:1, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${pct}%`, background:val.active?`linear-gradient(90deg,${j.color}60,${j.color})`:'rgba(255,255,255,0.08)', borderRadius:1, transition:'width 0.12s linear' }}/>
        <div style={{ position:'absolute', top:0, left:`${nomPct}%`, width:1, height:'100%', background:'rgba(255,255,255,0.15)' }}/>
      </div>
    </div>
  );
}

// ─── Main Control Page ────────────────────────────────────────────────────────
export default function ControlPage() {
  const [task,       setTask]       = useState(null);
  const [vla,        setVla]        = useState(VLA_MODELS[0]);
  const [tab,        setTab]        = useState('control');
  const [openTasks,  setOpenTasks]  = useState([]);
  const [memories,   setMemories]   = useState([]);
  const [synced,     setSynced]     = useState(false);
  const [chainOk,    setChainOk]    = useState(false);
  const [blockNum,   setBlockNum]   = useState(0);
  const [walletInfo, setWalletInfo] = useState({ connected:false, address:null, name:null });
  const [walletErr,  setWalletErr]  = useState('');

  // Execution state
  const [running,    setRunning]    = useState(false);
  const [stage,      setStage]      = useState(null);
  const [stagesDone, setStagesDone] = useState([]);
  const [elapsed,    setElapsed]    = useState(0);
  const [tel,        setTel]        = useState(null);
  const [hashAnim,   setHashAnim]   = useState('');
  const [telHash,    setTelHash]    = useState('');
  const [validators, setValidators] = useState([]);
  const [consensus,  setConsensus]  = useState(null);
  const [result,     setResult]     = useState(null);
  const [logs,       setLogs]       = useState([]);

  // Post task form
  const TEMPTY = { instruction:'', taskType:'', rewardKnx:10, robotId:'' };
  const [taskForm,  setTaskForm]  = useState(TEMPTY);
  const [posting,   setPosting]   = useState(false);
  const [postErr,   setPostErr]   = useState('');
  const [postDone,  setPostDone]  = useState(null);

  const telRef  = useRef(null);
  const hashRef = useRef(null);

  function addLog(msg, color='var(--textdim)') {
    setLogs(p => [{ ts:new Date().toISOString().slice(11,23), msg, color }, ...p].slice(0,120));
  }

  useEffect(() => {
    loadDB().then(() => {
      setOpenTasks([...DB.tasks].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)));
      setMemories([...DB.memory].sort((a,b)=>b.timestamp-a.timestamp));
      setSynced(true);
    });
    initChain().then(() => { setChainOk(true); setBlockNum(CHAIN.currentBlock); }).catch(()=>{});

    const onBlock  = b => setBlockNum(b);
    const onWallet = w => setWalletInfo({ connected:w.connected, address:w.address, name:w.name });
    const onTasks  = t => setOpenTasks([...t].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)));
    const onMem    = m => setMemories([...m].sort((a,b)=>b.timestamp-a.timestamp));
    on('chain:block', onBlock); on('wallet:connected', onWallet);
    on('tasks:updated', onTasks); on('memory:updated', onMem);
    return () => { off('chain:block', onBlock); off('wallet:connected', onWallet); off('tasks:updated', onTasks); off('memory:updated', onMem); };
  }, []);

  async function handleConnect() {
    try { setWalletErr(''); await connectWallet(); }
    catch(e) { setWalletErr(e.message); }
  }

  async function runStage(id, ms=900) {
    const s = PIPELINE_STAGES.find(x=>x.id===id);
    setStage(id);
    addLog(`[${s.label}] ${s.desc}`, s.color);
    await sleep(ms);
    setStagesDone(p=>[...p,id]);
  }

  async function handleExecute() {
    if (!task) return;
    if (!walletInfo.connected) { setWalletErr('Wallet connect karo pehle.'); return; }
    setWalletErr(''); setRunning(true); setResult(null); setTel(null);
    setValidators([]); setConsensus(null); setStagesDone([]); setHashAnim(''); setTelHash('');
    setTab('control');

    const ts      = Date.now();
    const robotId = walletInfo.address || 'AXIOM-HUM-001';
    addLog(`══ TASK START: ${task.label} ══`, 'var(--cyan)');
    addLog(`VLA: ${vla.label} @ ${vla.hz}Hz`, vla.color);

    // 1. VLA
    await runStage('vla', 1200);
    addLog(`Policy compiled — ${task.joints.length} primary joints armed`, 'var(--teal)');

    // 2. Execute
    setStage('execute');
    addLog(`[JOINT EXEC] Control loop starting @ ${vla.hz}Hz`, 'var(--teal)');
    const execDur = Math.min(task.timeout, 10) * 1000;
    const execStart = Date.now();
    await new Promise(resolve => {
      const tickMs = Math.round(1000/vla.hz);
      telRef.current = setInterval(() => {
        const e = (Date.now()-execStart)/1000;
        setElapsed(+e.toFixed(1));
        const t = simTelemetry(task, e);
        setTel(t);
        if (Date.now()-execStart >= execDur) { clearInterval(telRef.current); resolve(); }
      }, tickMs);
    });
    setStagesDone(p=>[...p,'execute']);
    const finalTel = simTelemetry(task, execDur/1000);
    setTel(finalTel);
    addLog(`Execution done — ${finalTel.completion.toFixed(1)}% complete · safety ${(finalTel.safety*100).toFixed(1)}%`, 'var(--green)');

    // 3. Hash
    await runStage('hash', 600);
    hashRef.current = setInterval(()=>setHashAnim(randHex()), 50);
    await sleep(500);
    const hash = chainHash(JSON.stringify({ robotId, task:task.id, vla:vla.id, tel:finalTel, ts }));
    clearInterval(hashRef.current);
    setTelHash(hash); setHashAnim(hash);
    addLog(`telemetry_hash: ${shortHash(hash)}`, 'var(--amber)');

    // 4. Commit onchain
    await runStage('commit', 300);
    let commitTx;
    try {
      commitTx = await commitHumanoidPoPW({ robotId, taskType:`hum_${task.id}`, telemetryHash:hash, timestamp:ts });
    } catch(e) {
      setWalletErr('Commit tx failed: ' + e.message);
      setRunning(false); setStage(null); return;
    }
    addLog(`commitHumanoidPoPW → Block #${commitTx.blockNumber?.toLocaleString()} | tx: ${shortHash(commitTx.txHash)}`, 'var(--purple)');

    // 5. Validate
    setStage('validate');
    addLog('[VALIDATE] Sampling 5-of-N lazy validators…', 'var(--amber)');
    const { vs, passed, ratio, score:vScore, challenged } = buildValidators(finalTel.popw);
    for (let i=0; i<vs.length; i++) {
      await sleep(380);
      setValidators(p=>[...p,vs[i]]);
      addLog(`${vs[i].id}${vs[i].challenge?' [CHG]':''}: score=${vs[i].score} stake=${vs[i].stake}K KNX`, vs[i].challenge?'var(--purple)':'var(--textdim)');
    }
    setConsensus({ passed, ratio, score:vScore, agree:vs.filter(v=>!v.challenge).length, total:vs.length, challenged });
    setStagesDone(p=>[...p,'validate']);
    addLog(`Consensus: ${(ratio*100).toFixed(0)}% agree → PoPW = ${vScore}${challenged?' [challenge round]':''}`, 'var(--green)');

    // 6. IPFS
    await runStage('ipfs', 800);
    const cid = ipfsCid(hash);
    addLog(`IPFS: full ${JOINTS.length}-DOF trace uploaded → ${cid.slice(0,28)}…`, 'var(--teal)');

    // 7. Settle
    await runStage('settle', 300);
    let scoreTx;
    try {
      scoreTx = await writeHumanoidMemory({
        taskId:`HUM-${ts.toString(16).slice(-8).toUpperCase()}`, robotId,
        taskType:`hum_${task.id}`, telemetryHash:hash,
        popwScore:vScore, cid, blockNumber:commitTx.blockNumber,
      });
    } catch(e) { scoreTx = { txHash:null, blockNumber:commitTx.blockNumber }; }
    addLog(`writeHumanoidMemory → tx: ${shortHash(scoreTx?.txHash)} | reward: ${(task.timeout*0.1).toFixed(1)} testKNX`, 'var(--green)');

    // Save
    const mem = {
      task_id:`HUM-${ts.toString(16).slice(-8).toUpperCase()}`, robot_id:robotId,
      task_type:`hum_${task.id}`, task_label:task.label, vla_model:vla.id,
      telemetry_hash:hash, popw_score:vScore, ipfs_cid:cid,
      block_number:scoreTx?.blockNumber||commitTx.blockNumber,
      tx_hash:commitTx.txHash, score_tx_hash:scoreTx?.txHash||null,
      completion_pct:finalTel.completion, safety_score:finalTel.safety,
      efficiency:finalTel.efficiency, subnet_id:4,
      outcome:vScore>=65?'SUCCESS':'FAILED',
      timestamp:ts, executed_at:new Date(ts).toISOString(),
    };
    await fbSaveMemory(mem).catch(console.warn);

    // Mark matching open task completed
    const match = DB.tasks.find(t=>t.status==='open'&&t.task_type===`hum_${task.id}`);
    if (match) await fbUpdateTask(match.task_id, { status:'completed', completed_at:new Date().toISOString(), popw_score:vScore, completed_by:robotId }).catch(console.warn);

    setResult(mem); setStage('done'); setRunning(false);
    addLog('══ PoPW COMPLETE ══', 'var(--green)');
  }

  async function handlePostTask() {
    if (!taskForm.instruction.trim()) { setPostErr('Instruction required'); return; }
    if (!taskForm.taskType)           { setPostErr('Task type required'); return; }
    if (!walletInfo.connected)        { setPostErr('Wallet connect karo pehle'); return; }
    setPosting(true); setPostErr(''); setPostDone(null);
    try {
      const t = await postHumanoidTask({ instruction:taskForm.instruction, taskType:taskForm.taskType, rewardKnx:parseFloat(taskForm.rewardKnx)||10, robotId:taskForm.robotId||null });
      setPostDone(t); setTaskForm(TEMPTY);
    } catch(e) { setPostErr(e.message); }
    setPosting(false);
  }

  const openCount     = openTasks.filter(t=>t.status==='open').length;
  const completedCount= openTasks.filter(t=>t.status==='completed').length;
  const curStage      = PIPELINE_STAGES.find(s=>s.id===stage);

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column' }}>

      {/* Header */}
      <div style={{ padding:'0.85rem 1.5rem', borderBottom:'1px solid rgba(0,229,255,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(6,12,18,0.95)', backdropFilter:'blur(10px)', position:'sticky', top:0, zIndex:10, flexWrap:'wrap', gap:'0.5rem' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.85rem' }}>
          <Link href="/" style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:'0.6rem', color:'rgba(0,229,255,0.4)', letterSpacing:'0.2em', textDecoration:'none' }}>AXIOM HUMANOID</Link>
          <span style={{ color:'rgba(0,229,255,0.2)' }}>/</span>
          <span className="f-mono" style={{ fontSize:'0.65rem', color:'var(--cyan)' }}>CONTROL PANEL</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'1.25rem', flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            {chainOk?<Wifi size={11} color="var(--teal)"/>:<WifiOff size={11} color="var(--muted)"/>}
            <span className="f-mono" style={{ fontSize:'0.58rem', color:chainOk?'var(--teal)':'var(--muted)' }}>
              {chainOk?`#${blockNum.toLocaleString()}`:'Connecting…'}
            </span>
          </div>
          {walletInfo.connected
            ? <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--teal)', boxShadow:'0 0 6px var(--teal)' }}/>
                <span className="f-mono" style={{ fontSize:'0.58rem', color:'var(--teal)' }}>{walletInfo.address?.slice(0,8)}…</span>
              </div>
            : <button onClick={handleConnect} style={{ padding:'5px 14px', background:'rgba(0,229,255,0.08)', border:'1px solid rgba(0,229,255,0.25)', borderRadius:5, cursor:'pointer', fontFamily:"'Share Tech Mono',monospace", fontSize:'0.62rem', color:'var(--cyan)' }}>
                Connect Wallet
              </button>
          }
        </div>
      </div>

      {walletErr && (
        <div style={{ padding:'0.6rem 1.5rem', background:'rgba(255,61,90,0.08)', borderBottom:'1px solid rgba(255,61,90,0.2)', fontFamily:"'Share Tech Mono',monospace", fontSize:'0.65rem', color:'var(--red)' }}>
          ⚠ {walletErr}
        </div>
      )}

      {/* Pipeline strip */}
      <div style={{ display:'grid', gridTemplateColumns:`repeat(${PIPELINE_STAGES.length},1fr)`, gap:'1px', background:'rgba(0,229,255,0.06)', borderBottom:'1px solid rgba(0,229,255,0.06)' }}>
        {PIPELINE_STAGES.map((s,i)=>{
          const done   = stagesDone.includes(s.id);
          const active = stage===s.id;
          return (
            <div key={s.id} style={{ padding:'0.5rem 0.65rem', background:active?`${s.color}08`:done?'rgba(0,255,178,0.02)':'var(--bg2)', borderBottom:active?`2px solid ${s.color}`:done?'2px solid rgba(0,255,178,0.25)':'2px solid transparent', transition:'all 0.3s' }}>
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                {done?<CheckCircle size={8} color="var(--teal)"/>:active?<div style={{ width:5,height:5,borderRadius:'50%',background:s.color,animation:'pulse 1s infinite' }}/>:<span className="f-mono" style={{ fontSize:'0.45rem',color:'var(--muted)' }}>{i+1}</span>}
                <span className="f-mono" style={{ fontSize:'0.48rem',letterSpacing:'0.08em',textTransform:'uppercase',color:done?'var(--teal)':active?s.color:'var(--muted)' }}>{s.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid rgba(0,229,255,0.08)', background:'var(--bg2)', flexWrap:'wrap' }}>
        {[
          {id:'control',   label:'Control'},
          {id:'telemetry', label:`Joint Telemetry${tel?` · ${JOINTS.length} DOF`:''}` },
          {id:'tasks',     label:`Task Board (${openCount} open · ${completedCount} done)`},
          {id:'log',       label:`Log${logs.length?` (${logs.length})`:''}`},
          {id:'history',   label:`PoPW History (${memories.length})`},
        ].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:'0.65rem 1.2rem', border:'none', borderBottom:tab===t.id?`2px solid var(--cyan)`:'2px solid transparent', background:tab===t.id?'rgba(0,229,255,0.06)':'transparent', cursor:'pointer', fontFamily:"'Share Tech Mono',monospace", fontSize:'0.6rem', color:tab===t.id?'var(--cyan)':'var(--textdim)', letterSpacing:'0.05em', transition:'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ CONTROL TAB ══════════════════════════════════════════════════════ */}
      {tab==='control' && (
        <div style={{ display:'grid', gridTemplateColumns:'240px 1fr 260px', flex:1, overflow:'hidden' }} className="ctrl-grid">

          {/* LEFT */}
          <div style={{ borderRight:'1px solid rgba(0,229,255,0.08)', overflowY:'auto', background:'var(--bg2)', padding:'1rem' }}>
            {/* VLA */}
            <div className="f-mono" style={{ fontSize:'0.56rem', color:'var(--textdim)', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:'0.65rem' }}>VLA Model</div>
            {VLA_MODELS.map(m=>(
              <button key={m.id} onClick={()=>setVla(m)} disabled={running}
                style={{ width:'100%', marginBottom:4, padding:'6px 8px', background:vla.id===m.id?`${m.color}10`:'rgba(255,255,255,0.02)', border:`1px solid ${vla.id===m.id?`${m.color}40`:'rgba(255,255,255,0.05)'}`, borderRadius:4, cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <span className="f-mono" style={{ fontSize:'0.63rem', color:vla.id===m.id?m.color:'var(--text)' }}>{m.label}</span>
                  <span className="f-mono" style={{ fontSize:'0.5rem', color:'var(--textdim)', marginLeft:6 }}>{m.detail}</span>
                </div>
                <span className="f-mono" style={{ fontSize:'0.5rem', color:'var(--teal)' }}>{m.hz}Hz</span>
              </button>
            ))}

            <div style={{ height:1, background:'rgba(0,229,255,0.08)', margin:'1rem 0' }}/>

            {/* Tasks */}
            <div className="f-mono" style={{ fontSize:'0.56rem', color:'var(--textdim)', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:'0.65rem' }}>Task Preset</div>
            {TASK_PRESETS.map(t=>{
              const sel = task?.id===t.id;
              const dc  = t.diff==='HARD'?'var(--red)':t.diff==='MEDIUM'?'var(--amber)':'var(--teal)';
              return (
                <button key={t.id} onClick={()=>{setTask(t);setResult(null);}} disabled={running}
                  style={{ width:'100%', marginBottom:5, padding:'8px 9px', background:sel?'rgba(0,229,255,0.06)':'rgba(255,255,255,0.01)', border:`1px solid ${sel?'rgba(0,229,255,0.2)':'rgba(255,255,255,0.04)'}`, borderLeft:`2px solid ${sel?'var(--cyan)':'transparent'}`, borderRadius:4, cursor:'pointer', textAlign:'left' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                    <span className="f-mono" style={{ fontSize:'0.62rem', color:sel?'var(--cyan)':'var(--text)' }}>{t.label}</span>
                    <span className="f-mono" style={{ fontSize:'0.48rem', color:dc }}>{t.diff}</span>
                  </div>
                  <div style={{ fontSize:'0.58rem', color:'var(--textdim)' }}>{t.desc}</div>
                </button>
              );
            })}

            <div style={{ height:1, background:'rgba(0,229,255,0.08)', margin:'1rem 0' }}/>

            <button onClick={handleExecute} disabled={!task||running}
              style={{ width:'100%', padding:'10px', background:!task||running?'rgba(0,229,255,0.03)':'rgba(0,229,255,0.1)', border:`1px solid ${!task||running?'rgba(0,229,255,0.08)':'rgba(0,229,255,0.35)'}`, borderRadius:6, cursor:!task||running?'not-allowed':'pointer', fontFamily:"'Share Tech Mono',monospace", fontSize:'0.68rem', color:!task||running?'var(--muted)':'var(--cyan)', display:'flex', alignItems:'center', justifyContent:'center', gap:7, transition:'all 0.2s' }}>
              {running
                ? <><div style={{ width:11,height:11,border:'2px solid rgba(0,229,255,0.3)',borderTopColor:'var(--cyan)',borderRadius:'50%',animation:'spin 0.7s linear infinite' }}/> EXECUTING…</>
                : <><Play size={12}/> EXECUTE + PoPW</>
              }
            </button>
          </div>

          {/* CENTER */}
          <div style={{ overflowY:'auto', padding:'1.25rem' }}>
            {/* Robot + metrics */}
            <div className="hcard" style={{ borderRadius:8, padding:'1.25rem', marginBottom:'1rem', display:'flex', gap:'1.5rem', alignItems:'center' }}>
              <div style={{ flexShrink:0, width:140, display:'flex', flexDirection:'column', alignItems:'center', gap:'0.4rem' }}>
                <HumanoidSVG tel={tel} running={running} done={!!result}/>
                <span className="f-mono" style={{ fontSize:'0.55rem', color:running?'var(--cyan)':result?'var(--teal)':'var(--muted)', letterSpacing:'0.1em', textTransform:'uppercase' }}>
                  {running?`● EXEC t=${elapsed}s`:result?'● DONE':'● STANDBY'}
                </span>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                {!task && <div style={{ padding:'2rem', textAlign:'center', border:'1px dashed rgba(0,229,255,0.1)', borderRadius:6 }}><span className="f-mono" style={{ fontSize:'0.62rem', color:'var(--muted)' }}>← Select task to begin</span></div>}
                {task && (
                  <>
                    <div style={{ background:'rgba(0,229,255,0.03)', border:'1px solid rgba(0,229,255,0.12)', borderRadius:6, padding:'0.75rem 0.9rem', marginBottom:'0.85rem' }}>
                      <div className="f-mono" style={{ fontSize:'0.5rem', color:'var(--cyan)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:'0.35rem' }}>VLA Instruction</div>
                      <div style={{ fontSize:'0.82rem', color:'var(--text)', lineHeight:1.6, fontStyle:'italic' }}>"{task.vla}"</div>
                      <div style={{ display:'flex', gap:12, marginTop:'0.5rem', flexWrap:'wrap' }}>
                        {[`MODEL:${vla.label}`,`HZ:${vla.hz}`,`TIMEOUT:${task.timeout}s`,`JOINTS:${task.joints.length}`].map(s=>(
                          <span key={s} className="f-mono" style={{ fontSize:'0.52rem', color:'var(--textdim)' }}>{s}</span>
                        ))}
                      </div>
                    </div>
                    {(tel||running) && (
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'1px', background:'rgba(0,229,255,0.06)', borderRadius:6, overflow:'hidden', marginBottom:'0.85rem' }}>
                        {[
                          {l:'Completion', v:`${tel?.completion??0}%`,               c:'var(--teal)'},
                          {l:'Safety',     v:`${((tel?.safety??0)*100).toFixed(1)}%`, c:'var(--green)'},
                          {l:'Efficiency', v:`${((tel?.efficiency??0)*100).toFixed(1)}%`,c:'var(--cyan)'},
                          {l:'PoPW Raw',   v:tel?.popw??0,                            c:'var(--amber)'},
                        ].map((m,i)=>(
                          <div key={i} style={{ padding:'0.75rem 0.85rem', background:'var(--bg3)' }}>
                            <div className="f-mono" style={{ fontSize:'0.5rem', color:'var(--textdim)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:3 }}>{m.l}</div>
                            <div className="f-display" style={{ fontSize:'1.25rem', color:m.c, lineHeight:1 }}>{m.v}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {hashAnim && (
                      <div style={{ background:'#020408', border:'1px solid rgba(255,181,71,0.12)', borderRadius:5, padding:'0.65rem 0.85rem', marginBottom:'0.85rem' }}>
                        <div className="f-mono" style={{ fontSize:'0.48rem', color:'var(--textdim)', letterSpacing:'0.1em', marginBottom:4 }}>TELEMETRY HASH — Keccak-256 (32B · onchain only)</div>
                        <div className="f-mono" style={{ fontSize:'0.6rem', color:running?'var(--amber)':'var(--teal)', wordBreak:'break-all', lineHeight:1.5, transition:'color 0.4s' }}>{hashAnim}</div>
                      </div>
                    )}
                    {validators.length>0 && (
                      <div style={{ marginBottom:'0.85rem' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                          <span className="f-mono" style={{ fontSize:'0.52rem', color:'var(--textdim)', textTransform:'uppercase', letterSpacing:'0.1em' }}>Validators ({validators.length}{consensus?.challenged?' · challenge':''})</span>
                          {consensus && <span className="htag" style={{ fontSize:'0.48rem', color:consensus.passed?'var(--green)':'var(--amber)', borderColor:consensus.passed?'rgba(74,222,128,0.3)':'rgba(255,181,71,0.3)', background:consensus.passed?'rgba(74,222,128,0.08)':'rgba(255,181,71,0.08)' }}>{(consensus.ratio*100).toFixed(0)}% {consensus.passed?'✓ PASS':'⚡'}</span>}
                        </div>
                        {validators.map((v,i)=>{
                          const dev = consensus && Math.abs(v.score-(consensus.score||70))>15;
                          return (
                            <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 8px', marginBottom:3, background:'rgba(255,255,255,0.02)', borderRadius:4, border:`1px solid ${v.challenge?'rgba(183,148,244,0.15)':dev?'rgba(255,61,90,0.15)':'rgba(255,255,255,0.04)'}`, animation:'fadeIn 0.3s ease' }}>
                              <span className="f-mono" style={{ fontSize:'0.57rem', color:v.challenge?'var(--purple)':'var(--amber)' }}>{v.id}{v.challenge?' [CHG]':''}</span>
                              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                                <span className="f-mono" style={{ fontSize:'0.5rem', color:'var(--muted)' }}>{v.stake}K</span>
                                <span className="f-display" style={{ fontSize:'0.9rem', color:dev?'var(--red)':'var(--green)' }}>{v.score}</span>
                              </div>
                            </div>
                          );
                        })}
                        {consensus && (
                          <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 8px', background:'rgba(0,255,178,0.04)', border:'1px solid rgba(0,255,178,0.1)', borderRadius:4, marginTop:4 }}>
                            <span className="f-mono" style={{ fontSize:'0.54rem', color:'var(--textdim)' }}>Consensus ({consensus.agree}/{consensus.total} agree)</span>
                            <span className="f-display" style={{ fontSize:'0.95rem', color:'var(--teal)' }}>{consensus.score}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {result && (
                      <div style={{ border:`1px solid ${result.outcome==='SUCCESS'?'rgba(74,222,128,0.25)':'rgba(255,61,90,0.25)'}`, borderRadius:7, padding:'1rem', background:result.outcome==='SUCCESS'?'rgba(74,222,128,0.03)':'rgba(255,61,90,0.03)' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:'0.75rem' }}>
                          <span>{result.outcome==='SUCCESS'?'✅':'❌'}</span>
                          <span className="f-mono" style={{ fontSize:'0.7rem', color:result.outcome==='SUCCESS'?'var(--green)':'var(--red)', letterSpacing:'0.08em' }}>
                            {result.outcome} — PoPW Score: {result.popw_score}
                          </span>
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5, marginBottom:'0.75rem' }}>
                          {[
                            {l:'task_id',      v:result.task_id},
                            {l:'block',        v:`#${result.block_number?.toLocaleString()}`},
                            {l:'hash',         v:shortHash(result.telemetry_hash)},
                            {l:'vla',          v:result.vla_model},
                            {l:'ipfs_cid',     v:result.ipfs_cid?.slice(0,16)+'…'},
                            {l:'subnet',       v:'4 (Humanoid)'},
                          ].map(f=>(
                            <div key={f.l} style={{ display:'flex', justifyContent:'space-between', padding:'3px 0', borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                              <span className="f-mono" style={{ fontSize:'0.53rem', color:'var(--textdim)' }}>{f.l}</span>
                              <span className="f-mono" style={{ fontSize:'0.55rem', color:'var(--text)' }}>{f.v}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
                          {result.tx_hash && <a href={`https://subnets.testnet.konnex.world/explorer?tx=${result.tx_hash}`} target="_blank" rel="noreferrer" style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:'0.58rem', color:'var(--purple)', textDecoration:'none' }}>⛓ Commit tx ↗</a>}
                          {result.score_tx_hash && <a href={`https://subnets.testnet.konnex.world/explorer?tx=${result.score_tx_hash}`} target="_blank" rel="noreferrer" style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:'0.58rem', color:'var(--teal)', textDecoration:'none' }}>✓ Score tx ↗</a>}
                        </div>
                        <div style={{ marginTop:'0.65rem', padding:'0.5rem 0.7rem', background:'rgba(255,255,255,0.02)', borderRadius:4, fontFamily:"'Share Tech Mono',monospace", fontSize:'0.53rem', color:'var(--textdim)', lineHeight:1.65 }}>
                          <span style={{ color:'var(--purple)' }}>onchain:</span> task_id + hash + score + cid (96 bytes)<br/>
                          <span style={{ color:'var(--teal)' }}>ipfs:</span> full {JOINTS.length}-DOF trace @ {vla.hz}Hz — private
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div style={{ borderLeft:'1px solid rgba(0,229,255,0.08)', overflowY:'auto', background:'var(--bg2)', padding:'1rem' }}>
            <div className="f-mono" style={{ fontSize:'0.55rem', color:'var(--textdim)', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:'0.85rem' }}>Protocol Reference</div>
            {[
              { title:'PoPW Weights', color:'var(--amber)', items:[{l:'completion_pct',v:'40%'},{l:'safety_score',v:'35%'},{l:'efficiency',v:'25%'}] },
              { title:'Sensor Inputs', color:'var(--cyan)',  items:[{l:'Joint angles 16 DOF'},{l:'Joint torques (Nm)'},{l:'IMU quaternion'},{l:'RGB-D camera'},{l:'Contact forces'},{l:'End-effector pose'}] },
              { title:'Onchain (96B)', color:'var(--teal)', items:[{l:'task_id',t:'✓'},{l:'telemetry_hash 32B',t:'✓'},{l:'popw_score',t:'✓'},{l:'ipfs_cid',t:'✓'},{l:'block_number',t:'✓'}] },
              { title:'ZK Roadmap',   color:'var(--purple)',items:[{l:'P1 Hash+consensus',v:'LIVE'},{l:'P2 Groth16 SNARK',v:'Q3 25'},{l:'P3 Safety ZK',v:'Q4 25'},{l:'P4 Full ZK-PoPW',v:'Q2 26'}] },
            ].map(sec=>(
              <div key={sec.title} style={{ marginBottom:'1.25rem' }}>
                <div className="f-mono" style={{ fontSize:'0.55rem', color:sec.color, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'0.5rem' }}>{sec.title}</div>
                {sec.items.map((item,i)=>(
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'3px 0', borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ display:'flex', gap:5 }}>
                      {item.t && <span style={{ color:sec.color, fontSize:'0.56rem' }}>{item.t}</span>}
                      <span className="f-mono" style={{ fontSize:'0.56rem', color:'var(--textdim)' }}>{item.l}</span>
                    </div>
                    {item.v && <span className="f-mono" style={{ fontSize:'0.55rem', color:sec.color }}>{item.v}</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ JOINT TELEMETRY TAB ══════════════════════════════════════════════ */}
      {tab==='telemetry' && (
        <div style={{ padding:'1.25rem', overflowY:'auto', flex:1 }}>
          {!tel
            ? <div style={{ padding:'3rem', textAlign:'center', border:'1px dashed rgba(0,229,255,0.08)', borderRadius:8 }}><span className="f-mono" style={{ fontSize:'0.62rem', color:'var(--muted)' }}>Execute a task to see live 16-DOF joint telemetry</span></div>
            : (
              <>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
                  <span className="f-mono" style={{ fontSize:'0.62rem', color:'var(--cyan)' }}>JOINT STATE — 16 DOF · t={elapsed}s</span>
                  <span className="f-mono" style={{ fontSize:'0.58rem', color:'var(--teal)' }}>{task?.joints.length} active joints</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:'1rem' }}>
                  {[['head','Head'],['torso','Torso'],['larm','Left Arm'],['rarm','Right Arm'],['legs','Legs']].map(([g,gl])=>(
                    <div key={g} className="hcard" style={{ padding:'1rem', borderRadius:7, borderTop:`2px solid ${JOINTS.find(j=>j.group===g)?.color||'var(--muted)'}30` }}>
                      <div className="f-mono" style={{ fontSize:'0.55rem', color:JOINTS.find(j=>j.group===g)?.color||'var(--muted)', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:8, paddingBottom:5, borderBottom:'1px solid rgba(255,255,255,0.04)' }}>{gl}</div>
                      {JOINTS.filter(j=>j.group===g).map(j=><JointBar key={j.id} j={j} val={tel.joints[j.id]}/>)}
                    </div>
                  ))}
                </div>
              </>
            )
          }
        </div>
      )}

      {/* ══ TASK BOARD TAB ═══════════════════════════════════════════════════ */}
      {tab==='tasks' && (
        <div style={{ padding:'1.25rem', overflowY:'auto', flex:1 }}>
          {/* Post task form */}
          <div className="hcard" style={{ borderRadius:8, padding:'1.25rem', marginBottom:'1.5rem', border:'1px solid rgba(0,229,255,0.15)' }}>
            <div className="f-mono" style={{ fontSize:'0.6rem', color:'var(--cyan)', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:'1rem', display:'flex', alignItems:'center', gap:6 }}>
              <Plus size={12}/> Post New Task Onchain
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem', marginBottom:'0.75rem' }}>
              <div style={{ gridColumn:'1/-1' }}>
                <label className="f-mono" style={{ fontSize:'0.55rem', color:'var(--textdim)', display:'block', marginBottom:'0.3rem', textTransform:'uppercase', letterSpacing:'0.1em' }}>Instruction *</label>
                <textarea rows={2} value={taskForm.instruction} onChange={e=>setTaskForm({...taskForm,instruction:e.target.value})} disabled={posting}
                  placeholder="Describe what the robot should do…"
                  style={{ width:'100%', padding:'7px 10px', background:'var(--bg)', border:'1px solid rgba(0,229,255,0.12)', borderRadius:5, color:'var(--text)', fontFamily:"'Share Tech Mono',monospace", fontSize:'0.7rem', resize:'vertical', outline:'none', boxSizing:'border-box' }}/>
              </div>
              <div>
                <label className="f-mono" style={{ fontSize:'0.55rem', color:'var(--textdim)', display:'block', marginBottom:'0.3rem', textTransform:'uppercase', letterSpacing:'0.1em' }}>Task Type *</label>
                <select value={taskForm.taskType} onChange={e=>setTaskForm({...taskForm,taskType:e.target.value})} disabled={posting}
                  style={{ width:'100%', padding:'7px 10px', background:'var(--bg)', border:'1px solid rgba(0,229,255,0.12)', borderRadius:5, color:'var(--text)', fontFamily:"'Share Tech Mono',monospace", fontSize:'0.7rem', outline:'none' }}>
                  <option value="">Select…</option>
                  {TASK_PRESETS.map(t=><option key={t.id} value={`hum_${t.id}`}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="f-mono" style={{ fontSize:'0.55rem', color:'var(--textdim)', display:'block', marginBottom:'0.3rem', textTransform:'uppercase', letterSpacing:'0.1em' }}>Reward (testKNX)</label>
                <input type="number" min="0" step="0.5" value={taskForm.rewardKnx} onChange={e=>setTaskForm({...taskForm,rewardKnx:e.target.value})} disabled={posting}
                  style={{ width:'100%', padding:'7px 10px', background:'var(--bg)', border:'1px solid rgba(0,229,255,0.12)', borderRadius:5, color:'var(--text)', fontFamily:"'Share Tech Mono',monospace", fontSize:'0.7rem', outline:'none', boxSizing:'border-box' }}/>
              </div>
            </div>
            {postErr  && <div className="f-mono" style={{ fontSize:'0.6rem', color:'var(--red)',  marginBottom:'0.5rem' }}>⚠ {postErr}</div>}
            {postDone && <div className="f-mono" style={{ fontSize:'0.6rem', color:'var(--teal)', marginBottom:'0.5rem' }}>✅ Task posted — ID: {postDone.task_id?.slice(0,20)}…</div>}
            <button onClick={handlePostTask} disabled={posting}
              style={{ padding:'8px 18px', background:'rgba(0,229,255,0.1)', border:'1px solid rgba(0,229,255,0.3)', borderRadius:5, cursor:posting?'not-allowed':'pointer', fontFamily:"'Share Tech Mono',monospace", fontSize:'0.65rem', color:'var(--cyan)', display:'flex', alignItems:'center', gap:7 }}>
              {posting?'Posting…':<><Zap size={12}/> Post Onchain</>}
            </button>
          </div>

          {/* Open tasks */}
          <div className="f-mono" style={{ fontSize:'0.6rem', color:'var(--amber)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:'0.75rem', display:'flex', alignItems:'center', gap:5 }}>
            <Clock size={11}/> Open Tasks ({openCount})
          </div>
          {openTasks.filter(t=>t.status==='open').map(t=>(
            <div key={t.task_id} className="hcard" style={{ borderRadius:7, padding:'1rem 1.25rem', marginBottom:'0.65rem', borderLeft:'2px solid var(--amber)', display:'flex', alignItems:'flex-start', gap:'0.85rem' }}>
              <div style={{ width:8,height:8,borderRadius:'50%',background:'var(--amber)',boxShadow:'0 0 8px var(--amber)',flexShrink:0,marginTop:4,animation:'pulse 2s infinite' }}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', justifyContent:'space-between', gap:'0.5rem', marginBottom:'0.3rem', flexWrap:'wrap' }}>
                  <span style={{ fontSize:'0.85rem', color:'var(--text)' }}>{t.instruction}</span>
                  <span className="htag htag-amber" style={{ flexShrink:0 }}>{t.reward_knx} KNX</span>
                </div>
                <div className="f-mono" style={{ fontSize:'0.56rem', color:'var(--textdim)' }}>{t.task_type} · {t.created_at?new Date(t.created_at).toLocaleString():'—'}</div>
              </div>
              <button onClick={()=>{ const preset=TASK_PRESETS.find(p=>`hum_${p.id}`===t.task_type); if(preset){setTask(preset);setTab('control');} }}
                style={{ flexShrink:0, padding:'5px 12px', background:'rgba(255,181,71,0.1)', border:'1px solid rgba(255,181,71,0.25)', borderRadius:4, cursor:'pointer', fontFamily:"'Share Tech Mono',monospace", fontSize:'0.58rem', color:'var(--amber)' }}>
                Execute →
              </button>
            </div>
          ))}

          {/* Completed */}
          {completedCount>0 && (
            <>
              <div className="f-mono" style={{ fontSize:'0.6rem', color:'var(--teal)', letterSpacing:'0.12em', textTransform:'uppercase', margin:'1.25rem 0 0.75rem', display:'flex', alignItems:'center', gap:5 }}>
                <CheckCircle size={11}/> Completed ({completedCount})
              </div>
              {openTasks.filter(t=>t.status==='completed').map(t=>(
                <div key={t.task_id} className="hcard" style={{ borderRadius:7, padding:'0.85rem 1.25rem', marginBottom:'0.5rem', borderLeft:'2px solid rgba(0,255,178,0.3)', opacity:0.8, display:'flex', alignItems:'center', gap:'0.85rem' }}>
                  <CheckCircle size={13} color="var(--teal)" style={{ flexShrink:0 }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'0.78rem', color:'var(--textdim)', textDecoration:'line-through', marginBottom:2 }}>{t.instruction}</div>
                    <div className="f-mono" style={{ fontSize:'0.55rem', color:'var(--muted)' }}>
                      {t.task_type} · PoPW {t.popw_score!=null?Math.round(typeof t.popw_score==='number'&&t.popw_score<=1?t.popw_score*100:t.popw_score):'—'} · {t.completed_at?new Date(t.completed_at).toLocaleString():'—'}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
          {openTasks.length===0&&<div style={{ padding:'2rem', textAlign:'center', border:'1px dashed rgba(0,229,255,0.08)', borderRadius:7 }}><span className="f-mono" style={{ fontSize:'0.62rem', color:'var(--muted)' }}>No tasks yet — post one above</span></div>}
        </div>
      )}

      {/* ══ LOG TAB ═══════════════════════════════════════════════════════════ */}
      {tab==='log' && (
        <div style={{ padding:'1rem', overflowY:'auto', flex:1, fontFamily:"'Share Tech Mono',monospace" }}>
          {logs.length===0&&<div style={{ padding:'2rem', textAlign:'center', color:'var(--muted)', fontSize:'0.62rem' }}>No logs yet</div>}
          {logs.map((l,i)=>(
            <div key={i} style={{ display:'flex', gap:12, marginBottom:3, fontSize:'0.6rem', lineHeight:1.55 }}>
              <span style={{ color:'var(--muted)', flexShrink:0 }}>{l.ts}</span>
              <span style={{ color:l.color }}>{l.msg}</span>
            </div>
          ))}
        </div>
      )}

      {/* ══ HISTORY TAB ═══════════════════════════════════════════════════════ */}
      {tab==='history' && (
        <div style={{ padding:'1.25rem', overflowY:'auto', flex:1 }}>
          <div className="f-mono" style={{ fontSize:'0.6rem', color:'var(--cyan)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:'1rem' }}>PoPW History — Humanoid Subnet 4 ({memories.length} records)</div>
          {memories.length===0&&<div style={{ padding:'2.5rem', textAlign:'center', border:'1px dashed rgba(0,229,255,0.08)', borderRadius:7 }}><span className="f-mono" style={{ fontSize:'0.62rem', color:'var(--muted)' }}>No records yet</span></div>}
          <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
            {memories.map((r,i)=>(
              <div key={r.task_id||i} className="hcard" style={{ borderRadius:7, padding:'0.85rem 1.1rem', borderLeft:`2px solid ${r.outcome==='SUCCESS'?'rgba(74,222,128,0.4)':'rgba(255,61,90,0.3)'}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.3rem', flexWrap:'wrap', gap:'0.5rem' }}>
                  <span style={{ fontSize:'0.82rem', color:'var(--text)' }}>{r.task_label||r.task_type?.replace('hum_','')?.replace(/_/g,' ')}</span>
                  <div style={{ display:'flex', gap:'0.4rem', flexShrink:0 }}>
                    <span className="htag" style={{ color:r.outcome==='SUCCESS'?'var(--green)':'var(--red)', borderColor:r.outcome==='SUCCESS'?'rgba(74,222,128,0.3)':'rgba(255,61,90,0.3)', background:r.outcome==='SUCCESS'?'rgba(74,222,128,0.08)':'rgba(255,61,90,0.08)', fontSize:'0.5rem' }}>PoPW {r.popw_score}</span>
                    <span className="htag htag-cyan" style={{ fontSize:'0.5rem' }}>{r.vla_model||'VLA'}</span>
                  </div>
                </div>
                <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap' }}>
                  <span className="f-mono" style={{ fontSize:'0.55rem', color:'var(--textdim)' }}>Block #{r.block_number?.toLocaleString()}</span>
                  <span className="f-mono" style={{ fontSize:'0.54rem', color:'var(--muted)' }}>{r.executed_at?new Date(r.executed_at).toLocaleString():'—'}</span>
                  {r.tx_hash && <a href={`https://subnets.testnet.konnex.world/explorer?tx=${r.tx_hash}`} target="_blank" rel="noreferrer" style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:'0.55rem', color:'var(--cyan)', textDecoration:'none' }}>↗ explorer</a>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes pulse  { 0%,100%{opacity:1}50%{opacity:0.3} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none} }
        .ctrl-grid { grid-template-columns: 240px 1fr 260px; }
        @media(max-width:1000px) { .ctrl-grid { grid-template-columns: 1fr; } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,229,255,0.2); border-radius: 2px; }
      `}</style>
    </div>
  );
}
