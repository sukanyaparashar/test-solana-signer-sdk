# Test Solana Signer SDK

This directory contains example scripts to test single and multiple scheduled transactions with Solana Signer SDK.

## Cloning repository

Run command

```sh
git clone https://github.com/sukanyaparashar/test-solana-signer-sdk.git
cd test-solana-signer-sdk
```

## Install the required dependencies

```sh
npm install
```

## Set up .env file

Create a .env file in the root project folder and add these lines -

```sh
NEON_PRIVATE_KEY=<NEON_PRIVATE_KEY>
SOLANA_PRIVATE_KEY=<SOLANA_PRIVATE_KEY>
```

## Single Scheduled Transaction

This example uses the [WNEON contract](https://neon-devnet.blockscout.com/address/0x11adC2d986E334137b9ad0a0F290771F31e9517F) on Neon EVM Devnet. Running the script will schedule an "approve" function execution for a Neon EVM wallet.

### Run the script

```sh
node scripts/TestSolanaSignature.js
```

## Multiple Scheduled Transactions

### Deploy an example smart contract having functions dependent on each other for successful execution

```sh
npx hardhat compile
npx hardhat run scripts/DeploySequentialSteps.js --network neondevnet
```

### Run the script

```sh
node scripts/TestMultipleSolanaSignatures.js
```
