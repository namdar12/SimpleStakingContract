const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

describe("Staking Concert", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployContracts() {
    const signers = await ethers.getSigners();

    const [
      owner,
      personStaking1,
      personStaking2,
      personStaking3,
      personStaking4,
      personStaking5,
    ] = signers;

    //Create an array containing only the personStaking signers
    const personStakingSigners = signers.slice(1);

    const Gamma = await hre.ethers.getContractFactory("Gamma", {
      from: owner.address,
    });
    const gamma = await Gamma.deploy();

    await gamma.deployed();

    console.log(`gamma deployed to ${gamma.address}`);

    const Stake = await hre.ethers.getContractFactory("Stake");
    const stake = await Stake.deploy(gamma.address);

    await stake.deployed();

    console.log(`stake deployed to ${stake.address}`);

    for (const signer of personStakingSigners) {
      const tx = await gamma.connect(owner).mint(signer.address, 1000);
      const balance = await gamma.balanceOf(signer.address);
    }

    return {
      gamma,
      stake,
      owner,
      personStakingSigners,
    };
  }

  describe("Deployment and Basic functionality", function () {
    it("Should confirm that the owner has ERC20 token minted to him", async function () {
      const { gamma, owner } = await loadFixture(deployContracts);
      const balance = await gamma.balanceOf(owner.address);
      console.log(ethers.utils.formatEther(balance));
      expect(balance.eq(10000000));
    });

    it("Should mint ERC20 tokens to each signer", async function () {
      const { gamma, personStakingSigners } = await loadFixture(
        deployContracts
      );

      for (const signer of personStakingSigners) {
        const balance = await gamma.balanceOf(signer.address);
        expect(balance.eq(1000));
      }
    });

    it("Should let each signer stake the correct amount of tokens", async function () {
      const { gamma, stake, personStakingSigners } = await loadFixture(
        deployContracts
      );
      function getRandomNumber(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
      }

      let totalStaked = 0;
      for (const signer of personStakingSigners) {
        const amountToStake = getRandomNumber(100, 999);
        await gamma.connect(signer).approve(stake.address, amountToStake);
        await stake.connect(signer).stakeToken(gamma.address, amountToStake);
        totalStaked += amountToStake;
      }

      const balance = await gamma.balanceOf(stake.address);
      expect(balance.eq(totalStaked));
    });

    it("Should allow the owner to provide to the liquidity pool", async function () {
      const { gamma, stake, owner, personStakingSigners } = await loadFixture(
        deployContracts
      );
      const amountToStake = 1000000;
      await gamma.connect(owner).approve(stake.address, amountToStake);
      await stake.connect(owner).liquidityPool(gamma.address, amountToStake);
      const balance = await gamma.balanceOf(stake.address);
      expect(balance.eq(amountToStake));
    });
    ///Unstaking test
  });

  describe("Long Term Staking", function () {
    async function distributeTokens() {
      const { gamma, stake, owner, personStakingSigners } = await loadFixture(
        deployContracts
      );

      const ownerStake = 1000000;
      await gamma.connect(owner).approve(stake.address, ownerStake);
      await stake.connect(owner).liquidityPool(gamma.address, ownerStake);

      const personStaking = 500;

      for (const signer of personStakingSigners) {
        await gamma.connect(signer).approve(stake.address, personStaking);
        await stake.connect(signer).stakeToken(gamma.address, personStaking);
      }

      return { gamma, stake, owner, personStakingSigners };
    }
    describe("Staking long term and getting rewards", function () {
      it("Should have one signer get rewards after exiting 1 year later.", async function () {
        const { gamma, stake, owner, personStakingSigners } = await loadFixture(
          distributeTokens
        );

        const currentTimestamp = (await ethers.provider.getBlock("latest"))
          .timestamp;
        console.log("Current timestamp:", currentTimestamp);

        const currentDate = new Date(currentTimestamp * 1000);
        console.log("Current date:", currentDate);
        const oneYearInSeconds = 365 * 24 * 60 * 60;

        await ethers.provider.send("evm_increaseTime", [oneYearInSeconds]);

        // Mine a new block to reflect the time change
        await ethers.provider.send("evm_mine");

        // Get the new timestamp
        const newTimestamp = (await ethers.provider.getBlock("latest"))
          .timestamp;
        const newDate = new Date(newTimestamp * 1000);
        console.log("New timestamp:", newTimestamp);
        console.log("New date:", newDate);

        const userBalance = 500;
        const rewardAmountPerToken = 50000000000000000;
        const rewardAmountPerSecond = 126839168;
        const elapsedTime = 365 * 24 * 60 * 60; // One year in seconds

        const rewardFromStakedAmount = userBalance * rewardAmountPerToken;
        const rewardFromTimeStaked = elapsedTime * rewardAmountPerSecond;

        const totalReward = Math.floor(
          (rewardFromStakedAmount + rewardFromTimeStaked) / 1e17
        );
        console.log("Total Reward Expected", totalReward);

        await stake
          .connect(personStakingSigners[0])
          .unstakeToken(gamma.address, 500);

        const balance = await gamma.balanceOf(personStakingSigners[0].address);
        //total Reward + original Stake(1000)
        expect(balance.eq(totalReward + 1000));
      });
    });
  });
});
