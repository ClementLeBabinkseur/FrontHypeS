# main.py
import os
import math
from web3 import Web3
from typing import List, Tuple, Dict, Any
from dataclasses import dataclass, field

# ---------- Constantes (adaptables) ----------
TRADE_AMOUNT_USDT: float = 150000.0  # montant cible en USDT
SLIPPAGE_MAX: float = 0.002  # 0.2% (note : dans le Rust c'était 0.002 = 0.2%)
MAX_TICKS = 1000

# Par défaut (remplace via env vars si tu veux)
DEFAULT_RPC = os.environ.get("RPC_URL", "https://rpc.hyperliquid.xyz/evm")
#DEFAULT_POOL = os.environ.get("POOL_ADDRESS", "0xBd19E19E4b70eB7F248695a42208bc1EdBBFb57D")  # HYPE/USDT
DEFAULT_POOL = os.environ.get("POOL_ADDRESS", "0x3603ffebb994cc110b4186040cac3005b2cf4465")  # HYPE/USDT Hybra
# ---------- ABIs (simplifiés — uniquement fonctions utilisées) ----------
UNIV3_POOL_ABI = [
    {
        "inputs": [],
        "name": "slot0",
        "outputs": [
            {"internalType": "uint160", "name": "sqrtPriceX96", "type": "uint160"},
            {"internalType": "int24", "name": "tick", "type": "int24"},
            {"internalType": "uint16", "name": "observationIndex", "type": "uint16"},
            {"internalType": "uint16", "name": "observationCardinality", "type": "uint16"},
            {"internalType": "uint16", "name": "observationCardinalityNext", "type": "uint16"},
            {"internalType": "uint8", "name": "feeProtocol", "type": "uint8"},
            {"internalType": "bool", "name": "unlocked", "type": "bool"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "int24", "name": "tick", "type": "int24"}],
        "name": "ticks",
        "outputs": [
            {"internalType": "uint128", "name": "liquidityGross", "type": "uint128"},
            {"internalType": "int128", "name": "liquidityNet", "type": "int128"},
            {"internalType": "uint256", "name": "feeGrowthOutside0X128", "type": "uint256"},
            {"internalType": "uint256", "name": "feeGrowthOutside1X128", "type": "uint256"},
            {"internalType": "int56", "name": "tickCumulativeOutside", "type": "int56"},
            {"internalType": "uint160", "name": "secondsPerLiquidityOutsideX128", "type": "uint160"},
            {"internalType": "uint32", "name": "secondsOutside", "type": "uint32"},
            {"internalType": "bool", "name": "initialized", "type": "bool"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "tickSpacing",
        "outputs": [{"internalType": "int24", "name": "", "type": "int24"}],
        "stateMutability": "view",
        "type": "function",
    },
    {"inputs": [], "name": "liquidity", "outputs": [{"internalType": "uint128", "name": "", "type": "uint128"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "token0", "outputs": [{"internalType": "address", "name": "", "type": "address"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "token1", "outputs": [{"internalType": "address", "name": "", "type": "address"}], "stateMutability": "view", "type": "function"},
]

ERC20_ABI = [
    {"inputs": [], "name": "decimals", "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "symbol", "outputs": [{"internalType": "string", "name": "", "type": "string"}], "stateMutability": "view", "type": "function"},
]

# ---------- Data classes ----------
@dataclass
class TickData:
    tick: int
    price: float
    liquidity_gross: int
    liquidity_net: int
    amount_token0: float
    amount_token1: float
    tvl_usd: float

@dataclass
class LiquidityAnalysis:
    cumulated_tvl: int
    start_tick: int
    end_tick: int
    start_price: float
    end_price: float
    current_price: float
    ticks_explored: List[TickData] = field(default_factory=list)
    trade_amount_filled: float = 0.0
    average_execution_price: float = 0.0
    trade_slippage: float = 0.0

# ---------- Math / helper functions ----------
def tick_to_price(tick: int, decimal0: int, decimal1: int) -> float:
    base = 1.0001
    raw_price = base ** tick if tick >= 0 else 1.0 / (base ** (-tick))
    decimal_adjustment = 10 ** (decimal0 - decimal1)
    return raw_price * decimal_adjustment

def tick_to_raw_price(tick: int) -> float:
    base = 1.0001
    return base ** tick if tick >= 0 else 1.0 / (base ** (-tick))

def sqrt_price_x96_to_price(sqrt_price_x96: int, decimal0: int, decimal1: int) -> float:
    q96 = 2 ** 96
    sqrt_price = float(sqrt_price_x96) / q96
    raw_price = sqrt_price * sqrt_price
    decimal_adjustment = 10 ** (decimal0 - decimal1)
    return raw_price * decimal_adjustment

def calculate_token_amounts_from_ticks(liquidity: int, tick_lower: int, tick_upper: int, decimal0: int, decimal1: int) -> Tuple[float, float]:
    if liquidity == 0 or tick_upper == tick_lower:
        return 0.0, 0.0
    liquidity_f = float(liquidity)
    price_lower = tick_to_raw_price(tick_lower)
    price_upper = tick_to_raw_price(tick_upper)
    sqrt_price_lower = math.sqrt(price_lower)
    sqrt_price_upper = math.sqrt(price_upper)
    sqrt_diff = sqrt_price_upper - sqrt_price_lower
    if sqrt_price_lower * sqrt_price_upper == 0:
        amount0_raw = 0.0
    else:
        amount0_raw = liquidity_f * sqrt_diff / (sqrt_price_lower * sqrt_price_upper)
    amount1_raw = liquidity_f * sqrt_diff
    amount0 = amount0_raw / (10 ** decimal0)
    amount1 = amount1_raw / (10 ** decimal1)
    return amount0, amount1

def align_tick_to_spacing(tick: int, tick_spacing: int) -> int:
    # floor division preserving negatives correctly
    q = math.floor(tick / tick_spacing)
    return int(q * tick_spacing)

# ---------- Core parsing / simulation (upward) ----------
def parse_liquidity_upward(
    w3: Web3,
    pool_contract,
    current_tick: int,
    tick_spacing: int,
    decimal0: int,
    decimal1: int,
    symbol0: str,
    symbol1: str,
    current_liquidity: int,
    current_price: float,
) -> LiquidityAnalysis:
    ticks_explored: List[TickData] = []
    cumulated_tvl: int = 0
    start_price = tick_to_price(current_tick, decimal0, decimal1)
    tick_current = current_tick
    price_current = start_price
    active_liquidity = int(current_liquidity)
    trade_amount_filled = 0.0
    total_token0_bought = 0.0

    print(f"\n📊 Simulation de trade: achat de ${TRADE_AMOUNT_USDT:.2f} USDT de {symbol0}")
    print(f"Prix actuel de la pool: {current_price:.12f}")
    print(f"Tick aligné de départ: {current_tick} (prix: {start_price:.12f})")
    print(f"Liquidité active initiale: {active_liquidity}")
    print(f"Tick spacing: {tick_spacing}")
    print(f"Slippage max autorisé: {SLIPPAGE_MAX * 100.0:.3f}%\n")

    tick_count = 0
    while True:
        tick_count += 1
        if tick_count > MAX_TICKS:
            print(f"⚠️  Limite de sécurité atteinte ({MAX_TICKS} ticks). Arrêt.")
            break

        tick_next = tick_current + tick_spacing
        price_next = tick_to_price(tick_next, decimal0, decimal1)

        amount0_available, amount1_available = calculate_token_amounts_from_ticks(
            active_liquidity, tick_current, tick_next, decimal0, decimal1
        )
        usdt_value_in_range = amount1_available
        remaining_to_trade = TRADE_AMOUNT_USDT - trade_amount_filled
        usdt_to_trade_in_range = min(remaining_to_trade, usdt_value_in_range)

        liquidity_used_ratio = (usdt_to_trade_in_range / usdt_value_in_range) if usdt_value_in_range > 0 else 0.0
        token0_bought_in_range = amount0_available * liquidity_used_ratio

        avg_price_in_range = (price_current + price_next) / 2.0

        print(f"🔍 Tick {tick_current} → {tick_next}")
        print(f"   Prix range: {price_current:.12f} → {price_next:.12f}")
        print(f"   💧 Liquidité active: {active_liquidity}")
        total_tvl_in_range = (amount0_available * price_current) + amount1_available
        print(f"   💰 Montant {symbol0} disponible: {amount0_available:.6f} (≈ ${amount0_available * price_current:.2f})")
        print(f"   💰 Montant {symbol1} disponible: {amount1_available:.6f}")
        print(f"   💵 TVL disponible dans cette range: ${total_tvl_in_range:.2f}")
        print(f"   🔄 USDT tradé dans cette range: {usdt_to_trade_in_range:.2f}")
        print(f"   🔄 {symbol0} acheté dans cette range: {token0_bought_in_range:.6f}")

        trade_amount_filled += usdt_to_trade_in_range
        total_token0_bought += token0_bought_in_range

        average_execution_price = (trade_amount_filled / total_token0_bought) if total_token0_bought > 0 else current_price
        trade_slippage = (average_execution_price - current_price) / current_price if current_price != 0 else 0.0

        print(f"   📊 Trade cumulé: ${trade_amount_filled:.2f} / ${TRADE_AMOUNT_USDT:.2f}")
        print(f"   📊 Prix moyen d'exécution: {average_execution_price:.12f}")
        print(f"   📊 Slippage du trade: {trade_slippage * 100.0:.4f}%")

        # récupérer tick data on-chain
        try:
            tick_data = pool_contract.functions.ticks(tick_next).call()
            liquidity_gross = int(tick_data[0])
            liquidity_net = int(tick_data[1])
        except Exception as e:
            # Certains RPC peuvent refuser des reads pour ticks non initialisés ; on capture
            print(f"   ⚠️  Erreur lecture tick {tick_next}: {e}")
            liquidity_gross = 0
            liquidity_net = 0

        print(f"   📊 Tick {tick_next} - Gross: {liquidity_gross} | Net: {liquidity_net}")

        ticks_explored.append(TickData(
            tick=tick_next,
            price=price_next,
            liquidity_gross=liquidity_gross,
            liquidity_net=liquidity_net,
            amount_token0=token0_bought_in_range,
            amount_token1=usdt_to_trade_in_range,
            tvl_usd=usdt_to_trade_in_range,
        ))

        if trade_amount_filled >= TRADE_AMOUNT_USDT:
            print("   ✅ Montant cible atteint!")
            tick_current = tick_next
            price_current = price_next
            break

        if trade_slippage > SLIPPAGE_MAX:
            print("   ⚠️  Slippage max atteint! Arrêt du trade.")
            tick_current = tick_next
            price_current = price_next
            break

        # update active liquidity crossing the tick (liquidity_net sign indicates direction)
        if liquidity_net >= 0:
            active_liquidity = active_liquidity + liquidity_net
        else:
            active_liquidity = max(0, active_liquidity - (-liquidity_net))

        print(f"   ➡️  Nouvelle liquidité active: {active_liquidity}")

        cumulated_tvl += liquidity_gross

        tick_current = tick_next
        price_current = price_next
        print("")

    final_average_price = (trade_amount_filled / total_token0_bought) if total_token0_bought > 0 else current_price
    final_slippage = (final_average_price - current_price) / current_price if current_price != 0 else 0.0

    return LiquidityAnalysis(
        cumulated_tvl=cumulated_tvl,
        start_tick=current_tick,
        end_tick=tick_current,
        start_price=start_price,
        end_price=price_current,
        current_price=current_price,
        ticks_explored=ticks_explored,
        trade_amount_filled=trade_amount_filled,
        average_execution_price=final_average_price,
        trade_slippage=final_slippage,
    )

# ---------- Main ----------
def main():
    rpc_url = os.environ.get("RPC_URL", DEFAULT_RPC)
    pool_address = os.environ.get("POOL_ADDRESS", DEFAULT_POOL)
    w3 = Web3(Web3.HTTPProvider(rpc_url))

    print("🔌 Connexion au RPC...")
    print("✅ Connected:", w3.is_connected())
    try:
        print("Current block:", w3.eth.block_number)
    except Exception as e:
        print("Warning cannot fetch block number:", e)

    pool_addr = Web3.to_checksum_address(pool_address)
    pool_contract = w3.eth.contract(address=pool_addr, abi=UNIV3_POOL_ABI)

    print(f"\n📡 Récupération des informations de la pool {pool_addr}...\n")
    try:
        token0_addr = pool_contract.functions.token0().call()
        token1_addr = pool_contract.functions.token1().call()
        print(f"Token0 address: {token0_addr}")
        print(f"Token1 address: {token1_addr}")
    except Exception as e:
        print("❌ Erreur récupération token0/token1:", e)
        # Afficher aussi le code du réseau / chain id pour diagnostiquer
        try:
            print("Chain ID:", w3.eth.chain_id)
        except:
            pass
        return

    token0 = w3.eth.contract(address=Web3.to_checksum_address(token0_addr), abi=ERC20_ABI)
    token1 = w3.eth.contract(address=Web3.to_checksum_address(token1_addr), abi=ERC20_ABI)

    try:
        decimal0 = int(token0.functions.decimals().call())
        decimal1 = int(token1.functions.decimals().call())
    except Exception as e:
        print("Erreur récupération decimals (utilisation de 18 par défaut):", e)
        decimal0 = 18
        decimal1 = 18

    try:
        symbol0 = token0.functions.symbol().call()
    except Exception:
        symbol0 = "TOKEN0"
    try:
        symbol1 = token1.functions.symbol().call()
    except Exception:
        symbol1 = "TOKEN1"

    print(f"🪙 Token0: {symbol0} (decimals: {decimal0})")
    print(f"🪙 Token1: {symbol1} (decimals: {decimal1})\n")

    # slot0
    try:
        slot0 = pool_contract.functions.slot0().call()
        sqrt_price_x96 = int(slot0[0])
        current_tick = int(slot0[1])
    except Exception as e:
        print("Erreur slot0():", e)
        return

    try:
        tick_spacing = int(pool_contract.functions.tickSpacing().call())
    except Exception as e:
        print("Erreur tickSpacing():", e)
        tick_spacing = 60  # fallback

    try:
        current_liquidity = int(pool_contract.functions.liquidity().call())
    except Exception as e:
        print("Erreur liquidity():", e)
        current_liquidity = 0

    aligned_tick = align_tick_to_spacing(current_tick, tick_spacing)
    current_price = sqrt_price_x96_to_price(sqrt_price_x96, decimal0, decimal1)

    try:
        gas_price = w3.eth.gas_price
        gas_price_wei = int(gas_price)
        gas_price_gwei = gas_price_wei / 1_000_000_000.0
        gas_price_hype = gas_price_gwei / 1_000_000_000.0
    except Exception:
        gas_price_wei = gas_price_gwei = gas_price_hype = 0.0

    print("═══════════════════════════════════════")
    print(f"📊 État actuel de la pool {symbol0}/{symbol1}")
    print("═══════════════════════════════════════")
    print(f"Tick actuel (brut): {current_tick}")
    print(f"Tick aligné (spacing={tick_spacing}): {aligned_tick}")
    print(f"Prix actuel: {current_price:.12f} {symbol1} per {symbol0}")
    print(f"Liquidité totale: {current_liquidity}")
    print(f"Tick spacing: {tick_spacing}")
    print("═══════════════════════════════════════")
    print("⛽ Gas price:")
    print(f"   Wei:  {gas_price_wei:.0f}")
    print(f"   Gwei: {gas_price_gwei:.6f}")
    print(f"   HYPE: {gas_price_hype:.12f}")
    print("═══════════════════════════════════════\n")

    analysis = parse_liquidity_upward(
        w3=w3,
        pool_contract=pool_contract,
        current_tick=aligned_tick,
        tick_spacing=tick_spacing,
        decimal0=decimal0,
        decimal1=decimal1,
        symbol0=symbol0,
        symbol1=symbol1,
        current_liquidity=current_liquidity,
        current_price=current_price,
    )

    print("\n═══════════════════════════════════════")
    print("📈 Résultats de la simulation de trade")
    print("═══════════════════════════════════════")
    print(f"Montant cible: ${TRADE_AMOUNT_USDT:.2f} USDT")
    print(f"Montant tradé: ${analysis.trade_amount_filled:.2f} USDT")
    completion_pct = (analysis.trade_amount_filled / TRADE_AMOUNT_USDT) * 100.0 if TRADE_AMOUNT_USDT != 0 else 0.0
    print(f"Complétion du trade: {completion_pct:.2f}%")

    print("\n💰 Résultats du trade:")
    print(f"   Prix actuel de la pool: {analysis.current_price:.12f}")
    print(f"   Prix moyen d'exécution: {analysis.average_execution_price:.12f}")
    print(f"   Slippage du trade: {analysis.trade_slippage * 100.0:.4f}%")

    total_hype_bought = sum(t.amount_token0 for t in analysis.ticks_explored)
    total_usdt_spent = sum(t.amount_token1 for t in analysis.ticks_explored)

    print("\n📊 Détails du trade:")
    print(f"   {symbol0} acheté: {total_hype_bought:.6f}")
    print(f"   {symbol1} dépensé: {total_usdt_spent:.2f}")
    print(f"   Nombre de ticks traversés: {len(analysis.ticks_explored)}")
    print(f"   Ticks: {analysis.start_tick} → {analysis.end_tick}")
    print(f"   Prix range: {analysis.start_price:.12f} → {analysis.end_price:.12f}")

    if analysis.trade_amount_filled >= TRADE_AMOUNT_USDT:
        print("\n✅ Trade complété avec succès!")
    elif abs(analysis.trade_slippage) > SLIPPAGE_MAX:
        print("\n⚠️  Trade stoppé: slippage max atteint")
    else:
        print("\n⚠️  Trade incomplet")
    print("═══════════════════════════════════════\n")


if __name__ == "__main__":
    main()
