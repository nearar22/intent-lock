import { readFileSync } from "node:fs";
import { createAccount, createClient, isSuccessful } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";

const rawPrivateKey = process.env.GENLAYER_PRIVATE_KEY?.trim();
if (!rawPrivateKey) throw new Error("GENLAYER_PRIVATE_KEY is required");
const privateKey = rawPrivateKey.startsWith("0x") ? rawPrivateKey : `0x${rawPrivateKey}`;

const chain = {
  ...studioDevnet,
  id: 61997,
  name: "GenLayer Studio Next",
  rpcUrls: { default: { http: ["https://studio-next.genlayer.com/api"] } },
};
const account = createAccount(privateKey);
const client = createClient({ chain, account });
const code = new Uint8Array(readFileSync(new URL("../contracts/intent_lock.py", import.meta.url)));

const fees = await client.estimateTransactionFees({
  leaderTimeunitsAllocation: 125n,
  validatorTimeunitsAllocation: 250n,
});
const hash = await client.deployContract({ code, args: [], fees });
console.log(`DEPLOY_TX=${hash}`);
const receipt = await client.waitForTransactionReceipt({ hash, waitUntil: "finalized", retries: 240, interval: 3000, fullTransaction: true });
const serialized = JSON.stringify(receipt, (_, value) => typeof value === "bigint" ? value.toString() : value);
console.log(`DEPLOY_RECEIPT=${serialized}`);

if (!isSuccessful(receipt)) {
  const status = String(receipt.statusName ?? receipt.status ?? "unknown");
  const result = String(receipt.txExecutionResultName ?? receipt.txExecutionResult ?? "unknown");
  throw new Error(`Deployment failed after finalization: status=${status}, execution=${result}`);
}
const address = receipt?.data?.contract_address ?? receipt?.txDataDecoded?.contractAddress;
if (!address) throw new Error("Accepted deployment did not expose a contract address");
console.log(`CONTRACT_ADDRESS=${address}`);
