// ── helpers ──────────────────────────────────────────────────
export function avg(a) { return a?.length ? a.reduce((s, v) => s + v, 0) / a.length : null }

export function pfmt(p) { return p < 0.001 ? '< 0.001' : p.toFixed(4) }

export function efl(v, type) {
  if (type === 'r') return Math.abs(v) > 0.5 ? 'large' : Math.abs(v) > 0.3 ? 'medium' : 'small'
  return Math.abs(v) > 0.8 ? 'large' : Math.abs(v) > 0.5 ? 'medium' : 'small'
}

export function interpStr(p, ef, type) {
  const s = p < 0.05 ? 'Statistically significant' : p < 0.1 ? 'Trend toward significance' : 'No significant'
  return `${s} (p = ${pfmt(p)}). Effect: ${ef.toFixed(3)} (${efl(ef, type)}).`
}

// ── Wilcoxon signed-rank ──────────────────────────────────────
export function wilcox(x, y) {
  const d = x.map((xi, i) => xi - y[i]).filter(d => Math.abs(d) > 1e-9)
  const n = d.length
  if (n < 2) return { p: 0.99, r: 0, Wp: 0, Wm: 0, n: 0 }

  const items = d
    .map(v => ({ v, abs: Math.abs(v), sgn: Math.sign(v), rank: 0 }))
    .sort((a, b) => a.abs - b.abs)

  // tie-adjusted ranks
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

  // exact enumeration for n ≤ 20, normal approx otherwise
  const p   = n <= 20 ? exactWilcoxP(W, n) : normalApproxP(W, n)
  const mu  = n * (n + 1) / 4
  const sig = Math.sqrt(n * (n + 1) * (2 * n + 1) / 24)
  const Z   = (W - mu) / sig

  return { W, Wp, Wm, n, p, Z, r: Math.abs(Z) / Math.sqrt(n) }
}

function exactWilcoxP(W, n) {
  const tot = 1 << n
  let c = 0
  for (let m = 0; m < tot; m++) {
    let t = 0
    for (let i = 0; i < n; i++) if ((m >> i) & 1) t += (i + 1)
    if (Math.min(t, n * (n + 1) / 2 - t) <= W) c++
  }
  return c / tot
}

function normalApproxP(W, n) {
  const mu  = n * (n + 1) / 4
  const sig = Math.sqrt(n * (n + 1) * (2 * n + 1) / 24)
  const z   = Math.abs((W - mu) / sig)
  return 2 * (1 - normalCDF(z))
}

// ── sign test ────────────────────────────────────────────────
export function signTest(x, y) {
  const n  = x.length
  const k  = x.filter((xi, i) => xi > y[i]).length
  let p    = 0
  const lo = Math.min(k, n - k)
  for (let i = 0; i <= lo; i++) p += binom(n, i) * Math.pow(0.5, n)
  return { k, n, p: Math.min(1, p * 2) }
}

// ── paired t-test ────────────────────────────────────────────
export function pairedT(x, y) {
  const n    = x.length
  const d    = x.map((xi, i) => xi - y[i])
  const mean = d.reduce((a, b) => a + b, 0) / n
  const v    = d.reduce((s, di) => s + (di - mean) ** 2, 0) / (n - 1)
  const se   = Math.sqrt(v / n)
  const t    = mean / se
  const p    = 2 * (1 - tCDF(Math.abs(t), n - 1))
  return { t, p, d: mean / Math.sqrt(v), mean, se, n }
}

// ── Mann–Whitney U ────────────────────────────────────────────
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
  return { r, t, p, n }
}

// ── Spearman ρ ───────────────────────────────────────────────
export function spearman(x, y) {
  const rank = arr => {
    const sorted = [...arr].map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)
    const rs = new Array(arr.length)
    let i = 0
    while (i < sorted.length) {
      let j = i
      while (j < sorted.length && sorted[j].v === sorted[i].v) j++
      const a = (i + j + 1) / 2
      for (let k = i; k < j; k++) rs[sorted[k].i] = a
      i = j
    }
    return rs
  }
  return pearson(rank(x), rank(y))
}

// ── Kruskal–Wallis H ─────────────────────────────────────────
export function kruskalWallis(groups) {
  const all = []
  const N   = groups.reduce((s, g) => s + g.length, 0)
  groups.forEach((g, i) => g.forEach(v => all.push({ v, g: i })))
  all.sort((a, b) => a.v - b.v)

  // assign ranks with tie averaging
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
  const eta2 = (H - df + 1) / (N - df)

  return { H, df, p, eta2: Math.max(0, eta2) }
}

// ── bootstrap 95% CI for mean difference ─────────────────────
export function bootstrapCI(x, y, n = 800) {
  const diffs = []
  for (let i = 0; i < n; i++) {
    const bx = [], by = []
    for (let j = 0; j < x.length; j++) {
      const idx = Math.floor(Math.random() * x.length)
      bx.push(x[idx]); by.push(y[idx])
    }
    diffs.push(avg(bx) - avg(by))
  }
  diffs.sort((a, b) => a - b)
  return { lo: diffs[Math.floor(n * 0.025)], hi: diffs[Math.floor(n * 0.975)] }
}

// ── distributions ────────────────────────────────────────────
function normalCDF(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp(-z * z / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.821256 + t * 1.3302744))))
  return z > 0 ? 1 - p : p
}

function tCDF(t, df) {
  const x = df / (df + t * t)
  let c = 1, dd = 1 - (df + 1) * x / (df / 2 + 1), sum = 1
  dd = dd === 0 ? 1e-30 : 1 / dd; c = dd
  for (let m = 1; m <= 100; m++) {
    const m2  = 2 * m
    let num   = m * (0.5 - m) * x / ((df / 2 + m2 - 1) * (df / 2 + m2))
    dd = 1 + num * dd; dd = dd === 0 ? 1e-30 : dd
    c  = 1 + num / c;  c  = c  === 0 ? 1e-30 : c
    dd = 1 / dd
    let delta = c * dd; sum *= delta
    num = -(df / 2 + m) * (df / 2 + 0.5 + m) * x / ((df / 2 + m2) * (df / 2 + m2 + 1))
    dd = 1 + num * dd; c = 1 + num / c
    c  = c  === 0 ? 1e-30 : c; dd = 1 / dd
    delta = c * dd; sum *= delta
    if (Math.abs(delta - 1) < 1e-8) break
  }
  const pp = 0.5 * (df / (df + t * t)) ** (df / 2) * (1 - x) ** 0.5 * sum /
    (df * Math.exp(logGamma(df / 2 + 0.5) - logGamma(0.5) - logGamma(df / 2)))
  return t > 0 ? 1 - pp : pp
}

function chi2CDF(x, k) {
  if (x <= 0) return 0
  return regGammaP(k / 2, x / 2)
}

function regGammaP(a, x) {
  if (x <= 0) return 0
  if (x < a + 1) {
    let ap = a, del = 1 / a, sum = del
    for (let i = 0; i < 200; i++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-7) break }
    return sum * Math.exp(-x + a * Math.log(x) - logGamma(a))
  } else {
    let b = x + 1 - a, c = 1e30, dd = 1 / b, h = dd
    for (let i = 1; i <= 200; i++) {
      const an = -i * (i - a), b2 = b + 2
      dd = an * dd + b2; c = b2 + an / c; dd = 1 / dd; h *= dd * c; b += 2
      if (Math.abs(dd * c - 1) < 1e-7) break
    }
    return 1 - h * Math.exp(-x + a * Math.log(x) - logGamma(a))
  }
}

function logGamma(z) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]
  let x = z, y = z, tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.000000000190015
  for (let i = 0; i < 6; i++) ser += c[i] / ++y
  return -tmp + Math.log(2.5066282746310005 * ser / x)
}

function binom(n, k) {
  if (k < 0 || k > n) return 0
  if (k === 0 || k === n) return 1
  let r = 1
  for (let i = 0; i < Math.min(k, n - k); i++) r = r * (n - i) / (i + 1)
  return r
}