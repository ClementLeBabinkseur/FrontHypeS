function LiquidWalletSection({ wallet, balances }) {
  // Filtrer pour les 4 tokens requis
  const displayTokens = ['HYPE', 'ETH', 'BTC', 'USDC']
  const tokenBalances = balances?.balances?.filter(b => 
    displayTokens.includes(b.token)
  ) || []

  // Emojis pour les tokens
  const tokenEmojis = {
    'HYPE': '🟡',
    'ETH': '⚪',
    'BTC': '🟠',
    'USDC': '🟢'
  }
  
  console.log("Token recu: ",balances)

  return (
    <div className="mt-8 bg-[#0a0a0a] rounded-lg p-6">
      <h2 className="text-xl font-bold text-white mb-6">liquid wallet balance</h2>
      
      <div className="space-y-1">
        {/* Header */}
        <div className="grid grid-cols-2 gap-4 pb-3 border-b border-[#1a1a1a]">
          <div className="text-sm text-gray-500 uppercase">Asset</div>
          <div className="text-sm text-gray-500 uppercase text-right">Balance</div>
        </div>

        {/* Tokens */}
        {!balances ? (
          <div className="py-8 text-center text-gray-500">
            Click the refresh button above to load balances
          </div>
        ) : tokenBalances.length > 0 ? (
          tokenBalances.map((token, idx) => (
            <div key={idx} className="grid grid-cols-2 gap-4 py-4 hover:bg-white/5 transition-colors rounded-lg px-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#1a1a1a] rounded-full flex items-center justify-center text-2xl">
                  {tokenEmojis[token.token] || '⚫'}
                </div>
                <div>
                  <div className="text-white font-bold">{token.token}</div>
                  <div className="text-sm text-gray-500">{token.token}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-white font-medium">
                  {parseFloat(token.balance).toLocaleString('en-US', { 
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 6 
                  })} {token.token}
                </div>
                {token.usdValue && (
                  <div className="text-sm text-gray-500">
                    ${token.usdValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="py-8 text-center text-gray-500">
            No tokens found
          </div>
        )}
      </div>
    </div>
  )
}

export default LiquidWalletSection