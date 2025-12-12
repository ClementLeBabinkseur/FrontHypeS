import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { Settings } from 'lucide-react'
import VaultSettingsModal from './VaultSettingsModal'

function VaultSection({ wallet, combinedBalances, pnlData, onRefresh, onSaveSettings }) {
  const [period, setPeriod] = useState('1D')
  const [chartData, setChartData] = useState([])
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [lastUpdateText, setLastUpdateText] = useState('')
  const [nextUpdateIn, setNextUpdateIn] = useState(60)

  // Mettre à jour le texte "last updated" toutes les secondes
  useEffect(() => {
    if (!pnlData?.timestamp) return

    const updateTimestamp = () => {
      const now = new Date()
      const lastUpdate = new Date(pnlData.timestamp)
      const diffSeconds = Math.floor((now - lastUpdate) / 1000)
      
      if (diffSeconds < 60) {
        setLastUpdateText(`${diffSeconds} seconds ago`)
      } else if (diffSeconds < 3600) {
        const minutes = Math.floor(diffSeconds / 60)
        setLastUpdateText(`${minutes} minute${minutes > 1 ? 's' : ''} ago`)
      } else {
        const hours = Math.floor(diffSeconds / 3600)
        setLastUpdateText(`${hours} hour${hours > 1 ? 's' : ''} ago`)
      }

      // Calculer le temps avant le prochain update (120 secondes après le dernier)
      const nextUpdate = 120 - (diffSeconds % 120)
      setNextUpdateIn(nextUpdate)
    }

    updateTimestamp()
    const interval = setInterval(updateTimestamp, 1000)

    return () => clearInterval(interval)
  }, [pnlData?.timestamp])

  // Charger les données du graphique depuis l'historique
  useEffect(() => {
    const fetchHistory = async () => {
      if (!pnlData) return

      try {
        const response = await fetch(`http://localhost:3001/api/vault/pnl-history?period=${period}`)
        const data = await response.json()
        
        if (data.history && data.history.length > 0) {
          // Transformer les snapshots en format pour le graphique
          const chartPoints = data.history.map(snapshot => ({
            time: new Date(snapshot.t).getTime(),
            value: snapshot.v,
            percent: snapshot.p
          }))
          
          setChartData(chartPoints)
        } else {
          // Si pas d'historique, afficher le point actuel
          setChartData([{
            time: new Date().getTime(),
            value: pnlData.totalUSD || 0,
            percent: pnlData.pnlPercent || 0
          }])
        }
      } catch (error) {
        console.error('Error fetching PNL history:', error)
        // Fallback sur le point actuel
        setChartData([{
          time: new Date().getTime(),
          value: pnlData.totalUSD || 0,
          percent: pnlData.pnlPercent || 0
        }])
      }
    }

    fetchHistory()
  }, [period, pnlData])


  // Emojis pour les tokens
  const tokenEmojis = {
    'HYPE': '🟢',
    'ETH': '⚪',
    'BTC': '🟡',
    'USDT': '🟠',
    'USDC': '🟠'
  }

  // Tokens à afficher
  const displayTokens = ['HYPE', 'ETH', 'BTC', 'USDT','USDC']
  
  const totalUSD = pnlData?.totalUSD || 0
  const pnlAmount = pnlData?.pnlAmount || 0
  const pnlPercent = pnlData?.pnlPercent || 0

  return (
    <div className="space-y-6">
      {/* Total + PNL */}
      <div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="text-4xl sm:text-5xl font-bold text-white">
            ${totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          
          {/* Settings Button */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors group"
            title="Vault Settings"
          >
            <Settings className="w-6 h-6 text-gray-400 group-hover:text-white transition-colors" />
          </button>
        </div>

        {/* PNL Box */}
        <div className="bg-[#1a1a1a] rounded-lg p-4 inline-flex items-center gap-4 sm:gap-8">
          <div className="text-gray-400 font-medium text-sm sm:text-base">PNL</div>
          <div className="text-right">
            <div className={`text-base sm:text-lg font-bold ${pnlPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
            </div>
            <div className={`text-xs sm:text-sm ${pnlAmount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {pnlAmount >= 0 ? '+' : ''}${Math.abs(pnlAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Update Info */}
        {pnlData?.timestamp && (
          <div className="mt-4 flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                lastUpdateText.includes('second') ? 'bg-green-500' :
                lastUpdateText.includes('minute') && !lastUpdateText.includes('minutes') ? 'bg-yellow-500' :
                'bg-red-500'
              }`}></div>
              <span className="text-gray-500">
                Updated {lastUpdateText}
              </span>
            </div>
            <span className="text-gray-600">•</span>
            <span className="text-gray-500">
              Next update in {nextUpdateIn}s
            </span>
          </div>
        )}
      </div>

      {/* Graphique */}
      <div className="bg-[#0a0a0a] rounded-lg p-6">
        {/* Period Tabs */}
        <div className="flex gap-4 mb-6">
          {['1D', '1M', '3M', '6M', '1Y', 'All'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                period === p
                  ? 'text-white bg-white/10'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Chart */}
        <div className="h-64">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis 
                  dataKey="time" 
                  stroke="#333"
                  tick={{ fill: '#666' }}
                  hide
                />
                <YAxis 
                  stroke="#333"
                  tick={{ fill: '#666' }}
                  hide
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                  labelFormatter={(timestamp) => {
                    const date = new Date(timestamp)
                    return date.toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  }}
                  formatter={(value) => [`$${value.toFixed(2)}`, 'Value']}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              No data available
            </div>
          )}
        </div>
      </div>

      {/* Vault Balance Combiné */}
      <div className="bg-[#0a0a0a] rounded-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-white">vault balance</h2>
          {wallet?.addresses && (
            <div className="text-xs text-gray-500">
              <div className="truncate max-w-[200px] sm:max-w-none">HL: {wallet.addresses.hyperliquid.slice(0, 10)}...</div>
              <div className="truncate max-w-[200px] sm:max-w-none">EVM: {wallet.addresses.hyperevm.slice(0, 10)}...</div>
            </div>
          )}
        </div>
        
        {/* Desktop Table */}
        <div className="hidden lg:block space-y-1">
          {/* Header */}
          <div className="grid grid-cols-6 gap-4 pb-3 border-b border-[#1a1a1a]">
            <div className="col-span-1 text-sm text-gray-500 uppercase">Asset</div>
            <div className="col-span-1 text-sm text-gray-500 uppercase text-right">Hyperliquid</div>
            <div className="col-span-1 text-sm text-gray-500 uppercase text-right">HyperEVM</div>
            <div className="col-span-2 text-sm text-gray-500 uppercase text-right">Total</div>
            <div className="col-span-1 text-sm text-gray-500 uppercase text-right">USD Value</div>
          </div>

          {/* Tokens */}
          {!combinedBalances ? (
            <div className="py-8 text-center text-gray-500">
              Click the refresh button above to load balances
            </div>
          ) : (
            displayTokens.map((token) => {
              const balance = combinedBalances.balances[token];
              const breakdown = pnlData?.breakdown?.[token];
              
              if (!balance || balance.total === 0) {
                return null;
              }

              return (
                <div key={token} className="grid grid-cols-6 gap-4 py-4 hover:bg-white/5 transition-colors rounded-lg px-2">
                  <div className="col-span-1 flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#1a1a1a] rounded-full flex items-center justify-center text-2xl">
                      {tokenEmojis[token]}
                    </div>
                    <div>
                      <div className="text-white font-bold">{token}</div>
                    </div>
                  </div>

                  <div className="col-span-1 text-right">
                    <div className="text-gray-400 text-sm font-mono">
                      {balance.hyperliquid.toLocaleString('en-US', { 
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6 
                      })}
                    </div>
                  </div>

                  <div className="col-span-1 text-right">
                    <div className="text-gray-400 text-sm font-mono">
                      {balance.hyperevm.toLocaleString('en-US', { 
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6 
                      })}
                    </div>
                  </div>

                  <div className="col-span-2 text-right">
                    <div className="text-white font-bold">
                      {balance.total.toLocaleString('en-US', { 
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6 
                      })} {token}
                    </div>
                  </div>

                  <div className="col-span-1 text-right">
                    {breakdown && (
                      <div className="text-gray-300 font-medium">
                        ${breakdown.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden space-y-4">
          {!combinedBalances ? (
            <div className="py-8 text-center text-gray-500 text-sm">
              Click the refresh button above to load balances
            </div>
          ) : (
            displayTokens.map((token) => {
              const balance = combinedBalances.balances[token];
              const breakdown = pnlData?.breakdown?.[token];
              
              if (!balance || balance.total === 0) {
                return null;
              }

              return (
                <div key={token} className="bg-[#1a1a1a] rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#0a0a0a] rounded-full flex items-center justify-center text-2xl">
                        {tokenEmojis[token]}
                      </div>
                      <div className="text-white font-bold text-lg">{token}</div>
                    </div>
                    {breakdown && (
                      <div className="text-white font-bold">
                        ${breakdown.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Hyperliquid:</span>
                      <span className="text-gray-300 font-mono">
                        {balance.hyperliquid.toLocaleString('en-US', { maximumFractionDigits: 6 })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">HyperEVM:</span>
                      <span className="text-gray-300 font-mono">
                        {balance.hyperevm.toLocaleString('en-US', { maximumFractionDigits: 6 })}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-white/10">
                      <span className="text-gray-400 font-medium">Total:</span>
                      <span className="text-white font-bold">
                        {balance.total.toLocaleString('en-US', { maximumFractionDigits: 6 })} {token}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {combinedBalances && displayTokens.every(token => !combinedBalances.balances[token] || combinedBalances.balances[token].total === 0) && (
          <div className="py-8 text-center text-gray-500 text-sm">
            No tokens found
          </div>
        )}
      </div>

      {/* Settings Modal */}
      <VaultSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        currentSettings={pnlData?.settings}
        currentValue={totalUSD}
        pnlData={pnlData}
        onSave={onSaveSettings}
      />
    </div>
  )
}

export default VaultSection