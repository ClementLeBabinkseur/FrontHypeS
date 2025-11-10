pub mod types;
pub mod dex;
pub mod hyperliquid;

pub use types::*;
pub use dex::DexPriceFetcher;
pub use hyperliquid::HyperliquidPriceFetcher;

use anyhow::Result;
use std::time::{SystemTime, UNIX_EPOCH};

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
        for (_, pool_state) in self.dex_fetcher.get_pools() {
            let price = self.calculate_dex_price(&pool_state.info)?;
            dex_prices.push(price);
        }
        
        // Get Hyperliquid prices
        let hl_prices: Vec<HyperliquidPrice> = self.hyperliquid_fetcher
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
        use types::v3_math::sqrt_price_to_price;
        
        // For simplicity, assume both tokens have same decimals (we'd fetch this in production)
        let decimals0 = if pool_info.token0.to_string().to_lowercase().contains("usdt") { 6 } else { 18 };
        let decimals1 = if pool_info.token1.to_string().to_lowercase().contains("usdt") { 6 } else { 18 };
        
        let price = sqrt_price_to_price(pool_info.sqrt_price_x96, decimals0, decimals1);
        
        Ok(DexPrice {
            pool: pool_info.clone(),
            token0_price_in_token1: price,
            token1_price_in_token0: 1.0 / price,
        })
    }
}
