import { useState } from 'react'
import { RefreshCw, Settings, Trash2, ExternalLink } from 'lucide-react'
import TokenSelector from './TokenSelector'

function WalletWidgetLine({ wallet, balances, onRefresh, onDelete, onUpdate }) {
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
    if (wallet.blockchain === 'hyperevm') {
      return `https://explorer.hyperliquid.xyz/address/${wallet.address}`
    }
    return `https://etherscan.io/address/${wallet.address}`
  }

  // Obtenir le premier token sélectionné (ou totalUSD)
  const displayToken = wallet.selectedTokens?.includes('totalUSD')
    ? { token: 'totalUSD', balance: balances?.totalUSD, usdValue: balances?.totalUSD }
    : balances?.balances?.find(b => wallet.selectedTokens?.includes(b.token)) || null

  return (
    <>
      <div className="glass rounded-xl p-4 shadow-lg glow transition-all duration-300 hover:scale-[1.01] flex items-center justify-between gap-4">
        {/* Left: Wallet Info */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Blockchain Badge */}
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            wallet.blockchain === 'hyperliquid' 
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
          }`}>
            {wallet.blockchain === 'hyperliquid' ? '⚡' : '🔷'}
          </div>

          {/* Wallet Name & Address */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white truncate">
                {wallet.nickname}
              </h3>
              {wallet.tags && wallet.tags.length > 0 && (
                <div className="flex gap-1">
                  {wallet.tags.slice(0, 2).map(tag => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-full text-xs font-semibold text-blue-300"
                    >
                      #{tag}
                    </span>
                  ))}
                  {wallet.tags.length > 2 && (
                    <span className="px-2 py-0.5 text-xs text-slate-400">
                      +{wallet.tags.length - 2}
                    </span>
                  )}
                </div>
              )}
            </div>
            <a
              href={getBlockchainExplorer()}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-400 hover:text-blue-400 transition-colors flex items-center gap-1"
            >
              {truncateAddress(wallet.address)}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Right: Balance Display */}
        <div className="flex items-center gap-4">
          {!balances ? (
            <div className="text-slate-500 text-sm">
              Click refresh
            </div>
          ) : balances.error ? (
            <div className="text-red-400 text-sm">
              Error
            </div>
          ) : displayToken ? (
            <div className="text-right">
              {displayToken.token === 'totalUSD' ? (
                <>
                  <div className="text-xs text-slate-400">Total Value</div>
                  <div className="text-xl font-bold gradient-text">
                    ${displayToken.usdValue?.toLocaleString('en-US', { maximumFractionDigits: 2 }) || '0.00'}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-xs text-slate-400">{displayToken.token}</div>
                  <div className="text-lg font-bold text-white">
                    {parseFloat(displayToken.balance).toLocaleString('en-US', { 
                      maximumFractionDigits: 6,
                      minimumFractionDigits: 2 
                    })}
                  </div>
                  {displayToken.usdValue && (
                    <div className="text-xs text-slate-500">
                      ${displayToken.usdValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="text-slate-500 text-sm">
              No token
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 flex-shrink-0">
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
      </div>

      {/* Settings Panel (expanded below) */}
      {showSettings && (
        <div className="glass rounded-xl p-4 shadow-lg mt-2">
          <TokenSelector
            wallet={wallet}
            availableTokens={balances?.balances?.map(b => b.token) || []}
            onUpdate={onUpdate}
          />
        </div>
      )}
    </>
  )
}

export default WalletWidgetLine