// ── shared state ────────────────────────────────────────────
export let datasets = []
export let activeDS = []
export let charts   = {}
export let section  = 'graph'
export let neonMode = false
export let theme    = 'dark'

// graph
export let gMetric = 'hr'
export let gStyle  = 'line'
export let gSmooth = true

// stats
export let sMetric = 0
export let sTest   = 0
export let sSelDS  = []

// compare
export let cmpM = 0

// ── setters (ES modules can't reassign imported bindings directly) ──
export function set(key, val) {
  const map = { datasets, activeDS, charts, section, neonMode, theme, gMetric, gStyle, gSmooth, sMetric, sTest, sSelDS, cmpM }
  switch(key) {
    case 'datasets': datasets = val; break
    case 'activeDS': activeDS = val; break
    case 'charts':   charts   = val; break
    case 'section':  section  = val; break
    case 'neonMode': neonMode = val; break
    case 'theme':    theme    = val; break
    case 'gMetric':  gMetric  = val; break
    case 'gStyle':   gStyle   = val; break
    case 'gSmooth':  gSmooth  = val; break
    case 'sMetric':  sMetric  = val; break
    case 'sTest':    sTest    = val; break
    case 'sSelDS':   sSelDS   = val; break
    case 'cmpM':     cmpM     = val; break
  }
}

// ── constants ────────────────────────────────────────────────
export const DCOLS = ['#38bdf8', '#4ade80', '#f87171', '#c084fc', '#fbbf24', '#fb923c']

export const DNEON = [
  { c: '#38bdf8', g: 'rgba(56,189,248,0.6)'  },
  { c: '#4ade80', g: 'rgba(74,222,128,0.6)'  },
  { c: '#f87171', g: 'rgba(248,113,113,0.6)' },
  { c: '#c084fc', g: 'rgba(192,132,252,0.6)' },
  { c: '#fbbf24', g: 'rgba(251,191,36,0.6)'  },
]

export const MCFG = {
  hr:     { label: 'Heart Rate',    unit: 'bpm',       hk: 'HKQuantityTypeIdentifierHeartRate' },
  hrv:    { label: 'HRV (SDNN)',    unit: 'ms',        hk: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN' },
  spo2:   { label: 'SpO₂',        unit: '%',         hk: 'HKQuantityTypeIdentifierOxygenSaturation' },
  rr:     { label: 'Resp. Rate',    unit: 'br/min',    hk: 'HKQuantityTypeIdentifierRespiratoryRate' },
  energy: { label: 'Active Energy', unit: 'kcal',      hk: 'HKQuantityTypeIdentifierActiveEnergyBurned' },
  vo2:    { label: 'VO₂ Max',      unit: 'mL/kg/min', hk: 'HKQuantityTypeIdentifierVO2Max' },
}