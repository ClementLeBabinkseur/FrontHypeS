import { useState, useEffect } from 'react'
import { Check } from 'lucide-react'

function TokenSelector({ wallet, availableTokens, onUpdate }) {
  const [selectedTokens, setSelectedTokens] = useState(wallet.selectedTokens || [])

  useEffect(() => {
    setSelectedTokens(wallet.selectedTokens || [])
  }, [wallet.selectedTokens])

  const handleToggleToken = (token) => {
    const newSelection = selectedTokens.includes(token)
      ? selectedTokens.filter(t => t !== token)
      : [...selectedTokens, token]
    
    setSelectedTokens(newSelection)
  }

  const handleSave = () => {
    onUpdate({ selectedTokens })
  }

  const allTokens = [...new Set([...availableTokens, 'totalUSD'])]

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-slate-300 mb-3">
          Select tokens to display:
        </h4>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {allTokens.map(token => (
            <button
              key={token}
              onClick={() => handleToggleToken(token)}
              className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                selectedTokens.includes(token)
                  ? 'bg-blue-500/20 border-blue-500/50'
                  : 'bg-slate-800/30 border-slate-700/30 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  token === 'totalUSD' 
                    ? 'bg-gradient-to-br from-green-500 to-emerald-600'
                    : 'bg-gradient-to-br from-blue-500 to-purple-600'
                }`}>
                  {token === 'totalUSD' ? '$' : token.slice(0, 2)}
                </div>
                <span className="font-medium text-white">
                  {token === 'totalUSD' ? 'Total USD Value' : token}
                </span>
              </div>
              {selectedTokens.includes(token) && (
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-lg font-semibold transition-all"
      >
        Save Selection
      </button>
    </div>
  )
}

export default TokenSelector