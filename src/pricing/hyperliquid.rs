use anyhow::Result;
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::sync::RwLock;
use std::sync::Arc;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tracing::{info, warn, error};

use super::types::HyperliquidPrice;

#[derive(Debug, Serialize)]
struct SubscribeRequest {
    method: String,
    subscription: Subscription,
}

#[derive(Debug, Serialize)]
struct Subscription {
    #[serde(rename = "type")]
    sub_type: String,
    coin: String,
}

#[derive(Debug, Deserialize)]
struct L2BookResponse {
    channel: String,
    data: L2BookData,
}

#[derive(Debug, Deserialize)]
struct L2BookData {
    coin: String,
    levels: Vec<Vec<Level>>, // [bids, asks]
    time: u64,
}

#[derive(Debug, Deserialize)]
struct Level {
    px: String,  // price
    sz: String,  // size
    n: u32,      // number of orders
}

pub struct HyperliquidPriceFetcher {
    ws_url: String,
    prices: Arc<RwLock<HashMap<String, HyperliquidPrice>>>,
    tracked_symbols: Vec<String>,
}

impl HyperliquidPriceFetcher {
    pub fn new(ws_url: String) -> Self {
        Self {
            ws_url,
            prices: Arc::new(RwLock::new(HashMap::new())),
            tracked_symbols: vec!["BTC".to_string(), "ETH".to_string(), "HYPE".to_string()],
        }
    }
    
    pub async fn connect_and_subscribe(&self) -> Result<()> {
        info!("Connecting to Hyperliquid WebSocket at {}", self.ws_url);
        
        let (ws_stream, _) = connect_async(&self.ws_url).await?;
        let (mut write, mut read) = ws_stream.split();
        
        info!("Connected to Hyperliquid!");
        
        // Subscribe to L2 book for each tracked symbol
        for symbol in &self.tracked_symbols {
            let subscribe_msg = SubscribeRequest {
                method: "subscribe".to_string(),
                subscription: Subscription {
                    sub_type: "l2Book".to_string(),
                    coin: symbol.clone(),
                },
            };
            
            let msg = serde_json::to_string(&subscribe_msg)?;
            write.send(Message::Text(msg)).await?;
            info!("Subscribed to {} orderbook", symbol);
        }
        
        // Clone Arc for the task
        let prices = Arc::clone(&self.prices);
        
        // Spawn task to handle incoming messages
        tokio::spawn(async move {
            while let Some(msg) = read.next().await {
                match msg {
                    Ok(Message::Text(text)) => {
                        if let Err(e) = Self::handle_message(text, Arc::clone(&prices)).await {
                            warn!("Error handling Hyperliquid message: {}", e);
                        }
                    }
                    Ok(Message::Ping(data)) => {
                        if let Err(e) = write.send(Message::Pong(data)).await {
                            error!("Error sending pong: {}", e);
                        }
                    }
                    Ok(Message::Close(_)) => {
                        error!("Hyperliquid WebSocket closed");
                        break;
                    }
                    Err(e) => {
                        error!("WebSocket error: {}", e);
                        break;
                    }
                    _ => {}
                }
            }
        });
        
        Ok(())
    }
    
    async fn handle_message(text: String, prices: Arc<RwLock<HashMap<String, HyperliquidPrice>>>) -> Result<()> {
        // Try to parse as L2 book update
        if let Ok(response) = serde_json::from_str::<L2BookResponse>(&text) {
            if response.channel == "l2Book" {
                let data = response.data;
                
                // Extract best bid and ask
                let bids = &data.levels[0];
                let asks = &data.levels[1];
                
                if bids.is_empty() || asks.is_empty() {
                    return Ok(());
                }
                
                let best_bid: f64 = bids[0].px.parse()?;
                let best_ask: f64 = asks[0].px.parse()?;
                let mid_price = (best_bid + best_ask) / 2.0;
                
                let price = HyperliquidPrice {
                    symbol: data.coin.clone(),
                    mid_price,
                    bid_price: best_bid,
                    ask_price: best_ask,
                    timestamp: data.time,
                };
                
                // Update price map
                let mut prices_write = prices.write().await;
                prices_write.insert(data.coin.clone(), price.clone());
                
                // Commented out for cleaner logs - prices are visible in snapshots
                 info!(
                     "Hyperliquid {} - Bid: {:.2} | Mid: {:.2} | Ask: {:.2}",
                     data.coin, best_bid, mid_price, best_ask
                 );
            }
        }
        
        Ok(())
    }
    
    pub async fn get_price(&self, symbol: &str) -> Option<HyperliquidPrice> {
        let prices = self.prices.read().await;
        prices.get(symbol).cloned()
    }
    
    pub async fn get_all_prices(&self) -> HashMap<String, HyperliquidPrice> {
        let prices = self.prices.read().await;
        prices.clone()
    }
}