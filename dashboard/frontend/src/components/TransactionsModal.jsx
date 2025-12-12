import { useState } from 'react'
import { X, Plus, Trash2, TrendingUp, TrendingDown } from 'lucide-react'

function TransactionsModal({ isOpen, onClose, transactions, onAddTransaction, onDeleteTransaction }) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    type: 'deposit',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    note: ''
  })
  const [isSaving, setIsSaving] = useState(false)

  const handleAdd = async () => {
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      alert('Please enter a valid amount')
      return
    }

    setIsSaving(true)
    try {
      await onAddTransaction(formData)
      setFormData({
        type: 'deposit',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        note: ''
      })
      setShowAddForm(false)
    } catch (error) {
      console.error('Error adding transaction:', error)
      alert('Failed to add transaction')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this transaction?')) {
      return
    }

    try {
      await onDeleteTransaction(id)
    } catch (error) {
      console.error('Error deleting transaction:', error)
      alert('Failed to delete transaction')
    }
  }

  // Calculer le total investi
  const totalInvestment = transactions.reduce((sum, t) => {
    return t.type === 'deposit' ? sum + t.amount : sum - t.amount
  }, 0)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-[#1a1a1a] sticky top-0 bg-[#0a0a0a] z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Transactions</h2>
              <p className="text-sm text-gray-500 mt-1">
                Track deposits and withdrawals
              </p>
            </div>
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
          {/* Total Investment */}
          <div className="bg-[#1a1a1a] rounded-lg p-4">
            <div className="text-sm text-gray-500 mb-1">Total Investment</div>
            <div className="text-3xl font-bold text-white">
              ${totalInvestment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Based on {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Add Transaction Button */}
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full py-3 px-4 bg-white text-black font-medium rounded-lg hover:bg-white/90 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Transaction
            </button>
          )}

          {/* Add Transaction Form */}
          {showAddForm && (
            <div className="bg-[#1a1a1a] rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">New Transaction</h3>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Type
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setFormData({ ...formData, type: 'deposit' })}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                      formData.type === 'deposit'
                        ? 'bg-green-500/20 text-green-400 border-2 border-green-500'
                        : 'bg-white/5 text-gray-400 border-2 border-transparent hover:border-white/20'
                    }`}
                  >
                    <TrendingUp className="w-5 h-5" />
                    Deposit
                  </button>
                  <button
                    onClick={() => setFormData({ ...formData, type: 'withdrawal' })}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                      formData.type === 'withdrawal'
                        ? 'bg-red-500/20 text-red-400 border-2 border-red-500'
                        : 'bg-white/5 text-gray-400 border-2 border-transparent hover:border-white/20'
                    }`}
                  >
                    <TrendingDown className="w-5 h-5" />
                    Withdrawal
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Amount (USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white/30"
                  placeholder="0.00"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white/30"
                />
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Note (optional)
                </label>
                <input
                  type="text"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white/30"
                  placeholder="e.g., Initial investment, Added funds, Profit taken..."
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={isSaving || !formData.amount}
                  className="flex-1 py-3 px-4 bg-white text-black font-medium rounded-lg hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Adding...' : 'Add Transaction'}
                </button>
              </div>
            </div>
          )}

          {/* Transactions List */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase mb-3">
              Transaction History
            </h3>
            
            {transactions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-3">📊</div>
                <div className="text-lg font-medium">No transactions yet</div>
                <div className="text-sm mt-1">Add your first deposit to get started</div>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="bg-[#1a1a1a] rounded-lg p-4 flex items-center justify-between hover:bg-[#1f1f1f] transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        transaction.type === 'deposit'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {transaction.type === 'deposit' ? (
                          <TrendingUp className="w-5 h-5" />
                        ) : (
                          <TrendingDown className="w-5 h-5" />
                        )}
                      </div>

                      {/* Details */}
                      <div>
                        <div className="flex items-center gap-3">
                          <span className={`font-bold ${
                            transaction.type === 'deposit' ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {transaction.type === 'deposit' ? '+' : '-'}${transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-sm text-gray-500">
                            {new Date(transaction.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                        {transaction.note && (
                          <div className="text-sm text-gray-500 mt-1">
                            {transaction.note}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDelete(transaction.id)}
                      className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Delete transaction"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#1a1a1a] sticky bottom-0 bg-[#0a0a0a] z-10">
          <button
            onClick={onClose}
            className="w-full py-3 px-4 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default TransactionsModal