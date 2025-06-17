import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameContract } from '../../hooks/useGameContract';
import { useSound } from '../../hooks/useSound';
import { formatEther } from 'ethers';

interface JackpotDisplayProps {
  className?: string;
  showWinnerFeed?: boolean;
}

export const JackpotDisplay: React.FC<JackpotDisplayProps> = ({ 
  className = "",
  showWinnerFeed = true 
}) => {
  const [displayAmount, setDisplayAmount] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [recentWinners, setRecentWinners] = useState<Array<{
    winner: string;
    amount: string;
    timestamp: number;
  }>>([]);
  
  const { 
    jackpotPool, 
    lastJackpotWinner, 
    lastJackpotAmount, 
    lastJackpotWinTime,
    totalKeysUsed,
    jackpotTriggerCount
  } = useGameContract();
  
  const { playSound } = useSound();

  // Animate the jackpot counter
  useEffect(() => {
    if (jackpotPool) {
      const target = parseFloat(formatEther(jackpotPool));
      const increment = target / 50; // Animate over 50 steps
      let current = displayAmount;
      
      const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
          current = target;
          clearInterval(timer);
        }
        setDisplayAmount(current);
      }, 20);

      return () => clearInterval(timer);
    }
  }, [jackpotPool]);

  // Track recent winners
  useEffect(() => {
    if (lastJackpotWinner && lastJackpotAmount && lastJackpotWinTime) {
      const newWinner = {
        winner: lastJackpotWinner,
        amount: formatEther(lastJackpotAmount),
        timestamp: lastJackpotWinTime
      };
      
      setRecentWinners(prev => {
        const updated = [newWinner, ...prev.slice(0, 4)];
        return updated;
      });
      
      // Play celebration sound
      playSound('jackpot-win.mp3');
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 3000);
    }
  }, [lastJackpotWinner, lastJackpotAmount, lastJackpotWinTime]);

  const formatWalletAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getKeysUntilJackpot = () => {
    if (!totalKeysUsed || !jackpotTriggerCount) return jackpotTriggerCount;
    return jackpotTriggerCount - (totalKeysUsed % jackpotTriggerCount);
  };

  const getJackpotProgress = () => {
    if (!totalKeysUsed || !jackpotTriggerCount) return 0;
    return ((totalKeysUsed % jackpotTriggerCount) / jackpotTriggerCount) * 100;
  };

  return (
    <div className={`relative ${className}`}>
      {/* Main Jackpot Display */}
      <motion.div
        className={`
          relative bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600
          rounded-3xl p-8 shadow-2xl border-4 border-yellow-300
          ${isAnimating ? 'animate-pulse' : ''}
        `}
        animate={isAnimating ? { 
          scale: [1, 1.05, 1],
          boxShadow: [
            "0 0 20px rgba(255, 215, 0, 0.5)",
            "0 0 40px rgba(255, 215, 0, 0.8)",
            "0 0 20px rgba(255, 215, 0, 0.5)"
          ]
        } : {}}
        transition={{ duration: 0.5, repeat: isAnimating ? 5 : 0 }}
      >
        {/* Jackpot Title */}
        <div className="text-center mb-6">
          <motion.h1 
            className="text-4xl md:text-6xl font-bold text-white font-simpsons drop-shadow-lg"
            animate={isAnimating ? { 
              textShadow: [
                "2px 2px 4px rgba(0,0,0,0.5)",
                "4px 4px 8px rgba(255,0,0,0.8)",
                "2px 2px 4px rgba(0,0,0,0.5)"
              ]
            } : {}}
          >
            JACKPOT!
          </motion.h1>
          <p className="text-white text-lg opacity-90">
            Springfield Carnival Grand Prize
          </p>
        </div>

        {/* Jackpot Amount */}
        <motion.div 
          className="text-center mb-8"
          animate={isAnimating ? { scale: [1, 1.1, 1] } : {}}
        >
          <div className="bg-black bg-opacity-30 rounded-2xl p-6 mb-4">
            <motion.div
              className="text-6xl md:text-8xl font-bold text-white font-mono"
              animate={jackpotPool ? { 
                textShadow: "0 0 20px rgba(255, 255, 255, 0.8)"
              } : {}}
            >
              {displayAmount.toFixed(4)} ETH
            </motion.div>
            <div className="text-xl text-yellow-200 mt-2">
              H ${(displayAmount * 2000).toLocaleString()} USD
            </div>
          </div>
        </motion.div>

        {/* Progress Bar to Next Jackpot */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-white font-semibold">Keys Until Jackpot:</span>
            <span className="text-white font-bold">{getKeysUntilJackpot()}</span>
          </div>
          <div className="w-full bg-black bg-opacity-30 rounded-full h-4 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-green-400 to-green-600"
              initial={{ width: 0 }}
              animate={{ width: `${getJackpotProgress()}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Floating Icons */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-2xl"
              initial={{ 
                x: Math.random() * 100 + '%',
                y: '100%',
                opacity: 0 
              }}
              animate={{
                y: '-10%',
                opacity: [0, 1, 0],
                rotate: 360,
                x: [
                  Math.random() * 100 + '%',
                  Math.random() * 100 + '%'
                ]
              }}
              transition={{
                duration: 4 + Math.random() * 2,
                delay: Math.random() * 2,
                repeat: Infinity,
                repeatDelay: 3 + Math.random() * 3
              }}
            >
              {['=°', '<°', '<¯', '=Ž', 'P', '<Š', '<Æ', '=¸'][i]}
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Recent Winners Feed */}
      {showWinnerFeed && recentWinners.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl p-6"
        >
          <h3 className="text-2xl font-bold text-white mb-4 text-center">
            <Æ Recent Jackpot Winners
          </h3>
          <div className="space-y-3">
            {recentWinners.map((winner, index) => (
              <motion.div
                key={`${winner.winner}-${winner.timestamp}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-between bg-white bg-opacity-10 rounded-lg p-3"
              >
                <div className="flex items-center space-x-3">
                  <div className="text-2xl">
                    {index === 0 ? '>G' : index === 1 ? '>H' : index === 2 ? '>I' : '<Å'}
                  </div>
                  <div>
                    <div className="text-white font-semibold">
                      {formatWalletAddress(winner.winner)}
                    </div>
                    <div className="text-purple-200 text-sm">
                      {new Date(winner.timestamp * 1000).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-yellow-300 font-bold text-lg">
                    {parseFloat(winner.amount).toFixed(4)} ETH
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Jackpot Rules */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-6 bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-6"
      >
        <h3 className="text-xl font-bold text-white mb-4 text-center">
          9 How to Win the Jackpot
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-white">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="text-green-400"></span>
              <span>Play with any key type</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-400"></span>
              <span>Jackpot triggers every {jackpotTriggerCount?.toLocaleString()} keys</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="text-green-400"></span>
              <span>Winner gets the entire pool</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-400"></span>
              <span>Pool grows with every game</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Celebration Animation */}
      <AnimatePresence>
        {isAnimating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="text-8xl"
            >
              <‰
            </motion.div>
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute text-4xl"
                initial={{ 
                  x: '50%',
                  y: '50%',
                  scale: 0 
                }}
                animate={{
                  x: Math.random() * window.innerWidth,
                  y: Math.random() * window.innerHeight,
                  scale: 1,
                  rotate: 360
                }}
                exit={{ opacity: 0 }}
                transition={{ 
                  duration: 2,
                  delay: Math.random() * 0.5 
                }}
              >
                {['<Š', '<‰', '(', '=«', 'P'][Math.floor(Math.random() * 5)]}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};