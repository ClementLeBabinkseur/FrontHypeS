use ethers::prelude::*;
use anyhow::Result;
use std::sync::Arc;

// Adresse pool PRJX : 0xBd19E19E4b70eB7F248695a42208bc1EdBBFb57D
// USDT / HYPE

// ABI simplifié pour Uniswap V3 Pool
abigen!(
    IUniswapV3Pool,
    r#"[
        function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)
        function ticks(int24 tick) external view returns (uint128 liquidityGross, int128 liquidityNet, uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128, int56 tickCumulativeOutside, uint160 secondsPerLiquidityOutsideX128, uint32 secondsOutside, bool initialized)
        function tickSpacing() external view returns (int24)
        function liquidity() external view returns (uint128)
        function token0() external view returns (address)
        function token1() external view returns (address)
    ]"#
);

// ABI pour ERC20 (récupérer les décimales)
abigen!(
    IERC20,
    r#"[
        function decimals() external view returns (uint8)
        function symbol() external view returns (string)
    ]"#
);

const TRADE_AMOUNT_USDT: f64 = 150000.0; // Montant à trader en USDT (modifiable)
const SLIPPAGE_MAX: f64 = 0.002; // 0.5% - Limite de slippage pour le trade

#[derive(Debug)]
pub struct TickData {
    pub tick: i32,
    pub price: f64,
    pub liquidity_gross: u128,
    pub liquidity_net: i128,
    pub amount_token0: f64,
    pub amount_token1: f64,
    pub tvl_usd: f64,
}

#[derive(Debug)]
pub struct LiquidityAnalysis {
    pub cumulated_tvl: u128,
    pub start_tick: i32,
    pub end_tick: i32,
    pub start_price: f64,
    pub end_price: f64,
    pub current_price: f64, // Prix actuel de la pool
    pub ticks_explored: Vec<TickData>,
    pub trade_amount_filled: f64, // Montant en USDT tradé
    pub average_execution_price: f64, // Prix moyen d'exécution
    pub trade_slippage: f64, // Slippage du trade (en fraction, pas %)
}

/// Calcule le prix à partir d'un tick avec ajustement des décimales
/// price = 1.0001^tick * 10^(decimal0 - decimal1)
fn tick_to_price(tick: i32, decimal0: i32, decimal1: i32) -> f64 {
    let base = 1.0001_f64;
    let raw_price = if tick >= 0 {
        base.powi(tick)
    } else {
        1.0 / base.powi(-tick)
    };
    
    // Ajustement pour les décimales
    let decimal_adjustment = 10_f64.powi(decimal0 - decimal1);
    raw_price * decimal_adjustment
}

/// Calcule le prix à partir de sqrtPriceX96 avec ajustement des décimales
fn sqrt_price_x96_to_price(sqrt_price_x96: U256, decimal0: i32, decimal1: i32) -> f64 {
    let q96 = 2_f64.powi(96);
    let sqrt_price = sqrt_price_x96.as_u128() as f64 / q96;
    let raw_price = sqrt_price * sqrt_price;
    
    // Ajustement pour les décimales
    let decimal_adjustment = 10_f64.powi(decimal0 - decimal1);
    raw_price * decimal_adjustment
}

/// Calcule le prix BRUT à partir d'un tick (sans ajustement de décimales)
/// Ce prix est utilisé pour les calculs de liquidité
fn tick_to_raw_price(tick: i32) -> f64 {
    let base = 1.0001_f64;
    if tick >= 0 {
        base.powi(tick)
    } else {
        1.0 / base.powi(-tick)
    }
}

/// Calcule les montants de tokens pour une liquidité donnée entre deux ticks
/// Utilise les prix BRUTS (sans ajustement décimal) pour les calculs Uniswap V3
/// Returns (amount_token0, amount_token1) en unités lisibles
fn calculate_token_amounts_from_ticks(
    liquidity: u128,
    tick_lower: i32,
    tick_upper: i32,
    decimal0: i32,
    decimal1: i32,
) -> (f64, f64) {
    if liquidity == 0 {
        return (0.0, 0.0);
    }
    
    let liquidity_f64 = liquidity as f64;
    
    // Utiliser les prix BRUTS pour les calculs (sans ajustement décimal)
    let price_lower = tick_to_raw_price(tick_lower);
    let price_upper = tick_to_raw_price(tick_upper);
    
    let sqrt_price_lower = price_lower.sqrt();
    let sqrt_price_upper = price_upper.sqrt();
    
    // Formules Uniswap V3 pour une range de liquidité :
    // amount0 = L × (√P_upper - √P_lower) / (√P_lower × √P_upper)
    // amount1 = L × (√P_upper - √P_lower)
    
    let sqrt_diff = sqrt_price_upper - sqrt_price_lower;
    
    let amount0_raw = liquidity_f64 * sqrt_diff / (sqrt_price_lower * sqrt_price_upper);
    let amount1_raw = liquidity_f64 * sqrt_diff;
    
    // Ajuster pour les décimales (passer de wei à unités lisibles)
    let amount0 = amount0_raw / 10_f64.powi(decimal0);
    let amount1 = amount1_raw / 10_f64.powi(decimal1);
    
    (amount0, amount1)
}

async fn parse_liquidity_upward(
    pool: &IUniswapV3Pool<Provider<Http>>,
    current_tick: i32,
    tick_spacing: i32,
    decimal0: i32,
    decimal1: i32,
    symbol0: &str,
    symbol1: &str,
    current_liquidity: u128,
    current_price: f64, // Prix actuel de la pool (depuis sqrtPriceX96)
) -> Result<LiquidityAnalysis> {
    let mut ticks_explored = Vec::new();
    let mut cumulated_tvl: u128 = 0;
    
    let start_price = tick_to_price(current_tick, decimal0, decimal1);
    let mut tick_current = current_tick;
    let mut price_current = start_price;
    
    // Tracker la liquidité active au fur et à mesure
    let mut active_liquidity = current_liquidity;
    
    // Variables pour simuler le trade
    let mut trade_amount_filled = 0.0; // USDT dépensés
    let mut total_token0_bought = 0.0; // HYPE achetés
    
    println!("\n📊 Simulation de trade: achat de ${:.2} USDT de HYPE", TRADE_AMOUNT_USDT);
    println!("Prix actuel de la pool: {:.10}", current_price);
    println!("Tick aligné de départ: {} (prix: {:.10})", current_tick, start_price);
    println!("Liquidité active initiale: {}", active_liquidity);
    println!("Tick spacing: {}", tick_spacing);
    println!("Slippage max autorisé: {}%\n", SLIPPAGE_MAX * 100.0);
    
    // Limite de sécurité pour éviter les boucles infinies
    const MAX_TICKS: usize = 1000;
    let mut tick_count = 0;
    
    loop {
        tick_count += 1;
        if tick_count > MAX_TICKS {
            println!("⚠️  Limite de sécurité atteinte ({} ticks). Arrêt du parsing.", MAX_TICKS);
            break;
        }
        
        // Calculer le prochain tick
        let tick_next = tick_current + tick_spacing;
        let price_next = tick_to_price(tick_next, decimal0, decimal1);
        
        // Calculer les montants de tokens disponibles dans cette range
        let (amount0_available, amount1_available) = calculate_token_amounts_from_ticks(
            active_liquidity,
            tick_current,
            tick_next,
            decimal0,
            decimal1,
        );
        
        // Calculer combien d'USDT on peut trader dans cette range
        let usdt_value_in_range = amount1_available;
        
        // Calculer combien d'USDT on va effectivement trader dans cette range
        let remaining_to_trade = TRADE_AMOUNT_USDT - trade_amount_filled;
        let usdt_to_trade_in_range = remaining_to_trade.min(usdt_value_in_range);
        
        // Proportion de la liquidité utilisée
        let liquidity_used_ratio = if usdt_value_in_range > 0.0 {
            usdt_to_trade_in_range / usdt_value_in_range
        } else {
            0.0
        };
        
        // HYPE acheté dans cette range (proportionnel à la liquidité utilisée)
        let token0_bought_in_range = amount0_available * liquidity_used_ratio;
        
        // Prix moyen dans cette range
        let avg_price_in_range = (price_current + price_next) / 2.0;
        
        println!("🔍 Tick {} → {}", tick_current, tick_next);
        println!("   Prix range: {:.10} → {:.10}", price_current, price_next);
        println!("   💧 Liquidité active: {}", active_liquidity);
        
        // Afficher les montants totaux disponibles dans cette range
        let total_tvl_in_range = (amount0_available * price_current) + amount1_available;
        println!("   💰 Montant {} disponible: {:.6} (≈ ${:.2})", symbol0, amount0_available, amount0_available * price_current);
        println!("   💰 Montant {} disponible: {:.6}", symbol1, amount1_available);
        println!("   💵 TVL disponible dans cette range: ${:.2}", total_tvl_in_range);
        
        // Afficher le trade simulé
        println!("   🔄 USDT tradé dans cette range: {:.2}", usdt_to_trade_in_range);
        println!("   🔄 HYPE acheté dans cette range: {:.6}", token0_bought_in_range);
        
        // Mettre à jour les compteurs du trade
        trade_amount_filled += usdt_to_trade_in_range;
        total_token0_bought += token0_bought_in_range;
        
        // Calculer le prix moyen d'exécution actuel
        let average_execution_price = if total_token0_bought > 0.0 {
            trade_amount_filled / total_token0_bought
        } else {
            current_price
        };
        
        // Calculer le slippage du trade
        let trade_slippage = (average_execution_price - current_price) / current_price;
        
        println!("   📊 Trade cumulé: ${:.2} / ${:.2}", trade_amount_filled, TRADE_AMOUNT_USDT);
        println!("   📊 Prix moyen d'exécution: {:.10}", average_execution_price);
        println!("   📊 Slippage du trade: {:.4}%", trade_slippage * 100.0);
        
        // Récupérer les données du tick pour l'affichage
        let tick_data = pool.ticks(tick_next).call().await?;
        let liquidity_gross = tick_data.0;
        let liquidity_net = tick_data.1;
        
        println!("   📊 Tick {} - Gross: {} | Net: {}", tick_next, liquidity_gross, liquidity_net);
        
        // Vérifier si on a atteint le montant cible
        if trade_amount_filled >= TRADE_AMOUNT_USDT {
            println!("   ✅ Montant cible atteint!");
            
            ticks_explored.push(TickData {
                tick: tick_next,
                price: price_next,
                liquidity_gross,
                liquidity_net,
                amount_token0: token0_bought_in_range,
                amount_token1: usdt_to_trade_in_range,
                tvl_usd: usdt_to_trade_in_range,
            });
            
            tick_current = tick_next;
            price_current = price_next;
            break;
        }
        
        // Vérifier le slippage
        if trade_slippage.abs() > SLIPPAGE_MAX {
            println!("   ⚠️  Slippage max atteint! Arrêt du trade.");
            
            ticks_explored.push(TickData {
                tick: tick_next,
                price: price_next,
                liquidity_gross,
                liquidity_net,
                amount_token0: token0_bought_in_range,
                amount_token1: usdt_to_trade_in_range,
                tvl_usd: usdt_to_trade_in_range,
            });
            
            tick_current = tick_next;
            price_current = price_next;
            break;
        }
        
        // Mettre à jour la liquidité active en traversant le tick
        if liquidity_net >= 0 {
            active_liquidity = active_liquidity.saturating_add(liquidity_net as u128);
        } else {
            active_liquidity = active_liquidity.saturating_sub((-liquidity_net) as u128);
        }
        
        println!("   ➡️  Nouvelle liquidité active: {}", active_liquidity);
        
        cumulated_tvl = cumulated_tvl.saturating_add(liquidity_gross);
        
        ticks_explored.push(TickData {
            tick: tick_next,
            price: price_next,
            liquidity_gross,
            liquidity_net,
            amount_token0: token0_bought_in_range,
            amount_token1: usdt_to_trade_in_range,
            tvl_usd: usdt_to_trade_in_range,
        });
        
        // Passer au tick suivant
        tick_current = tick_next;
        price_current = price_next;
        
        println!("");
    }
    
    // Calculer le prix moyen final
    let final_average_price = if total_token0_bought > 0.0 {
        trade_amount_filled / total_token0_bought
    } else {
        current_price
    };
    
    let final_slippage = (final_average_price - current_price) / current_price;
    
    Ok(LiquidityAnalysis {
        cumulated_tvl,
        start_tick: current_tick,
        end_tick: tick_current,
        start_price,
        end_price: price_current,
        current_price,
        ticks_explored,
        trade_amount_filled,
        average_execution_price: final_average_price,
        trade_slippage: final_slippage,
    })
}

#[tokio::main]
async fn main() -> Result<()> {
    println!("🚀 AMM V3 Tick Parser - HyperEVM\n");
    
    // Configuration
    let rpc_url = std::env::var("ALCHEMY_RPC_URL")
        .expect("ALCHEMY_RPC_URL doit être défini dans les variables d'environnement");
    
    // Adresse de la pool HYPE/USDT sur Project X
    let pool_address = std::env::var("POOL_ADDRESS")
        .unwrap_or_else(|_| {
            println!("⚠️  POOL_ADDRESS non défini, utilisation d'une adresse exemple");
            "0x0000000000000000000000000000000000000000".to_string()
        });
    
    let pool_address: Address = pool_address.parse()?;
    
    // Connexion au provider
    println!("🔌 Connexion au RPC...");
    let provider = Provider::<Http>::try_from(rpc_url)?;
    let provider = Arc::new(provider);
    
    // Créer l'instance du contrat
    let pool = IUniswapV3Pool::new(pool_address, provider.clone());
    
    // Récupérer les adresses des tokens
    println!("📡 Récupération des informations de la pool {}...\n", pool_address);
    let token0_address = pool.token_0().call().await?;
    let token1_address = pool.token_1().call().await?;
    
    // Créer les instances des tokens pour récupérer les décimales
    let token0 = IERC20::new(token0_address, provider.clone());
    let token1 = IERC20::new(token1_address, provider.clone());
    
    let decimal0 = token0.decimals().call().await? as i32;
    let decimal1 = token1.decimals().call().await? as i32;
    let symbol0 = token0.symbol().call().await?;
    let symbol1 = token1.symbol().call().await?;
    
    println!("🪙 Token0: {} (decimals: {})", symbol0, decimal0);
    println!("🪙 Token1: {} (decimals: {})", symbol1, decimal1);
    println!("");
    
    // Récupérer les données actuelles de la pool
    let slot0 = pool.slot_0().call().await?;
    let sqrt_price_x96 = slot0.0;
    let current_tick = slot0.1;
    let tick_spacing = pool.tick_spacing().call().await?;
    let current_liquidity = pool.liquidity().call().await?;
    
    // Aligner le tick au tick spacing (CRITIQUE pour trouver les ticks initialisés)
    // Utiliser floor() pour gérer correctement les ticks négatifs
    let aligned_tick = (((current_tick as f64) / (tick_spacing as f64)).floor() as i32) * tick_spacing;
    
    let current_price = sqrt_price_x96_to_price(sqrt_price_x96, decimal0, decimal1);
    
    // Récupérer le gas price
    println!("🔍 Récupération du gas price...");
    let gas_price = provider.get_gas_price().await?;
    let gas_price_wei = gas_price.as_u128() as f64;
    let gas_price_gwei = gas_price_wei / 1_000_000_000.0;
    let gas_price_hype = gas_price_gwei / 1_000_000_000.0;
    
    println!("═══════════════════════════════════════");
    println!("📊 État actuel de la pool {}/{}", symbol0, symbol1);
    println!("═══════════════════════════════════════");
    println!("Tick actuel (brut): {}", current_tick);
    println!("Tick aligné (spacing={}): {}", tick_spacing, aligned_tick);
    println!("Prix actuel: {:.10} {} per {}", current_price, symbol1, symbol0);
    //println!("Prix (depuis tick aligné): {:.10}", tick_to_price(aligned_tick as i32, decimal0, decimal1));
    println!("Liquidité totale: {}", current_liquidity);
    println!("Tick spacing: {}", tick_spacing);
    println!("═══════════════════════════════════════");
    println!("⛽ Gas price:");
    println!("   Wei:  {:.0}", gas_price_wei);
    println!("   Gwei: {:.6}", gas_price_gwei);
    println!("   HYPE: {:.12}", gas_price_hype);
    println!("═══════════════════════════════════════\n");
    
    // Parser les ticks à la hausse depuis le tick ALIGNÉ jusqu'au slippage max
    let analysis = parse_liquidity_upward(
        &pool,
        aligned_tick as i32,
        tick_spacing as i32,
        decimal0,
        decimal1,
        &symbol0,
        &symbol1,
        current_liquidity,
        current_price, // Prix actuel de la pool
    ).await?;
    
    // Afficher les résultats
    println!("\n═══════════════════════════════════════");
    println!("📈 Résultats de la simulation de trade");
    println!("═══════════════════════════════════════");
    println!("Montant cible: ${:.2} USDT", TRADE_AMOUNT_USDT);
    println!("Montant tradé: ${:.2} USDT", analysis.trade_amount_filled);
    
    let completion_pct = (analysis.trade_amount_filled / TRADE_AMOUNT_USDT) * 100.0;
    println!("Complétion du trade: {:.2}%", completion_pct);
    
    println!("\n💰 Résultats du trade:");
    println!("   Prix actuel de la pool: {:.10}", analysis.current_price);
    println!("   Prix moyen d'exécution: {:.10}", analysis.average_execution_price);
    println!("   Slippage du trade: {:.4}%", analysis.trade_slippage * 100.0);
    
    // Calculer les montants totaux
    let total_hype_bought: f64 = analysis.ticks_explored.iter().map(|t| t.amount_token0).sum();
    let total_usdt_spent: f64 = analysis.ticks_explored.iter().map(|t| t.amount_token1).sum();
    
    println!("\n📊 Détails du trade:");
    println!("   {} acheté: {:.6}", symbol0, total_hype_bought);
    println!("   {} dépensé: {:.2}", symbol1, total_usdt_spent);
    println!("   Nombre de ticks traversés: {}", analysis.ticks_explored.len());
    println!("   Ticks: {} → {}", analysis.start_tick, analysis.end_tick);
    println!("   Prix range: {:.10} → {:.10}", analysis.start_price, analysis.end_price);
    
    // Statut du trade
    if analysis.trade_amount_filled >= TRADE_AMOUNT_USDT {
        println!("\n✅ Trade complété avec succès!");
    } else if analysis.trade_slippage.abs() > SLIPPAGE_MAX {
        println!("\n⚠️  Trade stoppé: slippage max atteint");
    } else {
        println!("\n⚠️  Trade incomplet");
    }
    
    println!("═══════════════════════════════════════\n");
    
    Ok(())
}