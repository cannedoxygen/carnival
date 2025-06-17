import { useState, useEffect } from 'react';

export function useGameContract() {
  const [jackpotPool, setJackpotPool] = useState(5);
  const [totalGamesPlayed, setTotalGamesPlayed] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const playGame = async (keyType: string, doorNumber: number) => {
    setIsLoading(true);
    
    // Simulate game play
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const outcomes = ['win', 'lose', 'breakeven'];
    const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
    
    setIsLoading(false);
    return { outcome };
  };

  const getPlayerStats = async (address: string) => {
    return {
      totalGames: 0,
      totalWins: 0,
      totalLosses: 0,
      totalWagered: 0,
      totalWon: 0
    };
  };

  useEffect(() => {
    // Simulate initial data
    setJackpotPool(5.23); // 5.23 ETH
    setTotalGamesPlayed(1234);
  }, []);

  return {
    playGame,
    getPlayerStats,
    jackpotPool,
    totalGamesPlayed,
    isLoading
  };
}