import { DCOLS, MCFG } from './state.js'

export function parseXML(xmlStr, label, existingCount) {
  const doc = new DOMParser().parseFromString(xmlStr, 'application/xml')
  const ds  = {
    id:      existingCount,
    label,
    color:   DCOLS[existingCount % DCOLS.length],
    metrics: {},
  }

  Object.entries(MCFG).forEach(([k, cfg]) => {
    const recs = doc.querySelectorAll(`Record[type="${cfg.hk}"]`)
    if (!recs.length) return

    const base = new Date(recs[0].getAttribute('startDate')).getTime()
    const pts  = []

    recs.forEach(rec => {
      const t = (new Date(rec.getAttribute('startDate')).getTime() - base) / 1000
      let v   = parseFloat(rec.getAttribute('value'))
      if (k === 'spo2') v *= 100
      if (!isNaN(v) && v > 0) pts.push({ t: Math.round(t), v })
    })

    if (pts.length) ds.metrics[k] = pts
  })

  if (!ds.metrics.hr) return null

  ds.totalDur = ds.metrics.hr[ds.metrics.hr.length - 1].t

  const restPts = ds.metrics.hr.slice(0, Math.floor(ds.metrics.hr.length * 0.08))
  ds.rest = Math.round(restPts.reduce((s, p) => s + p.v, 0) / restPts.length)
  ds.peak = Math.round(Math.max(...ds.metrics.hr.map(p => p.v)))

  return ds
}