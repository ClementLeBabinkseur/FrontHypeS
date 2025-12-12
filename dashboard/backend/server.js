// server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const WALLETS_FILE = process.env.DATA_DIR 
  ? path.join(process.env.DATA_DIR, 'wallets.json')
  : path.join(__dirname, 'wallets.json');

// Middleware
app.use(cors());
app.use(express.json());

console.log('🚀 Hyperliquid Dashboard Backend starting...');
console.log(`📁 Data file: ${WALLETS_FILE}`);

// ============ PRICE CACHE ============

let priceCache = {
  prices: null,
  lastUpdate: null,
  TTL: 5 * 60 * 1000 // 5 minutes
};

// Mapping des symboles vers IDs CoinGecko
const COINGECKO_IDS = {
  'HYPE': 'hyperliquid',
  'ETH': 'ethereum',
  'BTC': 'bitcoin',
  'USDT': 'tether'
};

// Récupérer les prix depuis CoinGecko
async function fetchPricesFromCoinGecko() {
  try {
    const ids = Object.values(COINGECKO_IDS).join(',');
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
    
    console.log('🔍 Fetching prices from CoinGecko...');
    const response = await axios.get(url);
    
    // Mapper les IDs CoinGecko vers nos symboles
    const prices = {};
    for (const [symbol, coinGeckoId] of Object.entries(COINGECKO_IDS)) {
      if (response.data[coinGeckoId]) {
        prices[symbol] = response.data[coinGeckoId].usd;
      }
    }
    
    console.log('💰 Prices fetched:', prices);
    return prices;
  } catch (error) {
    console.error('❌ Error fetching prices from CoinGecko:', error.message);
    
    // Fallback prices en cas d'erreur
    return {
      'HYPE': 25.0,
      'ETH': 2300.0,
      'BTC': 43000.0,
      'USDT': 1.0,
      'USDC': 1.0
    };
  }
}

// Récupérer les prix (avec cache)
async function getPrices(forceRefresh = false) {
  const now = Date.now();
  
  // Retourner le cache si valide et pas de force refresh
  if (!forceRefresh && priceCache.prices && (now - priceCache.lastUpdate) < priceCache.TTL) {
    console.log('📦 Using cached prices');
    return priceCache.prices;
  }
  
  // Sinon, fetch nouveaux prix
  const prices = await fetchPricesFromCoinGecko();
  priceCache.prices = prices;
  priceCache.lastUpdate = now;
  
  return prices;
}

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
        USDT: '',
        USDC: '',
      },
      vaultSettings: {
        initialInvestmentUSD: 5000,
        initialDate: new Date().toISOString()
      },
      pnlHistory: []
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
    const { address, addresses, blockchain, nickname, walletType } = req.body;
    
    if (!walletType) {
      return res.status(400).json({ error: 'walletType is required' });
    }

    // Validation du walletType
    if (!['vault', 'executor'].includes(walletType)) {
      return res.status(400).json({ error: 'Invalid walletType. Must be vault or executor' });
    }

    const data = await loadWallets();
    
    // Vérifier si vault existe déjà
    if (walletType === 'vault') {
      const existingVault = data.wallets.find(w => w.walletType === 'vault');
      if (existingVault) {
        // Supprimer l'ancien vault
        data.wallets = data.wallets.filter(w => w.walletType !== 'vault');
      }
    }

    let newWallet;

    if (walletType === 'vault') {
      // Vault avec deux adresses
      if (!addresses || !addresses.hyperliquid || !addresses.hyperevm) {
        return res.status(400).json({ error: 'Vault requires both hyperliquid and hyperevm addresses' });
      }

      newWallet = {
        id: Date.now().toString(),
        walletType: 'vault',
        nickname: nickname || 'Vault',
        addresses: {
          hyperliquid: addresses.hyperliquid,
          hyperevm: addresses.hyperevm
        },
        createdAt: new Date().toISOString()
      };
    } else {
      // Executor avec une seule adresse
      if (!address || !blockchain) {
        return res.status(400).json({ error: 'Executor requires address and blockchain' });
      }

      newWallet = {
        id: Date.now().toString(),
        address,
        blockchain,
        nickname: nickname || `Executor ${address.slice(0, 6)}...`,
        walletType: 'executor',
        createdAt: new Date().toISOString()
      };
    }

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

// GET balances combinées d'un vault (Hyperliquid + HyperEVM)
app.get('/api/wallets/:id/combined-balances', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await loadWallets();
    const wallet = data.wallets.find(w => w.id === id);
    
    if (!wallet || wallet.walletType !== 'vault') {
      return res.status(404).json({ error: 'Vault not found' });
    }

    // Vérifier que le wallet a les deux adresses
    if (!wallet.addresses || !wallet.addresses.hyperliquid || !wallet.addresses.hyperevm) {
      return res.status(400).json({ error: 'Vault must have both Hyperliquid and HyperEVM addresses' });
    }
    
    console.log(`\n🔄 Fetching combined balances for vault ${wallet.nickname || wallet.id}`);
    console.log(`   HL address: ${wallet.addresses.hyperliquid}`);
    console.log(`   EVM address: ${wallet.addresses.hyperevm}`);
    
    // Récupérer les balances des deux blockchains
    const hlBalances = await getHyperliquidBalances(wallet.addresses.hyperliquid);
    const evmBalances = await getHyperEVMBalances(wallet.addresses.hyperevm);
    
    console.log(`   HL tokens found: ${hlBalances.length}`);
    console.log(`   EVM tokens found: ${evmBalances.length}`);
    
    // Combiner les balances par token
    const combined = {};
    const tokens = ['HYPE', 'ETH', 'BTC', 'USDT','USDC'];
    
    for (const token of tokens) {
      const hlBalance = hlBalances.find(b => b.token === token);
      const evmBalance = evmBalances.find(b => b.token === token);
      
      const hlValue = hlBalance ? parseFloat(hlBalance.balance) : 0;
      const evmValue = evmBalance ? parseFloat(evmBalance.balance) : 0;
      
      combined[token] = {
        hyperliquid: hlValue,
        hyperevm: evmValue,
        total: hlValue + evmValue
      };
      
      console.log(`   ${token}: HL=${hlValue.toFixed(6)} + EVM=${evmValue.toFixed(6)} = ${combined[token].total.toFixed(6)}`);
    }
    
    console.log(`✅ Combined balances calculated\n`);
    
    res.json({
      walletId: id,
      nickname: wallet.nickname,
      balances: combined,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching combined balances:', error);
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

// GET les prix actuels
app.get('/api/prices', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const prices = await getPrices(forceRefresh);
    
    res.json({
      prices,
      cachedAt: new Date(priceCache.lastUpdate).toISOString(),
      ttl: priceCache.TTL / 1000 // en secondes
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET les settings du vault
app.get('/api/vault/settings', async (req, res) => {
  try {
    const data = await loadWallets();
    
    if (!data.vaultSettings) {
      data.vaultSettings = {
        initialInvestmentUSD: 5000,
        initialDate: new Date().toISOString()
      };
      await saveWallets(data);
    }
    
    res.json(data.vaultSettings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST mettre à jour les settings du vault
app.post('/api/vault/settings', async (req, res) => {
  try {
    const { initialInvestmentUSD, initialDate } = req.body;
    
    if (!initialInvestmentUSD || initialInvestmentUSD <= 0) {
      return res.status(400).json({ error: 'Invalid initial investment' });
    }
    
    const data = await loadWallets();
    data.vaultSettings = {
      initialInvestmentUSD: parseFloat(initialInvestmentUSD),
      initialDate: initialDate || data.vaultSettings?.initialDate || new Date().toISOString()
    };
    
    await saveWallets(data);
    res.json(data.vaultSettings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET calculer le PNL du vault
app.get('/api/vault/pnl', async (req, res) => {
  try {
    const data = await loadWallets();
    const vault = data.wallets.find(w => w.walletType === 'vault');
    
    if (!vault) {
      return res.status(404).json({ error: 'Vault not found' });
    }
    
    if (!vault.addresses || !vault.addresses.hyperliquid || !vault.addresses.hyperevm) {
      return res.status(400).json({ error: 'Vault must have both addresses' });
    }
    
    // Si force refresh demandé, recalculer
    const forceRefresh = req.query.refresh === 'true';
    
    if (forceRefresh) {
      // Recalculer et sauvegarder un nouveau snapshot
      await calculateAndSavePnlSnapshot();
      
      // Recharger les données après le calcul
      const updatedData = await loadWallets();
      const latestSnapshot = updatedData.pnlSnapshots?.[updatedData.pnlSnapshots.length - 1];
      
      if (!latestSnapshot) {
        return res.status(404).json({ error: 'No PNL data available' });
      }
      
      // Récupérer les prix actuels pour le breakdown
      const prices = await getPrices(false);
      
      // Récupérer les balances pour le breakdown
      const hlBalances = await getHyperliquidBalances(vault.addresses.hyperliquid);
      const evmBalances = await getHyperEVMBalances(vault.addresses.hyperevm);
      
      const tokens = ['HYPE', 'ETH', 'BTC', 'USDT'];
      const combined = {};
      const breakdown = {};
      
      for (const token of tokens) {
        const hlBalance = hlBalances.find(b => b.token === token);
        const evmBalance = evmBalances.find(b => b.token === token);
        
        const hlValue = hlBalance ? parseFloat(hlBalance.balance) : 0;
        const evmValue = evmBalance ? parseFloat(evmBalance.balance) : 0;
        const total = hlValue + evmValue;
        
        combined[token] = total;
        breakdown[token] = {
          amount: total,
          price: prices[token] || 0,
          value: total * (prices[token] || 0)
        };
      }
      
      const settings = updatedData.vaultSettings || { initialInvestmentUSD: 5000 };
      const pnlAmount = latestSnapshot.v - settings.initialInvestmentUSD;
      
      return res.json({
        totalUSD: latestSnapshot.v,
        initialInvestmentUSD: settings.initialInvestmentUSD,
        pnlAmount,
        pnlPercent: latestSnapshot.p,
        breakdown,
        prices,
        timestamp: latestSnapshot.t,
        settings
      });
    }
    
    // Sinon, retourner le dernier snapshot disponible
    const latestSnapshot = data.pnlSnapshots?.[data.pnlSnapshots.length - 1];
    
    if (!latestSnapshot) {
      return res.status(404).json({ 
        error: 'No PNL data available yet. The cron job will create the first snapshot within 1 minute.' 
      });
    }
    
    // Récupérer les prix actuels pour le breakdown
    const prices = await getPrices(false);
    
    // Récupérer les balances pour le breakdown
    const hlBalances = await getHyperliquidBalances(vault.addresses.hyperliquid);
    const evmBalances = await getHyperEVMBalances(vault.addresses.hyperevm);
    
    const tokens = ['HYPE', 'ETH', 'BTC', 'USDT'];
    const breakdown = {};
    
    for (const token of tokens) {
      const hlBalance = hlBalances.find(b => b.token === token);
      const evmBalance = evmBalances.find(b => b.token === token);
      
      const hlValue = hlBalance ? parseFloat(hlBalance.balance) : 0;
      const evmValue = evmBalance ? parseFloat(evmBalance.balance) : 0;
      const total = hlValue + evmValue;
      
      breakdown[token] = {
        amount: total,
        price: prices[token] || 0,
        value: total * (prices[token] || 0)
      };
    }
    
    const settings = data.vaultSettings || { initialInvestmentUSD: 5000 };
    const pnlAmount = latestSnapshot.v - settings.initialInvestmentUSD;
    
    res.json({
      totalUSD: latestSnapshot.v,
      initialInvestmentUSD: settings.initialInvestmentUSD,
      pnlAmount,
      pnlPercent: latestSnapshot.p,
      breakdown,
      prices,
      timestamp: latestSnapshot.t,
      settings
    });
  } catch (error) {
    console.error('Error getting PNL:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET l'historique du PNL avec filtrage par période
app.get('/api/vault/pnl-history', async (req, res) => {
  try {
    const data = await loadWallets();
    const snapshots = data.pnlSnapshots || [];
    
    if (snapshots.length === 0) {
      return res.json({ history: [], total: 0 });
    }
    
    const period = req.query.period || '1D';
    const now = new Date();
    let startDate;
    
    // Déterminer la date de début selon la période
    switch (period) {
      case '1D':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '1M':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '3M':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '6M':
        startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case '1Y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case 'All':
        startDate = new Date(0); // Depuis le début
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Par défaut 24h
    }
    
    // Filtrer les snapshots par période
    const filteredSnapshots = snapshots.filter(s => new Date(s.t) >= startDate);
    
    if (filteredSnapshots.length === 0) {
      return res.json({ history: [], total: 0, period });
    }
    
    // Sampling pour éviter de retourner trop de points
    const maxPoints = 2000; // Maximum de points à retourner
    let sampledSnapshots;
    
    if (filteredSnapshots.length <= maxPoints) {
      sampledSnapshots = filteredSnapshots;
    } else {
      // Calculer le pas pour le sampling
      const step = Math.ceil(filteredSnapshots.length / maxPoints);
      sampledSnapshots = filteredSnapshots.filter((_, index) => index % step === 0);
    }
    
    res.json({
      history: sampledSnapshots,
      total: snapshots.length,
      filtered: filteredSnapshots.length,
      returned: sampledSnapshots.length,
      period
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============ AUTOMATIC PNL TRACKING ============

/**
 * Calcule et sauvegarde un snapshot PNL optimisé
 */
async function calculateAndSavePnlSnapshot() {
  try {
    const data = await loadWallets();
    const vault = data.wallets.find(w => w.walletType === 'vault');
    
    // Vérifier si le vault existe
    if (!vault || !vault.addresses || !vault.addresses.hyperliquid || !vault.addresses.hyperevm) {
      console.log('⏭️  No vault configured, skipping PNL snapshot');
      return;
    }
    
    // Vérifier si les settings existent
    if (!data.vaultSettings || !data.vaultSettings.initialInvestmentUSD) {
      console.log('⏭️  Vault settings not configured, skipping PNL snapshot');
      return;
    }
    
    console.log('📊 Calculating PNL snapshot...');
    
    // Récupérer les balances combinées
    const hlBalances = await getHyperliquidBalances(vault.addresses.hyperliquid);
    const evmBalances = await getHyperEVMBalances(vault.addresses.hyperevm);
    
    const tokens = ['HYPE', 'ETH', 'BTC', 'USDT', 'USDC'];
    const combined = {};
    
    for (const token of tokens) {
      const hlBalance = hlBalances.find(b => b.token === token);
      const evmBalance = evmBalances.find(b => b.token === token);
      
      const hlValue = hlBalance ? parseFloat(hlBalance.balance) : 0;
      const evmValue = evmBalance ? parseFloat(evmBalance.balance) : 0;
      
      combined[token] = hlValue + evmValue;
    }
    
    // Récupérer les prix (utilise le cache automatiquement)
    const prices = await getPrices(false);
    
    // Calculer la valeur totale en USD
    let totalUSD = 0;
    
    for (const token of tokens) {
      const amount = combined[token] || 0;
      const price = prices[token] || 0;
      totalUSD += amount * price;
    }
    
    // Calculer le PNL
    const initialInvestment = data.vaultSettings.initialInvestmentUSD;
    const pnlAmount = totalUSD - initialInvestment;
    const pnlPercent = initialInvestment > 0 ? (pnlAmount / initialInvestment) * 100 : 0;
    
    // Créer snapshot optimisé (structure légère)
    const snapshot = {
      t: new Date().toISOString(),  // timestamp
      v: parseFloat(totalUSD.toFixed(2)),  // valeur USD
      p: parseFloat(pnlPercent.toFixed(2))  // PNL %
    };
    
    // Initialiser pnlSnapshots si nécessaire
    if (!data.pnlSnapshots) {
      data.pnlSnapshots = [];
    }
    
    // Ajouter le snapshot (illimité pour l'instant)
    data.pnlSnapshots.push(snapshot);
    
    // Sauvegarder
    await saveWallets(data);
    
    console.log(`✅ PNL snapshot saved: $${totalUSD.toFixed(2)} (${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%) - Total snapshots: ${data.pnlSnapshots.length}`);
    
  } catch (error) {
    console.error('❌ Error calculating PNL snapshot:', error.message);
  }
}

// Démarrer le cron job (toutes les 1 minute)
console.log('⏰ Starting PNL auto-tracking cron job (every 1 minute)...');
cron.schedule('* * * * *', () => {
  calculateAndSavePnlSnapshot();
});

// Calculer un snapshot immédiatement au démarrage
setTimeout(() => {
  console.log('🎯 Calculating initial PNL snapshot...');
  calculateAndSavePnlSnapshot();
}, 5000); // Attendre 5 secondes après le démarrage

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📊 Wallets file: ${WALLETS_FILE}`);
});