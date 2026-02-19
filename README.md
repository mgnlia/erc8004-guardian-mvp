# ERC-8004 Guardian MVP

Minimal browser-based prototype for a **capital-protection AI agent** concept for ERC-8004-style hackathons.

## What it does

- Takes portfolio parameters:
  - Initial capital
  - User-defined max daily loss bound
  - Market volatility estimate
- Predicts drawdown with a simple deterministic rule
- Enforces a **hard risk constraint**:
  - If predicted loss exceeds bound → block trade and move to stable pool
  - Else → allow reallocation
- Emits a JSON "attestation" payload representing agent decision + safety checks.

## Run locally

No dependencies required.

```bash
cd erc8004-guardian-mvp
python -m http.server 8080
# open http://localhost:8080
```

## Notes

- This is a proof-of-concept for rapid submission scaffolding.
- Replace the drawdown heuristic with real risk models and on-chain telemetry for production/hackathon final submission.

## Ops

- Vercel production deployments are automated via GitHub Actions on push to `main`.
