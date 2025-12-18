import { useState, useEffect } from 'react'
import { Download, ExternalLink, RefreshCw, Calendar, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, Zap, ChevronDown, ChevronRight } from 'lucide-react'
import axios from 'axios'

function ActivitySection() {
  const [activities, setActivities] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('all')
  const [tokenFilters, setTokenFilters] = useState([])
  const [limitFilter, setLimitFilter] = useState('100')
  const [totalCount, setTotalCount] = useState(0)
  const [filteredCount, setFilteredCount] = useState(0)
  const [vaultStartDate, setVaultStartDate] = useState(null)
  const [expandedGroups, setExpandedGroups] = useState(new Set())

  useEffect(() => {
    const loadVaultSettings = async () => {
      try {
        const API_URL = import.meta.env.DEV ? 'http://localhost:3001/api' : '/api'
        const response = await axios.get(`${API_URL}/vault/settings`)
        if (response.data.initialDate) {
          setVaultStartDate(response.data.initialDate.split('T')[0])
        }
      } catch (error) {
        console.error('Error loading vault settings:', error)
      }
    }
    loadVaultSettings()
  }, [])

  useEffect(() => {
    loadActivities()
  }, [categoryFilter, dateFilter, limitFilter])

  const loadActivities = async () => {
    setIsLoading(true)
    try {
      const API_URL = import.meta.env.DEV ? 'http://localhost:3001/api' : '/api'
      const params = new URLSearchParams()
      if (categoryFilter !== 'all') params.append('category', categoryFilter)
      
      if (dateFilter === 'vault_start' && vaultStartDate) {
        params.append('startDate', new Date(vaultStartDate).toISOString())
      } else if (dateFilter !== 'all') {
        const now = new Date()
        let startDate
        if (dateFilter === '24h') startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        else if (dateFilter === '7d') startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        else if (dateFilter === '30d') startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        if (startDate) params.append('startDate', startDate.toISOString())
      }
      
      params.append('limit', limitFilter)
      const response = await axios.get(`${API_URL}/vault/activity?${params}`)
      setActivities(response.data.activities || [])
      setTotalCount(response.data.total || 0)
      setFilteredCount(response.data.filtered || 0)
    } catch (error) {
      console.error('Error loading activities:', error)
      setActivities([])
    } finally {
      setIsLoading(false)
    }
  }

  const exportToCSV = () => {
    const headers = ['Date', 'Type', 'Category', 'Asset', 'Network', 'Amount', 'Price', 'Value', 'Fee', 'Hash']
    const rows = filteredActivities.map(activity => [
      new Date(activity.timestamp).toLocaleString(),
      activity.type,
      activity.category,
      activity.asset,
      activity.network || activity.blockchain,
      activity.amount,
      activity.price || '',
      activity.value,
      activity.fee || '',
      activity.txHash || ''
    ])
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vault-activity-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const filteredActivities = activities.filter(activity => {
    if (tokenFilters.length > 0 && !tokenFilters.includes(activity.asset)) return false
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      activity.asset.toLowerCase().includes(search) ||
      activity.type.toLowerCase().includes(search) ||
      (activity.network && activity.network.toLowerCase().includes(search)) ||
      (activity.txHash && typeof activity.txHash === 'string' && activity.txHash.toLowerCase().includes(search))
    )
  })

  const uniqueTokens = [...new Set(activities.map(a => a.asset))].sort()

  const toggleTokenFilter = (token) => {
    setTokenFilters(prev => prev.includes(token) ? prev.filter(t => t !== token) : [...prev, token])
  }

  const toggleGroupExpansion = (activityId) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev)
      newSet.has(activityId) ? newSet.delete(activityId) : newSet.add(activityId)
      return newSet
    })
  }

  const getExplorerLink = (activity) => {
    if (!activity.txHash) return null
    
    // HyperEVM transactions
    if (activity.network === 'HyperEVM' || activity.blockchain === 'hyperevm') {
      return `https://hyperevmscan.io/tx/${activity.txHash}`
    }
    
    // Hyperliquid transactions
    return `https://hypurrscan.io/tx/${activity.txHash}`
  }

  const getActivityIcon = (type, category) => {
    if (category === 'trade') return type === 'buy' ? <TrendingUp className="w-5 h-5 text-green-500" /> : <TrendingDown className="w-5 h-5 text-red-500" />
    if (category === 'transfer') return type === 'deposit' ? <ArrowDownLeft className="w-5 h-5 text-blue-500" /> : <ArrowUpRight className="w-5 h-5 text-orange-500" />
    if (category === 'funding') return <Zap className="w-5 h-5 text-yellow-500" />
    if (category === 'defi') return <Zap className="w-5 h-5 text-purple-500" />
    return <div className="w-5 h-5 bg-gray-600 rounded-full" />
  }

  const getTypeBadgeColor = (type, category) => {
    if (category === 'trade') return type === 'buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
    if (category === 'transfer') return type === 'deposit' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'
    if (category === 'funding') return type === 'funding_received' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-purple-500/20 text-purple-400'
    if (category === 'defi') return 'bg-purple-500/20 text-purple-400'
    return 'bg-gray-500/20 text-gray-400'
  }

  const formatType = (type) => {
    const types = { 
      buy: 'Buy', 
      sell: 'Sell', 
      deposit: 'Deposit', 
      withdrawal: 'Withdrawal', 
      funding_received: 'Funding +', 
      funding_paid: 'Funding -',
      approve: 'Approve',
      swap: 'Swap',
      add_liquidity: 'Add Liquidity',
      multicall: 'Multicall',
      contract_interaction: 'Contract'
    }
    return types[type] || type
  }

  return (
    <div className="space-y-6">
      <div className="bg-[#0a0a0a] rounded-lg p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">Vault Activity</h2>
            <p className="text-sm text-gray-500">{isLoading ? 'Loading...' : `${filteredCount} of ${totalCount} transactions`}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={loadActivities} disabled={isLoading} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="text-sm font-medium">Refresh</span>
            </button>
            <button onClick={exportToCSV} disabled={filteredActivities.length === 0} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50">
              <Download className="w-4 h-4" />
              <span className="text-sm font-medium">Export CSV</span>
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-2">Category</label>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30">
                <option value="all">All Categories</option>
                <option value="trade">Trades</option>
                <option value="transfer">Transfers</option>
                <option value="funding">Funding</option>
                <option value="defi">DeFi</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-2">Time Period</label>
              <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30">
                <option value="all">All Time</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                {vaultStartDate && <option value="vault_start">Since Vault Start ({vaultStartDate})</option>}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-2">Show</label>
              <select value={limitFilter} onChange={(e) => setLimitFilter(e.target.value)} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30">
                <option value="50">50 trades</option>
                <option value="100">100 trades</option>
                <option value="200">200 trades</option>
                <option value="500">500 trades</option>
                <option value="1000">1000 trades</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-2">Search</label>
              <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search..." className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30" />
            </div>
          </div>
          {uniqueTokens.length > 0 && (
            <div>
              <label className="block text-xs text-gray-500 mb-2">Tokens {tokenFilters.length > 0 && `(${tokenFilters.length} selected)`}</label>
              <div className="flex flex-wrap gap-2">
                {uniqueTokens.map(token => (
                  <button key={token} onClick={() => toggleTokenFilter(token)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tokenFilters.includes(token) ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' : 'bg-[#1a1a1a] text-gray-400 border border-[#2a2a2a] hover:border-[#3a3a3a]'}`}>{token}</button>
                ))}
                {tokenFilters.length > 0 && <button onClick={() => setTokenFilters([])} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500/20 text-red-400 border border-red-500/50">Clear</button>}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-[#0a0a0a] rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center"><div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div><p className="text-gray-500">Loading...</p></div>
        ) : filteredActivities.length === 0 ? (
          <div className="p-12 text-center"><Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" /><p className="text-gray-500">No activities</p></div>
        ) : (
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#1a1a1a] border-b border-[#2a2a2a]">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Asset</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Network</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase">Fee</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase">Tx</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a]">
                {filteredActivities.map((activity) => {
                  const isExpanded = expandedGroups.has(activity.id)
                  const isGroup = activity.isGroup && activity.fills && activity.fills.length > 1
                  const explorerLink = getExplorerLink(activity)
                  
                  return (
                    <>
                      <tr key={activity.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-300">{new Date(activity.timestamp).toLocaleDateString()}</div><div className="text-xs text-gray-500">{new Date(activity.timestamp).toLocaleTimeString()}</div></td>
                        <td className="px-6 py-4 whitespace-nowrap"><div className="flex items-center gap-2">{isGroup && <button onClick={() => toggleGroupExpansion(activity.id)} className="text-gray-400 hover:text-white">{isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>}{getActivityIcon(activity.type, activity.category)}<span className={`px-2 py-1 rounded text-xs font-medium ${getTypeBadgeColor(activity.type, activity.category)}`}>{formatType(activity.type)}{isGroup && ` (${activity.fills.length})`}</span></div></td>
                        <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-white">{activity.asset}</div></td>
                        <td className="px-6 py-4 whitespace-nowrap"><div className="text-xs text-gray-400">{activity.network || activity.blockchain}</div></td>
                        <td className="px-6 py-4 whitespace-nowrap text-right"><div className="text-sm font-mono text-white">{activity.amount.toLocaleString('en-US', { maximumFractionDigits: 6 })}</div></td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">{activity.price ? <div className="text-sm font-mono text-gray-300">${activity.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div> : <div className="text-sm text-gray-600">-</div>}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right"><div className="text-sm font-medium text-white">${activity.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div></td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">{activity.fee ? <div className="text-sm text-gray-400">${activity.fee.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div> : <div className="text-sm text-gray-600">-</div>}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">{explorerLink && <a href={explorerLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300"><ExternalLink className="w-4 h-4" /></a>}</td>
                      </tr>
                      {isGroup && isExpanded && activity.fills.map((fill, idx) => {
                        const fillExplorerLink = getExplorerLink(fill)
                        return (
                          <tr key={`${activity.id}-${idx}`} className="bg-[#0a0a0a]/50">
                            <td className="px-6 py-2 pl-16 whitespace-nowrap"><div className="text-xs text-gray-500">Fill #{idx + 1}</div></td>
                            <td className="px-6 py-2"><span className="text-xs text-gray-500">↳</span></td>
                            <td className="px-6 py-2"><div className="text-xs text-gray-400">{fill.asset}</div></td>
                            <td className="px-6 py-2"><div className="text-xs text-gray-500">{fill.network || fill.blockchain}</div></td>
                            <td className="px-6 py-2 text-right"><div className="text-xs font-mono text-gray-400">{fill.amount.toLocaleString('en-US', { maximumFractionDigits: 6 })}</div></td>
                            <td className="px-6 py-2 text-right"><div className="text-xs font-mono text-gray-400">${fill.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div></td>
                            <td className="px-6 py-2 text-right"><div className="text-xs text-gray-400">${fill.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div></td>
                            <td className="px-6 py-2 text-right"><div className="text-xs text-gray-400">${fill.fee.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div></td>
                            <td className="px-6 py-2 text-center">{fillExplorerLink && <a href={fillExplorerLink} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3 h-3 text-blue-400" /></a>}</td>
                          </tr>
                        )
                      })}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>

              )/* Mobile Cards */}
          <div className="lg:hidden divide-y divide-[#1a1a1a]">
            {filteredActivities.map((activity) => {
              const isExpanded = expandedGroups.has(activity.id)
              const isGroup = activity.isGroup && activity.fills && activity.fills.length > 1
              const explorerLink = getExplorerLink(activity)
              
              return (
                <div key={activity.id} className="p-4 hover:bg-white/5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {isGroup && (
                        <button onClick={() => toggleGroupExpansion(activity.id)} className="text-gray-400">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      )}
                      {getActivityIcon(activity.type, activity.category)}
                      <div>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeBadgeColor(activity.type, activity.category)}`}>
                          {formatType(activity.type)}{isGroup && ` (${activity.fills.length})`}
                        </span>
                        <div className="text-xs text-gray-500 mt-1">{new Date(activity.timestamp).toLocaleString()}</div>
                      </div>
                    </div>
                    {explorerLink && <a href={explorerLink} target="_blank" rel="noopener noreferrer" className="text-blue-400"><ExternalLink className="w-4 h-4" /></a>}
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between"><span className="text-sm text-gray-500">Asset</span><span className="text-sm font-medium text-white">{activity.asset}</span></div>
                    <div className="flex justify-between"><span className="text-sm text-gray-500">Network</span><span className="text-xs text-gray-400">{activity.network || activity.blockchain}</span></div>
                    <div className="flex justify-between"><span className="text-sm text-gray-500">Amount</span><span className="text-sm font-mono text-white">{activity.amount.toLocaleString('en-US', { maximumFractionDigits: 6 })}</span></div>
                    {activity.price && <div className="flex justify-between"><span className="text-sm text-gray-500">Price</span><span className="text-sm font-mono text-gray-300">${activity.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span></div>}
                    <div className="flex justify-between"><span className="text-sm text-gray-500">Value</span><span className="text-sm font-medium text-white">${activity.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span></div>
                    {activity.fee && <div className="flex justify-between"><span className="text-sm text-gray-500">Fee</span><span className="text-sm text-gray-400">${activity.fee.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span></div>}
                  </div>

                  {isGroup && isExpanded && (
                    <div className="mt-3 pt-3 border-t border-[#1a1a1a] space-y-2">
                      {activity.fills.map((fill, idx) => (
                        <div key={idx} className="pl-4 py-2 bg-[#0a0a0a]/50 rounded text-xs">
                          <div className="flex justify-between mb-1"><span className="text-gray-500">Fill #{idx + 1}</span>{getExplorerLink(fill) && <a href={getExplorerLink(fill)} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3 h-3 text-blue-400" /></a>}</div>
                          <div className="space-y-1">
                            <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="text-gray-300">{fill.amount.toLocaleString('en-US', { maximumFractionDigits: 6 })}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Price</span><span className="text-gray-300">${fill.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Value</span><span className="text-gray-300">${fill.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

      </div>

      {!isLoading && filteredActivities.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {['trade', 'transfer', 'funding', 'defi'].map(cat => {
            const count = activities.filter(a => a.category === cat).length
            return count > 0 ? <div key={cat} className="bg-[#0a0a0a] rounded-lg p-4"><div className="text-xs text-gray-500 uppercase mb-1">{cat === 'defi' ? 'DeFi' : `${cat}s`}</div><div className="text-2xl font-bold text-white">{count}</div></div> : null
          })}
          <div className="bg-[#0a0a0a] rounded-lg p-4"><div className="text-xs text-gray-500 uppercase mb-1">Total</div><div className="text-2xl font-bold text-white">{totalCount}</div></div>
        </div>
      )}
    </div>
  )
}

export default ActivitySection