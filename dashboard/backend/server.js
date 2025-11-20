
// curl "http://localhost:3001/api/wallets/0x89FA38FEEc2C00d6B3CFd8e16C7948975C6C34bf/balances?blockchain=hyperliquid"
// server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const WALLETS_FILE = path.join(__dirname, 'wallets.json');

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
    const initialData = { wallets: [], availableTags: [] };
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

// ============ ETHEREUM VIA ALCHEMY ============

async function getEthereumBalances(address) {
  try {
    const alchemyUrl = `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
    const balances = [];

    // Balance ETH native
    const ethBalance = await axios.post(alchemyUrl, {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getBalance',
      params: [address, 'latest']
    });

    const ethValue = parseInt(ethBalance.data.result, 16) / 1e18;
    if (ethValue > 0) {
      balances.push({
        token: 'ETH',
        balance: ethValue.toFixed(6),
        usdValue: null
      });
    }

    // Token balances via Alchemy Token API
    const tokenBalances = await axios.post(alchemyUrl, {
      jsonrpc: '2.0',
      id: 1,
      method: 'alchemy_getTokenBalances',
      params: [address]
    });

    if (tokenBalances.data.result?.tokenBalances) {
      for (const token of tokenBalances.data.result.tokenBalances) {
        const balance = parseInt(token.tokenBalance, 16);
        if (balance > 0) {
          // Obtenir les métadonnées du token
          const metadata = await axios.post(alchemyUrl, {
            jsonrpc: '2.0',
            id: 1,
            method: 'alchemy_getTokenMetadata',
            params: [token.contractAddress]
          });

          const decimals = metadata.data.result?.decimals || 18;
          const symbol = metadata.data.result?.symbol || 'UNKNOWN';
          const readableBalance = balance / Math.pow(10, decimals);

          balances.push({
            token: symbol,
            balance: readableBalance.toFixed(6),
            contractAddress: token.contractAddress,
            usdValue: null
          });
        }
      }
    }

    return balances;
  } catch (error) {
    console.error('Ethereum API Error:', error.message);
    throw new Error('Failed to fetch Ethereum balances');
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
    const { address, blockchain, nickname, tags } = req.body;
    
    if (!address || !blockchain) {
      return res.status(400).json({ error: 'Address and blockchain are required' });
    }

    const data = await loadWallets();
    
    const newWallet = {
      id: Date.now().toString(),
      address,
      blockchain,
      nickname: nickname || `Wallet ${address.slice(0, 6)}...`,
      tags: tags || [],
      selectedTokens: ['totalUSD'], // Par défaut afficher le total
      createdAt: new Date().toISOString()
    };

    data.wallets.push(newWallet);
    
    // Ajouter les nouveaux tags à la liste globale
    if (tags) {
      tags.forEach(tag => {
        if (!data.availableTags.includes(tag)) {
          data.availableTags.push(tag);
        }
      });
    }

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
    } else if (blockchain === 'ethereum') {
      balances = await getEthereumBalances(address);
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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📊 Wallets file: ${WALLETS_FILE}`);
});