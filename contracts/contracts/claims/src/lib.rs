#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String};

// ── Storage Keys ────────────────────────────────────────────────
#[contracttype]
pub enum DataKey {
    Admin,
    PoolContract,
    PayoutContract,
    ClaimCount,
    /// Individual claim: Claim(claim_id)
    Claim(u64),
    /// Claims by user: UserClaims(address) → list of claim IDs
    UserClaimCount(Address),
}

// ── Claim Status ────────────────────────────────────────────────
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum ClaimStatus {
    Submitted,
    UnderReview,
    ApprovedByGovernance,
    Rejected,
    PaidOut,
}

// ── Claim Record ────────────────────────────────────────────────
#[contracttype]
#[derive(Clone, Debug)]
pub struct Claim {
    pub id: u64,
    pub claimant: Address,
    pub amount: i128,
    pub description_hash: String,
    pub evidence_ipfs: String,
    pub evidence_cid: String,  // Parsed/structured CID for cleaner retrieval
    pub status: ClaimStatus,
    pub submitted_at: u64,
    pub updated_at: u64,
}

#[contract]
pub struct ClaimsContract;

#[contractimpl]
impl ClaimsContract {
    /// Initialize with admin, pool, and payout contract addresses.
    pub fn initialize(
        env: Env,
        admin: Address,
        pool_contract: Address,
        payout_contract: Address,
    ) {
        admin.require_auth();

        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::PoolContract, &pool_contract);
        env.storage().instance().set(&DataKey::PayoutContract, &payout_contract);
        env.storage().instance().set(&DataKey::ClaimCount, &0u64);
    }

    /// Submit a new insurance claim.
    pub fn submit_claim(
        env: Env,
        claimant: Address,
        amount: i128,
        description_hash: String,
        evidence_ipfs: String,
        evidence_cid: String,
    ) -> u64 {
        claimant.require_auth();
        assert!(amount > 0, "claim amount must be positive");

        let mut count: u64 = env
            .storage()
            .instance()
            .get(&DataKey::ClaimCount)
            .unwrap_or(0);

        let claim_id = count;
        let now = env.ledger().timestamp();

        let claim = Claim {
            id: claim_id,
            claimant: claimant.clone(),
            amount,
            description_hash,
            evidence_ipfs,
            evidence_cid,
            status: ClaimStatus::Submitted,
            submitted_at: now,
            updated_at: now,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Claim(claim_id), &claim);

        // Track user claim count
        let user_count: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::UserClaimCount(claimant.clone()))
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::UserClaimCount(claimant.clone()), &(user_count + 1));

        count += 1;
        env.storage().instance().set(&DataKey::ClaimCount, &count);

        // Emit event
        env.events().publish(
            ("claim", "submitted"),
            (claim_id, claimant, amount, now),
        );

        claim_id
    }

    /// Update claim status — called by governance contract after vote.
    pub fn update_status(env: Env, caller: Address, claim_id: u64, new_status: ClaimStatus) {
        caller.require_auth();

        // Only admin or authorized governance can update
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        assert!(caller == admin, "unauthorized");

        let mut claim: Claim = env
            .storage()
            .persistent()
            .get(&DataKey::Claim(claim_id))
            .expect("claim not found");

        let old_status = claim.status.clone();
        claim.status = new_status.clone();
        claim.updated_at = env.ledger().timestamp();

        env.storage()
            .persistent()
            .set(&DataKey::Claim(claim_id), &claim);

        // Emit event
        env.events().publish(
            ("claim", "status_updated"),
            (claim_id, old_status, new_status, env.ledger().timestamp()),
        );
    }

    /// Mark claim as paid out after payout engine executes.
    pub fn mark_paid(env: Env, caller: Address, claim_id: u64) {
        caller.require_auth();

        let payout_contract: Address = env
            .storage()
            .instance()
            .get(&DataKey::PayoutContract)
            .expect("not initialized");
        assert!(caller == payout_contract, "unauthorized: only payout contract");

        let mut claim: Claim = env
            .storage()
            .persistent()
            .get(&DataKey::Claim(claim_id))
            .expect("claim not found");

        claim.status = ClaimStatus::PaidOut;
        claim.updated_at = env.ledger().timestamp();

        env.storage()
            .persistent()
            .set(&DataKey::Claim(claim_id), &claim);

        // Emit event
        env.events().publish(
            ("claim", "paid_out"),
            (claim_id, claim.claimant.clone(), claim.amount, env.ledger().timestamp()),
        );
    }

    // ── View Functions ──────────────────────────────────────────

    pub fn get_claim(env: Env, claim_id: u64) -> Claim {
        env.storage()
            .persistent()
            .get(&DataKey::Claim(claim_id))
            .expect("claim not found")
    }

    pub fn claim_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::ClaimCount)
            .unwrap_or(0)
    }

    pub fn user_claim_count(env: Env, user: Address) -> u64 {
        env.storage()
            .persistent()
            .get(&DataKey::UserClaimCount(user))
            .unwrap_or(0)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::Env;

    #[test]
    fn test_submit_and_get_claim() {
        let env = Env::default();
        let contract_id = env.register(ClaimsContract, ());
        let client = ClaimsContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let pool = Address::generate(&env);
        let payout = Address::generate(&env);
        let claimant = Address::generate(&env);

        env.mock_all_auths();

        client.initialize(&admin, &pool, &payout);

        let desc = String::from_str(&env, "crop_failure_2025");
        let ipfs = String::from_str(&env, "QmSomeHash123");
        let cid = String::from_str(&env, "QmSomeHash123");

        let id = client.submit_claim(&claimant, &500_000_000i128, &desc, &ipfs, &cid);
        assert_eq!(id, 0);
        assert_eq!(client.claim_count(), 1);

        let claim = client.get_claim(&0);
        assert_eq!(claim.claimant, claimant);
        assert_eq!(claim.amount, 500_000_000i128);
        assert_eq!(claim.status, ClaimStatus::Submitted);
        assert_eq!(claim.evidence_cid, cid);
    }
}
