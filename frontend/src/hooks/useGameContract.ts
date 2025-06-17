import { useState, useEffect, useCallback } from 'react';
import { ethers, Contract, BigNumber } from 'ethers';
import { useWallet } from './useWallet';

// Contract ABI - would normally be imported from artifacts
const SIMPSONS_CARNIVAL_ABI = [
  // Key events
  "event KeyPurchased(address indexed player, uint8 keyType, uint256 price)",
  "event GameStarted(address indexed player, uint256 indexed gameId, uint256 requestId, uint256 doorSelected)",
  "event GameCompleted(address indexed player, uint256 indexed gameId, uint8 result, uint256 payout)",
  "event JackpotWon(address indexed winner, uint256 amount)",
  "event JackpotContribution(uint256 amount)",
  
  // Read functions
  "function jackpotPool() view returns (uint256)",
  "function totalGamesPlayed() view returns (uint256)",
  "function totalKeysUsed() view returns (uint256)",
  "function lastJackpotWinner() view returns (address)",
  "function lastJackpotAmount() view returns (uint256)",
  "function lastJackpotWinTime() view returns (uint256)",
  "function jackpotTriggerCount() view returns (uint256)",
  "function playerStats(address) view returns (uint256 totalGames, uint256 totalWins, uint256 totalLosses, uint256 totalBreakEvens, uint256 totalWagered, uint256 totalWon, uint256 lastPlayTime)",
  "function getKeyPrice(uint8 keyType) view returns (uint256)",
  "function getPlayerGameHistory(address player) view returns (uint256[])",
  "function getGameDetails(uint256 gameId) view returns (tuple(address player, uint8 keyType, uint256 wager, uint256 doorSelected, uint8 result, uint256 payout, uint256 timestamp, uint256 requestId))",
  "function getLeaderboard() view returns (address[])",
  
  // Write functions
  "function playGame(uint8 keyType, uint256 doorNumber) payable",
  
  // Constants
  "function BRONZE_KEY_PRICE() view returns (uint256)",
  "function SILVER_KEY_PRICE() view returns (uint256)",
  "function GOLD_KEY_PRICE() view returns (uint256)",
  "function WIN_MULTIPLIER() view returns (uint256)",
  "function WIN_PROBABILITY() view returns (uint256)",
  "function BREAK_EVEN_PROBABILITY() view returns (uint256)"
];

// Contract address - would be different for each network
const CONTRACT_ADDRESSES = {
  1: '0x...', // Mainnet
  11155111: '0x...', // Sepolia
  31337: '0x5FbDB2315678afecb367f032d93F642f64180aa3' // Localhost
};

export type KeyType = 'BRONZE' | 'SILVER' | 'GOLD';
export type GameResult = 'PENDING' | 'WIN' | 'BREAK_EVEN' | 'LOSE';

export interface PlayerStats {
  totalGames: BigNumber;
  totalWins: BigNumber;
  totalLosses: BigNumber;
  totalBreakEvens: BigNumber;
  totalWagered: BigNumber;
  totalWon: BigNumber;
  lastPlayTime: BigNumber;
}

export interface GameDetails {
  player: string;
  keyType: number;
  wager: BigNumber;
  doorSelected: BigNumber;
  result: number;
  payout: BigNumber;
  timestamp: BigNumber;
  requestId: BigNumber;
}

export interface GameEvent {
  gameId: number;
  player: string;
  keyType: KeyType;
  result: GameResult;
  payout: string;
  timestamp: number;
}

export const useGameContract = () => {
  const { isConnected, address, provider, signer, chainId } = useWallet();
  
  // Contract state
  const [contract, setContract] = useState<Contract | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Game state
  const [jackpotPool, setJackpotPool] = useState<BigNumber | null>(null);
  const [totalGamesPlayed, setTotalGamesPlayed] = useState<BigNumber | null>(null);
  const [totalKeysUsed, setTotalKeysUsed] = useState<BigNumber | null>(null);
  const [lastJackpotWinner, setLastJackpotWinner] = useState<string | null>(null);
  const [lastJackpotAmount, setLastJackpotAmount] = useState<BigNumber | null>(null);
  const [lastJackpotWinTime, setLastJackpotWinTime] = useState<BigNumber | null>(null);
  const [jackpotTriggerCount, setJackpotTriggerCount] = useState<BigNumber | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [gameHistory, setGameHistory] = useState<GameEvent[]>([]);
  const [balance, setBalance] = useState<BigNumber | null>(null);
  
  // Initialize contract
  useEffect(() => {
    if (isConnected && provider && chainId) {
      const contractAddress = CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES];
      if (contractAddress) {
        const contractInstance = new ethers.Contract(
          contractAddress, 
          SIMPSONS_CARNIVAL_ABI, 
          signer || provider
        );
        setContract(contractInstance);
      } else {
        setError(`Contract not deployed on network ${chainId}`);
      }
    } else {
      setContract(null);
    }
  }, [isConnected, provider, signer, chainId]);

  // Fetch user balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (isConnected && address && provider) {
        try {
          const balance = await provider.getBalance(address);
          setBalance(balance);
        } catch (err) {
          console.error('Failed to fetch balance:', err);
        }
      }
    };

    fetchBalance();
    // Refresh balance every 30 seconds
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [isConnected, address, provider]);

  // Fetch contract data
  const fetchContractData = useCallback(async () => {
    if (!contract) return;
    
    try {
      setIsLoading(true);
      
      // Fetch global state
      const [
        _jackpotPool,
        _totalGamesPlayed,
        _totalKeysUsed,
        _lastJackpotWinner,
        _lastJackpotAmount,
        _lastJackpotWinTime,
        _jackpotTriggerCount
      ] = await Promise.all([
        contract.jackpotPool(),
        contract.totalGamesPlayed(),
        contract.totalKeysUsed(),
        contract.lastJackpotWinner(),
        contract.lastJackpotAmount(),
        contract.lastJackpotWinTime(),
        contract.jackpotTriggerCount()
      ]);

      setJackpotPool(_jackpotPool);
      setTotalGamesPlayed(_totalGamesPlayed);
      setTotalKeysUsed(_totalKeysUsed);
      setLastJackpotWinner(_lastJackpotWinner);
      setLastJackpotAmount(_lastJackpotAmount);
      setLastJackpotWinTime(_lastJackpotWinTime);
      setJackpotTriggerCount(_jackpotTriggerCount);

      // Fetch player-specific data if connected
      if (address) {
        const _playerStats = await contract.playerStats(address);
        setPlayerStats({
          totalGames: _playerStats.totalGames,
          totalWins: _playerStats.totalWins,
          totalLosses: _playerStats.totalLosses,
          totalBreakEvens: _playerStats.totalBreakEvens,
          totalWagered: _playerStats.totalWagered,
          totalWon: _playerStats.totalWon,
          lastPlayTime: _playerStats.lastPlayTime
        });

        // Fetch game history
        const gameIds = await contract.getPlayerGameHistory(address);
        const gameDetails = await Promise.all(
          gameIds.slice(-10).map(async (gameId: BigNumber) => {
            const details = await contract.getGameDetails(gameId);
            return {
              gameId: gameId.toNumber(),
              player: details.player,
              keyType: details.keyType === 0 ? 'BRONZE' : details.keyType === 1 ? 'SILVER' : 'GOLD',
              result: details.result === 0 ? 'PENDING' : details.result === 1 ? 'WIN' : details.result === 2 ? 'BREAK_EVEN' : 'LOSE',
              payout: ethers.utils.formatEther(details.payout),
              timestamp: details.timestamp.toNumber()
            } as GameEvent;
          })
        );
        setGameHistory(gameDetails.reverse());
      }
      
      setError(null);
    } catch (err) {
      console.error('Failed to fetch contract data:', err);
      setError('Failed to fetch contract data');
    } finally {
      setIsLoading(false);
    }
  }, [contract, address]);

  // Fetch data on contract/address change
  useEffect(() => {
    fetchContractData();
  }, [fetchContractData]);

  // Set up event listeners
  useEffect(() => {
    if (!contract) return;

    const handleKeyPurchased = (player: string, keyType: number, price: BigNumber) => {
      console.log('Key purchased:', { player, keyType, price: price.toString() });
      // Refresh data after key purchase
      fetchContractData();
    };

    const handleGameCompleted = (player: string, gameId: BigNumber, result: number, payout: BigNumber) => {
      console.log('Game completed:', { player, gameId: gameId.toString(), result, payout: payout.toString() });
      // Refresh data after game completion
      fetchContractData();
    };

    const handleJackpotWon = (winner: string, amount: BigNumber) => {
      console.log('Jackpot won:', { winner, amount: amount.toString() });
      // Refresh data after jackpot win
      fetchContractData();
    };

    contract.on('KeyPurchased', handleKeyPurchased);
    contract.on('GameCompleted', handleGameCompleted);
    contract.on('JackpotWon', handleJackpotWon);

    return () => {
      contract.off('KeyPurchased', handleKeyPurchased);
      contract.off('GameCompleted', handleGameCompleted);
      contract.off('JackpotWon', handleJackpotWon);
    };
  }, [contract, fetchContractData]);

  // Game functions
  const getKeyPrice = useCallback(async (keyType: KeyType): Promise<BigNumber> => {
    if (!contract) throw new Error('Contract not initialized');
    
    const keyTypeEnum = keyType === 'BRONZE' ? 0 : keyType === 'SILVER' ? 1 : 2;
    return await contract.getKeyPrice(keyTypeEnum);
  }, [contract]);

  const playGame = useCallback(async (keyType: KeyType, doorNumber: number): Promise<ethers.ContractTransaction> => {
    if (!contract || !signer) throw new Error('Contract or signer not initialized');
    
    const keyTypeEnum = keyType === 'BRONZE' ? 0 : keyType === 'SILVER' ? 1 : 2;
    const price = await getKeyPrice(keyType);
    
    return await contract.playGame(keyTypeEnum, doorNumber, { value: price });
  }, [contract, signer, getKeyPrice]);

  const getLeaderboard = useCallback(async (): Promise<string[]> => {
    if (!contract) throw new Error('Contract not initialized');
    return await contract.getLeaderboard();
  }, [contract]);

  // Key prices (cached)
  const keyPrices = {
    BRONZE: ethers.utils.parseEther('0.005'),
    SILVER: ethers.utils.parseEther('0.01'),
    GOLD: ethers.utils.parseEther('0.025')
  };

  return {
    // Contract state
    contract,
    isLoading,
    error,
    isConnected: isConnected && contract !== null,
    
    // Game state
    jackpotPool,
    totalGamesPlayed,
    totalKeysUsed,
    lastJackpotWinner,
    lastJackpotAmount,
    lastJackpotWinTime,
    jackpotTriggerCount,
    playerStats,
    gameHistory,
    balance,
    
    // Functions
    playGame,
    getKeyPrice,
    getLeaderboard,
    refreshData: fetchContractData,
    
    // Constants
    keyPrices
  };
};