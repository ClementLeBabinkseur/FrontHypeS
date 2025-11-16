from web3 import Web3
import time

ALCHEMY_URL = "https://hyperliquid-mainnet.g.alchemy.com/v2/Em6bwd2PwavhDyNR35yUd"
w3 = Web3(Web3.HTTPProvider(ALCHEMY_URL))
assert w3.is_connected(), "Connexion échouée"

QUOTER = Web3.to_checksum_address("0x8CD6acfF822eE9E3240501b3CeDa64364791e4E2")

abi = [{
    "name": "quoteExactInputSingle",
    "type": "function",
    "inputs": [{
        "components": [
            {"name": "tokenIn", "type": "address"},
            {"name": "tokenOut", "type": "address"},
            {"name": "amountIn", "type": "uint256"},
            {"name": "tickSpacing", "type": "int24"},
            {"name": "sqrtPriceLimitX96", "type": "uint160"}
        ],
        "name": "params",
        "type": "tuple"
    }],
    "outputs": [
        {"name": "amountOut", "type": "uint256"},
        {"name": "sqrtPriceX96After", "type": "uint160"},
        {"name": "initializedTicksCrossed", "type": "uint32"},
        {"name": "gasEstimate", "type": "uint256"}
    ],
    "stateMutability": "nonpayable"
}]

quoter = w3.eth.contract(address=QUOTER, abi=abi)

WHYPE = Web3.to_checksum_address("0x5555555555555555555555555555555555555555")
USDT0 = Web3.to_checksum_address("0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb")

# Exemple : suppose WHYPE a 18 décimales
AMOUNT_IN = Web3.to_wei(800, "ether")  # 1 WHYPE
TICK_SPACING = 50  # à vérifier
SQRT_LIMIT = 0
params = (WHYPE, USDT0, AMOUNT_IN, TICK_SPACING, SQRT_LIMIT)


start = time.time()

(amountOut, sqrtPriceX96After, ticksCrossed, gasEstimate) = quoter.functions.quoteExactInputSingle(params).call()

end = time.time()
elapsed_ms = (end - start) * 1000
print(f"Temps d'exécution : {elapsed_ms:.2f} ms")

print(f"✅ Pour 1 WHYPE → environ {amountOut / 1e6:.2f} USD₮0 et on a traversé {ticksCrossed} tick")
gasEstimate = w3.from_wei(gasEstimate, "gwei")
print("Gas estimate:", gasEstimate)
