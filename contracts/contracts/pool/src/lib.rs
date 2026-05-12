#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env};

// ── Storage Keys ────────────────────────────────────────────────
#[contracttype]
pub enum DataKey {
    Admin,
    TokenAddress,
    TotalDeposits,
    MemberCount,
    /// Per-member contribution balance
    MemberBalance(Address),
    /// Whether an address is a registered member
    IsMember(Address),
    /// Authorized contracts that can disburse (claims, payout engine)
    AuthorizedContract(Address),
}

// ── Pool Configuration ──────────────────────────────────────────
#[contracttype]
#[derive(Clone, Debug)]
pub struct PoolConfig {
    pub admin: Address,
    pub token: Address,
    pub min_contribution: i128,
    pub max_pool_size: i128,
}

// ── Pool Info (view function return) ────────────────────────────
#[contracttype]
#[derive(Clone, Debug)]
pub struct PoolInfo {
    pub total_deposits: i128,
    pub member_count: u64,
    pub token_address: Address,
}

#[contract]
pub struct PoolTreasuryContract;

#[contractimpl]
impl PoolTreasuryContract {
    /// Initialize the insurance pool with admin and stablecoin token address.
    pub fn initialize(env: Env, admin: Address, token: Address, min_contribution: i128) {
        admin.require_auth();

        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TokenAddress, &token);
        env.storage().instance().set(&DataKey::TotalDeposits, &0i128);
        env.storage().instance().set(&DataKey::MemberCount, &0u64);

        // Store min contribution in instance storage
        env.storage().instance().set(
            &DataKey::MemberBalance(admin.clone()),
            &min_contribution,
        );
    }

    /// Authorize a contract (claims/payout) to call disburse.
    pub fn authorize_contract(env: Env, admin: Address, contract_addr: Address) {
        admin.require_auth();
        Self::require_admin(&env, &admin);

        env.storage()
            .instance()
            .set(&DataKey::AuthorizedContract(contract_addr), &true);
    }

    /// Contribute stablecoins to the shared insurance pool.
    pub fn contribute(env: Env, member: Address, amount: i128) {
        member.require_auth();
        assert!(amount > 0, "amount must be positive");

        let token_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::TokenAddress)
            .expect("not initialized");

        // Transfer tokens from member to this contract
        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&member, &env.current_contract_address(), &amount);

        // Update member balance
        let current: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::MemberBalance(member.clone()))
            .unwrap_or(0);

        let is_new = current == 0;
        env.storage()
            .persistent()
            .set(&DataKey::MemberBalance(member.clone()), &(current + amount));

        // Track membership
        if is_new {
            env.storage()
                .persistent()
                .set(&DataKey::IsMember(member.clone()), &true);

            let count: u64 = env
                .storage()
                .instance()
                .get(&DataKey::MemberCount)
                .unwrap_or(0);
            env.storage().instance().set(&DataKey::MemberCount, &(count + 1));
        }

        // Update total
        let total: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalDeposits)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalDeposits, &(total + amount));

        // Emit event
        env.events().publish(
            ("pool", "contribution"),
            (member, amount, total + amount, env.ledger().timestamp()),
        );
    }

    /// Disburse funds to a recipient. Only callable by authorized contracts.
    pub fn disburse(env: Env, caller: Address, recipient: Address, amount: i128) {
        caller.require_auth();

        let is_authorized: bool = env
            .storage()
            .instance()
            .get(&DataKey::AuthorizedContract(caller))
            .unwrap_or(false);
        assert!(is_authorized, "unauthorized: caller not an authorized contract");

        assert!(amount > 0, "amount must be positive");

        let total: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalDeposits)
            .unwrap_or(0);
        assert!(total >= amount, "insufficient pool funds");

        let token_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::TokenAddress)
            .expect("not initialized");

        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&env.current_contract_address(), &recipient, &amount);

        env.storage()
            .instance()
            .set(&DataKey::TotalDeposits, &(total - amount));

        // Emit event
        env.events().publish(
            ("pool", "disbursement"),
            (recipient, amount, total - amount, env.ledger().timestamp()),
        );
    }

    // ── View Functions ──────────────────────────────────────────

    pub fn total_deposits(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalDeposits)
            .unwrap_or(0)
    }

    pub fn member_balance(env: Env, member: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::MemberBalance(member))
            .unwrap_or(0)
    }

    pub fn member_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::MemberCount)
            .unwrap_or(0)
    }

    pub fn is_member(env: Env, addr: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::IsMember(addr))
            .unwrap_or(false)
    }

    pub fn get_pool_info(env: Env) -> PoolInfo {
        let total_deposits: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalDeposits)
            .unwrap_or(0);

        let member_count: u64 = env
            .storage()
            .instance()
            .get(&DataKey::MemberCount)
            .unwrap_or(0);

        let token_address: Address = env
            .storage()
            .instance()
            .get(&DataKey::TokenAddress)
            .expect("not initialized");

        PoolInfo {
            total_deposits,
            member_count,
            token_address,
        }
    }

    // ── Internal ────────────────────────────────────────────────

    fn require_admin(env: &Env, addr: &Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        assert!(*addr == admin, "unauthorized: not admin");
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::Env;

    #[test]
    fn test_initialize_and_query() {
        let env = Env::default();
        let contract_id = env.register(PoolTreasuryContract, ());
        let client = PoolTreasuryContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let token = Address::generate(&env);

        env.mock_all_auths();
        client.initialize(&admin, &token, &1_000_000i128);

        assert_eq!(client.total_deposits(), 0i128);
        assert_eq!(client.member_count(), 0u64);
    }
}
