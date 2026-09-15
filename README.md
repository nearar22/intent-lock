# IntentLock

**One intent. One execution. No matter how many agents retry.**

IntentLock is a semantic idempotency and concurrency primitive for autonomous agents on GenLayer. Ordinary idempotency keys only stop byte-identical retries. IntentLock catches the harder case: two agents, two request IDs, and two differently worded instructions that would cause the same economic or real-world effect.

Example:

- Agent Alpha: `Book a refundable flight to Paris this Friday under $450.`
- Agent Beta: `Reserve a cancellable Paris ticket for Friday, max $450 all in.`

Validators compare the meaning of the new action against every eligible action in the same bounded operation window. The second action is stored as `BLOCKED_DUPLICATE` and linked to the exact original. A distinct action receives a temporary, executor-bound, single-use lease.

## Why GenLayer

String hashes, embeddings from one provider, and exact request IDs cannot authoritatively decide whether paraphrased actions have the same material effect. IntentLock uses GenLayer validator consensus for that semantic decision. Deterministic contract code still controls authorization, replay protection, bounded candidate selection, state transitions, expiry, cancellation, and lease consumption.

The state-driving consensus output is intentionally small:

```json
{"relation":"DISTINCT|DUPLICATE|AMBIGUOUS","duplicate_of":"exact candidate id or empty"}
```

Every validator independently receives the full proposed action and candidate set, rechecks both the relation and the exact `duplicate_of`, and rejects malformed or unsupported decisions. Explanatory prose is not stored as an approved fact.

## Lifecycle

1. A principal creates a workspace and authorizes agent wallets.
2. An authorized agent submits a target, intended effect, material constraints, and operation-window key.
3. The contract deterministically selects no more than eight eligible candidates in that window. A saturated window rejects instead of silently skipping prior intents.
4. GenLayer consensus returns `DISTINCT`, `DUPLICATE`, or `AMBIGUOUS`.
5. `DISTINCT` creates a 60-second to 24-hour execution lease bound to the submitting wallet.
6. `DUPLICATE` is blocked and linked to the exact original.
7. `AMBIGUOUS` fails safe in `REVIEW_REQUIRED`; only the principal can resolve it.
8. The bound executor consumes a lease exactly once. Anyone may expire an elapsed lease. The principal or executor may cancel an open intent.

## Contract API

- `create_workspace(workspace_id, name)`
- `set_agent(workspace_id, agent, allowed)`
- `submit_intent(workspace_id, request_id, target, action, constraints, window_key, lease_seconds)`
- `consume_intent(intent_id)`
- `expire_intent(intent_id)`
- `cancel_intent(intent_id)`
- `resolve_review(intent_id, relation, duplicate_of, lease_seconds)`
- `get_workspace`, `get_intent`, `list_intents`, `get_stats`

Contract source: [`contracts/intent_lock.py`](contracts/intent_lock.py)

Studio Next deployment:

- Live app: [intent-lock.pages.dev](https://intent-lock.pages.dev/)
- Contract: [`0x65D35C6e8Ff62235c49e08845D671e13E7feb651`](https://explorer-studio-dev.genlayer.com/address/0x65D35C6e8Ff62235c49e08845D671e13E7feb651)
- Deploy transaction: [`0xbfa3...6b66`](https://explorer-studio-dev.genlayer.com/tx/0xbfa3bf25cef7c9514bfdd7f61a0675c4b833891191764a9747e4efbf9ad06b66)
- Live semantic collision: [`0xad25...cd9d`](https://explorer-studio-dev.genlayer.com/tx/0xad25875b53d600e5bfcd31315e52c783c7bb082a3afd4120841823b49ccdcd9d)

The live collision transaction finalized with `FINISHED_WITH_RETURN`. Its stored result classifies the paraphrase as `DUPLICATE`, sets `BLOCKED_DUPLICATE`, and links it to `agent-tank-demo-1`. A distinct hotel intent was then reserved and consumed on-chain, so the public control tower visibly shows the cleared, collision, and landed states together. Full machine-readable evidence is in [`deployment.json`](deployment.json).

## Run and verify

Requirements: Python 3.13, Node.js 20+, and MetaMask.

```bash
npm ci
python -m venv .venv
# Activate .venv with the command for your operating system
python -m pip install -r requirements.txt
genvm-lint contracts/intent_lock.py
python -m pytest tests/direct -q
cd frontend && npm test && cd ..
npm run build
```

Copy `frontend/.env.example` to `frontend/.env` and set the deployed Studio Next contract address. The frontend, wallet, SDK, and Transaction Kit all use:

- RPC: `https://studio-next.genlayer.com/api`
- Chain ID: `61997`
- Transaction Kit: `0.1.0-rc.2`
- genlayer-js: `2.0.0-rc.1`

Deploy with `npm run deploy`. A deployment or write is only reported as successful when consensus is accepted/finalized and the leader execution result is `FINISHED_WITH_RETURN`.

## Test coverage

The direct suite covers semantic paraphrase collisions, exact duplicate linkage, adversarial validator disagreement, malformed duplicate attribution, unauthorized callers, request replay, executor binding, double consumption, ambiguous fail-safe behavior, owner recovery, permissionless expiry, and candidate-window saturation.

## Interface

The product uses an air-traffic-control board rather than exposing raw contract arguments as a table. Live on-chain intents move through `CLEARED`, `COLLISION`, and `LANDED` lanes. Demo presets remain editable and submit the same real contract transaction as custom actions.

## Limits and safety

- Semantic consensus is not a payment rail and does not execute the external action itself. Integrators must call `submit_intent`, wait for a successful decision, verify `RESERVED`, perform the external tool call, then call `consume_intent`.
- The caller chooses the operation-window key, so the principal must define a consistent windowing policy for its agents.
- Each workspace stores at most 100 intents and each operation window admits at most eight eligible candidates.
- Ambiguous decisions deliberately block execution.

See [`docs/review-matrix.md`](docs/review-matrix.md) for the evidence-backed release gate.

## License

MIT
