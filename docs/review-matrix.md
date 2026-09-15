# IntentLock review matrix

This matrix is the stop gate for the Agent Tank build. A row stays UNVERIFIED until its listed proof exists.

| Requirement | Code path | Targeted proof | Status |
| --- | --- | --- | --- |
| Semantic duplicate detection is the state-driving GenLayer decision | `contracts/intent_lock.py::_classify` | 7 direct tests plus live tx `0xad2587...cd9d` | VERIFIED |
| Validator independently checks exact verdict and exact `duplicate_of` | `contracts/intent_lock.py::_classify` | Positive and disagreement validator tests | VERIFIED |
| Malformed or uncertain judgment fails safe | `_normalize`, `submit_intent` | Malformed and ambiguous tests | VERIFIED |
| Only workspace owner or authorized agents can reserve | `create_workspace`, `set_agent`, `submit_intent` | Unauthorized caller test | VERIFIED |
| Request IDs cannot be replayed | `used_requests` | Duplicate request test | VERIFIED |
| A cleared execution lease is single use and bound to its executor | `consume_intent` | Wrong executor and double consume tests | VERIFIED |
| Reservations cannot remain stuck | `expire_intent`, `cancel_intent`, `resolve_review` | Permissionless expiry and owner recovery tests | VERIFIED |
| Candidate comparison is bounded without silently skipping live intents | `_candidates` | Saturated window test | VERIFIED |
| Contract source lints and pickles | Entire contract | GenVM lint 3/3 and direct deploy | VERIFIED |
| Repository builds from a clean install | Root and `frontend` | frontend 9/9 tests and production build | VERIFIED |
| Frontend uses real Studio Next contract calls and fee flow | `frontend` | Local browser reads both live intents with zero console errors | VERIFIED |
| Reviewed source equals deployed source | `deployment.json` plus deploy receipt | SHA-256 `91ad0847...ea564` | VERIFIED |
| Public deployment completes the real lifecycle | `https://intent-lock.pages.dev` | Live reserve, blocked paraphrase, distinct hotel, and consumed lease | VERIFIED |

## Originality check

IntentLock is not a policy firewall, scope adjudicator, escrow, reputation system, or post-event dispute court. Its primitive is cross-agent semantic idempotency: it detects equivalent irreversible actions expressed with different text and request IDs before execution, then creates a single-use executor-bound lease. The interface is an air-traffic control board with collision links, not a form/table dashboard.

## Fixed product boundaries

- One workspace owner explicitly authorizes agent wallets.
- Comparisons occur only inside a caller-selected, normalized operation window.
- A window supports at most eight live or executed candidates. Saturation rejects instead of silently omitting candidates.
- `DISTINCT` creates a temporary single-use lease.
- `DUPLICATE` records and links the exact original intent.
- `AMBIGUOUS` blocks execution until the workspace owner resolves it.
- Only the bound executor can consume a lease. Anyone can expire an elapsed lease.
