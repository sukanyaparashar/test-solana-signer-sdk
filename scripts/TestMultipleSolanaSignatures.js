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
  NO_CHILD_INDEX,
  delay,
} = require("@neonevm/solana-sign");
const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const bs58 = require("bs58").default;
const { JsonRpcProvider, toBeHex } = require("ethers");
require("dotenv").config();

const proxyResult = await getProxyState("https://devnet.neonevm.org/SOL");
const provider = new JsonRpcProvider("https://devnet.neonevm.org/SOL");
const connection = new Connection("https://api.devnet.solana.com", "confirmed");
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

const contractAddress = "0x867eEd41B42D7c8C0cbC51a4d837B3Af268B7264"; // Replace with the contract address

const { maxPriorityFeePerGas, maxFeePerGas } =
  await neonProxyRpcApi.getMaxFeePerGas();

// Create a multiple scheduled transactions instance
const multiple = new MultipleTransactions(nonce, maxFeePerGas);
const transaction1 = new ScheduledTransaction({
  nonce: nonce,
  payer: solanaUser.neonWallet,
  index: 0,
  target: contractAddress,
  callData: "0x0b3cbe36",
  maxFeePerGas: maxFeePerGas,
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

// Creates a balance program account for the Neon wallet if doesn't exist
const account = await connection.getAccountInfo(solanaUser.balanceAddress);
if (account === null) {
  createScheduledTransaction.instructions.unshift(
    createBalanceAccountInstruction(
      neonEvmProgram,
      solanaUser.publicKey,
      solanaUser.neonWallet,
      solanaUser.chainId
    )
  );
}

// Send the raw Solana transaction
const transactionSignature = await sendSolanaTransaction(
  connection,
  createScheduledTransaction,
  [solanaUser.signer]
);
console.log("\nTransaction signature:", transactionSignature);

const scheduledTransactions = [transaction1, transaction2, transaction3];
/*const results = await Promise.all(
  scheduledTransactions.map((tx) =>
    neonProxyRpcApi.sendRawScheduledTransaction(`0x${tx.serialize()}`)
  )
);*/
const results = [];
for (const transaction of scheduledTransactions) {
  results.push(
    neonProxyRpcApi.sendRawScheduledTransaction(`0x${transaction.serialize()}`)
  );
}
console.log("Results:", results);

const transactions = await neonProxyRpcApi.waitTransactionTreeExecution(
  solanaUser.neonWallet,
  nonce,
  7e3
);
console.log(`\nScheduled transactions result`, transactions);

const receipts = await Promise.all(
  transactions.map(({ transactionHash }) =>
    neonProxyRpcApi.getTransactionReceipt(transactionHash)
  )
);
console.log("\nReceipts:", receipts);

for (const { transactionHash, status } of transactions) {
  const { result } = await neonProxyRpcApi.getTransactionReceipt(
    transactionHash
  );
  delay(2e3);
  console.log(`\nTx ${transactionHash}, Status:`, status);
  console.log("\nTransaction receipt:", result);
}
