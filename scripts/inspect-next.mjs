import { createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";
const hash = process.argv[2];
if (!hash) throw new Error("transaction hash required");
const chain = { ...studioDevnet, id: 61997, name: "GenLayer Studio Next", rpcUrls: { default: { http: ["https://studio-next.genlayer.com/api"] } } };
const client = createClient({ chain });
const tx = await client.getTransaction({ hash });
function walk(value, path = "") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const next = path ? `${path}.${key}` : key;
    if (/status|result|receipt|outcome|error/i.test(key) && (child === null || typeof child !== "object")) console.log(`${next}=${String(child)}`);
    walk(child, next);
  }
}
walk(tx);
console.log("LEADER=" + JSON.stringify(tx?.consensus_data?.leader_receipt ?? null, (_, value) => typeof value === "bigint" ? value.toString() : value));
