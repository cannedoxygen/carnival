// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IRandomness {
    function requestRandomWords(
        bytes32 keyHash,
        uint64 subId,
        uint16 minimumRequestConfirmations,
        uint32 callbackGasLimit,
        uint32 numWords
    ) external returns (uint256 requestId);

    function fulfillRandomWords(
        uint256 requestId,
        uint256[] memory randomWords
    ) external;
}