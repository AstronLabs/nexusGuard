# NexusGuard

**NexusGuard** is a decentralized peer-to-peer microinsurance platform designed for Nigeria's uninsured majority. It enables small groups of people (10–30 members) to form **cover pools** for specific everyday risks — like phone screen cracks, minor medical emergencies, and laptop theft and collectively protect each other through transparent, blockchain-enforced rules.

No insurance company. No middleman. Just people protecting people, powered by Stellar.

---

## The Problem

Most Nigerians don't have **insurance**. The formal insurance industry is:

- **Expensive** — premiums are unaffordable for the average student or young professional
- **Slow** — claims take weeks or months to process
- **Deeply distrusted** — opaque processes and denied claims have eroded confidence

Meanwhile, **everyday financial shocks are constant**:

| Risk Category     | Example                       |
| ----------------- | ----------------------------- |
| Phone Damage      | Cracked screen, water damage  |
| Medical Emergency | Hospital visit, prescriptions |
| Device Theft      | Stolen laptop, snatched phone |
| Minor Accidents   | Minor road accident repairs   |

---

## The Solution

NexusGuard takes the **age-old concept of community risk-sharing** and puts it on-chain with transparent, enforceable rules.

### How It Works

1. **Create a Pool** — A user creates a cover pool for a specific risk (e.g. "Phone Damage Cover") with defined parameters: max members (up to 30), fixed contribution amount, and category.

2. **Join & Contribute** — Members join the pool and pay the fixed USDC contribution.

3. **File a Claim** — When a covered event happens, a member submits a claim with evidence uploaded to IPFS. A 24-hour cooldown applies between claims.

4. **Peer Voting** — All pool members review the claim and vote: **approve** or **reject**. A 60% quorum is required for approval within the review window.

5. **Payout** — Approved claims trigger an automatic on-chain USDC payout to the claimant, capped at 50% of the pool balance.

### Key Design Principles

- **Transparency** — All contributions, claims, and votes are recorded on the Stellar blockchain
- **Trust Minimization** — Smart contracts enforce rules; no single admin can steal funds
- **Community Governance** — Pool members collectively decide on claims through quorum voting
- **Micro-Affordability** — Low fixed contributions make coverage accessible to students and gig workers
- **On-chain USDC** — Uses Stellar's native USDC (SAC) — no wrapped tokens or bridging

---

### Off-chain Services (Next.js API Routes)

IPFS evidence uploads are proxied through Next.js API routes to Pinata — no separate backend server required.

| Route | Purpose |
|---|---|
| `POST /api/ipfs/upload` | Upload claim evidence file to Pinata/IPFS |
| `POST /api/ipfs/upload-json` | Upload pool/claim metadata JSON to IPFS |

---

## Smart Contracts

Three Soroban contracts (Rust, SDK v22) — deployed on Stellar Testnet:

| Contract | Package | Description |
|---|---|---|
| **Factory** | `nexusguard-factory` | Deploys and tracks all pool instances via WASM hash |
| **Pool** | `nexusguard-pool` | Self-contained insurance pool: members, claims, voting, payouts |
| **Smart Account** | `poolsafe-smart-account` | Optional: recurring payments, spending limits, multisig |

### Deployed Addresses (Testnet)

| | Address |
|---|---|
| **Factory Contract** | `CB43V4IO5VSQTNBMFWJEMZTOBS7UN5S6LEOQQIV2AXMCSVX5APFLNQ5W` |
| **Pool WASM Hash** | `2be1d1c3fc9751a251cc6481904d697fe485d82b741ceabd9efc50cb5e2befa2` |
| **USDC Token (SAC)** | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |
| **Deployer/Admin** | `GALK2FN3QXLETSVMUEVWR4IE2FYEFEMWZR2QXU5EU6APVJVATFLS7HON` |

### Pool Contract — Key Rules

- Max 30 members per pool
- Claim cooldown: 24 hours per member
- Voting quorum: 60% approval required
- Max payout per claim: 50% of pool balance
- Roles: Creator, Manager, Member

### Pool Category Mapping

| Category | Value |
|---|---|
| Health | 0 |
| Crop | 1 |
| Property | 2 |
| Vehicle | 3 |
| Travel | 4 |
| Business | 5 |
| Other | 6 |

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | Next.js 14 (Pages Router, TypeScript) | UI with React hooks and TailwindCSS |
| **Wallet** | Freighter Wallet + `@stellar/freighter-api` v6 | Stellar wallet connection and tx signing |
| **IPFS** | Pinata REST API (via Next.js API routes) | Claim evidence file pinning |
| **Blockchain** | Stellar Testnet (Soroban) | Smart contract platform |
| **Contracts** | Rust (Soroban SDK v22) | 3 modular smart contracts |
| **SDK** | `@stellar/stellar-sdk` v15 | JavaScript SDK for Stellar/Soroban interaction |
| **Styling** | TailwindCSS + Material Symbols | UI styling and icons |

---

## Project Structure

```
nexusGuard/
├── README.md
├── .gitignore
│
├── frontend/                           # Next.js 14 application
│   ├── pages/                          # Next.js Pages Router
│   │   ├── index.tsx                   # Landing page (live stats from contracts)
│   │   ├── explore-pools.tsx           # Browse all pools from Factory
│   │   ├── pool-details.tsx            # Pool detail, members, claims
│   │   ├── create-pool.tsx             # Create new pool via Factory
│   │   ├── dashboard.tsx               # User's pools, claims, pending votes
│   │   ├── claim-voting.tsx            # Vote on pending claims
│   │   └── claims/
│   │       └── new.tsx                 # Submit a claim with IPFS evidence
│   ├── components/
│   │   ├── header.tsx                  # Shared nav with WalletButton
│   │   ├── footer.tsx                  # Shared footer
│   │   ├── wallet-button.tsx           # Freighter connect/disconnect
│   │   ├── button.tsx                  # Reusable Button component
│   │   └── FigmaPage.tsx               # Page wrapper with title
│   ├── context/
│   │   └── WalletContext.tsx           # Global wallet state (Freighter)
│   ├── hooks/
│   │   └── useFreighterWallet.ts       # Low-level Freighter hook
│   ├── lib/
│   │   └── contracts/
│   │       ├── index.ts                # Barrel exports
│   │       ├── types.ts                # PoolSummary, Claim, enums, POOL_CATEGORY_MAP
│   │       ├── config.ts               # Network config, CONTRACTS, conversion helpers
│   │       ├── soroban.ts              # Transaction build/simulate/submit helpers
│   │       ├── factory.ts              # Factory contract client
│   │       ├── pool.ts                 # Pool contract client
│   │       └── pinata.ts               # IPFS upload helpers (via API routes)
│   ├── pages/api/
│   │   ├── ipfs/
│   │   │   ├── upload.ts               # Proxy file uploads to Pinata
│   │   │   └── upload-json.ts          # Proxy JSON uploads to Pinata
│   ├── styles/
│   │   └── globals.css
│   ├── .env.local                      # Runtime env vars (gitignored)
│   ├── package.json
│   ├── tailwind.config.ts
│   └── next.config.js
│
└── contracts/                          # Soroban smart contracts (Rust)
    ├── Cargo.toml                      # Workspace manifest
    ├── .env                            # Deployer config (gitignored)
    ├── scripts/
    │   └── deploy-pool-testnet.sh      # Build + deploy Factory + Pool WASM
    └── contracts/
        ├── factory/                    # Factory contract
        │   ├── Cargo.toml
        │   └── src/lib.rs
        ├── pool/                       # Pool contract (self-contained)
        │   ├── Cargo.toml
        │   └── src/lib.rs
        └── smart_account/              # Smart account (optional automation)
            ├── Cargo.toml
            └── src/lib.rs
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 20.0.0
- **Rust** (latest stable) + `wasm32v1-none` target
- **Stellar CLI** — `cargo install stellar-cli`
- **Freighter Wallet** browser extension — [freighter.app](https://freighter.app)
- **Pinata account** — for IPFS uploads ([pinata.cloud](https://pinata.cloud))

---

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/nexusguard.git
cd nexusguard
```

---

### 2. Frontend Setup

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
# Factory contract (deployed on Stellar Testnet)
NEXT_PUBLIC_FACTORY_CONTRACT_ID=CB43V4IO5VSQTNBMFWJEMZTOBS7UN5S6LEOQQIV2AXMCSVX5APFLNQ5W

# USDC Token SAC (Stellar Testnet)
NEXT_PUBLIC_USDC_TOKEN_ID=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA

# Deployer/admin address
NEXT_PUBLIC_DEPLOYER_ADDRESS=GALK2FN3QXLETSVMUEVWR4IE2FYEFEMWZR2QXU5EU6APVJVATFLS7HON

# Pinata (for IPFS uploads — optional, claims work without it)
PINATA_API_KEY=your_pinata_api_key
PINATA_API_SECRET=your_pinata_api_secret
```

Run the dev server:

```bash
npm run dev
```

Frontend runs on `http://localhost:3000`

---

### 3. Contract Deployment (Soroban)

Contracts are already deployed on Stellar Testnet (see addresses above). To redeploy:

```bash
cd contracts
```

Create `contracts/.env`:

```env
STELLAR_SOURCE_ACCOUNT=nexusguard-deployer
FACTORY_ADMIN=<your_stellar_address>
POOL_TOKEN_ADDRESS=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA
```

Run the deploy script:

```bash
bash scripts/deploy-pool-testnet.sh
```

This will:
1. Generate and fund a testnet identity (if needed)
2. Build both contracts (`nexusguard-pool`, `nexusguard-factory`)
3. Upload Pool WASM → get hash
4. Deploy Factory → get contract ID
5. Initialize Factory with Pool WASM hash and USDC token
6. Auto-write all contract IDs back to `contracts/.env` and `frontend/.env.local`

---

### 4. Test Full Flow

1. Open `http://localhost:3000`
2. Connect Freighter wallet (set to **Stellar Testnet**)
3. **Explore Pools** → browse live pools from the Factory contract
4. **Create Pool** → deploys a new pool instance on-chain
5. **Pool Details** → join a pool, view members and claims
6. **Submit Claim** → upload evidence to IPFS, call `Pool.submit_claim`
7. **Claim Voting** → review evidence, vote approve/reject via `Pool.vote_on_claim`
8. **Dashboard** → view your pool memberships, filed claims, pending votes

---

## Environment Variables Reference

### `frontend/.env.local`

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_FACTORY_CONTRACT_ID` | Deployed Factory contract address |
| `NEXT_PUBLIC_USDC_TOKEN_ID` | USDC SAC contract address on testnet |
| `NEXT_PUBLIC_DEPLOYER_ADDRESS` | Admin/deployer Stellar address |
| `PINATA_API_KEY` | Pinata API key for IPFS uploads |
| `PINATA_API_SECRET` | Pinata secret key |

### `contracts/.env`

| Variable | Description |
|---|---|
| `STELLAR_SOURCE_ACCOUNT` | Stellar CLI identity name for signing |
| `FACTORY_ADMIN` | Admin address for the Factory contract |
| `POOL_TOKEN_ADDRESS` | USDC token contract address |
| `FACTORY_CONTRACT_ID` | Auto-filled after deployment |
| `POOL_WASM_HASH` | Auto-filled after deployment |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT
