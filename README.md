## Overview

**PoolSafe** is a decentralized peer-to-peer microinsurance platform designed for Nigeria's uninsured majority. It enables small groups of people (10–30 members) to form **cover pools** for specific everyday risks — like phone screen cracks, minor medical emergencies, and laptop theft — and collectively protect each other through transparent, blockchain-enforced rules.

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

PoolSafe takes the **age-old concept of community risk-sharing** and puts it on-chain with transparent, enforceable rules.

### How It Works

1. **Create a Pool** — A user creates a cover pool for a specific risk (e.g. "Phone Damage Cover") with defined parameters: max members, weekly contribution amount, maximum payout per claim, and voting quorum.

2. **Join & Contribute** — Members join the pool and make small weekly contributions.

3. **File a Claim** — When a covered event happens, a member submits a claim with evidence. The claim amount must be within the pool's maximum payout limit.

4. **Peer Voting** — All pool members review the claim and vote: **approve**, **reject**, or **abstain**. The claim must reach a configurable quorum (e.g. 60% approval) within a voting window.

5. **Payout or Rollover** — Approved claims trigger an automatic on-chain payout to the claimant. Unclaimed funds roll over to the next period or are **returned to members quarterly** as a dividend.

### Key Design Principles

- **Transparency** — All contributions, claims, and votes are recorded on the Stellar blockchain
- **Trust Minimization** — Smart contracts enforce rules; no single admin can steal funds
- **Community Governance** — Pool members collectively decide on claims through democratic voting
- **Micro-Affordability** — Low Contributions make coverage accessible to students and gig workers
- **Quarterly Returns** — Unclaimed funds aren't lost; they're returned to contributors proportionally

---

### Data Flow

1. **User** connects their Stellar wallet via the Next.js frontend
2. **Pool interactions** (create, join, contribute) are sent directly to Soroban smart contracts via the Stellar SDK
3. **Claims & voting** transactions are submitted on-chain for full transparency
4. **Next.js API routes** handle any off-chain needs (event indexing, notifications)
5. All **funds are held in smart contracts** — no custodial backend

---

## Backend Architecture (Node.js/Express)

The backend provides **off-chain services** that the frontend and smart contracts depend on:

### Purpose

- **x402 Payment Layer** — Anti-spam micropayment verification for claim submission and IPFS uploads
- **Claim Verification** — Cross-reference claim amounts against pool limits and IPFS evidence validation
- **Fraud Detection** — Rule-based risk scoring for flagging suspicious claims before governance voting
- **IPFS Integration** — Upload and pin claim evidence files (images, documents) via Pinata
- **In-App Notifications** — SQLite-based notification system for contribution reminders, claim status updates, and votes
- **Keeper Service** — Automated executor that polls smart contracts every 15 minutes to run due recurring payments and scheduled transfers

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                      │
└──────────────────────│──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              x402 Express Middleware                         │
│  (Payment gating: 0.01 USDC per claim, 0.005 USDC per upload)
└──────────────────────│──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   ┌────────────┐ ┌──────────┐ ┌──────────────┐
   │ Auth       │ │ Error    │ │ Logging      │
   │ Middleware │ │ Handler  │ │ Middleware   │
   └────────────┘ └──────────┘ └──────────────┘
        │              │
        ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Routes                               │
│  /api/health /api/claims /api/ipfs /api/notifications       │
│  /api/pools  /api/keeper                                    │
└──────────────────────│──────────────────────────────────────┘
                       │
        ┌──────────────┼────────────┬──────────────┐
        ▼              ▼            ▼              ▼
   ┌──────────────┐ ┌────────────┐ ┌───────────┐ ┌─────────┐
   │ Claim        │ │ Fraud      │ │ Keeper    │ │ IPFS    │
   │ Verification │ │ Detection  │ │ Service   │ │ Service │
   └──────────────┘ └────────────┘ └───────────┘ └─────────┘
        │              │              │            │
        └──────────────┼──────────────┼────────────┘
                       ▼
            ┌──────────────────────┐
            │  Soroban RPC Client  │
            │  (Contract Reads)    │
            └──────────────────────┘
                       │
                       ▼
            ┌──────────────────────┐
            │ Stellar Testnet      │
            │ (Soroban Contracts)  │
            └──────────────────────┘
```

### Core Services

| Service                    | Responsibility                                              |
| -------------------------- | ----------------------------------------------------------- |
| **Claim Verification**     | Validates claim amount, IPFS evidence, pool membership      |
| **Fraud Detection**        | Scores claims (0-100): velocity, amount anomaly, new member |
| **Keeper (15-min cycles)** | Executes due recurring payments and scheduled transfers     |
| **IPFS (Pinata)**          | Uploads/pins claim evidence; validates CIDs                 |
| **Notifications (SQLite)** | Stores in-app notifications; convenience methods for types  |
| **Soroban RPC**            | Queries contracts: pool state, claim data, payment schedule |

### Getting Started — Backend

#### Prerequisites

- **Node.js** ≥ 20.0.0
- **npm** ≥ 11.0.0
- **Stellar Testnet Keypair** — for x402 and keeper service signing

#### Environment Setup

1. Copy `.env.example` to `.env`:

   ```bash
   cd backend
   cp .env.example .env
   ```

2. Configure `.env` with your values:

   ```env
   # Server
   PORT=4000
   NODE_ENV=development

   # Stellar / Soroban
   STELLAR_NETWORK=testnet
   STELLAR_RPC_URL=https://soroban-testnet.stellar.org
   STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
   STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
   STELLAR_SECRET_KEY=S...your_testnet_secret_key
   STELLAR_PUBLIC_KEY=G...your_testnet_public_key

   # Contract Addresses (from deployments)
   CONTRACT_POOL=C...
   CONTRACT_CLAIMS=C...
   CONTRACT_VOTING=C...
   CONTRACT_GOVERNANCE=C...
   CONTRACT_TOKEN=C...
   CONTRACT_PAYOUT=C...
   CONTRACT_SMART_ACCOUNT=C...

   # x402
   X402_PAYMENT_ASSET=USDC
   X402_FACILITATOR_URL=https://x402.stellar.org/facilitator

   # Pinata IPFS
   PINATA_API_KEY=your_pinata_key
   PINATA_SECRET_KEY=your_pinata_secret

   # SQLite
   SQLITE_DB_PATH=./data/nexusguard.db
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

#### Running the Backend

**Development mode** (hot reload):

```bash
npm run dev
```

**Production build**:

```bash
npm run build
npm start
```

**Health check**:

```bash
curl http://localhost:4000/api/health
```

#### Key Endpoints

| Method | Route                          | Auth | x402 Fee  | Purpose                                 |
| ------ | ------------------------------ | ---- | --------- | --------------------------------------- |
| GET    | `/api/health`                  | —    | —         | Server health check                     |
| POST   | `/api/claims/submit`           | ✓    | 0.01 USD  | Submit new claim (anti-spam)            |
| GET    | `/api/claims/:id`              | —    | —         | Get claim details from on-chain         |
| GET    | `/api/claims/:id/verify`       | —    | 0.001 USD | Run verification report                 |
| GET    | `/api/claims/:id/fraud-report` | ✓    | —         | Get fraud score and flags               |
| POST   | `/api/ipfs/upload`             | ✓    | 0.005 USD | Upload claim evidence file              |
| POST   | `/api/ipfs/upload-json`        | ✓    | 0.005 USD | Upload claim data as JSON               |
| GET    | `/api/notifications`           | ✓    | —         | Get user notifications (limit, unread)  |
| PATCH  | `/api/notifications/:id/read`  | ✓    | —         | Mark notification as read               |
| GET    | `/api/pools/stats`             | —    | —         | Get pool statistics (deposits, members) |
| GET    | `/api/pools/member/:address`   | —    | —         | Check pool membership                   |
| GET    | `/api/pools/keeper/logs`       | —    | —         | Get keeper service execution logs       |

---

## Tech Stack

| Layer          | Technology                          | Purpose                                        |
| -------------- | ----------------------------------- | ---------------------------------------------- |
| **Frontend**   | Next.js 16 (App Router, TypeScript) | Server-rendered UI with React 19               |
| **Backend**    | Node.js + Express 5.1 (TypeScript)  | x402 gateway, claim verification, keeper       |
| **Wallet**     | Freighter Wallet                    | Stellar wallet connection and tx signing       |
| **State**      | Zustand                             | Lightweight client-side state management       |
| **IPFS**       | Pinata REST API                     | Claim evidence file pinning                    |
| **Database**   | SQLite (better-sqlite3)             | In-app notifications & keeper logs             |
| **Blockchain** | Stellar (Soroban)                   | Smart contract platform for on-chain logic     |
| **Contracts**  | Rust (Soroban SDK v22)              | Seven modular smart contracts                  |
| **SDK**        | @stellar/stellar-sdk v13            | JavaScript SDK for Stellar/Soroban interaction |

---

## Project Structure

```
PoolSafe/
├── README.md
├── .gitignore
│
├── frontend/                           # Next.js 16 application
│   ├── src/
│   │   ├── app/                        # Next.js App Router pages
│   │   ├── components/
│   │   │   ├── pools/                 # Pool management UI components
│   │   │   │   ├── PoolCard.tsx
│   │   │   │   ├── PoolList.tsx
│   │   │   │   ├── CreatePoolForm.tsx
│   │   │   │   ├── JoinPoolModal.tsx
│   │   │   │   └── PoolDetails.tsx
│   │   │   ├── claims/                # Claim submission & tracking
│   │   │   │   ├── ClaimForm.tsx
│   │   │   │   ├── ClaimCard.tsx
│   │   │   │   ├── ClaimList.tsx
│   │   │   │   └── ClaimTimeline.tsx
│   │   │   ├── voting/                # Peer voting interface
│   │   │   │   ├── VotingPanel.tsx
│   │   │   │   ├── VoteCard.tsx
│   │   │   │   └── VotingResults.tsx
│   │   │   ├── dashboard/             # User dashboard & analytics
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── StatsOverview.tsx
│   │   │   │   ├── ActivityFeed.tsx
│   │   │   │   └── PoolSummary.tsx
│   │   │   ├── layout/                # App shell components
│   │   │   │   ├── Navbar.tsx
│   │   │   │   ├── Footer.tsx
│   │   │   │   └── Sidebar.tsx
│   │   │   └── shared/                # Reusable UI primitives
│   │   │       ├── Button.tsx
│   │   │       ├── Modal.tsx
│   │   │       ├── Card.tsx
│   │   │       ├── Avatar.tsx
│   │   │       ├── Badge.tsx
│   │   │       └── Loader.tsx
│   │   ├── hooks/                      # Custom React hooks
│   │   │   ├── useWallet.ts           # Freighter wallet connection
│   │   │   ├── usePools.ts            # Pool CRUD operations
│   │   │   ├── useClaims.ts           # Claim management
│   │   │   ├── useVoting.ts           # Vote submission & results
│   │   │   ├── useSoroban.ts          # Generic Soroban contract calls
│   │   │   └── useSmartAccount.ts     # Smart account automation hook
│   │   ├── lib/                        # Core libraries
│   │   │   ├── stellar.ts             # Stellar SDK configuration
│   │   │   ├── soroban.ts             # Soroban client helpers
│   │   │   └── utils.ts               # General utilities
│   │   ├── services/                   # API client services
│   │   │   ├── api.ts                 # Base API client (fetch wrapper)
│   │   │   ├── pool.service.ts
│   │   │   ├── claim.service.ts
│   │   │   ├── vote.service.ts
│   │   │   └── smart-account.service.ts  # Smart account contract calls
│   │   ├── types/                      # Shared TypeScript types
│   │   │   ├── pool.types.ts
│   │   │   ├── claim.types.ts
│   │   │   ├── vote.types.ts
│   │   │   ├── user.types.ts
│   │   │   ├── smart-account.types.ts
│   │   │   └── index.ts
│   │   ├── context/                    # React context providers
│   │   │   ├── WalletContext.tsx
│   │   │   └── PoolContext.tsx
│   │   └── styles/                     # Global CSS
│   ├── public/
│   ├── package.json
│   ├── tsconfig.json
│   └── next.config.ts
│├── backend/                            # Node.js/Express API server
│   ├── src/
│   │   ├── index.ts                    # Express app entry point
│   │   ├── config/
│   │   │   └── index.ts                # Environment configuration
│   │   ├── middleware/
│   │   │   ├── x402.middleware.ts      # HTTP 402 payment-gating
│   │   │   ├── auth.middleware.ts      # Stellar address verification
│   │   │   └── error.middleware.ts     # Global error handler
│   │   ├── routes/
│   │   │   ├── health.routes.ts        # Health check endpoint
│   │   │   ├── claims.routes.ts        # Claim submission & verification
│   │   │   ├── ipfs.routes.ts          # IPFS file uploads (Pinata)
│   │   │   ├── notifications.routes.ts # In-app notifications CRUD
│   │   │   └── pools.routes.ts         # Pool statistics & keeper logs
│   │   ├── services/
│   │   │   ├── soroban.service.ts      # Soroban RPC client wrapper
│   │   │   ├── keeper.service.ts       # Recurring/scheduled payment executor
│   │   │   ├── claim-verification.service.ts  # Evidence & pool validation
│   │   │   ├── fraud-detection.service.ts     # Rule-based fraud scoring
│   │   │   ├── ipfs.service.ts         # Pinata integration
│   │   │   └── notification.service.ts # SQLite notification store
│   │   ├── types/
│   │   │   └── index.ts                # Backend-specific TypeScript types
│   │   └── utils/
│   │       ├── logger.ts               # Structured logging
│   │       └── stellar.ts              # Stellar SDK helpers
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   └── .gitignore
│└── contracts/                          # Soroban smart contracts (Rust)
    ├── Cargo.toml                      # Workspace manifest
    └── contracts/
        ├── pool/                       # Cover pool management
        │   ├── Cargo.toml
        │   └── src/lib.rs
        ├── claims/                     # Claim submission & payouts
        │   ├── Cargo.toml
        │   └── src/lib.rs
        ├── voting/                     # Peer voting engine
        │   ├── Cargo.toml
        │   └── src/lib.rs
        ├── governance/                 # Pool parameter governance
        │   ├── Cargo.toml
        │   └── src/lib.rs
        ├── token/                      # Contribution tracking token
        │   ├── Cargo.toml
        │   └── src/lib.rs
        ├── payout/                     # Automated payouts
        │   ├── Cargo.toml
        │   └── src/lib.rs
        └── smart_account/             # Smart account automation
            ├── Cargo.toml
            └── src/lib.rs
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 20.0.0
- **npm** ≥ 11.0.0
- **Rust** (latest stable) — for Soroban contract development
- **Stellar CLI** — `cargo install stellar-cli` (for contract building & deployment)
- **Stellar Testnet Keypair** — for x402 payment layer and keeper automation

### Quick Start

#### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/nexusguard.git
cd nexusguard
```

#### 2. Frontend Setup (Next.js)

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`

#### 3. Backend Setup (Node.js/Express)

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your Stellar keypair and contract addresses
npm run dev
```

Backend runs on `http://localhost:4000`

#### 4. Contract Deployment (Soroban)

```bash
cd contracts
cargo build --release
stellar contract deploy \
  --wasm ./target/wasm32-unknown-unknown/release/nexusguard_pool.wasm \
  --source-account GXXXXXX \
  --network testnet
# Repeat for each contract (claims, voting, governance, token, payout, smart_account)
```

Then update `backend/.env` with the deployed contract addresses.

#### 5. Test Full Flow

- Open `http://localhost:3000` in your browser
- Connect your Stellar testnet wallet (via Freighter)
- Create a pool → Join pool → Submit a claim → Vote on claims
- Backend keeper service will auto-execute recurring payments every 15 minutes
- Check notifications at `/api/notifications` after claims are processed

---

## Contributing

We welcome contributions! Please check [issues](issues) tab .

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT

---
