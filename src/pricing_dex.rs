use std::sync::Arc;
use ethers::{
    prelude::*,
    providers::{Provider, Ws},
    types::{Address, U256},
};
use anyhow::Result;
use std::collections::HashMap;
use tracing::{info, warn, error};

use super::types::{PoolInfo, PoolState, TickInfo};
use crate::config::Config;

// Uniswap V3 Factory ABI (minimal)
abigen!(
    IUniswapV3Factory,
    r#"[
        function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)
    ]"#,
);

// Uniswap V3 Pool ABI (minimal)
abigen!(
    IUniswapV3Pool,
    r#"[
        function token0() external view returns (address)
        function token1() external view returns (address)
        function fee() external view returns (uint24)
        function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)
        function liquidity() external view returns (uint128)
        function ticks(int24 tick) external view returns (uint128 liquidityGross, int128 liquidityNet, uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128, int56 tickCumulativeOutside, uint160 secondsPerLiquidityOutsideX128, uint32 secondsOutside, bool initialized)
    ]"#,
);

// ERC20 for getting decimals and TVL
abigen!(
    IERC20,
    r#"[
        function decimals() external view returns (uint8)
        function balanceOf(address account) external view returns (uint256)
    ]"#,
);

pub struct DexPriceFetcher {
    provider: Arc<Provider<Ws>>,
    config: Config,
    pools: HashMap<String, PoolState>,
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
            pools: HashMap::new(),
        })
    }
    
    /// Discover and load all relevant pools from factories
    pub async fn discover_pools(&mut self) -> Result<()> {
        info!("Starting pool discovery...");
        
        let factories = self.config.get_all_factories();
        let tracked_pairs = self.config.get_tracked_pairs();
        let fee_tiers = vec![500u32, 3000u32, 10000u32]; // 0.05%, 0.3%, 1%
        
        let factory_names = vec!["Projet X", "Hybra", "HyperSwap", "Ultrasolid"];
        
        for (idx, factory_address) in factories.iter().enumerate() {
            let factory = IUniswapV3Factory::new(*factory_address, Arc::clone(&self.provider));
            let dex_name = factory_names[idx];
            
            info!("Scanning {} factory at {:?}", dex_name, factory_address);
            
            for (token0, token1) in &tracked_pairs {
                for fee in &fee_tiers {
                    match self.load_pool(&factory, *token0, *token1, *fee, dex_name).await {
                        Ok(Some(pool_state)) => {
                            let key = format!("{:?}_{:?}_{}", pool_state.info.address, dex_name, fee);
                            info!(
                                "✓ Found pool: {} - {}/USDT (fee: {}bp) TVL: ${:.2}",
                                dex_name,
                                self.get_token_symbol(&pool_state.info.get_base_token()),
                                fee,
                                pool_state.info.tvl_usd
                            );
                            self.pools.insert(key, pool_state);
                        }
                        Ok(None) => {
                            // Pool doesn't exist or filtered out
                        }
                        Err(e) => {
                            warn!("Error loading pool: {}", e);
                        }
                    }
                }
            }
        }
        
        info!("Discovery complete! Found {} valid pools", self.pools.len());
        Ok(())
    }
    
    async fn load_pool(
        &self,
        factory: &IUniswapV3Factory<Provider<Ws>>,
        token0: Address,
        token1: Address,
        fee: u32,
        dex_name: &str,
    ) -> Result<Option<PoolState>> {
        // Get pool address from factory
        let pool_address = factory.get_pool(token0, token1, fee as u32).call().await?;
        
        // Check if pool exists
        if pool_address == Address::zero() {
            return Ok(None);
        }
        
        let pool = IUniswapV3Pool::new(pool_address, Arc::clone(&self.provider));
        
        // Get pool data
        let token0_addr = pool.token_0().call().await?;
        let token1_addr = pool.token_1().call().await?;
        let (sqrt_price_x96, tick, _, _, _, _, _) = pool.slot_0().call().await?;
        let liquidity = pool.liquidity().call().await?;
        
        // Calculate TVL
        let tvl_usd = self.calculate_tvl(pool_address, token0_addr, token1_addr).await?;
        
        // Filter by minimum TVL
        if tvl_usd < self.config.min_tvl_usd {
            return Ok(None);
        }
        
        let pool_info = PoolInfo {
            address: pool_address,
            token0: token0_addr,
            token1: token1_addr,
            fee_tier: fee,
            current_tick: tick as i32,
            sqrt_price_x96: U256::from(sqrt_price_x96),
            liquidity: liquidity,
            tvl_usd,
            dex_name: dex_name.to_string(),
        };
        
        // Load tick data around current tick
        let tick_map = self.load_tick_data(&pool, tick as i32).await?;
        
        Ok(Some(PoolState {
            info: pool_info,
            tick_map,
        }))
    }
    
    async fn calculate_tvl(&self, pool: Address, token0: Address, token1: Address) -> Result<f64> {
        let token0_contract = IERC20::new(token0, Arc::clone(&self.provider));
        let token1_contract = IERC20::new(token1, Arc::clone(&self.provider));
        
        let balance0 = token0_contract.balance_of(pool).call().await?;
        let balance1 = token1_contract.balance_of(pool).call().await?;
        
        let decimals0 = token0_contract.decimals().call().await?;
        let decimals1 = token1_contract.decimals().call().await?;
        
        let amount0 = balance0.as_u128() as f64 / 10f64.powi(decimals0 as i32);
        let amount1 = balance1.as_u128() as f64 / 10f64.powi(decimals1 as i32);
        
        // Assume token1 is always USDT for now (quote currency)
        // So TVL = amount0 * price_in_usdt + amount1
        // For simplicity, we'll just use amount1 * 2 as rough estimate
        // TODO: Use actual price oracle
        Ok(amount1 * 2.0)
    }
    
    async fn load_tick_data(
        &self,
        pool: &IUniswapV3Pool<Provider<Ws>>,
        current_tick: i32,
    ) -> Result<std::collections::BTreeMap<i32, TickInfo>> {
        let mut tick_map = std::collections::BTreeMap::new();
        
        // Load ticks in range (current_tick - 100 to current_tick + 100)
        // This is a simplified version - in production you'd want to load
        // all initialized ticks more efficiently
        let tick_spacing = 60; // This varies by fee tier, but 60 is common
        
        for offset in -10..=10 {
            let tick = current_tick + (offset * tick_spacing);
            
            match pool.ticks(tick as i32).call().await {
                Ok((liquidity_gross, liquidity_net, _, _, _, _, _, initialized)) => {
                    if initialized && liquidity_gross > 0 {
                        tick_map.insert(tick, TickInfo {
                            tick,
                            liquidity_net,
                            liquidity_gross,
                        });
                    }
                }
                Err(_) => {
                    // Tick not initialized, skip
                }
            }
        }
        
        Ok(tick_map)
    }
    
    pub fn get_pools(&self) -> &HashMap<String, PoolState> {
        &self.pools
    }
    
    fn get_token_symbol(&self, address: &Address) -> &str {
        if address == &self.config.hype_address {
            "HYPE"
        } else if address == &self.config.ubtc_address {
            "uBTC"
        } else if address == &self.config.ueth_address {
            "uETH"
        } else if address == &self.config.usdt_address {
            "USDT"
        } else {
            "UNKNOWN"
        }
    }
    
    /// Subscribe to pool events via WebSocket
    pub async fn subscribe_to_pool_updates(&self) -> Result<()> {
        // TODO: Subscribe to Swap events on all pools
        // This will be implemented to update pool state in real-time
        info!("Pool update subscription - TODO");
        Ok(())
    }
}
