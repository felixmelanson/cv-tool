import { DCOLS } from './state.js'

// seeded rng -- same seed = same data every time
function rng(s) {
  let seed = s
  return () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff
    return (seed >>> 0) / 0xffffffff
  }
}

// shared metric generation utilities

function _genHRV(hr, r) {
  return hr
    .filter((_, i) => i % 5 === 0)
    .map(p => ({ t: p.t, v: Math.round((75 - (p.v - 60) * 0.55 + (r() - 0.5) * 12) * 10) / 10 }))
}

function _genSpO2(hr, r) {
  return hr
    .filter((_, i) => i % 8 === 0)
    .map(p => ({ t: p.t, v: Math.round((98.6 - (p.v > 165 ? 1.4 : 0.2) + (r() - 0.5) * 0.7) * 10) / 10 }))
}

function _genEnergy(hr, r) {
  let cum = 0
  return hr
    .filter((_, i) => i % 3 === 0)
    .map(p => { cum += (p.v / 180) * 0.12 + r() * 0.05; return { t: p.t, v: Math.round(cum * 10) / 10 } })
}

function _clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

// ── Original workout (general purpose) ──────────────────────

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
    hr.push({ t, v: Math.round(_clamp(v, 40, 210) * 10) / 10 })
  }

  return {
    id, label,
    color:    DCOLS[id % DCOLS.length],
    rest:     Math.round(rest),
    peak:     Math.round(peak),
    totalDur: dur,
    metrics:  { hr, hrv: _genHRV(hr, r), spo2: _genSpO2(hr, r), energy: _genEnergy(hr, r) },
  }
}

// ── Running: steady-state with gradual ramp ─────────────────

export function makeDemoRunning(id, seed, label) {
  const r    = rng(seed)
  const rest = 56 + r() * 10
  const zone = 145 + r() * 15  // zone 3 target
  const dur  = 2700             // 45 min
  const hr   = []

  for (let t = 0; t < dur; t += 6 + Math.floor(r() * 4)) {
    const f = t / dur
    let v
    if      (f < 0.10) v = rest + (zone * 0.7 - rest) * (f / 0.10) + (r() - 0.5) * 4
    else if (f < 0.20) v = zone * 0.7 + (zone - zone * 0.7) * ((f - 0.10) / 0.10) + (r() - 0.5) * 5
    else if (f < 0.85) v = zone + Math.sin(t * 0.008) * 4 + (r() - 0.5) * 6 + (f - 0.2) * 8 // cardiac drift
    else               v = rest + (zone - rest) * Math.exp(-((f - 0.85) * dur) / 40) + (r() - 0.5) * 4
    hr.push({ t, v: Math.round(_clamp(v, 42, 200) * 10) / 10 })
  }

  return {
    id, label,
    color:    DCOLS[id % DCOLS.length],
    rest:     Math.round(rest),
    peak:     Math.round(Math.max(...hr.map(p => p.v))),
    totalDur: dur,
    metrics:  { hr, hrv: _genHRV(hr, r), spo2: _genSpO2(hr, r), energy: _genEnergy(hr, r) },
  }
}

// ── Cycling: interval blocks (high/low) ─────────────────────

export function makeDemoCycling(id, seed, label) {
  const r       = rng(seed)
  const rest    = 54 + r() * 8
  const hiZone  = 160 + r() * 15
  const loZone  = 110 + r() * 10
  const dur     = 3000  // 50 min
  const hr      = []
  const intLen  = 180   // 3 min intervals
  const restLen = 120   // 2 min recovery

  for (let t = 0; t < dur; t += 5 + Math.floor(r() * 3)) {
    const f = t / dur
    let v

    if (f < 0.08) {
      // warmup
      v = rest + (loZone - rest) * (f / 0.08) + (r() - 0.5) * 4
    } else if (f > 0.88) {
      // cooldown
      v = rest + (loZone - rest) * Math.exp(-((f - 0.88) * dur) / 35) + (r() - 0.5) * 3
    } else {
      // intervals
      const cycleT = (t - dur * 0.08) % (intLen + restLen)
      const inWork = cycleT < intLen
      const target = inWork ? hiZone : loZone
      const ramp   = inWork
        ? Math.min(1, cycleT / 30)                       // ramp up over 30s
        : Math.min(1, (cycleT - intLen) / 20)           // drop over 20s
      const base = inWork
        ? loZone + (hiZone - loZone) * ramp
        : hiZone + (loZone - hiZone) * ramp
      v = base + (r() - 0.5) * 7
    }
    hr.push({ t, v: Math.round(_clamp(v, 45, 205) * 10) / 10 })
  }

  return {
    id, label,
    color:    DCOLS[id % DCOLS.length],
    rest:     Math.round(rest),
    peak:     Math.round(Math.max(...hr.map(p => p.v))),
    totalDur: dur,
    metrics:  { hr, hrv: _genHRV(hr, r), spo2: _genSpO2(hr, r), energy: _genEnergy(hr, r) },
  }
}

// ── HIIT: short intense bursts ──────────────────────────────

export function makeDemoHIIT(id, seed, label) {
  const r    = rng(seed)
  const rest = 60 + r() * 10
  const peak = 180 + r() * 12
  const dur  = 1500  // 25 min
  const hr   = []
  const burstLen = 30  // 30s bursts
  const restLen  = 45  // 45s rest

  for (let t = 0; t < dur; t += 4 + Math.floor(r() * 3)) {
    const f = t / dur
    let v

    if (f < 0.12) {
      v = rest + (rest * 1.3 - rest) * (f / 0.12) + (r() - 0.5) * 5
    } else if (f > 0.88) {
      const prev = hr.length > 0 ? hr[hr.length - 1].v : rest * 1.5
      v = rest + (prev - rest) * Math.exp(-((f - 0.88) * dur) / 25) + (r() - 0.5) * 4
    } else {
      const cycleT = (t - dur * 0.12) % (burstLen + restLen)
      const inBurst = cycleT < burstLen
      if (inBurst) {
        const ramp = Math.min(1, cycleT / 12)
        v = rest * 1.2 + (peak - rest * 1.2) * ramp + (r() - 0.5) * 8
      } else {
        const decay = (cycleT - burstLen) / restLen
        v = peak + (rest * 1.15 - peak) * decay + (r() - 0.5) * 6
      }
    }
    hr.push({ t, v: Math.round(_clamp(v, 50, 210) * 10) / 10 })
  }

  return {
    id, label,
    color:    DCOLS[id % DCOLS.length],
    rest:     Math.round(rest),
    peak:     Math.round(Math.max(...hr.map(p => p.v))),
    totalDur: dur,
    metrics:  { hr, hrv: _genHRV(hr, r), spo2: _genSpO2(hr, r), energy: _genEnergy(hr, r) },
  }
}

// ── Resting baseline ────────────────────────────────────────

export function makeDemoResting(id, seed, label) {
  const r    = rng(seed)
  const base = 58 + r() * 8
  const dur  = 1800  // 30 min
  const hr   = []

  for (let t = 0; t < dur; t += 10 + Math.floor(r() * 8)) {
    // subtle respiratory sinus arrhythmia
    const rsa = Math.sin(t * 0.025) * 2.5
    const drift = Math.sin(t * 0.002) * 1.5  // slow autonomic drift
    const noise = (r() - 0.5) * 3
    const v = base + rsa + drift + noise
    hr.push({ t, v: Math.round(_clamp(v, 40, 90) * 10) / 10 })
  }

  // resting HRV is much higher
  const hrv = hr
    .filter((_, i) => i % 3 === 0)
    .map(p => ({ t: p.t, v: Math.round((55 + r() * 25 + Math.sin(p.t * 0.01) * 8) * 10) / 10 }))

  const spo2 = hr
    .filter((_, i) => i % 5 === 0)
    .map(p => ({ t: p.t, v: Math.round((98.8 + (r() - 0.5) * 0.5) * 10) / 10 }))

  return {
    id, label,
    color:    DCOLS[id % DCOLS.length],
    rest:     Math.round(base),
    peak:     Math.round(Math.max(...hr.map(p => p.v))),
    totalDur: dur,
    metrics:  { hr, hrv, spo2, energy: _genEnergy(hr, r) },
  }
}

// ── Sleep profile ───────────────────────────────────────────

export function makeDemoSleep(id, seed, label) {
  const r    = rng(seed)
  const base = 52 + r() * 6
  const dur  = 28800  // 8 hours
  const hr   = []

  // sleep stages model: each cycle ~90 min
  const cycleLen = 5400
  const nCycles  = Math.floor(dur / cycleLen)

  for (let t = 0; t < dur; t += 30 + Math.floor(r() * 20)) {
    const cycleIdx  = Math.floor(t / cycleLen)
    const cyclePhase = (t % cycleLen) / cycleLen

    // deep sleep dip early in cycle, lighter sleep + REM later
    let stageOffset
    if (cyclePhase < 0.35) {
      // transition to deep sleep
      stageOffset = -4 * Math.sin(cyclePhase / 0.35 * Math.PI / 2)
    } else if (cyclePhase < 0.65) {
      // deep sleep (lowest HR)
      stageOffset = -4 + (r() - 0.5) * 1.5
    } else if (cyclePhase < 0.85) {
      // rising to REM
      stageOffset = -4 + 6 * ((cyclePhase - 0.65) / 0.20)
    } else {
      // REM (slightly elevated, more variable)
      stageOffset = 2 + (r() - 0.5) * 4
    }

    // overall trend: HR slightly higher toward morning (later cycles)
    const morningRise = (cycleIdx / nCycles) * 3
    const v = base + stageOffset + morningRise + (r() - 0.5) * 2
    hr.push({ t, v: Math.round(_clamp(v, 38, 80) * 10) / 10 })
  }

  // sleep HRV is high
  const hrv = hr
    .filter((_, i) => i % 4 === 0)
    .map(p => ({ t: p.t, v: Math.round((60 + r() * 30 + Math.sin(p.t * 0.0005) * 10) * 10) / 10 }))

  const spo2 = hr
    .filter((_, i) => i % 6 === 0)
    .map(p => ({ t: p.t, v: Math.round((97.5 + (r() - 0.5) * 1.2) * 10) / 10 }))

  return {
    id, label,
    color:    DCOLS[id % DCOLS.length],
    rest:     Math.round(base),
    peak:     Math.round(Math.max(...hr.map(p => p.v))),
    totalDur: dur,
    metrics:  { hr, hrv, spo2, energy: [] },
  }
}

// ── Longitudinal: daily summaries over N days ───────────────

export function makeLongitudinal(id, seed, label, days) {
  const r      = rng(seed)
  const dur    = days * 86400
  const hr     = []
  const hrv    = []
  const spo2   = []
  const energy = []

  // baseline that improves over training period
  const restBase   = 62 + r() * 6
  const hrvBase    = 42 + r() * 8
  const spo2Base   = 97.5 + r() * 0.5

  for (let day = 0; day < days; day++) {
    const t = day * 86400  // timestamp as seconds from start

    // training adaptation: resting HR drops, HRV rises, fitness improves
    const adaptation = Math.min(1, day / (days * 0.7))
    const restHR   = restBase - adaptation * 6 + (r() - 0.5) * 3
    const meanHR   = restHR + 8 + (r() - 0.5) * 5
    const hrvVal   = hrvBase + adaptation * 15 + (r() - 0.5) * 6
    const spo2Val  = spo2Base + adaptation * 0.3 + (r() - 0.5) * 0.4
    const kcal     = 300 + r() * 400 + adaptation * 100

    // add some weekly periodization (lighter on day 7)
    const weekDay = day % 7
    const loadFactor = weekDay === 6 ? 0.6 : weekDay === 5 ? 0.8 : 1.0

    hr.push({ t, v: Math.round(_clamp(meanHR * loadFactor + restHR * (1 - loadFactor), 45, 180) * 10) / 10 })
    hrv.push({ t, v: Math.round(_clamp(hrvVal + (1 - loadFactor) * 10, 20, 120) * 10) / 10 })
    spo2.push({ t, v: Math.round(_clamp(spo2Val, 95, 100) * 10) / 10 })
    energy.push({ t, v: Math.round(_clamp(kcal * loadFactor, 100, 900) * 10) / 10 })
  }

  return {
    id, label,
    color:    DCOLS[id % DCOLS.length],
    rest:     Math.round(restBase),
    peak:     Math.round(Math.max(...hr.map(p => p.v))),
    totalDur: dur,
    metrics:  { hr, hrv, spo2, energy },
  }
}
