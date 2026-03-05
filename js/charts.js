// charts.js — Plotly-based charting engine
// supports: line, area, scatter, histogram, box, violin, heatmap, regression

import {
  datasets, activeDS, charts, gMetric, gChartType, gSmooth,
  neonMode, theme, cmpM, set, MCFG, DNEON, DCOLS,
  custLineWidth, custMarkerSize, custOpacity, custShowGrid,
  custLogScale, custColorscale, custBinCount, custShowPoints,
  custNotched, custHorizontal, custTrendline, custShowCI,
  custLegendPos, custAxisTitle,
} from './state.js'
import { avg } from './stats.js'

// ── helpers ──────────────────────────────────────────────────

export function hexAlpha(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

export function dot(col) {
  return `<i style="display:inline-block;width:5px;height:5px;border-radius:50%;background:${col};flex-shrink:0"></i>`
}

function _themeColors() {
  const dark = theme !== 'light'
  return {
    paper:  dark ? 'rgba(6,6,10,0)'        : 'rgba(238,238,242,0)',
    plot:   dark ? 'rgba(6,6,10,0)'        : 'rgba(238,238,242,0)',
    grid:   dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)',
    text:   dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)',
    title:  dark ? 'rgba(255,255,255,0.7)'  : 'rgba(0,0,0,0.65)',
    zero:   dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)',
    hover:  dark ? '#0f0f14'                : '#f2f2f6',
    hText:  dark ? 'rgba(255,255,255,0.8)'  : 'rgba(0,0,0,0.75)',
  }
}

function _baseLayout(tc, extra) {
  const legendMap = {
    top:    { orientation: 'h', x: 0.5, xanchor: 'center', y: 1.06 },
    bottom: { orientation: 'h', x: 0.5, xanchor: 'center', y: -0.15 },
    right:  { orientation: 'v', x: 1.02, y: 1 },
    none:   false,
  }
  const showLegend = custLegendPos !== 'none'
  const legendCfg  = legendMap[custLegendPos] || legendMap.top

  return {
    paper_bgcolor: tc.paper,
    plot_bgcolor:  tc.plot,
    font: { family: "'Courier New', Courier, monospace", size: 10, color: tc.text },
    margin: { t: 28, r: 18, b: 42, l: 54 },
    legend: showLegend
      ? { ...legendCfg, font: { size: 9, color: tc.text }, bgcolor: 'rgba(0,0,0,0)', borderwidth: 0 }
      : false,
    showlegend: showLegend,
    ...extra,
  }
}

function _xAxis(tc, overrides) {
  return {
    gridcolor: custShowGrid ? tc.grid : 'rgba(0,0,0,0)',
    zerolinecolor: tc.zero,
    tickfont: { size: 9, family: "'Courier New', monospace", color: tc.text },
    title: { text: custAxisTitle || undefined, font: { size: 10, color: tc.title } },
    type: custLogScale ? 'log' : undefined,
    ...overrides,
  }
}

function _yAxis(tc, unit, overrides) {
  return {
    gridcolor: custShowGrid ? tc.grid : 'rgba(0,0,0,0)',
    zerolinecolor: tc.zero,
    tickfont: { size: 9, family: "'Courier New', monospace", color: tc.text },
    ticksuffix: unit ? ` ${unit}` : undefined,
    type: custLogScale ? 'log' : undefined,
    ...overrides,
  }
}

function _formatTime(sec) {
  return `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`
}

function _dsColor(ds, i) {
  if (neonMode) return DNEON[i % DNEON.length].c
  return ds.color
}

// ── main chart builder ───────────────────────────────────────

export function buildChart() {
  const container = document.getElementById('ga')
  if (!container) return

  // purge any existing plot
  const plotDiv = document.getElementById('plotly-chart')
  if (plotDiv) Plotly.purge(plotDiv)

  const m      = MCFG[gMetric]
  const active = datasets.filter(d => activeDS.includes(d.id) && d.metrics[gMetric])
  if (!active.length) return

  // ensure the plot div exists
  let el = document.getElementById('plotly-chart')
  if (!el) {
    el = document.createElement('div')
    el.id = 'plotly-chart'
    el.style.cssText = 'width:100%;height:100%;'
    // insert before the hint
    const hint = container.querySelector('.g-hint')
    if (hint) container.insertBefore(el, hint)
    else container.appendChild(el)
  }

  const tc   = _themeColors()
  const type = gChartType

  let data, layout, config

  switch (type) {
    case 'line':
    case 'area':
    case 'scatter':
      ({ data, layout } = _buildTimeSeries(active, m, tc, type))
      break
    case 'histogram':
      ({ data, layout } = _buildHistogram(active, m, tc))
      break
    case 'box':
      ({ data, layout } = _buildBox(active, m, tc))
      break
    case 'violin':
      ({ data, layout } = _buildViolin(active, m, tc))
      break
    case 'heatmap':
      ({ data, layout } = _buildHeatmap(active, m, tc))
      break
    case 'regression':
      ({ data, layout } = _buildRegression(active, m, tc))
      break
    default:
      ({ data, layout } = _buildTimeSeries(active, m, tc, 'line'))
  }

  config = {
    responsive: true,
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['lasso2d', 'select2d', 'sendDataToCloud'],
    toImageButtonOptions: { format: 'png', scale: 2 },
  }

  // neon glow effect via CSS filter on the container
  if (neonMode) {
    el.style.filter = 'drop-shadow(0 0 6px rgba(56,189,248,0.3))'
  } else {
    el.style.filter = ''
  }

  Plotly.newPlot(el, data, layout, config)
  set('charts', { ...charts, g: el })
}

// ── time series (line / area / scatter) ──────────────────────

function _buildTimeSeries(active, m, tc, style) {
  const traces = active.map((ds, i) => {
    const col  = _dsColor(ds, i)
    const pts  = ds.metrics[gMetric]
    const x    = pts.map(p => p.t)
    const y    = pts.map(p => p.v)

    const trace = {
      x, y,
      name: ds.label,
      type: 'scatter',
      mode: style === 'scatter' ? 'markers' : 'lines',
      line: {
        color: col,
        width: custLineWidth,
        shape: gSmooth ? 'spline' : 'linear',
      },
      marker: {
        color: col,
        size: style === 'scatter' ? custMarkerSize : 0,
        opacity: custOpacity,
      },
      opacity: custOpacity,
      hovertemplate: `<b>${ds.label}</b><br>%{customdata} — %{y:.1f} ${m.unit}<extra></extra>`,
      customdata: x.map(t => _formatTime(t)),
    }

    if (style === 'area') {
      trace.fill = 'tozeroy'
      trace.fillcolor = hexAlpha(col, 0.12)
    }

    return trace
  })

  const layout = _baseLayout(tc, {
    xaxis: _xAxis(tc, {
      tickvals: _timeTicks(active),
      ticktext: _timeTicks(active).map(t => _formatTime(t)),
    }),
    yaxis: _yAxis(tc, m.unit),
    hovermode: 'x unified',
    hoverlabel: { bgcolor: tc.hover, font: { family: "'Courier New', monospace", size: 10, color: tc.hText }, bordercolor: tc.grid },
  })

  return { data: traces, layout }
}

function _timeTicks(active) {
  const allT = active.flatMap(d => d.metrics[Object.keys(d.metrics)[0]]?.map(p => p.t) || [])
  const min  = Math.min(...allT)
  const max  = Math.max(...allT)
  const step = Math.max(60, Math.round((max - min) / 10 / 60) * 60)
  const ticks = []
  for (let t = Math.ceil(min / step) * step; t <= max; t += step) ticks.push(t)
  return ticks
}

// ── histogram ────────────────────────────────────────────────

function _buildHistogram(active, m, tc) {
  const traces = active.map((ds, i) => {
    const col = _dsColor(ds, i)
    const vals = ds.metrics[gMetric].map(p => p.v)
    return {
      x: vals,
      name: ds.label,
      type: 'histogram',
      marker: { color: hexAlpha(col, 0.55), line: { color: col, width: 1 } },
      opacity: 0.7,
      nbinsx: custBinCount || undefined,
      hovertemplate: `<b>${ds.label}</b><br>%{x:.1f} ${m.unit}<br>count: %{y}<extra></extra>`,
    }
  })

  const layout = _baseLayout(tc, {
    barmode: 'overlay',
    xaxis: _xAxis(tc, { title: { text: m.label + ' (' + m.unit + ')', font: { size: 10, color: tc.title } } }),
    yaxis: _yAxis(tc, null, { title: { text: 'Count', font: { size: 10, color: tc.title } } }),
    hovermode: 'closest',
  })

  return { data: traces, layout }
}

// ── box plot ─────────────────────────────────────────────────

function _buildBox(active, m, tc) {
  const orientation = custHorizontal ? 'h' : 'v'

  const traces = active.map((ds, i) => {
    const col  = _dsColor(ds, i)
    const vals = ds.metrics[gMetric].map(p => p.v)
    const base = {
      name: ds.label,
      type: 'box',
      marker: { color: col, outliercolor: col, size: 3 },
      line: { color: col, width: 1.5 },
      fillcolor: hexAlpha(col, 0.15),
      notched: custNotched,
      boxpoints: custShowPoints ? 'outliers' : false,
      jitter: 0.3,
      pointpos: -1.5,
    }
    if (orientation === 'h') {
      base.x = vals
      base.orientation = 'h'
    } else {
      base.y = vals
    }
    return base
  })

  const axCfg = { title: { text: m.label + ' (' + m.unit + ')', font: { size: 10, color: tc.title } } }
  const layout = _baseLayout(tc, {
    xaxis: _xAxis(tc, orientation === 'h' ? axCfg : {}),
    yaxis: _yAxis(tc, orientation === 'v' ? m.unit : null, orientation === 'v' ? axCfg : {}),
    hovermode: 'closest',
  })

  return { data: traces, layout }
}

// ── violin ───────────────────────────────────────────────────

function _buildViolin(active, m, tc) {
  const traces = active.map((ds, i) => {
    const col  = _dsColor(ds, i)
    const vals = ds.metrics[gMetric].map(p => p.v)
    return {
      y: vals,
      name: ds.label,
      type: 'violin',
      line: { color: col, width: 1.5 },
      fillcolor: hexAlpha(col, 0.15),
      meanline: { visible: true },
      box: { visible: custShowPoints },
      points: custShowPoints ? 'outliers' : false,
      jitter: 0.3,
      scalemode: 'width',
      hovertemplate: `<b>${ds.label}</b><br>%{y:.1f} ${m.unit}<extra></extra>`,
    }
  })

  const layout = _baseLayout(tc, {
    yaxis: _yAxis(tc, m.unit, { title: { text: m.label, font: { size: 10, color: tc.title } } }),
    hovermode: 'closest',
    violinmode: 'group',
  })

  return { data: traces, layout }
}

// ── heatmap ──────────────────────────────────────────────────

function _buildHeatmap(active, m, tc) {
  // Build a time-binned heatmap: rows = datasets, columns = time bins
  const binSize = 60 // 60-second bins
  const allT  = active.flatMap(d => d.metrics[gMetric].map(p => p.t))
  const tMin  = Math.min(...allT)
  const tMax  = Math.max(...allT)
  const nBins = Math.ceil((tMax - tMin) / binSize)

  const xLabels = Array.from({ length: nBins }, (_, i) => _formatTime(tMin + i * binSize))
  const yLabels = active.map(d => d.label)
  const z = active.map(ds => {
    const bins = new Array(nBins).fill(null)
    const counts = new Array(nBins).fill(0)
    ds.metrics[gMetric].forEach(p => {
      const idx = Math.min(Math.floor((p.t - tMin) / binSize), nBins - 1)
      bins[idx] = (bins[idx] || 0) + p.v
      counts[idx]++
    })
    return bins.map((sum, i) => counts[i] > 0 ? sum / counts[i] : null)
  })

  const trace = {
    x: xLabels,
    y: yLabels,
    z: z,
    type: 'heatmap',
    colorscale: custColorscale,
    colorbar: {
      title: { text: m.unit, font: { size: 9, color: tc.text } },
      tickfont: { size: 8, color: tc.text },
      thickness: 12,
      outlinewidth: 0,
    },
    hovertemplate: `%{y}<br>%{x}<br>%{z:.1f} ${m.unit}<extra></extra>`,
    xgap: 1,
    ygap: 1,
  }

  const layout = _baseLayout(tc, {
    xaxis: _xAxis(tc, { nticks: 15 }),
    yaxis: { tickfont: { size: 9, family: "'Courier New', monospace", color: tc.text }, automargin: true },
    hovermode: 'closest',
    margin: { t: 28, r: 80, b: 42, l: 80 },
  })

  return { data: [trace], layout }
}

// ── regression (scatter + trendline) ─────────────────────────

function _buildRegression(active, m, tc) {
  const traces = []

  active.forEach((ds, i) => {
    const col  = _dsColor(ds, i)
    const pts  = ds.metrics[gMetric]
    const x    = pts.map(p => p.t)
    const y    = pts.map(p => p.v)

    // scatter
    traces.push({
      x, y,
      name: ds.label,
      type: 'scatter',
      mode: 'markers',
      marker: { color: col, size: custMarkerSize, opacity: custOpacity * 0.7 },
      hovertemplate: `<b>${ds.label}</b><br>%{customdata} — %{y:.1f} ${m.unit}<extra></extra>`,
      customdata: x.map(t => _formatTime(t)),
    })

    if (custTrendline) {
      // OLS linear regression
      const n    = x.length
      const sx   = x.reduce((s, v) => s + v, 0)
      const sy   = y.reduce((s, v) => s + v, 0)
      const sxy  = x.reduce((s, v, j) => s + v * y[j], 0)
      const sxx  = x.reduce((s, v) => s + v * v, 0)
      const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx)
      const inter = (sy - slope * sx) / n

      // R-squared
      const yMean = sy / n
      const ssTot = y.reduce((s, v) => s + (v - yMean) ** 2, 0)
      const ssRes = y.reduce((s, v, j) => s + (v - (slope * x[j] + inter)) ** 2, 0)
      const r2    = 1 - ssRes / ssTot

      const xFit = [Math.min(...x), Math.max(...x)]
      const yFit = xFit.map(xv => slope * xv + inter)

      traces.push({
        x: xFit,
        y: yFit,
        name: `${ds.label} fit (R2=${r2.toFixed(3)})`,
        type: 'scatter',
        mode: 'lines',
        line: { color: col, width: 2, dash: 'dash' },
        hoverinfo: 'skip',
      })

      // confidence interval band
      if (custShowCI && n > 2) {
        const se = Math.sqrt(ssRes / (n - 2))
        const xMean = sx / n
        const nPts = 40
        const xRange = xFit[1] - xFit[0]
        const xCI = Array.from({ length: nPts }, (_, k) => xFit[0] + (k / (nPts - 1)) * xRange)
        const tVal = 1.96 // approximate for large n

        const yUpper = xCI.map(xv => {
          const yPred = slope * xv + inter
          const hii = 1 / n + (xv - xMean) ** 2 / (sxx - sx * sx / n)
          return yPred + tVal * se * Math.sqrt(hii)
        })
        const yLower = xCI.map(xv => {
          const yPred = slope * xv + inter
          const hii = 1 / n + (xv - xMean) ** 2 / (sxx - sx * sx / n)
          return yPred - tVal * se * Math.sqrt(hii)
        })

        traces.push({
          x: [...xCI, ...xCI.slice().reverse()],
          y: [...yUpper, ...yLower.slice().reverse()],
          fill: 'toself',
          fillcolor: hexAlpha(col, 0.08),
          line: { color: 'transparent' },
          type: 'scatter',
          mode: 'lines',
          name: `${ds.label} 95% CI`,
          showlegend: false,
          hoverinfo: 'skip',
        })
      }
    }
  })

  const layout = _baseLayout(tc, {
    xaxis: _xAxis(tc, {
      tickvals: _timeTicks(active),
      ticktext: _timeTicks(active).map(t => _formatTime(t)),
      title: { text: 'Time', font: { size: 10, color: tc.title } },
    }),
    yaxis: _yAxis(tc, m.unit, { title: { text: m.label, font: { size: 10, color: tc.title } } }),
    hovermode: 'closest',
  })

  return { data: traces, layout }
}

// ── stat strip below graph ───────────────────────────────────

export function buildStrip() {
  const el = document.getElementById('strip')
  if (!el) return

  const m      = MCFG[gMetric]
  const active = datasets.filter(d => activeDS.includes(d.id) && d.metrics[gMetric])
  if (!active.length) { el.innerHTML = ''; return }

  el.innerHTML = active.map(ds => {
    const v  = ds.metrics[gMetric].map(p => p.v)
    const mn = avg(v)
    const sd = Math.sqrt(v.reduce((s, x) => s + (x - mn) ** 2, 0) / v.length)
    return `
      <div class="sc">
        <div class="sc-l">${dot(ds.color)}${ds.label}</div>
        <div class="sc-v">${mn.toFixed(1)}<span style="font-size:9px;color:var(--dd)"> ${m.unit}</span></div>
        <div class="sc-s">peak ${Math.max(...v).toFixed(0)} | min ${Math.min(...v).toFixed(0)} | SD ${sd.toFixed(1)} | n=${v.length}</div>
      </div>`
  }).join('')
}

// ── compare bar chart ────────────────────────────────────────

export const CMPS = [
  { l: 'HR mean',  g: d => avg(d.metrics.hr?.map(p => p.v)) },
  { l: 'HR peak',  g: d => Math.max(...(d.metrics.hr?.map(p => p.v) || [0])) },
  { l: 'HR min',   g: d => Math.min(...(d.metrics.hr?.map(p => p.v) || [999])) },
  { l: 'HR range', g: d => { const v = d.metrics.hr?.map(p => p.v) || []; return Math.max(...v) - Math.min(...v) } },
  { l: 'HRV mean', g: d => avg(d.metrics.hrv?.map(p => p.v)) },
  { l: 'SpO2',    g: d => avg(d.metrics.spo2?.map(p => p.v)) },
  { l: 'Energy',   g: d => { const v = d.metrics.energy?.map(p => p.v) || []; return v.length ? v[v.length - 1] : null } },
]

export function buildCompare() {
  const container = document.getElementById('cc-wrap')
  if (!container) return

  // purge
  Plotly.purge(container)

  const m    = CMPS[cmpM]
  const vals = datasets.map(d => ({ d, v: m.g(d) })).filter(x => x.v !== null)
  if (vals.length < 2) return

  const tc = _themeColors()

  const trace = {
    x: vals.map(x => x.d.label),
    y: vals.map(x => x.v),
    type: 'bar',
    marker: {
      color: vals.map(x => hexAlpha(x.d.color, 0.45)),
      line: { color: vals.map(x => x.d.color), width: 1.5 },
    },
    hovertemplate: '%{x}<br>%{y:.3f}<extra></extra>',
  }

  const layout = _baseLayout(tc, {
    showlegend: false,
    xaxis: _xAxis(tc, {}),
    yaxis: _yAxis(tc, null),
    hovermode: 'closest',
    bargap: 0.25,
  })

  Plotly.newPlot(container, [trace], layout, { responsive: true, displayModeBar: false })

  // sidebar values
  const cv = document.getElementById('cv')
  const cd = document.getElementById('cd')
  const cs = document.getElementById('cs')

  if (cv) cv.innerHTML = vals.map(x => `
    <div style="display:flex;align-items:center;gap:7px;padding:5px 8px;border-radius:6px;background:var(--s2);border:1px solid var(--b);margin-bottom:3px">
      ${dot(x.d.color)}
      <span style="font-size:9px;font-weight:700;color:var(--d);flex:1;font-family:var(--mono)">${x.d.label}</span>
      <span style="font-family:var(--mono);font-size:11px;font-weight:700;color:var(--t)">${x.v.toFixed(2)}</span>
    </div>`).join('')

  if (cd) {
    let o = ''
    for (let i = 0; i < vals.length; i++)
      for (let j = i + 1; j < vals.length; j++) {
        const diff = vals[i].v - vals[j].v
        o += `<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:6px;background:var(--s2);border:1px solid var(--b);margin-bottom:3px">
          <span style="font-size:8px;font-weight:700;color:var(--dd);flex:1;font-family:var(--mono)">${vals[i].d.label} vs ${vals[j].d.label}</span>
          <span style="font-family:var(--mono);font-size:11px;font-weight:700;color:${diff > 0 ? '#f87171' : '#4ade80'}">${diff > 0 ? '+' : ''}${diff.toFixed(2)}</span>
        </div>`
      }
    cd.innerHTML = o
  }

  if (cs) {
    const vs = vals.map(x => x.v)
    const mn = Math.min(...vs), mx = Math.max(...vs)
    cs.innerHTML = `range: ${mn.toFixed(2)} - ${mx.toFixed(2)}<br>spread: ${((mx - mn) / mn * 100).toFixed(1)}%`
  }
}

// ── relayout helper (for live customization) ─────────────────

export function relayoutChart(updates) {
  const el = document.getElementById('plotly-chart')
  if (!el || !el.data) return
  Plotly.relayout(el, updates)
}

export function restyleChart(updates, traceIdx) {
  const el = document.getElementById('plotly-chart')
  if (!el || !el.data) return
  Plotly.restyle(el, updates, traceIdx)
}
