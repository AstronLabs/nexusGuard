# NexusGuard Full-Stack Evolution — Task Tracker

## Phase 1 — Backend Foundation
- [ ] Scaffold backend project (package.json, tsconfig, .env.example, .gitignore)
- [ ] Config & environment setup (src/config/index.ts)
- [ ] Express app entry point with health route
- [ ] Utility modules (logger, stellar helpers)
- [ ] Soroban service wrapper

## Phase 2 — Core Services
- [ ] IPFS service (Pinata)
- [ ] Claim verification service
- [ ] Fraud detection engine (rule-based)
- [ ] Notification service (SQLite)

## Phase 3 — x402 Integration
- [ ] x402 middleware setup
- [ ] Auth middleware (Stellar wallet verification)
- [ ] Error handling middleware

## Phase 4 — Keeper & Automation
- [ ] Keeper service (Smart Account executor)
- [ ] Cron job scheduling

## Phase 5 — Contract Enhancements
- [ ] Smart Account: get_due_payments, get_due_scheduled, events
- [ ] Claims: events
- [ ] Pool: get_pool_info, events
- [ ] Payout: cross-contract call, events

## Phase 6 — API Routes
- [ ] Claims routes
- [ ] IPFS routes
- [ ] Notification routes
- [ ] Pool routes

## Phase 7 — Verification
- [ ] Contract compilation & tests (`cargo test`)
- [ ] Backend compilation (`npm run build`)
- [ ] Backend startup verification
- [ ] README update
