# AXIOM Humanoid Control Subnet
## Konnex Builder Program — Humanoid Robot Control Category

> Live working infrastructure — real Konnex testnet transactions, real PoPW, real block records.

---

## Architecture

```
AXIOM-HUMANOID/
├── frontend/                  Next.js — live control dashboard (Vercel)
│   ├── app/
│   │   ├── page.js            Landing page + stats
│   │   └── control/page.js   Main control panel (wallet + execute + PoPW)
│   └── lib/
│       ├── chain.js           Konnex chain + Firebase integration
│       └── robot.js           Telemetry simulation + VLA models
├── miner/
│   └── miner.py               Python miner — polls tasks, submits PoPW
├── validator/
│   └── validator.py           Python validator — scores submissions
├── substrate/
│   └── pallets/humanoid/      Rust pallet (deploy to Konnex chain)
├── docker-compose.yml         Run all services at once
└── .env.example               Environment variables template
```

---

## Quick Deploy

### Option A — Vercel (Frontend only, easiest)

```bash
# 1. Push AXIOM-HUMANOID/ to GitHub
# 2. Import repo in vercel.com
# 3. Vercel auto-detects Next.js from frontend/
# 4. Done — wallet signs txs in browser, no server needed
```

### Option B — Full Stack (Docker)

```bash
# 1. Clone / extract AXIOM-HUMANOID/
cp .env.example .env
# Edit .env — add your KNX_MNEMONIC

# 2. Run everything
docker-compose up -d

# Frontend: http://localhost:3000
# Miner:    running in background, polling for tasks
# Validator: running in background, scoring submissions
```

### Option C — Railway.app (Free, no Docker needed)

```
Frontend:
  New Project → GitHub repo → root: frontend/ → deploy

Miner:
  New Project → GitHub repo → root: miner/ → deploy
  Add env: KNX_MNEMONIC, KNX_RPC

Validator:
  New Project → GitHub repo → root: validator/ → deploy
  Add env: KNX_VALIDATOR_MNEMONIC, KNX_RPC
```

---

## PoPW Protocol

```
1. User selects VLA model (OpenVLA / π₀ / π₀.₅ / OFT) + task preset
2. Connect SubWallet / Talisman wallet
3. Click EXECUTE + PoPW

   VLA INFER      Language + vision → joint policy
        ↓
   JOINT EXEC     16-DOF control loop @ 30–50Hz
        ↓
   TEL HASH       SHA3-256(telemetry + robotId + ts) → 32-byte hash
        ↓
   COMMIT         axiom.commitHumanoidPoPW() → Konnex block N
        ↓         (hash anchored BEFORE revealing telemetry — no backdating)
   VALIDATE       5-of-N lazy validators score non-overlapping sections
                  ≥70% agree → PASS | <70% → challenge round (+3 validators)
        ↓
   IPFS           Full 16-DOF joint trace → IPFS (private, content-addressed)
        ↓
   SETTLE         axiom.writeHumanoidMemory() → 96 bytes onchain forever
                  task_id + hash + score + cid + block_number
```

---

## Onchain Record (96 bytes)

| Field          | Size | Value                          |
|----------------|------|--------------------------------|
| task_id        | 16B  | Unique task identifier         |
| telemetry_hash | 32B  | SHA3-256 of full joint stream  |
| popw_score     | 1B   | 0–100 consensus score          |
| block_number   | 4B   | Konnex block at settlement     |
| ipfs_cid       | 20B  | Pointer to private telemetry   |
| subnet_id      | 4B   | 4 (Humanoid Control)           |

**What NEVER goes onchain:** Raw joint traces, camera frames, VLA policy weights, environment maps, proprietary motion plans — all stay on IPFS, referenced only by CID.

---

## Scoring Weights

| Metric          | Weight | Source                           |
|-----------------|--------|----------------------------------|
| completion_pct  | 40%    | Task goal achievement            |
| safety_score    | 35%    | Collision/boundary violations    |
| efficiency      | 25%    | elapsed_s / timeout_s ratio      |

---

## VLA Models

| Model       | HF ID                              | Hz  | Best For            |
|-------------|-------------------------------------|-----|---------------------|
| OpenVLA     | openvla/openvla-7b                  | 30  | General manipulation|
| π₀          | lerobot/pi0                         | 50  | Fine-motor tasks    |
| π₀.₅        | lerobot/pi05_libero_finetuned       | 50  | Language-conditioned|
| OFT         | openvla/openvla-7b-oft              | 30  | Bimanual assembly   |

---

## Task Types

| Task                | Primary Joints                              | Difficulty | Timeout |
|---------------------|----------------------------------------------|------------|---------|
| Pick & Place        | r_shoulder, r_elbow, r_wrist, r_grip         | MEDIUM     | 30s     |
| Bimanual Assembly   | both arms (8 joints)                         | HARD       | 60s     |
| Loco-Navigation     | hips, knees, spine                           | MEDIUM     | 45s     |
| Object Handover     | r_arm + head                                 | HARD       | 25s     |
| Visual Inspection   | head + spine_yaw                             | EASY       | 35s     |
| Whole-Body Reach    | spine + left arm                             | HARD       | 40s     |

---

## Substrate Pallet

The `substrate/pallets/humanoid/` directory contains a real Substrate pallet with these extrinsics:

| Extrinsic                          | Purpose                        |
|------------------------------------|--------------------------------|
| `post_humanoid_task`               | Post open task onchain         |
| `commit_humanoid_po_pw`            | Phase 1: anchor hash           |
| `write_humanoid_memory`            | Phase 3: settle 96-byte record |
| `submit_humanoid_validation_score` | Validator scoring              |
| `report_invalid_humanoid_popw`     | Fraud reporting                |

Until the pallet is deployed on Konnex mainnet, all calls fall back to `system.remark` — data still lands onchain in the block and is verifiable in the explorer.

---

## ZK Roadmap

| Phase | Status | Detail                                  |
|-------|--------|-----------------------------------------|
| P1    | ✅ Live | Hash-commit + lazy validator consensus  |
| P2    | Q3 2025| Groth16 SNARK for completion predicate  |
| P3    | Q4 2025| Safety + efficiency ZK predicates       |
| P4    | Q2 2026| Full ZK-PoPW, no validators, ~200k gas  |

---

## Links

- Explorer: https://subnets.testnet.konnex.world
- Faucet: https://subnets.testnet.konnex.world (get testKNX)
- Konnex docs: https://docs.konnex.world
