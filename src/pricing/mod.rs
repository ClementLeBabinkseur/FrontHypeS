pub mod types;
pub mod dex;
pub mod hyperliquid;
pub mod gas_monitor;

pub use types::*;
pub use dex::DexPriceFetcher;
pub use hyperliquid::HyperliquidPriceFetcher;
pub use gas_monitor::{GasMonitor, GasPrice};

use anyhow::Result;
use std::time::{SystemTime, UNIX_EPOCH};
use ethers::types::{U256, Address};

use num_bigint::BigUint;
use num_traits::ToPrimitive;

// ─────────────────────────────────────────────────────────────────────────────
// Helper module-scope
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
    pub gas_monitor: GasMonitor,
    usdt_address: Address,
}

impl PricingEngine {
    pub async fn new(config: crate::config::Config) -> Result<Self> {
        let usdt_address = config.usdt_address;
        let dex_fetcher = DexPriceFetcher::new(config.clone()).await?;
        let hyperliquid_fetcher = HyperliquidPriceFetcher::new(config.hyperliquid_ws_url.clone());
        
        let gas_monitor = GasMonitor::new(dex_fetcher.get_provider());

        Ok(Self {
            dex_fetcher,
            hyperliquid_fetcher,
            gas_monitor,
            usdt_address,
        })
    }

    pub async fn initialize(&mut self) -> Result<()> {
        // Discover all pools
        self.dex_fetcher.discover_pools().await?;

        // Connect to Hyperliquid
        self.hyperliquid_fetcher.connect_and_subscribe().await?;
        
        // Start gas price monitoring
        self.gas_monitor.start_monitoring().await?;
        
        // 🔥 NOUVEAU - Subscribe to Swap events
        self.dex_fetcher.subscribe_to_swap_events().await?;

        Ok(())
    }

    pub async fn get_price_snapshot(&self) -> Result<PriceSnapshot> {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)?
            .as_secs();

        // 🔥 Get DEX prices avec thread-safe read
        let mut dex_prices = Vec::new();
        let pools = self.dex_fetcher.get_pools().await;
        
        for (_k, pool_state) in pools {
            let mut price = self.calculate_dex_price(&pool_state.info)?;
            price.last_updated_block = pool_state.last_updated_block; // 🔥 Ajouter le block number
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

        let (dec0, dec1) = self.get_token_decimals(&pool_info.token0, &pool_info.token1);

        let price_token1_per_token0: f64 = if pool_info.sqrt_price_x96 != U256::zero() {
            let sqrt_f = u256_to_f64(pool_info.sqrt_price_x96);
            let ratio = sqrt_f / 2f64.powi(96);
            let scale_pow = (dec0 as i32) - (dec1 as i32);
            (ratio * ratio) * 10f64.powi(scale_pow)
        } else if let (Some(r0), Some(r1)) = (pool_info.reserve0, pool_info.reserve1) {
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

        let price_token0_per_token1: f64 = if price_token1_per_token0 == 0.0 { 
            0.0 
        } else { 
            1.0 / price_token1_per_token0 
        };

        Ok(DexPrice {
            pool: pool_info.clone(),
            token1_price_in_token0: price_token1_per_token0,
            token0_price_in_token1: price_token0_per_token1,
            last_updated_block: 0, // 🔥 Sera rempli par get_price_snapshot
        })
    }

    fn get_token_decimals(
        &self,
        token0: &ethers::types::Address,
        token1: &ethers::types::Address,
    ) -> (u8, u8) {
        let usdt_addr = self.dex_fetcher.config.usdt_address;
        let ubtc_addr = self.dex_fetcher.config.ubtc_address;

        let d0 = if token0 == &usdt_addr {
            6
        } else if token0 == &ubtc_addr {
            8
        } else {
            18
        };

        let d1 = if token1 == &usdt_addr {
            6
        } else if token1 == &ubtc_addr {
            8
        } else {
            18
        };

        (d0, d1)
    }
    
    pub fn get_price_in_usdt(&self, dex_price: &DexPrice) -> Option<(String, f64)> {
        let usdt = self.usdt_address;
        let token0 = dex_price.pool.token0;
        let token1 = dex_price.pool.token1;
        
        if token1 == usdt {
            let symbol = self.dex_fetcher.get_token_symbol(&token0);
            return Some((symbol.to_string(), dex_price.token1_price_in_token0));
        }
        
        if token0 == usdt {
            let symbol = self.dex_fetcher.get_token_symbol(&token1);
            return Some((symbol.to_string(), dex_price.token0_price_in_token1));
        }
        
        None
    }
    
    /// 🔥 NOUVEAU - Détermine si un pool est "fresh" (mis à jour il y a moins de 3 blocs)
    pub fn is_fresh(&self, pool_last_block: u64, current_block: u64) -> bool {
        if pool_last_block == 0 {
            // Jamais mis à jour par un event
            return false;
        }
        
        // Fresh si mis à jour dans les 2 derniers blocs (current ou current-1 ou current-2)
        current_block.saturating_sub(pool_last_block) < 3
    }
}
