#!/usr/bin/env python3
"""
Train a minimal linear regression model for drawdown prediction.

No external dependencies are required.

Usage:
  uv run python ml/train_linear_model.py
"""

from __future__ import annotations

import csv
import json
import math
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Tuple

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "ml" / "data" / "training_data.csv"
MODEL_PATH = ROOT / "model" / "risk-model.json"
METRICS_PATH = ROOT / "ml" / "metrics_snapshot.json"


@dataclass
class Row:
  volatility: float
  max_loss_pct: float
  realized_drawdown_pct: float


def load_rows(path: Path) -> List[Row]:
  rows: List[Row] = []
  with path.open("r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for r in reader:
      rows.append(
        Row(
          volatility=float(r["volatility"]),
          max_loss_pct=float(r["maxLossPct"]),
          realized_drawdown_pct=float(r["realizedDrawdownPct"]),
        )
      )
  if not rows:
    raise ValueError("training_data.csv is empty")
  return rows


def feature_vector(row: Row) -> List[float]:
  return [1.0, row.volatility, row.volatility * row.volatility, row.max_loss_pct]


def split(rows: List[Row], ratio: float = 0.8) -> Tuple[List[Row], List[Row]]:
  n = len(rows)
  cut = max(1, int(n * ratio))
  cut = min(cut, n - 1)
  return rows[:cut], rows[cut:]


def normalize(train_x: List[List[float]], test_x: List[List[float]]) -> Tuple[List[List[float]], List[List[float]], List[Tuple[float, float]]]:
  # Keep intercept (index 0) unchanged; normalize other features by z-score.
  cols = len(train_x[0])
  stats: List[Tuple[float, float]] = [(0.0, 1.0)]

  for c in range(1, cols):
    values = [row[c] for row in train_x]
    mean = sum(values) / len(values)
    var = sum((v - mean) ** 2 for v in values) / len(values)
    std = math.sqrt(var) or 1.0
    stats.append((mean, std))

  def apply(data: List[List[float]]) -> List[List[float]]:
    out: List[List[float]] = []
    for row in data:
      nrow = [row[0]]
      for c in range(1, cols):
        mean, std = stats[c]
        nrow.append((row[c] - mean) / std)
      out.append(nrow)
    return out

  return apply(train_x), apply(test_x), stats


def train_linear_regression(train_x: List[List[float]], train_y: List[float], epochs: int = 12000, lr: float = 0.015) -> List[float]:
  w = [0.0 for _ in range(len(train_x[0]))]
  n = len(train_x)

  for _ in range(epochs):
    grads = [0.0 for _ in w]

    for i in range(n):
      pred = sum(wj * xj for wj, xj in zip(w, train_x[i]))
      err = pred - train_y[i]
      for j in range(len(w)):
        grads[j] += (2.0 / n) * err * train_x[i][j]

    for j in range(len(w)):
      w[j] -= lr * grads[j]

  return w


def predict(weights: List[float], x: List[List[float]]) -> List[float]:
  return [sum(wj * xj for wj, xj in zip(weights, row)) for row in x]


def mae(y_true: List[float], y_pred: List[float]) -> float:
  return sum(abs(a - b) for a, b in zip(y_true, y_pred)) / len(y_true)


def rmse(y_true: List[float], y_pred: List[float]) -> float:
  return math.sqrt(sum((a - b) ** 2 for a, b in zip(y_true, y_pred)) / len(y_true))


def r2(y_true: List[float], y_pred: List[float]) -> float:
  mean_y = sum(y_true) / len(y_true)
  ss_res = sum((a - b) ** 2 for a, b in zip(y_true, y_pred))
  ss_tot = sum((a - mean_y) ** 2 for a in y_true)
  if ss_tot == 0:
    return 1.0
  return 1 - (ss_res / ss_tot)


def denormalize_weights(norm_w: List[float], stats: List[Tuple[float, float]]) -> List[float]:
  # Convert from normalized-feature weights into original-feature weights.
  # model: y = w0 + w1*z1 + w2*z2 + w3*z3, where z=(x-mean)/std
  # => y = b0 + b1*x1 + b2*x2 + b3*x3
  b = [0.0, 0.0, 0.0, 0.0]

  # slopes
  for j in range(1, 4):
    mean, std = stats[j]
    b[j] = norm_w[j] / std

  # intercept
  b[0] = norm_w[0]
  for j in range(1, 4):
    mean, std = stats[j]
    b[0] -= norm_w[j] * (mean / std)

  return b


def main() -> None:
  rows = load_rows(DATA_PATH)
  train_rows, test_rows = split(rows, 0.8)

  train_x_raw = [feature_vector(r) for r in train_rows]
  train_y = [r.realized_drawdown_pct for r in train_rows]

  test_x_raw = [feature_vector(r) for r in test_rows]
  test_y = [r.realized_drawdown_pct for r in test_rows]

  train_x, test_x, stats = normalize(train_x_raw, test_x_raw)
  norm_weights = train_linear_regression(train_x, train_y)
  weights = denormalize_weights(norm_weights, stats)

  test_pred = predict(weights, test_x_raw)
  metrics = {
    "mae": round(mae(test_y, test_pred), 4),
    "rmse": round(rmse(test_y, test_pred), 4),
    "r2": round(r2(test_y, test_pred), 4),
    "trainRows": len(train_rows),
    "testRows": len(test_rows),
  }

  generated_at = datetime.now(timezone.utc).isoformat()
  model = {
    "modelType": "linear_regression",
    "target": "realizedDrawdownPct",
    "features": ["volatility", "volatilitySquared", "maxLossPct"],
    "coefficients": {
      "intercept": round(weights[0], 4),
      "volatility": round(weights[1], 4),
      "volatilitySquared": round(weights[2], 4),
      "maxLossPct": round(weights[3], 4),
    },
    "metrics": metrics,
    "training": {
      "source": "ml/data/training_data.csv",
      "split": "time-order holdout (80/20)",
      "algorithm": "batch gradient descent",
      "epochs": 12000,
      "learningRate": 0.015,
      "featureScaling": "z-score",
    },
    "generatedBy": "ml/train_linear_model.py",
    "generatedAt": generated_at,
  }

  MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
  with MODEL_PATH.open("w", encoding="utf-8") as f:
    json.dump(model, f, indent=2)
    f.write("\n")

  METRICS_PATH.parent.mkdir(parents=True, exist_ok=True)
  with METRICS_PATH.open("w", encoding="utf-8") as f:
    json.dump(
      {
        "generatedAt": generated_at,
        "dataset": str(DATA_PATH.relative_to(ROOT)),
        "metrics": metrics,
      },
      f,
      indent=2,
    )
    f.write("\n")

  print("Model written to", MODEL_PATH)
  print("Metrics written to", METRICS_PATH)
  print("Metrics:", metrics)


if __name__ == "__main__":
  main()
