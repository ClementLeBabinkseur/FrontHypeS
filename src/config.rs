use ethers::types::Address;
use std::str::FromStr;

#[derive(Debug, Clone)]
pub struct Config {
    pub hyperevm_ws_rpc: String,
    pub hyperliquid_ws_url: String,
    
    // Token addresses
    pub hype_address: Address,
    pub usdt_address: Address,
    pub ubtc_address: Address,
    pub ueth_address: Address,
    
    // DEX factory addresses
    pub projet_x_factory: Address,
    pub hybra_factory: Address,
    pub hyperswap_factory: Address,
    pub ultrasolid_factory: Address,
    
    // Filtering parameters
    pub min_tvl_usd: f64,
    pub min_profit_threshold_percent: f64,
    pub min_profit_threshold_usd: f64,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        dotenv::dotenv().ok();
        
        let alchemy_key = std::env::var("ALCHEMY_API_KEY")
            .unwrap_or_else(|_| "your-api-key".to_string());
        
        Ok(Self {
            hyperevm_ws_rpc: format!("wss://hyperliquid-mainnet.g.alchemy.com/v2/{}", alchemy_key),
            hyperliquid_ws_url: "wss://api.hyperliquid.xyz/ws".to_string(),
            
            // Token addresses
            hype_address: Address::from_str("0x5555555555555555555555555555555555555555")?,
            usdt_address: Address::from_str("0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb")?,
            ubtc_address: Address::from_str("0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463")?,
            ueth_address: Address::from_str("0xBe6727B535545C67d5cAa73dEa54865B92CF7907")?,
            
            // DEX factories
            projet_x_factory: Address::from_str("0xFf7B3e8C00e57ea31477c32A5B52a58Eea47b072")?,
            hybra_factory: Address::from_str("0x2dC0Ec0F0db8bAF250eCccF268D7dFbF59346E5E")?,
            hyperswap_factory: Address::from_str("0xB1c0fa0B789320044A6F623cFe5eBda9562602E3")?,
            ultrasolid_factory: Address::from_str("0xD883a0B7889475d362CEA8fDf588266a3da554A1")?,
            
            // Filtering
            min_tvl_usd: 100_000.0,
            min_profit_threshold_percent: 3.0,
            min_profit_threshold_usd: 3.0,
        })
    }
    
    pub fn get_all_factories(&self) -> Vec<Address> {
        vec![
            self.projet_x_factory,
            self.hybra_factory,
            self.hyperswap_factory,
            self.ultrasolid_factory,
        ]
    }
    
    pub fn get_tracked_pairs(&self) -> Vec<(Address, Address)> {
        vec![
            (self.hype_address, self.usdt_address),
            (self.ubtc_address, self.usdt_address),
            (self.ueth_address, self.usdt_address),
        ]
    }
}