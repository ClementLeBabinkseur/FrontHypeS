import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'

function VaultSection({ wallet, balances }) {
  const [period, setPeriod] = useState('1W')
  const [chartData, setChartData] = useState([])

  const BASE_PNL = 5000 // Base de $5,000

  // Calculer le total actuel
  const currentTotal = balances?.totalUSD || 0
  const pnlAmount = currentTotal - BASE_PNL
  const pnlPercent = BASE_PNL > 0 ? (pnlAmount / BASE_PNL) * 100 : 0

  // Générer les données du graphique (ligne plate pour l'instant)
  useEffect(() => {
    if (!balances) return

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
      value: currentTotal || 0
    }))

    setChartData(data)
  }, [period, balances, currentTotal])

  // Filtrer pour les 4 tokens requis
  const displayTokens = ['HYPE', 'ETH', 'BTC', 'USDT']
  const tokenBalances = balances?.balances?.filter(b => 
    displayTokens.includes(b.token)
  ) || []

  // Emojis pour les tokens
  const tokenEmojis = {
    'HYPE': '🟡',
    'ETH': '⚪',
    'BTC': '🟠',
    'USDT': '🟢'
  }

  return (
    <div className="space-y-6">
      {/* Total + PNL */}
      <div>
        <div className="text-5xl font-bold text-white mb-6">
          ${currentTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>

        {/* PNL Box */}
        <div className="bg-[#1a1a1a] rounded-lg p-4 inline-flex items-center gap-8">
          <div className="text-gray-400 font-medium">PNL</div>
          <div className="text-right">
            <div className={`text-lg font-bold ${pnlPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
            </div>
            <div className={`text-sm ${pnlAmount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              ${Math.abs(pnlAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

      {/* Vault Balance */}
      <div className="bg-[#0a0a0a] rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-6">vault balance</h2>
        
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
    </div>
  )
}

export default VaultSection