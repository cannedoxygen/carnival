import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navigation from '../components/ui/Navigation';
import WalletConnect from '../components/ui/WalletConnect';
import TicketBooth from '../components/carnival/TicketBooth';
import DoorSelection from '../components/game/DoorSelection';
import KeyPurchase from '../components/game/KeyPurchase';
import ResultReveal from '../components/game/ResultReveal';
import JackpotDisplay from '../components/jackpot/JackpotDisplay';
import WinnerFeed from '../components/jackpot/WinnerFeed';
import Leaderboard from '../components/carnival/Leaderboard';
import { useGameContract } from '../hooks/useGameContract';
import { useSound } from '../hooks/useSound';
import styles from '../styles/Home.module.css';

type GameState = 'idle' | 'purchasing' | 'selecting' | 'revealing' | 'completed';

export default function Home() {
  const { playSound } = useSound();
  const { 
    playGame, 
    getPlayerStats, 
    jackpotPool, 
    totalGamesPlayed,
    isLoading 
  } = useGameContract();

  const [gameState, setGameState] = useState<GameState>('idle');
  const [selectedKey, setSelectedKey] = useState<'bronze' | 'silver' | 'gold' | null>(null);
  const [selectedDoor, setSelectedDoor] = useState<number | null>(null);
  const [gameResult, setGameResult] = useState<'win' | 'lose' | 'breakeven' | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const handleKeyPurchase = (keyType: 'bronze' | 'silver' | 'gold') => {
    setSelectedKey(keyType);
    setGameState('selecting');
    playSound('key-purchase');
  };

  const handleDoorSelect = async (doorNumber: number) => {
    if (!selectedKey) return;
    
    setSelectedDoor(doorNumber);
    setGameState('revealing');
    playSound('door-select');
    
    try {
      const result = await playGame(selectedKey, doorNumber);
      setGameResult(result.outcome as 'win' | 'lose' | 'breakeven');
      setGameState('completed');
      
      if (result.outcome === 'win') {
        playSound('homer-woohoo');
      } else if (result.outcome === 'lose') {
        playSound('homer-doh');
      } else {
        playSound('marge-hmm');
      }
    } catch (error) {
      console.error('Game error:', error);
      playSound('error');
      setGameState('idle');
    }
  };

  const resetGame = () => {
    setGameState('idle');
    setSelectedKey(null);
    setSelectedDoor(null);
    setGameResult(null);
  };

  return (
    <div className={styles.container}>
      <Navigation />
      
      <main className={styles.main}>
        <motion.div 
          className={styles.header}
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className={styles.title}>
            <span className={styles.simpsons}>The Simpsons</span>
            <span className={styles.carnival}>Carnival</span>
          </h1>
          <p className={styles.tagline}>Try Your Luck at Springfield's Finest!</p>
        </motion.div>

        <div className={styles.gameArea}>
          {!isConnected ? (
            <motion.div 
              className={styles.connectPrompt}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <h2>Welcome to the Carnival!</h2>
              <p>Connect your wallet to start playing</p>
              <WalletConnect />
              <button 
                onClick={() => setIsConnected(true)}
                className="mt-4 bg-green-500 text-white px-4 py-2 rounded"
              >
                Demo Mode (No Wallet)
              </button>
            </motion.div>
          ) : (
            <>
              <div className={styles.statsRow}>
                <JackpotDisplay amount={jackpotPool} />
                <motion.div className={styles.gameStats}>
                  <p>Total Games: {totalGamesPlayed}</p>
                  <button 
                    onClick={() => setShowLeaderboard(!showLeaderboard)}
                    className={styles.leaderboardToggle}
                  >
                    {showLeaderboard ? '🎮 Game' : '🏆 Leaders'}
                  </button>
                </motion.div>
              </div>

              <AnimatePresence mode="wait">
                {showLeaderboard ? (
                  <motion.div
                    key="leaderboard"
                    initial={{ rotateY: -90, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    exit={{ rotateY: 90, opacity: 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    <Leaderboard />
                  </motion.div>
                ) : (
                  <motion.div
                    key="game"
                    initial={{ rotateY: 90, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    exit={{ rotateY: -90, opacity: 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    {gameState === 'idle' && (
                      <TicketBooth onEnter={() => setGameState('purchasing')} />
                    )}
                    
                    {gameState === 'purchasing' && (
                      <KeyPurchase onPurchase={handleKeyPurchase} />
                    )}
                    
                    {gameState === 'selecting' && selectedKey && (
                      <DoorSelection 
                        keyType={selectedKey}
                        onSelect={handleDoorSelect}
                        isLoading={isLoading}
                      />
                    )}
                    
                    {(gameState === 'revealing' || gameState === 'completed') && 
                     gameResult && selectedDoor && (
                      <ResultReveal
                        result={gameResult}
                        doorNumber={selectedDoor}
                        onPlayAgain={resetGame}
                        isRevealing={gameState === 'revealing'}
                      />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <WinnerFeed />
            </>
          )}
        </div>
      </main>
    </div>
  );
}