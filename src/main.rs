mod config;
mod pricing;

use anyhow::Result;
use tracing::{info, error, warn};
use tracing_subscriber;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging with RUST_LOG env variable
    tracing_subscriber::fmt()
        .with_env_filter(
            std::env::var("RUST_LOG")
                .unwrap_or_else(|_| "arbitrage_bot=info".to_string())
        )
        .init();
    
    info!("🚀 Starting Arbitrage Bot...");
    
    // Load configuration
    let config = config::Config::from_env()?;
    info!("Configuration loaded");
    
    // Initialize pricing engine
    let mut pricing_engine = pricing::PricingEngine::new(config).await?;
    info!("Pricing engine created");
    
    // Discover pools and connect to Hyperliquid
    pricing_engine.initialize().await?;
    info!("Pricing engine initialized");
    
    // Give WebSocket time to receive initial data
    tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
    
    // Main loop - fetch price snapshots
    info!("Starting price monitoring loop...");
    
    loop {
        match pricing_engine.get_price_snapshot().await {
            Ok(snapshot) => {
                info!("=== Price Snapshot ===");
                info!("DEX Prices: {} pools", snapshot.dex_prices.len());
                
                for dex_price in &snapshot.dex_prices {
                    // ✅ ROBUSTE: Utiliser get_price_in_usdt() pour gérer tous les ordres de pools
                    if let Some((base_symbol, price_usdt)) = pricing_engine.get_price_in_usdt(dex_price) {
                        // Pool avec USDT - afficher le prix en USDT
                        info!(
                            "  {} - {}/USDT (fee: {}bp, TVL: ${:.0}): Price = {:.6} USDT",
                            dex_price.pool.dex_name,
                            base_symbol,
                            dex_price.pool.fee_tier,
                            dex_price.pool.tvl_usd,
                            price_usdt
                        );
                    } else {
                        // Pool sans USDT (ex: HYPE/uBTC) - afficher avec avertissement
                        let sym0 = pricing_engine.dex_fetcher.get_token_symbol(&dex_price.pool.token0);
                        let sym1 = pricing_engine.dex_fetcher.get_token_symbol(&dex_price.pool.token1);
                        
                        warn!(
                            "  {} - {}/{} (fee: {}bp, TVL: ${:.0}): {} per {} = {:.6} (no USDT)",
                            dex_price.pool.dex_name,
                            sym0, sym1,
                            dex_price.pool.fee_tier,
                            dex_price.pool.tvl_usd,
                            sym1, sym0,
                            dex_price.token1_price_in_token0
                        );
                    }
                }
                
                info!("Hyperliquid Prices:");
                for hl_price in &snapshot.hyperliquid_prices {
                    info!(
                        "  {}: Bid={:.2} | Mid={:.2} | Ask={:.2}",
                        hl_price.symbol,
                        hl_price.bid_price,
                        hl_price.mid_price,
                        hl_price.ask_price
                    );
                }
                
                // TODO: Next step - implement finder to detect arbitrage opportunities
            }
            Err(e) => {
                error!("Error getting price snapshot: {}", e);
            }
        }
        
        // Wait before next snapshot (adjust based on needed frequency)
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
    }
}
