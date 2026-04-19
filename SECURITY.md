# Security Policy

## Supported versions

Only `main` is supported. Older tags receive no fixes.

## Reporting a vulnerability

**Do not open a public GitHub issue.** Instead use one of:

1. **Preferred:** [GitHub Private Vulnerability Reporting](https://github.com/antsincgame/martket.ton/security/advisories/new)
2. Email: `security@tonforge.org` (if configured) or open a security advisory.

Please include:

- Affected component (frontend, backend, smart contract, infra).
- Severity estimate (informational / low / medium / high / critical).
- Reproduction steps with the smallest possible test case.
- Network (mainnet / testnet) and wallet/version if relevant.
- Suggested fix if you have one.

We will:

- Acknowledge receipt within 72 hours.
- Provide a triage and fix ETA within 7 days.
- Credit you in the release notes (unless you ask otherwise).

## Scope

### In scope

- Smart contract logic (`contracts/src/*.tact`) — especially escrow, refund, and burn flows.
- Backend payment verification (`backend/commerce/`).
- Authentication and session handling (`backend/middleware/auth.ts`, JWT issuance).
- Storage and BYOS surface (presigned URLs, SSRF, encryption keys).
- Oracle wallet exposure (mnemonic handling, transaction signing).

### Out of scope (please don't)

- DoS attacks against the public site.
- Social engineering of project maintainers.
- Reports about missing security headers on third-party CDNs (Appwrite, TonAPI).
- Vulnerabilities in dependencies for which there is no exploit path in our code.

## Public security headers

The backend enforces `helmet` defaults plus `X-Dharma-Shield: mahakala` (a marker
header confirming the request hit our hardened reverse-proxy chain). If you see
the header missing on a `*.tonforge.org` response, please report it.
