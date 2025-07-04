# <� Game Mechanics - The Simpsons Carnival

## Overview

The Simpsons Carnival is a provably fair door-selection game where players purchase keys to participate in rounds with the chance to win ETH prizes or trigger massive progressive jackpots.

## <� Core Game Flow

### 1. Key Purchase Phase

Players must first purchase a key to participate in a game round:

| Key Type | Price | Description |
|----------|-------|-------------|
| >I Bronze | 0.005 ETH | Entry-level key for new players |
| >H Silver | 0.01 ETH | Standard key with better risk/reward |
| >G Gold | 0.025 ETH | Premium key for high rollers |

**Key Selection Strategy:**
- All key types have identical win probabilities
- Higher-value keys offer proportionally larger payouts
- Choose based on your risk tolerance and bankroll

### 2. Door Selection Phase

After purchasing a key, players choose from **3 mysterious doors**:

```
=� Door 1    =� Door 2    =� Door 3
```

**Important Notes:**
- Door selection is purely cosmetic - all doors have equal probability
- The choice adds psychological engagement but doesn't affect outcomes
- Random number generation occurs after door selection

### 3. Randomness Generation

The game uses **Chainlink VRF (Verifiable Random Function)** for provably fair outcomes:

```solidity
// Pseudocode for outcome determination
uint256 outcome = randomValue % 100;

if (outcome < 30) {
    result = WIN;           // 30% probability
} else if (outcome < 65) {
    result = BREAK_EVEN;    // 35% probability  
} else {
    result = LOSE;          // 35% probability
}
```

### 4. Result Determination

Three possible outcomes with fixed probabilities:

#### <� WIN (30% probability)
- **Payout:** 2x your key price
- **Example:** Bronze key (0.005 ETH) � Win 0.01 ETH
- **Jackpot Contribution:** 5% of payout goes to jackpot pool

#### � BREAK-EVEN (35% probability)  
- **Payout:** 1x your key price (get your money back)
- **Example:** Silver key (0.01 ETH) � Receive 0.01 ETH back
- **No jackpot contribution**

#### =� LOSE (35% probability)
- **Payout:** 0 ETH
- **House Edge:** 5% of wager goes to contract owner
- **Jackpot Contribution:** 95% of wager goes to jackpot pool

## =� Economic Model

### Payout Structure

```
Player Wager: 100%
   WIN (30%): Player gets 200% back
      Player Receives: 200%
      Jackpot Contribution: 10% (5% of 200% payout)
   BREAK-EVEN (35%): Player gets 100% back  
      Player Receives: 100%
      No additional contributions
   LOSE (35%): Player gets 0% back
       House Edge: 5%
       Jackpot Contribution: 95%
```

### Expected Value Calculation

For any key purchase, the expected value is:

```
EV = (0.30 � 2.0) + (0.35 � 1.0) + (0.35 � 0.0) = 0.95

Expected Return = 95% of wager
House Edge = 5%
```

### Jackpot Economics

The jackpot pool grows through:
- **95% of all losing wagers** (largest contributor)
- **5% of all winning payouts** (smaller but consistent)
- **Direct community contributions** (optional)

**Jackpot Trigger:**
- Automatically distributed every N keys used (default: 1,000)
- Winner is the player who triggers the Nth key usage
- Entire jackpot pool goes to the trigger player
- Pool resets to 0 after distribution

## <� Strategy Guide

### Bankroll Management

**Conservative Strategy:**
- Stick to Bronze keys (0.005 ETH)
- Play small amounts frequently
- Focus on break-even and small wins

**Aggressive Strategy:**
- Use Gold keys (0.025 ETH) 
- Higher risk, higher reward
- Larger jackpot contributions

**Jackpot Hunting:**
- Monitor total keys used counter
- Time entries around trigger points
- Consider expected jackpot value vs. key cost

### Statistical Considerations

**Law of Large Numbers:**
- Short-term results can vary significantly
- Over many games, results converge to expected probabilities
- Never chase losses with larger bets

**Jackpot Timing:**
- No way to predict exact trigger timing
- Each key has equal chance of triggering
- Jackpot value visible in real-time

## =' Technical Implementation

### Smart Contract Logic

```solidity
function playGame(KeyType _keyType, uint256 _doorNumber) external payable {
    // 1. Validate payment and door selection
    require(msg.value == getKeyPrice(_keyType), "Incorrect payment");
    require(_doorNumber >= 1 && _doorNumber <= 3, "Invalid door");
    
    // 2. Request randomness from Chainlink VRF
    uint256 requestId = vrfCoordinator.requestRandomWords(...);
    
    // 3. Store game state
    games[gameId] = Game({
        player: msg.sender,
        keyType: _keyType,
        wager: msg.value,
        doorSelected: _doorNumber,
        result: PENDING,
        // ...
    });
    
    // 4. Check for jackpot trigger
    if (totalKeysUsed % jackpotTriggerCount == 0) {
        _triggerJackpot(msg.sender);
    }
}
```

### Randomness Verification

Players can verify game fairness by:
1. Checking the VRF request transaction on-chain
2. Verifying the random number used for their game
3. Recalculating the outcome using the documented algorithm

### Game State Tracking

```solidity
struct Game {
    address player;        // Who played
    KeyType keyType;       // Bronze/Silver/Gold
    uint256 wager;         // Amount paid
    uint256 doorSelected;  // 1, 2, or 3
    GameResult result;     // WIN/BREAK_EVEN/LOSE
    uint256 payout;        // Amount won
    uint256 timestamp;     // When played
    uint256 requestId;     // VRF request ID
}
```

## =� Statistics & Analytics

### Player Statistics

The contract tracks for each player:
- Total games played
- Win/loss/break-even counts
- Total amount wagered
- Total amount won
- Last play timestamp

### Global Statistics

System-wide metrics:
- Total games across all players
- Total keys used (for jackpot triggering)
- Current jackpot pool size
- Last jackpot winner and amount
- Leaderboard rankings

### Leaderboard System

Players are ranked by:
1. **Primary:** Total ETH won
2. **Secondary:** Total games played (tiebreaker)

Leaderboard features:
- Top 100 players displayed
- Real-time updates after each game
- Historical preservation of top performers

## =� Security & Fairness

### Provably Fair Gaming

**Chainlink VRF Benefits:**
- Cryptographically secure randomness
- Publicly verifiable on-chain
- Impossible for players or house to manipulate
- Industry standard for Web3 gaming

**Verification Process:**
1. VRF request is made with public parameters
2. Chainlink nodes generate random number
3. Number is verified cryptographically
4. Game outcome calculated transparently on-chain

### Anti-Exploitation Measures

**Reentrancy Protection:**
- OpenZeppelin's ReentrancyGuard prevents recursive calls
- All state changes occur before external calls

**Access Control:**
- Critical functions restricted to contract owner
- Emergency pause functionality for security incidents
- Timelocks on parameter changes (recommended for production)

**Input Validation:**
- All user inputs validated for correctness
- Overflow protection built into Solidity 0.8+
- Comprehensive bounds checking

## = Game Variations (Future)

### Planned Enhancements

**Multiple Door Counts:**
- 5-door mode with different probabilities
- 10-door extreme mode
- Custom door count events

**Dynamic Probabilities:**
- Probability adjustments based on jackpot size
- Special event modes with boosted win rates
- Seasonal probability modifications

**Advanced Key Types:**
- Limited edition keys with unique properties
- NFT keys with special benefits
- Community-designed key variants

**Tournament Mode:**
- Scheduled competitive events
- Entry fee tournaments
- Leaderboard competitions with prizes

## =� Mathematical Analysis

### Probability Distribution

```
Outcome Probabilities:
- WIN: 30% (0.30)
- BREAK_EVEN: 35% (0.35)  
- LOSE: 35% (0.35)

Payout Multipliers:
- WIN: 2.0x
- BREAK_EVEN: 1.0x
- LOSE: 0.0x
```

### Variance Analysis

**Standard Deviation per Game:**
```
� = [�(xi - �)� � P(xi)]
� H 0.85 � wager_amount
```

**High variance means:**
- Significant short-term swings possible
- Large samples needed for convergence
- Exciting gameplay with big win potential

### Kelly Criterion Application

For optimal bankroll management:
```
f* = (bp - q) / b

Where:
b = 1 (1:1 odds on wins above expected)
p = probability of favorable outcome
q = probability of unfavorable outcome

Recommended bet size = Kelly fraction � bankroll
```

---

*Remember: This is a game of chance. Never wager more than you can afford to lose. Play responsibly!*