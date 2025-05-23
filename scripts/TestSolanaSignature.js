import { createRequire } from "module";
const require = createRequire(import.meta.url);
const {
  SolanaNeonAccount,
  createBalanceAccountInstruction,
  createScheduledNeonEvmTransaction,
  getGasToken,
  getProxyState,
  ScheduledTransaction,
  solanaAirdrop,
  delay,
} = require("@neonevm/solana-sign");
const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const bs58 = require("bs58").default;
const { JsonRpcProvider, toBeHex } = require("ethers");
require("dotenv").config();

async function main() {
  const proxyResult = await getProxyState("https://devnet.neonevm.org/SOL");
  const provider = new JsonRpcProvider("https://devnet.neonevm.org/SOL");
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );
  const response = await provider.getNetwork();
  const chainId = Number(response.chainId);
  console.log("\nChain ID:", chainId);

  const token = getGasToken(proxyResult.tokensList, chainId);
  const neonProxyRpcApi = proxyResult.proxyApi;
  const neonEvmProgram = proxyResult.evmProgramAddress;
  const chainTokenMint = new PublicKey(token.gasToken.tokenMint);

  // Derive a Ethereum-style Neon wallet address associated with the Solana wallet
  const solanaPrivateKey = bs58.decode(process.env.SOLANA_PRIVATE_KEY);
  const keypair = Keypair.fromSecretKey(solanaPrivateKey);
  const solanaUser = SolanaNeonAccount.fromKeypair(
    keypair,
    neonEvmProgram,
    chainTokenMint,
    chainId
  );
  await solanaAirdrop(connection, solanaUser.publicKey, 1e9);

  const nonce = Number(
    await neonProxyRpcApi.getTransactionCount(solanaUser.neonWallet)
  );
  console.log("\nNonce:", nonce);

  const contractAddress = "0x11adc2d986e334137b9ad0a0f290771f31e9517f"; // Replace with the contract address
  const calldata =
    "0x095ea7b300000000000000000000000058631A7B7805781A8A0aF44AEd86AD28BA1722f6000000000000000000000000000000000000000000000000000000003b9aca00";

  // Estimate gas for the transaction intended to get executed
  const { result: result1 } = await neonProxyRpcApi.estimateScheduledGas({
    scheduledSolanaPayer: solanaUser.publicKey.toBase58(),
    transactions: [
      {
        from: solanaUser.neonWallet,
        to: contractAddress,
        data: calldata,
      },
    ],
  });

  const maxFeePerGas = result1?.maxFeePerGas;
  const maxPriorityFeePerGas = result1?.maxPriorityFeePerGas;
  const gasLimit = result1?.gasList[0];

  // Create the scheduled transaction
  const scheduledTransaction = new ScheduledTransaction({
    nonce: nonce,
    payer: solanaUser.neonWallet,
    target: contractAddress,
    callData: calldata,
    maxFeePerGas: maxFeePerGas,
    maxPriorityFeePerGas: maxPriorityFeePerGas,
    gasLimit: Number(gasLimit),
    chainId: chainId,
  });
  console.log("\nScheduled transaction:", scheduledTransaction);

  // Create the scheduled Neon EVM transaction
  const transaction = createScheduledNeonEvmTransaction({
    chainId,
    signerAddress: solanaUser.publicKey,
    tokenMintAddress: solanaUser.tokenMint,
    neonEvmProgram,
    neonWallet: solanaUser.neonWallet,
    neonWalletNonce: nonce,
    neonTransaction: scheduledTransaction.serialize(),
  });
  console.log("\nScheduled Neon EVM transaction:", transaction);

  // Creates a balance program account for the Neon wallet if doesn't exist
  const account = await connection.getAccountInfo(solanaUser.balanceAddress);
  if (account === null) {
    transaction.instructions.unshift(
      createBalanceAccountInstruction(
        neonEvmProgram,
        solanaUser.publicKey,
        solanaUser.neonWallet,
        solanaUser.chainId
      )
    );
  }

  // Get the recent Solana blockhash
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  console.log("\nBlockhash:", blockhash);
  transaction.recentBlockhash = blockhash;

  // Sign and send the raw Solana transaction
  transaction.sign({
    publicKey: solanaUser.publicKey,
    secretKey: solanaUser.keypair.secretKey,
  });
  const signature = await connection.sendRawTransaction(
    transaction.serialize()
  );
  console.log("\nTransaction signature:", signature);

  // Gets the transaction execution tree and logs out the successful transactions
  let transactions = [];
  let attempts = 0;

  while (true) {
    transactions = await neonProxyRpcApi.waitTransactionTreeExecution(
      solanaUser.neonWallet,
      nonce,
      7000 // wait 7 seconds max per poll
    );

    const allSuccessful =
      transactions.length > 0 &&
      transactions.every(
        ({ status }) => status === "Success" || status === "Failed"
      );

    if (allSuccessful) {
      console.log("✅ All transactions succeeded:", transactions);
      break;
    }

    attempts++;
    console.log(
      `⏳ Attempt ${attempts}: Not all successful yet. Retrying in 2s...`
    );
    await delay(2000);
  }

  // Gets the transaction receipts of the transactions
  for (const { transactionHash, status } of transactions) {
    let result = null;
    let attempts = 0;

    while (result === null) {
      const res = await neonProxyRpcApi.getTransactionReceipt(transactionHash);
      result = res?.result ?? null;

      if (result !== null) {
        console.log(`\n✅ Tx ${transactionHash}, Status: ${status}`);
        console.log("📄 Transaction receipt:", result);
        break;
      }

      attempts++;
      console.log(
        `⏳ Tx ${transactionHash} receipt not ready. Attempt ${attempts}. Retrying in 2s...`
      );
      await delay(2000);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
