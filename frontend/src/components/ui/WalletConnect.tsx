import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from '../../hooks/useWallet';
import { useGameContract } from '../../hooks/useGameContract';
import { useSound } from '../../hooks/useSound';
import { formatEther } from 'ethers';

interface WalletConnectProps {
  className?: string;
  showBalance?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const walletProviders = [
  {
    id: 'metamask',
    name: 'MetaMask',
    icon: '>Š',
    color: 'from-orange-500 to-orange-600',
    description: 'Connect with MetaMask'
  },
  {
    id: 'walletconnect',
    name: 'WalletConnect',
    icon: '=ñ',
    color: 'from-blue-500 to-blue-600',
    description: 'Connect with WalletConnect'
  },
  {
    id: 'coinbase',
    name: 'Coinbase Wallet',
    icon: '=¼',
    color: 'from-blue-600 to-blue-700',
    description: 'Connect with Coinbase'
  }
];

export const WalletConnect: React.FC<WalletConnectProps> = ({ 
  className = "",
  showBalance = true,
  size = 'md'
}) => {
  const [showModal, setShowModal] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  
  const { 
    isConnected, 
    address, 
    balance, 
    chainId, 
    connect, 
    disconnect,
    switchChain 
  } = useWallet();
  
  const { totalGamesPlayed, playerStats } = useGameContract();
  const { playSound } = useSound();

  const handleConnect = async (providerId: string) => {
    try {
      setConnecting(providerId);
      playSound('connect.mp3');
      await connect(providerId);
      setShowModal(false);
      playSound('success.mp3');
    } catch (error) {
      console.error('Connection failed:', error);
      playSound('error.mp3');
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async () => {
    try {
      playSound('disconnect.mp3');
      await disconnect();
      setShowAccountMenu(false);
    } catch (error) {
      console.error('Disconnect failed:', error);
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-4 py-2 text-sm';
      case 'lg':
        return 'px-8 py-4 text-lg';
      default:
        return 'px-6 py-3 text-base';
    }
  };

  const getNetworkName = (id: number) => {
    switch (id) {
      case 1:
        return 'Ethereum';
      case 11155111:
        return 'Sepolia';
      case 31337:
        return 'Localhost';
      default:
        return 'Unknown';
    }
  };

  const isWrongNetwork = chainId && chainId !== 11155111; // Assuming Sepolia testnet

  if (!isConnected) {
    return (
      <>
        <motion.button
          className={`
            ${getSizeClasses()}
            bg-gradient-to-r from-blue-500 to-purple-600
            hover:from-blue-600 hover:to-purple-700
            text-white font-bold rounded-full
            transition-all duration-300
            shadow-lg hover:shadow-xl
            ${className}
          `}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowModal(true)}
        >
          <div className="flex items-center space-x-2">
            <span>=</span>
            <span>Connect Wallet</span>
          </div>
        </motion.button>

        {/* Connection Modal */}
        <AnimatePresence>
          {showModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
              onClick={() => setShowModal(false)}
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 max-w-md w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-center mb-6">
                  <h2 className="text-3xl font-bold text-white mb-2 font-simpsons">
                    Connect to Springfield!
                  </h2>
                  <p className="text-gray-400">
                    Choose your wallet to start playing
                  </p>
                </div>

                <div className="space-y-4">
                  {walletProviders.map((provider, index) => (
                    <motion.button
                      key={provider.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`
                        w-full p-4 rounded-xl
                        bg-gradient-to-r ${provider.color}
                        hover:shadow-lg hover:scale-105
                        text-white font-semibold
                        transition-all duration-300
                        disabled:opacity-50 disabled:cursor-not-allowed
                      `}
                      onClick={() => handleConnect(provider.id)}
                      disabled={connecting !== null}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">{provider.icon}</span>
                          <div className="text-left">
                            <div className="font-bold">{provider.name}</div>
                            <div className="text-sm opacity-90">
                              {provider.description}
                            </div>
                          </div>
                        </div>
                        {connecting === provider.id && (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-6 h-6 border-2 border-white border-t-transparent rounded-full"
                          />
                        )}
                      </div>
                    </motion.button>
                  ))}
                </div>

                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="w-full mt-6 p-3 text-gray-400 hover:text-white transition-colors"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Wrong Network Warning */}
      {isWrongNetwork && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 bg-red-500 bg-opacity-20 border border-red-500 rounded-lg"
        >
          <div className="flex items-center space-x-2 text-red-400">
            <span> </span>
            <span className="text-sm">
              Wrong network. Please switch to {getNetworkName(11155111)}
            </span>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="ml-auto px-3 py-1 bg-red-500 text-white rounded text-xs"
              onClick={() => switchChain(11155111)}
            >
              Switch
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Connected Wallet Display */}
      <motion.div
        className={`
          relative ${getSizeClasses()}
          bg-gradient-to-r from-green-500 to-green-600
          text-white font-bold rounded-full
          cursor-pointer transition-all duration-300
          shadow-lg hover:shadow-xl hover:from-green-600 hover:to-green-700
        `}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowAccountMenu(!showAccountMenu)}
      >
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-300 rounded-full animate-pulse" />
          <span>{formatAddress(address!)}</span>
          {showBalance && balance && (
            <span className="text-green-200">
              {parseFloat(formatEther(balance)).toFixed(3)} ETH
            </span>
          )}
          <motion.span
            animate={{ rotate: showAccountMenu ? 180 : 0 }}
            className="text-xs"
          >
            ¼
          </motion.span>
        </div>
      </motion.div>

      {/* Account Menu */}
      <AnimatePresence>
        {showAccountMenu && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute top-full right-0 mt-2 w-80 bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-xl border border-gray-700 p-6 z-50"
          >
            {/* Account Info */}
            <div className="text-center mb-4">
              <div className="text-2xl mb-2">=d</div>
              <div className="text-white font-bold">{formatAddress(address!)}</div>
              <div className="text-gray-400 text-sm">
                Network: {getNetworkName(chainId!)}
              </div>
            </div>

            {/* Balance */}
            {balance && (
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-4 mb-4">
                <div className="text-center">
                  <div className="text-white text-2xl font-bold">
                    {parseFloat(formatEther(balance)).toFixed(4)} ETH
                  </div>
                  <div className="text-blue-200 text-sm">
                    H ${(parseFloat(formatEther(balance)) * 2000).toLocaleString()} USD
                  </div>
                </div>
              </div>
            )}

            {/* Player Stats */}
            {playerStats && (
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg p-4 mb-4">
                <h3 className="text-white font-bold mb-2 text-center">
                  <® Your Stats
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-center">
                    <div className="text-white font-bold">
                      {playerStats.totalGames?.toString() || '0'}
                    </div>
                    <div className="text-purple-200">Games Played</div>
                  </div>
                  <div className="text-center">
                    <div className="text-white font-bold">
                      {playerStats.totalWins?.toString() || '0'}
                    </div>
                    <div className="text-purple-200">Wins</div>
                  </div>
                  <div className="text-center">
                    <div className="text-white font-bold">
                      {playerStats.totalWagered ? 
                        `${parseFloat(formatEther(playerStats.totalWagered)).toFixed(3)} ETH` : 
                        '0 ETH'
                      }
                    </div>
                    <div className="text-purple-200">Total Wagered</div>
                  </div>
                  <div className="text-center">
                    <div className="text-white font-bold">
                      {playerStats.totalWon ? 
                        `${parseFloat(formatEther(playerStats.totalWon)).toFixed(3)} ETH` : 
                        '0 ETH'
                      }
                    </div>
                    <div className="text-purple-200">Total Won</div>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full p-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                onClick={() => {
                  navigator.clipboard.writeText(address!);
                  playSound('click.mp3');
                  setShowAccountMenu(false);
                }}
              >
                =Ë Copy Address
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full p-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                onClick={handleDisconnect}
              >
                = Disconnect
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Click outside to close */}
      {showAccountMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowAccountMenu(false)}
        />
      )}
    </div>
  );
};