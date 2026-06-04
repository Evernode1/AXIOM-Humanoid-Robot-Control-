'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { loadDB, DB, CHAIN, WALLET, initChain, connectWallet, on, off } from '@/lib/chain';
import { TASK_PRESETS, VLA_MODELS } from '@/lib/robot';
import { Activity, Cpu, Database, Globe, Shield, Zap, ChevronRight, Network, Wifi, WifiOff } from 'lucide-react';

export default function Home() {
  const [stats,     setStats]     = useState({ tasks: 0, completed: 0, popwAvg: 0, robots: 0 });
  const [block,     setBlock]     = useState(0);
  const [synced,    setSynced]    = useState(false);
  const [chainConn, setChainConn] = useState(false);
  const [wallet,    setWallet]    = useState({ connected: false, address: null });

  useEffect(() => {
    loadDB().then(() => {
      const mem  = DB.memory;
      const tasks = DB.tasks;
      setStats({
        tasks:     tasks.length,
        completed: tasks.filter(t=>t.status==='completed').length,
        popwAvg:   mem.length ? Math.round(mem.reduce((a,m)=>a+(m.popw_score||0),0)/mem.length) : 0,
        robots:    new Set(mem.map(m=>m.robot_id)).size,
      });
      setSynced(true);
    });

    initChain().then(() => {
      setChainConn(true);
      setBlock(CHAIN.currentBlock);
    }).catch(() => {});

    const onBlock  = b => setBlock(b);
    const onWallet = w => setWallet({ connected: w.connected, address: w.address });
    const onMem    = m => {
      setStats(p => ({ ...p, popwAvg: m.length ? Math.round(m.reduce((a,x)=>a+(x.popw_score||0),0)/m.length) : 0 }));
    };
    on('chain:block',       onBlock);
    on('wallet:connected',  onWallet);
    on('memory:updated',    onMem);
    return () => { off('chain:block', onBlock); off('wallet:connected', onWallet); off('memory:updated', onMem); };
  }, []);

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }} className="grid-bg">
      {/* Top bar */}
      <div style={{ padding:'1rem 2rem', borderBottom:'1px solid rgba(0,229,255,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(6,12,18,0.9)', backdropFilter:'blur(10px)', position:'sticky', top:0, zIndex:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
          <span className="f-mono" style={{ fontSize:'0.6rem', color:'rgba(0,229,255,0.5)', letterSpacing:'0.2em' }}>KONNEX</span>
          <div style={{ width:1, height:16, background:'rgba(0,229,255,0.1)' }}/>
          <span className="f-display" style={{ fontSize:'1.1rem', color:'var(--cyan)', letterSpacing:'0.15em' }}>AXIOM HUMANOID</span>
          <span className="htag htag-cyan" style={{ fontSize:'0.5rem' }}>SUBNET 4</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'1.5rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            {chainConn ? <Wifi size={11} color="var(--teal)"/> : <WifiOff size={11} color="var(--muted)"/>}
            <span className="f-mono" style={{ fontSize:'0.58rem', color:chainConn?'var(--teal)':'var(--muted)' }}>
              {chainConn ? `Block #${block.toLocaleString()}` : 'Connecting…'}
            </span>
          </div>
          <Link href="/control" style={{ padding:'6px 16px', background:'rgba(0,229,255,0.1)', border:'1px solid rgba(0,229,255,0.3)', borderRadius:5, fontFamily:"'Share Tech Mono',monospace", fontSize:'0.65rem', color:'var(--cyan)', textDecoration:'none', display:'flex', alignItems:'center', gap:5 }}>
            <Zap size={11}/> LAUNCH CONTROL
          </Link>
        </div>
      </div>

      {/* Hero */}
      <div style={{ padding:'5rem 2rem 3rem', maxWidth:1100, margin:'0 auto', textAlign:'center' }}>
        <div className="htag htag-cyan" style={{ display:'inline-flex', marginBottom:'1.5rem', fontSize:'0.6rem' }}>
          Konnex Builder Program — Humanoid Robot Control Category
        </div>
        <h1 className="f-display" style={{ fontSize:'clamp(2.5rem,6vw,5rem)', color:'var(--text)', lineHeight:1.05, marginBottom:'1.5rem' }}>
          HUMANOID ROBOT<br/>
          <span style={{ color:'var(--cyan)', textShadow:'0 0 30px rgba(0,229,255,0.4)' }}>CONTROL SUBNET</span>
        </h1>
        <p style={{ fontSize:'1rem', color:'var(--textdim)', maxWidth:580, margin:'0 auto 2.5rem', lineHeight:1.75 }}>
          Real VLA-driven humanoid execution with onchain Proof of Physical Work.
          Every task produces a verified 96-byte record on Konnex Substrate.
          Full 16-DOF joint telemetry. Zero raw data onchain.
        </p>
        <div style={{ display:'flex', gap:'1rem', justifyContent:'center', flexWrap:'wrap' }}>
          <Link href="/control" style={{ padding:'12px 28px', background:'rgba(0,229,255,0.12)', border:'1px solid rgba(0,229,255,0.4)', borderRadius:7, fontFamily:"'Share Tech Mono',monospace", fontSize:'0.75rem', color:'var(--cyan)', textDecoration:'none', display:'flex', alignItems:'center', gap:8, letterSpacing:'0.1em' }}>
            <Zap size={14}/> OPEN CONTROL PANEL <ChevronRight size={14}/>
          </Link>
          <Link href="/history" style={{ padding:'12px 28px', background:'transparent', border:'1px solid rgba(0,229,255,0.15)', borderRadius:7, fontFamily:"'Share Tech Mono',monospace", fontSize:'0.75rem', color:'var(--textdim)', textDecoration:'none', display:'flex', alignItems:'center', gap:8 }}>
            <Database size={14}/> PoPW HISTORY
          </Link>
          <Link href="/connect" style={{ padding:'12px 28px', background:'rgba(0,255,178,0.06)', border:'1px solid rgba(0,255,178,0.2)', borderRadius:7, fontFamily:"'Share Tech Mono',monospace", fontSize:'0.75rem', color:'var(--teal)', textDecoration:'none', display:'flex', alignItems:'center', gap:8 }}>
            <Network size={14}/> CONNECT ROBOT
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'0 2rem 3rem' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'1px', background:'rgba(0,229,255,0.08)', borderRadius:8, overflow:'hidden' }}>
          {[
            { label:'Tasks Posted',  value:stats.tasks,     color:'var(--text)',   icon:Cpu },
            { label:'Completed',     value:stats.completed, color:'var(--teal)',   icon:Activity },
            { label:'Avg PoPW Score',value:stats.popwAvg,   color:'var(--amber)',  icon:Shield },
            { label:'Active Robots', value:stats.robots,    color:'var(--cyan)',   icon:Network },
          ].map((s,i) => {
            const Icon = s.icon;
            return (
              <div key={i} style={{ padding:'1.5rem', background:'var(--bg2)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:'0.5rem' }}>
                  <Icon size={12} color={s.color}/>
                  <span className="f-mono" style={{ fontSize:'0.56rem', color:'var(--textdim)', letterSpacing:'0.1em', textTransform:'uppercase' }}>{s.label}</span>
                </div>
                <div className="f-display" style={{ fontSize:'2.2rem', color:s.color, lineHeight:1 }}>{s.value}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Architecture */}
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'0 2rem 4rem' }}>
        <div className="f-mono" style={{ fontSize:'0.6rem', color:'rgba(0,229,255,0.4)', letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:'1rem', textAlign:'center' }}>// PoPW Protocol Flow</div>
        <div style={{ display:'flex', alignItems:'center', gap:0, overflowX:'auto', paddingBottom:'0.5rem' }}>
          {[
            { label:'VLA INFER',  desc:'Language+vision → policy',   color:'var(--cyan)' },
            { label:'JOINT EXEC', desc:'16 DOF @ 30–50Hz',           color:'var(--teal)' },
            { label:'TEL HASH',   desc:'Keccak-256 commitment',      color:'var(--amber)' },
            { label:'COMMIT',     desc:'Hash → Konnex block',        color:'var(--purple)' },
            { label:'VALIDATE',   desc:'5-of-N lazy validators',     color:'var(--amber)' },
            { label:'IPFS',       desc:'Full telemetry → CID',       color:'var(--teal)' },
            { label:'SETTLE',     desc:'96 bytes onchain forever',   color:'var(--green)' },
          ].map((s,i,arr) => (
            <div key={i} style={{ display:'flex', alignItems:'center', flexShrink:0 }}>
              <div style={{ padding:'0.75rem 1rem', background:'var(--bg2)', border:'1px solid rgba(0,229,255,0.08)', borderRadius:6, textAlign:'center', minWidth:100 }}>
                <div className="f-mono" style={{ fontSize:'0.58rem', color:s.color, letterSpacing:'0.1em', marginBottom:3 }}>{s.label}</div>
                <div style={{ fontSize:'0.62rem', color:'var(--textdim)' }}>{s.desc}</div>
              </div>
              {i < arr.length-1 && <ChevronRight size={16} color="var(--muted)" style={{ flexShrink:0 }}/>}
            </div>
          ))}
        </div>
      </div>

      {/* Task types */}
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'0 2rem 5rem' }}>
        <div className="f-mono" style={{ fontSize:'0.6rem', color:'rgba(0,229,255,0.4)', letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:'1rem' }}>// Supported Task Types</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:'0.75rem' }}>
          {TASK_PRESETS.map(t => {
            const dc = t.diff==='HARD'?'var(--red)':t.diff==='MEDIUM'?'var(--amber)':'var(--teal)';
            return (
              <Link key={t.id} href="/control" style={{ textDecoration:'none' }}>
                <div className="hcard" style={{ padding:'1rem', borderRadius:7, cursor:'pointer' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.4rem' }}>
                    <span className="f-display" style={{ fontSize:'0.95rem', color:'var(--text)' }}>{t.label}</span>
                    <span className="htag" style={{ color:dc, borderColor:`${dc}40`, background:`${dc}10`, alignSelf:'flex-start' }}>{t.diff}</span>
                  </div>
                  <div style={{ fontSize:'0.72rem', color:'var(--textdim)', marginBottom:'0.5rem' }}>{t.desc}</div>
                  <div style={{ fontSize:'0.62rem', color:'var(--muted)', fontFamily:"'Share Tech Mono',monospace" }}>{t.joints.length} primary joints · {t.timeout}s timeout</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
