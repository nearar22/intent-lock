"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GenLayerTransactionPanel, type SubmitInput, type TrackedStatus } from "@genlayer/transaction-kit-react";
import { AlertTriangle, ArrowRight, CircleDot, Clock3, PlaneLanding, Radar, ShieldCheck, X } from "lucide-react";
import { AccountPanel } from "@/components/AccountPanel";
import { GENLAYER_NETWORK, createGenLayerClient, getContractAddress } from "@/lib/genlayer/client";
import { useTransactionKit } from "@/lib/genlayer/kit";
import { useWallet } from "@/lib/genlayer/wallet";
import { buildReviewTransaction, type ReviewResolution } from "@/lib/intent-lock/review";

type Intent = {
  id: string; request_id: string; executor: string; target: string; action: string;
  constraints: string; window_key: string; relation: "DISTINCT" | "DUPLICATE" | "AMBIGUOUS";
  duplicate_of: string; status: string; expires_at: number; consumed_at: number;
};

function plain(value: unknown): any {
  if (value instanceof Map) return Object.fromEntries(Array.from(value.entries()).map(([k, v]) => [k, plain(v)]));
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  return typeof value === "bigint" ? Number(value) : value;
}

const presets = [
  { label: "Alpha: Paris flight", target: "Airline booking", action: "Book a refundable flight to Paris this Friday", constraints: "One passenger; maximum total price USD 450", request: "alpha-flight" },
  { label: "Beta: paraphrased retry", target: "Flight reservation", action: "Reserve a cancellable Paris ticket for Friday", constraints: "One traveler; do not exceed $450 all in", request: "beta-retry" },
  { label: "Gamma: Paris hotel", target: "Hotel booking", action: "Reserve a hotel room in Paris for Friday night", constraints: "One room; free cancellation; maximum USD 220", request: "gamma-hotel" },
];

function shorten(value: string) { return value.length > 18 ? `${value.slice(0, 9)}...${value.slice(-5)}` : value; }

export default function HomePage() {
  const wallet = useWallet();
  const kit = useTransactionKit(wallet.address);
  const queryClient = useQueryClient();
  const contractAddress = getContractAddress();
  const [workspace, setWorkspace] = useState("agent-tank-demo");
  const [workspaceName, setWorkspaceName] = useState("Agent Tank Flight Desk");
  const [agent, setAgent] = useState("");
  const [requestId, setRequestId] = useState("alpha-flight");
  const [target, setTarget] = useState(presets[0].target);
  const [action, setAction] = useState(presets[0].action);
  const [constraints, setConstraints] = useState(presets[0].constraints);
  const [windowKey, setWindowKey] = useState("paris-friday");
  const [activeTx, setActiveTx] = useState<"workspace" | "agent" | "intent" | "consume" | "review" | null>(null);
  const [consumeId, setConsumeId] = useState("");
  const [reviewId, setReviewId] = useState("");
  const [reviewResolution, setReviewResolution] = useState<ReviewResolution>("DISTINCT");
  const [reviewDuplicateOf, setReviewDuplicateOf] = useState("");
  const [reviewLease, setReviewLease] = useState(900);

  const client = useMemo(() => createGenLayerClient(wallet.address || undefined), [wallet.address]);
  const intentsQuery = useQuery<Intent[]>({
    queryKey: ["intents", contractAddress, workspace], enabled: Boolean(contractAddress && workspace), retry: false, refetchInterval: 12000,
    queryFn: async () => plain(await client.readContract({ address: contractAddress as `0x${string}`, functionName: "list_intents", args: [workspace] })) as Intent[],
  });
  const intents = intentsQuery.data || [];

  const tx = useMemo<SubmitInput | null>(() => {
    if (!contractAddress || !activeTx) return null;
    const base = { kind: "write" as const, address: contractAddress as `0x${string}` };
    if (activeTx === "workspace") return { ...base, method: "create_workspace", args: [workspace, workspaceName] };
    if (activeTx === "agent") return { ...base, method: "set_agent", args: [workspace, agent, true] };
    if (activeTx === "consume") return { ...base, method: "consume_intent", args: [consumeId] };
    if (activeTx === "review") return buildReviewTransaction({
      contractAddress: contractAddress as `0x${string}`,
      intentId: reviewId,
      resolution: reviewResolution,
      duplicateOf: reviewDuplicateOf,
      leaseSeconds: reviewLease,
    });
    return { ...base, method: "submit_intent", args: [workspace, requestId, target, action, constraints, windowKey, 900] };
  }, [activeTx, contractAddress, workspace, workspaceName, agent, requestId, target, action, constraints, windowKey, consumeId, reviewId, reviewResolution, reviewDuplicateOf, reviewLease]);

  const done = (status: TrackedStatus) => {
    if (status.phase === "finalized" && status.successful === true) {
      queryClient.invalidateQueries({ queryKey: ["intents"] });
      setActiveTx(null);
    }
  };
  const loadPreset = (index: number) => {
    const value = presets[index]; setTarget(value.target); setAction(value.action); setConstraints(value.constraints);
    setRequestId(`${value.request}-${Date.now().toString().slice(-5)}`);
  };
  const cleared = intents.filter(x => x.status === "RESERVED");
  const blocked = intents.filter(x => x.status === "BLOCKED_DUPLICATE" || x.status === "REVIEW_REQUIRED");
  const landed = intents.filter(x => x.status === "EXECUTED" || x.status === "EXPIRED" || x.status === "CANCELED");

  return <main className="shell">
    <header className="topbar"><a className="wordmark" href="#top"><span className="mark"><Radar size={20}/></span> INTENTLOCK</a><div className="network"><i/> STUDIO NEXT · 61997</div><AccountPanel/></header>
    <section id="top" className="hero"><div className="eyebrow">SEMANTIC CONCURRENCY CONTROL FOR AUTONOMOUS AGENTS</div><h1>One intent.<br/><span>One execution.</span></h1><p>Stop two agents from causing the same real-world effect, even when their requests look completely different.</p><div className="hero-proof"><ShieldCheck size={18}/> GenLayer validators compare meaning before an irreversible tool call receives clearance.</div></section>
    <section className="control-room"><div className="control-head"><div><span className="section-no">01</span><h2>Control tower</h2><p>Every card below is read from the deployed contract.</p></div><button className="refresh" onClick={() => intentsQuery.refetch()}><CircleDot size={15}/> Refresh chain</button></div>
      <div className="lanes"><Lane title="CLEARED" subtitle="Single-use execution leases" tone="green" items={cleared} onConsume={(id) => {setConsumeId(id);setActiveTx("consume");}}/><Lane title="COLLISION" subtitle="Duplicate or unsafe to decide" tone="red" items={blocked} allIntents={intents} onResolve={(id,resolution,duplicateOf,leaseSeconds) => {setReviewId(id);setReviewResolution(resolution);setReviewDuplicateOf(duplicateOf);setReviewLease(leaseSeconds);setActiveTx("review");}}/><Lane title="LANDED" subtitle="Executed and closed operations" tone="blue" items={landed}/></div>
      {!contractAddress && <div className="empty-state"><AlertTriangle size={18}/> Contract address is not configured yet. The board becomes live after Studio Next deployment.</div>}
      {contractAddress && intentsQuery.isError && <div className="empty-state"><Clock3 size={18}/> Create this workspace first, then refresh the board.</div>}
      {contractAddress && !intentsQuery.isError && !intents.length && <div className="empty-state"><Radar size={18}/> No traffic in this workspace yet. Clear the first intent below.</div>}
    </section>
    <section className="console"><div className="console-title"><span className="section-no">02</span><div><h2>Issue a clearance request</h2><p>Use a preset for the demo, or enter a real agent action.</p></div></div><div className="preset-row">{presets.map((preset,index)=><button key={preset.label} onClick={()=>loadPreset(index)}>{preset.label}<ArrowRight size={14}/></button>)}</div>
      <div className="form-grid"><label>Workspace<input value={workspace} onChange={e=>setWorkspace(e.target.value)}/></label><label>Operation window<input value={windowKey} onChange={e=>setWindowKey(e.target.value)}/></label><label>Request ID<input value={requestId} onChange={e=>setRequestId(e.target.value)}/></label><label>Target<input value={target} onChange={e=>setTarget(e.target.value)}/></label><label className="wide">Intended effect<textarea value={action} onChange={e=>setAction(e.target.value)}/></label><label className="wide">Material constraints<textarea value={constraints} onChange={e=>setConstraints(e.target.value)}/></label></div>
      <button className="primary-action" disabled={!kit||!contractAddress} onClick={()=>setActiveTx("intent")}><Radar size={18}/> Ask validators for clearance</button>
    </section>
    <section className="setup"><div><span className="section-no">03</span><h2>Workspace setup</h2><p>The creator is the principal. Only the principal can authorize agent wallets or resolve ambiguous traffic.</p></div><div className="setup-actions"><label>Workspace name<input value={workspaceName} onChange={e=>setWorkspaceName(e.target.value)}/></label><button onClick={()=>setActiveTx("workspace")}>Create workspace</button><label>Agent wallet<input placeholder="0x..." value={agent} onChange={e=>setAgent(e.target.value)}/></label><button disabled={!agent.startsWith("0x")} onClick={()=>setActiveTx("agent")}>Authorize agent</button></div></section>
    {activeTx&&tx&&kit&&<div className="tx-drawer"><div className="tx-head"><div><span>TRANSACTION CHECKPOINT</span><h3>{activeTx==="intent"?"Consensus clearance":activeTx==="consume"?"Consume execution lease":activeTx==="review"?"Owner review resolution":"Workspace authorization"}</h3></div><button onClick={()=>setActiveTx(null)}><X/></button></div><GenLayerTransactionPanel kit={kit} tx={tx} network={GENLAYER_NETWORK.chainName} theme="dark" trackUntil="finalized" onDone={done}/></div>}
    <footer><span>IntentLock · Agent Tank 2026</span><span>Semantic judgment on GenLayer Studio Next</span></footer>
  </main>;
}

function Lane({title,subtitle,tone,items,allIntents=[],onConsume,onResolve}:{title:string;subtitle:string;tone:string;items:Intent[];allIntents?:Intent[];onConsume?:(id:string)=>void;onResolve?:(id:string,resolution:ReviewResolution,duplicateOf:string,leaseSeconds:number)=>void}) {
  return <div className={`lane ${tone}`}><div className="lane-head"><div><b>{title}</b><span>{subtitle}</span></div><strong>{items.length.toString().padStart(2,"0")}</strong></div><div className="lane-track">{items.map(item=><IntentCard key={item.id} item={item} allIntents={allIntents} onConsume={onConsume} onResolve={onResolve}/>)}{!items.length&&<div className="lane-empty"><div/><span>NO SIGNAL</span></div>}</div></div>;
}

function IntentCard({item,allIntents,onConsume,onResolve}:{item:Intent;allIntents:Intent[];onConsume?:(id:string)=>void;onResolve?:(id:string,resolution:ReviewResolution,duplicateOf:string,leaseSeconds:number)=>void}) {
  const [resolution,setResolution]=useState<ReviewResolution>("DISTINCT");
  const [duplicateOf,setDuplicateOf]=useState("");
  const [leaseSeconds,setLeaseSeconds]=useState(900);
  const candidates=allIntents.filter(candidate=>candidate.id!==item.id&&candidate.window_key===item.window_key&&["RESERVED","EXECUTED"].includes(candidate.status));
  const canResolve=resolution==="DISTINCT"||Boolean(duplicateOf);
  const validLease=Number.isInteger(leaseSeconds)&&leaseSeconds>=60&&leaseSeconds<=86400;
  return <article className="intent-card"><div className="card-top"><code>{item.id}</code><span>{item.relation}</span></div><h3>{item.action}</h3><p>{item.constraints}</p>{item.duplicate_of&&<div className="collision"><AlertTriangle size={14}/> conflicts with <b>{item.duplicate_of}</b></div>}{item.status==="REVIEW_REQUIRED"&&onResolve&&<div className="review-resolution"><b>OWNER DECISION REQUIRED</b><label>Resolution<select aria-label={`Resolution for ${item.id}`} value={resolution} onChange={event=>{const next=event.target.value as ReviewResolution;setResolution(next);if(next==="DISTINCT")setDuplicateOf("");}}><option value="DISTINCT">Clear as distinct</option><option value="DUPLICATE">Block as duplicate</option></select></label>{resolution==="DUPLICATE"&&<label>Original intent<select aria-label={`Duplicate target for ${item.id}`} value={duplicateOf} onChange={event=>setDuplicateOf(event.target.value)}><option value="">Select eligible original</option>{candidates.map(candidate=><option key={candidate.id} value={candidate.id}>{candidate.id}: {candidate.action.slice(0,34)}</option>)}</select></label>}<label>Lease seconds<input aria-label={`Lease seconds for ${item.id}`} type="number" min={60} max={86400} value={leaseSeconds} onChange={event=>setLeaseSeconds(Number(event.target.value))}/></label><button disabled={!canResolve||!validLease} onClick={()=>onResolve(item.id,resolution,duplicateOf,leaseSeconds)}>Resolve onchain</button><small>Only the workspace owner can sign this action.</small></div>}<div className="card-foot"><span>{shorten(item.executor)}</span>{item.status==="RESERVED"&&onConsume?<button onClick={()=>onConsume(item.id)}><PlaneLanding size={14}/> Mark executed</button>:<span>{item.status}</span>}</div></article>;
}
