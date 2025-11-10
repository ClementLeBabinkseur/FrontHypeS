mod config;
mod pricing;

use anyhow::Result;
use tracing::{info, error};
use tracing_subscriber;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter("arbitrage_bot=info")
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
                    let base_token = if dex_price.pool.token0.to_string().to_lowercase().contains("usdt") {
                        "token1"
                    } else {
                        "token0"
                    };
                    
                    info!(
                        "  {} - {} (fee: {}bp): Price = {:.6} USDT",
                        dex_price.pool.dex_name,
                        get_symbol(&dex_price.pool.get_base_token()),
                        dex_price.pool.fee_tier,
                        if base_token == "token0" {
                            dex_price.token0_price_in_token1
                        } else {
                            dex_price.token1_price_in_token0
                        }
                    );
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

fn get_symbol(address: &ethers::types::Address) -> &str {
    let addr_str = address.to_string().to_lowercase();
    if addr_str.contains("5555555555555555") {
        "HYPE"
    } else if addr_str.contains("9fdbda0a5e284c32") {
        "uBTC"
    } else if addr_str.contains("be6727b535545c67") {
        "uETH"
    } else if addr_str.contains("b8ce59fc3717ada4") {
        "USDT"
    } else {
        "UNKNOWN"
    }
}
