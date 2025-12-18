import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, BarChart, Bar } from 'recharts'
import { TrendingUp, DollarSign, Target, Award, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import axios from 'axios'

function PerformanceSection() {
  const [performanceData, setPerformanceData] = useState(null)
  const [chartPeriod, setChartPeriod] = useState('day') // 'day', 'week', 'month'
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadPerformance()
  }, [])

  const loadPerformance = async () => {
    setIsLoading(true)
    try {
      const API_URL = import.meta.env.DEV ? 'http://localhost:3001/api' : '/api'
      const response = await axios.get(`${API_URL}/bot/performance`)
      setPerformanceData(response.data)
    } catch (error) {
      console.error('Error loading performance:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    )
  }

  if (!performanceData) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>Unable to load performance data</p>
      </div>
    )
  }

  const { totalProfit, totalTrades, winRate, avgProfitPerTrade, bestTrade, worstTrade, profitByDay, profitByWeek, profitByMonth, recentTrades } = performanceData

  // Sélectionner les données du graphique selon la période
  const chartData = chartPeriod === 'day' ? profitByDay : chartPeriod === 'week' ? profitByWeek : profitByMonth
  
  return (
    <div className="space-y-6">
      {/* Header - Total Profit */}
      <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-2">
          <DollarSign className="w-8 h-8 text-green-500" />
          <h2 className="text-sm text-gray-400 uppercase tracking-wide">Bot Realized Profit</h2>
        </div>
        <div className="text-5xl font-bold text-white mb-1">
          ${totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="text-gray-400 text-sm">
          From {totalTrades} arbitrage {totalTrades === 1 ? 'trade' : 'trades'}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Win Rate */}
        <div className="bg-[#0a0a0a] rounded-lg p-6 border border-[#1a1a1a]">
          <div className="flex items-center gap-3 mb-3">
            <Target className="w-6 h-6 text-blue-500" />
            <div className="text-sm text-gray-500">Win Rate</div>
          </div>
          <div className="text-3xl font-bold text-white">{winRate.toFixed(1)}%</div>
        </div>

        {/* Avg Profit */}
        <div className="bg-[#0a0a0a] rounded-lg p-6 border border-[#1a1a1a]">
          <div className="flex items-center gap-3 mb-3">
            <TrendingUp className="w-6 h-6 text-green-500" />
            <div className="text-sm text-gray-500">Avg/Trade</div>
          </div>
          <div className="text-3xl font-bold text-white">${avgProfitPerTrade.toFixed(2)}</div>
        </div>

        {/* Best Trade */}
        <div className="bg-[#0a0a0a] rounded-lg p-6 border border-[#1a1a1a]">
          <div className="flex items-center gap-3 mb-3">
            <ArrowUpRight className="w-6 h-6 text-emerald-500" />
            <div className="text-sm text-gray-500">Best Trade</div>
          </div>
          <div className="text-3xl font-bold text-emerald-500">${bestTrade.toFixed(2)}</div>
        </div>

        {/* Worst Trade */}
        <div className="bg-[#0a0a0a] rounded-lg p-6 border border-[#1a1a1a]">
          <div className="flex items-center gap-3 mb-3">
            <ArrowDownRight className="w-6 h-6 text-red-500" />
            <div className="text-sm text-gray-500">Worst Trade</div>
          </div>
          <div className="text-3xl font-bold text-red-500">${worstTrade.toFixed(2)}</div>
        </div>
      </div>

      {/* Profit Chart */}
      <div className="bg-[#0a0a0a] rounded-lg p-6 border border-[#1a1a1a]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <h3 className="text-lg font-bold text-white">Cumulative Profit</h3>
          <div className="flex gap-2">
            {[
              { label: 'Daily', value: 'day' },
              { label: 'Weekly', value: 'week' },
              { label: 'Monthly', value: 'month' }
            ].map(period => (
              <button
                key={period.value}
                onClick={() => setChartPeriod(period.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  chartPeriod === period.value
                    ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                    : 'bg-[#1a1a1a] text-gray-400 border border-[#2a2a2a] hover:border-[#3a3a3a]'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-80">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis 
                  dataKey={chartPeriod === 'day' ? 'date' : chartPeriod === 'week' ? 'week' : 'month'}
                  stroke="#333"
                  tick={{ fill: '#666', fontSize: 12 }}
                />
                <YAxis 
                  stroke="#333"
                  tick={{ fill: '#666', fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                  formatter={(value) => [`$${value.toFixed(2)}`, 'Cumulative Profit']}
                />
                <Line
                  type="monotone"
                  dataKey="cumulative"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ fill: '#10b981', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              No profit data yet
            </div>
          )}
        </div>
      </div>

      {/* Recent Trades */}
      <div className="bg-[#0a0a0a] rounded-lg p-6 border border-[#1a1a1a]">
        <h3 className="text-lg font-bold text-white mb-6">Recent Arbitrage Trades</h3>
        
        {recentTrades.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No trades yet. Profit trades will appear here.
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1a1a1a]">
                    <th className="text-left py-3 px-4 text-sm text-gray-500 font-medium">Date</th>
                    <th className="text-left py-3 px-4 text-sm text-gray-500 font-medium">Pair</th>
                    <th className="text-right py-3 px-4 text-sm text-gray-500 font-medium">Profit</th>
                    <th className="text-left py-3 px-4 text-sm text-gray-500 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTrades.map((trade) => (
                    <tr key={trade.id} className="border-b border-[#1a1a1a] hover:bg-white/5 transition-colors">
                      <td className="py-4 px-4 text-sm text-gray-400">
                        {new Date(trade.date).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-4 px-4 text-sm text-white font-medium">
                        {trade.note?.split('|')[0] || '-'}
                      </td>
                      <td className={`py-4 px-4 text-sm text-right font-bold ${trade.amount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {trade.amount >= 0 ? '+' : ''}${trade.amount.toFixed(2)}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-500">
                        {trade.note?.split('|')[1] || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {recentTrades.map((trade) => (
                <div key={trade.id} className="bg-[#1a1a1a] rounded-lg p-4 border border-[#2a2a2a]">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-white font-medium mb-1">
                        {trade.note?.split('|')[0] || 'Trade'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(trade.date).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                    <div className={`text-lg font-bold ${trade.amount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {trade.amount >= 0 ? '+' : ''}${trade.amount.toFixed(2)}
                    </div>
                  </div>
                  {trade.note?.split('|')[1] && (
                    <div className="text-sm text-gray-500 mt-2">
                      {trade.note.split('|')[1]}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default PerformanceSection