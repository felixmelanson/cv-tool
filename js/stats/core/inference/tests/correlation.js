// correlation.js — Spearman ρ and Kendall τ
// both are nonparametric rank correlations; Kendall is more robust for small n
// Spearman wraps Pearson on ranked data; Kendall counts concordant pairs directly

import { pearson } from './parametric.js'
import { rankArr } from '../../utils.js'
import { normalCDF } from '../../distributions.js'

// ── Spearman ρ ───────────────────────────────────────────────
// monotonic association — doesn't assume linearity like Pearson
export function spearman(x, y) {
  if (!x || !y || x.length !== y.length || x.length < 2) return { r: 0, p: 1, n: 0 }
  return pearson(rankArr(x), rankArr(y))
}

// ── Kendall τ-b ──────────────────────────────────────────────
// counts concordant vs discordant pairs; τ-b handles ties correctly
// more conservative than Spearman for small n — preferred when n < 20
export function kendallTau(x, y) {
  if (!x || !y || x.length !== y.length) throw new Error('kendallTau: input arrays must be same length')
  const n = x.length
  if (n < 2) return { tau: 0, C: 0, D: 0, Z: 0, p: 1, n }

  let C = 0, D = 0, tx = 0, ty = 0

  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = x[i] - x[j], dy = y[i] - y[j]
      const prod = dx * dy
      if      (prod > 0) C++
      else if (prod < 0) D++
      // count tied pairs in each margin (including pairs tied on both)
      if (dx === 0) tx++
      if (dy === 0) ty++
    }
  }

  const denom = Math.sqrt((C + D + tx) * (C + D + ty))
  const tau = denom === 0 ? 0 : (C - D) / denom

  // asymptotic normal approx for tau (simple form). Guard against degenerate cases.
  const denomZ = Math.sqrt(2 * (2 * n + 5))
  const Z = denomZ === 0 ? 0 : (3 * tau * Math.sqrt(n * (n - 1))) / denomZ
  const p = 2 * (1 - normalCDF(Math.abs(Z)))

  return { tau, C, D, tx, ty, Z, p, n }
}