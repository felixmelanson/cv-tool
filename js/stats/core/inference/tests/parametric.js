// parametric.js — tests that assume (approximately) normal distributions
// pairedT and pearson are the workhorses; linTrend is the key addition
// all return a consistent shape: { stat, p, effect, n, ... extras }

import { tCDF } from '../core/distributions.js'
import { avg } from '../core/utils.js'

// ── paired t-test ────────────────────────────────────────────
export function pairedT(x, y) {
  const n    = x.length
  const d    = x.map((xi, i) => xi - y[i])
  const mean = avg(d)
  const v    = d.reduce((s, di) => s + (di - mean) ** 2, 0) / (n - 1)
  const se   = Math.sqrt(v / n)
  const t    = mean / se
  const p    = 2 * (1 - tCDF(Math.abs(t), n - 1))
  return { t, p, d: mean / Math.sqrt(v), mean, se, n, df: n - 1 }
}

// ── one-sample t-test ────────────────────────────────────────
// tests whether mean of x equals mu (default 0)
export function oneSampleT(x, mu = 0) {
  const n    = x.length
  const mean = avg(x)
  const v    = x.reduce((s, xi) => s + (xi - mean) ** 2, 0) / (n - 1)
  const se   = Math.sqrt(v / n)
  const t    = (mean - mu) / se
  const p    = 2 * (1 - tCDF(Math.abs(t), n - 1))
  return { t, p, d: (mean - mu) / Math.sqrt(v), mean, mu, se, n }
}

// ── Pearson r ────────────────────────────────────────────────
export function pearson(x, y) {
  const n  = x.length
  const mx = avg(x), my = avg(y)
  const num = x.reduce((s, xi, i) => s + (xi - mx) * (y[i] - my), 0)
  const dx  = Math.sqrt(x.reduce((s, xi) => s + (xi - mx) ** 2, 0))
  const dy  = Math.sqrt(y.reduce((s, yi) => s + (yi - my) ** 2, 0))
  const r   = num / (dx * dy)
  const t   = r * Math.sqrt(n - 2) / Math.sqrt(1 - r * r)
  const p   = 2 * (1 - tCDF(Math.abs(t), n - 2))
  return { r, t, p, n, df: n - 2 }
}

// ── Linear trend ─────────────────────────────────────────────
// OLS regression on a time series [{t, v}] — tests whether slope ≠ 0
// the slope value itself is more informative than p for CV data:
// e.g. HR declining at -0.8 bpm/min during recovery = meaningful physiology
export function linTrend(pts) {
  const n  = pts.length
  const tx = pts.map(p => p.t)
  const ty = pts.map(p => p.v)
  const mx = avg(tx), my = avg(ty)
  const sxy = tx.reduce((s, x, i) => s + (x - mx) * (ty[i] - my), 0)
  const sxx = tx.reduce((s, x)    => s + (x - mx) ** 2, 0)
  const slope     = sxy / sxx
  const intercept = my - slope * mx

  const yhat  = tx.map(x => slope * x + intercept)
  const sse   = ty.reduce((s, y, i) => s + (y - yhat[i]) ** 2, 0)
  const sst   = ty.reduce((s, y)    => s + (y - my) ** 2, 0)
  const r2    = 1 - sse / sst
  const s2    = sse / (n - 2)
  const se    = Math.sqrt(s2 / sxx)
  const t     = slope / se
  const p     = 2 * (1 - tCDF(Math.abs(t), n - 2))

  // slope in original units/second — caller can scale to per-minute if needed
  return { slope, intercept, t, p, r2, se, n, df: n - 2 }
}

// ── Recovery slope convenience wrapper ───────────────────────
// runs linTrend on the last `fracEnd` fraction of a HR series
// useful for quantifying how fast HR is recovering post-exercise
export function recoverySlopeHR(hrPts, fracEnd = 0.35) {
  const start = Math.floor(hrPts.length * (1 - fracEnd))
  const slice = hrPts.slice(start)
  if (slice.length < 4) return null
  return linTrend(slice)
}