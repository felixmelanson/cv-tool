// ui.js — all rendering, nav, and UI logic

import { datasets, activeDS, charts, section, neonMode, theme,
         gMetric, gStyle, gSmooth, gChartType,
         sMetric, sTest, sSelDS, cmpM, custOpen,
         set, MCFG, CHART_TYPES } from './state.js'

import { buildChart, buildStrip, buildCompare, CMPS, dot, hexAlpha } from './charts.js'

import { avg, std, pfmt, efl, efPct, interpStr, percentile,
         wilcox, signTest, pairedT, mannWhitney, pearson, spearman,
         kruskalWallis, ksTest, cvmTest, linTrend, permutationTest,
         kendallTau, bootstrapCI } from './stats/index.js'

import { renderCustomizePanel, updateCustomizePanel } from './customize.js'

// ── nav ──────────────────────────────────────────────────────

export function nav(s) {
  set('section', s)
  document.querySelectorAll('.rb').forEach(b => b.classList.remove('on'))
  document.getElementById(`rb-${s}`)?.classList.add('on')
  killCharts()
  render()
}

export function killCharts() {
  // purge Plotly plots instead of Chart.js .destroy()
  const plotlyChart = document.getElementById('plotly-chart')
  if (plotlyChart) { try { Plotly.purge(plotlyChart) } catch (e) {} }
  const ccWrap = document.getElementById('cc-wrap')
  if (ccWrap) { try { Plotly.purge(ccWrap) } catch (e) {} }
  set('charts', {})
}

export function render() {
  const el = document.getElementById('main')
  el.innerHTML = ''
  const fns = { graph: rGraph, compare: rCompare, stats: rStats, metrics: rMetrics, upload: rUpload }
  fns[section]?.(el)
  updateTopbar()
}

export function updateTopbar() {
  const el = document.getElementById('tbst')
  if (!el) return
  if (!datasets.length) {
    el.innerHTML = `<span style="color:var(--dd);font-family:var(--mono);font-size:10px">no data -- load demo or upload xml</span>`
    return
  }
  el.innerHTML = datasets.map(d => `
    <span style="display:inline-flex;align-items:center;gap:5px;margin-right:12px;font-family:var(--mono)">
      <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${d.color};box-shadow:0 0 5px ${d.color}66;flex-shrink:0"></span>
      <span style="font-size:10px;font-weight:600;color:var(--t);letter-spacing:.04em">${d.label}</span>
      <span style="font-size:9px;color:var(--dd)">${d.metrics.hr?.length || 0}pts | ${Math.round(d.totalDur / 60)}min</span>
    </span>`).join('')
}

// ── chart type icon SVGs ─────────────────────────────────────

function _chartTypeIcon(key) {
  const icons = {
    line: '<polyline points="2 16 7 11 12 15 17 8 22 12" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    area: '<path d="M2 16 L7 11 L12 15 L17 8 L22 12 L22 20 L2 20Z" fill="currentColor" opacity="0.2" stroke="currentColor" stroke-width="1.5"/>',
    scatter: '<circle cx="5" cy="15" r="1.5" fill="currentColor"/><circle cx="9" cy="9" r="1.5" fill="currentColor"/><circle cx="14" cy="13" r="1.5" fill="currentColor"/><circle cx="18" cy="7" r="1.5" fill="currentColor"/><circle cx="12" cy="17" r="1.5" fill="currentColor"/>',
    histogram: '<rect x="2" y="12" width="4" height="8" rx="0.5" fill="currentColor" opacity="0.6"/><rect x="7" y="6" width="4" height="14" rx="0.5" fill="currentColor" opacity="0.6"/><rect x="12" y="9" width="4" height="11" rx="0.5" fill="currentColor" opacity="0.6"/><rect x="17" y="14" width="4" height="6" rx="0.5" fill="currentColor" opacity="0.6"/>',
    box: '<rect x="6" y="7" width="12" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="6" y1="12" x2="18" y2="12" stroke="currentColor" stroke-width="1.8"/><line x1="12" y1="3" x2="12" y2="7" stroke="currentColor" stroke-width="1.5"/><line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" stroke-width="1.5"/><line x1="9" y1="3" x2="15" y2="3" stroke="currentColor" stroke-width="1.5"/><line x1="9" y1="21" x2="15" y2="21" stroke="currentColor" stroke-width="1.5"/>',
    violin: '<path d="M12 2 C8 6 7 10 7 12 C7 14 8 18 12 22 C16 18 17 14 17 12 C17 10 16 6 12 2Z" fill="currentColor" opacity="0.15" stroke="currentColor" stroke-width="1.5"/>',
    heatmap: '<rect x="2" y="2" width="6" height="6" rx="1" fill="currentColor" opacity="0.2"/><rect x="9" y="2" width="6" height="6" rx="1" fill="currentColor" opacity="0.5"/><rect x="16" y="2" width="6" height="6" rx="1" fill="currentColor" opacity="0.8"/><rect x="2" y="9" width="6" height="6" rx="1" fill="currentColor" opacity="0.6"/><rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" opacity="0.3"/><rect x="16" y="9" width="6" height="6" rx="1" fill="currentColor" opacity="0.9"/><rect x="2" y="16" width="6" height="6" rx="1" fill="currentColor" opacity="0.4"/><rect x="9" y="16" width="6" height="6" rx="1" fill="currentColor" opacity="0.7"/><rect x="16" y="16" width="6" height="6" rx="1" fill="currentColor" opacity="0.15"/>',
    regression: '<circle cx="5" cy="16" r="1.3" fill="currentColor" opacity="0.5"/><circle cx="8" cy="13" r="1.3" fill="currentColor" opacity="0.5"/><circle cx="11" cy="14" r="1.3" fill="currentColor" opacity="0.5"/><circle cx="14" cy="10" r="1.3" fill="currentColor" opacity="0.5"/><circle cx="17" cy="8" r="1.3" fill="currentColor" opacity="0.5"/><circle cx="20" cy="6" r="1.3" fill="currentColor" opacity="0.5"/><line x1="3" y1="18" x2="22" y2="5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 2"/>',
  }
  return icons[key] || ''
}

// ── GRAPH ─────────────────────────────────────────────────────

function rGraph(el) {
  if (!datasets.length) {
    el.innerHTML = `
      <div class="empty-state">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" style="color:var(--dd)">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        <div style="font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--dd)">No data loaded</div>
        <div style="display:flex;gap:6px;margin-top:4px">
          <button class="tb-btn" style="height:28px" onclick="loadDemoData(2)">Load Demo</button>
          <button class="tb-btn" style="height:28px" onclick="nav('upload')">Upload XML</button>
        </div>
      </div>`
    return
  }

  const avail = Object.entries(MCFG).filter(([k]) => datasets.some(d => d.metrics[k]))
  const mBtns = avail.map(([k, m]) =>
    `<button onclick="setGMetric('${k}')" id="gm-${k}" class="m-btn ${gMetric === k ? 'on' : ''}">${m.label}</button>`
  ).join('')

  const dsChips = datasets.map(d =>
    `<div class="chip ${activeDS.includes(d.id) ? 'on' : ''}" id="gc-${d.id}" onclick="toggleDS(${d.id})">
      <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${d.color};box-shadow:0 0 5px ${d.color}88;flex-shrink:0"></span>
      ${d.label}
    </div>`
  ).join('')

  // chart type selector
  const chartTypeBtns = CHART_TYPES.map(ct =>
    `<button class="ct-btn ${gChartType === ct.key ? 'on' : ''}" onclick="setChartType('${ct.key}')" title="${ct.label}">
      <svg width="18" height="18" viewBox="0 0 24 24">${_chartTypeIcon(ct.key)}</svg>
      <span class="ct-label">${ct.label}</span>
    </button>`
  ).join('')

  el.innerHTML = `
    <div class="g-sect">
      <div class="phdr">
        <div class="phdr-accent"></div>
        <span class="phdr-title">Graph</span>
        <div style="flex:1;display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-left:8px">${dsChips}</div>
      </div>
      <div class="dash-split">
        <div class="dash-left">
          <div class="g-ctrl">
            <div style="display:flex;gap:4px;flex-wrap:wrap">${mBtns}</div>
            <div style="flex:1"></div>
            ${mkToggle('gsm', ['Raw', 'Smooth'], gSmooth ? 1 : 0, 'onGSmooth')}
          </div>
          <div class="chart-type-bar">${chartTypeBtns}</div>
          <div class="g-area" id="ga">
            <div id="plotly-chart" style="width:100%;height:100%"></div>
            <div class="g-hint">scroll to zoom | drag to pan | double-click to reset</div>
          </div>
          <div class="strip" id="strip"></div>
        </div>
        <div class="dash-right ${custOpen ? '' : 'collapsed'}" id="dash-right">
          <div class="panel-tabs">
            <button class="panel-tab ${!custOpen || custOpen === 'live' ? 'on' : ''}" onclick="setPanelTab('live')">Live Stats</button>
            <button class="panel-tab ${custOpen === 'customize' ? 'on' : ''}" onclick="setPanelTab('customize')">Customize</button>
          </div>
          <div class="live-panel ${custOpen === 'customize' ? 'hidden' : ''}" id="live-panel"></div>
          <div class="customize-panel ${custOpen !== 'customize' ? 'hidden' : ''}" id="customize-panel"></div>
        </div>
      </div>
    </div>`

  setTimeout(() => {
    buildChart()
    buildStrip()
    _buildLivePanel()
    renderCustomizePanel()
  }, 30)
}

function _buildLivePanel() {
  const el = document.getElementById('live-panel')
  if (!el) return
  const active = datasets.filter(d => activeDS.includes(d.id))
  if (!active.length) {
    el.innerHTML = `<div style="color:var(--dd);font-size:9px;padding:20px;text-align:center;font-family:var(--mono)">No active datasets</div>`
    return
  }
  const cfg = MCFG[gMetric]
  const physMax = { hr: 220, hrv: 120, spo2: 100, rr: 40, energy: 800, vo2: 70 }[gMetric]

  el.innerHTML = active.map(d => {
    const pts  = d.metrics[gMetric] || []
    if (!pts.length) return ''
    const vals = pts.map(p => p.v)
    const mn   = avg(vals)
    const mx   = Math.max(...vals)
    const mi   = Math.min(...vals)
    const sd   = Math.sqrt(vals.reduce((s, v) => s + (v - mn) ** 2, 0) / vals.length)
    const rpts = pts.slice(-Math.ceil(pts.length * 0.3))
    const hrr  = rpts.length > 1 ? rpts[0].v - rpts[rpts.length - 1].v : null
    const pmax = physMax || mx * 1.2

    const rows = [
      ['mean', mn?.toFixed(1), cfg.unit, Math.round((mn / pmax) * 100)],
      ['peak', mx?.toFixed(0), cfg.unit, Math.round((mx / pmax) * 100)],
      ['min', mi?.toFixed(0), cfg.unit, Math.round((mi / pmax) * 100)],
      ['SD', sd?.toFixed(2), cfg.unit, null],
    ]
    if (gMetric === 'hr' && hrr != null) rows.push(['HRR', hrr.toFixed(1), 'bpm', null])

    return `
      <div class="card" style="padding:11px">
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:10px">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${d.color};box-shadow:0 0 7px ${d.color}88;flex-shrink:0"></span>
          <span style="font-family:var(--mono);font-size:10px;font-weight:700;color:var(--t);letter-spacing:.06em">${d.label}</span>
          <span style="margin-left:auto;font-family:var(--mono);font-size:8px;color:var(--dd)">${pts.length} pts</span>
        </div>
        ${rows.map(([lbl, val, unit, pct]) => `
          <div class="lp-stat-row">
            <span class="lp-stat-label">${lbl}</span>
            <span>
              <span class="lp-stat-val" style="color:${d.color}">${val ?? '--'}</span>
              <span class="lp-stat-unit">${unit}</span>
            </span>
          </div>
          ${pct != null ? `<div class="lp-bar-wrap"><div class="lp-bar-fill" style="width:${pct}%;background:${d.color}88"></div></div>` : ''}
        `).join('')}
        ${gMetric === 'hr' ? `
          <div style="display:flex;justify-content:space-between;margin-top:8px;padding-top:7px;border-top:1px solid var(--b)">
            <div>
              <div class="lp-stat-label">rest</div>
              <div style="font-family:var(--mono);font-size:12px;font-weight:700;color:var(--t)">${d.rest} <span style="font-size:8px;color:var(--dd)">bpm</span></div>
            </div>
            <div style="text-align:right">
              <div class="lp-stat-label">peak</div>
              <div style="font-family:var(--mono);font-size:12px;font-weight:700;color:${d.color}">${d.peak} <span style="font-size:8px;color:var(--dd)">bpm</span></div>
            </div>
          </div>
          <div style="margin-top:8px"><div class="lp-bar-wrap" style="height:3px">
            <div class="lp-bar-fill" style="width:${Math.round((d.rest / d.peak) * 100)}%;background:linear-gradient(90deg,var(--dd),${d.color})"></div>
          </div></div>` : ''}
      </div>`
  }).join('')
}

export function refreshLivePanel() { _buildLivePanel() }

// graph control callbacks
export function onGSmooth(i) { set('gSmooth', i === 1); killCharts(); buildChart() }

export function setGMetric(k) {
  set('gMetric', k)
  document.querySelectorAll('[id^="gm-"]').forEach(b => {
    const on = b.id.replace('gm-', '') === k
    b.classList.toggle('on', on)
  })
  killCharts(); buildChart(); buildStrip(); _buildLivePanel()
}

export function setChartType(key) {
  set('gChartType', key)
  document.querySelectorAll('.ct-btn').forEach(b => {
    b.classList.toggle('on', b.getAttribute('onclick')?.includes(`'${key}'`))
  })
  killCharts(); buildChart(); buildStrip()
  updateCustomizePanel()
}

export function toggleDS(id) {
  const next = activeDS.includes(id) ? activeDS.filter(x => x !== id) : [...activeDS, id]
  set('activeDS', next)
  document.getElementById(`gc-${id}`)?.classList.toggle('on', next.includes(id))
  killCharts(); buildChart(); buildStrip(); _buildLivePanel()
}

export function setPanelTab(tab) {
  set('custOpen', tab)
  const liveEl = document.getElementById('live-panel')
  const custEl = document.getElementById('customize-panel')
  document.querySelectorAll('.panel-tab').forEach(b => b.classList.remove('on'))
  if (tab === 'customize') {
    liveEl?.classList.add('hidden')
    custEl?.classList.remove('hidden')
    document.querySelectorAll('.panel-tab')[1]?.classList.add('on')
    renderCustomizePanel()
  } else {
    custEl?.classList.add('hidden')
    liveEl?.classList.remove('hidden')
    document.querySelectorAll('.panel-tab')[0]?.classList.add('on')
  }
}

// ── COMPARE ──────────────────────────────────────────────────

function rCompare(el) {
  if (datasets.length < 2) { el.innerHTML = _emptyState('Load 2+ datasets to compare.'); return }

  const mBtns = CMPS.map((m, i) =>
    `<button id="cm-${i}" onclick="setCmpMetric(${i})" class="m-btn ${cmpM === i ? 'on' : ''}">${m.l}</button>`
  ).join('')

  el.innerHTML = `
    <div class="cmp-sect">
      <div class="phdr">
        <div class="phdr-accent"></div>
        <span class="phdr-title">Compare</span>
        <div style="display:flex;gap:5px;margin-left:8px;flex-wrap:wrap">${mBtns}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 270px;flex:1;min-height:0;overflow:hidden">
        <div style="padding:14px;display:flex;flex-direction:column;min-height:0;overflow:hidden">
          <div id="cc-wrap" style="flex:1;min-height:0"></div>
        </div>
        <div style="border-left:1px solid var(--b2);padding:14px;overflow-y:auto;display:flex;flex-direction:column;gap:10px">
          <div><div class="slbl">values</div><div id="cv"></div></div>
          <div><div class="slbl">differences</div><div id="cd"></div></div>
          <div id="cs" class="csm" style="font-size:9px;color:var(--d);font-family:var(--mono);line-height:1.8"></div>
        </div>
      </div>
    </div>`

  setTimeout(buildCompare, 30)
}

export function setCmpMetric(i) {
  set('cmpM', i)
  document.querySelectorAll('[id^="cm-"]').forEach((b, j) => b.classList.toggle('on', j === i))
  killCharts(); buildCompare()
}

// ── STATS ─────────────────────────────────────────────────────

export const SMS = [
  { l: 'HR mean',      g: d => avg(d.metrics.hr?.map(p => p.v)) },
  { l: 'HR peak',      g: d => d.peak },
  { l: 'HR min',       g: d => d.rest },
  { l: 'HR SD',        g: d => { const v = d.metrics.hr?.map(p => p.v) || []; const m = avg(v); return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length) } },
  { l: 'HR final 30%', g: d => { const v = d.metrics.hr || []; return avg(v.slice(-Math.ceil(v.length * .3)).map(p => p.v)) } },
  { l: 'HR reserve',   g: d => d.peak - d.rest },
  { l: 'HRV mean',     g: d => avg(d.metrics.hrv?.map(p => p.v)) },
  { l: 'SpO2 mean',   g: d => avg(d.metrics.spo2?.map(p => p.v)) },
  { l: 'Energy total', g: d => { const e = d.metrics.energy; return e?.length ? e[e.length - 1].v : null } },
]

export const STS = [
  { l: 'Wilcoxon signed-rank', paired: true, key: 'wilcox', note: 'Paired, nonparametric. Exact p for n <= 20.' },
  { l: 'Sign test',            paired: true, key: 'sign', note: 'Paired, nonparametric. Tests direction only -- most conservative.' },
  { l: 'Paired t-test',        paired: true, key: 'pairedT', note: 'Paired, parametric. Assumes differences are approximately normal.' },
  { l: 'Permutation test',     paired: true, key: 'perm', note: 'Paired, assumption-free. Randomly flips difference signs (B=5000).' },
  { l: 'Mann-Whitney U',       paired: false, key: 'mw', note: 'Independent samples. Tests P(X > Y) = 0.5. No normality assumed.' },
  { l: 'KS test',              paired: false, key: 'ks', note: 'Two-sample. Detects any shape difference (location, scale, skew).' },
  { l: 'Cramer-von Mises',     paired: false, key: 'cvm', note: 'Two-sample. Integrates ECDF differences -- more sensitive in tails.' },
  { l: 'Pearson r',            corr: true, key: 'pearson', note: 'Linear association on raw time-aligned values. Sensitive to outliers.' },
  { l: 'Spearman rho',         corr: true, key: 'spearman', note: 'Monotonic association on ranks. Robust to outliers.' },
  { l: 'Kendall tau',          corr: true, key: 'kendall', note: 'Rank correlation. More conservative than Spearman; preferred for small n.' },
  { l: 'Kruskal-Wallis H',     multi: true, key: 'kw', note: 'k-sample nonparametric ANOVA. Reports eta-squared effect size.' },
  { l: 'Linear trend',         single: true, key: 'trend', note: 'OLS slope on a single time series. Tests whether slope != 0.' },
]

function rStats(el) {
  if (datasets.length < 2) { el.innerHTML = _emptyState('Load 2+ datasets to run statistical tests.'); return }

  const chips = datasets.map(d => `
    <div class="chip ${sSelDS.includes(d.id) ? 'on' : ''}" id="sc-${d.id}" onclick="toggleStatDS(${d.id})">
      <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${d.color};flex-shrink:0"></span>
      ${d.label}
    </div>`).join('')

  const mRows = SMS.map((m, i) => `
    <div class="ritem ${sMetric === i ? 'on' : ''}" id="sm-${i}" onclick="setStatMetric(${i})">
      <input type="radio" name="sm" ${sMetric === i ? 'checked' : ''} style="accent-color:var(--acc);width:10px;height:10px;flex-shrink:0">
      <span>${m.l}</span>
    </div>`).join('')

  const testGroups = [
    { label: 'Paired',        range: [0, 3] },
    { label: 'Independent',   range: [4, 6] },
    { label: 'Correlation',   range: [7, 9] },
    { label: 'Multi / Trend', range: [10, 11] },
  ]

  const tRows = testGroups.map(g => `
    <div style="margin-bottom:6px">
      <div class="s-group-lbl">${g.label}</div>
      ${STS.slice(g.range[0], g.range[1] + 1).map((t, ri) => {
        const i = g.range[0] + ri
        return `<div class="ritem ${sTest === i ? 'on' : ''}" id="st-${i}" onclick="setStatTest(${i})">
          <input type="radio" name="st" ${sTest === i ? 'checked' : ''} style="accent-color:var(--acc);width:10px;height:10px;flex-shrink:0">
          <span>${t.l}</span>
        </div>`
      }).join('')}
    </div>`).join('')

  el.innerHTML = `
    <div class="s-sect">
      <div class="phdr">
        <div class="phdr-accent"></div>
        <span class="phdr-title">Stats Sandbox</span>
        <div style="display:flex;gap:4px;margin-left:8px;flex-wrap:wrap">${chips}</div>
      </div>
      <div style="display:flex;flex:1;min-height:0;overflow:hidden">
        <div class="s-ctrl">
          <div>
            <div class="slbl">Metric</div>
            <div style="display:flex;flex-direction:column;gap:3px">${mRows}</div>
          </div>
          <div class="hdiv"></div>
          <div>
            <div class="slbl">Test</div>
            ${tRows}
          </div>
          <button class="run-btn" onclick="runStats()">Run Test</button>
        </div>
        <div class="s-out" id="so">
          <div style="color:var(--dd);font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;padding-top:50px;text-align:center">
            Configure and run a test
          </div>
        </div>
      </div>
    </div>`
}

export function toggleStatDS(id) {
  const next = sSelDS.includes(id) ? sSelDS.filter(x => x !== id) : [...sSelDS, id]
  set('sSelDS', next)
  document.getElementById(`sc-${id}`)?.classList.toggle('on', next.includes(id))
}

export function setStatMetric(i) {
  set('sMetric', i)
  document.querySelectorAll('[id^="sm-"]').forEach((e, j) => e.classList.toggle('on', j === i))
}

export function setStatTest(i) {
  set('sTest', i)
  document.querySelectorAll('[id^="st-"]').forEach((e, j) => e.classList.toggle('on', j === i))
}

export function runStats() {
  const out = document.getElementById('so')
  if (!out) return

  const sel  = datasets.filter(d => sSelDS.includes(d.id))
  const test = STS[sTest]
  const m    = SMS[sMetric]

  if (sel.length < 2 && !test.single) { out.innerHTML = _errBlock('Select >= 2 datasets'); return }

  const vals = sel.map(d => ({ d, v: m.g(d) })).filter(x => x.v != null)

  let res, statStr, efVal, efType = 'r', ciData = null

  if (test.single) {
    const pts = sel[0].metrics.hr
    if (!pts?.length) { out.innerHTML = _errBlock('No HR data'); return }
    res     = linTrend(pts)
    statStr = `t(${res.df}) = ${res.t.toFixed(3)},  slope = ${(res.slope * 60).toFixed(3)} bpm/min,  R2 = ${res.r2.toFixed(3)}`
    efVal   = Math.sqrt(res.r2)

  } else if (test.corr) {
    const p1 = sel[0].metrics.hr || [], p2 = sel[1].metrics.hr || []
    const pairs = []
    p1.forEach(a => { const b = p2.find(p => Math.abs(p.t - a.t) < 15); if (b) pairs.push([a.v, b.v]) })
    if (pairs.length < 4) { out.innerHTML = _errBlock('Not enough overlapping timepoints'); return }
    const cx = pairs.map(p => p[0]), cy = pairs.map(p => p[1])
    if (test.key === 'pearson')       { res = pearson(cx, cy);    statStr = `r(${res.df}) = ${res.r.toFixed(4)},  t = ${res.t.toFixed(3)}`; efVal = res.r }
    else if (test.key === 'spearman') { res = spearman(cx, cy);   statStr = `rho(${res.df}) = ${res.r.toFixed(4)},  t = ${res.t.toFixed(3)}`; efVal = res.r }
    else                              { res = kendallTau(cx, cy); statStr = `tau = ${res.tau.toFixed(4)},  Z = ${res.Z.toFixed(3)},  n = ${res.n}`; efVal = res.tau }

  } else if (test.multi) {
    const groups = vals.map(x => sel.find(dd => dd.id === x.d.id)?.metrics.hr?.map(p => p.v) || [x.v])
    res     = kruskalWallis(groups)
    statStr = `H(${res.df}) = ${res.H.toFixed(3)},  p = ${pfmt(res.p)},  k = ${groups.length},  N = ${res.N}`
    efVal = res.eta2; efType = 'eta2'

  } else if (test.paired) {
    if (vals.length !== 2) { out.innerHTML = _errBlock('Paired tests require exactly 2 datasets'); return }
    const p1 = sel[0].metrics.hr?.map(p => p.v) || []
    const p2 = sel[1].metrics.hr?.map(p => p.v) || []
    const n = Math.min(p1.length, p2.length)
    const s1 = p1.slice(0, n), s2 = p2.slice(0, n)
    if (test.key === 'wilcox')       { res = wilcox(s1, s2);             statStr = `W+ = ${res.Wp.toFixed(1)},  W- = ${res.Wm.toFixed(1)},  n = ${res.n}`; efVal = res.r }
    else if (test.key === 'sign')    { res = signTest(s1, s2);           statStr = `k = ${res.k} / ${res.n} positive differences`; efVal = (2 * res.k / res.n - 1) }
    else if (test.key === 'pairedT') { res = pairedT(s1, s2);            statStr = `t(${res.df}) = ${res.t.toFixed(3)},  delta = ${res.mean.toFixed(2)},  SE = ${res.se.toFixed(2)}`; efVal = res.d; efType = 'd' }
    else                             { res = permutationTest(s1, s2, 5000); statStr = `delta = ${res.meanDiff.toFixed(3)},  d = ${res.d.toFixed(3)},  B = ${res.B}`; efVal = res.d; efType = 'd' }
    ciData = bootstrapCI(s1, s2, 1200)

  } else {
    if (vals.length !== 2) { out.innerHTML = _errBlock('Select exactly 2 datasets'); return }
    const p1 = sel[0].metrics.hr?.map(p => p.v) || []
    const p2 = sel[1].metrics.hr?.map(p => p.v) || []
    if (test.key === 'mw')       { res = mannWhitney(p1, p2); statStr = `U = ${res.U.toFixed(1)},  Z = ${res.Z.toFixed(3)},  n1 = ${res.nx},  n2 = ${res.ny}`; efVal = res.r }
    else if (test.key === 'ks')  { res = ksTest(p1, p2);      statStr = `D = ${res.D.toFixed(4)},  lambda = ${res.lambda.toFixed(3)},  n1 = ${res.nx},  n2 = ${res.ny}`; efVal = res.D * 2 - 1 }
    else                         { res = cvmTest(p1, p2);     statStr = `T = ${res.T.toFixed(4)},  Z = ${res.Z.toFixed(3)},  n1 = ${res.nx},  n2 = ${res.ny}`; efVal = Math.min(1, res.T * 3) }
  }

  _renderStatResult(out, { res, test, m, sel, vals, statStr, efVal, efType, ciData })
}

function _renderStatResult(out, { res, test, m, sel, vals, statStr, efVal, efType, ciData }) {
  const p = res.p
  const pc    = p < 0.05 ? '#4ade80' : p < 0.1 ? '#fbbf24' : '#f87171'
  const pcBg  = p < 0.05 ? 'rgba(74,222,128,.08)' : p < 0.1 ? 'rgba(251,191,36,.08)' : 'rgba(248,113,113,.08)'
  const pcBd  = p < 0.05 ? 'rgba(74,222,128,.18)' : p < 0.1 ? 'rgba(251,191,36,.18)' : 'rgba(248,113,113,.18)'
  const badge = p < 0.05
    ? '<span class="badge bg">significant</span>'
    : p < 0.1 ? '<span class="badge by">trend p < 0.10</span>'
    : '<span class="badge br">not significant</span>'

  const pPct   = Math.max(0, Math.min(100, ((Math.log10(Math.max(p, 0.001)) + 3) / 3) * 100))
  const efabs  = Math.abs(efVal || 0)
  const efPct2 = efPct(efabs, efType)
  const efLbl  = efl(efabs, efType)

  const dsSummary = sel.map(d => {
    const hr = d.metrics.hr?.map(p => p.v) || []
    const mn = avg(hr), sd2 = std(hr)
    const q1 = percentile(hr, 25), q3 = percentile(hr, 75)
    const mv = vals.find(x => x.d.id === d.id)?.v
    return `<tr>
      <td><div style="display:flex;align-items:center;gap:6px">
        <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${d.color}"></span>${d.label}
      </div></td>
      <td style="color:var(--t);font-weight:700">${mv?.toFixed(3) ?? '--'}</td>
      <td>${mn?.toFixed(1) ?? '--'}</td>
      <td>${sd2?.toFixed(2) ?? '--'}</td>
      <td>${q1?.toFixed(0) ?? '--'} - ${q3?.toFixed(0) ?? '--'}</td>
      <td>${hr.length}</td>
    </tr>`
  }).join('')

  const ciBlock = ciData ? (() => {
    const { lo, hi, mean } = ciData
    const span = Math.max(Math.abs(lo), Math.abs(hi)) * 2.2 || 1
    const toX  = v => 50 + (v / span) * 50
    const loX = toX(lo), hiX = toX(hi), mX = toX(mean)
    return `
      <div>
        <div class="slbl" style="margin-bottom:8px">Bootstrap 95% CI -- delta mean (B=1200)</div>
        <div style="position:relative;height:36px;background:var(--s2);border:1px solid var(--b2);border-radius:6px;overflow:hidden">
          <div style="position:absolute;left:50%;top:0;width:1px;height:100%;background:var(--b2)"></div>
          <div style="position:absolute;top:8px;height:20px;left:${loX}%;width:${hiX - loX}%;background:${pcBg};border:1px solid ${pcBd};border-radius:3px"></div>
          <div style="position:absolute;top:50%;left:${mX}%;width:5px;height:5px;border-radius:50%;background:${pc};transform:translate(-50%,-50%);box-shadow:0 0 6px ${pc}"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:4px;font-family:var(--mono);font-size:8px;color:var(--dd)">
          <span>${lo.toFixed(2)}</span>
          <span style="color:var(--d)">${mean.toFixed(2)}</span>
          <span>${hi.toFixed(2)}</span>
        </div>
      </div>`
  })() : ''

  out.innerHTML = `
    <div class="stat-result-enter">
      <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding-bottom:12px;border-bottom:1px solid var(--b2);margin-bottom:14px">
        <span style="font-size:10px;font-weight:700;color:var(--t);letter-spacing:.06em">${test.l}</span>
        <span style="color:var(--dd)">|</span>
        <span style="font-size:9px;color:var(--d);font-family:var(--mono)">${m.l}</span>
        <span style="color:var(--dd)">|</span>
        <span style="font-size:9px;color:var(--dd);font-family:var(--mono)">${sel.map(d => d.label).join(' vs ')}</span>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">
        <div class="rcard" style="background:${pcBg};border-color:${pcBd}">
          <div class="rl">p-value (2-tailed)</div>
          <div class="rv" style="color:${pc}">${pfmt(p)}</div>
          <div style="position:relative;height:3px;border-radius:2px;margin:9px 0 7px;background:linear-gradient(to right,#4ade80 0%,#4ade80 30%,#fbbf24 55%,#f87171 100%)">
            <div style="position:absolute;top:-3px;left:${pPct}%;width:2px;height:9px;background:white;border-radius:1px;transform:translateX(-50%);opacity:.9"></div>
          </div>
          ${badge}
        </div>

        <div class="rcard">
          <div class="rl">Effect size</div>
          <div class="rv">${efabs.toFixed(3)}</div>
          <div style="position:relative;margin:9px 0 4px">
            <div style="height:3px;border-radius:2px;display:flex;overflow:hidden">
              <div style="flex:1;background:rgba(56,189,248,0.2)"></div>
              <div style="flex:1;background:rgba(56,189,248,0.35);border-left:1px solid var(--b)"></div>
              <div style="flex:1;background:rgba(56,189,248,0.55);border-left:1px solid var(--b)"></div>
            </div>
            <div style="position:absolute;top:-3px;left:${efPct2}%;width:2px;height:9px;background:var(--acc);border-radius:1px;transform:translateX(-50%);box-shadow:0 0 5px var(--acc)"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-family:var(--mono);font-size:7px;color:var(--dd);letter-spacing:.08em;margin-bottom:5px">
            <span>small</span><span>med</span><span>large</span>
          </div>
          <span style="font-family:var(--mono);font-size:8px;font-weight:700;color:var(--dd)">${efLbl} (${efType})</span>
        </div>

        <div class="rcard">
          <div class="rl">Test</div>
          <div style="font-size:11px;font-weight:700;color:var(--t);font-family:var(--mono);line-height:1.4;margin-top:4px">${test.l}</div>
          <div style="font-family:var(--mono);font-size:8px;color:var(--dd);margin-top:5px">${
            test.single ? `n = ${res.n}` :
            test.multi  ? `k = ${sel.length} groups` :
            test.corr   ? `n = ${res.n} pairs` :
            test.paired ? `n = ${res.n || 0} pairs` :
            `n1 = ${res.nx ?? '?'}, n2 = ${res.ny ?? '?'}`
          }</div>
        </div>
      </div>

      <div class="cout"
><span style="color:var(--dd)">test    </span>${test.l}
<span style="color:var(--dd)">metric  </span>${m.l}
<span style="color:var(--dd)">stat    </span>${statStr}
<span style="color:var(--dd)">p =     </span><span style="color:${pc};font-weight:700">${pfmt(p)}</span>
<span style="color:var(--dd)">effect  </span>${efabs.toFixed(4)}  (${efLbl}, ${efType})${ciData ? `
<span style="color:var(--dd)">95% CI  </span>[${ciData.lo.toFixed(3)},  ${ciData.hi.toFixed(3)}]  (bootstrap B=1200)` : ''}
</div>

      ${ciBlock}

      <div class="csm" style="font-size:10px;color:var(--d);line-height:1.75">
        <strong style="color:var(--t)">Interpretation: </strong>${interpStr(p, efVal, efType)}
      </div>

      <div>
        <div class="slbl">Dataset summary</div>
        <table class="tbl">
          <thead><tr><th>Dataset</th><th>${m.l}</th><th>HR mean</th><th>HR SD</th><th>IQR</th><th>n</th></tr></thead>
          <tbody>${dsSummary}</tbody>
        </table>
      </div>

      <div style="padding:8px 11px;border-radius:6px;background:var(--s2);border:1px solid var(--b2)">
        <span style="font-family:var(--mono);font-size:7px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--dd)">Assumptions | </span>
        <span style="font-family:var(--mono);font-size:9px;color:var(--dd)">${test.note}</span>
      </div>
    </div>`
}

// ── METRICS ──────────────────────────────────────────────────

function rMetrics(el) {
  if (!datasets.length) { el.innerHTML = _emptyState('Load data first.'); return }

  el.innerHTML = '<div class="m-sect" id="mi"></div>'
  const inner = el.querySelector('#mi')

  datasets.forEach(ds => {
    const hr = ds.metrics.hr?.map(p => p.v) || []
    if (!hr.length) return

    const mn   = avg(hr)
    const sd   = Math.sqrt(hr.reduce((s, v) => s + (v - mn) ** 2, 0) / hr.length)
    const rp   = ds.metrics.hr?.slice(-Math.floor(ds.metrics.hr.length * 0.3)) || []
    const hrr1 = rp.length ? (rp[0].v - (rp.find(p => p.t >= (rp[0]?.t || 0) + 60)?.v || rp[0].v)) : 0
    const rmssd = hr.length > 1
      ? Math.sqrt(hr.slice(1).reduce((s, v, i) => s + (v - hr[i]) ** 2, 0) / (hr.length - 1))
      : null

    const rows = [
      ['HR mean',      `${mn.toFixed(1)} bpm`],
      ['HR peak',      `${Math.max(...hr)} bpm`],
      ['HR min',       `${Math.min(...hr).toFixed(0)} bpm`],
      ['HR SD',        `${sd.toFixed(2)} bpm`],
      ['HR reserve',   `${Math.max(...hr) - ds.rest} bpm`],
      ['HRR 1min',     hrr1 > 0 ? `${hrr1.toFixed(1)} bpm` : '--'],
      ['RMSSD approx', rmssd ? `${rmssd.toFixed(1)}` : '--'],
      ['VO2 Max',      ds.metrics.vo2?.[0] ? `${ds.metrics.vo2[0].v.toFixed(1)} mL/kg/min` : '--'],
      ['Duration',     `${Math.round(ds.totalDur / 60)} min`],
    ]

    const card = document.createElement('div')
    card.className = 'card'
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:11px">
        <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${ds.color};box-shadow:0 0 7px ${ds.color}"></span>
        <span style="font-family:var(--mono);font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--t)">${ds.label}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;font-family:var(--mono);font-size:10px">
        ${rows.map(([l, v]) => `
          <tr>
            <td style="padding:4px 0;color:var(--dd);width:55%">${l}</td>
            <td style="padding:4px 0;color:var(--t);text-align:right;font-weight:700">${v}</td>
          </tr>`).join('')}
      </table>`
    inner.appendChild(card)
  })
}

// ── UPLOAD ────────────────────────────────────────────────────

function rUpload(el) {
  el.innerHTML = `
    <div class="u-sect">
      <div style="max-width:640px;margin:0 auto">
        <div class="slbl" style="margin-bottom:11px">Apple Watch Health Export</div>
        <div class="uzone" id="uz" onclick="document.getElementById('fi').click()">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"
            style="margin:0 auto 9px;display:block;color:var(--dd)">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <div style="font-family:var(--font);font-size:9px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:var(--d);margin-bottom:3px">Drop export.xml here</div>
          <div style="font-family:var(--mono);font-size:8px;color:var(--dd);letter-spacing:.1em;text-transform:uppercase">click to browse | multiple files</div>
        </div>
        <input type="file" id="fi" accept=".xml" multiple style="display:none">

        <div style="margin-top:18px">
          <div class="slbl">Demo Scenarios</div>
          <div class="scenario-grid" id="scenario-grid"></div>
        </div>

        <div style="margin-top:18px">
          <div class="slbl">Loaded datasets</div>
          <div id="dsl"></div>
        </div>

        <div class="csm" style="margin-top:14px;font-family:var(--mono);font-size:9px;color:var(--dd);line-height:1.85">
          <span style="color:var(--d);font-weight:700">HOW TO EXPORT</span><br>
          Health app -> profile -> Export All Health Data -> export.zip -> unzip -> upload export.xml
        </div>
      </div>
    </div>`

  setTimeout(_initUpload, 20)
}

function _initUpload() {
  const uz = document.getElementById('uz')
  const fi = document.getElementById('fi')
  if (!uz || !fi) return
  uz.addEventListener('dragover', e => { e.preventDefault(); uz.classList.add('drag') })
  uz.addEventListener('dragleave', () => uz.classList.remove('drag'))
  uz.addEventListener('drop', e => { e.preventDefault(); uz.classList.remove('drag'); Array.from(e.dataTransfer.files).forEach(f => window.handleFile(f)) })
  fi.addEventListener('change', e => Array.from(e.target.files).forEach(f => window.handleFile(f)))

  _buildScenarioGrid()
  refreshDatasetList()
}

function _buildScenarioGrid() {
  const grid = document.getElementById('scenario-grid')
  if (!grid) return

  const scenarios = [
    { id: 'single',   label: 'Single Workout',   desc: '1 running session',       icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z' },
    { id: 'four',     label: '4 Participants',    desc: 'Multi-subject comparison', icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75' },
    { id: 'types',    label: 'Workout Types',     desc: 'Run / cycle / HIIT / rest / sleep', icon: 'M22 12h-4l-3 9L9 3l-3 9H2' },
    { id: 'longit',   label: 'Longitudinal',      desc: '30-day training trends',  icon: 'M3 3v18h18M8 17l4-6 4 3 5-7' },
    { id: 'full',     label: 'Full Suite',        desc: 'All datasets combined',   icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
  ]

  grid.innerHTML = scenarios.map(s => `
    <button class="scenario-card" onclick="loadDemoData('${s.id}')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--acc);flex-shrink:0">
        <path d="${s.icon}"/>
      </svg>
      <div style="flex:1;min-width:0">
        <div style="font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--t)">${s.label}</div>
        <div style="font-family:var(--mono);font-size:8px;color:var(--dd);margin-top:1px">${s.desc}</div>
      </div>
    </button>`).join('')
}

export function refreshDatasetList() {
  const el = document.getElementById('dsl')
  if (!el) return
  if (!datasets.length) {
    el.innerHTML = `<div style="padding:18px;text-align:center;font-family:var(--mono);color:var(--dd);font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase">No datasets loaded</div>`
    return
  }
  el.innerHTML = datasets.map(d => `
    <div style="display:flex;align-items:center;gap:9px;padding:7px 9px;border-radius:6px;background:var(--s2);border:1px solid var(--b);margin-bottom:4px">
      <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${d.color};box-shadow:0 0 6px ${d.color};flex-shrink:0"></span>
      <div style="flex:1;min-width:0">
        <div style="font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--t)">${d.label}</div>
        <div style="font-family:var(--mono);font-size:8px;color:var(--dd);margin-top:2px">
          ${d.metrics.hr?.length || 0} HR | ${Object.keys(d.metrics).length} metrics | ${Math.round(d.totalDur / 60)}min | rest ${d.rest} | peak ${d.peak}
        </div>
      </div>
      <button onclick="removeDataset(${d.id})" style="width:19px;height:19px;border-radius:4px;border:none;background:rgba(248,113,113,.08);color:#f87171;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0">x</button>
    </div>`).join('')
}

// ── glass toggle ──────────────────────────────────────────────

export function mkToggle(id, labels, activeIdx, cb) {
  const pw = 50 + Math.max(...labels.map(l => l.length)) * 4
  const bw = pw + 2
  const tw = bw * labels.length + 8
  return `
    <div class="gtog" id="gt-${id}" style="width:${tw}px">
      <div class="gpill" id="gp-${id}" style="width:${pw}px;transform:translateX(${activeIdx * (pw + 1)}px)"></div>
      ${labels.map((l, i) => `
        <button class="gbtn ${i === activeIdx ? 'on' : ''}" style="width:${bw}px"
          onclick="toggleClick('${id}',${i},'${cb}')">${l}</button>`).join('')}
    </div>`
}

export function toggleClick(id, idx, cb) {
  const wrap = document.getElementById(`gt-${id}`)
  const pill = document.getElementById(`gp-${id}`)
  if (!wrap || !pill) return
  const pw = pill.offsetWidth
  wrap.querySelectorAll('.gbtn').forEach((b, i) => b.classList.toggle('on', i === idx))
  pill.style.transform = `translateX(${idx * (pw + 1)}px)`
  if (window[cb]) window[cb](idx)
}

// ── export menu toggle ───────────────────────────────────────

export function toggleExportMenu() {
  const menu = document.getElementById('export-menu')
  if (!menu) return
  menu.classList.toggle('open')

  // close on outside click
  if (menu.classList.contains('open')) {
    const handler = (e) => {
      if (!document.getElementById('export-dd')?.contains(e.target)) {
        menu.classList.remove('open')
        document.removeEventListener('click', handler)
      }
    }
    setTimeout(() => document.addEventListener('click', handler), 10)
  }
}

// ── internals ─────────────────────────────────────────────────

function _emptyState(msg, actions = '') {
  return `
    <div class="empty-state">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" style="color:var(--dd)">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
      <div style="font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:var(--dd)">${msg}</div>
      ${actions}
    </div>`
}

function _errBlock(msg) {
  return `<div style="font-family:var(--mono);color:var(--dd);font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;padding-top:20px">${msg}</div>`
}
