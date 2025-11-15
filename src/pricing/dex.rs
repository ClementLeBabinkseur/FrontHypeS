use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

use anyhow::Result;
use ethers::{
    contract::abigen,
    prelude::*,
    providers::{Provider, Ws, Middleware, StreamExt},
    types::{Address, U256, Filter, Log, H256},
};
use tracing::{info, warn};

use super::types::{PoolInfo, PoolState, TickInfo};
use crate::config::Config;

// ─────────────────────────────────────────────────────────────────────────────
// Helper function pour conversion U256 -> f64
// ─────────────────────────────────────────────────────────────────────────────
use num_bigint::BigUint;
use num_traits::ToPrimitive;

fn u256_to_f64(x: U256) -> f64 {
    let mut buf = [0u8; 32];
    x.to_big_endian(&mut buf);
    let int = BigUint::from_bytes_be(&buf);
    int.to_f64().unwrap_or(0.0)
}

// ─────────────────────────────────────────────────────────────────────────────
// ABIs
// ─────────────────────────────────────────────────────────────────────────────

// Uniswap V2 Pair (getReserves)
abigen!(
    IUniswapV2Pair,
    r#"
    [
      {
        "inputs": [],
        "name": "getReserves",
        "outputs": [
          { "internalType": "uint112", "name": "reserve0", "type": "uint112" },
          { "internalType": "uint112", "name": "reserve1", "type": "uint112" },
          { "internalType": "uint32",  "name": "blockTimestampLast", "type": "uint32" }
        ],
        "stateMutability": "view",
        "type": "function"
      }
    ]
    "#,
);

// Uniswap V3 Factory (getPool)
abigen!(
    IUniswapV3Factory,
    r#"
    [
      {
        "inputs":[
          {"internalType":"address","name":"tokenA","type":"address"},
          {"internalType":"address","name":"tokenB","type":"address"},
          {"internalType":"uint24","name":"fee","type":"uint24"}
        ],
        "name":"getPool",
        "outputs":[{"internalType":"address","name":"pool","type":"address"}],
        "stateMutability":"view",
        "type":"function"
      }
    ]
    "#,
);

// Uniswap V3 Pool (token0/1, slot0, liquidity, ticks)
abigen!(
    IUniswapV3Pool,
    r#"
    [
      {
        "inputs": [],
        "name": "token0",
        "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "token1",
        "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "fee",
        "outputs": [{ "internalType": "uint24", "name": "", "type": "uint24" }],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "slot0",
        "outputs": [
          { "internalType": "uint160", "name": "sqrtPriceX96", "type": "uint160" },
          { "internalType": "int24",   "name": "tick",           "type": "int24"  },
          { "internalType": "uint16",  "name": "observationIndex", "type": "uint16" },
          { "internalType": "uint16",  "name": "observationCardinality", "type": "uint16" },
          { "internalType": "uint16",  "name": "observationCardinalityNext", "type": "uint16" },
          { "internalType": "uint8",   "name": "feeProtocol", "type": "uint8" },
          { "internalType": "bool",    "name": "unlocked", "type": "bool" }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "liquidity",
        "outputs": [{ "internalType": "uint128", "name": "", "type": "uint128" }],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [{ "internalType": "int24", "name": "tick", "type": "int24" }],
        "name": "ticks",
        "outputs": [
          { "internalType": "uint128", "name": "liquidityGross", "type": "uint128" },
          { "internalType": "int128",  "name": "liquidityNet",   "type": "int128"  },
          { "internalType": "uint256", "name": "feeGrowthOutside0X128", "type": "uint256" },
          { "internalType": "uint256", "name": "feeGrowthOutside1X128", "type": "uint256" },
          { "internalType": "int56",   "name": "tickCumulativeOutside", "type": "int56" },
          { "internalType": "uint160", "name": "secondsPerLiquidityOutsideX128", "type": "uint160" },
          { "internalType": "uint32",  "name": "secondsOutside", "type": "uint32" },
          { "internalType": "bool",    "name": "initialized", "type": "bool" }
        ],
        "stateMutability": "view",
        "type": "function"
      }
    ]
    "#,
);

// ERC20 (balance + decimals)
abigen!(
    IERC20,
    r#"
    [
      {
        "inputs": [],
        "name": "decimals",
        "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
        "name": "balanceOf",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
      }
    ]
    "#,
);

// ─────────────────────────────────────────────────────────────────────────────
// Constantes Swap Event
// ─────────────────────────────────────────────────────────────────────────────

// Topic hash for Swap event:
// event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)
const SWAP_EVENT_TOPIC: &str = "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67";

// ─────────────────────────────────────────────────────────────────────────────
// Fetcher
// ─────────────────────────────────────────────────────────────────────────────

pub struct DexPriceFetcher {
    provider: Arc<Provider<Ws>>,
    pub(crate) config: Config,
    pools: Arc<RwLock<HashMap<String, PoolState>>>, // 🔥 Thread-safe avec RwLock
}

impl DexPriceFetcher {
    pub async fn new(config: Config) -> Result<Self> {
        info!("Connecting to HyperEVM WebSocket RPC...");
        let ws = Ws::connect(&config.hyperevm_ws_rpc).await?;
        let provider = Arc::new(Provider::new(ws));
        info!("Connected to HyperEVM!");

        Ok(Self {
            provider,
            config,
            pools: Arc::new(RwLock::new(HashMap::new())),
        })
    }

    /// Essaie d'appeler getReserves() sur une paire V2. Si échec → (None, None).
    async fn try_fetch_v2_reserves(&self, pair: Address) -> (Option<U256>, Option<U256>) {
        let contract = IUniswapV2Pair::new(pair, Arc::clone(&self.provider));
        match contract.get_reserves().call().await {
            Ok((r0, r1, _ts)) => (Some(U256::from(r0)), Some(U256::from(r1))),
            Err(_) => (None, None),
        }
    }

    /// Discover and load all relevant pools from factories
    pub async fn discover_pools(&mut self) -> Result<()> {
        info!("Starting pool discovery...");

        let factories = self.config.get_all_factories();
        let tracked_pairs = self.config.get_tracked_pairs();

        // Fee tiers testés côté V3 (si pas de pool → address(0))
        let fee_tiers = vec![100u32, 500u32, 2500u32, 3000u32, 10000u32];
        let factory_names = vec!["Projet X", "Hybra", "HyperSwap", "Ultrasolid"];

        for (idx, factory_address) in factories.iter().enumerate() {
            let factory = IUniswapV3Factory::new(*factory_address, Arc::clone(&self.provider));
            let dex_name = factory_names[idx];

            info!("Scanning {} factory at {:?}", dex_name, factory_address);

            for (token_a, token_b) in &tracked_pairs {
                for fee in &fee_tiers {
                    match self
                        .load_pool(&factory, *token_a, *token_b, *fee, dex_name)
                        .await
                    {
                        Ok(Some(pool_state)) => {
                            let key =
                                format!("{:?}_{:?}_{}", pool_state.info.address, dex_name, fee);
                            let sym0 = self.get_token_symbol(&pool_state.info.token0);
                            let sym1 = self.get_token_symbol(&pool_state.info.token1);
                            info!(
                                "✓ Found pool: {} - {}/{} (fee: {}bp) TVL: ${:.2}",
                                dex_name, sym0, sym1, fee, pool_state.info.tvl_usd
                            );
                            
                            // 🔥 Insert avec write lock
                            let mut pools = self.pools.write().await;
                            pools.insert(key, pool_state);
                        }
                        Ok(None) => {
                            // Pool absent / TVL < min / non supporté
                        }
                        Err(_e) => {
                            // De nombreuses combinaisons échouent → on ignore
                        }
                    }
                }
            }
        }

        let pools_count = self.pools.read().await.len();
        info!("Discovery complete! Found {} valid pools", pools_count);
        Ok(())
    }

    async fn load_pool(
        &self,
        factory: &IUniswapV3Factory<Provider<Ws>>,
        token_a: Address,
        token_b: Address,
        fee: u32,
        dex_name: &str,
    ) -> Result<Option<PoolState>> {
        // Uniswap V3 impose token0 < token1 par adresse
        let (token0, token1) = if token_a < token_b { (token_a, token_b) } else { (token_b, token_a) };

        // Adresse du pool (V3); si 0x0 → pas de pool pour ce fee tier
        let pool_address = factory.get_pool(token0, token1, fee as u32).call().await?;
        if pool_address == Address::zero() {
            return Ok(None);
        }

        let pool = IUniswapV3Pool::new(pool_address, Arc::clone(&self.provider));

        // Métadonnées (V3)
        let token0_addr = pool.token_0().call().await?;
        let token1_addr = pool.token_1().call().await?;
        let (sqrt_price_x96_raw, tick_raw, _, _, _, _, _) = pool.slot_0().call().await?;
        let liquidity = pool.liquidity().call().await?;

        // Si sqrtP nul → tente getReserves() (pools V2 "déguisés" / inactifs)
        let sqrt_price_u256 = U256::from(sqrt_price_x96_raw);
        let (reserve0_opt, reserve1_opt) = if sqrt_price_u256.is_zero() {
            self.try_fetch_v2_reserves(pool_address).await
        } else {
            (None, None)
        };

        let tvl_usd = self
            .calculate_tvl(pool_address, token0_addr, token1_addr, sqrt_price_u256)
            .await?;

        // Filtre par TVL
        if tvl_usd < self.config.min_tvl_usd {
            return Ok(None);
        }

        let pool_info = PoolInfo {
            address: pool_address,
            token0: token0_addr,
            token1: token1_addr,
            fee_tier: fee,
            current_tick: tick_raw as i32,
            sqrt_price_x96: sqrt_price_u256,
            liquidity,
            tvl_usd,
            dex_name: dex_name.to_string(),
            reserve0: reserve0_opt,
            reserve1: reserve1_opt,
        };

        // Quelques ticks autour du tick courant (diagnostic simple)
        let tick_map = self.load_tick_data(&pool, tick_raw as i32).await?;

        Ok(Some(PoolState { 
            info: pool_info, 
            tick_map,
            last_updated_block: 0, // 🔥 Initialisé à 0, sera mis à jour par les events
        }))
    }

    async fn calculate_tvl(
        &self, 
        pool: Address, 
        token0: Address, 
        token1: Address,
        sqrt_price_x96: U256,
    ) -> Result<f64> {
        let token0_contract = IERC20::new(token0, Arc::clone(&self.provider));
        let token1_contract = IERC20::new(token1, Arc::clone(&self.provider));

        let balance0 = token0_contract.balance_of(pool).call().await?;
        let balance1 = token1_contract.balance_of(pool).call().await?;

        let decimals0 = token0_contract.decimals().call().await?;
        let decimals1 = token1_contract.decimals().call().await?;

        let amount0 = balance0.as_u128() as f64 / 10f64.powi(decimals0 as i32);
        let amount1 = balance1.as_u128() as f64 / 10f64.powi(decimals1 as i32);

        let price_token1_per_token0 = if sqrt_price_x96 != U256::zero() {
            let sqrt_f = u256_to_f64(sqrt_price_x96);
            let ratio = sqrt_f / 2f64.powi(96);
            let scale_pow = (decimals0 as i32) - (decimals1 as i32);
            (ratio * ratio) * 10f64.powi(scale_pow)
        } else {
            return Ok(0.0);
        };

        let usdt_addr = self.config.usdt_address.to_string().to_lowercase();
        let token0_str = token0.to_string().to_lowercase();
        let token1_str = token1.to_string().to_lowercase();

        let tvl_usd = if token1_str == usdt_addr {
            let value_token0_usd = amount0 * price_token1_per_token0;
            let value_token1_usd = amount1;
            value_token0_usd + value_token1_usd
        } else if token0_str == usdt_addr {
            let price_token0_per_token1 = if price_token1_per_token0 != 0.0 {
                1.0 / price_token1_per_token0
            } else {
                0.0
            };
            let value_token0_usd = amount0;
            let value_token1_usd = amount1 * price_token0_per_token1;
            value_token0_usd + value_token1_usd
        } else {
            (amount0 + amount1) * 100.0
        };

        Ok(tvl_usd)
    }

    async fn load_tick_data(
        &self,
        pool: &IUniswapV3Pool<Provider<Ws>>,
        current_tick: i32,
    ) -> Result<std::collections::BTreeMap<i32, TickInfo>> {
        let mut tick_map = std::collections::BTreeMap::new();

        let tick_spacing = 60;

        for offset in -10..=10 {
            let tick = current_tick + (offset * tick_spacing);

            match pool.ticks(tick as i32).call().await {
                Ok((liquidity_gross, liquidity_net, _, _, _, _, _, initialized)) => {
                    if initialized && liquidity_gross > 0 {
                        tick_map.insert(
                            tick,
                            TickInfo {
                                tick,
                                liquidity_net,
                                liquidity_gross,
                            },
                        );
                    }
                }
                Err(_) => {
                    // Tick non initialisé → ignore
                }
            }
        }

        Ok(tick_map)
    }

    /// 🔥 NOUVEAU - Subscribe to Swap events from all discovered pools
    pub async fn subscribe_to_swap_events(&self) -> Result<()> {
        info!("Setting up Swap event subscription...");

        // Récupérer toutes les adresses de pools
        let pool_addresses: Vec<Address> = {
            let pools = self.pools.read().await;
            pools.values().map(|p| p.info.address).collect()
        };

        if pool_addresses.is_empty() {
            warn!("No pools to subscribe to!");
            return Ok(());
        }

        info!("Subscribing to Swap events for {} pools", pool_addresses.len());

        // Créer le filter pour les events Swap
        let swap_topic: H256 = SWAP_EVENT_TOPIC.parse()?;
        let filter = Filter::new()
            .address(pool_addresses.clone())
            .topic0(swap_topic);

        // Clone pour la task
        let provider = Arc::clone(&self.provider);
        let pools = Arc::clone(&self.pools);

        // Spawner une tâche qui écoute les logs
        tokio::spawn(async move {
            match provider.subscribe_logs(&filter).await {
                Ok(mut stream) => {
                    info!("✓ Subscribed to Swap events!");
                    
                    while let Some(log) = stream.next().await {
                        if let Err(e) = Self::handle_swap_event(log, Arc::clone(&pools)).await {
                            warn!("Error handling Swap event: {}", e);
                        }
                    }
                }
                Err(e) => {
                    tracing::error!("Failed to subscribe to Swap events: {}", e);
                }
            }
        });

        Ok(())
    }

    /// 🔥 NOUVEAU - Handle individual Swap event
    async fn handle_swap_event(
        log: Log,
        pools: Arc<RwLock<HashMap<String, PoolState>>>,
    ) -> Result<()> {
        // Extraire les données de l'event Swap
        // event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, 
        //            uint160 sqrtPriceX96, uint128 liquidity, int24 tick)
        
        let pool_address = log.address;
        let block_number = log.block_number.map(|n| n.as_u64()).unwrap_or(0);
        
        // Les données non-indexées: amount0, amount1, sqrtPriceX96, liquidity, tick
        if log.data.len() < 160 {
            warn!("Invalid Swap event data length");
            return Ok(());
        }

        // Parse data (5 éléments de 32 bytes chacun)
        // amount0 (int256) - bytes 0-31
        // amount1 (int256) - bytes 32-63
        // sqrtPriceX96 (uint160) - bytes 64-95
        // liquidity (uint128) - bytes 96-127
        // tick (int24) - bytes 128-159
        
        let sqrt_price_x96 = U256::from_big_endian(&log.data[64..96]);
        let liquidity = u128::from_be_bytes({
            let mut bytes = [0u8; 16];
            bytes.copy_from_slice(&log.data[96+16..96+32]); // Prendre les 16 derniers bytes
            bytes
        });
        
        // Tick est un int24 signé (3 bytes)
        let tick_bytes = &log.data[128+29..128+32]; // Les 3 derniers bytes sur 32
        let tick = i32::from_be_bytes([
            if tick_bytes[0] & 0x80 != 0 { 0xff } else { 0 }, // Sign extension
            tick_bytes[0],
            tick_bytes[1],
            tick_bytes[2],
        ]);

        // Mettre à jour le pool correspondant
        let mut pools_write = pools.write().await;
        
        // Trouver le pool par adresse
        for pool_state in pools_write.values_mut() {
            if pool_state.info.address == pool_address {
                // 🔥 Update pool state
                pool_state.info.sqrt_price_x96 = sqrt_price_x96;
                pool_state.info.liquidity = liquidity;
                pool_state.info.current_tick = tick;
                pool_state.last_updated_block = block_number;
                
                // Log silencieux - on verra dans le snapshot
                break;
            }
        }

        Ok(())
    }

    /// 🔥 Accès thread-safe aux pools
    pub async fn get_pools(&self) -> HashMap<String, PoolState> {
        let pools = self.pools.read().await;
        pools.clone()
    }

    pub fn get_token_symbol(&self, address: &Address) -> &str {
        let addr_str = address.to_string().to_lowercase();
        let hype = self.config.hype_address.to_string().to_lowercase();
        let ubtc = self.config.ubtc_address.to_string().to_lowercase();
        let ueth = self.config.ueth_address.to_string().to_lowercase();
        let usdt = self.config.usdt_address.to_string().to_lowercase();

        if addr_str == hype {
            "HYPE"
        } else if addr_str == ubtc {
            "uBTC"
        } else if addr_str == ueth {
            "uETH"
        } else if addr_str == usdt {
            "USDT"
        } else {
            "UNKNOWN"
        }
    }

    pub fn get_provider(&self) -> Arc<Provider<Ws>> {
        Arc::clone(&self.provider)
    }
}
