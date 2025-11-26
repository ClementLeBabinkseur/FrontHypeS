// server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const WALLETS_FILE = process.env.DATA_DIR 
  ? path.join(process.env.DATA_DIR, 'wallets.json')
  : path.join(__dirname, 'wallets.json');

// Middleware
app.use(cors());
app.use(express.json());

// ============ UTILITY FUNCTIONS ============

// Charger les wallets depuis le fichier JSON
async function loadWallets() {
  try {
    const data = await fs.readFile(WALLETS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // Si le fichier n'existe pas, créer une structure vide
    const initialData = { 
      wallets: [], 
      availableTags: [],
      hyperevmTokenContracts: {
        WETH: '',
        WBTC: '',
        USDT: ''
      }
    };
    await fs.writeFile(WALLETS_FILE, JSON.stringify(initialData, null, 2));
    return initialData;
  }
}

// Sauvegarder les wallets dans le fichier JSON
async function saveWallets(data) {
  await fs.writeFile(WALLETS_FILE, JSON.stringify(data, null, 2));
}

// ============ HYPERLIQUID NATIVE API ============

async function getHyperliquidBalances(address) {
  try {
    // Appel API Hyperliquid pour les données perp (clearinghouseState)
    const perpResponse = await axios.post('https://api.hyperliquid.xyz/info', {
      type: 'clearinghouseState',
      user: address
    });

    const balances = [];
    let totalUSDValue = 0;

    // Balances des positions perp
    if (perpResponse.data.assetPositions && perpResponse.data.assetPositions.length > 0) {
      for (const position of perpResponse.data.assetPositions) {
        const positionValue = parseFloat(position.position.szi) * parseFloat(position.position.entryPx);
        if (Math.abs(positionValue) > 0.01) {
          balances.push({
            token: position.position.coin,
            balance: position.position.szi,
            usdValue: Math.abs(positionValue)
          });
          totalUSDValue += Math.abs(positionValue);
        }
      }
    }

    // Account value (margin)
    if (perpResponse.data.marginSummary) {
      const accountValue = parseFloat(perpResponse.data.marginSummary.accountValue);
      totalUSDValue = accountValue; // Le total est déjà calculé
    }

    // Appel API pour les balances spot
    const spotResponse = await axios.post('https://api.hyperliquid.xyz/info', {
      type: 'spotClearinghouseState',
      user: address
    });

    // Balances spot
    if (spotResponse.data.balances && spotResponse.data.balances.length > 0) {
      for (const balance of spotResponse.data.balances) {
        const total = parseFloat(balance.total);
        if (total > 0.000001) {
          // Convertir @107 en HYPE, etc.
          let tokenName = balance.coin;
          if (balance.coin === '@107') {
            tokenName = 'HYPE';
          }
          
          balances.push({
            token: tokenName,
            balance: balance.total,
            usdValue: null // Prix à récupérer séparément si besoin
          });
        }
      }
    }

    // Ajouter le total USD si disponible
    if (totalUSDValue > 0) {
      balances.push({
        token: 'totalUSD',
        balance: totalUSDValue.toFixed(2),
        usdValue: totalUSDValue
      });
    }

    return balances;
  } catch (error) {
    console.error('Hyperliquid API Error:', error.response?.data || error.message);
    throw new Error(`Failed to fetch Hyperliquid balances: ${error.message}`);
  }
}

// ============ HYPEREVM VIA RPC ============

async function getERC20Balance(contractAddress, walletAddress, hyperevmUrl) {
  try {
    // 1. Get decimals
    const decimalsData = '0x313ce567'; // decimals()
    const decimalsResponse = await axios.post(hyperevmUrl, {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{ to: contractAddress, data: decimalsData }, 'latest']
    });
    
    const decimals = decimalsResponse.data.result ? parseInt(decimalsResponse.data.result, 16) : 18;
    
    // 2. Get symbol
    const symbolData = '0x95d89b41'; // symbol()
    const symbolResponse = await axios.post(hyperevmUrl, {
      jsonrpc: '2.0',
      id: 2,
      method: 'eth_call',
      params: [{ to: contractAddress, data: symbolData }, 'latest']
    });
    
    let symbol = 'UNKNOWN';
    if (symbolResponse.data.result && symbolResponse.data.result !== '0x') {
      // Decode hex string
      const hex = symbolResponse.data.result.slice(2);
      const bytes = [];
      for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
      }
      // Skip first 64 bytes (offset + length), then decode string
      const textBytes = bytes.slice(64).filter(b => b !== 0);
      symbol = String.fromCharCode(...textBytes);
    }
    
    // 3. Get balance
    const balanceData = '0x70a08231' + walletAddress.slice(2).padStart(64, '0'); // balanceOf(address)
    const balanceResponse = await axios.post(hyperevmUrl, {
      jsonrpc: '2.0',
      id: 3,
      method: 'eth_call',
      params: [{ to: contractAddress, data: balanceData }, 'latest']
    });

    if (balanceResponse.data.result) {
      const balance = parseInt(balanceResponse.data.result, 16);
      const readableBalance = balance / Math.pow(10, decimals);
      
      console.log(`💰 ${symbol}: ${readableBalance} (decimals: ${decimals})`);
      
      return {
        symbol,
        balance: readableBalance,
        decimals
      };
    }
    
    return null;
  } catch (error) {
    console.error(`❌ Error fetching ERC20 balance for ${contractAddress}:`, error.message);
    return null;
  }
}

async function getHyperEVMBalances(address) {
  try {
    const hyperevmUrl = 'https://rpc.hyperliquid.xyz/evm';
    const balances = [];

    console.log(`\n🔍 Fetching balances for wallet: ${address}`);

    // Balance HYPE native (comme ETH sur Ethereum)
    const hypeBalance = await axios.post(hyperevmUrl, {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getBalance',
      params: [address, 'latest']
    });

    const hypeValue = parseInt(hypeBalance.data.result, 16) / 1e18; // HYPE a 18 decimales
    if (hypeValue > 0.000001) {
      console.log(`💰 HYPE (native): ${hypeValue}`);
      balances.push({
        token: 'HYPE',
        balance: hypeValue.toFixed(6),
        usdValue: null
      });
    }

    // Adresses hardcodées des tokens ERC-20 sur HyperEVM
    const TOKEN_CONTRACTS = [
      { address: '0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb', expectedSymbol: 'ETH' },
      { address: '0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463', expectedSymbol: 'BTC' },
      { address: '0xbe6727b535545c67d5caa73dea54865b92cf7907', expectedSymbol: 'USDT' }
    ];

    // Mapping des symboles pour normaliser
    const SYMBOL_MAPPING = {
      'UETH': 'ETH',
      'WETH': 'ETH',
      'UBTC': 'BTC',
      'WBTC': 'BTC',
      'USDâ®0': 'USDT',
      'USDâ®0': 'USDT',
      'USDT': 'USDT',
      'USDC' : 'USDC', 
    };

    // Récupérer les balances de chaque token ERC-20
    for (const token of TOKEN_CONTRACTS) {
      const result = await getERC20Balance(token.address, address, hyperevmUrl);
      if (result && result.balance > 0.000001) {
        // Normaliser le symbole
        const normalizedSymbol = SYMBOL_MAPPING[result.symbol] || result.symbol;
        
        balances.push({
          token: normalizedSymbol,
          balance: result.balance.toFixed(6),
          usdValue: null
        });
      }
    }

    console.log(`✅ Total tokens found: ${balances.length}\n`);

    // Calculer le total USD si disponible (pour l'instant on ne l'a pas)
    const totalUSD = balances
      .filter(b => b.usdValue !== null)
      .reduce((sum, b) => sum + b.usdValue, 0);

    if (totalUSD > 0) {
      balances.push({
        token: 'totalUSD',
        balance: totalUSD.toFixed(2),
        usdValue: totalUSD
      });
    }

    return balances;
  } catch (error) {
    console.error('HyperEVM API Error:', error.response?.data || error.message);
    throw new Error('Failed to fetch HyperEVM balances');
  }
}

// ============ ROUTES API ============

// GET tous les wallets
app.get('/api/wallets', async (req, res) => {
  try {
    const data = await loadWallets();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST ajouter un wallet
app.post('/api/wallets', async (req, res) => {
  try {
    const { address, blockchain, nickname, walletType } = req.body;
    
    if (!address || !blockchain || !walletType) {
      return res.status(400).json({ error: 'Address, blockchain and walletType are required' });
    }

    // Validation du walletType
    if (!['vault', 'liquidwallet', 'executor'].includes(walletType)) {
      return res.status(400).json({ error: 'Invalid walletType. Must be vault, liquidwallet or executor' });
    }

    const data = await loadWallets();
    
    // Vérifier si vault ou liquidwallet existe déjà
    if (walletType === 'vault') {
      const existingVault = data.wallets.find(w => w.walletType === 'vault');
      if (existingVault) {
        // Supprimer l'ancien vault
        data.wallets = data.wallets.filter(w => w.walletType !== 'vault');
      }
    }
    
    if (walletType === 'liquidwallet') {
      const existingLiquid = data.wallets.find(w => w.walletType === 'liquidwallet');
      if (existingLiquid) {
        // Supprimer l'ancien liquidwallet
        data.wallets = data.wallets.filter(w => w.walletType !== 'liquidwallet');
      }
    }

    const newWallet = {
      id: Date.now().toString(),
      address,
      blockchain,
      nickname: nickname || `Wallet ${address.slice(0, 6)}...`,
      walletType, // 'vault', 'liquidwallet', 'executor'
      createdAt: new Date().toISOString()
    };

    data.wallets.push(newWallet);
    await saveWallets(data);
    res.json(newWallet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT modifier un wallet
app.put('/api/wallets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const data = await loadWallets();
    const walletIndex = data.wallets.findIndex(w => w.id === id);
    
    if (walletIndex === -1) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    data.wallets[walletIndex] = { ...data.wallets[walletIndex], ...updates };
    
    // Mettre à jour les tags disponibles
    if (updates.tags) {
      updates.tags.forEach(tag => {
        if (!data.availableTags.includes(tag)) {
          data.availableTags.push(tag);
        }
      });
    }

    await saveWallets(data);
    res.json(data.wallets[walletIndex]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE supprimer un wallet
app.delete('/api/wallets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await loadWallets();
    
    data.wallets = data.wallets.filter(w => w.id !== id);
    await saveWallets(data);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET balances d'un wallet
app.get('/api/wallets/:address/balances', async (req, res) => {
  try {
    const { address } = req.params;
    const { blockchain } = req.query;

    if (!blockchain) {
      return res.status(400).json({ error: 'Blockchain parameter is required' });
    }

    let balances;
    
    if (blockchain === 'hyperliquid') {
      balances = await getHyperliquidBalances(address);
    } else if (blockchain === 'hyperevm') {
      balances = await getHyperEVMBalances(address);
    } else {
      return res.status(400).json({ error: 'Unsupported blockchain' });
    }

    // Calculer le total USD
    const totalUSD = balances
      .filter(b => b.usdValue !== null)
      .reduce((sum, b) => sum + b.usdValue, 0);

    res.json({
      address,
      blockchain,
      balances,
      totalUSD: totalUSD > 0 ? totalUSD : null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST créer/modifier des tags
app.post('/api/tags', async (req, res) => {
  try {
    const { tags } = req.body;
    
    if (!Array.isArray(tags)) {
      return res.status(400).json({ error: 'Tags must be an array' });
    }

    const data = await loadWallets();
    
    tags.forEach(tag => {
      if (!data.availableTags.includes(tag)) {
        data.availableTags.push(tag);
      }
    });

    await saveWallets(data);
    res.json({ availableTags: data.availableTags });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET les contrats de tokens ERC-20 configurés
app.get('/api/token-contracts', async (req, res) => {
  try {
    const data = await loadWallets();
    res.json(data.hyperevmTokenContracts || { WETH: '', WBTC: '', USDT: '' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST/PUT sauvegarder les contrats de tokens ERC-20
app.post('/api/token-contracts', async (req, res) => {
  try {
    const { WETH, WBTC, USDT } = req.body;
    
    // Validation des adresses (si fournies)
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (WETH && !addressRegex.test(WETH)) {
      return res.status(400).json({ error: 'Invalid WETH address format' });
    }
    if (WBTC && !addressRegex.test(WBTC)) {
      return res.status(400).json({ error: 'Invalid WBTC address format' });
    }
    if (USDT && !addressRegex.test(USDT)) {
      return res.status(400).json({ error: 'Invalid USDT address format' });
    }

    const data = await loadWallets();
    data.hyperevmTokenContracts = {
      WETH: WETH || '',
      WBTC: WBTC || '',
      USDT: USDT || ''
    };

    await saveWallets(data);
    res.json(data.hyperevmTokenContracts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📊 Wallets file: ${WALLETS_FILE}`);
});