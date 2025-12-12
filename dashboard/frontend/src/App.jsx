import { useState, useEffect } from 'react'
import axios from 'axios'
import { Plus, LayoutDashboard, Activity, RefreshCw, Wallet, Menu, X, LogOut } from 'lucide-react'
import VaultSection from './components/VaultSection_Unified'
import ExecutorSection from './components/ExecutorSection'
import AddWalletModal from './components/AddWalletModal_Unified'
import WalletsManagement from './components/WalletsManagement'
import TransactionsModal from './components/TransactionsModal'
import LoginPage from './components/LoginPage'

// En développement: localhost:3001, en production: via proxy Nginx
const API_URL = import.meta.env.DEV ? 'http://localhost:3001/api' : '/api'

function App() {
  // Authentication state
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
  const [currentView, setCurrentView] = useState('dashboard') // 'dashboard' or 'wallets'
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isTransactionsModalOpen, setIsTransactionsModalOpen] = useState(false)
  const [transactions, setTransactions] = useState([])

  // ============ AUTHENTICATION ============

  // Vérifier le token au chargement
  useEffect(() => {
    const checkAuth = async () => {
      const savedToken = localStorage.getItem('token')
      const savedUser = localStorage.getItem('user')

      if (!savedToken || !savedUser) {
        setIsCheckingAuth(false)
        return
      }

      try {
        // Vérifier si le token est toujours valide
        const response = await axios.get(`${API_URL}/auth/verify`, {
          headers: {
            'Authorization': `Bearer ${savedToken}`
          }
        })

        if (response.data.valid) {
          // Configurer axios IMMÉDIATEMENT avec le token
          axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`
          
          setToken(savedToken)
          setUser(JSON.parse(savedUser))
          setIsAuthenticated(true)
        } else {
          // Token invalide, nettoyer
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

  // Handler de login
  const handleLogin = (newToken, newUser) => {
    // Configurer axios IMMÉDIATEMENT avec le token
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
    
    setToken(newToken)
    setUser(newUser)
    setIsAuthenticated(true)
  }

  // Handler de logout
  const handleLogout = async () => {
    try {
      await axios.post(`${API_URL}/auth/logout`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
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

  // Configurer axios pour inclure le token dans toutes les requêtes
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    } else {
      delete axios.defaults.headers.common['Authorization']
    }
  }, [token])

  // ============ DATA FETCHING ============
  
  // Charger les wallets seulement si authentifié
  useEffect(() => {
    if (isAuthenticated) {
      loadWallets()
    }
  }, [isAuthenticated])

  // Auto-refresh du PNL toutes les 60 secondes
  useEffect(() => {
    const vault = wallets.find(w => w.walletType === 'vault')
    if (!vault) return

    // Fetch initial
    refreshVaultPnl(false)
    loadTransactions() // Charger les transactions

    // Setup interval
    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing PNL...')
      refreshVaultPnl(false) // false = utilise le dernier snapshot du backend
    }, 120000) // 120 secondes = 2 minutes

    return () => clearInterval(interval)
  }, [wallets]) // Dépend de wallets pour détecter l'ajout/suppression du vault

  const loadWallets = async () => {
    try {
      const response = await axios.get(`${API_URL}/wallets`)
      setWallets(response.data.wallets || [])
    } catch (error) {
      console.error('Error loading wallets:', error)
    }
  }

  // Rafraîchir un wallet spécifique
  const refreshWallet = async (wallet) => {
    try {
      const response = await axios.get(
        `${API_URL}/wallets/${wallet.address}/balances?blockchain=${wallet.blockchain}`
      )
      setWalletBalances(prev => ({
        ...prev,
        [wallet.id]: response.data
      }))
    } catch (error) {
      console.error(`Error fetching balance for ${wallet.address}:`, error)
    }
  }

  // Rafraîchir les balances combinées du vault
  const refreshVaultCombined = async (vaultWallet) => {
    try {
      console.log('Fetching combined balances for vault:', vaultWallet.id)
      const response = await axios.get(`${API_URL}/wallets/${vaultWallet.id}/combined-balances`)
      console.log('Combined balances received:', response.data)
      setVaultCombinedBalances(response.data)
    } catch (error) {
      console.error(`Error fetching combined balances:`, error)
    }
  }

  // Rafraîchir le PNL du vault
  const refreshVaultPnl = async (forceRefresh = false) => {
    try {
      console.log('Fetching vault PNL...')
      const url = forceRefresh 
        ? `${API_URL}/vault/pnl?refresh=true`
        : `${API_URL}/vault/pnl`
      const response = await axios.get(url)
      console.log('PNL data received:', response.data)
      setVaultPnlData(response.data)
    } catch (error) {
      console.error(`Error fetching PNL:`, error)
    }
  }

  // Sauvegarder les settings du vault
  const saveVaultSettings = async (settings) => {
    try {
      await axios.post(`${API_URL}/vault/settings`, settings)
      // Recharger le PNL avec les nouveaux settings
      await refreshVaultPnl(true)
    } catch (error) {
      console.error('Error saving vault settings:', error)
      throw error
    }
  }

  // Charger les transactions
  const loadTransactions = async () => {
    try {
      const response = await axios.get(`${API_URL}/vault/transactions`)
      setTransactions(response.data.transactions || [])
    } catch (error) {
      console.error('Error loading transactions:', error)
    }
  }

  // Ajouter une transaction
  const addTransaction = async (transactionData) => {
    try {
      await axios.post(`${API_URL}/vault/transactions`, transactionData)
      await loadTransactions()
      await refreshVaultPnl(true) // Recalculer le PNL
    } catch (error) {
      console.error('Error adding transaction:', error)
      throw error
    }
  }

  // Supprimer une transaction
  const deleteTransaction = async (id) => {
    try {
      await axios.delete(`${API_URL}/vault/transactions/${id}`)
      await loadTransactions()
      await refreshVaultPnl(true) // Recalculer le PNL
    } catch (error) {
      console.error('Error deleting transaction:', error)
      throw error
    }
  }

  // Rafraîchir tous les wallets
  const refreshAllWallets = async () => {
    setIsRefreshing(true)
    try {
      // Rafraîchir le vault avec balances combinées
      const vault = wallets.find(w => w.walletType === 'vault')
      if (vault) {
        await refreshVaultCombined(vault)
        await refreshVaultPnl(true) // Force refresh des prix
      }
      
      // Rafraîchir les executors
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

  // Ajouter un wallet
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

  // Modifier un wallet
  const updateWallet = async (walletId, updates) => {
    try {
      await axios.put(`${API_URL}/wallets/${walletId}`, updates)
      await loadWallets()
    } catch (error) {
      console.error('Error updating wallet:', error)
      throw error
    }
  }

  // Supprimer un wallet
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

  // Récupérer les wallets par type
  const vaultWallet = wallets.find(w => w.walletType === 'vault')
  const executorWallets = wallets.filter(w => w.walletType === 'executor')

  // Afficher un loader pendant la vérification d'auth
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

  // Afficher la page de login si non authentifié
  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg"
      >
        {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/80 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        ${isSidebarCollapsed ? 'w-20' : 'w-60'} 
        bg-[#0a0a0a] border-r border-[#1a1a1a] flex-shrink-0 transition-all duration-300
        fixed lg:static inset-y-0 left-0 z-40
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 h-full relative pb-32">
          {/* Logo + Toggle */}
          <div className="flex items-center justify-between mb-8">
            {!isSidebarCollapsed && (
              <h1 className="text-xl font-bold">Welcome</h1>
            )}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors hidden lg:block"
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <div className="space-y-2">
            <button
              onClick={() => {
                setCurrentView('dashboard')
                setIsMobileMenuOpen(false)
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                currentView === 'dashboard'
                  ? 'bg-[#1f1f1f] text-white'
                  : 'text-gray-500 hover:bg-[#1f1f1f] hover:text-white'
              } ${isSidebarCollapsed ? 'justify-center' : ''}`}
              title="Dashboard"
            >
              <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
              {!isSidebarCollapsed && <span>Dashboard</span>}
            </button>
            <button
              onClick={() => {
                setCurrentView('activity')
                setIsMobileMenuOpen(false)
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                currentView === 'activity'
                  ? 'bg-[#1f1f1f] text-white'
                  : 'text-gray-500 hover:bg-[#1f1f1f] hover:text-white'
              } ${isSidebarCollapsed ? 'justify-center' : ''}`}
              title="Activity"
            >
              <Activity className="w-5 h-5 flex-shrink-0" />
              {!isSidebarCollapsed && <span>Activity</span>}
            </button>
            <button
              onClick={() => {
                setCurrentView('wallets')
                setIsMobileMenuOpen(false)
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                currentView === 'wallets'
                  ? 'bg-[#1f1f1f] text-white'
                  : 'text-gray-500 hover:bg-[#1f1f1f] hover:text-white'
              } ${isSidebarCollapsed ? 'justify-center' : ''}`}
              title="Wallets"
            >
              <Wallet className="w-5 h-5 flex-shrink-0" />
              {!isSidebarCollapsed && <span>Wallets</span>}
            </button>
          </div>

          {/* Logout Button */}
          <div className="absolute bottom-6 left-0 right-0 px-6">
            <button
              onClick={handleLogout}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors text-red-400 hover:bg-red-500/10 border border-red-500/20 ${isSidebarCollapsed ? 'justify-center' : ''}`}
              title="Logout"
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              {!isSidebarCollapsed && <span>Logout</span>}
            </button>
            {!isSidebarCollapsed && user && (
              <div className="mt-3 px-2 text-xs text-gray-600">
                Logged in as <span className="text-gray-400">{user.username}</span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 pt-20 lg:pt-8">
          {/* Header avec boutons Refresh et Add */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-white">
              {currentView === 'dashboard' && 'VAULT'}
              {currentView === 'activity' && 'ACTIVITY'}
              {currentView === 'wallets' && 'WALLETS'}
            </h1>
            <div className="flex gap-3">
              {currentView === 'dashboard' && (
                <button
                  onClick={refreshAllWallets}
                  disabled={isRefreshing}
                  className="w-12 h-12 border-2 border-white/20 hover:border-white/40 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Refresh all wallets"
                >
                  <RefreshCw className={`w-6 h-6 text-white ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
              )}
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="w-12 h-12 border-2 border-white/20 hover:border-white/40 rounded-lg flex items-center justify-center transition-colors"
                title="Add wallet"
              >
                <Plus className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>

          {/* Dashboard View */}
          {currentView === 'dashboard' && (
            <>
              {/* Vault Section */}
              {vaultWallet ? (
                <VaultSection
                  wallet={vaultWallet}
                  combinedBalances={vaultCombinedBalances}
                  pnlData={vaultPnlData}
                  onRefresh={refreshAllWallets}
                  onSaveSettings={saveVaultSettings}
                  onOpenTransactions={() => setIsTransactionsModalOpen(true)}
                  onDelete={() => deleteWallet(vaultWallet.id)}
                />
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <p className="mb-4">No Vault wallet configured</p>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                  >
                    Add Vault Wallet
                  </button>
                </div>
              )}

              {/* Executor Section */}
              {executorWallets.length > 0 && (
                <ExecutorSection
                  wallets={executorWallets}
                  balances={walletBalances}
                  onRefresh={refreshWallet}
                  onDelete={deleteWallet}
                />
              )}
            </>
          )}

          {/* Activity View */}
          {currentView === 'activity' && (
            <div className="bg-[#0a0a0a] rounded-lg p-12 text-center">
              <div className="text-6xl mb-4">📊</div>
              <h2 className="text-2xl font-bold text-white mb-2">Activity Coming Soon</h2>
              <p className="text-gray-400">Transaction history and activity logs will be displayed here</p>
            </div>
          )}

          {/* Wallets Management View */}
          {currentView === 'wallets' && (
            <WalletsManagement
              wallets={wallets}
              onUpdate={updateWallet}
              onDelete={deleteWallet}
            />
          )}
        </div>
      </main>

      {/* Add Wallet Modal */}
      {isAddModalOpen && (
        <AddWalletModal
          onClose={() => setIsAddModalOpen(false)}
          onAdd={addWallet}
          existingVault={!!vaultWallet}
        />
      )}

      {/* Transactions Modal */}
      {isTransactionsModalOpen && (
        <TransactionsModal
          isOpen={isTransactionsModalOpen}
          onClose={() => setIsTransactionsModalOpen(false)}
          transactions={transactions}
          onAddTransaction={addTransaction}
          onDeleteTransaction={deleteTransaction}
        />
      )}
    </div>
  )
}

export default App