import { useState, useEffect } from 'react'
import axios from 'axios'
import { Plus, LayoutDashboard, Activity } from 'lucide-react'
import VaultSection from './components/VaultSection'
import LiquidWalletSection from './components/LiquidWalletSection'
import ExecutorSection from './components/ExecutorSection'
import AddWalletModal from './components/AddWalletModal'

// En développement: localhost:3001, en production: via proxy Nginx
const API_URL = import.meta.env.DEV ? 'http://localhost:3001/api' : '/api'

function App() {
  const [wallets, setWallets] = useState([])
  const [walletBalances, setWalletBalances] = useState({})
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Charger les wallets au démarrage
  useEffect(() => {
    loadWallets()
  }, [])

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

  // Rafraîchir tous les wallets
  const refreshAllWallets = async () => {
    setIsRefreshing(true)
    for (const wallet of wallets) {
      await refreshWallet(wallet)
    }
    setIsRefreshing(false)
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
  const liquidWallet = wallets.find(w => w.walletType === 'liquidwallet')
  const executorWallets = wallets.filter(w => w.walletType === 'executor')

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex">
      {/* Sidebar */}
      <aside className="w-60 bg-[#0a0a0a] border-r border-[#1a1a1a] flex-shrink-0">
        <div className="p-6">
          <div className="space-y-2">
            <button className="w-full flex items-center gap-3 px-4 py-3 bg-[#1f1f1f] rounded-lg text-white font-medium">
              <LayoutDashboard className="w-5 h-5" />
              Dashboard
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-500 hover:bg-[#1f1f1f] rounded-lg transition-colors">
              <Activity className="w-5 h-5" />
              Activity
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-8">
          {/* Header avec bouton + */}
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold text-white">VAULT</h1>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="w-12 h-12 border-2 border-white/20 hover:border-white/40 rounded-lg flex items-center justify-center transition-colors"
            >
              <Plus className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* Vault Section */}
          {vaultWallet ? (
            <VaultSection
              wallet={vaultWallet}
              balances={walletBalances[vaultWallet.id]}
              onRefresh={() => refreshWallet(vaultWallet)}
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

          {/* LiquidWallet Section */}
          {liquidWallet && (
            <LiquidWalletSection
              wallet={liquidWallet}
              balances={walletBalances[liquidWallet.id]}
              onRefresh={() => refreshWallet(liquidWallet)}
              onDelete={() => deleteWallet(liquidWallet.id)}
            />
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
        </div>
      </main>

      {/* Add Wallet Modal */}
      {isAddModalOpen && (
        <AddWalletModal
          onClose={() => setIsAddModalOpen(false)}
          onAdd={addWallet}
          existingVault={!!vaultWallet}
          existingLiquidWallet={!!liquidWallet}
        />
      )}
    </div>
  )
}

export default App