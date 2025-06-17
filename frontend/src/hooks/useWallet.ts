import { useState, useEffect, useCallback } from 'react';
import { ethers, BigNumber } from 'ethers';

interface WalletState {
  isConnected: boolean;
  address: string | null;
  balance: BigNumber | null;
  chainId: number | null;
  provider: ethers.providers.Web3Provider | null;
  signer: ethers.Signer | null;
}

export const useWallet = () => {
  const [walletState, setWalletState] = useState<WalletState>({
    isConnected: false,
    address: null,
    balance: null,
    chainId: null,
    provider: null,
    signer: null
  });

  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Check if MetaMask is installed
  const isMetaMaskInstalled = () => {
    return typeof window !== 'undefined' && Boolean(window.ethereum?.isMetaMask);
  };

  // Initialize wallet connection on page load
  useEffect(() => {
    const initializeWallet = async () => {
      if (!isMetaMaskInstalled()) {
        setError('MetaMask is not installed');
        return;
      }

      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const accounts = await provider.listAccounts();

        if (accounts.length > 0) {
          await updateWalletState(provider);
        }
      } catch (err) {
        console.error('Failed to initialize wallet:', err);
      }
    };

    initializeWallet();
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = async (accounts: string[]) => {
      if (accounts.length === 0) {
        // User disconnected
        setWalletState({
          isConnected: false,
          address: null,
          balance: null,
          chainId: null,
          provider: null,
          signer: null
        });
      } else {
        // Account changed
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        await updateWalletState(provider);
      }
    };

    const handleChainChanged = async (chainId: string) => {
      // Reload the page on chain change (recommended by MetaMask)
      window.location.reload();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  const updateWalletState = async (provider: ethers.providers.Web3Provider) => {
    try {
      const signer = provider.getSigner();
      const address = await signer.getAddress();
      const balance = await provider.getBalance(address);
      const network = await provider.getNetwork();

      setWalletState({
        isConnected: true,
        address,
        balance,
        chainId: network.chainId,
        provider,
        signer
      });

      setError(null);
    } catch (err) {
      console.error('Failed to update wallet state:', err);
      setError('Failed to get wallet information');
    }
  };

  const connect = useCallback(async (providerId?: string) => {
    if (!window.ethereum) {
      setError('No wallet found. Please install MetaMask.');
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);

      // Request account access
      await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await updateWalletState(provider);
    } catch (err: any) {
      console.error('Failed to connect wallet:', err);
      
      if (err.code === 4001) {
        setError('User rejected the connection request');
      } else {
        setError('Failed to connect to wallet');
      }
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setWalletState({
      isConnected: false,
      address: null,
      balance: null,
      chainId: null,
      provider: null,
      signer: null
    });
    setError(null);
  }, []);

  const switchChain = useCallback(async (targetChainId: number) => {
    if (!window.ethereum) {
      setError('No wallet found');
      return;
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }]
      });
    } catch (err: any) {
      console.error('Failed to switch chain:', err);
      
      if (err.code === 4902) {
        // Chain not added to MetaMask
        try {
          await addChain(targetChainId);
        } catch (addErr) {
          setError('Failed to add network to wallet');
        }
      } else {
        setError('Failed to switch network');
      }
    }
  }, []);

  const addChain = async (chainId: number) => {
    const chainConfigs: Record<number, any> = {
      11155111: {
        chainId: '0xaa36a7',
        chainName: 'Sepolia',
        nativeCurrency: {
          name: 'ETH',
          symbol: 'ETH',
          decimals: 18
        },
        rpcUrls: ['https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID'],
        blockExplorerUrls: ['https://sepolia.etherscan.io']
      },
      31337: {
        chainId: '0x7a69',
        chainName: 'Localhost',
        nativeCurrency: {
          name: 'ETH',
          symbol: 'ETH',
          decimals: 18
        },
        rpcUrls: ['http://localhost:8545'],
        blockExplorerUrls: []
      }
    };

    const config = chainConfigs[chainId];
    if (!config) {
      throw new Error('Unsupported chain');
    }

    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [config]
    });
  };

  const signMessage = useCallback(async (message: string): Promise<string> => {
    if (!walletState.signer) {
      throw new Error('Wallet not connected');
    }

    return await walletState.signer.signMessage(message);
  }, [walletState.signer]);

  const sendTransaction = useCallback(async (transaction: any) => {
    if (!walletState.signer) {
      throw new Error('Wallet not connected');
    }

    return await walletState.signer.sendTransaction(transaction);
  }, [walletState.signer]);

  return {
    // State
    isConnected: walletState.isConnected,
    address: walletState.address,
    balance: walletState.balance,
    chainId: walletState.chainId,
    provider: walletState.provider,
    signer: walletState.signer,
    error,
    isConnecting,
    
    // Methods
    connect,
    disconnect,
    switchChain,
    signMessage,
    sendTransaction,
    
    // Utilities
    isMetaMaskInstalled
  };
};

// Global type declaration for window.ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}