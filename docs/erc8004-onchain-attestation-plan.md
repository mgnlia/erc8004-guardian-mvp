# ERC-8004 On-Chain Attestation Implementation Plan

## Goal
Move from browser-only JSON evidence to verifiable on-chain decision attestations aligned with ERC-8004-style agent accountability.

## Scope for next milestone
1. **Decision hash canonicalization**
   - Serialize attestation payload deterministically.
   - Hash using `keccak256` prior to chain write.
2. **Smart contract sink (testnet)**
   - Deploy `GuardianAttestor` contract on Sepolia.
   - Function prototype:
     - `attestDecision(bytes32 decisionHash, string calldata evidenceURI)`
   - Emit event:
     - `DecisionAttested(address indexed agent, bytes32 indexed decisionHash, string evidenceURI, uint256 timestamp)`
3. **Client integration**
   - Replace current simulated tx hash with actual wallet-backed transaction submission.
   - Store returned transaction hash and block number in attestation payload.
4. **Evidence persistence**
   - Upload full JSON attestation blob to IPFS/Arweave.
   - Put resulting URI in contract call.
5. **Verification endpoint**
   - Add script/API route that:
     - Pulls attestation JSON by URI.
     - Re-hashes payload.
     - Confirms matching `decisionHash` in on-chain event logs.

## Deliverables
- `contracts/GuardianAttestor.sol`
- `scripts/deploy_sepolia.ts`
- `scripts/attest_decision.ts`
- `docs/onchain-verification.md`

## Acceptance criteria
- Every risk decision includes:
  - deterministic decision hash
  - evidence URI
  - real testnet tx hash
  - successful event confirmation
- Verifier script returns `verified=true` for sampled attestations.

## Current status
- MVP now includes a **simulated on-chain write envelope** in the attestation object (chain ID, contract address placeholder, function signature, decision hash, tx hash placeholder).
- Next step is replacing simulation with real Sepolia contract interactions.
