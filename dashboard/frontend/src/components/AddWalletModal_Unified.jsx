import { useState } from 'react'
import { X } from 'lucide-react'

function AddWalletModal({ onClose, onAdd, existingVault }) {
  const [formData, setFormData] = useState({
    walletType: 'vault',
    nickname: '',
    addressHL: '',
    addressEVM: '',
    blockchain: 'hyperevm' // Pour les executors
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const walletTypes = [
    { 
      value: 'vault', 
      label: 'Vault', 
      icon: '🏦',
      description: 'Main wallet with combined Hyperliquid + HyperEVM addresses'
    },
    { 
      value: 'executor', 
      label: 'Executor', 
      icon: '⚡',
      description: 'Trading bot wallet (HyperEVM only)'
    }
  ]

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    // Validation
    if (!formData.nickname.trim()) {
      setError('Nickname is required')
      return
    }

    if (formData.walletType === 'vault') {
      if (!formData.addressHL || !formData.addressEVM) {
        setError('Both Hyperliquid and HyperEVM addresses are required for Vault')
        return
      }
      
      // Validation format adresse
      const addressRegex = /^0x[a-fA-F0-9]{40}$/
      if (!addressRegex.test(formData.addressHL)) {
        setError('Invalid Hyperliquid address format')
        return
      }
      if (!addressRegex.test(formData.addressEVM)) {
        setError('Invalid HyperEVM address format')
        return
      }
    } else if (formData.walletType === 'executor') {
      if (!formData.addressEVM) {
        setError('HyperEVM address is required for Executor')
        return
      }
      
      const addressRegex = /^0x[a-fA-F0-9]{40}$/
      if (!addressRegex.test(formData.addressEVM)) {
        setError('Invalid HyperEVM address format')
        return
      }
    }

    setIsSubmitting(true)

    try {
      // Préparer les données selon le type
      let walletData;
      
      if (formData.walletType === 'vault') {
        walletData = {
          walletType: 'vault',
          nickname: formData.nickname,
          addresses: {
            hyperliquid: formData.addressHL,
            hyperevm: formData.addressEVM
          }
        }
      } else {
        walletData = {
          walletType: 'executor',
          nickname: formData.nickname,
          address: formData.addressEVM,
          blockchain: 'hyperevm'
        }
      }

      await onAdd(walletData)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to add wallet')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-[#1a1a1a]">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Add Wallet</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Warning pour Vault existant */}
          {existingVault && formData.walletType === 'vault' && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
              <div className="flex gap-3">
                <div className="text-yellow-400 mt-0.5">⚠️</div>
                <div className="text-sm text-yellow-200">
                  <p className="font-medium mb-1">Replace existing Vault</p>
                  <p>You already have a Vault wallet. Creating a new one will replace the existing Vault.</p>
                </div>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <div className="flex gap-3">
                <div className="text-red-400 mt-0.5">❌</div>
                <div className="text-sm text-red-200">{error}</div>
              </div>
            </div>
          )}

          {/* Wallet Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Wallet Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {walletTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, walletType: type.value })}
                  className={`p-4 rounded-lg border-2 transition-colors text-left ${
                    formData.walletType === type.value
                      ? 'border-white bg-white/10'
                      : 'border-[#1a1a1a] hover:border-white/30'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl">{type.icon}</span>
                    <span className="text-white font-bold">{type.label}</span>
                  </div>
                  <p className="text-xs text-gray-400">{type.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Nickname */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Nickname
            </label>
            <input
              type="text"
              value={formData.nickname}
              onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
              placeholder="My Vault"
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white/30 transition-colors"
              required
            />
          </div>

          {/* Adresses selon le type */}
          {formData.walletType === 'vault' ? (
            <>
              {/* Hyperliquid Address */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Hyperliquid Address
                </label>
                <input
                  type="text"
                  value={formData.addressHL}
                  onChange={(e) => setFormData({ ...formData, addressHL: e.target.value })}
                  placeholder="0x..."
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-white/30 transition-colors"
                  required
                />
              </div>

              {/* HyperEVM Address */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  HyperEVM Address
                </label>
                <input
                  type="text"
                  value={formData.addressEVM}
                  onChange={(e) => setFormData({ ...formData, addressEVM: e.target.value })}
                  placeholder="0x..."
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-white/30 transition-colors"
                  required
                />
              </div>
            </>
          ) : (
            /* Executor - Une seule adresse HyperEVM */
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                HyperEVM Address
              </label>
              <input
                type="text"
                value={formData.addressEVM}
                onChange={(e) => setFormData({ ...formData, addressEVM: e.target.value })}
                placeholder="0x..."
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-white/30 transition-colors"
                required
              />
            </div>
          )}

          {/* Info box */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <div className="flex gap-3">
              <div className="text-blue-400 mt-0.5">ℹ️</div>
              <div className="text-sm text-gray-300">
                {formData.walletType === 'vault' ? (
                  <p>The Vault combines balances from both Hyperliquid and HyperEVM networks for a unified view.</p>
                ) : (
                  <p>Executors are trading bots that operate on HyperEVM only.</p>
                )}
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="p-6 border-t border-[#1a1a1a] flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-3 bg-white text-black font-medium rounded-lg hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Adding...' : 'Add Wallet'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AddWalletModal