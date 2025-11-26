import { useState, useEffect } from 'react'

function TokenContractsModal({ isOpen, onClose, onSave, currentContracts }) {
  const [contracts, setContracts] = useState({
    WETH: '',
    WBTC: '',
    USDT: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (currentContracts) {
      setContracts({
        WETH: currentContracts.WETH || '',
        WBTC: currentContracts.WBTC || '',
        USDT: currentContracts.USDT || ''
      })
    }
  }, [currentContracts, isOpen])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(contracts)
      onClose()
    } catch (error) {
      console.error('Error saving contracts:', error)
      alert('Failed to save contract addresses')
    } finally {
      setSaving(false)
    }
  }

  const isValidAddress = (address) => {
    return address === '' || /^0x[a-fA-F0-9]{40}$/.test(address)
  }

  const allValid = isValidAddress(contracts.WETH) && 
                   isValidAddress(contracts.WBTC) && 
                   isValidAddress(contracts.USDT)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-[#1a1a1a]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">HyperEVM Token Contracts</h2>
              <p className="text-gray-400 mt-1">Configure ERC-20 contract addresses for ETH, BTC, and USDT</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Info Box */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <div className="flex gap-3">
              <div className="text-blue-400 mt-0.5">ℹ️</div>
              <div className="text-sm text-gray-300">
                <p className="font-medium mb-1">Why do I need this?</p>
                <p>On HyperEVM, ETH, BTC, and USDT are ERC-20 tokens. To fetch their balances, we need their contract addresses. You can find these on <a href="https://explorer.hyperliquid.xyz" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">HyperLiquid Explorer</a>.</p>
              </div>
            </div>
          </div>

          {/* WETH Contract */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
              <span className="text-xl">⚪</span>
              WETH (Wrapped ETH) Contract Address
            </label>
            <input
              type="text"
              value={contracts.WETH}
              onChange={(e) => setContracts({ ...contracts, WETH: e.target.value })}
              placeholder="0x..."
              className={`w-full bg-[#1a1a1a] border ${
                !isValidAddress(contracts.WETH) ? 'border-red-500' : 'border-[#2a2a2a]'
              } rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white/30 transition-colors font-mono text-sm`}
            />
            {!isValidAddress(contracts.WETH) && contracts.WETH && (
              <p className="text-red-400 text-xs mt-1">Invalid Ethereum address format</p>
            )}
          </div>

          {/* WBTC Contract */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
              <span className="text-xl">🟠</span>
              WBTC (Wrapped BTC) Contract Address
            </label>
            <input
              type="text"
              value={contracts.WBTC}
              onChange={(e) => setContracts({ ...contracts, WBTC: e.target.value })}
              placeholder="0x..."
              className={`w-full bg-[#1a1a1a] border ${
                !isValidAddress(contracts.WBTC) ? 'border-red-500' : 'border-[#2a2a2a]'
              } rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white/30 transition-colors font-mono text-sm`}
            />
            {!isValidAddress(contracts.WBTC) && contracts.WBTC && (
              <p className="text-red-400 text-xs mt-1">Invalid Ethereum address format</p>
            )}
          </div>

          {/* USDT Contract */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
              <span className="text-xl">🟢</span>
              USDT Contract Address
            </label>
            <input
              type="text"
              value={contracts.USDT}
              onChange={(e) => setContracts({ ...contracts, USDT: e.target.value })}
              placeholder="0x..."
              className={`w-full bg-[#1a1a1a] border ${
                !isValidAddress(contracts.USDT) ? 'border-red-500' : 'border-[#2a2a2a]'
              } rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white/30 transition-colors font-mono text-sm`}
            />
            {!isValidAddress(contracts.USDT) && contracts.USDT && (
              <p className="text-red-400 text-xs mt-1">Invalid Ethereum address format</p>
            )}
          </div>

          {/* Note */}
          <div className="text-xs text-gray-500">
            <p>💡 Leave empty to skip fetching that token's balance</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#1a1a1a] flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!allValid || saving}
            className="px-4 py-2 bg-white text-black font-medium rounded-lg hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Contracts'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default TokenContractsModal