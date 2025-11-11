mod config;
mod pricing;

use anyhow::Result;
use tracing::{info, error};
use tracing_subscriber;
use ethers::types::Address;

fn get_symbol(address: &ethers::types::Address) -> &str {
    let hype: ethers::types::Address = "0x5555555555555555555555555555555555555555".parse().unwrap();
    let ubtc: ethers::types::Address = "0x9fdbda0a5e284c32744d2f17ee5c74b284993463".parse().unwrap();
    let ueth: ethers::types::Address = "0xbe6727b535545c67d5caa73dea54865b92cf7907".parse().unwrap();
    let usdt: ethers::types::Address = "0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb".parse().unwrap();
    
    if address == &hype {
        "HYPE"
    } else if address == &ubtc {
        "uBTC"
    } else if address == &ueth {
        "uETH"
    } else if address == &usdt {
        "USDT"
    } else {
        "UNKNOWN"
    }
}

fn is_usdt(address: &ethers::types::Address) -> bool {
    let usdt: ethers::types::Address = "0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb".parse().unwrap();
    address == &usdt
}

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
    // On veut toujours afficher "PRIX EN USDT d'1 BASE"
    // Si token1 = USDT → prix = token1_per_token0
    // Si token0 = USDT → prix = token0_per_token1
    let is_t0_usdt = is_usdt(&dex_price.pool.token0);
    let is_t1_usdt = is_usdt(&dex_price.pool.token1);

    // Résolution des symboles (ton helper existant)
    let t0_sym = get_symbol(&dex_price.pool.token0);
    let t1_sym = get_symbol(&dex_price.pool.token1);

    // Détermine la base (non-USDT), la quote (USDT) et la bonne métrique à afficher
    let (base_symbol, quote_symbol, price_in_quote) = if is_t1_usdt && !is_t0_usdt {
        // pair = BASE/USDT → token1_price_in_token0 = USDT par BASE
        (t0_sym, "USDT", dex_price.token1_price_in_token0)
    } else if is_t0_usdt && !is_t1_usdt {
        // pair = USDT/BASE → token0_price_in_token1 = USDT par BASE
        (t1_sym, "USDT", dex_price.token0_price_in_token1)
    } else {
        // pas d’USDT dans la paire → on n’affiche pas ici
        continue;
    };

    info!(
        "  {} - {}/{} (fee: {}bp, TVL: ${:.0}): Price = {:.2} {}",
        dex_price.pool.dex_name,
        base_symbol,
        quote_symbol,
        dex_price.pool.fee_tier,
        dex_price.pool.tvl_usd,
        price_in_quote,
        quote_symbol
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