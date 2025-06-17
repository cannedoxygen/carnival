import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameContract } from '../../hooks/useGameContract';
import { useSound } from '../../hooks/useSound';
import { formatEther } from 'ethers';

export type KeyType = 'BRONZE' | 'SILVER' | 'GOLD';

interface KeyPurchaseProps {
  onKeyPurchased: (keyType: KeyType) => void;
  disabled?: boolean;
}

const keyTypes = [
  {
    type: 'BRONZE' as const,
    name: 'Bronze Key',
    price: '0.005',
    color: 'from-amber-600 to-amber-800',
    borderColor: 'border-amber-500',
    character: 'Ralph',
    description: 'Basic chances, great fun!',
    icon: '>I',
    soundEffect: 'me-fail-english.mp3',
    features: ['30% Win Rate', '35% Break Even', 'Entry Level Fun']
  },
  {
    type: 'SILVER' as const,
    name: 'Silver Key',
    price: '0.01',
    color: 'from-gray-400 to-gray-600',
    borderColor: 'border-gray-400',
    character: 'Lisa',
    description: 'Better odds, more excitement!',
    icon: '>H',
    soundEffect: 'saxophone.mp3',
    features: ['30% Win Rate', '35% Break Even', 'Enhanced Rewards']
  },
  {
    type: 'GOLD' as const,
    name: 'Gold Key',
    price: '0.025',
    color: 'from-yellow-400 to-yellow-600',
    borderColor: 'border-yellow-400',
    character: 'Mr. Burns',
    description: 'Premium experience, maximum thrills!',
    icon: '>G',
    soundEffect: 'excellent.mp3',
    features: ['30% Win Rate', '35% Break Even', 'Premium Payouts']
  }
];

export const KeyPurchase: React.FC<KeyPurchaseProps> = ({ onKeyPurchased, disabled }) => {
  const [selectedKey, setSelectedKey] = useState<KeyType | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [hoveredKey, setHoveredKey] = useState<KeyType | null>(null);
  const { playGame, isConnected, balance } = useGameContract();
  const { playSound } = useSound();

  const handleKeySelect = (keyType: KeyType) => {
    if (disabled || purchasing) return;
    setSelectedKey(keyType);
    playSound('key-select.mp3');
  };

  const handlePurchase = async () => {
    if (!selectedKey || !isConnected || purchasing) return;

    try {
      setPurchasing(true);
      playSound('purchase.mp3');
      
      // Call the contract to purchase the key (this will be a game play)
      await playGame(selectedKey, 1); // Default to door 1, will be overridden by door selection
      
      onKeyPurchased(selectedKey);
      setSelectedKey(null);
      
    } catch (error) {
      console.error('Purchase failed:', error);
      playSound('error.mp3');
    } finally {
      setPurchasing(false);
    }
  };

  const handleKeyHover = (keyType: KeyType) => {
    if (disabled) return;
    setHoveredKey(keyType);
    const key = keyTypes.find(k => k.type === keyType);
    if (key) {
      playSound(key.soundEffect);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-8">
      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h2 className="text-4xl font-bold text-yellow-400 mb-4 font-simpsons">
          Choose Your Key!
        </h2>
        <p className="text-white text-lg">
          Select a key to unlock the Springfield Carnival experience
        </p>
        {balance && (
          <p className="text-gray-300 mt-2">
            Your Balance: {formatEther(balance)} ETH
          </p>
        )}
      </motion.div>

      {/* Key Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        {keyTypes.map((key, index) => (
          <motion.div
            key={key.type}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative"
          >
            <motion.div
              className={`
                relative p-6 rounded-2xl cursor-pointer
                bg-gradient-to-br ${key.color}
                border-4 ${key.borderColor}
                ${selectedKey === key.type ? 'ring-4 ring-white scale-105' : ''}
                ${hoveredKey === key.type ? 'scale-102' : ''}
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                transition-all duration-300
              `}
              whileHover={!disabled ? { scale: 1.02 } : {}}
              whileTap={!disabled ? { scale: 0.98 } : {}}
              onClick={() => handleKeySelect(key.type)}
              onMouseEnter={() => handleKeyHover(key.type)}
              onMouseLeave={() => setHoveredKey(null)}
            >
              {/* Key Icon */}
              <div className="text-center mb-4">
                <motion.div
                  animate={selectedKey === key.type ? { 
                    rotate: [0, 10, -10, 0],
                    scale: [1, 1.1, 1]
                  } : {}}
                  transition={{ duration: 0.5 }}
                  className="text-6xl mb-2"
                >
                  {key.icon}
                </motion.div>
                <h3 className="text-2xl font-bold text-white">{key.name}</h3>
                <p className="text-xl font-semibold text-white">{key.price} ETH</p>
              </div>

              {/* Character Badge */}
              <div className="absolute top-4 right-4">
                <div className="bg-white bg-opacity-20 rounded-full px-3 py-1">
                  <span className="text-white text-sm font-bold">{key.character}</span>
                </div>
              </div>

              {/* Description */}
              <p className="text-white text-center mb-4 font-medium">
                {key.description}
              </p>

              {/* Features */}
              <div className="space-y-2">
                {key.features.map((feature, featureIndex) => (
                  <motion.div
                    key={featureIndex}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 + featureIndex * 0.05 }}
                    className="flex items-center text-white text-sm"
                  >
                    <span className="mr-2"></span>
                    {feature}
                  </motion.div>
                ))}
              </div>

              {/* Selection indicator */}
              <AnimatePresence>
                {selectedKey === key.type && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute inset-0 border-4 border-white rounded-2xl pointer-events-none"
                  />
                )}
              </AnimatePresence>

              {/* Glow effect on hover */}
              <AnimatePresence>
                {hoveredKey === key.type && !disabled && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-white bg-opacity-10 rounded-2xl pointer-events-none"
                  />
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        ))}
      </div>

      {/* Purchase Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="text-center"
      >
        <AnimatePresence>
          {selectedKey && (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handlePurchase}
              disabled={!isConnected || purchasing || disabled}
              className={`
                px-12 py-4 rounded-full text-2xl font-bold
                ${purchasing ? 
                  'bg-gray-500 cursor-not-allowed' : 
                  'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'
                }
                text-white transition-all duration-300
                disabled:opacity-50 disabled:cursor-not-allowed
                shadow-lg
              `}
            >
              {purchasing ? (
                <div className="flex items-center space-x-2">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-6 h-6 border-2 border-white border-t-transparent rounded-full"
                  />
                  <span>Purchasing...</span>
                </div>
              ) : (
                `Purchase ${selectedKey} Key for ${keyTypes.find(k => k.type === selectedKey)?.price} ETH`
              )}
            </motion.button>
          )}
        </AnimatePresence>

        {!isConnected && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-red-400 mt-4"
          >
            Please connect your wallet to purchase keys
          </motion.p>
        )}
      </motion.div>

      {/* Floating Animation Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-yellow-400 text-2xl"
            initial={{ 
              x: Math.random() * window.innerWidth,
              y: window.innerHeight,
              opacity: 0 
            }}
            animate={{
              y: -100,
              opacity: [0, 1, 0],
              rotate: 360
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              delay: Math.random() * 2,
              repeat: Infinity,
              repeatDelay: 5 + Math.random() * 5
            }}
          >
            P
          </motion.div>
        ))}
      </div>
    </div>
  );
};