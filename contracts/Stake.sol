// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "hardhat/console.sol";


contract Stake {

    // prevent reentrancy
    bool internal locked;

    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    address public owner;

    uint256 public rewardAmountPerSecond = 126839168; 
    uint256 public rewardAmountPerToken = 50000000000000000; 

    IERC20 public erc20Contract;

    struct userInformation {
        uint256 userBalance;
        uint256 timeJoined;
        uint256 timeLeft;
    }

    mapping(address => userInformation) users;

    constructor(IERC20 _erc20ContractAddress){
        owner = msg.sender;
        erc20Contract = _erc20ContractAddress;
    }

    modifier noReentrance {
        require(!locked,'No-Reentrance');
        locked = true;
        _;
        locked = false;
    }

    modifier onlyOwner() {
        require(msg.sender == owner);
        _;

    }

    function stakeToken(IERC20 token, uint256 amount) public noReentrance{
        require(token == erc20Contract,'Incorrect Token');
        require(amount <= token.balanceOf(msg.sender),'Not Enough Tokens');
        token.safeTransferFrom(msg.sender,address(this),amount);
        users[msg.sender].userBalance = users[msg.sender].userBalance.add(amount);
        users[msg.sender].timeJoined = block.timestamp;
    }

    function unstakeToken(IERC20 token, uint256 amount) public noReentrance{
        require(token == erc20Contract,'Incorrect Token');
        require(users[msg.sender].userBalance >= amount,'Not Enough Funds');
        users[msg.sender].timeLeft = block.timestamp;
        uint256 rewardEarned = SafeMath.add(amount,calculateReward(msg.sender));
        token.safeTransfer(msg.sender,rewardEarned);
        users[msg.sender].userBalance = users[msg.sender].userBalance.sub(amount);
        users[msg.sender].timeJoined = 0;
    }

    function calculateReward(address user) internal view returns (uint256) {
        uint256 elapsedTime = SafeMath.sub(users[user].timeLeft, users[user].timeJoined);
        uint256 rewardFromStakedAmount = SafeMath.mul(users[user].userBalance, rewardAmountPerToken);
        uint256 rewardFromTimeStaked = SafeMath.mul(elapsedTime, rewardAmountPerSecond);
        uint256 totalReward = SafeMath.add(rewardFromStakedAmount, rewardFromTimeStaked)/ 1e17;
        return totalReward;
    }

    function liquidityPool(IERC20 token, uint256 amount) public onlyOwner {
        require(token == erc20Contract,'Incorrect Token');
        require(amount <= token.balanceOf(msg.sender),'Not Enough Tokens');
        token.safeTransferFrom(msg.sender,address(this),amount);
    }


}