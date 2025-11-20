import { useState } from 'react'
import { RefreshCw, Settings, Trash2, ExternalLink, DollarSign } from 'lucide-react'
import TokenSelector from './TokenSelector'

function WalletWidget({ wallet, balances, onRefresh, onDelete, onUpdate }) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await onRefresh()
    setIsRefreshing(false)
  }

  const truncateAddress = (address) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const getBlockchainExplorer = () => {
    if (wallet.blockchain === 'hyperliquid') {
      return `https://app.hyperliquid.xyz/explorer/address/${wallet.address}`
    }
    return `https://etherscan.io/address/${wallet.address}`
  }

  // Filtrer les balances selon selectedTokens
  const displayBalances = balances?.balances?.filter(b => 
    wallet.selectedTokens?.includes(b.token) || wallet.selectedTokens?.includes('totalUSD')
  ) || []

  // Calculer le total USD si demandé
  const showTotalUSD = wallet.selectedTokens?.includes('totalUSD')
  const totalUSD = balances?.totalUSD

  return (
    <div className="glass rounded-2xl p-6 shadow-xl glow transition-all duration-300 hover:scale-[1.02]">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-xl font-bold text-white mb-1">
            {wallet.nickname}
          </h3>
          <div className="flex items-center gap-2">
            <a
              href={getBlockchainExplorer()}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-slate-400 hover:text-blue-400 transition-colors flex items-center gap-1"
            >
              {truncateAddress(wallet.address)}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${
            wallet.blockchain === 'hyperliquid' 
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
          }`}>
            {wallet.blockchain === 'hyperliquid' ? '⚡ Hyperliquid' : '🔷 Ethereum'}
          </span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="glass glass-hover p-2 rounded-lg transition-all"
            title="Refresh balances"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="glass glass-hover p-2 rounded-lg transition-all"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="glass glass-hover p-2 rounded-lg transition-all hover:bg-red-500/20 hover:border-red-500/50"
            title="Delete wallet"
          >
            <Trash2 className="w-4 h-4 text-red-400" />
          </button>
        </div>
      </div>

      {/* Tags */}
      {wallet.tags && wallet.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {wallet.tags.map(tag => (
            <span
              key={tag}
              className="px-3 py-1 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-full text-xs font-semibold text-blue-300"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700/50">
          <TokenSelector
            wallet={wallet}
            availableTokens={balances?.balances?.map(b => b.token) || []}
            onUpdate={onUpdate}
          />
        </div>
      )}

      {/* Balances */}
      <div className="space-y-3">
        {!balances ? (
          <div className="text-center py-8 text-slate-500">
            <RefreshCw className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Click refresh to load balances</p>
          </div>
        ) : balances.error ? (
          <div className="text-center py-8 text-red-400">
            <p className="text-sm">Error loading balances</p>
          </div>
        ) : displayBalances.length === 0 && !showTotalUSD ? (
          <div className="text-center py-8 text-slate-500">
            <p className="text-sm">No tokens selected</p>
            <button
              onClick={() => setShowSettings(true)}
              className="mt-2 text-xs text-blue-400 hover:text-blue-300"
            >
              Configure tokens
            </button>
          </div>
        ) : (
          <>
            {displayBalances.map((balance, idx) => (
              balance.token !== 'totalUSD' && (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg border border-slate-700/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center font-bold text-sm">
                      {balance.token.slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{balance.token}</p>
                      {balance.usdValue && (
                        <p className="text-xs text-slate-400">
                          ${balance.usdValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-white">
                      {parseFloat(balance.balance).toLocaleString('en-US', { 
                        maximumFractionDigits: 6,
                        minimumFractionDigits: 2 
                      })}
                    </p>
                  </div>
                </div>
              )
            ))}

            {/* Total USD */}
            {showTotalUSD && totalUSD !== null && totalUSD !== undefined && (
              <div className="mt-4 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-blue-400" />
                    <span className="font-semibold text-slate-300">Total Value</span>
                  </div>
                  <span className="text-2xl font-bold gradient-text">
                    ${totalUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Last Updated */}
      {balances?.timestamp && (
        <div className="mt-4 pt-4 border-t border-slate-700/50 text-xs text-slate-500 text-center">
          Updated: {new Date(balances.timestamp).toLocaleTimeString()}
        </div>
      )}
    </div>
  )
}

export default WalletWidget