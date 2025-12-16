import { useState, useEffect } from 'react'
import { Filter, Download, ExternalLink, RefreshCw, Calendar, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, Zap } from 'lucide-react'
import axios from 'axios'

function ActivitySection() {
  const [activities, setActivities] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('vault_start')
  const [tokenFilters, setTokenFilters] = useState([]) // Multi-selection
  const [limitFilter, setLimitFilter] = useState('100')
  const [totalCount, setTotalCount] = useState(0)
  const [filteredCount, setFilteredCount] = useState(0)
  const [vaultStartDate, setVaultStartDate] = useState(null)

  // Charger les vault settings au montage pour la date de début
  useEffect(() => {
    const loadVaultSettings = async () => {
      try {
        const API_URL = import.meta.env.DEV ? 'http://localhost:3001/api' : '/api'
        const response = await axios.get(`${API_URL}/vault/settings`)
        if (response.data.initialDate) {
          setVaultStartDate(response.data.initialDate.split('T')[0]) // Format YYYY-MM-DD
        }
      } catch (error) {
        console.error('Error loading vault settings:', error)
      }
    }
    loadVaultSettings()
  }, [])

  // Charger les activités au montage
  useEffect(() => {
    loadActivities()
  }, [categoryFilter, dateFilter, limitFilter])

  const loadActivities = async () => {
    setIsLoading(true)
    try {
      const API_URL = import.meta.env.DEV ? 'http://localhost:3001/api' : '/api'
      
      // Construire les query params
      const params = new URLSearchParams()
      if (categoryFilter !== 'all') params.append('category', categoryFilter)
      
      // Gestion des dates
      if (dateFilter === 'vault_start' && vaultStartDate) {
        params.append('startDate', new Date(vaultStartDate).toISOString())
      } else if (dateFilter !== 'all') {
        const now = new Date()
        let startDate
        switch (dateFilter) {
          case '24h':
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
            break
          case '7d':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            break
          case '30d':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            break
        }
        if (startDate) params.append('startDate', startDate.toISOString())
      }
      
      params.append('limit', limitFilter)
      
      const response = await axios.get(`${API_URL}/vault/activity?${params.toString()}`)
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

  // Exporter en CSV
  const exportToCSV = () => {
    const headers = ['Date', 'Type', 'Category', 'Asset', 'Amount', 'Price', 'Value', 'Fee', 'Hash']
    const rows = filteredActivities.map(activity => [
      new Date(activity.timestamp).toLocaleString(),
      activity.type,
      activity.category,
      activity.asset,
      activity.amount,
      activity.price || '',
      activity.value,
      activity.fee || '',
      activity.txHash || ''
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vault-activity-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  // Filtrer par recherche locale et tokens
  const filteredActivities = activities.filter(activity => {
    // Filtre par tokens (multi-selection)
    if (tokenFilters.length > 0 && !tokenFilters.includes(activity.asset)) {
      return false
    }
    
    // Filtre par recherche
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      activity.asset.toLowerCase().includes(search) ||
      activity.type.toLowerCase().includes(search) ||
      (activity.txHash && typeof activity.txHash === 'string' && activity.txHash.toLowerCase().includes(search))
    )
  })

  // Obtenir la liste unique des tokens pour le filtre
  const uniqueTokens = [...new Set(activities.map(a => a.asset))].sort()

  // Toggle token dans le filtre multi-selection
  const toggleTokenFilter = (token) => {
    setTokenFilters(prev => 
      prev.includes(token) 
        ? prev.filter(t => t !== token)
        : [...prev, token]
    )
  }

  // Icônes par type d'activité
  const getActivityIcon = (type, category) => {
    if (category === 'trade') {
      return type === 'buy' ? 
        <TrendingUp className="w-5 h-5 text-green-500" /> : 
        <TrendingDown className="w-5 h-5 text-red-500" />
    }
    if (category === 'transfer') {
      return type === 'deposit' ? 
        <ArrowDownLeft className="w-5 h-5 text-blue-500" /> : 
        <ArrowUpRight className="w-5 h-5 text-orange-500" />
    }
    if (category === 'funding') {
      return <Zap className="w-5 h-5 text-yellow-500" />
    }
    return <div className="w-5 h-5 bg-gray-600 rounded-full" />
  }

  // Couleur du badge par type
  const getTypeBadgeColor = (type, category) => {
    if (category === 'trade') {
      return type === 'buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
    }
    if (category === 'transfer') {
      return type === 'deposit' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'
    }
    if (category === 'funding') {
      return type === 'funding_received' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-purple-500/20 text-purple-400'
    }
    return 'bg-gray-500/20 text-gray-400'
  }

  // Formater le type lisiblement
  const formatType = (type) => {
    const types = {
      'buy': 'Buy',
      'sell': 'Sell',
      'deposit': 'Deposit',
      'withdrawal': 'Withdrawal',
      'funding_received': 'Funding +',
      'funding_paid': 'Funding -'
    }
    return types[type] || type
  }

  return (
    <div className="space-y-6">
      {/* Header avec filtres */}
      <div className="bg-[#0a0a0a] rounded-lg p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">Vault Activity</h2>
            <p className="text-sm text-gray-500">
              {isLoading ? 'Loading...' : `${filteredCount} of ${totalCount} transactions`}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={loadActivities}
              disabled={isLoading}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="text-sm font-medium">Refresh</span>
            </button>
            <button
              onClick={exportToCSV}
              disabled={filteredActivities.length === 0}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span className="text-sm font-medium">Export CSV</span>
            </button>
          </div>
        </div>

        {/* Filtres */}
        <div className="space-y-4">
          {/* Première ligne */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Category Filter */}
            <div>
              <label className="block text-xs text-gray-500 mb-2">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
              >
                <option value="all">All Categories</option>
                <option value="trade">Trades</option>
                <option value="transfer">Transfers</option>
                <option value="funding">Funding</option>
              </select>
            </div>

            {/* Date Filter */}
            <div>
              <label className="block text-xs text-gray-500 mb-2">Time Period</label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
              >
                <option value="all">All Time</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                {vaultStartDate && (
                  <option value="vault_start">Since Vault Start ({vaultStartDate})</option>
                )}
              </select>
            </div>

            {/* Limit Filter */}
            <div>
              <label className="block text-xs text-gray-500 mb-2">Show</label>
              <select
                value={limitFilter}
                onChange={(e) => setLimitFilter(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
              >
                <option value="50">50 trades</option>
                <option value="100">100 trades</option>
                <option value="200">200 trades</option>
                <option value="500">500 trades</option>
                <option value="1000">1000 trades</option>
              </select>
            </div>

            {/* Search */}
            <div>
              <label className="block text-xs text-gray-500 mb-2">Search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by asset, type, or hash..."
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
              />
            </div>
          </div>

          {/* Token Filter (multi-selection) */}
          {uniqueTokens.length > 0 && (
            <div>
              <label className="block text-xs text-gray-500 mb-2">
                Tokens {tokenFilters.length > 0 && `(${tokenFilters.length} selected)`}
              </label>
              <div className="flex flex-wrap gap-2">
                {uniqueTokens.map(token => (
                  <button
                    key={token}
                    onClick={() => toggleTokenFilter(token)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      tokenFilters.includes(token)
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                        : 'bg-[#1a1a1a] text-gray-400 border border-[#2a2a2a] hover:border-[#3a3a3a]'
                    }`}
                  >
                    {token}
                  </button>
                ))}
                {tokenFilters.length > 0 && (
                  <button
                    onClick={() => setTokenFilters([])}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 transition-colors"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Activity List */}
      <div className="bg-[#0a0a0a] rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
            <p className="text-gray-500">Loading activities...</p>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">No activities found</p>
            <p className="text-sm text-gray-600">
              {searchTerm ? 'Try adjusting your search or filters' : 'Your vault activity will appear here'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#1a1a1a] border-b border-[#2a2a2a]">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Asset</th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase">Fee</th>
                    <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase">Tx</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1a1a]">
                  {filteredActivities.map((activity) => (
                    <tr key={activity.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-300">
                          {new Date(activity.timestamp).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(activity.timestamp).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getActivityIcon(activity.type, activity.category)}
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeBadgeColor(activity.type, activity.category)}`}>
                            {formatType(activity.type)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-white">{activity.asset}</div>
                        <div className="text-xs text-gray-500">{activity.blockchain}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-mono text-white">
                          {activity.amount.toLocaleString('en-US', { maximumFractionDigits: 6 })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {activity.price ? (
                          <div className="text-sm font-mono text-gray-300">
                            ${activity.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-600">-</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-medium text-white">
                          ${activity.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {activity.fee ? (
                          <div className="text-sm text-gray-400">
                            ${activity.fee.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-600">-</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {activity.txHash && (
                          <a
                            href={`https://explorer.hyperliquid.xyz/tx/${activity.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden space-y-3 p-4">
              {filteredActivities.map((activity) => (
                <div key={activity.id} className="bg-[#1a1a1a] rounded-lg p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getActivityIcon(activity.type, activity.category)}
                      <div>
                        <div className={`px-2 py-1 rounded text-xs font-medium ${getTypeBadgeColor(activity.type, activity.category)}`}>
                          {formatType(activity.type)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">
                        {new Date(activity.timestamp).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-600">
                        {new Date(activity.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Asset:</span>
                      <span className="text-white font-medium">{activity.asset}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Amount:</span>
                      <span className="text-white font-mono">
                        {activity.amount.toLocaleString('en-US', { maximumFractionDigits: 6 })}
                      </span>
                    </div>
                    {activity.price && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Price:</span>
                        <span className="text-gray-300 font-mono">
                          ${activity.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">Value:</span>
                      <span className="text-white font-medium">
                        ${activity.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    {activity.fee && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Fee:</span>
                        <span className="text-gray-400">
                          ${activity.fee.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                    <span className="text-xs text-gray-500">{activity.blockchain}</span>
                    {activity.txHash && (
                      <a
                        href={`https://explorer.hyperliquid.xyz/tx/${activity.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        View TX <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Stats Summary */}
      {!isLoading && filteredActivities.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {['trade', 'transfer', 'funding'].map(cat => {
            const count = activities.filter(a => a.category === cat).length
            if (count === 0) return null
            
            return (
              <div key={cat} className="bg-[#0a0a0a] rounded-lg p-4">
                <div className="text-xs text-gray-500 uppercase mb-1">{cat}s</div>
                <div className="text-2xl font-bold text-white">{count}</div>
              </div>
            )
          })}
          <div className="bg-[#0a0a0a] rounded-lg p-4">
            <div className="text-xs text-gray-500 uppercase mb-1">Total</div>
            <div className="text-2xl font-bold text-white">{totalCount}</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ActivitySection