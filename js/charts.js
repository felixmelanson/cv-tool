import { datasets, activeDS, charts, gMetric, gStyle, gSmooth, neonMode, theme, cmpM, set, MCFG, DNEON } from './state.js'
import { avg } from './stats.js'

export function hexAlpha(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

export function dot(col) {
  return `<i style="display:inline-block;width:5px;height:5px;border-radius:50%;background:${col};flex-shrink:0"></i>`
}

// ── time series chart ────────────────────────────────────────
export function buildChart() {
  const canvas = document.getElementById('gc')
  const area   = document.getElementById('ga')
  if (!canvas || !area) return

  canvas.width  = area.clientWidth
  canvas.height = area.clientHeight - 22

  const m      = MCFG[gMetric]
  const active = datasets.filter(d => activeDS.includes(d.id) && d.metrics[gMetric])
  if (!active.length) return

  // neon glow — canvas shadowBlur per dataset draw pass
  const neonPlugin = {
    id: 'neon',
    beforeDatasetDraw(chart, args) {
      if (!neonMode) return
      const col = DNEON[args.index % DNEON.length]
      chart.ctx.save()
      chart.ctx.shadowBlur  = 14
      chart.ctx.shadowColor = col.g
    },
    afterDatasetDraw(chart) {
      if (neonMode) chart.ctx.restore()
    },
  }

  const cjDS = active.map((ds, i) => {
    const col = neonMode ? DNEON[i % DNEON.length].c : ds.color
    return {
      label:                    ds.label,
      data:                     ds.metrics[gMetric].map(p => ({ x: p.t, y: p.v })),
      borderColor:              col,
      borderWidth:              neonMode ? 1.4 : 1.7,
      pointRadius:              gStyle === 'scatter' ? 1.5 : 0,
      pointHoverRadius:         4,
      pointHoverBackgroundColor: col,
      tension:                  gSmooth && gStyle !== 'scatter' ? 0.36 : 0,
      fill:                     gStyle === 'area',
      backgroundColor:          gStyle === 'area' ? hexAlpha(col, 0.1) : 'transparent',
    }
  })

  const gc  = theme === 'light' ? 'rgba(0,0,0,0.07)'         : 'rgba(255,255,255,0.045)'
  const tc  = theme === 'light' ? 'rgba(0,0,0,0.3)'          : 'rgba(255,255,255,0.22)'
  const tbg = theme === 'light' ? 'rgba(240,240,244,0.98)'   : 'rgba(6,6,10,0.97)'
  const tbc = theme === 'light' ? 'rgba(0,0,0,0.35)'         : 'rgba(255,255,255,0.3)'
  const tbo = theme === 'light' ? 'rgba(0,0,0,0.7)'          : 'rgba(255,255,255,0.7)'

  const chart = new Chart(canvas, {
    type: gStyle === 'scatter' ? 'scatter' : 'line',
    data: { datasets: cjDS },
    options: {
      responsive: false, maintainAspectRatio: false, parsing: false,
      animation: { duration: 650, easing: 'easeInOutQuart' },
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          type: 'linear',
          grid:  { color: gc, drawBorder: false },
          ticks: { color: tc, font: { size: 9, family: 'Courier New' }, maxTicksLimit: 10,
            callback: v => `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, '0')}` },
        },
        y: {
          grid:  { color: gc, drawBorder: false },
          ticks: { color: tc, font: { size: 9, family: 'Courier New' },
            callback: v => `${v} ${m.unit}` },
        },
      },
      plugins: {
        legend: { display: false },
        zoom:   { zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' }, pan: { enabled: true, mode: 'x' } },
        tooltip: {
          backgroundColor: tbg, borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1,
          titleFont: { size: 8, family: 'Courier New' }, titleColor: tbc,
          bodyFont:  { size: 10, family: 'Courier New' }, bodyColor: tbo,
          callbacks: {
            title: items => { const t = items[0].parsed.x; return `${Math.floor(t / 60)}m ${Math.round(t % 60)}s` },
            label: item  => ` ${item.dataset.label}: ${item.parsed.y.toFixed(1)} ${m.unit}`,
          },
        },
      },
    },
    plugins: [window.ChartZoom, neonPlugin],
  })

  set('charts', { ...charts, g: chart })
  canvas.addEventListener('dblclick', () => charts.g?.resetZoom())
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
        <div class="sc-s">↑${Math.max(...v).toFixed(0)} ↓${Math.min(...v).toFixed(0)} σ${sd.toFixed(1)} n=${v.length}</div>
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
  { l: 'SpO₂',   g: d => avg(d.metrics.spo2?.map(p => p.v)) },
  { l: 'Energy',   g: d => { const v = d.metrics.energy?.map(p => p.v) || []; return v.length ? v[v.length - 1] : null } },
]

export function buildCompare() {
  const canvas = document.getElementById('cc')
  if (!canvas) return

  const m    = CMPS[cmpM]
  const vals = datasets.map(d => ({ d, v: m.g(d) })).filter(x => x.v !== null)
  if (vals.length < 2) return

  const area = canvas.parentElement
  canvas.width  = area.clientWidth
  canvas.height = area.clientHeight

  const gc = theme === 'light' ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.04)'

  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels:   vals.map(x => x.d.label),
      datasets: [{
        data:            vals.map(x => x.v),
        backgroundColor: vals.map(x => hexAlpha(x.d.color, 0.32)),
        borderColor:     vals.map(x => x.d.color),
        borderWidth:     1.4,
        borderRadius:    5,
      }],
    },
    options: {
      responsive: false, maintainAspectRatio: false, animation: { duration: 380 },
      scales: {
        x: { grid: { display: false }, ticks: { color: theme === 'light' ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.38)', font: { size: 10, family: 'Courier New', weight: '700' } } },
        y: { grid: { color: gc }, ticks: { color: theme === 'light' ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.22)', font: { size: 9, family: 'Courier New' }, callback: v => v.toFixed(1) } },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: theme === 'light' ? 'rgba(240,240,244,0.98)' : 'rgba(6,6,10,0.97)',
          borderColor: 'rgba(255,255,255,0.07)', borderWidth: 1,
          bodyFont: { size: 10, family: 'Courier New' },
          bodyColor: theme === 'light' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)',
          callbacks: { label: i => ` ${i.parsed.y.toFixed(3)}` },
        },
      },
    },
  })

  set('charts', { ...charts, c: chart })

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
    cs.innerHTML = `range: ${mn.toFixed(2)} – ${mx.toFixed(2)}<br>spread: ${((mx - mn) / mn * 100).toFixed(1)}%`
  }
}