import { createRequire } from "module";
const require = createRequire(import.meta.url);
const {
  NeonProxyRpcApi,
  createBalanceAccountInstruction,
  solanaAirdrop,
  delay,
} = require("@neonevm/solana-sign");
const { Connection, Keypair } = require("@solana/web3.js");
const bs58 = require("bs58").default;
require("dotenv").config();

async function main() {
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );
  const proxyApi = new NeonProxyRpcApi("https://devnet.neonevm.org/sol");

  const solanaPrivateKey = bs58.decode(process.env.SOLANA_PRIVATE_KEY);
  const keypair = Keypair.fromSecretKey(solanaPrivateKey);
  const { chainId, solanaUser, provider, programAddress, tokenMintAddress } =
    await proxyApi.init(keypair);
  await solanaAirdrop(connection, solanaUser.publicKey, 1e9);

  const nonce = Number(
    await proxyApi.getTransactionCount(solanaUser.neonWallet)
  );

  const contractAddress = "0x11adc2d986e334137b9ad0a0f290771f31e9517f"; // Replace with the contract address
  const calldata =
    "0x095ea7b300000000000000000000000058631A7B7805781A8A0aF44AEd86AD28BA1722f6000000000000000000000000000000000000000000000000000000003b9aca00";

  const transactionData = {
    from: solanaUser.neonWallet,
    to: contractAddress,
    data: calldata,
  };

  const transactionGas = await proxyApi.estimateScheduledTransactionGas({
    solanaPayer: solanaUser.publicKey,
    transactions: [transactionData],
  });
  console.log("Transaction Gas:", transactionGas);

  const { scheduledTransaction } = await proxyApi.createScheduledTransaction({
    transactionGas,
    transactionData,
    nonce,
  });

  // Creates a balance program account for the Neon wallet if doesn't exist
  const account = await connection.getAccountInfo(solanaUser.balanceAddress);

  if (account === null) {
    const { neonEvmProgram, publicKey, neonWallet, chainId } = solanaUser;
    scheduledTransaction.instructions.unshift(
      createBalanceAccountInstruction(
        neonEvmProgram,
        publicKey,
        neonWallet,
        chainId
      )
    );
  }

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  scheduledTransaction.recentBlockhash = blockhash;
  scheduledTransaction.sign({
    publicKey: solanaUser.publicKey,
    secretKey: solanaUser.keypair.secretKey,
  });
  const signature = await connection.sendRawTransaction(
    scheduledTransaction.serialize()
  );
  console.log("Transaction signature", signature);

  // Gets the transaction execution tree and logs out the successful transactions
  let transactions = [];
  let attempts = 0;

  while (true) {
    transactions = await proxyApi.waitTransactionTreeExecution(
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
      const res = await proxyApi.getTransactionReceipt(transactionHash);
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
