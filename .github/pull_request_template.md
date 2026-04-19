<!-- Thanks for the PR! Keep the description short — the diff is the truth. -->

## What

<!-- 1–3 sentences. Focus on the user-facing change, not the implementation. -->

## Why

<!-- The problem this solves. Link an issue if there is one (Closes #123). -->

## How

<!-- Only the non-obvious decisions. Skip if the diff explains itself. -->

## Risk & blast radius

- [ ] Backend API surface changed (breaking? new auth? new rate limits?)
- [ ] Database schema changed → ran `npm run provision:commerce`?
- [ ] Smart contracts touched → re-deployed? new opcodes synced to backend?
- [ ] Frontend env vars added → updated `.env.example` + deploy docs?

## Verification

- [ ] `npm test` green locally
- [ ] `npm run typecheck` green for both `./` and `./backend`
- [ ] If contracts changed: `cd contracts && npm test` green
- [ ] Tested manually on testnet (briefly describe the path)

## Screenshots / GIFs

<!-- For UI changes — required. A 5-second loom > 100 lines of description. -->
