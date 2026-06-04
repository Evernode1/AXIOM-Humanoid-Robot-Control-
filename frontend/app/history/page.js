'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { loadDB, DB, EXPLORER, on, off } from '@/lib/chain';
import { CheckCircle, XCircle, Database, Globe, Zap, ChevronRight } from 'lucide-react';

export default function HistoryPage() {
  const [memories, setMemories] = useState([]);
  const [synced,   setSynced]   = useState(false);
  const [filter,   setFilter]   = useState('all'); // all | success | failed

  useEffect(() => {
    loadDB().then(() => {
      setMemories([...DB.memory].sort((a,b) => b.timestamp - a.timestamp));
      setSynced(true);
    });
    const onM = m => setMemories([...m].sort((a,b) => b.timestamp - a.timestamp));
    on('memory:updated', onM);
    return () => off('memory:updated', onM);
  }, []);

  const filtered = memories.filter(m =>
    filter === 'all' ? true :
    filter === 'success' ? m.outcome === 'SUCCESS' :
    m.outcome !== 'SUCCESS'
  );

  const avgScore = memories.length
    ? Math.round(memories.reduce((a,m) => a + (m.popw_score||0), 0) / memories.length)
    : 0;

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      {/* Header */}
      <div style={{ padding:'0.85rem 1.5rem', borderBottom:'1px solid rgba(0,229,255,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(6,12,18,0.95)', backdropFilter:'blur(10px)', position:'sticky', top:0, zIndex:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.85rem' }}>
          <Link href="/" style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:'0.6rem', color:'rgba(0,229,255,0.4)', letterSpacing:'0.2em', textDecoration:'none' }}>AXIOM HUMANOID</Link>
          <span style={{ color:'rgba(0,229,255,0.2)' }}>/</span>
          <span className="f-mono" style={{ fontSize:'0.65rem', color:'var(--cyan)' }}>PoPW HISTORY</span>
        </div>
        <Link href="/control" style={{ padding:'5px 14px', background:'rgba(0,229,255,0.08)', border:'1px solid rgba(0,229,255,0.2)', borderRadius:5, fontFamily:"'Share Tech Mono',monospace", fontSize:'0.6rem', color:'var(--cyan)', textDecoration:'none', display:'flex', alignItems:'center', gap:5 }}>
          <Zap size={10}/> Control Panel
        </Link>
      </div>

      <div style={{ maxWidth:900, margin:'0 auto', padding:'2.5rem 1.5rem' }}>
        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'1px', background:'rgba(0,229,255,0.08)', borderRadius:8, overflow:'hidden', marginBottom:'2rem' }}>
          {[
            { label:'Total PoPW',   value:memories.length,                                          color:'var(--text)' },
            { label:'Success',      value:memories.filter(m=>m.outcome==='SUCCESS').length,         color:'var(--teal)' },
            { label:'Failed',       value:memories.filter(m=>m.outcome!=='SUCCESS').length,         color:'var(--red)'  },
            { label:'Avg Score',    value:avgScore,                                                  color:'var(--amber)'},
          ].map((s,i) => (
            <div key={i} style={{ padding:'1.1rem 1.25rem', background:'var(--bg2)' }}>
              <div className="f-mono" style={{ fontSize:'0.52rem', color:'var(--textdim)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:3 }}>{s.label}</div>
              <div className="f-display" style={{ fontSize:'1.8rem', color:s.color, lineHeight:1 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div style={{ display:'flex', gap:0, marginBottom:'1.5rem', border:'1px solid rgba(0,229,255,0.1)', borderRadius:6, overflow:'hidden', width:'fit-content' }}>
          {['all','success','failed'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding:'6px 16px', border:'none', background:filter===f?'rgba(0,229,255,0.1)':'transparent', cursor:'pointer', fontFamily:"'Share Tech Mono',monospace", fontSize:'0.6rem', color:filter===f?'var(--cyan)':'var(--textdim)', borderBottom:filter===f?'2px solid var(--cyan)':'2px solid transparent', textTransform:'uppercase', letterSpacing:'0.08em', transition:'all 0.15s' }}>
              {f}
            </button>
          ))}
        </div>

        {/* Records */}
        {!synced && <div style={{ padding:'3rem', textAlign:'center' }}><span className="f-mono" style={{ fontSize:'0.62rem', color:'var(--muted)' }}>Loading…</span></div>}
        {synced && filtered.length === 0 && (
          <div style={{ padding:'3rem', textAlign:'center', border:'1px dashed rgba(0,229,255,0.08)', borderRadius:8 }}>
            <span className="f-mono" style={{ fontSize:'0.65rem', color:'var(--muted)' }}>No records yet — execute a task in the control panel</span>
          </div>
        )}
        <div style={{ display:'flex', flexDirection:'column', gap:'0.65rem' }}>
          {filtered.map((r,i) => {
            const ok = r.outcome === 'SUCCESS';
            return (
              <div key={r.task_id||i} className="hcard" style={{ borderRadius:8, padding:'1rem 1.25rem', borderLeft:`3px solid ${ok?'rgba(0,255,178,0.4)':'rgba(255,61,90,0.3)'}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', gap:'0.75rem', marginBottom:'0.4rem', flexWrap:'wrap' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    {ok ? <CheckCircle size={13} color="var(--teal)"/> : <XCircle size={13} color="var(--red)"/>}
                    <span style={{ fontSize:'0.85rem', color:'var(--text)' }}>
                      {r.task_label || (r.task_type||'').replace('hum_','').replace(/_/g,' ')}
                    </span>
                  </div>
                  <div style={{ display:'flex', gap:'0.4rem', flexShrink:0 }}>
                    <span className="htag" style={{ fontSize:'0.52rem', color:ok?'var(--teal)':'var(--red)', borderColor:ok?'rgba(0,255,178,0.25)':'rgba(255,61,90,0.25)', background:ok?'rgba(0,255,178,0.06)':'rgba(255,61,90,0.06)' }}>
                      PoPW {r.popw_score ?? '—'}
                    </span>
                    {r.vla_model && <span className="htag htag-cyan" style={{ fontSize:'0.5rem' }}>{r.vla_model}</span>}
                  </div>
                </div>

                <div style={{ display:'flex', gap:'1.25rem', flexWrap:'wrap', marginBottom:'0.35rem' }}>
                  {r.block_number && <div style={{ display:'flex', alignItems:'center', gap:4 }}><Database size={9} color="var(--cyan)"/><span className="f-mono" style={{ fontSize:'0.55rem', color:'var(--textdim)' }}>Block #{r.block_number?.toLocaleString()}</span></div>}
                  {r.ipfs_cid && <div style={{ display:'flex', alignItems:'center', gap:4 }}><Globe size={9} color="var(--amber)"/><span className="f-mono" style={{ fontSize:'0.54rem', color:'var(--muted)' }}>{r.ipfs_cid.slice(0,16)}…</span></div>}
                  {r.executed_at && <span className="f-mono" style={{ fontSize:'0.53rem', color:'var(--muted)' }}>{new Date(r.executed_at).toLocaleString()}</span>}
                </div>

                <div style={{ display:'flex', gap:'1rem' }}>
                  {r.tx_hash && (
                    <a href={`${EXPLORER}/explorer?tx=${r.tx_hash}`} target="_blank" rel="noreferrer"
                      style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:'0.55rem', color:'var(--purple)', textDecoration:'none', display:'flex', alignItems:'center', gap:3 }}>
                      ⛓ commit ↗
                    </a>
                  )}
                  {r.score_tx_hash && (
                    <a href={`${EXPLORER}/explorer?tx=${r.score_tx_hash}`} target="_blank" rel="noreferrer"
                      style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:'0.55rem', color:'var(--teal)', textDecoration:'none', display:'flex', alignItems:'center', gap:3 }}>
                      ✓ score ↗
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
