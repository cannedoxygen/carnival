// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

library GameHelpers {
    function calculatePayout(uint256 wager, uint256 multiplier) internal pure returns (uint256) {
        return wager * multiplier;
    }
    
    function calculateJackpotContribution(uint256 amount, uint256 percentage) internal pure returns (uint256) {
        return (amount * percentage) / 100;
    }
    
    function isWinningOutcome(uint256 randomValue, uint256 winProbability) internal pure returns (bool) {
        return (randomValue % 100) < winProbability;
    }
    
    function isBreakEvenOutcome(uint256 randomValue, uint256 winProbability, uint256 breakEvenProbability) internal pure returns (bool) {
        uint256 outcome = randomValue % 100;
        return outcome >= winProbability && outcome < (winProbability + breakEvenProbability);
    }
    
    function calculateHouseEdge(uint256 amount, uint256 percentage) internal pure returns (uint256) {
        return (amount * percentage) / 100;
    }
}