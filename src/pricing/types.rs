use ethers::types::{Address, U256};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolInfo {
    pub address: Address,
    pub token0: Address,
    pub token1: Address,
    pub fee_tier: u32,
    pub current_tick: i32,
    pub sqrt_price_x96: U256,
    pub liquidity: u128,
    pub tvl_usd: f64,
    pub dex_name: String,

    // V2-only (remplis si getReserves() marche)
    pub reserve0: Option<U256>,
    pub reserve1: Option<U256>,
}

#[derive(Debug, Clone)]
pub struct TickInfo {
    pub tick: i32,
    pub liquidity_net: i128,
    pub liquidity_gross: u128,
}

#[derive(Debug, Clone)]
pub struct PoolState {
    pub info: PoolInfo,
    pub tick_map: std::collections::BTreeMap<i32, TickInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HyperliquidPrice {
    pub symbol: String, // "BTC", "ETH", "HYPE"
    pub mid_price: f64,
    pub bid_price: f64,
    pub ask_price: f64,
    pub timestamp: u64,
}

#[derive(Debug, Clone)]
pub struct PriceSnapshot {
    pub dex_prices: Vec<DexPrice>,
    pub hyperliquid_prices: Vec<HyperliquidPrice>,
    pub timestamp: u64,
}

#[derive(Debug, Clone)]
pub struct DexPrice {
    pub pool: PoolInfo,
    pub token0_price_in_token1: f64, // How much token1 for 1 token0
    pub token1_price_in_token0: f64, // How much token0 for 1 token1
}

impl PoolInfo {
    pub fn get_base_token(&self) -> Address {
        // Assume USDT is always quote, return the other token
        if self.token1.to_string().to_lowercase() == "0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb".to_lowercase() {
            self.token0
        } else {
            self.token1
        }
    }
    
    pub fn is_usdt_quote(&self) -> bool {
        let usdt = "0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb".to_lowercase();
        self.token0.to_string().to_lowercase() == usdt || 
        self.token1.to_string().to_lowercase() == usdt
    }
}

// Uniswap V3 math helpers
pub mod v3_math {
    use ethers::types::U256;
    use num_bigint::BigUint;
    use num_traits::{ToPrimitive, One};

    pub fn sqrt_price_to_price(sqrt_price_x96: U256, decimals0: u8, decimals1: u8) -> f64 {
        if sqrt_price_x96.is_zero() {
            return 0.0;
        }

        // Conversion U256 -> BigUint
        let mut buf = [0u8; 32];
        sqrt_price_x96.to_big_endian(&mut buf);
        let sp = BigUint::from_bytes_be(&buf);

        // Calcul (sqrtP^2) / 2^192 en entier (évite la perte de précision)
        let num = &sp * &sp;
        let den: BigUint = BigUint::from(1u8) << 192usize;

        // ✅ Ajout d'un typage explicite pour aider le compilateur
        let q: BigUint = &num / &den;
        let r: BigUint = &num % &den;

        // Conversion en f64
        let q_f = q.to_f64().unwrap_or(f64::INFINITY);
        let r_f = r.to_f64().unwrap_or(0.0);
        let den_f = den.to_f64().unwrap_or(f64::INFINITY);
        let mut price1_per_0 = q_f + (r_f / den_f);

        // Ajustement décimales (quote per base si base=token0)
        let scale_pow = (decimals0 as i32) - (decimals1 as i32);
        price1_per_0 *= 10f64.powi(scale_pow);

        price1_per_0
    }
}

impl DexPrice {
    /// Retourne Some((base_token, price_in_usdt)) si le pool contient USDT ; None sinon.
    /// Cette fonction est robuste et gère les pools dans les deux sens.
    pub fn get_base_price_in_usdt(&self, usdt_address: Address) -> Option<(Address, f64, &str)> {
        let t0 = self.pool.token0;
        let t1 = self.pool.token1;
        
        // Cas 1: token1 = USDT, donc token0 = BASE
        // Prix = token1/token0 = USDT per BASE ✅
        if t1 == usdt_address {
            return Some((t0, self.token1_price_in_token0, "token0_is_base"));
        }
        
        // Cas 2: token0 = USDT, donc token1 = BASE
        // Prix = token0/token1 = USDT per BASE ✅
        if t0 == usdt_address {
            return Some((t1, self.token0_price_in_token1, "token1_is_base"));
        }
        
        // Cas 3: Aucun USDT (ex: HYPE/BTC)
        None
    }
    
    /// Retourne Some(USDT_per_BASE) si le pool contient USDT ; None sinon.
    /// DEPRECATED: Utiliser get_base_price_in_usdt() à la place pour plus de robustesse
    pub fn usdt_per_base(&self, usdt: Address) -> Option<f64> {
        self.get_base_price_in_usdt(usdt).map(|(_, price, _)| price)
    }
}
