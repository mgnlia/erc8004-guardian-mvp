# ERC-8004 Guardian MVP

Minimal browser-based prototype for a **capital-protection AI agent** concept for ERC-8004-style hackathons.

## What it does

- Takes portfolio parameters:
  - Initial capital
  - User-defined max daily loss bound
  - Market volatility estimate
- Predicts drawdown with a **trained linear regression model** (artifacts in `model/risk-model.json`)
- Enforces a **hard risk constraint**:
  - If predicted loss exceeds bound → block trade and move to stable pool
  - Else → allow reallocation
- Emits an ERC-8004-style attestation payload with:
  - model metadata + metrics
  - decision constraints
  - **simulated on-chain write envelope** (decision hash + tx hash placeholder)

## Run locally

No dependencies required for UI.

```bash
cd erc8004-guardian-mvp
python -m http.server 8080
# open http://localhost:8080
```

## Train model

Python script (no external ML dependency) provided to train linear regression and export artifacts:

```bash
uv run python ml/train_linear_model.py
```

Generated artifacts:
- `model/risk-model.json`
- `ml/metrics_snapshot.json`

## On-chain attestation roadmap

Current MVP includes a simulated on-chain write envelope in the attestation for ERC-8004 flow modeling.
Implementation plan for real testnet writes:
- `docs/erc8004-onchain-attestation-plan.md`

## Notes

- This is still an MVP for hackathon iteration.
- Next hardening step: replace synthetic training data with real historical/on-chain telemetry.

## Ops

- Vercel production deployments are automated via GitHub Actions on push to `main`.
