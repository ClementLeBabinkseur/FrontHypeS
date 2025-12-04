import { useState, useEffect } from 'react'
import { X, DollarSign, Calendar } from 'lucide-react'

function VaultSettingsModal({ isOpen, onClose, onSave, currentSettings, currentValue, pnlData }) {
  const [formData, setFormData] = useState({
    initialInvestmentUSD: 5000,
    initialDate: new Date().toISOString().split('T')[0]
  })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (currentSettings) {
      setFormData({
        initialInvestmentUSD: currentSettings.initialInvestmentUSD || 5000,
        initialDate: currentSettings.initialDate 
          ? new Date(currentSettings.initialDate).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0]
      })
    }
  }, [currentSettings, isOpen])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(formData)
      onClose()
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  // Calculer le PNL preview
  const previewPnl = currentValue - formData.initialInvestmentUSD
  const previewPercent = formData.initialInvestmentUSD > 0 
    ? (previewPnl / formData.initialInvestmentUSD) * 100 
    : 0

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg max-w-xl w-full">
        {/* Header */}
        <div className="p-6 border-b border-[#1a1a1a]">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Vault Settings</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Initial Investment */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
              <DollarSign className="w-4 h-4" />
              Initial Investment (USD)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.initialInvestmentUSD}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  initialInvestmentUSD: parseFloat(e.target.value) || 0 
                })}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg pl-10 pr-4 py-3 text-white text-lg font-bold focus:outline-none focus:border-white/30 transition-colors"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              The amount you initially invested in this vault
            </p>
          </div>

          {/* Start Date */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
              <Calendar className="w-4 h-4" />
              Start Date
            </label>
            <input
              type="date"
              value={formData.initialDate}
              onChange={(e) => setFormData({ ...formData, initialDate: e.target.value })}
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white/30 transition-colors"
            />
            <p className="text-xs text-gray-500 mt-1">
              When did you start tracking this vault
            </p>
          </div>

          {/* Preview Section */}
          <div className="bg-[#1a1a1a] rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-medium text-gray-400 uppercase">Preview</h3>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Current Value:</span>
              <span className="text-white font-bold text-lg">
                ${currentValue?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-400">Initial Investment:</span>
              <span className="text-white font-medium">
                ${formData.initialInvestmentUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="border-t border-[#2a2a2a] pt-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">PNL:</span>
                <div className="text-right">
                  <div className={`text-lg font-bold ${previewPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {previewPnl >= 0 ? '+' : ''}{previewPercent.toFixed(2)}%
                  </div>
                  <div className={`text-sm ${previewPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {previewPnl >= 0 ? '+' : ''}${Math.abs(previewPnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <div className="flex gap-3">
              <div className="text-blue-400 mt-0.5">ℹ️</div>
              <div className="text-sm text-gray-300">
                <p className="font-medium mb-1">How PNL is calculated</p>
                <p>PNL = Current Value - Initial Investment</p>
                <p className="text-xs text-gray-400 mt-2">
                  The current value is calculated by fetching real-time prices for all your tokens (HYPE, ETH, BTC, USDT) and multiplying by your balances.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#1a1a1a] flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || formData.initialInvestmentUSD <= 0}
            className="px-6 py-3 bg-white text-black font-medium rounded-lg hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default VaultSettingsModal