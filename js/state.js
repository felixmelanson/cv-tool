// shared state
export let datasets = []
export let activeDS = []
export let charts   = {}
export let section  = 'graph'
export let neonMode = false
export let theme    = 'dark'

// graph
export let gMetric    = 'hr'
export let gStyle     = 'line'
export let gSmooth    = true
export let gChartType = 'line' // line | area | scatter | histogram | box | violin | heatmap | regression

// chart customization
export let custOpen     = false
export let custAxisTitle = ''
export let custLineWidth = 2
export let custMarkerSize = 4
export let custOpacity   = 0.8
export let custShowGrid  = true
export let custLogScale  = false
export let custLegendPos = 'top'
export let custColorscale = 'Viridis'
export let custBinCount   = 0      // 0 = auto
export let custShowPoints = true
export let custNotched    = false
export let custHorizontal = false
export let custTrendline  = true
export let custShowCI     = true

// export
export let exportDPI   = 150
export let animType    = 'draw'  // draw | slide | morph
export let animFPS     = 30
export let animDuration = 4

// stats
export let sMetric = 0
export let sTest   = 0
export let sSelDS  = []

// compare
export let cmpM = 0

// setter (ES modules can't reassign imported bindings)
export function set(key, val) {
  switch (key) {
    case 'datasets':       datasets       = val; break
    case 'activeDS':       activeDS       = val; break
    case 'charts':         charts         = val; break
    case 'section':        section        = val; break
    case 'neonMode':       neonMode       = val; break
    case 'theme':          theme          = val; break
    case 'gMetric':        gMetric        = val; break
    case 'gStyle':         gStyle         = val; break
    case 'gSmooth':        gSmooth        = val; break
    case 'gChartType':     gChartType     = val; break
    case 'custOpen':       custOpen       = val; break
    case 'custAxisTitle':  custAxisTitle   = val; break
    case 'custLineWidth':  custLineWidth   = val; break
    case 'custMarkerSize': custMarkerSize  = val; break
    case 'custOpacity':    custOpacity     = val; break
    case 'custShowGrid':   custShowGrid    = val; break
    case 'custLogScale':   custLogScale    = val; break
    case 'custLegendPos':  custLegendPos   = val; break
    case 'custColorscale': custColorscale  = val; break
    case 'custBinCount':   custBinCount    = val; break
    case 'custShowPoints': custShowPoints  = val; break
    case 'custNotched':    custNotched     = val; break
    case 'custHorizontal': custHorizontal  = val; break
    case 'custTrendline':  custTrendline   = val; break
    case 'custShowCI':     custShowCI      = val; break
    case 'exportDPI':      exportDPI       = val; break
    case 'animType':       animType        = val; break
    case 'animFPS':        animFPS         = val; break
    case 'animDuration':   animDuration    = val; break
    case 'sMetric':        sMetric         = val; break
    case 'sTest':          sTest           = val; break
    case 'sSelDS':         sSelDS          = val; break
    case 'cmpM':           cmpM            = val; break
  }
}

// constants
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
  spo2:   { label: 'SpO2',         unit: '%',         hk: 'HKQuantityTypeIdentifierOxygenSaturation' },
  rr:     { label: 'Resp. Rate',    unit: 'br/min',    hk: 'HKQuantityTypeIdentifierRespiratoryRate' },
  energy: { label: 'Active Energy', unit: 'kcal',      hk: 'HKQuantityTypeIdentifierActiveEnergyBurned' },
  vo2:    { label: 'VO2 Max',      unit: 'mL/kg/min', hk: 'HKQuantityTypeIdentifierVO2Max' },
}

// chart type definitions
export const CHART_TYPES = [
  { key: 'line',       label: 'Line',       icon: 'M2 12 L7 9 L12 14 L17 7 L22 11' },
  { key: 'area',       label: 'Area',       icon: 'M2 12 L7 9 L12 14 L17 7 L22 11 L22 20 L2 20Z' },
  { key: 'scatter',    label: 'Scatter',    icon: null },
  { key: 'histogram',  label: 'Histogram',  icon: null },
  { key: 'box',        label: 'Box Plot',   icon: null },
  { key: 'violin',     label: 'Violin',     icon: null },
  { key: 'heatmap',    label: 'Heatmap',    icon: null },
  { key: 'regression', label: 'Regression', icon: null },
]
