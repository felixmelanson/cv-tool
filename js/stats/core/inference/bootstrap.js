// bootstrap.js — resampling-based inference
// no distributional assumptions; only requirement is exchangeability
// B=2000 is enough for 95% CI; B=5000 for stable p-values

import { avg } from '../utils.js'

// ── Bootstrap 95% CI for mean difference ─────────────────────
// percentile method — interpretable as "where the true Δ likely lives"
export function bootstrapCI(x, y, B = 2000) {
  const diffs = new Array(B)
  for (let i = 0; i < B; i++) {
    let sx = 0, sy = 0
    const n = x.length
    for (let j = 0; j < n; j++) {
      const idx = (Math.random() * n) | 0
      sx += x[idx]; sy += y[idx]
    }
    diffs[i] = sx / n - sy / n
  }
  diffs.sort((a, b) => a - b)
  return {
    lo:   diffs[(B * 0.025) | 0],
    hi:   diffs[(B * 0.975) | 0],
    mean: avg(diffs),
  }
}

// ── Bootstrap CI for a single-sample statistic ───────────────
// fn: (sample) => statistic (e.g. median, std, slope)
export function bootstrapStatCI(arr, fn, B = 2000) {
  const stats = new Array(B)
  for (let i = 0; i < B; i++) {
    const n = arr.length
    const s = new Array(n)
    for (let j = 0; j < n; j++) s[j] = arr[(Math.random() * n) | 0]
    stats[i] = fn(s)
  }
  stats.sort((a, b) => a - b)
  return {
    lo:   stats[(B * 0.025) | 0],
    hi:   stats[(B * 0.975) | 0],
    mean: avg(stats),
  }
}

// ── Permutation test (paired) ─────────────────────────────────
// randomly flips signs of differences — no normality needed
// exact for small n but B=5000 gives stable p for any n
// more powerful than sign test, assumption-free unlike paired t
export function permutationTest(x, y, B = 5000) {
  const d    = x.map((xi, i) => xi - y[i])
  const obs  = Math.abs(d.reduce((s, v) => s + v, 0) / d.length)
  const n    = d.length

  let count = 0
  for (let i = 0; i < B; i++) {
    let sum = 0
    for (let j = 0; j < n; j++) {
      sum += Math.random() < 0.5 ? d[j] : -d[j]
    }
    if (Math.abs(sum / n) >= obs) count++
  }

  const p  = count / B
  // effect: standardized mean difference
  const mn = avg(d)
  const sd = Math.sqrt(d.reduce((s, v) => s + (v - mn) ** 2, 0) / (n - 1))

  return { p, meanDiff: mn, d: mn / sd, n, B }
}