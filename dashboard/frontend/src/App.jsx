import { useState, useEffect } from 'react'
import axios from 'axios'
import { Plus, LayoutDashboard, Activity, RefreshCw, Wallet, Menu, X, LogOut, TrendingUp } from 'lucide-react'
import VaultSection from './components/VaultSection_Unified'
import ExecutorSection from './components/ExecutorSection'
import AddWalletModal from './components/AddWalletModal_Unified'
import WalletsManagement from './components/WalletsManagement'
import TransactionsModal from './components/TransactionsModal'
import LoginPage from './components/LoginPage'
import ActivitySection from './components/ActivitySection'
import PerformanceSection from './components/PerformanceSection'

const API_URL = import.meta.env.DEV ? 'http://localhost:3001/api' : '/api'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [wallets, setWallets] = useState([])
  const [walletBalances, setWalletBalances] = useState({})
  const [vaultCombinedBalances, setVaultCombinedBalances] = useState(null)
  const [vaultPnlData, setVaultPnlData] = useState(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [currentView, setCurrentView] = useState('dashboard')
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isTransactionsModalOpen, setIsTransactionsModalOpen] = useState(false)
  const [transactions, setTransactions] = useState([])

  useEffect(() => {
    const checkAuth = async () => {
      const savedToken = localStorage.getItem('token')
      const savedUser = localStorage.getItem('user')
      if (!savedToken || !savedUser) {
        setIsCheckingAuth(false)
        return
      }
      try {
        const response = await axios.get(`${API_URL}/auth/verify`, {
          headers: { 'Authorization': `Bearer ${savedToken}` }
        })
        if (response.data.valid) {
          axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`
          setToken(savedToken)
          setUser(JSON.parse(savedUser))
          setIsAuthenticated(true)
        } else {
          localStorage.removeItem('token')
          localStorage.removeItem('user')
        }
      } catch (error) {
        console.error('Auth verification failed:', error)
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      } finally {
        setIsCheckingAuth(false)
      }
    }
    checkAuth()
  }, [])

  const handleLogin = (newToken, newUser) => {
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
    setToken(newToken)
    setUser(newUser)
    setIsAuthenticated(true)
  }

  const handleLogout = async () => {
    try {
      await axios.post(`${API_URL}/auth/logout`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      setToken(null)
      setUser(null)
      setIsAuthenticated(false)
    }
  }

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    } else {
      delete axios.defaults.headers.common['Authorization']
    }
  }, [token])

  useEffect(() => {
    if (isAuthenticated) loadWallets()
  }, [isAuthenticated])

  useEffect(() => {
    if (wallets.length > 0 && isAuthenticated) {
      refreshAllWallets()
    }
  }, [wallets.length])

  useEffect(() => {
    const vault = wallets.find(w => w.walletType === 'vault')
    if (!vault) return
    refreshVaultPnl(false)
    loadTransactions()
    const interval = setInterval(() => {
      refreshVaultPnl(false)
    }, 120000)
    return () => clearInterval(interval)
  }, [wallets])

  const loadWallets = async () => {
    try {
      const response = await axios.get(`${API_URL}/wallets`)
      setWallets(response.data.wallets || [])
    } catch (error) {
      console.error('Error loading wallets:', error)
    }
  }

  const refreshWallet = async (wallet) => {
    try {
      const response = await axios.get(`${API_URL}/wallets/${wallet.address}/balances?blockchain=${wallet.blockchain}`)
      setWalletBalances(prev => ({ ...prev, [wallet.id]: response.data }))
    } catch (error) {
      console.error(`Error fetching balance for ${wallet.address}:`, error)
    }
  }

  const refreshVaultCombined = async (vaultWallet) => {
    try {
      const response = await axios.get(`${API_URL}/wallets/${vaultWallet.id}/combined-balances`)
      setVaultCombinedBalances(response.data)
    } catch (error) {
      console.error('Error fetching combined balances:', error)
    }
  }

  const refreshVaultPnl = async (forceRefresh = false) => {
    try {
      const url = forceRefresh ? `${API_URL}/vault/pnl?refresh=true` : `${API_URL}/vault/pnl`
      const response = await axios.get(url)
      setVaultPnlData(response.data)
    } catch (error) {
      console.error('Error fetching PNL:', error)
    }
  }

  const saveVaultSettings = async (settings) => {
    try {
      await axios.post(`${API_URL}/vault/settings`, settings)
      await refreshVaultPnl(true)
    } catch (error) {
      console.error('Error saving vault settings:', error)
      throw error
    }
  }

  const loadTransactions = async () => {
    try {
      const response = await axios.get(`${API_URL}/vault/transactions`)
      setTransactions(response.data.transactions || [])
    } catch (error) {
      console.error('Error loading transactions:', error)
    }
  }

  const addTransaction = async (transactionData) => {
    try {
      await axios.post(`${API_URL}/vault/transactions`, transactionData)
      await loadTransactions()
      await refreshVaultPnl(true)
    } catch (error) {
      console.error('Error adding transaction:', error)
      throw error
    }
  }

  const deleteTransaction = async (id) => {
    try {
      await axios.delete(`${API_URL}/vault/transactions/${id}`)
      await loadTransactions()
      await refreshVaultPnl(true)
    } catch (error) {
      console.error('Error deleting transaction:', error)
      throw error
    }
  }

  const refreshAllWallets = async () => {
    setIsRefreshing(true)
    try {
      const vault = wallets.find(w => w.walletType === 'vault')
      if (vault) {
        await refreshVaultCombined(vault)
        await refreshVaultPnl(true)
      }
      const executors = wallets.filter(w => w.walletType === 'executor')
      for (const wallet of executors) {
        await refreshWallet(wallet)
      }
    } catch (error) {
      console.error('Error refreshing wallets:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  const addWallet = async (walletData) => {
    try {
      await axios.post(`${API_URL}/wallets`, walletData)
      await loadWallets()
      setIsAddModalOpen(false)
    } catch (error) {
      console.error('Error adding wallet:', error)
      throw error
    }
  }

  const updateWallet = async (walletId, updates) => {
    try {
      await axios.put(`${API_URL}/wallets/${walletId}`, updates)
      await loadWallets()
    } catch (error) {
      console.error('Error updating wallet:', error)
      throw error
    }
  }

  const deleteWallet = async (walletId) => {
    try {
      await axios.delete(`${API_URL}/wallets/${walletId}`)
      await loadWallets()
      setWalletBalances(prev => {
        const newBalances = { ...prev }
        delete newBalances[walletId]
        return newBalances
      })
    } catch (error) {
      console.error('Error deleting wallet:', error)
    }
  }

  const vaultWallet = wallets.find(w => w.walletType === 'vault')
  const executorWallets = wallets.filter(w => w.walletType === 'executor')

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
          <p className="text-gray-400">Checking authentication...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden">
      <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg">
        {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {isMobileMenuOpen && <div className="lg:hidden fixed inset-0 bg-black/80 z-40" onClick={() => setIsMobileMenuOpen(false)} />}

      <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-60'} bg-[#0a0a0a] border-r border-[#1a1a1a] flex-shrink-0 transition-all duration-300 fixed lg:static inset-y-0 left-0 z-40 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 h-full relative pb-32">
          <div className="flex items-center justify-between mb-8">
            {!isSidebarCollapsed && <h1 className="text-xl font-bold">Welcome</h1>}
            <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="p-2 hover:bg-white/10 rounded-lg transition-colors hidden lg:block">
              <Menu className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-2">
            <button onClick={() => { setCurrentView('dashboard'); setIsMobileMenuOpen(false) }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${currentView === 'dashboard' ? 'bg-[#1f1f1f] text-white' : 'text-gray-500 hover:bg-[#1f1f1f] hover:text-white'} ${isSidebarCollapsed ? 'justify-center' : ''}`}>
              <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
              {!isSidebarCollapsed && <span>Dashboard</span>}
            </button>
            <button onClick={() => { setCurrentView('performance'); setIsMobileMenuOpen(false) }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${currentView === 'performance' ? 'bg-[#1f1f1f] text-white' : 'text-gray-500 hover:bg-[#1f1f1f] hover:text-white'} ${isSidebarCollapsed ? 'justify-center' : ''}`}>
              <TrendingUp className="w-5 h-5 flex-shrink-0" />
              {!isSidebarCollapsed && <span>Performance</span>}
            </button>
            <button onClick={() => { setCurrentView('activity'); setIsMobileMenuOpen(false) }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${currentView === 'activity' ? 'bg-[#1f1f1f] text-white' : 'text-gray-500 hover:bg-[#1f1f1f] hover:text-white'} ${isSidebarCollapsed ? 'justify-center' : ''}`}>
              <Activity className="w-5 h-5 flex-shrink-0" />
              {!isSidebarCollapsed && <span>Activity</span>}
            </button>
            <button onClick={() => { setCurrentView('wallets'); setIsMobileMenuOpen(false) }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${currentView === 'wallets' ? 'bg-[#1f1f1f] text-white' : 'text-gray-500 hover:bg-[#1f1f1f] hover:text-white'} ${isSidebarCollapsed ? 'justify-center' : ''}`}>
              <Wallet className="w-5 h-5 flex-shrink-0" />
              {!isSidebarCollapsed && <span>Wallets</span>}
            </button>
          </div>

          <div className="absolute bottom-6 left-0 right-0 px-6">
            <button onClick={handleLogout} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors text-red-400 hover:bg-red-500/10 border border-red-500/20 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
              <LogOut className="w-5 h-5 flex-shrink-0" />
              {!isSidebarCollapsed && <span>Logout</span>}
            </button>
            {!isSidebarCollapsed && user && (
              <div className="mt-3 px-2 text-xs text-gray-600">Logged in as <span className="text-gray-400">{user.username}</span></div>
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 pt-20 lg:pt-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-white">
              {currentView === 'dashboard' && 'VAULT'}
              {currentView === 'performance' && 'PERFORMANCE'}
              {currentView === 'activity' && 'ACTIVITY'}
              {currentView === 'wallets' && 'WALLETS'}
            </h1>
            <div className="flex gap-3">
              {currentView === 'dashboard' && (
                <button onClick={refreshAllWallets} disabled={isRefreshing} className="w-12 h-12 border-2 border-white/20 hover:border-white/40 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <RefreshCw className={`w-6 h-6 text-white ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
              )}
              {currentView !== 'activity' && currentView !== 'performance' && (
                <button onClick={() => setIsAddModalOpen(true)} className="w-12 h-12 border-2 border-white/20 hover:border-white/40 rounded-lg flex items-center justify-center transition-colors">
                  <Plus className="w-6 h-6 text-white" />
                </button>
              )}
            </div>
          </div>

          {currentView === 'dashboard' && (
            <>
              {vaultWallet ? (
                <VaultSection wallet={vaultWallet} combinedBalances={vaultCombinedBalances} pnlData={vaultPnlData} onRefresh={refreshAllWallets} onSaveSettings={saveVaultSettings} onOpenTransactions={() => setIsTransactionsModalOpen(true)} onDelete={() => deleteWallet(vaultWallet.id)} />
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <p className="mb-4">No Vault wallet configured</p>
                  <button onClick={() => setIsAddModalOpen(true)} className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors">Add Vault Wallet</button>
                </div>
              )}
              {executorWallets.length > 0 && <ExecutorSection wallets={executorWallets} balances={walletBalances} onRefresh={refreshWallet} onDelete={deleteWallet} />}
            </>
          )}

          {currentView === 'performance' && <PerformanceSection />}
          {currentView === 'activity' && <ActivitySection />}
          {currentView === 'wallets' && <WalletsManagement wallets={wallets} onUpdate={updateWallet} onDelete={deleteWallet} />}
        </div>
      </main>

      {isAddModalOpen && <AddWalletModal onClose={() => setIsAddModalOpen(false)} onAdd={addWallet} existingVault={!!vaultWallet} />}
      {isTransactionsModalOpen && <TransactionsModal isOpen={isTransactionsModalOpen} onClose={() => setIsTransactionsModalOpen(false)} transactions={transactions} onAddTransaction={addTransaction} onDeleteTransaction={deleteTransaction} />}
    </div>
  )
}

export default App