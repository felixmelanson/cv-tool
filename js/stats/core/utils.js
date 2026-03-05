// utils.js — formatting helpers + shared rank function
// used across all test modules so it lives here, not duplicated

export function avg(a) { return a?.length ? a.reduce((s, v) => s + v, 0) / a.length : null }

export function std(a) {
  if (!a?.length) return null
  const m = avg(a)
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1))
}

export function median(a) {
  if (!a?.length) return null
  const s = [...a].sort((x, y) => x - y)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function pfmt(p) { return p < 0.001 ? '< 0.001' : p.toFixed(4) }

// Cohen's conventions differ by statistic type
// 'r' = correlation-family  |  'd' = standardized mean diff
export function efl(v, type = 'r') {
  const abs = Math.abs(v)
  if (type === 'r') return abs > 0.5 ? 'large' : abs > 0.3 ? 'medium' : 'small'
  if (type === 'd') return abs > 0.8 ? 'large' : abs > 0.5 ? 'medium' : 'small'
  if (type === 'eta2') return abs > 0.14 ? 'large' : abs > 0.06 ? 'medium' : 'small'
  return abs > 0.8 ? 'large' : abs > 0.5 ? 'medium' : 'small'
}

// position of effect on 0-100 scale for the visual gauge
// maps small/medium/large thresholds to 33/66/100%
export function efPct(v, type = 'r') {
  const abs = Math.abs(v)
  const max = type === 'd' ? 1.2 : type === 'eta2' ? 0.22 : 0.8
  return Math.min(100, (abs / max) * 100)
}

// plain-English interpretation line
export function interpStr(p, ef, type) {
  const sig = p < 0.05 ? 'Statistically significant' : p < 0.1 ? 'Trend toward significance' : 'No significant difference'
  const efLabel = typeof ef === 'number' ? ` Effect: ${Math.abs(ef).toFixed(3)} (${efl(ef, type)}).` : ''
  return `${sig} (p = ${pfmt(p)}).${efLabel}`
}

// assigns average ranks with tie handling — shared by Wilcoxon, Spearman, KW
export function rankArr(arr) {
  const idx = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)
  const out = new Array(arr.length)
  let i = 0
  while (i < idx.length) {
    let j = i
    while (j < idx.length && idx[j].v === idx[i].v) j++
    const r = (i + j + 1) / 2
    for (let k = i; k < j; k++) out[idx[k].i] = r
    i = j
  }
  return out
}

// percentile (linear interpolation)
export function percentile(a, p) {
  const s = [...a].sort((x, y) => x - y)
  const pos = (p / 100) * (s.length - 1)
  const lo = Math.floor(pos)
  return s[lo] + (pos - lo) * (s[Math.min(lo + 1, s.length - 1)] - s[lo])
}