use ethers::types::{Address, U256};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolInfo {
    pub address: Address,
    pub token0: Address,
    pub token1: Address,
    pub fee_tier: u32, // Fee in basis points (500 = 0.05%, 3000 = 0.3%, 10000 = 1%)
    pub current_tick: i32,
    pub sqrt_price_x96: U256,
    pub liquidity: u128,
    pub tvl_usd: f64,
    pub dex_name: String,
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
    
    const Q96: u128 = 1u128 << 96;
    
    pub fn sqrt_price_to_price(sqrt_price_x96: U256, decimals0: u8, decimals1: u8) -> f64 {
        let sqrt_price = sqrt_price_x96.as_u128() as f64;
        let price = (sqrt_price / Q96 as f64).powi(2);
        
        // Adjust for decimals
        let decimal_adjustment = 10f64.powi((decimals1 as i32) - (decimals0 as i32));
        price * decimal_adjustment
    }
    
    pub fn tick_to_price(tick: i32) -> f64 {
        1.0001f64.powi(tick)
    }
    
    pub fn price_to_tick(price: f64) -> i32 {
        (price.log(1.0001)) as i32
    }
}
