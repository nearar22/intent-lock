# IntentLock frontend

The Next.js control-tower interface uses the Studio Next network definition shared by MetaMask, `genlayer-js`, and Transaction Kit RC2. Copy `.env.example` to `.env`, set `NEXT_PUBLIC_CONTRACT_ADDRESS`, then run `npm run dev` from this directory.

The board reads `list_intents` from the deployed contract. Workspace setup, agent authorization, semantic clearance, and lease consumption all use real contract writes through the transaction panel.
