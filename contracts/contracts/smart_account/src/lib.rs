#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, Vec};

// ── Storage Keys ────────────────────────────────────────────────
#[contracttype]
pub enum DataKey {
    Admin,
    PoolContract,
    TokenAddress,
    // Recurring payments
    RecurringPayment(u64),
    RecurringCount,
    // Spending limits
    SpendingLimit(Address, Address), // (owner, token)
    // Multisig
    MultisigSigners(Address),    // owner → signers list
    MultisigThreshold(Address),  // owner → threshold
    MultisigProposal(u64),
    MultisigProposalCount,
    MultisigApprovals(u64),      // proposal_id → approvals list
    // Scheduled transfers
    ScheduledTransfer(u64),
    ScheduledCount,
}

// ── Recurring Interval ──────────────────────────────────────────
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum RecurringInterval {
    Weekly,
    Monthly,
}

// ── Recurring Payment ───────────────────────────────────────────
#[contracttype]
#[derive(Clone, Debug)]
pub struct RecurringPayment {
    pub id: u64,
    pub owner: Address,
    pub recipient: Address,
    pub token: Address,
    pub amount: i128,
    pub interval: RecurringInterval,
    pub next_execution: u64,
    pub total_executed: u64,
    pub max_executions: u64,
    pub is_active: bool,
}

// ── Spending Limit ──────────────────────────────────────────────
#[contracttype]
#[derive(Clone, Debug)]
pub struct SpendingLimit {
    pub owner: Address,
    pub token: Address,
    pub max_amount: i128,
    pub period_seconds: u64,
    pub current_spent: i128,
    pub period_start: u64,
}

// ── Multisig Proposal ───────────────────────────────────────────
#[contracttype]
#[derive(Clone, Debug)]
pub struct MultisigProposal {
    pub id: u64,
    pub proposer: Address,
    pub recipient: Address,
    pub token: Address,
    pub amount: i128,
    pub executed: bool,
    pub created_at: u64,
    pub expires_at: u64,
}

// ── Scheduled Transfer ──────────────────────────────────────────
#[contracttype]
#[derive(Clone, Debug)]
pub struct ScheduledTransfer {
    pub id: u64,
    pub owner: Address,
    pub recipient: Address,
    pub token: Address,
    pub amount: i128,
    pub execute_after: u64,
    pub executed: bool,
}

#[contract]
pub struct SmartAccountContract;

#[contractimpl]
impl SmartAccountContract {
    // ── Initialize ──────────────────────────────────────────────
    pub fn initialize(env: Env, admin: Address, pool_contract: Address, token: Address) {
        admin.require_auth();
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::PoolContract, &pool_contract);
        env.storage().instance().set(&DataKey::TokenAddress, &token);
        env.storage().instance().set(&DataKey::RecurringCount, &0u64);
        env.storage().instance().set(&DataKey::MultisigProposalCount, &0u64);
        env.storage().instance().set(&DataKey::ScheduledCount, &0u64);
    }

    // ════════════════════════════════════════════════════════════
    // RECURRING PAYMENTS
    // ════════════════════════════════════════════════════════════

    pub fn create_recurring(
        env: Env,
        owner: Address,
        recipient: Address,
        token: Address,
        amount: i128,
        interval: RecurringInterval,
        max_executions: u64,
    ) -> u64 {
        owner.require_auth();
        assert!(amount > 0, "amount must be positive");

        let mut count: u64 = env.storage().instance()
            .get(&DataKey::RecurringCount).unwrap_or(0);
        let id = count;
        let now = env.ledger().timestamp();

        let interval_secs = match interval {
            RecurringInterval::Weekly => 604_800u64,
            RecurringInterval::Monthly => 2_592_000u64,
        };

        let payment = RecurringPayment {
            id,
            owner,
            recipient,
            token,
            amount,
            interval,
            next_execution: now + interval_secs,
            total_executed: 0,
            max_executions,
            is_active: true,
        };

        env.storage().persistent().set(&DataKey::RecurringPayment(id), &payment);
        count += 1;
        env.storage().instance().set(&DataKey::RecurringCount, &count);
        id
    }

    pub fn execute_recurring(env: Env, caller: Address, payment_id: u64) {
        caller.require_auth();

        let mut payment: RecurringPayment = env.storage().persistent()
            .get(&DataKey::RecurringPayment(payment_id))
            .expect("payment not found");

        assert!(payment.is_active, "payment not active");
        let now = env.ledger().timestamp();
        assert!(now >= payment.next_execution, "too early to execute");

        if payment.max_executions > 0 {
            assert!(payment.total_executed < payment.max_executions, "max executions reached");
        }

        // Transfer from owner to recipient using allowance
        let token_client = token::Client::new(&env, &payment.token);
        token_client.transfer_from(
            &env.current_contract_address(),
            &payment.owner,
            &payment.recipient,
            &payment.amount,
        );

        let interval_secs = match payment.interval {
            RecurringInterval::Weekly => 604_800u64,
            RecurringInterval::Monthly => 2_592_000u64,
        };

        payment.total_executed += 1;
        payment.next_execution = now + interval_secs;

        // Auto-deactivate if max reached
        if payment.max_executions > 0 && payment.total_executed >= payment.max_executions {
            payment.is_active = false;
        }

        env.storage().persistent().set(&DataKey::RecurringPayment(payment_id), &payment);

        // Emit event
        env.events().publish(
            ("recurring_exec", "executed"),
            (payment_id, payment.owner.clone(), payment.amount, now),
        );
    }

    pub fn cancel_recurring(env: Env, owner: Address, payment_id: u64) {
        owner.require_auth();

        let mut payment: RecurringPayment = env.storage().persistent()
            .get(&DataKey::RecurringPayment(payment_id))
            .expect("payment not found");

        assert!(payment.owner == owner, "unauthorized: not owner");
        payment.is_active = false;
        env.storage().persistent().set(&DataKey::RecurringPayment(payment_id), &payment);
    }

    pub fn get_recurring(env: Env, payment_id: u64) -> RecurringPayment {
        env.storage().persistent()
            .get(&DataKey::RecurringPayment(payment_id))
            .expect("payment not found")
    }

    pub fn recurring_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::RecurringCount).unwrap_or(0)
    }

    /// Get all recurring payments that are currently due for execution.
    pub fn get_due_payments(env: Env) -> Vec<u64> {
        let now = env.ledger().timestamp();
        let count: u64 = env.storage().instance()
            .get(&DataKey::RecurringCount).unwrap_or(0);
        let mut due: Vec<u64> = Vec::new(&env);

        for i in 0..count {
            if let Some(payment) = env.storage().persistent()
                .get::<_, RecurringPayment>(&DataKey::RecurringPayment(i)) {
                if payment.is_active && now >= payment.next_execution {
                    if payment.max_executions == 0 || payment.total_executed < payment.max_executions {
                        due.push_back(i);
                    }
                }
            }
        }
        due
    }

    /// Get all scheduled transfers that are currently due for execution.
    pub fn get_due_scheduled(env: Env) -> Vec<u64> {
        let now = env.ledger().timestamp();
        let count: u64 = env.storage().instance()
            .get(&DataKey::ScheduledCount).unwrap_or(0);
        let mut due: Vec<u64> = Vec::new(&env);

        for i in 0..count {
            if let Some(transfer) = env.storage().persistent()
                .get::<_, ScheduledTransfer>(&DataKey::ScheduledTransfer(i)) {
                if !transfer.executed && now >= transfer.execute_after {
                    due.push_back(i);
                }
            }
        }
        due
    }

    // ════════════════════════════════════════════════════════════
    // SPENDING LIMITS
    // ════════════════════════════════════════════════════════════

    pub fn set_spending_limit(
        env: Env,
        owner: Address,
        token: Address,
        max_amount: i128,
        period_seconds: u64,
    ) {
        owner.require_auth();
        assert!(max_amount > 0, "max_amount must be positive");
        assert!(period_seconds > 0, "period must be positive");

        let now = env.ledger().timestamp();
        let limit = SpendingLimit {
            owner: owner.clone(),
            token: token.clone(),
            max_amount,
            period_seconds,
            current_spent: 0,
            period_start: now,
        };

        env.storage().persistent()
            .set(&DataKey::SpendingLimit(owner, token), &limit);
    }

    pub fn check_spending(env: Env, owner: Address, token: Address, amount: i128) -> bool {
        let limit: SpendingLimit = match env.storage().persistent()
            .get(&DataKey::SpendingLimit(owner, token)) {
            Some(l) => l,
            None => return true, // no limit set
        };

        let now = env.ledger().timestamp();
        let current_spent = if now >= limit.period_start + limit.period_seconds {
            0i128 // period expired, reset
        } else {
            limit.current_spent
        };

        current_spent + amount <= limit.max_amount
    }

    pub fn record_spend(env: Env, caller: Address, owner: Address, token: Address, amount: i128) {
        caller.require_auth();
        // Only admin or the smart account itself can record spends
        let admin: Address = env.storage().instance()
            .get(&DataKey::Admin).expect("not initialized");
        assert!(caller == admin || caller == owner, "unauthorized");

        let mut limit: SpendingLimit = env.storage().persistent()
            .get(&DataKey::SpendingLimit(owner.clone(), token.clone()))
            .expect("no spending limit set");

        let now = env.ledger().timestamp();

        // Reset period if expired
        if now >= limit.period_start + limit.period_seconds {
            limit.current_spent = 0;
            limit.period_start = now;
        }

        assert!(
            limit.current_spent + amount <= limit.max_amount,
            "spending limit exceeded"
        );

        limit.current_spent += amount;
        env.storage().persistent()
            .set(&DataKey::SpendingLimit(owner.clone(), token.clone()), &limit);

        // Emit event
        env.events().publish(
            ("spending_limit", "updated"),
            (owner, token, limit.current_spent, limit.max_amount, env.ledger().timestamp()),
        );
    }

    pub fn get_spending_limit(env: Env, owner: Address, token: Address) -> SpendingLimit {
        env.storage().persistent()
            .get(&DataKey::SpendingLimit(owner, token))
            .expect("no spending limit set")
    }

    // ════════════════════════════════════════════════════════════
    // MULTISIG PROTECTION
    // ════════════════════════════════════════════════════════════

    pub fn setup_multisig(env: Env, owner: Address, signers: Vec<Address>, threshold: u32) {
        owner.require_auth();
        assert!(threshold > 0, "threshold must be > 0");
        assert!((threshold as u32) <= signers.len(), "threshold exceeds signer count");
        assert!(signers.len() <= 10, "max 10 signers");

        env.storage().persistent()
            .set(&DataKey::MultisigSigners(owner.clone()), &signers);
        env.storage().persistent()
            .set(&DataKey::MultisigThreshold(owner), &threshold);
    }

    pub fn propose_multisig_tx(
        env: Env,
        proposer: Address,
        recipient: Address,
        token: Address,
        amount: i128,
        ttl_secs: u64,
    ) -> u64 {
        proposer.require_auth();
        assert!(amount > 0, "amount must be positive");

        let mut count: u64 = env.storage().instance()
            .get(&DataKey::MultisigProposalCount).unwrap_or(0);
        let id = count;
        let now = env.ledger().timestamp();

        let proposal = MultisigProposal {
            id,
            proposer,
            recipient,
            token,
            amount,
            executed: false,
            created_at: now,
            expires_at: now + ttl_secs,
        };

        let approvals: Vec<Address> = Vec::new(&env);

        env.storage().persistent().set(&DataKey::MultisigProposal(id), &proposal);
        env.storage().persistent().set(&DataKey::MultisigApprovals(id), &approvals);
        count += 1;
        env.storage().instance().set(&DataKey::MultisigProposalCount, &count);
        id
    }

    pub fn approve_multisig_tx(env: Env, signer: Address, owner: Address, proposal_id: u64) {
        signer.require_auth();

        // Verify signer is in the owner's signer list
        let signers: Vec<Address> = env.storage().persistent()
            .get(&DataKey::MultisigSigners(owner.clone()))
            .expect("no multisig configured");

        let mut is_valid_signer = false;
        for i in 0..signers.len() {
            if signers.get(i).unwrap() == signer {
                is_valid_signer = true;
                break;
            }
        }
        assert!(is_valid_signer, "not a valid signer");

        let mut proposal: MultisigProposal = env.storage().persistent()
            .get(&DataKey::MultisigProposal(proposal_id))
            .expect("proposal not found");

        assert!(!proposal.executed, "already executed");
        let now = env.ledger().timestamp();
        assert!(now <= proposal.expires_at, "proposal expired");

        // Check not already approved by this signer
        let mut approvals: Vec<Address> = env.storage().persistent()
            .get(&DataKey::MultisigApprovals(proposal_id))
            .unwrap_or(Vec::new(&env));

        for i in 0..approvals.len() {
            assert!(approvals.get(i).unwrap() != signer, "already approved");
        }

        approvals.push_back(signer);

        let threshold: u32 = env.storage().persistent()
            .get(&DataKey::MultisigThreshold(owner))
            .expect("no threshold set");

        // Auto-execute if threshold met
        if approvals.len() >= threshold {
            let token_client = token::Client::new(&env, &proposal.token);
            token_client.transfer_from(
                &env.current_contract_address(),
                &proposal.proposer,
                &proposal.recipient,
                &proposal.amount,
            );
            proposal.executed = true;
            env.storage().persistent().set(&DataKey::MultisigProposal(proposal_id), &proposal);

            // Emit event
            env.events().publish(
                ("multisig_exec", "executed"),
                (proposal_id, proposal.proposer.clone(), proposal.amount, env.ledger().timestamp()),
            );
        }

        env.storage().persistent().set(&DataKey::MultisigApprovals(proposal_id), &approvals);
    }

    pub fn get_multisig_proposal(env: Env, proposal_id: u64) -> MultisigProposal {
        env.storage().persistent()
            .get(&DataKey::MultisigProposal(proposal_id))
            .expect("proposal not found")
    }

    pub fn get_multisig_approvals(env: Env, proposal_id: u64) -> Vec<Address> {
        env.storage().persistent()
            .get(&DataKey::MultisigApprovals(proposal_id))
            .unwrap_or(Vec::new(&env))
    }

    pub fn multisig_proposal_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::MultisigProposalCount).unwrap_or(0)
    }

    // ════════════════════════════════════════════════════════════
    // SCHEDULED TRANSFERS
    // ════════════════════════════════════════════════════════════

    pub fn schedule_transfer(
        env: Env,
        owner: Address,
        recipient: Address,
        token: Address,
        amount: i128,
        execute_after: u64,
    ) -> u64 {
        owner.require_auth();
        assert!(amount > 0, "amount must be positive");
        let now = env.ledger().timestamp();
        assert!(execute_after > now, "execute_after must be in the future");

        let mut count: u64 = env.storage().instance()
            .get(&DataKey::ScheduledCount).unwrap_or(0);
        let id = count;

        let transfer = ScheduledTransfer {
            id,
            owner,
            recipient,
            token,
            amount,
            execute_after,
            executed: false,
        };

        env.storage().persistent().set(&DataKey::ScheduledTransfer(id), &transfer);
        count += 1;
        env.storage().instance().set(&DataKey::ScheduledCount, &count);
        id
    }

    pub fn execute_scheduled(env: Env, caller: Address, transfer_id: u64) {
        caller.require_auth();

        let mut transfer: ScheduledTransfer = env.storage().persistent()
            .get(&DataKey::ScheduledTransfer(transfer_id))
            .expect("transfer not found");

        assert!(!transfer.executed, "already executed");
        let now = env.ledger().timestamp();
        assert!(now >= transfer.execute_after, "too early to execute");

        let token_client = token::Client::new(&env, &transfer.token);
        token_client.transfer_from(
            &env.current_contract_address(),
            &transfer.owner,
            &transfer.recipient,
            &transfer.amount,
        );

        transfer.executed = true;
        env.storage().persistent().set(&DataKey::ScheduledTransfer(transfer_id), &transfer);

        // Emit event
        env.events().publish(
            ("scheduled_exec", "executed"),
            (transfer_id, transfer.owner.clone(), transfer.amount, now),
        );
    }

    pub fn cancel_scheduled(env: Env, owner: Address, transfer_id: u64) {
        owner.require_auth();

        let mut transfer: ScheduledTransfer = env.storage().persistent()
            .get(&DataKey::ScheduledTransfer(transfer_id))
            .expect("transfer not found");

        assert!(transfer.owner == owner, "unauthorized: not owner");
        assert!(!transfer.executed, "already executed");

        transfer.executed = true; // mark as executed to prevent future execution
        env.storage().persistent().set(&DataKey::ScheduledTransfer(transfer_id), &transfer);
    }

    pub fn get_scheduled(env: Env, transfer_id: u64) -> ScheduledTransfer {
        env.storage().persistent()
            .get(&DataKey::ScheduledTransfer(transfer_id))
            .expect("transfer not found")
    }

    pub fn scheduled_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::ScheduledCount).unwrap_or(0)
    }
}

// ════════════════════════════════════════════════════════════════
// TESTS
// ════════════════════════════════════════════════════════════════

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::Env;

    #[test]
    fn test_initialize() {
        let env = Env::default();
        let contract_id = env.register(SmartAccountContract, ());
        let client = SmartAccountContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let pool = Address::generate(&env);
        let token = Address::generate(&env);

        env.mock_all_auths();
        client.initialize(&admin, &pool, &token);

        assert_eq!(client.recurring_count(), 0);
        assert_eq!(client.multisig_proposal_count(), 0);
        assert_eq!(client.scheduled_count(), 0);
    }

    #[test]
    fn test_create_and_cancel_recurring() {
        let env = Env::default();
        let contract_id = env.register(SmartAccountContract, ());
        let client = SmartAccountContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let pool = Address::generate(&env);
        let token = Address::generate(&env);
        let owner = Address::generate(&env);
        let recipient = Address::generate(&env);

        env.mock_all_auths();
        client.initialize(&admin, &pool, &token);

        let id = client.create_recurring(
            &owner,
            &recipient,
            &token,
            &1_000_000i128,
            &RecurringInterval::Weekly,
            &52u64,
        );

        assert_eq!(id, 0);
        assert_eq!(client.recurring_count(), 1);

        let payment = client.get_recurring(&0);
        assert_eq!(payment.owner, owner);
        assert_eq!(payment.amount, 1_000_000i128);
        assert!(payment.is_active);

        // Cancel
        client.cancel_recurring(&owner, &0);
        let cancelled = client.get_recurring(&0);
        assert!(!cancelled.is_active);
    }

    #[test]
    fn test_spending_limit() {
        let env = Env::default();
        let contract_id = env.register(SmartAccountContract, ());
        let client = SmartAccountContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let pool = Address::generate(&env);
        let token = Address::generate(&env);
        let owner = Address::generate(&env);

        env.mock_all_auths();
        client.initialize(&admin, &pool, &token);

        // Set daily limit of 10M stroops
        client.set_spending_limit(&owner, &token, &10_000_000i128, &86_400u64);

        // Check: 5M should be within limit
        assert!(client.check_spending(&owner, &token, &5_000_000i128));

        // Record 5M spend
        client.record_spend(&owner, &owner, &token, &5_000_000i128);

        // Check: another 5M should still be within limit
        assert!(client.check_spending(&owner, &token, &5_000_000i128));

        // Check: 6M more should exceed limit
        assert!(!client.check_spending(&owner, &token, &6_000_000i128));

        let limit = client.get_spending_limit(&owner, &token);
        assert_eq!(limit.current_spent, 5_000_000i128);
        assert_eq!(limit.max_amount, 10_000_000i128);
    }

    #[test]
    fn test_multisig_setup() {
        let env = Env::default();
        let contract_id = env.register(SmartAccountContract, ());
        let client = SmartAccountContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let pool = Address::generate(&env);
        let token = Address::generate(&env);
        let owner = Address::generate(&env);
        let signer1 = Address::generate(&env);
        let signer2 = Address::generate(&env);
        let signer3 = Address::generate(&env);

        env.mock_all_auths();
        client.initialize(&admin, &pool, &token);

        let mut signers = Vec::new(&env);
        signers.push_back(signer1);
        signers.push_back(signer2);
        signers.push_back(signer3);

        // 2-of-3 multisig
        client.setup_multisig(&owner, &signers, &2);

        let recipient = Address::generate(&env);
        let pid = client.propose_multisig_tx(
            &owner,
            &recipient,
            &token,
            &5_000_000i128,
            &604_800u64,
        );

        assert_eq!(pid, 0);
        assert_eq!(client.multisig_proposal_count(), 1);

        let proposal = client.get_multisig_proposal(&0);
        assert!(!proposal.executed);
        assert_eq!(proposal.amount, 5_000_000i128);
    }

    #[test]
    fn test_schedule_and_cancel_transfer() {
        let env = Env::default();
        let contract_id = env.register(SmartAccountContract, ());
        let client = SmartAccountContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let pool = Address::generate(&env);
        let token = Address::generate(&env);
        let owner = Address::generate(&env);
        let recipient = Address::generate(&env);

        env.mock_all_auths();
        client.initialize(&admin, &pool, &token);

        let now = env.ledger().timestamp();
        let future = now + 86_400; // +1 day

        let id = client.schedule_transfer(
            &owner,
            &recipient,
            &token,
            &2_000_000i128,
            &future,
        );

        assert_eq!(id, 0);
        assert_eq!(client.scheduled_count(), 1);

        let transfer = client.get_scheduled(&0);
        assert!(!transfer.executed);
        assert_eq!(transfer.amount, 2_000_000i128);

        // Cancel
        client.cancel_scheduled(&owner, &0);
        let cancelled = client.get_scheduled(&0);
        assert!(cancelled.executed); // marked executed to prevent future use
    }

    #[test]
    #[should_panic(expected = "spending limit exceeded")]
    fn test_spending_limit_exceeded() {
        let env = Env::default();
        let contract_id = env.register(SmartAccountContract, ());
        let client = SmartAccountContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let pool = Address::generate(&env);
        let token = Address::generate(&env);
        let owner = Address::generate(&env);

        env.mock_all_auths();
        client.initialize(&admin, &pool, &token);

        client.set_spending_limit(&owner, &token, &1_000_000i128, &86_400u64);
        client.record_spend(&owner, &owner, &token, &1_000_001i128);
    }
}
