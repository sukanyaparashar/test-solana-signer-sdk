import { createRequire } from "module";
const require = createRequire(import.meta.url);
const {
  SolanaNeonAccount,
  MultipleTransactions,
  createScheduledNeonEvmMultipleTransaction,
  getGasToken,
  getProxyState,
  ScheduledTransaction,
  solanaAirdrop,
  sendSolanaTransaction,
  createBalanceAccountInstruction,
  NO_CHILD_INDEX,
  delay,
} = require("@neonevm/solana-sign");
const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const bs58 = require("bs58").default;
const { JsonRpcProvider, toBeHex } = require("ethers");
require("dotenv").config();

async function asyncTimeout(timeout) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), timeout);
  });
}

async function main() {
  const proxyResult = await getProxyState("https://devnet.neonevm.org/SOL");
  const provider = new JsonRpcProvider("https://devnet.neonevm.org/SOL");
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
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

  const contractAddress = "0xF53cbf336acb50c3920EA82D7771BBb880565B78"; // Replace with the contract address

  const { maxPriorityFeePerGas, maxFeePerGas } =
    await neonProxyRpcApi.getMaxFeePerGas();

  // Create a multiple scheduled transactions instance
  const multiple = new MultipleTransactions(
    nonce,
    maxFeePerGas,
    maxPriorityFeePerGas
  );
  const transaction1 = new ScheduledTransaction({
    nonce: nonce,
    payer: solanaUser.neonWallet,
    index: 0,
    target: contractAddress,
    callData: "0x0b3cbe36",
    maxFeePerGas: maxFeePerGas,
    maxPriorityFeePerGas: maxPriorityFeePerGas,
    //gasLimit: 1e9,
    chainId: chainId,
  });
  multiple.addTransaction(transaction1, 1, 0);

  const transaction2 = new ScheduledTransaction({
    nonce: nonce,
    payer: solanaUser.neonWallet,
    index: 1,
    target: contractAddress,
    callData: "0xa67931d3",
    maxFeePerGas: maxFeePerGas,
    maxPriorityFeePerGas: maxPriorityFeePerGas,
    //gasLimit: 1e9,
    chainId: chainId,
  });
  multiple.addTransaction(transaction2, 2, 1);

  const transaction3 = new ScheduledTransaction({
    nonce: nonce,
    payer: solanaUser.neonWallet,
    index: 2,
    target: contractAddress,
    callData: "0xb8048d49",
    maxFeePerGas: maxFeePerGas,
    maxPriorityFeePerGas: maxPriorityFeePerGas,
    //gasLimit: 1e9,
    chainId: chainId,
  });
  multiple.addTransaction(transaction3, NO_CHILD_INDEX, 1);

  // Create the multiple scheduled Neon EVM transaction
  const createScheduledTransaction = createScheduledNeonEvmMultipleTransaction({
    chainId,
    neonEvmProgram,
    neonTransaction: multiple.data,
    signerAddress: solanaUser.publicKey,
    tokenMintAddress: solanaUser.tokenMint,
    neonWallet: solanaUser.neonWallet,
    neonWalletNonce: nonce,
  });
  console.log("\nScheduled transaction:", createScheduledTransaction);

  // Send the raw Solana transaction
  const transactionSignature = await sendSolanaTransaction(
    connection,
    createScheduledTransaction,
    [solanaUser.signer]
  );
  console.log("\nTransaction signature:", transactionSignature);

  const scheduledTransactions = [transaction1, transaction2, transaction3];
  const results = await Promise.all(
    scheduledTransactions.map((tx) =>
      neonProxyRpcApi.sendRawScheduledTransaction(`0x${tx.serialize()}`)
    )
  );
  console.log("Results:", results);

  // Gets the transaction execution tree and logs out the successful transactions
  let transactions = [];
  let attempts = 0;

  while (true) {
    transactions = await neonProxyRpcApi.waitTransactionTreeExecution(
      solanaUser.neonWallet,
      nonce,
      7e3
    );
    console.log(`\nScheduled transactions result`, transactions);

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
    await asyncTimeout(5e3);
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
