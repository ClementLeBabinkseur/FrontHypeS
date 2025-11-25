import { RefreshCw, Trash2 } from 'lucide-react'
import { useState } from 'react'

function ExecutorSection({ wallets, balances, onRefresh, onDelete }) {
  const [refreshingIds, setRefreshingIds] = useState({})

  const handleRefresh = async (wallet) => {
    setRefreshingIds(prev => ({ ...prev, [wallet.id]: true }))
    await onRefresh(wallet)
    setRefreshingIds(prev => ({ ...prev, [wallet.id]: false }))
  }

  const truncateAddress = (address) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const getHypeBalance = (walletId) => {
    const balance = balances[walletId]
    if (!balance || !balance.balances) return null
    
    const hypeToken = balance.balances.find(b => b.token === 'HYPE')
    return hypeToken
  }

  return (
    <div className="mt-8 bg-[#0a0a0a] rounded-lg p-6">
      <h2 className="text-xl font-bold text-white mb-6">executor wallets</h2>
      
      <div className="space-y-2">
        {wallets.map(wallet => {
          const hypeBalance = getHypeBalance(wallet.id)
          const isRefreshing = refreshingIds[wallet.id]

          return (
            <div
              key={wallet.id}
              className="flex items-center justify-between py-4 px-4 hover:bg-white/5 transition-colors rounded-lg"
            >
              {/* Left: Name/Address */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#1a1a1a] rounded-full flex items-center justify-center text-xl">
                  🟡
                </div>
                <div>
                  <div className="text-white font-medium">
                    {wallet.nickname || truncateAddress(wallet.address)}
                  </div>
                  <div className="text-sm text-gray-500">
                    {truncateAddress(wallet.address)}
                  </div>
                </div>
              </div>

              {/* Right: Balance + Actions */}
              <div className="flex items-center gap-4">
                {!hypeBalance ? (
                  <button
                    onClick={() => handleRefresh(wallet)}
                    disabled={isRefreshing}
                    className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    Load balance
                  </button>
                ) : (
                  <div className="text-right">
                    <div className="text-white font-medium">
                      {parseFloat(hypeBalance.balance).toLocaleString('en-US', { 
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6 
                      })} HYPE
                    </div>
                    {hypeBalance.usdValue && (
                      <div className="text-sm text-gray-500">
                        ${hypeBalance.usdValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleRefresh(wallet)}
                    disabled={isRefreshing}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw className={`w-4 h-4 text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => onDelete(wallet.id)}
                    className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}

        {wallets.length === 0 && (
          <div className="py-8 text-center text-gray-500">
            No executor wallets
          </div>
        )}
      </div>
    </div>
  )
}

export default ExecutorSection