import { createAccount, createClient, isSuccessful } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";

const rawPrivateKey = process.env.GENLAYER_PRIVATE_KEY?.trim();
const contractAddress = process.env.CONTRACT_ADDRESS;
if (!rawPrivateKey || !contractAddress) throw new Error("GENLAYER_PRIVATE_KEY and CONTRACT_ADDRESS are required");
const privateKey = rawPrivateKey.startsWith("0x") ? rawPrivateKey : `0x${rawPrivateKey}`;
const chain = { ...studioDevnet, id: 61997, name: "GenLayer Studio Next", rpcUrls: { default: { http: ["https://studio-next.genlayer.com/api"] } } };
const account = createAccount(privateKey);
const client = createClient({ chain, account });

async function write(name, functionName, args, intelligent = false) {
  const fees = await client.estimateTransactionFees({
    leaderTimeunitsAllocation: intelligent ? 300n : 125n,
    validatorTimeunitsAllocation: intelligent ? 600n : 250n,
  });
  const hash = await client.writeContract({ address: contractAddress, functionName, args, fees });
  console.log(`${name}_TX=${hash}`);
  const receipt = await client.waitForTransactionReceipt({ hash, waitUntil: "finalized", retries: 240, interval: 3000, fullTransaction: true });
  const status = String(receipt.statusName ?? receipt.status ?? "");
  const result = String(receipt.txExecutionResultName ?? receipt.txExecutionResult ?? "unknown");
  console.log(`${name}_STATUS=${status};EXECUTION_RESULT=${result}`);
  if (!isSuccessful(receipt)) throw new Error(`${name} failed after finalization: status=${status}, execution=${result}`);
  return hash;
}

await write("WORKSPACE", "create_workspace", ["agent-tank-demo", "Agent Tank Flight Desk"]);
await write("FIRST_INTENT", "submit_intent", ["agent-tank-demo", "alpha-live-1", "Airline booking", "Book a refundable flight to Paris this Friday", "One passenger; maximum total price USD 450", "paris-friday", 3600]);
await write("PARAPHRASE", "submit_intent", ["agent-tank-demo", "beta-live-1", "Flight reservation", "Reserve a cancellable Paris ticket for Friday", "One traveler; do not exceed $450 all in", "paris-friday", 3600], true);
const intents = await client.readContract({ address: contractAddress, functionName: "list_intents", args: ["agent-tank-demo"], jsonSafeReturn: true });
console.log(`LIVE_STATE=${JSON.stringify(intents)}`);
