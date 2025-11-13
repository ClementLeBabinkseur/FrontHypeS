use anyhow::Result;
use ethers::{
    providers::{Provider, Ws, StreamExt, Middleware},  // ✅ Ajouter Middleware
    types::U256,
};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::info;

#[derive(Debug, Clone)]
pub struct GasPrice {
    pub wei: U256,
    pub gwei: f64,
    pub hype: f64,
    pub timestamp: u64,
}

pub struct GasMonitor {
    provider: Arc<Provider<Ws>>,
    current_gas_price: Arc<RwLock<Option<GasPrice>>>,
}

impl GasMonitor {
    pub fn new(provider: Arc<Provider<Ws>>) -> Self {
        Self {
            provider,
            current_gas_price: Arc::new(RwLock::new(None)),
        }
    }

    /// Lance le monitoring continu du gas price via WebSocket
    pub async fn start_monitoring(&self) -> Result<()> {
        info!("Starting gas price monitoring...");

        // Récupérer le gas price initial
        self.update_gas_price().await?;

        // Clone pour la tâche
        let provider = Arc::clone(&self.provider);
        let gas_price_store = Arc::clone(&self.current_gas_price);

        // Spawner une tâche pour écouter les nouveaux blocks
        tokio::spawn(async move {
            // Subscribe to new blocks
            match provider.subscribe_blocks().await {
                Ok(mut stream) => {
                    info!("✓ Subscribed to new blocks for gas price updates");
                    
                    while let Some(block) = stream.next().await {
                        // Nouveau block → update gas price
                        if let Ok(gas_price_wei) = provider.get_gas_price().await {
                            let gas_price_f64 = gas_price_wei.as_u128() as f64;
                            let gwei = gas_price_f64 / 1_000_000_000.0;
                            let hype = gwei / 1_000_000_000.0;

                            let timestamp = std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .unwrap()
                                .as_secs();

                            let gas_price = GasPrice {
                                wei: gas_price_wei,
                                gwei,
                                hype,
                                timestamp,
                            };

                            // Update le store
                            let mut store = gas_price_store.write().await;
                            *store = Some(gas_price.clone());

                            info!(
                                "⛽ Gas price updated - Block: {} | Wei: {} | Gwei: {:.6} | HYPE: {:.12}",
                                block.number.unwrap_or_default(),
                                gas_price.wei,
                                gas_price.gwei,
                                gas_price.hype
                            );
                        }
                    }
                }
                Err(e) => {
                    tracing::error!("Failed to subscribe to blocks: {}", e);
                }
            }
        });

        Ok(())
    }

    /// Update manuel du gas price (utilisé au démarrage)
    async fn update_gas_price(&self) -> Result<()> {
        let gas_price_wei = self.provider.get_gas_price().await?;
        let gas_price_f64 = gas_price_wei.as_u128() as f64;
        let gwei = gas_price_f64 / 1_000_000_000.0;
        let hype = gwei / 1_000_000_000.0;

        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs();

        let gas_price = GasPrice {
            wei: gas_price_wei,
            gwei,
            hype,
            timestamp,
        };

        let mut store = self.current_gas_price.write().await;
        *store = Some(gas_price.clone());

        info!(
            "⛽ Initial gas price - Wei: {} | Gwei: {:.6} | HYPE: {:.12}",
            gas_price.wei, gas_price.gwei, gas_price.hype
        );

        Ok(())
    }

    /// Récupérer le gas price actuel
    pub async fn get_gas_price(&self) -> Option<GasPrice> {
        let store = self.current_gas_price.read().await;
        store.clone()
    }
}
