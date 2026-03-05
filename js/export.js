// export.js — PNG, GIF, video export + animation controllers

import {
  datasets, activeDS, gMetric, theme, animType, animFPS, animDuration, exportDPI,
  MCFG, set,
} from './state.js'
import { buildChart } from './charts.js'

// ── progress overlay ─────────────────────────────────────────

function _showProgress(msg) {
  let overlay = document.getElementById('export-overlay')
  if (!overlay) {
    overlay = document.createElement('div')
    overlay.id = 'export-overlay'
    overlay.className = 'export-overlay'
    document.body.appendChild(overlay)
  }
  overlay.innerHTML = `
    <div class="export-modal">
      <div class="export-spinner"></div>
      <div class="export-msg" id="export-msg">${msg}</div>
      <div class="export-bar-wrap">
        <div class="export-bar" id="export-bar" style="width:0%"></div>
      </div>
    </div>`
  overlay.style.display = 'flex'
}

function _updateProgress(pct, msg) {
  const bar = document.getElementById('export-bar')
  const txt = document.getElementById('export-msg')
  if (bar) bar.style.width = pct + '%'
  if (txt && msg) txt.textContent = msg
}

function _hideProgress() {
  const overlay = document.getElementById('export-overlay')
  if (overlay) overlay.style.display = 'none'
}

// ── PNG export (standard) ────────────────────────────────────

export function exportPNG() {
  const plotDiv = document.getElementById('plotly-chart')
  if (!plotDiv || !plotDiv.data) return

  Plotly.toImage(plotDiv, {
    format: 'png',
    width: plotDiv.clientWidth * 2,
    height: plotDiv.clientHeight * 2,
    scale: 2,
  }).then(url => {
    const a = document.createElement('a')
    a.download = `cv-tool-${Date.now()}.png`
    a.href = url
    a.click()
  })
}

// ── PNG Hi-Res (300 DPI, publication-ready) ──────────────────

export function exportPNGHiRes() {
  const plotDiv = document.getElementById('plotly-chart')
  if (!plotDiv || !plotDiv.data) return

  // publication column widths at 300 DPI
  const dpi = exportDPI || 300
  const widthInches = 7      // full-width figure
  const heightInches = 4.5
  const pxW = Math.round(widthInches * dpi)
  const pxH = Math.round(heightInches * dpi)

  _showProgress('Rendering hi-res PNG...')

  Plotly.toImage(plotDiv, {
    format: 'png',
    width: pxW,
    height: pxH,
    scale: 1,
  }).then(url => {
    _hideProgress()
    const a = document.createElement('a')
    a.download = `cv-tool-${dpi}dpi-${Date.now()}.png`
    a.href = url
    a.click()
  }).catch(() => _hideProgress())
}

// ── CSV export ───────────────────────────────────────────────

export function exportCSV() {
  if (!datasets.length) return
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
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = 'cv-tool-export.csv'
  a.click()
  URL.revokeObjectURL(a.href)
}

// ── Animated GIF export ──────────────────────────────────────

export async function exportGIF() {
  const plotDiv = document.getElementById('plotly-chart')
  if (!plotDiv || !plotDiv.data) return

  if (typeof GIF === 'undefined') {
    alert('GIF library not loaded. Please try again.')
    return
  }

  const active = datasets.filter(d => activeDS.includes(d.id) && d.metrics[gMetric])
  if (!active.length) return

  const fps = animFPS || 30
  const duration = (animDuration || 4) * 1000 // ms
  const totalFrames = Math.round((duration / 1000) * fps)
  const delay = Math.round(1000 / fps)

  _showProgress('Generating animated GIF...')

  const w = plotDiv.clientWidth
  const h = plotDiv.clientHeight

  const gif = new GIF({
    workers: 2,
    quality: 10,
    width: w,
    height: h,
    workerScript: 'https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js',
  })

  try {
    for (let frame = 0; frame < totalFrames; frame++) {
      const progress = frame / totalFrames

      // update the chart data based on animation type
      await _animateFrame(plotDiv, active, progress)

      // capture the frame using Plotly.toImage
      const imgUrl = await Plotly.toImage(plotDiv, {
        format: 'png',
        width: w,
        height: h,
        scale: 1,
      })

      // convert to image element
      const img = await _loadImage(imgUrl)
      gif.addFrame(img, { delay, copy: true })

      _updateProgress(Math.round((frame / totalFrames) * 90), `Rendering frame ${frame + 1}/${totalFrames}`)
    }

    // restore full chart
    buildChart()

    _updateProgress(95, 'Encoding GIF...')

    gif.on('finished', blob => {
      _hideProgress()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.download = `cv-tool-anim-${Date.now()}.gif`
      a.href = url
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    })

    gif.render()
  } catch (err) {
    _hideProgress()
    console.error('GIF export error:', err)
    alert('Failed to export GIF. Check console for details.')
    buildChart()
  }
}

// ── Video export (WebM) ──────────────────────────────────────

export async function exportVideo() {
  const plotDiv = document.getElementById('plotly-chart')
  if (!plotDiv || !plotDiv.data) return

  const active = datasets.filter(d => activeDS.includes(d.id) && d.metrics[gMetric])
  if (!active.length) return

  const fps = animFPS || 30
  const duration = (animDuration || 4) * 1000

  _showProgress('Recording video...')

  try {
    // create an offscreen canvas
    const w = plotDiv.clientWidth
    const h = plotDiv.clientHeight
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')

    const stream = canvas.captureStream(fps)
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 5000000,
    })

    const chunks = []
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }

    recorder.onstop = () => {
      _hideProgress()
      const blob = new Blob(chunks, { type: 'video/webm' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.download = `cv-tool-video-${Date.now()}.webm`
      a.href = url
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
      buildChart()
    }

    recorder.start()

    const totalFrames = Math.round((duration / 1000) * fps)
    const frameDelay = 1000 / fps

    for (let frame = 0; frame < totalFrames; frame++) {
      const progress = frame / totalFrames
      await _animateFrame(plotDiv, active, progress)

      // capture plotly as image and draw to canvas
      const imgUrl = await Plotly.toImage(plotDiv, { format: 'png', width: w, height: h, scale: 1 })
      const img = await _loadImage(imgUrl)
      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)

      _updateProgress(Math.round((frame / totalFrames) * 95), `Frame ${frame + 1}/${totalFrames}`)

      // throttle to roughly match framerate
      await _sleep(frameDelay * 0.3)
    }

    recorder.stop()
  } catch (err) {
    _hideProgress()
    console.error('Video export error:', err)
    alert('Failed to export video. Check console for details.')
    buildChart()
  }
}

// ── animation frame logic ────────────────────────────────────

async function _animateFrame(plotDiv, active, progress) {
  const m = MCFG[gMetric]
  const type = animType || 'draw'

  if (type === 'draw') {
    // progressive draw-in: show data up to progress * length
    const updates = {}
    active.forEach((ds, i) => {
      const pts = ds.metrics[gMetric]
      const n = Math.max(1, Math.round(pts.length * progress))
      const x = pts.slice(0, n).map(p => p.t)
      const y = pts.slice(0, n).map(p => p.v)
      if (!updates.x) { updates.x = []; updates.y = [] }
      updates.x.push(x)
      updates.y.push(y)
    })
    try { await Plotly.restyle(plotDiv, updates) } catch (e) {}

  } else if (type === 'slide') {
    // sliding window: fixed 60s window scrolling across
    const allPts = active.flatMap(d => d.metrics[gMetric])
    const tMin = Math.min(...allPts.map(p => p.t))
    const tMax = Math.max(...allPts.map(p => p.t))
    const windowSize = Math.min(120, (tMax - tMin) * 0.15)
    const windowStart = tMin + progress * (tMax - tMin - windowSize)
    const windowEnd = windowStart + windowSize

    try {
      await Plotly.relayout(plotDiv, {
        'xaxis.range': [windowStart, windowEnd],
      })
    } catch (e) {}

  } else if (type === 'morph') {
    // morph between first and second dataset
    if (active.length >= 2) {
      const ds1 = active[0].metrics[gMetric]
      const ds2 = active[1].metrics[gMetric]
      const n = Math.min(ds1.length, ds2.length)
      const y = Array.from({ length: n }, (_, i) => {
        return ds1[i].v * (1 - progress) + ds2[Math.min(i, ds2.length - 1)].v * progress
      })
      const x = ds1.slice(0, n).map(p => p.t)
      try {
        await Plotly.restyle(plotDiv, { x: [x], y: [y] }, [0])
      } catch (e) {}
    }
  }
}

// ── utilities ────────────────────────────────────────────────

function _loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

function _sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}
