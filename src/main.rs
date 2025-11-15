mod config;
mod pricing;

use anyhow::Result;
use tracing::{info, error, warn};
use tracing_subscriber;
use ethers::providers::{Middleware, StreamExt};

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
    
    // Discover pools, connect to Hyperliquid, start gas monitoring, subscribe to Swap events
    pricing_engine.initialize().await?;
    info!("Pricing engine initialized");
    
    // Give WebSocket time to receive initial data
    tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
    
    // 🔥 Subscribe to new blocks instead of polling
    info!("Starting block subscription...");
    
    let provider = pricing_engine.dex_fetcher.get_provider();
    
    match provider.subscribe_blocks().await {
        Ok(mut stream) => {
            info!("✓ Subscribed to new blocks!");
            
            while let Some(block) = stream.next().await {
                let block_number = block.number.map(|n| n.as_u64()).unwrap_or(0);
                
                // Get price snapshot
                match pricing_engine.get_price_snapshot().await {
                    Ok(snapshot) => {
                        // Get current gas price
                        let gas_info = pricing_engine.gas_monitor.get_gas_price().await;
                        
                        // 🔥 Header avec block number
                        info!("");
                        info!("════════════════════════════════════════════════════════");
                        info!("🧱 Block #{}", block_number);
                        info!("════════════════════════════════════════════════════════");
                        
                        // 🔥 Gas price sur plusieurs lignes
                        if let Some(gas) = gas_info {
                            info!("⛽ Gas price");
                            info!("⛽ HYPE: {:.12}", gas.hype);
                            info!("⛽ Gwei: {:.6}", gas.gwei);
                            info!("⛽ Wei: {}", gas.wei);
                        } else {
                            info!("⛽ Gas price: N/A");
                        }
                        info!("════════════════════════════════════════════════════════");
                        
                        // DEX Prices
                        if !snapshot.dex_prices.is_empty() {
                            info!("📊 DEX Prices ({} pools):", snapshot.dex_prices.len());
                            info!("────────────────────────────────────────────────────────");
                            
                            for dex_price in &snapshot.dex_prices {
                                // 🔥 Déterminer si fresh
                                let is_fresh = pricing_engine.is_fresh(
                                    dex_price.last_updated_block,
                                    block_number
                                );
                                
                                let fresh_tag = if is_fresh { " [FRESH 🔥]" } else { "" };
                                
                                if let Some((base_symbol, price_usdt)) = pricing_engine.get_price_in_usdt(dex_price) {
                                    info!(
                                        "  {} - {}/USDT ({}bp, TVL: ${:.0}): ${:.6}{}",
                                        dex_price.pool.dex_name,
                                        base_symbol,
                                        dex_price.pool.fee_tier,
                                        dex_price.pool.tvl_usd,
                                        price_usdt,
                                        fresh_tag
                                    );
                                } else {
                                    let sym0 = pricing_engine.dex_fetcher.get_token_symbol(&dex_price.pool.token0);
                                    let sym1 = pricing_engine.dex_fetcher.get_token_symbol(&dex_price.pool.token1);
                                    
                                    warn!(
                                        "  {} - {}/{} ({}bp, TVL: ${:.0}): {} per {} = {:.6} (no USDT){}",
                                        dex_price.pool.dex_name,
                                        sym0, sym1,
                                        dex_price.pool.fee_tier,
                                        dex_price.pool.tvl_usd,
                                        sym1, sym0,
                                        dex_price.token1_price_in_token0,
                                        fresh_tag
                                    );
                                }
                            }
                        }
                        
                        // Hyperliquid Prices
                        if !snapshot.hyperliquid_prices.is_empty() {
                            info!("");
                            info!("📈 Hyperliquid Prices:");
                            info!("────────────────────────────────────────────────────────");
                            for hl_price in &snapshot.hyperliquid_prices {
                                info!(
                                    "  {}: Bid=${:.2} | Mid=${:.2} | Ask=${:.2}",
                                    hl_price.symbol,
                                    hl_price.bid_price,
                                    hl_price.mid_price,
                                    hl_price.ask_price
                                );
                            }
                        }
                        
                        info!("════════════════════════════════════════════════════════");
                        
                        // TODO: Next step - implement finder to detect arbitrage opportunities
                    }
                    Err(e) => {
                        error!("Error getting price snapshot: {}", e);
                    }
                }
            }
            
            warn!("Block stream ended unexpectedly");
        }
        Err(e) => {
            error!("Failed to subscribe to blocks: {}", e);
        }
    }
    
    Ok(())
}