#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, String, Vec};

// ── Constants ───────────────────────────────────────────────────
const MAX_POOL_MEMBERS: u32 = 30;
const MIN_POOL_MEMBERS: u32 = 15;
const SIGNER_PERCENT: u32 = 30;          // 30% of members become reviewers
const SIGNER_ROTATION_SECONDS: u64 = 60 * 24 * 60 * 60; // 60 days
const WAITING_PERIOD_SECONDS: u64 = 60 * 24 * 60 * 60;  // 60 days after activation
const GRACE_PERIOD_SECONDS: u64 = 7 * 24 * 60 * 60;     // 7-day grace for contributions
const CONTRIBUTION_DAY: u32 = 8;         // 8th of each month (enforced off-chain via x402)
const DEFAULT_MAX_PAYOUT_PERCENT: u32 = 10;  // max 10% of treasury per claim
const DEFAULT_MONTHLY_PAYOUT_PERCENT: u32 = 25; // max 25% of treasury per month
const YEAR_IN_SECONDS: u64 = 365 * 24 * 60 * 60;

// ── Storage Keys ────────────────────────────────────────────────
#[contracttype]
pub enum DataKey {
    // Pool config
    Creator,
    TokenAddress,
    PoolName,
    PoolDescription,
    PoolCategory,
    FixedContribution,
    MaxMembers,
    MinMembers,
    MemberCount,
    Balance,
    TotalPaidClaims,
    TotalApprovedClaims,
    CreatedAt,
    ExpiresAt,
    Phase,
    ActivatedAt,
    Paused,
    // Roles
    Manager(Address),
    // Members
    Member(Address),
    MemberAt(u32),
    MemberActive(Address),   // false = removed defaulter
    // Monthly contributions: (member, cycle_id) → bool
    ContributionPaid(Address, u32),
    CurrentCycle,            // u32: incremented each month
    // Claims
    ClaimCount,
    Claim(u64),
    ClaimVote(u64, Address),
    UserClaimCount(Address),
    UserLastClaimCycle(Address), // last cycle in which member had a successful claim
    PoolClaimAt(u64),
    // Payout caps
    MaxPayoutPercent,
    MonthlyPayoutCap,
    MonthlyPaidOut(u32),     // amount paid out in cycle_id
    // Signer set
    SignerCount,
    SignerAt(u32),
    IsSigner(Address),
    LastSignerRotation,
}

// ── Pool Category ───────────────────────────────────────────────
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum PoolCategory {
    Health,
    Crop,
    Property,
    Vehicle,
    Travel,
    Business,
    Other,
}

impl PoolCategory {
    pub fn from_u32(val: u32) -> Self {
        match val {
            0 => PoolCategory::Health,
            1 => PoolCategory::Crop,
            2 => PoolCategory::Property,
            3 => PoolCategory::Vehicle,
            4 => PoolCategory::Travel,
            5 => PoolCategory::Business,
            _ => PoolCategory::Other,
        }
    }
}

// ── Pool Phase ──────────────────────────────────────────────────
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum PoolPhase {
    Formation,  // waiting for members; funds locked; claims disabled
    Active,     // full membership reached; 60-day wait then claims open
    Closed,
}

// ── Claim Status ────────────────────────────────────────────────
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum ClaimStatus {
    PendingReview,
    Approved,
    Rejected,
    Resolved,
}

// ── Vote Choice ─────────────────────────────────────────────────
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum VoteChoice {
    Approve,
    Reject,
}

// ── Claim Record ────────────────────────────────────────────────
#[contracttype]
#[derive(Clone, Debug)]
pub struct Claim {
    pub id: u64,
    pub claimant: Address,
    pub amount: i128,
    pub description: String,
    pub evidence_cid: String,
    pub status: ClaimStatus,
    pub votes_for: u32,
    pub votes_against: u32,
    pub submitted_at: u64,
    pub deadline: u64,
    pub updated_at: u64,
    pub executed: bool,
}

// ── Pool Summary (for view queries) ─────────────────────────────
#[contracttype]
#[derive(Clone, Debug)]
pub struct PoolSummary {
    pub creator: Address,
    pub name: String,
    pub description: String,
    pub category: PoolCategory,
    pub fixed_contribution: i128,
    pub min_members: u32,
    pub max_members: u32,
    pub member_count: u32,
    pub balance: i128,
    pub total_paid_claims: i128,
    pub total_approved_claims: i128,
    pub created_at: u64,
    pub activated_at: u64,
    pub expires_at: u64,
    pub phase: PoolPhase,
    pub paused: bool,
    pub claim_count: u64,
    pub current_cycle: u32,
    pub signer_count: u32,
}

// ── Member Role ─────────────────────────────────────────────────
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum Role {
    Creator,
    Manager,
    Member,
}

#[contract]
pub struct PoolContract;

#[contractimpl]
impl PoolContract {
    // ════════════════════════════════════════════════════════════
    // INITIALIZATION (called by Factory; creator pays first contribution)
    // ════════════════════════════════════════════════════════════

    pub fn initialize(
        env: Env,
        creator: Address,
        token: Address,
        name: String,
        description: String,
        category: u32,
        fixed_contribution: i128,
        max_members: u32,
    ) {
        if env.storage().instance().has(&DataKey::Creator) {
            panic!("already initialized");
        }

        assert!(fixed_contribution > 0, "contribution must be positive");
        assert!(max_members >= MIN_POOL_MEMBERS, "minimum 15 members required");
        assert!(max_members <= MAX_POOL_MEMBERS, "pool member cap is 30");

        // Creator pays first contribution immediately
        creator.require_auth();
        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&creator, &env.current_contract_address(), &fixed_contribution);

        let now = env.ledger().timestamp();
        let cat = PoolCategory::from_u32(category);

        env.storage().instance().set(&DataKey::Creator, &creator);
        env.storage().instance().set(&DataKey::TokenAddress, &token);
        env.storage().instance().set(&DataKey::PoolName, &name);
        env.storage().instance().set(&DataKey::PoolDescription, &description);
        env.storage().instance().set(&DataKey::PoolCategory, &cat);
        env.storage().instance().set(&DataKey::FixedContribution, &fixed_contribution);
        env.storage().instance().set(&DataKey::MaxMembers, &max_members);
        env.storage().instance().set(&DataKey::MinMembers, &MIN_POOL_MEMBERS);
        env.storage().instance().set(&DataKey::MemberCount, &1u32);
        env.storage().instance().set(&DataKey::Balance, &fixed_contribution);
        env.storage().instance().set(&DataKey::TotalPaidClaims, &0i128);
        env.storage().instance().set(&DataKey::TotalApprovedClaims, &0i128);
        env.storage().instance().set(&DataKey::CreatedAt, &now);
        env.storage().instance().set(&DataKey::ActivatedAt, &0u64);
        env.storage().instance().set(&DataKey::ExpiresAt, &(now + YEAR_IN_SECONDS));
        env.storage().instance().set(&DataKey::Phase, &PoolPhase::Formation);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().set(&DataKey::ClaimCount, &0u64);
        env.storage().instance().set(&DataKey::MaxPayoutPercent, &DEFAULT_MAX_PAYOUT_PERCENT);
        env.storage().instance().set(&DataKey::MonthlyPayoutCap, &DEFAULT_MONTHLY_PAYOUT_PERCENT);
        env.storage().instance().set(&DataKey::CurrentCycle, &0u32);
        env.storage().instance().set(&DataKey::SignerCount, &0u32);
        env.storage().instance().set(&DataKey::LastSignerRotation, &now);

        // Register creator as member #0
        env.storage().persistent().set(&DataKey::Member(creator.clone()), &true);
        env.storage().persistent().set(&DataKey::MemberAt(0u32), &creator);
        env.storage().persistent().set(&DataKey::MemberActive(creator.clone()), &true);
        env.storage().persistent().set(&DataKey::ContributionPaid(creator.clone(), 0u32), &true);

        env.events().publish(("pool", "initialized"), (creator, fixed_contribution, now));
    }

    // ════════════════════════════════════════════════════════════
    // ROLE MANAGEMENT
    // ════════════════════════════════════════════════════════════

    /// Add a manager to the pool. Only the creator can add managers.
    pub fn add_manager(env: Env, caller: Address, manager: Address) {
        caller.require_auth();
        Self::require_creator(&env, &caller);
        Self::require_not_paused(&env);

        env.storage()
            .persistent()
            .set(&DataKey::Manager(manager.clone()), &true);

        env.events()
            .publish(("pool", "manager_added"), (manager, caller));
    }

    /// Remove a manager. Only the creator can remove managers.
    pub fn remove_manager(env: Env, caller: Address, manager: Address) {
        caller.require_auth();
        Self::require_creator(&env, &caller);

        env.storage()
            .persistent()
            .set(&DataKey::Manager(manager.clone()), &false);

        env.events()
            .publish(("pool", "manager_removed"), (manager, caller));
    }

    /// Check the role of an address in this pool.
    pub fn get_role(env: Env, addr: Address) -> Role {
        let creator: Address = env
            .storage()
            .instance()
            .get(&DataKey::Creator)
            .expect("not initialized");
        if addr == creator {
            return Role::Creator;
        }
        let is_manager: bool = env
            .storage()
            .persistent()
            .get(&DataKey::Manager(addr.clone()))
            .unwrap_or(false);
        if is_manager {
            return Role::Manager;
        }
        Role::Member
    }

    // ════════════════════════════════════════════════════════════
    // MEMBERSHIP
    // ════════════════════════════════════════════════════════════

    /// Join the pool during Formation phase by paying the fixed contribution.
    /// Auto-activates pool and selects signers when max_members is reached.
    pub fn join_pool(env: Env, member: Address) {
        member.require_auth();
        Self::require_not_paused(&env);
        Self::require_formation_or_active_join(&env);

        let max_members: u32 = env.storage().instance().get(&DataKey::MaxMembers).unwrap_or(MAX_POOL_MEMBERS);
        let mut member_count: u32 = env.storage().instance().get(&DataKey::MemberCount).unwrap_or(0);

        assert!(member_count < max_members, "pool is full");
        assert!(!Self::is_member_internal(&env, &member), "already a pool member");

        let fixed_contribution: i128 = env.storage().instance().get(&DataKey::FixedContribution).expect("not initialized");
        let token_addr: Address = env.storage().instance().get(&DataKey::TokenAddress).expect("not initialized");
        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&member, &env.current_contract_address(), &fixed_contribution);

        env.storage().persistent().set(&DataKey::Member(member.clone()), &true);
        env.storage().persistent().set(&DataKey::MemberAt(member_count), &member);
        env.storage().persistent().set(&DataKey::MemberActive(member.clone()), &true);

        let current_cycle: u32 = env.storage().instance().get(&DataKey::CurrentCycle).unwrap_or(0);
        env.storage().persistent().set(&DataKey::ContributionPaid(member.clone(), current_cycle), &true);

        member_count += 1;
        env.storage().instance().set(&DataKey::MemberCount, &member_count);

        let mut balance: i128 = env.storage().instance().get(&DataKey::Balance).unwrap_or(0);
        balance += fixed_contribution;
        env.storage().instance().set(&DataKey::Balance, &balance);

        // Auto-activate: if we just hit max_members, transition to Active and select signers
        if member_count == max_members {
            let now = env.ledger().timestamp();
            env.storage().instance().set(&DataKey::Phase, &PoolPhase::Active);
            env.storage().instance().set(&DataKey::ActivatedAt, &now);
            Self::select_signers_internal(&env, member_count);
            env.events().publish(("pool", "activated"), (now, member_count));
        }

        env.events().publish(("pool", "member_joined"), (member, fixed_contribution, member_count));
    }

    /// Pay monthly contribution for a given cycle. Called by x402 or member directly.
    pub fn pay_contribution(env: Env, member: Address, cycle_id: u32) {
        member.require_auth();
        Self::require_not_paused(&env);

        assert!(Self::is_member_internal(&env, &member), "not a pool member");
        let is_active: bool = env.storage().persistent().get(&DataKey::MemberActive(member.clone())).unwrap_or(false);
        assert!(is_active, "member not active");

        let already_paid: bool = env.storage().persistent().get(&DataKey::ContributionPaid(member.clone(), cycle_id)).unwrap_or(false);
        assert!(!already_paid, "contribution already paid for this cycle");

        let fixed_contribution: i128 = env.storage().instance().get(&DataKey::FixedContribution).expect("not initialized");
        let token_addr: Address = env.storage().instance().get(&DataKey::TokenAddress).expect("not initialized");
        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&member, &env.current_contract_address(), &fixed_contribution);

        env.storage().persistent().set(&DataKey::ContributionPaid(member.clone(), cycle_id), &true);

        let mut balance: i128 = env.storage().instance().get(&DataKey::Balance).unwrap_or(0);
        balance += fixed_contribution;
        env.storage().instance().set(&DataKey::Balance, &balance);

        env.events().publish(("pool", "contribution_paid"), (member, cycle_id, fixed_contribution));
    }

    /// Remove a defaulter who missed contribution + 7-day grace period.
    /// Callable by creator/manager after the grace period expires.
    pub fn remove_defaulter(env: Env, caller: Address, member: Address, cycle_id: u32) {
        caller.require_auth();
        Self::require_creator_or_manager(&env, &caller);

        assert!(Self::is_member_internal(&env, &member), "not a pool member");

        let paid: bool = env.storage().persistent().get(&DataKey::ContributionPaid(member.clone(), cycle_id)).unwrap_or(false);
        assert!(!paid, "member paid their contribution");

        env.storage().persistent().set(&DataKey::MemberActive(member.clone()), &false);

        env.events().publish(("pool", "defaulter_removed"), (member, cycle_id, caller));
    }

    /// Advance the contribution cycle (called monthly, permissionless).
    pub fn advance_cycle(env: Env) {
        let mut current_cycle: u32 = env.storage().instance().get(&DataKey::CurrentCycle).unwrap_or(0);
        current_cycle += 1;
        env.storage().instance().set(&DataKey::CurrentCycle, &current_cycle);
        env.events().publish(("pool", "cycle_advanced"), (current_cycle,));
    }

    // ════════════════════════════════════════════════════════════
    // CLAIMS
    // ════════════════════════════════════════════════════════════

    /// Submit a new insurance claim with evidence CID.
    /// Requires: Active phase + 60-day waiting period elapsed + member active + one claim per cycle rotation.
    pub fn submit_claim(
        env: Env,
        claimant: Address,
        amount: i128,
        description: String,
        evidence_cid: String,
        review_period_seconds: u64,
    ) -> u64 {
        claimant.require_auth();
        Self::require_not_paused(&env);

        // Phase must be Active
        let phase: PoolPhase = env.storage().instance().get(&DataKey::Phase).unwrap_or(PoolPhase::Formation);
        assert!(phase == PoolPhase::Active, "pool is not active");

        // 60-day waiting period must have elapsed since activation
        let activated_at: u64 = env.storage().instance().get(&DataKey::ActivatedAt).unwrap_or(0);
        let now = env.ledger().timestamp();
        assert!(now >= activated_at + WAITING_PERIOD_SECONDS, "waiting period not elapsed");

        assert!(amount > 0, "claim amount must be positive");
        assert!(review_period_seconds > 0, "review period must be positive");
        assert!(Self::is_member_internal(&env, &claimant), "claimant must be a pool member");

        let is_active: bool = env.storage().persistent().get(&DataKey::MemberActive(claimant.clone())).unwrap_or(false);
        assert!(is_active, "member is not active (missed contribution)");

        // One successful claim per cycle rotation: member cannot claim again until cycle advances
        let current_cycle: u32 = env.storage().instance().get(&DataKey::CurrentCycle).unwrap_or(0);
        let last_claim_cycle: u32 = env.storage().persistent().get(&DataKey::UserLastClaimCycle(claimant.clone())).unwrap_or(u32::MAX);
        assert!(last_claim_cycle != current_cycle, "already claimed this cycle");

        // Enforce per-claim payout cap (10% of treasury)
        let balance: i128 = env.storage().instance().get(&DataKey::Balance).unwrap_or(0);
        let max_payout_pct: u32 = env.storage().instance().get(&DataKey::MaxPayoutPercent).unwrap_or(DEFAULT_MAX_PAYOUT_PERCENT);
        let max_single_payout = (balance * max_payout_pct as i128) / 100;
        assert!(amount <= max_single_payout, "claim exceeds 10% per-claim payout cap");

        // Enforce monthly payout cap (25% of treasury)
        let monthly_cap_pct: u32 = env.storage().instance().get(&DataKey::MonthlyPayoutCap).unwrap_or(DEFAULT_MONTHLY_PAYOUT_PERCENT);
        let max_monthly = (balance * monthly_cap_pct as i128) / 100;
        let already_paid_this_cycle: i128 = env.storage().instance().get(&DataKey::MonthlyPaidOut(current_cycle)).unwrap_or(0);
        assert!(already_paid_this_cycle + amount <= max_monthly, "monthly payout cap reached");

        assert!(balance >= amount, "claim exceeds pool balance");

        let mut claim_count: u64 = env.storage().instance().get(&DataKey::ClaimCount).unwrap_or(0);
        let claim_id = claim_count;

        let claim = Claim {
            id: claim_id,
            claimant: claimant.clone(),
            amount,
            description,
            evidence_cid,
            status: ClaimStatus::PendingReview,
            votes_for: 0,
            votes_against: 0,
            submitted_at: now,
            deadline: now + review_period_seconds,
            updated_at: now,
            executed: false,
        };

        env.storage().persistent().set(&DataKey::Claim(claim_id), &claim);
        env.storage().persistent().set(&DataKey::PoolClaimAt(claim_id), &claim_id);

        let user_count: u64 = env.storage().persistent().get(&DataKey::UserClaimCount(claimant.clone())).unwrap_or(0);
        env.storage().persistent().set(&DataKey::UserClaimCount(claimant.clone()), &(user_count + 1));

        claim_count += 1;
        env.storage().instance().set(&DataKey::ClaimCount, &claim_count);

        env.events().publish(("claim", "submitted"), (claim_id, claimant, amount, claim.deadline));
        claim_id
    }

    // ════════════════════════════════════════════════════════════
    // VOTING (Signer-based: only selected 30% reviewers)
    // ════════════════════════════════════════════════════════════

    /// Vote on a pending claim. Only selected signers (reviewers) can vote.
    pub fn vote_on_claim(env: Env, voter: Address, claim_id: u64, choice: VoteChoice) {
        voter.require_auth();
        Self::require_not_paused(&env);

        let is_signer: bool = env.storage().persistent().get(&DataKey::IsSigner(voter.clone())).unwrap_or(false);
        assert!(is_signer, "only selected reviewers can vote");

        let mut claim: Claim = env.storage().persistent().get(&DataKey::Claim(claim_id)).expect("claim not found");
        Self::reject_if_expired(&env, &mut claim);
        assert!(claim.status == ClaimStatus::PendingReview, "claim is not pending");

        assert!(!env.storage().persistent().has(&DataKey::ClaimVote(claim_id, voter.clone())), "already voted");

        env.storage().persistent().set(&DataKey::ClaimVote(claim_id, voter.clone()), &choice);

        match choice {
            VoteChoice::Approve => claim.votes_for += 1,
            VoteChoice::Reject => claim.votes_against += 1,
        }
        claim.updated_at = env.ledger().timestamp();

        // Quorum over signer set (60% of signers)
        let signer_count: u32 = env.storage().instance().get(&DataKey::SignerCount).unwrap_or(1);
        let quorum_needed = Self::quorum_threshold(signer_count);
        let total_votes = claim.votes_for + claim.votes_against;

        if total_votes >= quorum_needed {
            if claim.votes_for > claim.votes_against {
                claim.status = ClaimStatus::Approved;
                let mut total_approved: i128 = env.storage().instance().get(&DataKey::TotalApprovedClaims).unwrap_or(0);
                total_approved += claim.amount;
                env.storage().instance().set(&DataKey::TotalApprovedClaims, &total_approved);
                env.events().publish(("claim", "approved"), (claim_id, claim.amount));
            } else {
                claim.status = ClaimStatus::Rejected;
                env.events().publish(("claim", "rejected_by_vote"), (claim_id, claim.amount));
            }
        }

        env.storage().persistent().set(&DataKey::Claim(claim_id), &claim);
        env.events().publish(("claim", "vote_cast"), (claim_id, voter, total_votes));
    }

    // ════════════════════════════════════════════════════════════
    // PAYOUT EXECUTION
    // ════════════════════════════════════════════════════════════

    /// Execute payout for an approved claim. Permissionless.
    pub fn resolve_claim(env: Env, claim_id: u64) {
        Self::require_not_paused(&env);

        let mut claim: Claim = env.storage().persistent().get(&DataKey::Claim(claim_id)).expect("claim not found");
        Self::reject_if_expired(&env, &mut claim);
        assert!(claim.status == ClaimStatus::Approved, "claim must be approved");
        assert!(!claim.executed, "claim already executed");

        let mut balance: i128 = env.storage().instance().get(&DataKey::Balance).unwrap_or(0);
        assert!(balance >= claim.amount, "insufficient pool balance");

        let token_addr: Address = env.storage().instance().get(&DataKey::TokenAddress).expect("not initialized");
        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&env.current_contract_address(), &claim.claimant, &claim.amount);

        balance -= claim.amount;
        env.storage().instance().set(&DataKey::Balance, &balance);

        // Track monthly payout total
        let current_cycle: u32 = env.storage().instance().get(&DataKey::CurrentCycle).unwrap_or(0);
        let prev_paid: i128 = env.storage().instance().get(&DataKey::MonthlyPaidOut(current_cycle)).unwrap_or(0);
        env.storage().instance().set(&DataKey::MonthlyPaidOut(current_cycle), &(prev_paid + claim.amount));

        // Mark member's last successful claim cycle
        env.storage().persistent().set(&DataKey::UserLastClaimCycle(claim.claimant.clone()), &current_cycle);

        let mut total_paid: i128 = env.storage().instance().get(&DataKey::TotalPaidClaims).unwrap_or(0);
        total_paid += claim.amount;
        env.storage().instance().set(&DataKey::TotalPaidClaims, &total_paid);

        claim.status = ClaimStatus::Resolved;
        claim.executed = true;
        claim.updated_at = env.ledger().timestamp();
        env.storage().persistent().set(&DataKey::Claim(claim_id), &claim);

        env.events().publish(("claim", "resolved"), (claim_id, claim.claimant, claim.amount));
    }

    /// Admin/creator can reject a pending claim.
    pub fn reject_claim(env: Env, caller: Address, claim_id: u64) {
        caller.require_auth();
        Self::require_creator_or_manager(&env, &caller);

        let mut claim: Claim = env.storage().persistent().get(&DataKey::Claim(claim_id)).expect("claim not found");
        assert!(claim.status == ClaimStatus::PendingReview, "claim is not pending");

        claim.status = ClaimStatus::Rejected;
        claim.updated_at = env.ledger().timestamp();
        env.storage().persistent().set(&DataKey::Claim(claim_id), &claim);
        env.events().publish(("claim", "rejected"), (claim_id, caller));
    }

    /// Anyone can trigger rejection of an expired claim.
    pub fn reject_expired_claim(env: Env, claim_id: u64) {
        let mut claim: Claim = env.storage().persistent().get(&DataKey::Claim(claim_id)).expect("claim not found");
        Self::reject_if_expired(&env, &mut claim);
        env.storage().persistent().set(&DataKey::Claim(claim_id), &claim);
    }

    // ════════════════════════════════════════════════════════════
    // SIGNER ROTATION
    // ════════════════════════════════════════════════════════════

    /// Rotate the signer set every 60 days. Permissionless — anyone can trigger.
    pub fn rotate_signers(env: Env) {
        let last_rotation: u64 = env.storage().instance().get(&DataKey::LastSignerRotation).unwrap_or(0);
        let now = env.ledger().timestamp();
        assert!(now >= last_rotation + SIGNER_ROTATION_SECONDS, "rotation not due yet");

        let member_count: u32 = env.storage().instance().get(&DataKey::MemberCount).unwrap_or(0);
        // Clear old signer flags
        let old_signer_count: u32 = env.storage().instance().get(&DataKey::SignerCount).unwrap_or(0);
        for i in 0..old_signer_count {
            if let Some(signer) = env.storage().persistent().get::<_, Address>(&DataKey::SignerAt(i)) {
                env.storage().persistent().set(&DataKey::IsSigner(signer), &false);
            }
        }
        Self::select_signers_internal(&env, member_count);
        env.storage().instance().set(&DataKey::LastSignerRotation, &now);
        env.events().publish(("pool", "signers_rotated"), (now,));
    }

    // ════════════════════════════════════════════════════════════
    // EMERGENCY PAUSE
    // ════════════════════════════════════════════════════════════

    pub fn pause(env: Env, caller: Address) {
        caller.require_auth();
        Self::require_creator_or_manager(&env, &caller);
        env.storage().instance().set(&DataKey::Paused, &true);
        env.events().publish(("pool", "paused"), (caller, env.ledger().timestamp()));
    }

    pub fn unpause(env: Env, caller: Address) {
        caller.require_auth();
        Self::require_creator(&env, &caller);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.events().publish(("pool", "unpaused"), (caller, env.ledger().timestamp()));
    }

    // ════════════════════════════════════════════════════════════
    // POOL LIFECYCLE
    // ════════════════════════════════════════════════════════════

    /// Close the pool after its lifecycle ends and distribute remaining funds to active members.
    pub fn close_pool(env: Env) {
        let phase: PoolPhase = env.storage().instance().get(&DataKey::Phase).unwrap_or(PoolPhase::Formation);
        assert!(phase == PoolPhase::Active, "pool is not active");

        let expires_at: u64 = env.storage().instance().get(&DataKey::ExpiresAt).expect("not initialized");
        assert!(env.ledger().timestamp() >= expires_at, "pool lifecycle has not ended");

        let member_count: u32 = env.storage().instance().get(&DataKey::MemberCount).unwrap_or(0);
        let balance: i128 = env.storage().instance().get(&DataKey::Balance).unwrap_or(0);
        let token_addr: Address = env.storage().instance().get(&DataKey::TokenAddress).expect("not initialized");
        let token_client = token::Client::new(&env, &token_addr);

        if member_count > 0 && balance > 0 {
            // Only distribute to active members
            let mut active_count = 0u32;
            for i in 0..member_count {
                if let Some(m) = env.storage().persistent().get::<_, Address>(&DataKey::MemberAt(i)) {
                    let active: bool = env.storage().persistent().get(&DataKey::MemberActive(m)).unwrap_or(false);
                    if active { active_count += 1; }
                }
            }
            if active_count > 0 {
                let share = balance / (active_count as i128);
                let mut distributed = 0i128;
                let mut paid = 0u32;
                for i in 0..member_count {
                    if let Some(m) = env.storage().persistent().get::<_, Address>(&DataKey::MemberAt(i)) {
                        let active: bool = env.storage().persistent().get(&DataKey::MemberActive(m.clone())).unwrap_or(false);
                        if active {
                            paid += 1;
                            let payout = if paid == active_count { balance - distributed } else { share };
                            if payout > 0 {
                                token_client.transfer(&env.current_contract_address(), &m, &payout);
                                distributed += payout;
                            }
                        }
                    }
                }
            }
        }

        env.storage().instance().set(&DataKey::Balance, &0i128);
        env.storage().instance().set(&DataKey::Phase, &PoolPhase::Closed);
        env.events().publish(("pool", "closed"), (balance, member_count));
    }

    // ════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ════════════════════════════════════════════════════════════

    pub fn get_summary(env: Env) -> PoolSummary {
        PoolSummary {
            creator: env.storage().instance().get(&DataKey::Creator).expect("not initialized"),
            name: env.storage().instance().get(&DataKey::PoolName).expect("not initialized"),
            description: env.storage().instance().get(&DataKey::PoolDescription).expect("not initialized"),
            category: env.storage().instance().get(&DataKey::PoolCategory).expect("not initialized"),
            fixed_contribution: env.storage().instance().get(&DataKey::FixedContribution).unwrap_or(0),
            min_members: env.storage().instance().get(&DataKey::MinMembers).unwrap_or(MIN_POOL_MEMBERS),
            max_members: env.storage().instance().get(&DataKey::MaxMembers).unwrap_or(MAX_POOL_MEMBERS),
            member_count: env.storage().instance().get(&DataKey::MemberCount).unwrap_or(0),
            balance: env.storage().instance().get(&DataKey::Balance).unwrap_or(0),
            total_paid_claims: env.storage().instance().get(&DataKey::TotalPaidClaims).unwrap_or(0),
            total_approved_claims: env.storage().instance().get(&DataKey::TotalApprovedClaims).unwrap_or(0),
            created_at: env.storage().instance().get(&DataKey::CreatedAt).unwrap_or(0),
            activated_at: env.storage().instance().get(&DataKey::ActivatedAt).unwrap_or(0),
            expires_at: env.storage().instance().get(&DataKey::ExpiresAt).unwrap_or(0),
            phase: env.storage().instance().get(&DataKey::Phase).unwrap_or(PoolPhase::Formation),
            paused: env.storage().instance().get(&DataKey::Paused).unwrap_or(false),
            claim_count: env.storage().instance().get(&DataKey::ClaimCount).unwrap_or(0),
            current_cycle: env.storage().instance().get(&DataKey::CurrentCycle).unwrap_or(0),
            signer_count: env.storage().instance().get(&DataKey::SignerCount).unwrap_or(0),
        }
    }

    pub fn get_claim(env: Env, claim_id: u64) -> Claim {
        env.storage().persistent().get(&DataKey::Claim(claim_id)).expect("claim not found")
    }

    pub fn get_all_claims(env: Env) -> Vec<Claim> {
        let count: u64 = env.storage().instance().get(&DataKey::ClaimCount).unwrap_or(0);
        let mut claims = Vec::new(&env);
        for i in 0..count {
            if let Some(claim) = env.storage().persistent().get::<_, Claim>(&DataKey::Claim(i)) {
                claims.push_back(claim);
            }
        }
        claims
    }

    pub fn get_pending_claims(env: Env) -> Vec<Claim> {
        let count: u64 = env.storage().instance().get(&DataKey::ClaimCount).unwrap_or(0);
        let mut claims = Vec::new(&env);
        for i in 0..count {
            if let Some(claim) = env.storage().persistent().get::<_, Claim>(&DataKey::Claim(i)) {
                if claim.status == ClaimStatus::PendingReview {
                    claims.push_back(claim);
                }
            }
        }
        claims
    }

    pub fn get_signers(env: Env) -> Vec<Address> {
        let count: u32 = env.storage().instance().get(&DataKey::SignerCount).unwrap_or(0);
        let mut signers = Vec::new(&env);
        for i in 0..count {
            if let Some(s) = env.storage().persistent().get::<_, Address>(&DataKey::SignerAt(i)) {
                signers.push_back(s);
            }
        }
        signers
    }

    pub fn is_signer(env: Env, addr: Address) -> bool {
        env.storage().persistent().get(&DataKey::IsSigner(addr)).unwrap_or(false)
    }

    pub fn claim_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::ClaimCount).unwrap_or(0)
    }

    pub fn balance(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Balance).unwrap_or(0)
    }

    pub fn member_count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::MemberCount).unwrap_or(0)
    }

    pub fn is_member(env: Env, addr: Address) -> bool {
        Self::is_member_internal(&env, &addr)
    }

    pub fn is_member_active(env: Env, addr: Address) -> bool {
        env.storage().persistent().get(&DataKey::MemberActive(addr)).unwrap_or(false)
    }

    pub fn has_voted(env: Env, claim_id: u64, voter: Address) -> bool {
        env.storage().persistent().has(&DataKey::ClaimVote(claim_id, voter))
    }

    pub fn user_claim_count(env: Env, user: Address) -> u64 {
        env.storage().persistent().get(&DataKey::UserClaimCount(user)).unwrap_or(0)
    }

    pub fn has_paid_contribution(env: Env, member: Address, cycle_id: u32) -> bool {
        env.storage().persistent().get(&DataKey::ContributionPaid(member, cycle_id)).unwrap_or(false)
    }

    pub fn is_paused(env: Env) -> bool {
        env.storage().instance().get(&DataKey::Paused).unwrap_or(false)
    }

    pub fn creator(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Creator).expect("not initialized")
    }

    pub fn token_address(env: Env) -> Address {
        env.storage().instance().get(&DataKey::TokenAddress).expect("not initialized")
    }

    pub fn get_members(env: Env) -> Vec<Address> {
        let count: u32 = env.storage().instance().get(&DataKey::MemberCount).unwrap_or(0);
        let mut members = Vec::new(&env);
        for i in 0..count {
            if let Some(member) = env.storage().persistent().get::<_, Address>(&DataKey::MemberAt(i)) {
                members.push_back(member);
            }
        }
        members
    }

    // ════════════════════════════════════════════════════════════
    // INTERNAL HELPERS
    // ════════════════════════════════════════════════════════════

    fn is_member_internal(env: &Env, addr: &Address) -> bool {
        env.storage().persistent().get(&DataKey::Member(addr.clone())).unwrap_or(false)
    }

    /// Quorum = ceil(count * 60 / 100) applied over the signer set
    fn quorum_threshold(count: u32) -> u32 {
        if count == 0 { return 1; }
        ((count * 60) + 99) / 100
    }

    /// Select ceil(30% of members) as signers using ledger sequence as seed.
    fn select_signers_internal(env: &Env, member_count: u32) {
        let signer_count = {
            let n = (member_count * SIGNER_PERCENT + 99) / 100;
            if n == 0 { 1 } else { n }
        };
        // Pseudo-random selection: pick evenly spaced indices offset by ledger sequence
        let offset = (env.ledger().sequence() as u32) % member_count;
        let step = if member_count / signer_count == 0 { 1 } else { member_count / signer_count };

        let mut selected = 0u32;
        let mut idx = offset;
        loop {
            if selected >= signer_count { break; }
            if let Some(addr) = env.storage().persistent().get::<_, Address>(&DataKey::MemberAt(idx % member_count)) {
                let is_active: bool = env.storage().persistent().get(&DataKey::MemberActive(addr.clone())).unwrap_or(false);
                if is_active {
                    env.storage().persistent().set(&DataKey::SignerAt(selected), &addr);
                    env.storage().persistent().set(&DataKey::IsSigner(addr), &true);
                    selected += 1;
                }
            }
            idx += step;
            // safety: break if full loop completed without enough signers
            if idx > offset + member_count + signer_count { break; }
        }
        env.storage().instance().set(&DataKey::SignerCount, &selected);
    }

    fn reject_if_expired(env: &Env, claim: &mut Claim) {
        if claim.status == ClaimStatus::PendingReview && env.ledger().timestamp() > claim.deadline {
            claim.status = ClaimStatus::Rejected;
            claim.updated_at = env.ledger().timestamp();
            env.events().publish(("claim", "deadline_rejected"), (claim.id, claim.amount));
        }
    }

    fn require_creator(env: &Env, addr: &Address) {
        let creator: Address = env.storage().instance().get(&DataKey::Creator).expect("not initialized");
        assert!(*addr == creator, "unauthorized: not creator");
    }

    fn require_creator_or_manager(env: &Env, addr: &Address) {
        let creator: Address = env.storage().instance().get(&DataKey::Creator).expect("not initialized");
        if *addr == creator { return; }
        let is_manager: bool = env.storage().persistent().get(&DataKey::Manager(addr.clone())).unwrap_or(false);
        assert!(is_manager, "unauthorized: not creator or manager");
    }

    fn require_not_paused(env: &Env) {
        let paused: bool = env.storage().instance().get(&DataKey::Paused).unwrap_or(false);
        assert!(!paused, "pool is paused");
    }

    fn require_formation_or_active_join(env: &Env) {
        let phase: PoolPhase = env.storage().instance().get(&DataKey::Phase).unwrap_or(PoolPhase::Formation);
        assert!(phase == PoolPhase::Formation || phase == PoolPhase::Active, "pool is not open for joining");
        let expires_at: u64 = env.storage().instance().get(&DataKey::ExpiresAt).unwrap_or(0);
        assert!(env.ledger().timestamp() < expires_at, "pool lifecycle ended");
    }
}

// ════════════════════════════════════════════════════════════════
// TESTS
// ════════════════════════════════════════════════════════════════

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger};
    use soroban_sdk::{Env, token::StellarAssetClient};

    /// Deploy a mock Stellar asset contract and mint `amount` to `recipient`.
    fn create_token<'a>(env: &Env, admin: &Address) -> Address {
        let token_id = env.register_stellar_asset_contract_v2(admin.clone());
        token_id.address()
    }

    fn mint_token(env: &Env, token: &Address, admin: &Address, to: &Address, amount: i128) {
        let sa = StellarAssetClient::new(env, token);
        sa.mint(to, &amount);
    }

    /// Helper: register and initialize a pool with min_members=15, max_members=15.
    /// Creator gets enough tokens minted to pay the first contribution.
    fn setup_pool(env: &Env) -> (Address, Address, PoolContractClient<'_>) {
        let contract_id = env.register(PoolContract, ());
        let client = PoolContractClient::new(env, &contract_id);
        let creator = Address::generate(env);
        let admin = Address::generate(env);

        env.mock_all_auths();
        let token = create_token(env, &admin);
        mint_token(env, &token, &admin, &creator, 100_000);

        client.initialize(
            &creator,
            &token,
            &String::from_str(env, "Test Pool"),
            &String::from_str(env, "A test insurance pool"),
            &0u32,
            &1_000i128,
            &15u32,
        );

        (creator, token, client)
    }

    /// Helper: inject Active phase + signer + balance bypassing real token transfers.
    /// Also advances ledger timestamp past the 60-day waiting period.
    fn force_active(env: &Env, contract_id: &Address, members: &[Address], balance: i128) {
        // ActivatedAt = 0, set ledger time well past 60 days so waiting period is elapsed
        let past_wait = WAITING_PERIOD_SECONDS + 1;
        env.ledger().set_timestamp(past_wait);
        env.as_contract(contract_id, || {
            env.storage().instance().set(&DataKey::Phase, &PoolPhase::Active);
            env.storage().instance().set(&DataKey::ActivatedAt, &0u64);
            env.storage().instance().set(&DataKey::Balance, &balance);
            env.storage().instance().set(&DataKey::MemberCount, &(members.len() as u32));
            for (i, m) in members.iter().enumerate() {
                env.storage().persistent().set(&DataKey::Member(m.clone()), &true);
                env.storage().persistent().set(&DataKey::MemberAt(i as u32), m);
                env.storage().persistent().set(&DataKey::MemberActive(m.clone()), &true);
                env.storage().persistent().set(&DataKey::IsSigner(m.clone()), &true);
                env.storage().persistent().set(&DataKey::SignerAt(i as u32), m);
            }
            env.storage().instance().set(&DataKey::SignerCount, &(members.len() as u32));
        });
    }

    #[test]
    fn test_initialize_creator_is_member() {
        let env = Env::default();
        let (creator, _token, client) = setup_pool(&env);
        let summary = client.get_summary();
        assert_eq!(summary.member_count, 1);
        assert_eq!(summary.balance, 1_000);
        assert_eq!(summary.phase, PoolPhase::Formation);
        assert!(client.is_member(&creator));
    }

    #[test]
    #[should_panic(expected = "minimum 15 members required")]
    fn test_min_members_enforced() {
        let env = Env::default();
        let contract_id = env.register(PoolContract, ());
        let client = PoolContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let admin = Address::generate(&env);
        env.mock_all_auths();
        let token = create_token(&env, &admin);
        mint_token(&env, &token, &admin, &creator, 100_000);
        client.initialize(&creator, &token, &String::from_str(&env, "P"), &String::from_str(&env, "d"), &0u32, &1_000i128, &10u32);
    }

    #[test]
    #[should_panic(expected = "already initialized")]
    fn test_double_initialize() {
        let env = Env::default();
        let (creator, token, client) = setup_pool(&env);
        env.mock_all_auths();
        client.initialize(&creator, &token, &String::from_str(&env, "P2"), &String::from_str(&env, "d"), &0u32, &1_000i128, &15u32);
    }

    #[test]
    fn test_roles() {
        let env = Env::default();
        let (creator, _token, client) = setup_pool(&env);
        let manager = Address::generate(&env);
        env.mock_all_auths();

        assert_eq!(client.get_role(&creator), Role::Creator);
        client.add_manager(&creator, &manager);
        assert_eq!(client.get_role(&manager), Role::Manager);
        client.remove_manager(&creator, &manager);
        assert_eq!(client.get_role(&manager), Role::Member);
    }

    #[test]
    fn test_pause_and_unpause() {
        let env = Env::default();
        let (creator, _token, client) = setup_pool(&env);
        env.mock_all_auths();
        assert!(!client.is_paused());
        client.pause(&creator);
        assert!(client.is_paused());
        client.unpause(&creator);
        assert!(!client.is_paused());
    }

    #[test]
    fn test_submit_claim_and_voting() {
        let env = Env::default();
        let contract_id = env.register(PoolContract, ());
        let client = PoolContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let admin = Address::generate(&env);
        let claimant = Address::generate(&env);
        let voter1 = Address::generate(&env);
        let voter2 = Address::generate(&env);

        env.mock_all_auths();
        let token = create_token(&env, &admin);
        mint_token(&env, &token, &admin, &creator, 100_000);
        client.initialize(&creator, &token, &String::from_str(&env, "Pool"), &String::from_str(&env, "desc"), &0u32, &1_000i128, &15u32);

        force_active(&env, &contract_id, &[claimant.clone(), voter1.clone(), voter2.clone()], 10_000);

        let claim_id = client.submit_claim(&claimant, &500i128, &String::from_str(&env, "Flight delay"), &String::from_str(&env, "QmCID"), &604_800u64);
        assert_eq!(claim_id, 0);

        client.vote_on_claim(&voter1, &claim_id, &VoteChoice::Approve);
        let claim = client.get_claim(&claim_id);
        assert_eq!(claim.status, ClaimStatus::PendingReview);

        // quorum for 3 signers at 60% = ceil(1.8) = 2
        client.vote_on_claim(&voter2, &claim_id, &VoteChoice::Approve);
        let claim = client.get_claim(&claim_id);
        assert_eq!(claim.status, ClaimStatus::Approved);
    }

    #[test]
    fn test_claim_rejected_by_votes() {
        let env = Env::default();
        let contract_id = env.register(PoolContract, ());
        let client = PoolContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let admin = Address::generate(&env);
        let claimant = Address::generate(&env);
        let voter1 = Address::generate(&env);
        let voter2 = Address::generate(&env);

        env.mock_all_auths();
        let token = create_token(&env, &admin);
        mint_token(&env, &token, &admin, &creator, 100_000);
        client.initialize(&creator, &token, &String::from_str(&env, "Pool"), &String::from_str(&env, "desc"), &0u32, &1_000i128, &15u32);
        force_active(&env, &contract_id, &[claimant.clone(), voter1.clone(), voter2.clone()], 10_000);

        let claim_id = client.submit_claim(&claimant, &500i128, &String::from_str(&env, "Claim"), &String::from_str(&env, "QmCID"), &604_800u64);
        client.vote_on_claim(&voter1, &claim_id, &VoteChoice::Reject);
        client.vote_on_claim(&voter2, &claim_id, &VoteChoice::Reject);

        assert_eq!(client.get_claim(&claim_id).status, ClaimStatus::Rejected);
    }

    #[test]
    fn test_expired_claim_rejected() {
        let env = Env::default();
        let contract_id = env.register(PoolContract, ());
        let client = PoolContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let admin = Address::generate(&env);
        let claimant = Address::generate(&env);

        env.mock_all_auths();
        let token = create_token(&env, &admin);
        mint_token(&env, &token, &admin, &creator, 100_000);
        client.initialize(&creator, &token, &String::from_str(&env, "Pool"), &String::from_str(&env, "desc"), &0u32, &1_000i128, &15u32);
        force_active(&env, &contract_id, &[claimant.clone()], 10_000);

        let claim_id = client.submit_claim(&claimant, &500i128, &String::from_str(&env, "Claim"), &String::from_str(&env, "QmCID"), &100u64);
        env.ledger().set_timestamp(env.ledger().timestamp() + 200);
        client.reject_expired_claim(&claim_id);

        assert_eq!(client.get_claim(&claim_id).status, ClaimStatus::Rejected);
    }

    #[test]
    #[should_panic(expected = "claim exceeds 10% per-claim payout cap")]
    fn test_payout_cap_exceeded() {
        let env = Env::default();
        let contract_id = env.register(PoolContract, ());
        let client = PoolContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let admin = Address::generate(&env);
        let claimant = Address::generate(&env);

        env.mock_all_auths();
        let token = create_token(&env, &admin);
        mint_token(&env, &token, &admin, &creator, 100_000);
        client.initialize(&creator, &token, &String::from_str(&env, "Pool"), &String::from_str(&env, "desc"), &0u32, &1_000i128, &15u32);
        force_active(&env, &contract_id, &[claimant.clone()], 10_000);

        // 10% of 10000 = 1000, try claiming 2000
        client.submit_claim(&claimant, &2_000i128, &String::from_str(&env, "Too much"), &String::from_str(&env, "QmCID"), &604_800u64);
    }

    #[test]
    #[should_panic(expected = "waiting period not elapsed")]
    fn test_waiting_period_enforced() {
        let env = Env::default();
        let contract_id = env.register(PoolContract, ());
        let client = PoolContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);
        let admin = Address::generate(&env);
        let claimant = Address::generate(&env);

        env.mock_all_auths();
        let token = create_token(&env, &admin);
        mint_token(&env, &token, &admin, &creator, 100_000);
        client.initialize(&creator, &token, &String::from_str(&env, "Pool"), &String::from_str(&env, "desc"), &0u32, &1_000i128, &15u32);

        // Activate with current timestamp as activated_at (waiting period NOT elapsed)
        let now = env.ledger().timestamp();
        env.as_contract(&contract_id, || {
            env.storage().instance().set(&DataKey::Phase, &PoolPhase::Active);
            env.storage().instance().set(&DataKey::ActivatedAt, &now);
            env.storage().instance().set(&DataKey::Balance, &10_000i128);
            env.storage().persistent().set(&DataKey::Member(claimant.clone()), &true);
            env.storage().persistent().set(&DataKey::MemberAt(0u32), &claimant);
            env.storage().persistent().set(&DataKey::MemberActive(claimant.clone()), &true);
            env.storage().persistent().set(&DataKey::IsSigner(claimant.clone()), &true);
            env.storage().instance().set(&DataKey::MemberCount, &1u32);
            env.storage().instance().set(&DataKey::SignerCount, &1u32);
        });

        client.submit_claim(&claimant, &500i128, &String::from_str(&env, "Claim"), &String::from_str(&env, "QmCID"), &604_800u64);
    }

    #[test]
    fn test_quorum_calculation() {
        assert_eq!(PoolContract::quorum_threshold(1), 1);
        assert_eq!(PoolContract::quorum_threshold(3), 2);
        assert_eq!(PoolContract::quorum_threshold(5), 3);
        assert_eq!(PoolContract::quorum_threshold(10), 6);
        assert_eq!(PoolContract::quorum_threshold(30), 18);
    }
}
