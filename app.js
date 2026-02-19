function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function evaluate({ capital, maxLossPct, volatility }) {
  const predictedDrawdownPct = clamp(volatility * 5.5, 0, 100);
  const lossThreshold = (capital * maxLossPct) / 100;
  const predictedLoss = (capital * predictedDrawdownPct) / 100;
  const allowed = predictedLoss <= lossThreshold;

  return {
    allowed,
    capital,
    maxLossPct,
    volatility,
    predictedDrawdownPct: Number(predictedDrawdownPct.toFixed(2)),
    predictedLoss: Number(predictedLoss.toFixed(2)),
    lossThreshold: Number(lossThreshold.toFixed(2)),
    recommendation: allowed
      ? 'ALLOW_REALLOCATION'
      : 'BLOCK_TRADE_AND_MOVE_TO_STABLE_POOL',
    reason: allowed
      ? 'Predicted loss is within user-defined daily bound.'
      : 'Predicted loss exceeds safety constraints. Capital protection policy triggered.',
    timestamp: new Date().toISOString(),
  };
}

function buildAttestation(result) {
  return {
    standard: 'ERC-8004-draft-attestation',
    agent: 'Guardian-v0.1',
    decision: result.recommendation,
    constraints: {
      maxLossPct: result.maxLossPct,
      predictedDrawdownPct: result.predictedDrawdownPct,
      lossThresholdUSDC: result.lossThreshold,
      predictedLossUSDC: result.predictedLoss,
      isCompliant: result.allowed,
    },
    explanation: result.reason,
    issuedAt: result.timestamp,
  };
}

function parseInputs() {
  const capital = Number(document.getElementById('capital').value);
  const maxLossPct = Number(document.getElementById('maxLoss').value);
  const volatility = Number(document.getElementById('volatility').value);

  if (!Number.isFinite(capital) || capital <= 0) {
    throw new Error('Capital must be a positive number.');
  }
  if (!Number.isFinite(maxLossPct) || maxLossPct <= 0 || maxLossPct > 100) {
    throw new Error('Max loss bound must be between 0 and 100.');
  }
  if (!Number.isFinite(volatility) || volatility < 0 || volatility > 1) {
    throw new Error('Volatility must be between 0 and 1.');
  }

  return { capital, maxLossPct, volatility };
}

function render() {
  const decisionEl = document.getElementById('decision');
  const attestationEl = document.getElementById('attestation');

  try {
    const inputs = parseInputs();
    const result = evaluate(inputs);
    const attestation = buildAttestation(result);

    decisionEl.textContent = `${result.recommendation}: ${result.reason}`;
    decisionEl.className = result.allowed ? 'safe' : 'blocked';
    attestationEl.textContent = JSON.stringify(attestation, null, 2);
  } catch (error) {
    decisionEl.textContent = `Input error: ${error.message}`;
    decisionEl.className = 'blocked';
    attestationEl.textContent = '';
  }
}

document.getElementById('runBtn').addEventListener('click', render);
render();
