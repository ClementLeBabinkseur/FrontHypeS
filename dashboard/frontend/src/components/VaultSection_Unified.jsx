import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'

function VaultSection({ wallet, combinedBalances, onRefresh }) {
  const [period, setPeriod] = useState('1W')
  const [chartData, setChartData] = useState([])

  const BASE_PNL = 5000 // Base de $5,000

  // Calculer le total en HYPE (pour le PNL)
  const totalHype = combinedBalances?.balances?.HYPE?.total || 0
  const pnlAmount = totalHype - BASE_PNL
  const pnlPercent = BASE_PNL > 0 ? (pnlAmount / BASE_PNL) * 100 : 0

  // Générer les données du graphique
  useEffect(() => {
    if (!combinedBalances) return

    const periods = {
      '1D': 24,
      '1W': 7,
      '1M': 30,
      '6M': 180,
      '1Y': 365,
      'All': 365
    }

    const points = periods[period] || 7
    const data = Array.from({ length: points }, (_, i) => ({
      time: i,
      value: totalHype || 0
    }))

    setChartData(data)
  }, [period, combinedBalances, totalHype])

  // Emojis pour les tokens
  const tokenEmojis = {
    'HYPE': '🟡',
    'ETH': '⚪',
    'BTC': '🟠',
    'USDT': '🟢'
  }

  // Tokens à afficher
  const displayTokens = ['HYPE', 'ETH', 'BTC', 'USDT']

  return (
    <div className="space-y-6">
      {/* Total + PNL */}
      <div>
        <div className="text-5xl font-bold text-white mb-6">
          {totalHype.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} HYPE
        </div>

        {/* PNL Box */}
        <div className="bg-[#1a1a1a] rounded-lg p-4 inline-flex items-center gap-8">
          <div className="text-gray-400 font-medium">PNL</div>
          <div className="text-right">
            <div className={`text-lg font-bold ${pnlPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
            </div>
            <div className={`text-sm ${pnlAmount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {pnlAmount >= 0 ? '+' : ''}{pnlAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} HYPE
            </div>
          </div>
        </div>
      </div>

      {/* Graphique */}
      <div className="bg-[#0a0a0a] rounded-lg p-6">
        {/* Period Tabs */}
        <div className="flex gap-4 mb-6">
          {['1D', '1W', '1M', '6M', '1Y', 'All'].map(p => (
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
                  formatter={(value) => [`${value.toFixed(2)} HYPE`, 'Value']}
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
      <div className="bg-[#0a0a0a] rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">vault balance</h2>
          {wallet?.addresses && (
            <div className="text-xs text-gray-500">
              <div>HL: {wallet.addresses.hyperliquid.slice(0, 10)}...</div>
              <div>EVM: {wallet.addresses.hyperevm.slice(0, 10)}...</div>
            </div>
          )}
        </div>
        
        <div className="space-y-1">
          {/* Header */}
          <div className="grid grid-cols-5 gap-4 pb-3 border-b border-[#1a1a1a]">
            <div className="col-span-1 text-sm text-gray-500 uppercase">Asset</div>
            <div className="col-span-1 text-sm text-gray-500 uppercase text-right">Hyperliquid</div>
            <div className="col-span-1 text-sm text-gray-500 uppercase text-right">HyperEVM</div>
            <div className="col-span-2 text-sm text-gray-500 uppercase text-right">Total</div>
          </div>

          {/* Tokens */}
          {!combinedBalances ? (
            <div className="py-8 text-center text-gray-500">
              Click the refresh button above to load balances
            </div>
          ) : (
            displayTokens.map((token) => {
              const balance = combinedBalances.balances[token];
              
              // Ne pas afficher si toutes les balances sont à 0
              if (!balance || balance.total === 0) {
                return null;
              }

              return (
                <div key={token} className="grid grid-cols-5 gap-4 py-4 hover:bg-white/5 transition-colors rounded-lg px-2">
                  {/* Asset */}
                  <div className="col-span-1 flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#1a1a1a] rounded-full flex items-center justify-center text-2xl">
                      {tokenEmojis[token]}
                    </div>
                    <div>
                      <div className="text-white font-bold">{token}</div>
                    </div>
                  </div>

                  {/* Hyperliquid */}
                  <div className="col-span-1 text-right">
                    <div className="text-gray-400 text-sm font-mono">
                      {balance.hyperliquid.toLocaleString('en-US', { 
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6 
                      })}
                    </div>
                  </div>

                  {/* HyperEVM */}
                  <div className="col-span-1 text-right">
                    <div className="text-gray-400 text-sm font-mono">
                      {balance.hyperevm.toLocaleString('en-US', { 
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6 
                      })}
                    </div>
                  </div>

                  {/* Total */}
                  <div className="col-span-2 text-right">
                    <div className="text-white font-bold text-lg">
                      {balance.total.toLocaleString('en-US', { 
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6 
                      })} {token}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {combinedBalances && displayTokens.every(token => !combinedBalances.balances[token] || combinedBalances.balances[token].total === 0) && (
            <div className="py-8 text-center text-gray-500">
              No tokens found
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default VaultSection