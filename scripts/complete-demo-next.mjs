import { createAccount, createClient, isSuccessful } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";

const rawPrivateKey = process.env.GENLAYER_PRIVATE_KEY?.trim();
const contractAddress = process.env.CONTRACT_ADDRESS;
if (!rawPrivateKey || !contractAddress) throw new Error("GENLAYER_PRIVATE_KEY and CONTRACT_ADDRESS are required");

const privateKey = rawPrivateKey.startsWith("0x") ? rawPrivateKey : `0x${rawPrivateKey}`;
const chain = {
  ...studioDevnet,
  id: 61997,
  name: "GenLayer Studio Next",
  rpcUrls: { default: { http: ["https://studio-next.genlayer.com/api"] } },
};
const client = createClient({ chain, account: createAccount(privateKey) });

async function write(label, functionName, args, intelligent = false) {
  const fees = await client.estimateTransactionFees({
    leaderTimeunitsAllocation: intelligent ? 300n : 125n,
    validatorTimeunitsAllocation: intelligent ? 600n : 250n,
  });
  const hash = await client.writeContract({ address: contractAddress, functionName, args, fees });
  console.log(`${label}_TX=${hash}`);
  const receipt = await client.waitForTransactionReceipt({
    hash,
    waitUntil: "finalized",
    retries: 240,
    interval: 3000,
    fullTransaction: true,
  });
  const status = String(receipt.statusName ?? receipt.status ?? "unknown");
  const result = String(receipt.txExecutionResultName ?? receipt.txExecutionResult ?? "unknown");
  console.log(`${label}_STATUS=${status};EXECUTION_RESULT=${result}`);
  if (!isSuccessful(receipt)) throw new Error(`${label} failed: status=${status}, execution=${result}`);
  return hash;
}

await write("DISTINCT_HOTEL", "submit_intent", [
  "agent-tank-demo",
  "gamma-live-1",
  "Hotel booking",
  "Reserve a hotel room in Paris for Friday night",
  "One room; free cancellation; maximum USD 220",
  "paris-friday",
  3600,
], true);

const intents = await client.readContract({
  address: contractAddress,
  functionName: "list_intents",
  args: ["agent-tank-demo"],
  jsonSafeReturn: true,
});
const hotel = intents.find((intent) => intent.request_id === "gamma-live-1");
if (!hotel || hotel.status !== "RESERVED" || hotel.relation !== "DISTINCT") {
  throw new Error(`Hotel intent was not cleared: ${JSON.stringify(hotel)}`);
}

await write("CONSUME_HOTEL", "consume_intent", [hotel.id]);
const finalState = await client.readContract({
  address: contractAddress,
  functionName: "list_intents",
  args: ["agent-tank-demo"],
  jsonSafeReturn: true,
});
console.log(`FINAL_STATE=${JSON.stringify(finalState)}`);
