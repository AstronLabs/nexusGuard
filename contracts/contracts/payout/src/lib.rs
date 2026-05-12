#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

// ── Storage Keys ────────────────────────────────────────────────
#[contracttype]
pub enum DataKey {
    Admin,
    PoolContract,
    ClaimsContract,
    /// Payout record: PayoutRecord(claim_id)
    PayoutRecord(u64),
    PayoutCount,
}

// ── Payout Status ───────────────────────────────────────────────
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum PayoutStatus {
    Pending,
    Approved,
    Disbursed,
    Failed,
}

// ── Payout Record ───────────────────────────────────────────────
#[contracttype]
#[derive(Clone, Debug)]
pub struct PayoutRecord {
    pub claim_id: u64,
    pub recipient: Address,
    pub amount: i128,
    pub status: PayoutStatus,
    pub timestamp: u64,
}

#[contract]
pub struct PayoutEngineContract;

#[contractimpl]
impl PayoutEngineContract {
    /// Initialize with admin, pool contract, and claims contract addresses.
    pub fn initialize(
        env: Env,
        admin: Address,
        pool_contract: Address,
        claims_contract: Address,
    ) {
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::PoolContract, &pool_contract);
        env.storage().instance().set(&DataKey::ClaimsContract, &claims_contract);
        env.storage().instance().set(&DataKey::PayoutCount, &0u64);
    }

    /// Queue a payout for a given approved claim.
    /// Called by the claims contract after governance approval.
    pub fn queue_payout(
        env: Env,
        caller: Address,
        claim_id: u64,
        recipient: Address,
        amount: i128,
    ) {
        caller.require_auth();

        // Only claims contract can queue payouts
        let claims_contract: Address = env
            .storage()
            .instance()
            .get(&DataKey::ClaimsContract)
            .expect("not initialized");
        assert!(caller == claims_contract, "unauthorized: only claims contract");

        let mut count: u64 = env
            .storage()
            .instance()
            .get(&DataKey::PayoutCount)
            .unwrap_or(0);

        let record = PayoutRecord {
            claim_id,
            recipient,
            amount,
            status: PayoutStatus::Pending,
            timestamp: env.ledger().timestamp(),
        };

        env.storage()
            .persistent()
            .set(&DataKey::PayoutRecord(claim_id), &record);

        count += 1;
        env.storage().instance().set(&DataKey::PayoutCount, &count);

        // Emit event
        env.events().publish(
            ("payout", "queued"),
            (claim_id, record.recipient, record.amount, env.ledger().timestamp()),
        );
    }

    /// Execute a pending payout — marks as disbursed.
    /// Backend keeper service orchestrates actual fund transfer from pool to recipient.
    pub fn execute_payout(env: Env, admin: Address, claim_id: u64) {
        admin.require_auth();

        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        assert!(admin == stored_admin, "unauthorized");

        let mut record: PayoutRecord = env
            .storage()
            .persistent()
            .get(&DataKey::PayoutRecord(claim_id))
            .expect("payout not found");

        assert!(
            record.status == PayoutStatus::Pending,
            "payout not in pending state"
        );

        record.status = PayoutStatus::Disbursed;
        record.timestamp = env.ledger().timestamp();

        env.storage()
            .persistent()
            .set(&DataKey::PayoutRecord(claim_id), &record);

        // Emit event for backend indexing and fund transfer orchestration
        env.events().publish(
            ("payout", "disbursed"),
            (claim_id, record.recipient, record.amount, env.ledger().timestamp()),
        );
    }

    /// Read a payout record.
    pub fn get_payout(env: Env, claim_id: u64) -> PayoutRecord {
        env.storage()
            .persistent()
            .get(&DataKey::PayoutRecord(claim_id))
            .expect("payout not found")
    }

    /// Get total payout count.
    pub fn payout_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::PayoutCount)
            .unwrap_or(0)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::Env;

    #[test]
    fn test_initialize() {
        let env = Env::default();
        let contract_id = env.register(PayoutEngineContract, ());
        let client = PayoutEngineContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let pool = Address::generate(&env);
        let claims = Address::generate(&env);

        env.mock_all_auths();
        client.initialize(&admin, &pool, &claims);

        assert_eq!(client.payout_count(), 0);
    }
}
