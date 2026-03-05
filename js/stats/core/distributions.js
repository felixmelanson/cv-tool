// distributions.js — numerical CDFs / tail probabilities
// algorithms: Hart (1968) rational approx, Lanczos gamma, Lentz continued fractions
// nothing here does IO or touches state — pure math

// ── normal ───────────────────────────────────────────────────
// Hart (1968) rational approximation, accurate to ~7 decimal places
export function normalCDF(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp(-z * z / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.821256 + t * 1.3302744))))
  return z > 0 ? 1 - p : p
}

// ── Student's t ──────────────────────────────────────────────
// regularized incomplete beta via Lentz continued fraction
export function tCDF(t, df) {
  const x = df / (df + t * t)
  let c = 1, dd = 1 - (df + 1) * x / (df / 2 + 1), sum = 1
  dd = dd === 0 ? 1e-30 : 1 / dd; c = dd
  for (let m = 1; m <= 100; m++) {
    const m2 = 2 * m
    let num = m * (0.5 - m) * x / ((df / 2 + m2 - 1) * (df / 2 + m2))
    dd = 1 + num * dd; dd = dd === 0 ? 1e-30 : dd
    c  = 1 + num / c;  c  = c  === 0 ? 1e-30 : c
    dd = 1 / dd; let delta = c * dd; sum *= delta
    num = -(df / 2 + m) * (df / 2 + 0.5 + m) * x / ((df / 2 + m2) * (df / 2 + m2 + 1))
    dd = 1 + num * dd; c = 1 + num / c
    c  = c  === 0 ? 1e-30 : c; dd = 1 / dd
    delta = c * dd; sum *= delta
    if (Math.abs(delta - 1) < 1e-8) break
  }
  const pp = 0.5 * (df / (df + t * t)) ** (df / 2) * (1 - x) ** 0.5 * sum /
    (df * Math.exp(lgamma(df / 2 + 0.5) - lgamma(0.5) - lgamma(df / 2)))
  return t > 0 ? 1 - pp : pp
}

// ── chi-squared ──────────────────────────────────────────────
export function chi2CDF(x, k) {
  if (x <= 0) return 0
  return regGammaP(k / 2, x / 2)
}

// ── Kolmogorov distribution ──────────────────────────────────
// tail prob P(D_n > d) — used for asymptotic two-sample KS p-value
// series converges in < 20 terms for lambda > 0.5
export function kolmogorovP(lambda) {
  if (lambda <= 0) return 1
  let sum = 0
  for (let k = 1; k <= 100; k++) {
    const term = (k % 2 === 0 ? -1 : 1) * Math.exp(-2 * k * k * lambda * lambda)
    sum += term
    if (Math.abs(term) < 1e-12) break
  }
  return Math.max(0, Math.min(1, 2 * sum))
}

// ── internals ────────────────────────────────────────────────

// regularized incomplete gamma P(a, x) — series for x < a+1, CF otherwise
function regGammaP(a, x) {
  if (x <= 0) return 0
  if (x < a + 1) {
    let ap = a, del = 1 / a, sum = del
    for (let i = 0; i < 200; i++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-7) break }
    return sum * Math.exp(-x + a * Math.log(x) - lgamma(a))
  } else {
    let b = x + 1 - a, c = 1e30, dd = 1 / b, h = dd
    for (let i = 1; i <= 200; i++) {
      const an = -i * (i - a), b2 = b + 2
      dd = an * dd + b2; c = b2 + an / c; dd = 1 / dd; h *= dd * c; b += 2
      if (Math.abs(dd * c - 1) < 1e-7) break
    }
    return 1 - h * Math.exp(-x + a * Math.log(x) - lgamma(a))
  }
}

// Lanczos log-gamma — g=5, n=6 coefficients
function lgamma(z) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]
  let y = z, tmp = z + 5.5
  tmp -= (z + 0.5) * Math.log(tmp)
  let ser = 1.000000000190015
  for (let i = 0; i < 6; i++) ser += c[i] / ++y
  return -tmp + Math.log(2.5066282746310005 * ser / z)
}

export function binom(n, k) {
  if (k < 0 || k > n) return 0
  if (k === 0 || k === n) return 1
  let r = 1
  for (let i = 0; i < Math.min(k, n - k); i++) r = r * (n - i) / (i + 1)
  return r
}