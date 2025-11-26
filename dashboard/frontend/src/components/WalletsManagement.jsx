import { useState } from 'react'
import { Trash2, Edit2, Check, X } from 'lucide-react'

function WalletsManagement({ wallets, onUpdate, onDelete }) {
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})

  // Emojis pour les types de wallets
  const walletTypeEmojis = {
    'vault': '🏦',
    'liquidwallet': '💧',
    'executor': '⚡'
  }

  const walletTypeLabels = {
    'vault': 'Vault',
    'liquidwallet': 'Liquid Wallet',
    'executor': 'Executor'
  }

  const blockchainLabels = {
    'hyperevm': 'HyperEVM',
    'hyperliquid': 'Hyperliquid'
  }

  const startEdit = (wallet) => {
    setEditingId(wallet.id)
    setEditForm({
      nickname: wallet.nickname || '',
      address: wallet.address || ''
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({})
  }

  const saveEdit = async (walletId) => {
    try {
      await onUpdate(walletId, editForm)
      setEditingId(null)
      setEditForm({})
    } catch (error) {
      console.error('Error updating wallet:', error)
      alert('Failed to update wallet')
    }
  }

  const handleDelete = async (wallet) => {
    const walletName = wallet.nickname || `${wallet.address.slice(0, 8)}...`
    const confirm = window.confirm(`Are you sure you want to delete "${walletName}"?`)
    
    if (confirm) {
      try {
        await onDelete(wallet.id)
      } catch (error) {
        console.error('Error deleting wallet:', error)
        alert('Failed to delete wallet')
      }
    }
  }

  if (wallets.length === 0) {
    return (
      <div className="bg-[#0a0a0a] rounded-lg p-12 text-center">
        <div className="text-6xl mb-4">💼</div>
        <h2 className="text-2xl font-bold text-white mb-2">No Wallets Yet</h2>
        <p className="text-gray-400">Click the + button to add your first wallet</p>
      </div>
    )
  }

  return (
    <div className="bg-[#0a0a0a] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-12 gap-4 p-4 border-b border-[#1a1a1a] text-sm text-gray-500 uppercase font-medium">
        <div className="col-span-1">Type</div>
        <div className="col-span-3">Nickname</div>
        <div className="col-span-4">Address</div>
        <div className="col-span-2">Blockchain</div>
        <div className="col-span-2 text-right">Actions</div>
      </div>

      {/* Wallets List */}
      <div className="divide-y divide-[#1a1a1a]">
        {wallets.map((wallet) => (
          <div
            key={wallet.id}
            className="grid grid-cols-12 gap-4 p-4 hover:bg-white/5 transition-colors items-center"
          >
            {/* Type */}
            <div className="col-span-1">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{walletTypeEmojis[wallet.walletType]}</span>
              </div>
            </div>

            {/* Nickname */}
            <div className="col-span-3">
              {editingId === wallet.id ? (
                <input
                  type="text"
                  value={editForm.nickname}
                  onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30"
                  placeholder="Nickname"
                />
              ) : (
                <div>
                  <div className="text-white font-medium">{wallet.nickname || 'Unnamed'}</div>
                  <div className="text-xs text-gray-500">{walletTypeLabels[wallet.walletType]}</div>
                </div>
              )}
            </div>

            {/* Address */}
            <div className="col-span-4">
              {editingId === wallet.id ? (
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-white/30"
                  placeholder="0x..."
                />
              ) : (
                <div className="font-mono text-sm text-gray-300">{wallet.address}</div>
              )}
            </div>

            {/* Blockchain */}
            <div className="col-span-2">
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/10 text-white text-xs font-medium">
                {blockchainLabels[wallet.blockchain]}
              </div>
            </div>

            {/* Actions */}
            <div className="col-span-2 flex justify-end gap-2">
              {editingId === wallet.id ? (
                <>
                  <button
                    onClick={() => saveEdit(wallet.id)}
                    className="p-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors"
                    title="Save changes"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                    title="Cancel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => startEdit(wallet)}
                    className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                    title="Edit wallet"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(wallet)}
                    className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                    title="Delete wallet"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-[#1a1a1a] text-sm text-gray-500 text-center">
        {wallets.length} wallet{wallets.length !== 1 ? 's' : ''} total
      </div>
    </div>
  )
}

export default WalletsManagement