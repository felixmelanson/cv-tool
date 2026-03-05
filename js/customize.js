// customize.js — right-side customization panel for chart appearance
// all controls call Plotly.relayout() / restyle() for live updates

import {
  gChartType, set,
  custLineWidth, custMarkerSize, custOpacity, custShowGrid,
  custLogScale, custColorscale, custBinCount, custShowPoints,
  custNotched, custHorizontal, custTrendline, custShowCI,
  custLegendPos, custAxisTitle,
} from './state.js'

import { buildChart, relayoutChart, restyleChart } from './charts.js'

// ── render ───────────────────────────────────────────────────

export function renderCustomizePanel() {
  const el = document.getElementById('customize-panel')
  if (!el) return

  const type = gChartType

  // build sections based on chart type
  let html = ''

  // axes section (always shown)
  html += _section('Axes', `
    <div class="cust-row">
      <label class="cust-label">Axis title</label>
      <input class="cust-input" type="text" value="${custAxisTitle}" placeholder="Auto"
        oninput="window._custSet('custAxisTitle', this.value)">
    </div>
    <div class="cust-row">
      <label class="cust-label">Grid lines</label>
      <label class="cust-toggle">
        <input type="checkbox" ${custShowGrid ? 'checked' : ''} onchange="window._custSet('custShowGrid', this.checked)">
        <span class="cust-toggle-track"><span class="cust-toggle-thumb"></span></span>
      </label>
    </div>
    <div class="cust-row">
      <label class="cust-label">Log scale</label>
      <label class="cust-toggle">
        <input type="checkbox" ${custLogScale ? 'checked' : ''} onchange="window._custSet('custLogScale', this.checked)">
        <span class="cust-toggle-track"><span class="cust-toggle-thumb"></span></span>
      </label>
    </div>
  `)

  // appearance section
  if (['line', 'area', 'scatter', 'regression'].includes(type)) {
    html += _section('Appearance', `
      <div class="cust-row">
        <label class="cust-label">Line width</label>
        <div class="cust-slider-wrap">
          <input type="range" class="cust-slider" min="0.5" max="5" step="0.5" value="${custLineWidth}"
            oninput="window._custSet('custLineWidth', +this.value); this.nextElementSibling.textContent=this.value">
          <span class="cust-slider-val">${custLineWidth}</span>
        </div>
      </div>
      <div class="cust-row">
        <label class="cust-label">Marker size</label>
        <div class="cust-slider-wrap">
          <input type="range" class="cust-slider" min="1" max="12" step="1" value="${custMarkerSize}"
            oninput="window._custSet('custMarkerSize', +this.value); this.nextElementSibling.textContent=this.value">
          <span class="cust-slider-val">${custMarkerSize}</span>
        </div>
      </div>
      <div class="cust-row">
        <label class="cust-label">Opacity</label>
        <div class="cust-slider-wrap">
          <input type="range" class="cust-slider" min="0.1" max="1" step="0.05" value="${custOpacity}"
            oninput="window._custSet('custOpacity', +this.value); this.nextElementSibling.textContent=this.value">
          <span class="cust-slider-val">${custOpacity}</span>
        </div>
      </div>
    `)
  }

  // histogram options
  if (type === 'histogram') {
    html += _section('Histogram', `
      <div class="cust-row">
        <label class="cust-label">Bin count (0 = auto)</label>
        <div class="cust-slider-wrap">
          <input type="range" class="cust-slider" min="0" max="80" step="5" value="${custBinCount}"
            oninput="window._custSet('custBinCount', +this.value); this.nextElementSibling.textContent=this.value||'auto'">
          <span class="cust-slider-val">${custBinCount || 'auto'}</span>
        </div>
      </div>
    `)
  }

  // box plot options
  if (type === 'box') {
    html += _section('Box Plot', `
      <div class="cust-row">
        <label class="cust-label">Show outlier points</label>
        <label class="cust-toggle">
          <input type="checkbox" ${custShowPoints ? 'checked' : ''} onchange="window._custSet('custShowPoints', this.checked)">
          <span class="cust-toggle-track"><span class="cust-toggle-thumb"></span></span>
        </label>
      </div>
      <div class="cust-row">
        <label class="cust-label">Notched</label>
        <label class="cust-toggle">
          <input type="checkbox" ${custNotched ? 'checked' : ''} onchange="window._custSet('custNotched', this.checked)">
          <span class="cust-toggle-track"><span class="cust-toggle-thumb"></span></span>
        </label>
      </div>
      <div class="cust-row">
        <label class="cust-label">Horizontal</label>
        <label class="cust-toggle">
          <input type="checkbox" ${custHorizontal ? 'checked' : ''} onchange="window._custSet('custHorizontal', this.checked)">
          <span class="cust-toggle-track"><span class="cust-toggle-thumb"></span></span>
        </label>
      </div>
    `)
  }

  // violin options
  if (type === 'violin') {
    html += _section('Violin', `
      <div class="cust-row">
        <label class="cust-label">Show inner box</label>
        <label class="cust-toggle">
          <input type="checkbox" ${custShowPoints ? 'checked' : ''} onchange="window._custSet('custShowPoints', this.checked)">
          <span class="cust-toggle-track"><span class="cust-toggle-thumb"></span></span>
        </label>
      </div>
    `)
  }

  // heatmap options
  if (type === 'heatmap') {
    const scales = ['Viridis', 'Plasma', 'Inferno', 'Cividis', 'YlGnBu', 'RdBu', 'Hot', 'Greys']
    html += _section('Heatmap', `
      <div class="cust-row">
        <label class="cust-label">Color scale</label>
        <select class="cust-select" onchange="window._custSet('custColorscale', this.value)">
          ${scales.map(s => `<option value="${s}" ${custColorscale === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
    `)
  }

  // regression options
  if (type === 'regression') {
    html += _section('Regression', `
      <div class="cust-row">
        <label class="cust-label">Show trendline</label>
        <label class="cust-toggle">
          <input type="checkbox" ${custTrendline ? 'checked' : ''} onchange="window._custSet('custTrendline', this.checked)">
          <span class="cust-toggle-track"><span class="cust-toggle-thumb"></span></span>
        </label>
      </div>
      <div class="cust-row">
        <label class="cust-label">Show 95% CI band</label>
        <label class="cust-toggle">
          <input type="checkbox" ${custShowCI ? 'checked' : ''} onchange="window._custSet('custShowCI', this.checked)">
          <span class="cust-toggle-track"><span class="cust-toggle-thumb"></span></span>
        </label>
      </div>
    `)
  }

  // layout section (always shown)
  const legendOpts = ['top', 'bottom', 'right', 'none']
  html += _section('Layout', `
    <div class="cust-row">
      <label class="cust-label">Legend position</label>
      <select class="cust-select" onchange="window._custSet('custLegendPos', this.value)">
        ${legendOpts.map(o => `<option value="${o}" ${custLegendPos === o ? 'selected' : ''}>${o}</option>`).join('')}
      </select>
    </div>
  `)

  el.innerHTML = html
}

export function updateCustomizePanel() {
  renderCustomizePanel()
}

// ── internal helpers ─────────────────────────────────────────

function _section(title, content) {
  return `
    <div class="cust-section">
      <div class="cust-section-title">${title}</div>
      ${content}
    </div>`
}

// ── global handler for customization changes ─────────────────

window._custSet = function (key, val) {
  set(key, val)
  // rebuild the chart with the new settings
  const plotDiv = document.getElementById('plotly-chart')
  if (plotDiv) {
    try { Plotly.purge(plotDiv) } catch (e) {}
  }
  buildChart()
}
