// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const { ethers } = require("hardhat");

async function main() {
  const [owner] = await ethers.getSigners();
  let SequentialSteps;
  /*const SequentialStepsAddress = "0x8fA3fc337E5A20e97B2Fa190C9dD89171384da97"; // !!! paste here your deployed smart contract address !!!
  if (!ethers.isAddress(SequentialStepsAddress)) {
    /*console.log("Invalid TestERC20Address");
    return false;*/
  SequentialSteps = await ethers.deployContract("SequentialSteps");
  await SequentialSteps.waitForDeployment();
  console.log(`SequentialSteps deployed to ${SequentialSteps.target}`);
  /*} else {
    SequentialSteps = await ethers.getContractAt(
      "SequentialSteps",
      SequentialStepsAddress
    );
  }*/

  /*const tx1 = await SequentialSteps.stepOne();
  await tx1.wait(3);
  console.log("Transaction 1:", tx1);

  const tx2 = await SequentialSteps.stepTwo();
  await tx2.wait(3);
  console.log("Transaction 2:", tx2);

  const tx3 = await SequentialSteps.stepThree();
  await tx3.wait(3);
  console.log("Transaction 3:", tx3);*/
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
