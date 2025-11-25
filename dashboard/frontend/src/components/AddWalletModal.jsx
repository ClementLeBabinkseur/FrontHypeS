import { useState } from 'react'
import { X, Wallet, Droplet, Zap } from 'lucide-react'

function AddWalletModal({ onClose, onAdd, existingVault, existingLiquidWallet }) {
  const [step, setStep] = useState(1) // 1: Choose type, 2: Enter details
  const [walletType, setWalletType] = useState(null)
  const [formData, setFormData] = useState({
    address: '',
    blockchain: '',
    nickname: ''
  })
  const [error, setError] = useState('')
  const [showReplaceWarning, setShowReplaceWarning] = useState(false)

  const handleTypeSelect = (type) => {
    setWalletType(type)
    
    // Set blockchain based on type
    if (type === 'vault' || type === 'executor') {
      setFormData(prev => ({ ...prev, blockchain: 'hyperevm' }))
    } else if (type === 'liquidwallet') {
      setFormData(prev => ({ ...prev, blockchain: 'hyperliquid' }))
    }

    // Check if replacing
    if ((type === 'vault' && existingVault) || (type === 'liquidwallet' && existingLiquidWallet)) {
      setShowReplaceWarning(true)
    } else {
      setStep(2)
    }
  }

  const handleConfirmReplace = () => {
    setShowReplaceWarning(false)
    setStep(2)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validation
    if (!formData.address.trim()) {
      setError('Address is required')
      return
    }
    
    if (!formData.address.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError('Invalid address format (must be 0x followed by 40 hex characters)')
      return
    }

    try {
      await onAdd({
        ...formData,
        walletType
      })
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add wallet')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-8 max-w-2xl w-full shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">
            {step === 1 ? 'Select Wallet Type' : `Add ${walletType} Wallet`}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Replace Warning */}
        {showReplaceWarning && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-yellow-500 font-medium mb-3">
              ⚠️ A {walletType} wallet already exists. Adding a new one will replace it.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowReplaceWarning(false)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReplace}
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 rounded-lg text-black font-medium transition-colors"
              >
                Replace Existing
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Choose Type */}
        {step === 1 && !showReplaceWarning && (
          <div className="grid grid-cols-3 gap-4">
            {/* Vault */}
            <button
              onClick={() => handleTypeSelect('vault')}
              className="p-6 bg-[#1a1a1a] hover:bg-[#222] border-2 border-transparent hover:border-purple-500/50 rounded-xl transition-all"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                  <Wallet className="w-8 h-8 text-white" />
                </div>
                <div>
                  <div className="text-white font-bold mb-1">Vault</div>
                  <div className="text-xs text-gray-500">Main wallet</div>
                  <div className="text-xs text-gray-500">HyperEVM</div>
                  {existingVault && (
                    <div className="text-xs text-yellow-500 mt-1">⚠️ Exists</div>
                  )}
                </div>
              </div>
            </button>

            {/* LiquidWallet */}
            <button
              onClick={() => handleTypeSelect('liquidwallet')}
              className="p-6 bg-[#1a1a1a] hover:bg-[#222] border-2 border-transparent hover:border-blue-500/50 rounded-xl transition-all"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center">
                  <Droplet className="w-8 h-8 text-white" />
                </div>
                <div>
                  <div className="text-white font-bold mb-1">LiquidWallet</div>
                  <div className="text-xs text-gray-500">Secondary wallet</div>
                  <div className="text-xs text-gray-500">Hyperliquid</div>
                  {existingLiquidWallet && (
                    <div className="text-xs text-yellow-500 mt-1">⚠️ Exists</div>
                  )}
                </div>
              </div>
            </button>

            {/* Executor */}
            <button
              onClick={() => handleTypeSelect('executor')}
              className="p-6 bg-[#1a1a1a] hover:bg-[#222] border-2 border-transparent hover:border-green-500/50 rounded-xl transition-all"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                  <Zap className="w-8 h-8 text-white" />
                </div>
                <div>
                  <div className="text-white font-bold mb-1">Executor</div>
                  <div className="text-xs text-gray-500">Trading bot</div>
                  <div className="text-xs text-gray-500">HyperEVM</div>
                  <div className="text-xs text-green-500 mt-1">✓ Unlimited</div>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Step 2: Enter Details */}
        {step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Address */}
            <div>
              <label className="block text-sm font-semibold mb-2 text-gray-300">
                Wallet Address *
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => {
                  setFormData({ ...formData, address: e.target.value })
                  setError('')
                }}
                placeholder="0x..."
                className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#333] rounded-lg focus:outline-none focus:border-white/50 transition-colors text-white font-mono text-sm"
              />
            </div>

            {/* Nickname */}
            <div>
              <label className="block text-sm font-semibold mb-2 text-gray-300">
                Nickname (optional)
              </label>
              <input
                type="text"
                value={formData.nickname}
                onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                placeholder={walletType === 'executor' ? 'Bot #1' : 'My Wallet'}
                className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#333] rounded-lg focus:outline-none focus:border-white/50 transition-colors text-white"
              />
            </div>

            {/* Info */}
            <div className="p-3 bg-white/5 rounded-lg text-sm text-gray-400">
              <div className="flex items-start gap-2">
                <div className="mt-0.5">ℹ️</div>
                <div>
                  <strong className="text-white">Blockchain:</strong> {formData.blockchain === 'hyperevm' ? 'HyperEVM' : 'Hyperliquid'}<br />
                  <strong className="text-white">Tokens tracked:</strong> {walletType === 'executor' ? 'HYPE only' : 'HYPE, ETH, BTC, USDT'}
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg font-semibold text-white transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-white hover:bg-gray-200 rounded-lg font-semibold text-black transition-colors"
              >
                Add Wallet
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default AddWalletModal