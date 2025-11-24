import { useState } from 'react'
import { X, Plus } from 'lucide-react'

function AddWalletModal({ onClose, onAdd, existingTags }) {
  const [formData, setFormData] = useState({
    address: '',
    blockchain: 'hyperliquid',
    nickname: '',
    tags: [],
    widgetType: 'card' // 'card' ou 'line'
  })
  const [newTag, setNewTag] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
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

    onAdd(formData)
  }

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }))
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const handleSelectExistingTag = (tag) => {
    if (!formData.tags.includes(tag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="glass rounded-2xl p-8 max-w-md w-full shadow-2xl glow">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold gradient-text">Add New Wallet</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Address */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-slate-300">
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
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 transition-colors font-mono text-sm"
            />
          </div>

          {/* Blockchain */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-slate-300">
              Blockchain *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, blockchain: 'hyperliquid' })}
                className={`p-3 rounded-lg border-2 transition-all ${
                  formData.blockchain === 'hyperliquid'
                    ? 'border-purple-500 bg-purple-500/20'
                    : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
                }`}
              >
                <span className="font-semibold">⚡ Hyperliquid</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, blockchain: 'hyperevm' })}
                className={`p-3 rounded-lg border-2 transition-all ${
                  formData.blockchain === 'hyperevm'
                    ? 'border-blue-500 bg-blue-500/20'
                    : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
                }`}
              >
                <span className="font-semibold">🔷 HyperEVM</span>
              </button>
            </div>
          </div>

          {/* Nickname */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-slate-300">
              Nickname (optional)
            </label>
            <input
              type="text"
              value={formData.nickname}
              onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
              placeholder="My Trading Wallet"
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Widget Type */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-slate-300">
              Widget Display Type *
            </label>
            <p className="text-xs text-slate-400 mb-3">
              Choose how you want this wallet to be displayed
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, widgetType: 'card' })}
                className={`p-4 rounded-lg border-2 transition-all ${
                  formData.widgetType === 'card'
                    ? 'border-blue-500 bg-blue-500/20'
                    : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <span className="text-xl">▦</span>
                  </div>
                  <span className="font-semibold text-sm">Card</span>
                  <span className="text-xs text-slate-400 text-center">Full details with all tokens</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, widgetType: 'line' })}
                className={`p-4 rounded-lg border-2 transition-all ${
                  formData.widgetType === 'line'
                    ? 'border-green-500 bg-green-500/20'
                    : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                    <span className="text-xl">▬</span>
                  </div>
                  <span className="font-semibold text-sm">Line</span>
                  <span className="text-xs text-slate-400 text-center">Compact, one token only</span>
                </div>
              </button>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-slate-300">
              Tags
            </label>
            
            {/* Selected Tags */}
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {formData.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-full text-sm font-semibold flex items-center gap-2"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-red-400 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Add New Tag */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                placeholder="Add tag..."
                className="flex-1 px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 transition-colors text-sm"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Existing Tags */}
            {existingTags.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-slate-500 mb-2">Or select existing:</p>
                <div className="flex flex-wrap gap-2">
                  {existingTags.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleSelectExistingTag(tag)}
                      disabled={formData.tags.includes(tag)}
                      className="px-3 py-1 text-xs bg-slate-800/50 border border-slate-700 rounded-full hover:border-blue-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
              onClick={onClose}
              className="flex-1 px-6 py-3 glass glass-hover rounded-xl font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-xl font-semibold shadow-lg shadow-purple-500/50 transition-all"
            >
              Add Wallet
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddWalletModal