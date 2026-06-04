'use client';
import Link from 'next/link';
import { Shield, Zap, CheckCircle } from 'lucide-react';

const VALIDATOR_SETUP = [
  { step: 1, title: 'Install dependencies', code: 'pip install substrate-interface numpy python-dotenv' },
  { step: 2, title: 'Set validator wallet (different from miner)', code: 'export KNX_MNEMONIC="your validator twelve word mnemonic"' },
  { step: 3, title: 'Run validator', code: 'python validator.py' },
];

export default function ValidatorsPage() {
  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <div style={{ padding:'0.85rem 1.5rem', borderBottom:'1px solid rgba(0,229,255,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(6,12,18,0.95)', backdropFilter:'blur(10px)', position:'sticky', top:0, zIndex:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.85rem' }}>
          <Link href="/" style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:'0.6rem', color:'rgba(0,229,255,0.4)', letterSpacing:'0.2em', textDecoration:'none' }}>AXIOM HUMANOID</Link>
          <span style={{ color:'rgba(0,229,255,0.2)' }}>/</span>
          <span className="f-mono" style={{ fontSize:'0.65rem', color:'var(--cyan)' }}>VALIDATORS</span>
        </div>
        <Link href="/control" style={{ padding:'5px 14px', background:'rgba(0,229,255,0.08)', border:'1px solid rgba(0,229,255,0.2)', borderRadius:5, fontFamily:"'Share Tech Mono',monospace", fontSize:'0.6rem', color:'var(--cyan)', textDecoration:'none', display:'flex', alignItems:'center', gap:5 }}>
          <Zap size={10}/> Control Panel
        </Link>
      </div>

      <div style={{ maxWidth:800, margin:'0 auto', padding:'3rem 1.5rem' }}>
        <div className="htag htag-purple" style={{ display:'inline-flex', marginBottom:'1rem', fontSize:'0.58rem' }}>Lazy Validator — 5-of-N Sampling</div>
        <h1 className="f-display" style={{ fontSize:'clamp(2rem,4vw,3rem)', color:'var(--text)', marginBottom:'1rem' }}>
          BECOME A <span style={{ color:'var(--purple)' }}>VALIDATOR</span>
        </h1>
        <p style={{ fontSize:'0.9rem', color:'var(--textdim)', maxWidth:520, lineHeight:1.75, marginBottom:'2.5rem' }}>
          Validators score PoPW submissions for the Humanoid subnet.
          5 validators are randomly sampled per submission.
          70% agreement threshold — earn KNX for honest scoring.
        </p>

        {/* How it works */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'1px', background:'rgba(183,148,244,0.1)', borderRadius:8, overflow:'hidden', marginBottom:'2rem' }}>
          {[
            { label:'Sampled 5-of-N',   desc:'Random selection per PoPW submission' },
            { label:'Score sections',    desc:'Each validator gets non-overlapping telemetry sections' },
            { label:'70% consensus',     desc:'Agree within 15 points → pass. Below → challenge round' },
          ].map((s,i) => (
            <div key={i} style={{ padding:'1.1rem', background:'var(--bg2)' }}>
              <div className="f-mono" style={{ fontSize:'0.58rem', color:'var(--purple)', letterSpacing:'0.1em', marginBottom:'0.3rem' }}>{s.label}</div>
              <div style={{ fontSize:'0.7rem', color:'var(--textdim)' }}>{s.desc}</div>
            </div>
          ))}
        </div>

        {/* Setup */}
        <div className="hcard" style={{ borderRadius:8, padding:'1.75rem', marginBottom:'1.5rem' }}>
          <div className="f-mono" style={{ fontSize:'0.6rem', color:'var(--purple)', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:'1.25rem', display:'flex', alignItems:'center', gap:6 }}>
            <Shield size={12}/> Validator Setup
          </div>
          {VALIDATOR_SETUP.map(s => (
            <div key={s.step} style={{ display:'flex', gap:'1rem', marginBottom:'1.25rem' }}>
              <div style={{ flexShrink:0, width:22, height:22, borderRadius:'50%', background:'rgba(183,148,244,0.1)', border:'1px solid rgba(183,148,244,0.25)', display:'flex', alignItems:'center', justifyContent:'center', marginTop:2 }}>
                <span className="f-mono" style={{ fontSize:'0.58rem', color:'var(--purple)' }}>{s.step}</span>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:'0.82rem', color:'var(--text)', marginBottom:'0.3rem' }}>{s.title}</div>
                <div style={{ background:'#020408', border:'1px solid rgba(183,148,244,0.12)', borderRadius:5, padding:'0.65rem 1rem' }}>
                  <span className="f-mono" style={{ fontSize:'0.68rem', color:'var(--purple)' }}>$ {s.code}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Scoring */}
        <div className="hcard" style={{ borderRadius:8, padding:'1.5rem' }}>
          <div className="f-mono" style={{ fontSize:'0.58rem', color:'var(--purple)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:'1rem' }}>Scoring Logic</div>
          {[
            'Verify SHA3-256 hash matches revealed telemetry',
            'Score assigned sections: joints, IMU, completion metrics',
            'Submit score onchain via submit_humanoid_validation_score()',
            'Deviant scores (>15 pts from median) flagged as potential fraud',
            'Challenge round triggered if <70% validators agree',
          ].map((s,i) => (
            <div key={i} style={{ display:'flex', gap:8, marginBottom:8 }}>
              <CheckCircle size={11} color="var(--purple)" style={{ flexShrink:0, marginTop:2 }}/>
              <span style={{ fontSize:'0.75rem', color:'var(--textdim)', lineHeight:1.55 }}>{s}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
