from web3 import Web3

# --- Connexion à ton endpoint Alchemy ---
ALCHEMY_URL = "https://eth-mainnet.g.alchemy.com/v2/Em6bwd2PwavhDyNR35yUd"
w3 = Web3(Web3.HTTPProvider(ALCHEMY_URL))
assert w3.is_connected(), "Connexion échouée"

# --- Contrat Quoter Uniswap V3 ---
QUOTER = Web3.to_checksum_address("0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6")

abi = [{
    "name": "quoteExactInputSingle",
    "type": "function",
    "inputs": [
        {"name": "tokenIn", "type": "address"},
        {"name": "tokenOut", "type": "address"},
        {"name": "fee", "type": "uint24"},
        {"name": "amountIn", "type": "uint256"},
        {"name": "sqrtPriceLimitX96", "type": "uint160"}
    ],
    "outputs": [{"name": "amountOut", "type": "uint256"}],
    "stateMutability": "view"
}]

# --- Paramètres ---
WETH = Web3.to_checksum_address("0xC02aaA39b223FE8D0A0E5C4F27eAD9083C756Cc2")
USDC = Web3.to_checksum_address("0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48")
FEE = 3000
AMOUNT_IN = Web3.to_wei(1, "ether")

quoter = w3.eth.contract(address=QUOTER, abi=abi)

# --- Simulation via eth_call ---
amount_out = quoter.functions.quoteExactInputSingle(
    WETH, USDC, FEE, AMOUNT_IN, 0
).call()

print(f"✅ Pour 1 ETH → environ {amount_out / 1e6:.2f} USDC")
