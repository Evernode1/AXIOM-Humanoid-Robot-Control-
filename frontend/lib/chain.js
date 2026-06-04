/**
 * lib/chain.js — AXIOM Humanoid Subnet
 * Real Konnex Substrate testnet via @polkadot/api
 * Firebase Firestore for real-time fleet state
 */

// ── Konnex Testnet ────────────────────────────────────────────────────────────
export const RPC_ENDPOINTS = [
  'wss://testnet-rpc1.konnex.world:39944',
  'wss://testnet-rpc1.konnex.world',
  'wss://testnet-rpc1.konnex.world:443',
];
export const EXPLORER     = 'https://subnets.testnet.konnex.world';
export const SUBNET_ID    = 4; // Humanoid Control

// ── Firebase config — replace with your project ───────────────────────────────
const FB_CONFIG = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY            || 'AIzaSyAZ1eRiyICMcKPV94pIw-4QUmfyOMtoLjQ',
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN        || 'axiom-1e137.firebaseapp.com',
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID         || 'axiom-1e137',
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET     || 'axiom-1e137.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID|| '877997801498',
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID             || '1:877997801498:web:fdb2ca9afc5c71557811a3',
};

// ── Mutable singletons ────────────────────────────────────────────────────────
export const CHAIN = {
  api: null, connected: false, currentBlock: 0, status: 'disconnected',
};
export const WALLET = {
  connected: false, address: null, name: null, signer: null, readOnly: false,
};
export const DB = {
  robots: [], tasks: [], memory: [], reputation: {},
};

// ── Events ────────────────────────────────────────────────────────────────────
const _ev = {};
export const on   = (e,f) => { (_ev[e]=_ev[e]||[]).push(f); };
export const off  = (e,f) => { if(_ev[e]) _ev[e]=_ev[e].filter(x=>x!==f); };
export const emit = (e,d) => { (_ev[e]||[]).forEach(f=>f(d)); };

// ── Helpers ───────────────────────────────────────────────────────────────────
export function chainHash(str) {
  let h1=0xdeadbeef, h2=0x41c6ce57;
  for(let i=0;i<str.length;i++){
    const c=str.charCodeAt(i);
    h1=Math.imul(h1^c,2654435761);
    h2=Math.imul(h2^c,1597334677);
  }
  h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);
  h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
  const part1=(4294967296*(2097151&h2)+(h1>>>0)).toString(16).padStart(16,'0');
  return '0x'+part1.repeat(4).slice(0,64);
}
export const now       = () => new Date().toISOString();
export const ipfsCid   = h  => 'Qm' + h.replace('0x','').slice(0,44);
export const shortHash = h  => h ? `${h.slice(0,10)}…${h.slice(-6)}` : '—';

// ── Firebase ──────────────────────────────────────────────────────────────────
function getFS() {
  if (typeof window === 'undefined') return null;
  try {
    if (!firebase.apps.length) firebase.initializeApp(FB_CONFIG);
    return firebase.firestore();
  } catch { return null; }
}

export async function fbSave(collection, id, data) {
  try { await getFS()?.collection(collection).doc(id).set(data); } catch(e) { console.warn('[FB]', e.message); }
}
export async function fbUpdate(collection, id, fields) {
  try {
    await getFS()?.collection(collection).doc(id).update(fields);
    emit(`${collection}:updated`, fields);
  } catch(e) { console.warn('[FB] update:', e.message); }
}
export async function fbSaveMemory(entry) {
  const id = `hum_${entry.robot_id?.slice(-8)}_${entry.task_id?.slice(-8)}_${Date.now()}`;
  await fbSave('humanoid_memory', id, entry);
  DB.memory.unshift(entry);
  emit('memory:updated', DB.memory);
}
export async function fbSaveTask(task) {
  await fbSave('humanoid_tasks', task.task_id, task);
  const i = DB.tasks.findIndex(t=>t.task_id===task.task_id);
  if (i>=0) DB.tasks[i]=task; else DB.tasks.unshift(task);
  emit('tasks:updated', DB.tasks);
}
export async function fbUpdateTask(taskId, fields) {
  await fbUpdate('humanoid_tasks', taskId, fields);
  const t = DB.tasks.find(t=>t.task_id===taskId);
  if (t) Object.assign(t, fields);
  emit('tasks:updated', DB.tasks);
}

// ── Load all data + realtime listeners ───────────────────────────────────────
export async function loadDB() {
  const fs = getFS();
  if (!fs) return;
  try {
    const [tasksSnap, memSnap] = await Promise.all([
      fs.collection('humanoid_tasks').orderBy('created_at','desc').limit(50).get(),
      fs.collection('humanoid_memory').orderBy('timestamp','desc').limit(100).get(),
    ]);
    DB.tasks  = tasksSnap.docs.map(d=>d.data());
    DB.memory = memSnap.docs.map(d=>d.data());
    emit('tasks:updated',  DB.tasks);
    emit('memory:updated', DB.memory);

    // Realtime
    fs.collection('humanoid_tasks').onSnapshot(snap => {
      snap.docChanges().forEach(ch => {
        const d = ch.doc.data();
        if (ch.type==='added')    { if(!DB.tasks.find(t=>t.task_id===d.task_id)) DB.tasks.unshift(d); }
        else if (ch.type==='modified') { const i=DB.tasks.findIndex(t=>t.task_id===d.task_id); if(i>=0) DB.tasks[i]=d; }
        else if (ch.type==='removed')  { DB.tasks=DB.tasks.filter(t=>t.task_id!==d.task_id); }
      });
      emit('tasks:updated', DB.tasks);
    });
    fs.collection('humanoid_memory').onSnapshot(snap => {
      snap.docChanges().forEach(ch => {
        const d = ch.doc.data();
        if (ch.type==='added' && !DB.memory.find(m=>m.task_id===d.task_id && m.robot_id===d.robot_id)) DB.memory.unshift(d);
      });
      emit('memory:updated', DB.memory);
    });
  } catch(e) { console.warn('[DB]', e.message); }
}

// ── Wallet connect ────────────────────────────────────────────────────────────
export async function connectWallet() {
  if (typeof window === 'undefined') throw new Error('Browser only');
  const { web3Enable, web3Accounts } = await import('https://cdn.jsdelivr.net/npm/@polkadot/extension-dapp@0.46.6/+esm');
  const extensions = await web3Enable('AXIOM Humanoid');
  if (!extensions.length) throw new Error('No wallet extension found. Install SubWallet or Talisman.');
  const accounts = await web3Accounts();
  if (!accounts.length) throw new Error('No accounts found. Create an account in your wallet.');
  const account = accounts[0];
  const { web3FromAddress } = await import('https://cdn.jsdelivr.net/npm/@polkadot/extension-dapp@0.46.6/+esm');
  const injected = await web3FromAddress(account.address);
  WALLET.connected = true;
  WALLET.address   = account.address;
  WALLET.name      = account.meta?.name || 'Unknown';
  WALLET.signer    = injected.signer;
  WALLET.readOnly  = false;
  emit('wallet:connected', WALLET);
  return WALLET;
}

// ── Chain connect ─────────────────────────────────────────────────────────────
export async function initChain() {
  if (CHAIN.api) return CHAIN.api;
  CHAIN.status = 'connecting';
  emit('chain:status', 'connecting');
  const { ApiPromise, WsProvider } = await new Promise((res, rej) => {
    let tries = 0;
    const check = setInterval(() => {
      if (window.__polkadotApiLoaded) { clearInterval(check); res({ ApiPromise: window.PolkadotApiPromise, WsProvider: window.PolkadotWsProvider }); }
      if (++tries > 30) { clearInterval(check); rej(new Error('@polkadot/api not loaded')); }
    }, 200);
  });
  for (const url of RPC_ENDPOINTS) {
    try {
      const provider = new WsProvider(url, 5000);
      const api = await ApiPromise.create({ provider, throwOnConnect: true, throwOnUnknown: false });
      CHAIN.api = api; CHAIN.connected = true; CHAIN.status = 'connected';
      api.rpc.chain.subscribeNewHeads(h => { CHAIN.currentBlock = h.number.toNumber(); emit('chain:block', CHAIN.currentBlock); });
      emit('chain:status', 'connected');
      console.log('[Chain] Connected to Konnex via', url);
      return api;
    } catch(e) { console.warn('[Chain] Failed:', url, e.message); }
  }
  CHAIN.status = 'error'; emit('chain:status', 'error');
  throw new Error('All Konnex RPC endpoints unreachable');
}

// ── Send real extrinsic ───────────────────────────────────────────────────────
export async function sendExtrinsic(palletMethod, args, label='') {
  const api = CHAIN.api || await initChain();
  if (!WALLET.signer || WALLET.readOnly) throw new Error('Wallet not connected');
  const [pallet, method] = palletMethod.split('.');
  let tx;
  try {
    if (api.tx[pallet]?.[method]) {
      tx = api.tx[pallet][method](...Object.values(args));
    } else {
      // system.remark fallback — data lands onchain in block
      tx = api.tx.system.remark(JSON.stringify({ method: palletMethod, args, ts: Date.now() }));
      console.warn(`[Chain] ${palletMethod} not in runtime — using system.remark`);
    }
  } catch { tx = api.tx.system.remark(JSON.stringify({ method: palletMethod, args, ts: Date.now() })); }

  return new Promise((resolve, reject) => {
    let unsub;
    const timer = setTimeout(() => { unsub?.(); reject(new Error('Tx timeout 90s')); }, 90000);
    tx.signAndSend(WALLET.address, { signer: WALLET.signer }, ({ status, dispatchError, txHash }) => {
      if (dispatchError) {
        clearTimeout(timer); unsub?.();
        const msg = dispatchError.isModule
          ? api.registry.findMetaError(dispatchError.asModule).docs.join(' ')
          : dispatchError.toString();
        reject(new Error(msg)); return;
      }
      if (status.isInBlock || status.isFinalized) {
        clearTimeout(timer); unsub?.();
        resolve({ txHash: txHash.toString(), blockNumber: CHAIN.currentBlock, blockHash: status.isInBlock ? status.asInBlock.toString() : status.asFinalized.toString() });
      }
    }).then(u => { unsub = u; }).catch(reject);
  });
}

// ── Humanoid pallet calls ─────────────────────────────────────────────────────

export async function postHumanoidTask({ instruction, taskType, rewardKnx, robotId }) {
  const ts     = Date.now();
  const taskId = `HUM-${(ts>>>0).toString(16).toUpperCase().padStart(8,'0')}-${Math.random().toString(16).slice(2,8).toUpperCase()}`;
  const txResult = await sendExtrinsic(
    'axiom.postHumanoidTask',
    { task_id: taskId.slice(0,16), instruction: instruction.slice(0,256), task_type: taskType, reward_knx: Math.round(rewardKnx*1e6), robot_id: robotId||null, subnet_id: SUBNET_ID },
    `postHumanoidTask(${taskType})`
  );
  const task = {
    task_id: taskId, instruction, task_type: taskType, reward_knx: rewardKnx,
    robot_id: robotId||null, status: 'open', subnet_id: SUBNET_ID,
    created_at: new Date(ts).toISOString(), tx_hash: txResult.txHash, block_number: txResult.blockNumber,
  };
  await fbSaveTask(task);
  return task;
}

export async function commitHumanoidPoPW({ robotId, taskType, telemetryHash, timestamp }) {
  return sendExtrinsic(
    'axiom.commitHumanoidPoPW',
    { robot_id: robotId.slice(0,32), task_type: taskType, telemetry_hash: telemetryHash, timestamp, subnet_id: SUBNET_ID },
    `commitHumanoidPoPW(${taskType})`
  );
}

export async function writeHumanoidMemory({ taskId, robotId, taskType, telemetryHash, popwScore, cid, blockNumber }) {
  return sendExtrinsic(
    'axiom.writeHumanoidMemory',
    { task_id: taskId.slice(0,16), robot_id: robotId.slice(0,16), task_type: taskType, telemetry_hash: telemetryHash, popw_score: Math.round(popwScore), ipfs_cid: cid.slice(0,20), block_number: blockNumber, subnet_id: SUBNET_ID },
    `writeHumanoidMemory(score=${Math.round(popwScore)})`
  );
}
