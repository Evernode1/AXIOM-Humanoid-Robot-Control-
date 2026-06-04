// lib/robot.js — Humanoid simulation engine
// In production: replace simTelemetry() with real robot SDK (Unitree SDK2 / ROS2)

export const JOINTS = [
  { id:'spine_yaw',   label:'Spine Yaw',    group:'torso', nom:0,   range:[-45,45],  color:'#FFB547' },
  { id:'spine_pitch', label:'Spine Pitch',  group:'torso', nom:0,   range:[-30,30],  color:'#FFB547' },
  { id:'l_shoulder',  label:'L Shoulder',   group:'larm',  nom:-20, range:[-90,90],  color:'#00E5FF' },
  { id:'l_elbow',     label:'L Elbow',      group:'larm',  nom:45,  range:[0,150],   color:'#00E5FF' },
  { id:'l_wrist',     label:'L Wrist',      group:'larm',  nom:0,   range:[-60,60],  color:'#00E5FF' },
  { id:'l_grip',      label:'L Grip',       group:'larm',  nom:0,   range:[0,100],   color:'#00E5FF' },
  { id:'r_shoulder',  label:'R Shoulder',   group:'rarm',  nom:20,  range:[-90,90],  color:'#00FFB2' },
  { id:'r_elbow',     label:'R Elbow',      group:'rarm',  nom:45,  range:[0,150],   color:'#00FFB2' },
  { id:'r_wrist',     label:'R Wrist',      group:'rarm',  nom:0,   range:[-60,60],  color:'#00FFB2' },
  { id:'r_grip',      label:'R Grip',       group:'rarm',  nom:0,   range:[0,100],   color:'#00FFB2' },
  { id:'l_hip',       label:'L Hip',        group:'legs',  nom:0,   range:[-60,60],  color:'#B794F4' },
  { id:'l_knee',      label:'L Knee',       group:'legs',  nom:10,  range:[0,120],   color:'#B794F4' },
  { id:'r_hip',       label:'R Hip',        group:'legs',  nom:0,   range:[-60,60],  color:'#B794F4' },
  { id:'r_knee',      label:'R Knee',       group:'legs',  nom:10,  range:[0,120],   color:'#B794F4' },
  { id:'head_yaw',    label:'Head Yaw',     group:'head',  nom:0,   range:[-60,60],  color:'#5A7080' },
  { id:'head_pitch',  label:'Head Pitch',   group:'head',  nom:-5,  range:[-30,30],  color:'#5A7080' },
];

export const TASK_PRESETS = [
  {
    id:'pick_place', label:'Pick & Place', diff:'MEDIUM', timeout:30, icon:'⬡',
    desc:'Grasp object from surface, place in target bin',
    vla:'Pick the red object from the table and place it precisely in the blue bin.',
    joints:['r_shoulder','r_elbow','r_wrist','r_grip'],
    motion: { spine_pitch: 15, r_shoulder: 60, r_elbow: 90, r_wrist: 20, r_grip: 80 },
  },
  {
    id:'bimanual_assemble', label:'Bimanual Assembly', diff:'HARD', timeout:60, icon:'⬡',
    desc:'Two-handed component insertion with precision',
    vla:'Use both hands to align and insert the peg into the fixture hole.',
    joints:['l_shoulder','l_elbow','l_wrist','l_grip','r_shoulder','r_elbow','r_wrist','r_grip'],
    motion: { l_shoulder:40, l_elbow:80, l_grip:70, r_shoulder:40, r_elbow:80, r_grip:70 },
  },
  {
    id:'loco_navigate', label:'Loco-Navigation', diff:'MEDIUM', timeout:45, icon:'⬡',
    desc:'Walk to target zone avoiding obstacles',
    vla:'Walk from current position to zone B, avoiding the red obstacles on the floor.',
    joints:['l_hip','l_knee','r_hip','r_knee','spine_pitch','spine_yaw'],
    motion: { l_hip:30, l_knee:60, r_hip:-30, r_knee:60, spine_pitch:5 },
  },
  {
    id:'handover', label:'Object Handover', diff:'HARD', timeout:25, icon:'⬡',
    desc:'Receive from human, pass to second person',
    vla:'Receive the bottle from the human operator and hand it to the person on your right.',
    joints:['r_shoulder','r_elbow','r_wrist','r_grip','head_yaw','head_pitch'],
    motion: { r_shoulder:45, r_elbow:70, r_grip:60, head_yaw:30, head_pitch:-10 },
  },
  {
    id:'inspection', label:'Visual Inspection', diff:'EASY', timeout:35, icon:'⬡',
    desc:'Scan panel surface, detect anomalies',
    vla:'Inspect the welding seam along the panel edge and identify defects.',
    joints:['head_yaw','head_pitch','spine_yaw','l_shoulder','r_shoulder'],
    motion: { head_yaw:45, head_pitch:-15, spine_yaw:20, l_shoulder:20, r_shoulder:20 },
  },
  {
    id:'whole_body_reach', label:'Whole-Body Reach', diff:'HARD', timeout:40, icon:'⬡',
    desc:'Coordinated torso + arm extension to overhead shelf',
    vla:'Reach the overhead shelf at 2.1m height, grasp the item on the left, lower carefully.',
    joints:['spine_pitch','spine_yaw','l_shoulder','l_elbow','l_wrist','l_grip'],
    motion: { spine_pitch:-20, l_shoulder:85, l_elbow:30, l_wrist:10, l_grip:90 },
  },
];

export const VLA_MODELS = [
  { id:'openvla',     label:'OpenVLA',   detail:'7B · general manipulation',      hz:30, color:'#00E5FF' },
  { id:'pi0',         label:'π₀',        detail:'3B · dexterous fine-motor',       hz:50, color:'#00FFB2' },
  { id:'pi05',        label:'π₀.₅',      detail:'3B · language-conditioned',       hz:50, color:'#FFB547' },
  { id:'openvla_oft', label:'OFT',       detail:'OpenVLA fine-tuned · bimanual',   hz:30, color:'#B794F4' },
];

export const PIPELINE_STAGES = [
  { id:'vla',      label:'VLA INFER',   color:'#00E5FF', desc:'Language + vision → joint policy' },
  { id:'execute',  label:'JOINT EXEC',  color:'#00FFB2', desc:`Control loop @ model Hz` },
  { id:'hash',     label:'TEL HASH',    color:'#FFB547', desc:'Keccak-256 of full telemetry stream' },
  { id:'commit',   label:'COMMIT',      color:'#B794F4', desc:'Hash anchored on Konnex block' },
  { id:'validate', label:'VALIDATE',    color:'#FFB547', desc:'5-of-N lazy validators score' },
  { id:'ipfs',     label:'IPFS',        color:'#00FFB2', desc:'Full telemetry → IPFS CID' },
  { id:'settle',   label:'SETTLE',      color:'#4ADE80', desc:'PoPW score + reward committed onchain' },
];

// ── Simulation ────────────────────────────────────────────────────────────────
export function simTelemetry(task, elapsed) {
  // In production: replace with real robot SDK data
  // Unitree SDK2: unitree_sdk2.go.UnitreeSdk2.GetLowState()
  // ROS2: /joint_states topic subscriber
  const prog = Math.min(1, elapsed / task.timeout);
  const joints = {};

  JOINTS.forEach(j => {
    const isActive = task.joints.includes(j.id);
    const [lo, hi] = j.range;
    const target = task.motion?.[j.id] || j.nom;
    const motion = isActive
      ? target * Math.sin(prog * Math.PI) + (Math.random()-0.5)*4
      : j.nom + (Math.random()-0.5)*1.5;
    const angle  = Math.min(hi, Math.max(lo, motion));
    const torque = isActive
      ? Math.abs(target - j.nom) / 90 * (1.2 + Math.random()*0.8)
      : Math.random() * 0.08;
    joints[j.id] = { angle: +angle.toFixed(2), torque: +torque.toFixed(3), active: isActive };
  });

  const completion = prog * 100;
  const safety     = Math.max(0.75, 1 - Math.random()*0.12);
  const efficiency = Math.max(0.5,  1 - (elapsed/task.timeout)*0.3);
  const popw       = (completion/100)*0.40 + safety*0.35 + efficiency*0.25;

  return {
    joints,
    completion: +completion.toFixed(1),
    safety:     +safety.toFixed(4),
    efficiency: +efficiency.toFixed(4),
    popw:       +popw.toFixed(4),
    elapsed:    +elapsed.toFixed(2),
    hz:         0, // fill with real control Hz in production
    timestamp:  Date.now(),
  };
}

export function buildValidators(baseScore) {
  const pool = ['VAL-A1','VAL-B3','VAL-C7','VAL-D2','VAL-E5','VAL-F9','VAL-G4','VAL-H8'];
  const sampled = [...pool].sort(()=>Math.random()-0.5).slice(0,5);
  const vs = sampled.map(id => ({
    id, stake: Math.floor(10 + Math.random()*90),
    sections: Math.floor(2 + Math.random()*4),
    score: Math.round(Math.min(100, Math.max(30, baseScore*100 + (Math.random()-0.5)*18))),
    challenge: false,
  }));
  const scores  = vs.map(v=>v.score);
  const median  = [...scores].sort((a,b)=>a-b)[2];
  const agreeing = vs.filter(v=>Math.abs(v.score-median)<=15);
  const ratio   = agreeing.length/vs.length;
  if (ratio < 0.70) {
    const challengers = ['VAL-CHG1','VAL-CHG2','VAL-CHG3'].map(id => ({
      id, stake: Math.floor(30+Math.random()*80), sections: Math.floor(3+Math.random()*3),
      score: Math.round(Math.min(100,Math.max(50, baseScore*100+(Math.random()-0.5)*8))),
      challenge: true,
    }));
    const allVs = [...vs,...challengers];
    const finalScore = Math.round(allVs.reduce((a,v)=>a+v.score,0)/allVs.length);
    return { vs:allVs, passed:true, ratio:0.72, score:finalScore, median, challenged:true };
  }
  return { vs, passed:ratio>=0.7, ratio:+ratio.toFixed(2), score:Math.round(baseScore*100), median, challenged:false };
}
