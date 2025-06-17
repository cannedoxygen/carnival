// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "./interfaces/IRandomness.sol";
import "./libraries/GameHelpers.sol";

contract SimpsonsCarnival is Ownable, Pausable, ReentrancyGuard, VRFConsumerBaseV2 {
    using GameHelpers for uint256;

    enum KeyType { BRONZE, SILVER, GOLD }
    enum GameResult { PENDING, WIN, BREAK_EVEN, LOSE }
    
    struct Game {
        address player;
        KeyType keyType;
        uint256 wager;
        uint256 doorSelected;
        GameResult result;
        uint256 payout;
        uint256 timestamp;
        uint256 requestId;
    }

    struct PlayerStats {
        uint256 totalGames;
        uint256 totalWins;
        uint256 totalLosses;
        uint256 totalBreakEvens;
        uint256 totalWagered;
        uint256 totalWon;
        uint256 lastPlayTime;
    }

    VRFCoordinatorV2Interface private immutable vrfCoordinator;
    uint64 private immutable subscriptionId;
    bytes32 private immutable keyHash;
    uint32 private constant CALLBACK_GAS_LIMIT = 200000;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;

    uint256 public constant BRONZE_KEY_PRICE = 0.005 ether;
    uint256 public constant SILVER_KEY_PRICE = 0.01 ether;
    uint256 public constant GOLD_KEY_PRICE = 0.025 ether;
    
    uint256 public constant WIN_MULTIPLIER = 2;
    uint256 public constant JACKPOT_CONTRIBUTION_PERCENT = 5;
    uint256 public constant HOUSE_EDGE_PERCENT = 5;
    
    uint256 public constant WIN_PROBABILITY = 30;
    uint256 public constant BREAK_EVEN_PROBABILITY = 35;
    
    uint256 public jackpotPool;
    uint256 public totalGamesPlayed;
    uint256 public totalKeysUsed;
    uint256 public lastJackpotWinTime;
    uint256 public jackpotTriggerCount = 1000;
    
    mapping(address => PlayerStats) public playerStats;
    mapping(uint256 => Game) public games;
    mapping(uint256 => address) public requestIdToPlayer;
    mapping(address => uint256[]) public playerGameHistory;
    
    address[] public leaderboard;
    address public lastJackpotWinner;
    uint256 public lastJackpotAmount;
    
    event KeyPurchased(address indexed player, KeyType keyType, uint256 price);
    event GameStarted(address indexed player, uint256 indexed gameId, uint256 requestId, uint256 doorSelected);
    event GameCompleted(address indexed player, uint256 indexed gameId, GameResult result, uint256 payout);
    event JackpotWon(address indexed winner, uint256 amount);
    event JackpotContribution(uint256 amount);
    event RandomnessRequested(uint256 requestId);
    event RandomnessFulfilled(uint256 requestId, uint256 randomWord);

    constructor(
        address _vrfCoordinator,
        uint64 _subscriptionId,
        bytes32 _keyHash
    ) VRFConsumerBaseV2(_vrfCoordinator) {
        vrfCoordinator = VRFCoordinatorV2Interface(_vrfCoordinator);
        subscriptionId = _subscriptionId;
        keyHash = _keyHash;
    }

    function playGame(KeyType _keyType, uint256 _doorNumber) external payable nonReentrant whenNotPaused {
        require(_doorNumber >= 1 && _doorNumber <= 3, "Invalid door number");
        
        uint256 keyPrice = getKeyPrice(_keyType);
        require(msg.value == keyPrice, "Incorrect payment amount");
        
        uint256 requestId = vrfCoordinator.requestRandomWords(
            keyHash,
            subscriptionId,
            REQUEST_CONFIRMATIONS,
            CALLBACK_GAS_LIMIT,
            NUM_WORDS
        );
        
        uint256 gameId = totalGamesPlayed++;
        totalKeysUsed++;
        
        games[gameId] = Game({
            player: msg.sender,
            keyType: _keyType,
            wager: keyPrice,
            doorSelected: _doorNumber,
            result: GameResult.PENDING,
            payout: 0,
            timestamp: block.timestamp,
            requestId: requestId
        });
        
        requestIdToPlayer[requestId] = msg.sender;
        playerGameHistory[msg.sender].push(gameId);
        playerStats[msg.sender].totalGames++;
        playerStats[msg.sender].totalWagered += keyPrice;
        playerStats[msg.sender].lastPlayTime = block.timestamp;
        
        emit KeyPurchased(msg.sender, _keyType, keyPrice);
        emit GameStarted(msg.sender, gameId, requestId, _doorNumber);
        emit RandomnessRequested(requestId);
        
        if (totalKeysUsed % jackpotTriggerCount == 0) {
            _triggerJackpot(msg.sender);
        }
    }

    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
        address player = requestIdToPlayer[requestId];
        require(player != address(0), "Unknown request");
        
        uint256 randomValue = randomWords[0];
        emit RandomnessFulfilled(requestId, randomValue);
        
        uint256 gameId = findGameByRequestId(requestId);
        Game storage game = games[gameId];
        
        uint256 outcome = randomValue % 100;
        
        if (outcome < WIN_PROBABILITY) {
            game.result = GameResult.WIN;
            game.payout = game.wager * WIN_MULTIPLIER;
            playerStats[player].totalWins++;
            playerStats[player].totalWon += game.payout;
            
            uint256 jackpotContribution = (game.payout * JACKPOT_CONTRIBUTION_PERCENT) / 100;
            jackpotPool += jackpotContribution;
            emit JackpotContribution(jackpotContribution);
            
            (bool success,) = payable(player).call{value: game.payout}("");
            require(success, "Payout failed");
            
        } else if (outcome < WIN_PROBABILITY + BREAK_EVEN_PROBABILITY) {
            game.result = GameResult.BREAK_EVEN;
            game.payout = game.wager;
            playerStats[player].totalBreakEvens++;
            
            (bool success,) = payable(player).call{value: game.payout}("");
            require(success, "Payout failed");
            
        } else {
            game.result = GameResult.LOSE;
            game.payout = 0;
            playerStats[player].totalLosses++;
            
            uint256 houseEdge = (game.wager * HOUSE_EDGE_PERCENT) / 100;
            uint256 jackpotContribution = game.wager - houseEdge;
            jackpotPool += jackpotContribution;
            emit JackpotContribution(jackpotContribution);
        }
        
        _updateLeaderboard(player);
        emit GameCompleted(player, gameId, game.result, game.payout);
    }

    function _triggerJackpot(address winner) private {
        require(jackpotPool > 0, "No jackpot to distribute");
        
        uint256 jackpotAmount = jackpotPool;
        jackpotPool = 0;
        
        lastJackpotWinner = winner;
        lastJackpotAmount = jackpotAmount;
        lastJackpotWinTime = block.timestamp;
        
        (bool success,) = payable(winner).call{value: jackpotAmount}("");
        require(success, "Jackpot payout failed");
        
        emit JackpotWon(winner, jackpotAmount);
    }

    function _updateLeaderboard(address player) private {
        bool exists = false;
        for (uint i = 0; i < leaderboard.length; i++) {
            if (leaderboard[i] == player) {
                exists = true;
                break;
            }
        }
        
        if (!exists && leaderboard.length < 100) {
            leaderboard.push(player);
        }
        
        for (uint i = 0; i < leaderboard.length - 1; i++) {
            for (uint j = 0; j < leaderboard.length - i - 1; j++) {
                if (playerStats[leaderboard[j]].totalWon < playerStats[leaderboard[j + 1]].totalWon) {
                    address temp = leaderboard[j];
                    leaderboard[j] = leaderboard[j + 1];
                    leaderboard[j + 1] = temp;
                }
            }
        }
    }

    function getKeyPrice(KeyType _keyType) public pure returns (uint256) {
        if (_keyType == KeyType.BRONZE) return BRONZE_KEY_PRICE;
        if (_keyType == KeyType.SILVER) return SILVER_KEY_PRICE;
        if (_keyType == KeyType.GOLD) return GOLD_KEY_PRICE;
        revert("Invalid key type");
    }

    function findGameByRequestId(uint256 requestId) private view returns (uint256) {
        for (uint256 i = 0; i < totalGamesPlayed; i++) {
            if (games[i].requestId == requestId) {
                return i;
            }
        }
        revert("Game not found");
    }

    function getPlayerGameHistory(address player) external view returns (uint256[] memory) {
        return playerGameHistory[player];
    }

    function getLeaderboard() external view returns (address[] memory) {
        return leaderboard;
    }

    function getGameDetails(uint256 gameId) external view returns (Game memory) {
        return games[gameId];
    }

    function setJackpotTriggerCount(uint256 _count) external onlyOwner {
        require(_count > 0, "Invalid count");
        jackpotTriggerCount = _count;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function emergencyWithdraw() external onlyOwner {
        require(paused(), "Contract must be paused");
        uint256 balance = address(this).balance;
        (bool success,) = payable(owner()).call{value: balance}("");
        require(success, "Withdrawal failed");
    }

    receive() external payable {
        jackpotPool += msg.value;
        emit JackpotContribution(msg.value);
    }
}