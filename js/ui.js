import { datasets, activeDS, charts, section, neonMode, theme, gMetric, gStyle, gSmooth, sMetric, sTest, sSelDS, cmpM, set, MCFG } from './state.js'
import { buildChart, buildStrip, buildCompare, CMPS, dot, hexAlpha } from './charts.js'
import { avg, pfmt, efl, interpStr, wilcox, signTest, pairedT, mannWhitney, pearson, spearman, kruskalWallis, bootstrapCI } from './stats.js'

// ── nav ──────────────────────────────────────────────────────
export function nav(s) {
  set('section', s)
  document.querySelectorAll('.rb').forEach(b => b.classList.remove('on'))
  document.getElementById(`rb-${s}`)?.classList.add('on')
  killCharts()
  render()
}
// seeded RNG always produces identical data
export function killCharts() {
  Object.values(charts).forEach(c => { try { c.destroy() } catch (e) {} })
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
  if (!datasets.length) {
    el.innerHTML = 'no data — <span style="color:var(--ddd)">load demo or upload xml</span>'
    return
  }
  el.innerHTML = datasets.map(d => `
    <span style="display:inline-flex;align-items:center;gap:4px;margin-right:10px">
      ${dot(d.color)}${d.label}
      <span style="color:var(--ddd);margin-left:2px">${d.metrics.hr?.length || 0}pts</span>
    </span>`).join('')
}

// ── GRAPH ────────────────────────────────────────────────────
function rGraph(el) {
  if (!datasets.length) {
    el.innerHTML = emptyState(
      'Load demo data or upload XML to get started.',
      `<button class="tb-btn" style="height:30px" onclick="loadDemoData(2)">Load Demo</button>
       <button class="tb-btn" style="height:30px;margin-left:5px" onclick="nav('upload')">Upload XML</button>`
    )
    return
  }

  const avail  = Object.entries(MCFG).filter(([k]) => datasets.some(d => d.metrics[k]))
  const mBtns  = avail.map(([k, m]) => `
    <button onclick="setGMetric('${k}')" id="gm-${k}" style="
      padding:3px 8px;border-radius:5px;
      border:1px solid ${gMetric === k ? 'var(--b2)' : 'var(--b)'};
      background:${gMetric === k ? 'var(--b)' : 'var(--s2)'};
      color:${gMetric === k ? 'var(--t)' : 'var(--dd)'};
      font-size:8px;font-weight:700;letter-spacing:.11em;text-transform:uppercase;
      cursor:pointer;font-family:var(--font);transition:all .12s">
      ${m.label}
    </button>`).join('')

  const dsChips = datasets.map(d => `
    <div class="chip ${activeDS.includes(d.id) ? 'on' : ''}" id="gc-${d.id}" onclick="toggleDS(${d.id})">
      ${dot(d.color)}${d.label}
    </div>`).join('')

  el.innerHTML = `
    <div class="g-sect">
      <div class="g-ctrl">
        <div style="display:flex;gap:5px;flex-wrap:wrap">${dsChips}</div>
        <div style="width:1px;height:20px;background:var(--b)"></div>
        <div style="display:flex;gap:5px;flex-wrap:wrap">${mBtns}</div>
        <div style="width:1px;height:20px;background:var(--b)"></div>
        ${mkToggle('gst', ['Line', 'Area', 'Scatter'], ['line', 'area', 'scatter'].indexOf(gStyle), 'onGStyle')}
        ${mkToggle('gsm', ['Raw', 'Smooth'], gSmooth ? 1 : 0, 'onGSmooth')}
      </div>
      <div class="g-area" id="ga">
        <canvas id="gc"></canvas>
        <div class="g-hint">scroll=zoom · drag=pan · dbl=reset</div>
      </div>
      <div class="strip" id="strip"></div>
    </div>`

  setTimeout(() => { buildChart(); buildStrip() }, 30)
}

// graph control callbacks — exposed to window in main.js
export function onGStyle(i)  { set('gStyle', ['line', 'area', 'scatter'][i]); killCharts(); buildChart() }
export function onGSmooth(i) { set('gSmooth', i === 1); killCharts(); buildChart() }

export function setGMetric(k) {
  set('gMetric', k)
  document.querySelectorAll('[id^="gm-"]').forEach(b => {
    const bk = b.id.replace('gm-', '')
    b.style.background  = bk === k ? 'var(--b)'  : 'var(--s2)'
    b.style.borderColor = bk === k ? 'var(--b2)' : 'var(--b)'
    b.style.color       = bk === k ? 'var(--t)'  : 'var(--dd)'
  })
  killCharts(); buildChart(); buildStrip()
}

export function toggleDS(id) {
  const next = activeDS.includes(id)
    ? activeDS.filter(x => x !== id)
    : [...activeDS, id]
  set('activeDS', next)
  document.getElementById(`gc-${id}`)?.classList.toggle('on', next.includes(id))
  killCharts(); buildChart(); buildStrip()
}

// ── COMPARE ─────────────────────────────────────────────────
function rCompare(el) {
  if (datasets.length < 2) { el.innerHTML = emptyState('Load 2+ datasets to compare.'); return }

  const mBtns = CMPS.map((m, i) => `
    <button id="cm-${i}" onclick="setCmpMetric(${i})" style="
      padding:3px 8px;border-radius:5px;
      border:1px solid ${cmpM === i ? 'var(--b2)' : 'var(--b)'};
      background:${cmpM === i ? 'var(--b)' : 'var(--s2)'};
      color:${cmpM === i ? 'var(--t)' : 'var(--dd)'};
      font-size:8px;font-weight:700;letter-spacing:.11em;text-transform:uppercase;
      cursor:pointer;font-family:var(--font);transition:all .12s">
      ${m.l}
    </button>`).join('')

  el.innerHTML = `
    <div class="cmp-sect">
      <div class="shdr">
        <span class="shdr-title">Compare</span>
        <div style="display:flex;gap:5px;margin-left:8px;flex-wrap:wrap">${mBtns}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 270px;flex:1;min-height:0;overflow:hidden">
        <div style="padding:14px;display:flex;flex-direction:column;min-height:0;overflow:hidden">
          <div style="flex:1;min-height:0"><canvas id="cc" style="width:100%;height:100%"></canvas></div>
        </div>
        <div style="border-left:1px solid var(--b);padding:14px;overflow-y:auto;display:flex;flex-direction:column;gap:10px">
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
  document.querySelectorAll('[id^="cm-"]').forEach((b, j) => {
    b.style.background  = j === i ? 'var(--b)'  : 'var(--s2)'
    b.style.borderColor = j === i ? 'var(--b2)' : 'var(--b)'
    b.style.color       = j === i ? 'var(--t)'  : 'var(--dd)'
  })
  killCharts(); buildCompare()
}

// ── STATS ────────────────────────────────────────────────────
export const SMS = [
  { l: 'HR mean',      g: d => avg(d.metrics.hr?.map(p => p.v)) },
  { l: 'HR peak',      g: d => Math.max(...(d.metrics.hr?.map(p => p.v) || [0])) },
  { l: 'HR final 10%', g: d => { const v = (d.metrics.hr || []).slice(-Math.ceil((d.metrics.hr || []).length * 0.1)).map(p => p.v); return avg(v) } },
  { l: 'HR SD',        g: d => { const v = d.metrics.hr?.map(p => p.v) || [], m = avg(v); return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length) } },
  { l: 'HRV mean',     g: d => avg(d.metrics.hrv?.map(p => p.v)) },
  { l: 'SpO₂ mean',   g: d => avg(d.metrics.spo2?.map(p => p.v)) },
]

export const STS = [
  { l: 'Wilcoxon signed-rank', paired: true,  corr: false },
  { l: 'Sign test',            paired: true,  corr: false },
  { l: 'Paired t-test',        paired: true,  corr: false },
  { l: 'Mann–Whitney U',       paired: false, corr: false },
  { l: 'Pearson r',            paired: false, corr: true  },
  { l: 'Spearman ρ',           paired: false, corr: true  },
  { l: 'Kruskal–Wallis H',     paired: false, corr: false, multi: true },
]

function rStats(el) {
  if (datasets.length < 2) { el.innerHTML = emptyState('Load 2+ datasets to run statistical tests.'); return }

  const chips = datasets.map(d => `
    <div class="chip ${sSelDS.includes(d.id) ? 'on' : ''}" id="sc-${d.id}" onclick="toggleStatDS(${d.id})">
      ${dot(d.color)}${d.label}
    </div>`).join('')

  const mRows = SMS.map((m, i) => `
    <div class="ritem ${sMetric === i ? 'on' : ''}" id="sm-${i}" onclick="setStatMetric(${i})">
      <input type="radio" name="sm" ${sMetric === i ? 'checked' : ''} style="accent-color:var(--acc);width:10px;height:10px;flex-shrink:0">
      <span>${m.l}</span>
    </div>`).join('')

  const tRows = STS.map((t, i) => `
    <div class="ritem ${sTest === i ? 'on' : ''}" id="st-${i}" onclick="setStatTest(${i})">
      <input type="radio" name="st" ${sTest === i ? 'checked' : ''} style="accent-color:var(--acc);width:10px;height:10px;flex-shrink:0">
      <span>${t.l}</span>
    </div>`).join('')

  el.innerHTML = `
    <div class="s-sect">
      <div class="shdr">
        <span class="shdr-title">Stats Sandbox</span>
        <div style="display:flex;gap:4px;margin-left:8px;flex-wrap:wrap">${chips}</div>
      </div>
      <div style="display:flex;flex:1;min-height:0;overflow:hidden">
        <div class="s-ctrl">
          <div>
            <div class="slbl">Metric</div>
            <div style="display:flex;flex-direction:column;gap:3px">${mRows}</div>
          </div>
          <div>
            <div class="slbl">Test</div>
            <div style="display:flex;flex-direction:column;gap:3px">${tRows}</div>
          </div>
          <button onclick="runStats()"
            style="padding:7px;border-radius:7px;border:1px solid var(--b2);background:var(--s2);
            color:var(--d);font-size:8px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;
            cursor:pointer;font-family:var(--font);transition:all .12s;width:100%"
            onmouseover="this.style.background='var(--b)';this.style.color='var(--t)'"
            onmouseout="this.style.background='var(--s2)';this.style.color='var(--d)'">
            Run Test ▶
          </button>
        </div>
        <div class="s-out" id="so">
          <div style="color:var(--dd);font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;padding-top:40px;text-align:center">
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

  const sel = datasets.filter(d => sSelDS.includes(d.id))
  if (sel.length < 2) {
    out.innerHTML = `<div style="color:var(--dd);font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em">Select ≥ 2 datasets</div>`
    return
  }

  const m    = SMS[sMetric]
  const test = STS[sTest]
  const vals = sel.map(d => ({ d, v: m.g(d) })).filter(x => x.v !== null)

  if (vals.length < 2) {
    out.innerHTML = `<div style="color:var(--dd);font-size:9px">Metric not available for selected datasets</div>`
    return
  }

  let pVal, efStr, statStr, ciStr = '', interp = ''

  if (test.corr) {
    const p1 = sel[0].metrics.hr || [], p2 = sel[1].metrics.hr || []
    const pairs = []
    p1.forEach(a => { const b = p2.find(p => Math.abs(p.t - a.t) < 15); if (b) pairs.push([a.v, b.v]) })
    if (pairs.length < 4) { out.innerHTML = `<div style="color:var(--dd);font-size:9px">Not enough overlapping timepoints</div>`; return }
    const cx = pairs.map(p => p[0]), cy = pairs.map(p => p[1])
    const res = sTest === 4 ? pearson(cx, cy) : spearman(cx, cy)
    pVal = res.p; efStr = `r = ${res.r.toFixed(4)}`
    statStr = `${sTest === 4 ? 'r' : 'ρ'}(${res.n - 2}) = ${res.r.toFixed(4)}, p = ${pfmt(pVal)}`
    interp = interpStr(pVal, Math.abs(res.r), 'r')

  } else if (test.multi) {
    const groups = vals.map(x => { const d = sel.find(dd => dd.id === x.d.id); return d?.metrics.hr?.map(p => p.v) || [x.v] })
    const res = kruskalWallis(groups)
    pVal = res.p; efStr = `η² ≈ ${res.eta2.toFixed(3)}`
    statStr = `H(${res.df}) = ${res.H.toFixed(3)}, p = ${pfmt(pVal)}, k = ${groups.length}`
    interp = pVal < 0.05 ? 'Significant group difference detected.' : 'No significant group difference.'

  } else if (test.paired) {
    if (vals.length !== 2) { out.innerHTML = `<div style="color:var(--dd);font-size:9px">Paired tests require exactly 2 datasets</div>`; return }
    const p1 = sel[0].metrics.hr?.map(p => p.v) || []
    const p2 = sel[1].metrics.hr?.map(p => p.v) || []
    const n  = Math.min(p1.length, p2.length)
    const s1 = p1.slice(0, n), s2 = p2.slice(0, n)

    if (sTest === 0) {
      const r = wilcox(s1, s2)
      pVal = r.p; efStr = `r = ${r.r.toFixed(3)} (${efl(r.r, 'r')})`
      statStr = `W+ = ${r.Wp.toFixed(1)}, W− = ${r.Wm.toFixed(1)}, n = ${r.n}`
    } else if (sTest === 1) {
      const r = signTest(s1, s2)
      pVal = r.p; efStr = `${r.k}/${r.n} positive`
      statStr = `k = ${r.k}, n = ${r.n}`
    } else {
      const r = pairedT(s1, s2)
      pVal = r.p; efStr = `d = ${r.d.toFixed(3)} (${efl(Math.abs(r.d), 'd')})`
      statStr = `t(${r.n - 1}) = ${r.t.toFixed(3)}, Δ = ${r.mean.toFixed(2)}, SE = ${r.se.toFixed(2)}`
    }

    const ci = bootstrapCI(s1, s2, 800)
    ciStr  = `95% CI (bootstrap): [${ci.lo.toFixed(2)}, ${ci.hi.toFixed(2)}]`
    interp = interpStr(pVal, 0, 'r')

  } else {
    if (vals.length !== 2) { out.innerHTML = `<div style="color:var(--dd);font-size:9px">Select exactly 2 datasets</div>`; return }
    const p1 = sel[0].metrics.hr?.map(p => p.v) || []
    const p2 = sel[1].metrics.hr?.map(p => p.v) || []
    const res = mannWhitney(p1, p2)
    pVal = res.p; efStr = `r = ${res.r.toFixed(3)} (${efl(res.r, 'r')})`
    statStr = `U = ${res.U.toFixed(1)}, Z = ${res.Z.toFixed(3)}, n₁=${res.nx}, n₂=${res.ny}`
    interp = interpStr(pVal, res.r, 'r')
  }

  const pc = pVal < 0.05 ? '#4ade80' : pVal < 0.1 ? '#fbbf24' : '#f87171'
  const sb = pVal < 0.05
    ? `<span class="badge bg">p &lt; 0.05 — significant</span>`
    : pVal < 0.1
      ? `<span class="badge by">trend (p &lt; 0.10)</span>`
      : `<span class="badge br">not significant</span>`

  out.innerHTML = `
    <div class="rgrid">
      <div class="rcard">
        <div class="rl">p-value (2-tailed)</div>
        <div class="rv" style="color:${pc}">${pfmt(pVal)}</div>
        <div style="margin-top:8px">${sb}</div>
      </div>
      <div class="rcard">
        <div class="rl">Effect size</div>
        <div class="rv">${efStr.split('=')[1]?.trim().split(' ')[0] || '—'}</div>
        <div class="rs">${efStr}</div>
      </div>
      <div class="rcard">
        <div class="rl">Test</div>
        <div style="font-size:11px;font-weight:700;color:var(--t);line-height:1.4;margin-top:3px;font-family:var(--mono)">${test.l}</div>
      </div>
    </div>

    <div class="cout">
<span style="color:var(--dd)">metric  </span>${m.l}
<span style="color:var(--dd)">test    </span>${test.l}
<span style="color:var(--dd)">stat    </span>${statStr}
<span style="color:var(--dd)">p =     </span><span style="color:${pc};font-weight:700">${pfmt(pVal)}</span>
${ciStr ? `<span style="color:var(--dd)">ci      </span>${ciStr}` : ''}</div>

    ${interp ? `<div class="csm" style="font-size:10px;color:var(--d);line-height:1.7"><strong style="color:var(--t)">Interpretation:</strong> ${interp}</div>` : ''}

    <div>
      <div class="slbl">Data</div>
      <table class="tbl">
        <thead><tr><th>Dataset</th><th>${m.l}</th><th>HR mean</th><th>HR peak</th><th>n</th></tr></thead>
        <tbody>
          ${sel.map(d => {
            const vv  = vals.find(x => x.d.id === d.id)?.v
            const hrm = avg(d.metrics.hr?.map(p => p.v))
            return `<tr>
              <td><div style="display:flex;align-items:center;gap:6px">${dot(d.color)}${d.label}</div></td>
              <td style="color:var(--t)">${vv?.toFixed(3) || '—'}</td>
              <td>${hrm?.toFixed(1) || '—'}</td>
              <td>${d.peak}</td>
              <td>${d.metrics.hr?.length || '—'}</td>
            </tr>`
          }).join('')}
        </tbody>
      </table>
    </div>`
}

// ── METRICS ──────────────────────────────────────────────────
function rMetrics(el) {
  if (!datasets.length) { el.innerHTML = emptyState('Load data first.'); return }

  el.innerHTML = '<div class="m-sect" id="mi"></div>'
  const inner  = el.querySelector('#mi')

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
      ['HR mean',       `${mn.toFixed(1)} bpm`],
      ['HR peak',       `${Math.max(...hr)} bpm`],
      ['HR min',        `${Math.min(...hr).toFixed(0)} bpm`],
      ['HR SD',         `${sd.toFixed(2)} bpm`],
      ['HR reserve',    `${Math.max(...hr) - ds.rest} bpm`],
      ['HRR 1min',      hrr1 > 0 ? `${hrr1.toFixed(1)} bpm` : '—'],
      ['RMSSD approx',  rmssd ? `${rmssd.toFixed(1)}` : '—'],
      ['VO₂ Max',      ds.metrics.vo2?.[0] ? `${ds.metrics.vo2[0].v.toFixed(1)} mL/kg/min` : '—'],
      ['Duration',      `${Math.round(ds.totalDur / 60)} min`],
    ]

    const card = document.createElement('div')
    card.className = 'card'
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:11px">
        <i style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${ds.color};box-shadow:0 0 7px ${ds.color}"></i>
        <span style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--t)">${ds.label}</span>
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

// ── UPLOAD ───────────────────────────────────────────────────
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
          <div style="font-size:9px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:var(--d);margin-bottom:3px">
            Drop export.xml here
          </div>
          <div style="font-size:8px;color:var(--dd);letter-spacing:.1em;text-transform:uppercase;font-family:var(--mono)">
            click to browse · multiple files
          </div>
        </div>
        <input type="file" id="fi" accept=".xml" multiple style="display:none">

        <div style="margin-top:14px">
          <div class="slbl">Demo datasets</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px">
            <button onclick="loadDemoData(1)" class="tb-btn" style="height:34px;font-size:8px;justify-content:center">Single workout</button>
            <button onclick="loadDemoData(2)" class="tb-btn" style="height:34px;font-size:8px;justify-content:center">4 participants</button>
          </div>
        </div>

        <div style="margin-top:18px">
          <div class="slbl">Loaded datasets</div>
          <div id="dsl"></div>
        </div>

        <div class="csm" style="margin-top:14px;font-size:9px;color:var(--dd);line-height:1.85;font-family:var(--mono)">
          <span style="color:var(--d);font-weight:700">HOW TO EXPORT</span><br>
          Health app → profile → Export All Health Data → export.zip → unzip → upload export.xml
        </div>
      </div>
    </div>`

  setTimeout(initUpload, 20)
}

function initUpload() {
  const uz = document.getElementById('uz')
  const fi = document.getElementById('fi')
  if (!uz || !fi) return
  uz.addEventListener('dragover',  e => { e.preventDefault(); uz.classList.add('drag') })
  uz.addEventListener('dragleave', () => uz.classList.remove('drag'))
  uz.addEventListener('drop',      e => { e.preventDefault(); uz.classList.remove('drag'); Array.from(e.dataTransfer.files).forEach(f => window.handleFile(f)) })
  fi.addEventListener('change',    e => Array.from(e.target.files).forEach(f => window.handleFile(f)))
  refreshDatasetList()
}

export function refreshDatasetList() {
  const el = document.getElementById('dsl')
  if (!el) return
  if (!datasets.length) {
    el.innerHTML = `<div style="padding:18px;text-align:center;color:var(--dd);font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase">No datasets loaded</div>`
    return
  }
  el.innerHTML = datasets.map(d => `
    <div style="display:flex;align-items:center;gap:9px;padding:7px 9px;border-radius:7px;background:var(--s2);border:1px solid var(--b);margin-bottom:4px">
      <i style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${d.color};box-shadow:0 0 6px ${d.color};flex-shrink:0"></i>
      <div style="flex:1;min-width:0">
        <div style="font-size:9px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--t)">${d.label}</div>
        <div style="font-size:8px;color:var(--dd);font-family:var(--mono);margin-top:2px">
          ${d.metrics.hr?.length || 0} HR · ${Object.keys(d.metrics).length} metrics · ${Math.round(d.totalDur / 60)}min · rest ${d.rest} · peak ${d.peak}
        </div>
      </div>
      <button onclick="removeDataset(${d.id})" style="width:19px;height:19px;border-radius:4px;border:none;background:rgba(248,113,113,.08);color:#f87171;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0">×</button>
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
          onclick="toggleClick('${id}',${i},'${cb}')">
          ${l}
        </button>`).join('')}
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

// ── empty state ───────────────────────────────────────────────
function emptyState(msg, actions = '') {
  return `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;min-height:300px;gap:9px;padding:40px;text-align:center">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" style="color:var(--ddd)">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
      <div style="font-size:9px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:var(--dd)">${msg}</div>
      ${actions}
    </div>`
}