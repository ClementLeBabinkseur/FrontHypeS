import { useState, useEffect } from 'react'
import axios from 'axios'
import { RefreshCw, Plus, Filter } from 'lucide-react'
import WalletWidget from './components/WalletWidget'
import AddWalletModal from './components/AddWalletModal'
import TagFilter from './components/TagFilter'

// En développement: localhost:3001, en production: via proxy Nginx
const API_URL = import.meta.env.DEV ? 'http://localhost:3001/api' : '/api'

function App() {
  const [wallets, setWallets] = useState([])
  const [availableTags, setAvailableTags] = useState([])
  const [selectedTags, setSelectedTags] = useState([])
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [walletBalances, setWalletBalances] = useState({})

  // Charger les wallets au démarrage
  useEffect(() => {
    loadWallets()
  }, [])

  // Charger les wallets depuis l'API
  const loadWallets = async () => {
    try {
      const response = await axios.get(`${API_URL}/wallets`)
      setWallets(response.data.wallets || [])
      setAvailableTags(response.data.availableTags || [])
    } catch (error) {
      console.error('Error loading wallets:', error)
    }
  }

  // Rafraîchir les balances de tous les wallets
  const refreshAllBalances = async () => {
    setIsRefreshing(true)
    const newBalances = {}
    
    for (const wallet of filteredWallets) {
      try {
        const response = await axios.get(
          `${API_URL}/wallets/${wallet.address}/balances?blockchain=${wallet.blockchain}`
        )
        newBalances[wallet.id] = response.data
      } catch (error) {
        console.error(`Error fetching balance for ${wallet.address}:`, error)
        newBalances[wallet.id] = { error: true }
      }
    }
    
    setWalletBalances(newBalances)
    setIsRefreshing(false)
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

  // Ajouter un wallet
  const addWallet = async (walletData) => {
    try {
      await axios.post(`${API_URL}/wallets`, walletData)
      await loadWallets()
      setIsAddModalOpen(false)
    } catch (error) {
      console.error('Error adding wallet:', error)
    }
  }

  // Supprimer un wallet
  const deleteWallet = async (walletId) => {
    try {
      await axios.delete(`${API_URL}/wallets/${walletId}`)
      await loadWallets()
      // Retirer les balances du wallet supprimé
      setWalletBalances(prev => {
        const newBalances = { ...prev }
        delete newBalances[walletId]
        return newBalances
      })
    } catch (error) {
      console.error('Error deleting wallet:', error)
    }
  }

  // Mettre à jour un wallet
  const updateWallet = async (walletId, updates) => {
    try {
      await axios.put(`${API_URL}/wallets/${walletId}`, updates)
      await loadWallets()
    } catch (error) {
      console.error('Error updating wallet:', error)
    }
  }

  // Filtrer les wallets par tags
  const filteredWallets = selectedTags.length === 0 
    ? wallets 
    : wallets.filter(wallet => 
        selectedTags.some(tag => wallet.tags.includes(tag))
      )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/10 to-slate-900 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="glass rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-4xl font-bold gradient-text mb-2">
                Hyperliquid Dashboard
              </h1>
              <p className="text-slate-400">
                Track your wallets across Hyperliquid & Ethereum
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={refreshAllBalances}
                disabled={isRefreshing}
                className="glass glass-hover px-6 py-3 rounded-xl font-semibold flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh All
              </button>
              
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 px-6 py-3 rounded-xl font-semibold flex items-center gap-2 shadow-lg shadow-purple-500/50 transition-all"
              >
                <Plus className="w-5 h-5" />
                Add Wallet
              </button>
            </div>
          </div>

          {/* Tag Filter */}
          {availableTags.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-700/50">
              <TagFilter
                availableTags={availableTags}
                selectedTags={selectedTags}
                onTagsChange={setSelectedTags}
              />
            </div>
          )}
        </div>
      </div>

      {/* Wallets Grid */}
      <div className="max-w-7xl mx-auto">
        {filteredWallets.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <div className="text-slate-500 mb-4">
              <Filter className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-xl">No wallets found</p>
              <p className="text-sm mt-2">
                {selectedTags.length > 0 
                  ? 'Try changing your filters or add a new wallet'
                  : 'Add your first wallet to get started'}
              </p>
            </div>
            {selectedTags.length === 0 && (
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="mt-6 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 px-8 py-3 rounded-xl font-semibold transition-all"
              >
                Add Your First Wallet
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredWallets.map(wallet => (
              <WalletWidget
                key={wallet.id}
                wallet={wallet}
                balances={walletBalances[wallet.id]}
                onRefresh={() => refreshWallet(wallet)}
                onDelete={() => deleteWallet(wallet.id)}
                onUpdate={(updates) => updateWallet(wallet.id, updates)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Wallet Modal */}
      {isAddModalOpen && (
        <AddWalletModal
          onClose={() => setIsAddModalOpen(false)}
          onAdd={addWallet}
          existingTags={availableTags}
        />
      )}
    </div>
  )
}

export default App