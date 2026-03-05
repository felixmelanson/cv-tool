import { datasets, activeDS, sSelDS, neonMode, theme, section, set } from './state.js'
import { makeDemo } from './demo.js'
import { parseXML } from './parser.js'
import {
  nav, render, updateTopbar, killCharts,
  onGStyle, onGSmooth, setGMetric, toggleDS,
  setCmpMetric,
  toggleStatDS, setStatMetric, setStatTest, runStats,
  refreshDatasetList,
  mkToggle, toggleClick,
} from './ui.js'
import { buildChart } from './charts.js'

// ── expose everything inline HTML onclick needs ──────────────
window.nav          = nav
window.onGStyle     = onGStyle
window.onGSmooth    = onGSmooth
window.setGMetric   = setGMetric
window.toggleDS     = toggleDS
window.setCmpMetric = setCmpMetric
window.toggleStatDS = toggleStatDS
window.setStatMetric = setStatMetric
window.setStatTest  = setStatTest
window.runStats     = runStats
window.toggleClick  = toggleClick
window.loadDemoData = loadDemoData
window.removeDataset = removeDataset
window.exportPNG    = exportPNG
window.exportCSV    = exportCSV
window.toggleNeon   = toggleNeon
window.toggleTheme  = toggleTheme
window.handleFile   = handleFile

// ── load demo ────────────────────────────────────────────────
function loadDemoData(n) {
  set('datasets', [])
  set('activeDS', [])
  set('sSelDS',   [])

  const newDS = n === 1
    ? [makeDemo(0, 1337, 'Workout A')]
    : [
        makeDemo(0, 1337, 'P1'),
        makeDemo(1, 2674, 'P2'),
        makeDemo(2, 5521, 'P3'),
        makeDemo(3, 8832, 'P4'),
      ]

  set('datasets', newDS)
  set('activeDS', newDS.map(d => d.id))
  set('sSelDS',   newDS.map(d => d.id))

  updateTopbar()
  nav(section === 'upload' ? 'graph' : section)
}

// ── file upload handler ───────────────────────────────────────
function handleFile(file) {
  const reader = new FileReader()
  reader.onload = e => {
    const label = file.name.replace('export.xml', '').replace('.xml', '') || `DS${datasets.length + 1}`
    const ds    = parseXML(e.target.result, label, datasets.length)
    if (!ds) { alert('No heart rate records found in this file.'); return }

    set('datasets', [...datasets, ds])
    set('activeDS', datasets.map(d => d.id))
    set('sSelDS',   datasets.map(d => d.id))

    refreshDatasetList()
    updateTopbar()
  }
  reader.readAsText(file)
}

// ── remove dataset ────────────────────────────────────────────
function removeDataset(id) {
  set('datasets', datasets.filter(d => d.id !== id))
  set('activeDS', activeDS.filter(x => x !== id))
  set('sSelDS',   sSelDS.filter(x => x !== id))
  refreshDatasetList()
  updateTopbar()
}

// ── neon mode ─────────────────────────────────────────────────
function toggleNeon() {
  set('neonMode', !neonMode)
  document.getElementById('neon-btn')?.classList.toggle('on', !neonMode)
  killCharts()
  if (section === 'graph') buildChart()
}

// ── theme ─────────────────────────────────────────────────────
function toggleTheme() {
  const next = theme === 'dark' ? 'light' : 'dark'
  set('theme', next)
  document.body.classList.toggle('light', next === 'light')
  killCharts()
  render()
}

// ── export PNG ───────────────────────────────────────────────
// grabs the raw canvas bitmap — Chart.js renders to it directly,
// so toDataURL gives us exactly what's on screen
function exportPNG() {
  const canvas = document.getElementById('gc')
  if (!canvas) return
  const a = document.createElement('a')
  a.download = `cv-tool-${Date.now()}.png`
  a.href     = canvas.toDataURL('image/png')
  a.click()
}

// ── export CSV ───────────────────────────────────────────────
// time-aligns all active datasets with a 10s tolerance window,
// blank cells where a dataset has no reading near that timestamp
function exportCSV() {
  if (!datasets.length) return
  // gMetric and MCFG are already imported at the top of this file
  const active = datasets.filter(d => activeDS.includes(d.id) && d.metrics[gMetric])
  if (!active.length) return

  let csv = `time_s,${active.map(d => d.label).join(',')}\n`
  const times = [...new Set(active.flatMap(d => d.metrics[gMetric].map(p => p.t)))].sort((a, b) => a - b)

  times.forEach(t => {
    const row = [t, ...active.map(d => {
      const pt = d.metrics[gMetric].find(p => Math.abs(p.t - t) < 10)
      return pt ? pt.v.toFixed(2) : ''
    })]
    csv += row.join(',') + '\n'
  })

  const a = document.createElement('a')
  a.href     = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = `cv-tool-export.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

// ── boot ─────────────────────────────────────────────────────
loadDemoData(2)