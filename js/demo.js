import { DCOLS } from './state.js'

// seeded rng — same seed = same data every time
function rng(s) {
  let seed = s
  return () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff
    return (seed >>> 0) / 0xffffffff
  }
}

export function makeDemo(id, seed, label) {
  const r    = rng(seed)
  const rest = 58 + r() * 14
  const peak = 158 + r() * 22
  const dur  = 2400
  const hr   = []

  for (let t = 0; t < dur; t += 8 + Math.floor(r() * 6)) {
    const f = t / dur
    let v
    if      (f < 0.08) v = rest + (r() - 0.5) * 5
    else if (f < 0.22) v = rest + (peak * 0.75 - rest) * ((f - 0.08) / 0.14) + (r() - 0.5) * 8
    else if (f < 0.55) v = peak * (0.8 + r() * 0.13) + Math.sin(t * 0.018) * 7 + (r() - 0.5) * 9
    else if (f < 0.62) v = peak * 0.92 - (peak * 0.92 - peak * 0.7) * ((f - 0.55) / 0.07) + (r() - 0.5) * 6
    else if (f < 0.72) v = peak * (0.84 + r() * 0.1) + (r() - 0.5) * 9
    else {
      const tau = 50 + r() * 30
      const el  = (f - 0.72) * dur
      v = rest + (peak * 0.88 - rest) * Math.exp(-el / tau) + (r() - 0.5) * 5
    }
    hr.push({ t, v: Math.round(Math.max(40, Math.min(210, v)) * 10) / 10 })
  }

  const hrv = hr
    .filter((_, i) => i % 5 === 0)
    .map(p => ({ t: p.t, v: Math.round((75 - (p.v - rest) * 0.55 + (r() - 0.5) * 12) * 10) / 10 }))

  const spo2 = hr
    .filter((_, i) => i % 8 === 0)
    .map(p => ({ t: p.t, v: Math.round((98.6 - (p.v > 165 ? 1.4 : 0.2) + (r() - 0.5) * 0.7) * 10) / 10 }))

  let cum = 0
  const energy = hr
    .filter((_, i) => i % 3 === 0)
    .map(p => { cum += (p.v / 180) * 0.12 + r() * 0.05; return { t: p.t, v: Math.round(cum * 10) / 10 } })

  return {
    id, label,
    color:    DCOLS[id % DCOLS.length],
    rest:     Math.round(rest),
    peak:     Math.round(peak),
    totalDur: dur,
    metrics:  { hr, hrv, spo2, energy },
  }
}