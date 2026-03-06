// main.js — entry point
// wires window globals that inline onclick handlers need

import { datasets, activeDS, sSelDS, neonMode, theme, section, gMetric, custOpen, set } from './state.js'
import { makeDemo, makeDemoRunning, makeDemoCycling, makeDemoHIIT, makeDemoResting, makeDemoSleep, makeLongitudinal } from './demo.js'
import { parseXML } from './parser.js'
import {
  nav, render, updateTopbar, killCharts,
  onGSmooth, setGMetric, setChartType, toggleDS,
  setCmpMetric,
  toggleStatDS, setStatMetric, setStatTest, runStats,
  refreshDatasetList, refreshLivePanel,
  mkToggle, toggleClick, toggleExportMenu, setPanelTab,
} from './ui.js'
import { avg } from './stats/index.js'
import { buildChart } from './charts.js'
import { exportPNG, exportPNGHiRes, exportCSV, exportGIF, exportVideo } from './export.js'

// ── expose to inline onclick handlers ────────────────────────

window.nav            = nav
window.onGSmooth      = onGSmooth
window.setGMetric     = setGMetric
window.setChartType   = setChartType
window.toggleDS       = toggleDS
window.setCmpMetric   = setCmpMetric
window.toggleStatDS   = toggleStatDS
window.setStatMetric  = setStatMetric
window.setStatTest    = setStatTest
window.runStats       = runStats
window.toggleClick    = toggleClick
window.loadDemoData   = loadDemoData
window.removeDataset  = removeDataset
window.exportPNG      = exportPNG
window.exportPNGHiRes = exportPNGHiRes
window.exportCSV      = exportCSV
window.exportGIF      = exportGIF
window.exportVideo    = exportVideo
window.toggleNeon     = toggleNeon
window.toggleTheme    = toggleTheme
window.handleFile     = handleFile
window.toggleExportMenu = toggleExportMenu
window.toggleCustomize  = toggleCustomize
window.setPanelTab      = setPanelTab

// ── demo ─────────────────────────────────────────────────────

function loadDemoData(scenario) {
  set('datasets', [])
  set('activeDS', [])
  set('sSelDS', [])

  let newDS = []

  switch (scenario) {
    case 'single':
    case 1:
      newDS = [makeDemoRunning(0, 1337, 'Running A')]
      break

    case 'four':
    case 2:
      newDS = [
        makeDemo(0, 1337, 'P1'),
        makeDemo(1, 2674, 'P2'),
        makeDemo(2, 5521, 'P3'),
        makeDemo(3, 8832, 'P4'),
      ]
      break

    case 'types':
      newDS = [
        makeDemoRunning(0, 4411, 'Running'),
        makeDemoCycling(1, 7722, 'Cycling'),
        makeDemoHIIT(2, 3355, 'HIIT'),
        makeDemoResting(3, 9988, 'Resting'),
        makeDemoSleep(4, 6644, 'Sleep'),
      ]
      break

    case 'longit':
      newDS = [makeLongitudinal(0, 2233, 'Athlete A', 30)]
      break

    case 'full':
      newDS = [
        makeDemoRunning(0, 4411, 'Running'),
        makeDemoCycling(1, 7722, 'Cycling'),
        makeDemoHIIT(2, 3355, 'HIIT'),
        makeDemoResting(3, 9988, 'Resting'),
        makeDemoSleep(4, 6644, 'Sleep'),
        makeLongitudinal(5, 2233, '30-Day', 30),
      ]
      break

    default:
      newDS = [
        makeDemo(0, 1337, 'P1'),
        makeDemo(1, 2674, 'P2'),
        makeDemo(2, 5521, 'P3'),
        makeDemo(3, 8832, 'P4'),
      ]
  }

  set('datasets', newDS)
  set('activeDS', newDS.map(d => d.id))
  set('sSelDS', newDS.map(d => d.id))

  updateTopbar()
  nav(section === 'upload' ? 'graph' : section)
}

// ── file upload ───────────────────────────────────────────────

function handleFile(file) {
  const reader = new FileReader()
  reader.onload = e => {
    const label = file.name.replace('export.xml', '').replace('.xml', '') || `DS${datasets.length + 1}`
    const ds = parseXML(e.target.result, label, datasets.length)
    if (!ds) { alert('No heart rate records found in this file.'); return }

    set('datasets', [...datasets, ds])
    set('activeDS', datasets.map(d => d.id))
    set('sSelDS', datasets.map(d => d.id))

    refreshDatasetList()
    updateTopbar()
  }
  reader.readAsText(file)
}

// ── remove ────────────────────────────────────────────────────

function removeDataset(id) {
  set('datasets', datasets.filter(d => d.id !== id))
  set('activeDS', activeDS.filter(x => x !== id))
  set('sSelDS', sSelDS.filter(x => x !== id))
  refreshDatasetList()
  updateTopbar()
}

// ── neon ──────────────────────────────────────────────────────

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

// ── customize panel toggle ───────────────────────────────────

function toggleCustomize() {
  const isOpen = custOpen === 'customize' || custOpen === 'live'
  const next   = isOpen ? false : 'customize'
  set('custOpen', next)
  document.getElementById('cust-btn')?.classList.toggle('on', !!next)
  if (section === 'graph') {
    const dr = document.getElementById('dash-right')
    if (dr) dr.classList.toggle('collapsed', !next)
    if (next) setPanelTab(next)
  }
}

// ── boot ─────────────────────────────────────────────────────

// defer one tick so the flex layout has resolved before Plotly measures it
setTimeout(() => loadDemoData('four'), 0)