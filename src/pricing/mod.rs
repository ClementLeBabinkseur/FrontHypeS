pub mod types;
pub mod dex;
pub mod hyperliquid;

pub use types::*;
pub use dex::DexPriceFetcher;
pub use hyperliquid::HyperliquidPriceFetcher;

use anyhow::Result;
use std::time::{SystemTime, UNIX_EPOCH};
use ethers::types::U256;

use num_bigint::BigUint;
use num_traits::ToPrimitive;

// ─────────────────────────────────────────────────────────────────────────────
// Helper module-scope (accessible partout dans ce fichier)
// ─────────────────────────────────────────────────────────────────────────────
fn u256_to_f64(x: U256) -> f64 {
    let mut buf = [0u8; 32];
    x.to_big_endian(&mut buf);
    let int = BigUint::from_bytes_be(&buf);
    int.to_f64().unwrap_or(0.0)
}

// ─────────────────────────────────────────────────────────────────────────────

pub struct PricingEngine {
    pub dex_fetcher: DexPriceFetcher,
    pub hyperliquid_fetcher: HyperliquidPriceFetcher,
}

impl PricingEngine {
    pub async fn new(config: crate::config::Config) -> Result<Self> {
        let dex_fetcher = DexPriceFetcher::new(config.clone()).await?;
        let hyperliquid_fetcher = HyperliquidPriceFetcher::new(config.hyperliquid_ws_url.clone());

        Ok(Self {
            dex_fetcher,
            hyperliquid_fetcher,
        })
    }

    pub async fn initialize(&mut self) -> Result<()> {
        // Discover all pools
        self.dex_fetcher.discover_pools().await?;

        // Connect to Hyperliquid
        self.hyperliquid_fetcher.connect_and_subscribe().await?;

        Ok(())
    }

    pub async fn get_price_snapshot(&self) -> Result<PriceSnapshot> {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)?
            .as_secs();

        // Get DEX prices
        let mut dex_prices = Vec::new();
        for (_k, pool_state) in self.dex_fetcher.get_pools() {
            let price = self.calculate_dex_price(&pool_state.info)?;
            dex_prices.push(price);
        }

        // Get Hyperliquid prices
        let hl_prices: Vec<HyperliquidPrice> = self
            .hyperliquid_fetcher
            .get_all_prices()
            .await
            .into_values()
            .collect();

        Ok(PriceSnapshot {
            dex_prices,
            hyperliquid_prices: hl_prices,
            timestamp,
        })
    }

    fn calculate_dex_price(&self, pool_info: &PoolInfo) -> Result<DexPrice> {
    use ethers::types::U256;

    // Décimales: USDT=6, uBTC=8, le reste=18 (ta fonction get_token_decimals)
    let (dec0, dec1) = self.get_token_decimals(&pool_info.token0, &pool_info.token1);

    // On veut p10 = token1 / token0 (prix de 1 token0 exprimé en token1)
    // Uniswap v3: sqrtPriceX96 = floor( sqrt(p10 * 10^(dec0 - dec1)) * 2^96 )
    // => p10 = (sqrtPriceX96 / 2^96)^2 * 10^(dec1 - dec0)   ⬅️ ATTENTION AU SIGNE
    let p10: f64 = if pool_info.sqrt_price_x96 != U256::zero() {
        let sqrt_f = u256_to_f64(pool_info.sqrt_price_x96);
        let ratio = sqrt_f / 2f64.powi(96);
        let scale_pow = (dec1 as i32) - (dec0 as i32); // ✅ dec1 - dec0
        (ratio * ratio) * 10f64.powi(scale_pow)
    } else if let (Some(r0), Some(r1)) = (pool_info.reserve0, pool_info.reserve1) {
        // V2 fallback: p10 = (r1/10^dec1) / (r0/10^dec0)
        let r0_f = u256_to_f64(r0);
        let r1_f = u256_to_f64(r1);
        if r0_f > 0.0 && r1_f > 0.0 {
            let q0 = r0_f / 10f64.powi(dec0 as i32);
            let q1 = r1_f / 10f64.powi(dec1 as i32);
            if q0 > 0.0 { q1 / q0 } else { 0.0 }
        } else {
            0.0
        }
    } else {
        0.0
    };

    // L’autre sens
    let p01: f64 = if p10 == 0.0 { 0.0 } else { 1.0 / p10 };

    Ok(DexPrice {
        pool: pool_info.clone(),
        token1_price_in_token0: p10, // token1 / token0
        token0_price_in_token1: p01, // token0 / token1
    })
}

    fn get_token_decimals(
        &self,
        token0: &ethers::types::Address,
        token1: &ethers::types::Address,
    ) -> (u8, u8) {
        // TODO: à terme, lire on-chain ERC20::decimals() et cacher
        // Pour l’instant: USDT=6, uBTC=8, le reste=18
        let usdt = "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb".to_lowercase(); // USDT (6)
        let ubtc = "0x9fdbda0a5e284c32744d2f17ee5c74b284993463".to_lowercase(); // uBTC (8)

        let t0 = token0.to_string().to_lowercase();
        let t1 = token1.to_string().to_lowercase();

        let d0 = if t0 == usdt {
            6
        } else if !ubtc.is_empty() && t0 == ubtc {
            8
        } else {
            18
        };

        let d1 = if t1 == usdt {
            6
        } else if !ubtc.is_empty() && t1 == ubtc {
            8
        } else {
            18
        };

        (d0, d1)
    }
}