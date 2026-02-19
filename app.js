const DEFAULT_MODEL = {
  modelType: 'linear_regression',
  target: 'realizedDrawdownPct',
  features: ['volatility', 'volatilitySquared', 'maxLossPct'],
  coefficients: {
    intercept: 0.92,
    volatility: 31.4,
    volatilitySquared: 12.8,
    maxLossPct: -0.21,
  },
  metrics: {
    mae: 0.63,
    rmse: 0.79,
    r2: 0.91,
  },
  generatedBy: 'ml/train_linear_model.js',
  generatedAt: '2026-02-19T00:00:00.000Z',
};

const ERC8004_SIM_CONFIG = {
  chainId: 11155111,
  contractAddress: '0x8004000000000000000000000000000000000004',
  functionSignature: 'attestDecision(bytes32 decisionHash,string evidenceURI)',
  explorerBaseUrl: 'https://sepolia.etherscan.io/tx/',
};

let loadedModel = DEFAULT_MODEL;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hashHex(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }

  const unsigned = hash >>> 0;
  const chunk = unsigned.toString(16).padStart(8, '0');
  return `0x${chunk.repeat(8).slice(0, 64)}`;
}

function predictDrawdownML({ volatility, maxLossPct }, model = loadedModel) {
  const b = model?.coefficients ?? DEFAULT_MODEL.coefficients;
  const rawPrediction =
    b.intercept + b.volatility * volatility + b.volatilitySquared * volatility * volatility + b.maxLossPct * maxLossPct;
  return clamp(rawPrediction, 0, 100);
}

function evaluate({ capital, maxLossPct, volatility }) {
  const predictedDrawdownPct = predictDrawdownML({ volatility, maxLossPct }, loadedModel);
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
      ? 'ML-predicted drawdown remains within user-defined daily risk budget.'
      : 'ML-predicted drawdown exceeds risk budget. Guardian capital-protection policy triggered.',
    timestamp: new Date().toISOString(),
  };
}

function buildOnchainSimulation(attestationCore) {
  const decisionHash = hashHex(JSON.stringify(attestationCore));
  const txHash = hashHex(`${decisionHash}:${attestationCore.issuedAt}:guardian-v0.2`);

  return {
    mode: 'SIMULATED_ONCHAIN_WRITE',
    chainId: ERC8004_SIM_CONFIG.chainId,
    contractAddress: ERC8004_SIM_CONFIG.contractAddress,
    functionSignature: ERC8004_SIM_CONFIG.functionSignature,
    decisionHash,
    txHash,
    explorerUrl: `${ERC8004_SIM_CONFIG.explorerBaseUrl}${txHash}`,
    status: 'QUEUED_SIMULATION',
  };
}

function buildAttestation(result) {
  const baseAttestation = {
    standard: 'ERC-8004-draft-attestation',
    agent: 'Guardian-v0.2-ml',
    decision: result.recommendation,
    model: {
      modelType: loadedModel.modelType,
      features: loadedModel.features,
      coefficients: loadedModel.coefficients,
      metrics: loadedModel.metrics,
      generatedBy: loadedModel.generatedBy,
      generatedAt: loadedModel.generatedAt,
    },
    constraints: {
      maxLossPct: result.maxLossPct,
      predictedDrawdownPct: result.predictedDrawdownPct,
      lossThresholdUSDC: result.lossThreshold,
      predictedLossUSDC: result.predictedLoss,
      isCompliant: result.allowed,
    },
    explanation: result.reason,
    evidenceURI: 'ipfs://erc8004-guardian/attestations/demo-v0.2',
    issuedAt: result.timestamp,
  };

  return {
    ...baseAttestation,
    onchainAttestation: buildOnchainSimulation(baseAttestation),
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

function renderModelInfo() {
  const modelInfoEl = document.getElementById('modelInfo');
  if (!modelInfoEl) return;

  const metrics = loadedModel.metrics || DEFAULT_MODEL.metrics;
  modelInfoEl.textContent =
    `Model: ${loadedModel.modelType} | ` +
    `MAE: ${metrics.mae} | RMSE: ${metrics.rmse} | R²: ${metrics.r2}`;
}

function render() {
  const decisionEl = document.getElementById('decision');
  const attestationEl = document.getElementById('attestation');

  renderModelInfo();

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

async function loadModel() {
  try {
    const response = await fetch('./model/risk-model.json', { cache: 'no-store' });
    if (!response.ok) return;

    const model = await response.json();
    if (model?.coefficients) {
      loadedModel = model;
    }
  } catch (error) {
    // Keep default model if file fetch fails.
  }
}

document.getElementById('runBtn').addEventListener('click', render);

loadModel().finally(render);
