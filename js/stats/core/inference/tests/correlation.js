// correlation.js — Spearman ρ and Kendall τ
// both are nonparametric rank correlations; Kendall is more robust for small n
// Spearman wraps Pearson on ranked data; Kendall counts concordant pairs directly

import { pearson } from './parametric.js'
import { rankArr } from '../core/utils.js'
import { normalCDF } from '../core/distributions.js'

// ── Spearman ρ ───────────────────────────────────────────────
// monotonic association — doesn't assume linearity like Pearson
export function spearman(x, y) {
  return pearson(rankArr(x), rankArr(y))
}

// ── Kendall τ-b ──────────────────────────────────────────────
// counts concordant vs discordant pairs; τ-b handles ties correctly
// more conservative than Spearman for small n — preferred when n < 20
export function kendallTau(x, y) {
  const n = x.length
  let C = 0, D = 0, tx = 0, ty = 0

  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = x[i] - x[j], dy = y[i] - y[j]
      const sign = dx * dy
      if      (sign > 0) C++
      else if (sign < 0) D++
      // ties counted separately for correction
      if (dx === 0 && dy !== 0) tx++
      else if (dy === 0 && dx !== 0) ty++
    }
  }

  // τ-b correction for ties
  const tau = (C - D) / Math.sqrt((C + D + tx) * (C + D + ty))

  // asymptotic normal approximation (Kendall 1975)
  const v0 = n * (n - 1) * (2 * n + 5)
  const Z  = (3 * tau * Math.sqrt(n * (n - 1))) / Math.sqrt(2 * (2 * n + 5))
  const p  = 2 * (1 - normalCDF(Math.abs(Z)))

  return { tau, C, D, Z, p, n }
}