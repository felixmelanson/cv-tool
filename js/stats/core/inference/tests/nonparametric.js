// nonparametric.js — rank-based + distribution-free tests
// no normality assumptions → appropriate for small n and non-Gaussian CV data

import { normalCDF, chi2CDF, kolmogorovP, binom } from '../../distributions.js'
import { avg, rankArr } from '../../utils.js'

// ── Wilcoxon signed-rank ──────────────────────────────────────
// exact enumeration for n ≤ 20, normal approx otherwise
// matched pairs: x[i] vs y[i], or pass differences directly as x with y=null
export function wilcox(x, y = null) {
  const d = y ? x.map((xi, i) => xi - y[i]).filter(d => Math.abs(d) > 1e-9) : x.filter(d => Math.abs(d) > 1e-9)
  const n = d.length
  if (n < 2) return { p: 1, r: 0, Wp: 0, Wm: 0, n: 0, W: 0 }

  const items = d
    .map(v => ({ v, abs: Math.abs(v), sgn: Math.sign(v), rank: 0 }))
    .sort((a, b) => a.abs - b.abs)

  // average ranks for ties
  let i = 0
  while (i < n) {
    let j = i
    while (j < n && items[j].abs === items[i].abs) j++
    const r = (i + j + 1) / 2
    for (let k = i; k < j; k++) items[k].rank = r
    i = j
  }

  const Wp = items.filter(r => r.sgn > 0).reduce((s, r) => s + r.rank, 0)
  const Wm = items.filter(r => r.sgn < 0).reduce((s, r) => s + r.rank, 0)
  const W  = Math.min(Wp, Wm)
  const p  = n <= 20 ? _exactWilcoxP(W, n) : _wilcoxNormal(W, n)
  const mu = n * (n + 1) / 4
  const Z  = (W - mu) / Math.sqrt(n * (n + 1) * (2 * n + 1) / 24)

  return { W, Wp, Wm, n, p, Z, r: Math.abs(Z) / Math.sqrt(n) }
}

function _exactWilcoxP(W, n) {
  const tot = 1 << n
  let c = 0
  for (let m = 0; m < tot; m++) {
    let t = 0
    for (let i = 0; i < n; i++) if ((m >> i) & 1) t += (i + 1)
    if (Math.min(t, n * (n + 1) / 2 - t) <= W) c++
  }
  return c / tot
}

function _wilcoxNormal(W, n) {
  const mu  = n * (n + 1) / 4
  const sig = Math.sqrt(n * (n + 1) * (2 * n + 1) / 24)
  return 2 * (1 - normalCDF(Math.abs((W - mu) / sig)))
}

// ── sign test ────────────────────────────────────────────────
// no assumption about distribution shape, only direction of differences
export function signTest(x, y) {
  const n  = x.length
  const k  = x.filter((xi, i) => xi > y[i]).length
  const lo = Math.min(k, n - k)
  let p    = 0
  for (let i = 0; i <= lo; i++) p += binom(n, i) * (0.5 ** n)
  return { k, n, p: Math.min(1, p * 2) }
}

// ── Mann–Whitney U ────────────────────────────────────────────
// two-sample, unpaired — tests whether P(X > Y) = 0.5
export function mannWhitney(x, y) {
  const nx = x.length, ny = y.length
  let U1 = 0
  x.forEach(xi => y.forEach(yj => {
    if (xi > yj) U1++
    else if (xi === yj) U1 += 0.5
  }))
  const U2  = nx * ny - U1
  const U   = Math.min(U1, U2)
  const mu  = nx * ny / 2
  const sig = Math.sqrt(nx * ny * (nx + ny + 1) / 12)
  const Z   = (U - mu) / sig
  const p   = 2 * (1 - normalCDF(Math.abs(Z)))
  return { U, U1, U2, nx, ny, Z, p, r: Math.abs(Z) / Math.sqrt(nx + ny) }
}

// ── Kruskal–Wallis H ─────────────────────────────────────────
// k-sample generalization of MW — tests for any location shift
export function kruskalWallis(groups) {
  const N   = groups.reduce((s, g) => s + g.length, 0)
  const all = []
  groups.forEach((g, i) => g.forEach(v => all.push({ v, g: i })))
  all.sort((a, b) => a.v - b.v)

  let i = 0
  while (i < all.length) {
    let j = i
    while (j < all.length && all[j].v === all[i].v) j++
    const r = (i + j + 1) / 2
    for (let k = i; k < j; k++) all[k].r = r
    i = j
  }

  const Ri = groups.map((_, gi) => all.filter(x => x.g === gi).reduce((s, x) => s + x.r, 0))
  const H  = (12 / (N * (N + 1))) * Ri.reduce((s, R, i) => s + R * R / groups[i].length, 0) - 3 * (N + 1)
  const df = groups.length - 1
  const p  = 1 - chi2CDF(H, df)
  const eta2 = Math.max(0, (H - df + 1) / (N - df))

  return { H, df, p, eta2, Ri, N }
}

// ── Two-sample Kolmogorov–Smirnov ────────────────────────────
// D = max |F1(x) - F2(x)| over empirical CDFs
// sensitive to any shape difference (location, scale, skew)
// asymptotic p via Kolmogorov distribution — reasonable for n > 25
export function ksTest(x, y) {
  const nx = x.length, ny = y.length
  const all = [
    ...x.map(v => ({ v, g: 0 })),
    ...y.map(v => ({ v, g: 1 })),
  ].sort((a, b) => a.v - b.v || a.g - b.g)

  let cx = 0, cy = 0, D = 0
  for (const pt of all) {
    if (pt.g === 0) cx++; else cy++
    D = Math.max(D, Math.abs(cx / nx - cy / ny))
  }

  // effective n for asymptotic distribution
  const ne = Math.sqrt((nx * ny) / (nx + ny))
  // continuity correction + bias correction from Stephens (1970)
  const lambda = (ne + 0.12 + 0.11 / ne) * D
  const p = kolmogorovP(lambda)

  return { D, nx, ny, lambda, p }
}

// ── Two-sample Cramér–von Mises W2 ───────────────────────────
// integrates (F1 - F2)² rather than taking max like KS
// more sensitive to differences throughout the distribution, especially tails
// Anderson (1962) two-sample statistic, asymptotic chi-squared p
export function cvmTest(x, y) {
  const nx = x.length, ny = y.length
  const N  = nx + ny

  // combined sorted ranks
  const all = [
    ...x.map(v => ({ v, g: 0 })),
    ...y.map(v => ({ v, g: 1 })),
  ].sort((a, b) => a.v - b.v)

  // assign average ranks for ties
  const ranks = rankArr(all.map(p => p.v))
  all.forEach((p, i) => { p.r = ranks[i] })

  // Anderson's T statistic
  const rx = all.filter(p => p.g === 0).map(p => p.r)
  const ry = all.filter(p => p.g === 1).map(p => p.r)

  let U = 0
  rx.forEach((r, i) => { U += (r - (i + 1)) ** 2 })
  ry.forEach((r, j) => { U += (r - (j + 1)) ** 2 })

  // W2 statistic (normalized)
  const T = U / (nx * ny * N) - (4 * nx * ny - 1) / (6 * N)

  // asymptotic distribution: T ~ chi2(1) / 6 approximation (Conover 1999)
  // more accurate: standardize and use normal
  const mean  = 1 / 6 - 1 / (6 * N)
  const vari  = N > 4 ? (N + 1) / (45 * N) * (4 * nx * ny * (N + 1) - (N + 2) * N) / (nx * ny * (N - 1)) : 0.01
  const Z     = (T - mean) / Math.sqrt(Math.max(vari, 1e-9))
  const p     = 2 * (1 - normalCDF(Math.abs(Z)))

  return { T, Z, nx, ny, p }
}
