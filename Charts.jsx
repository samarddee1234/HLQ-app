// กราฟ SVG เบา ๆ ไม่ต้องใช้ไลบรารีเพิ่ม — สีมาจาก CSS (.chart ...)

const W = 340
const PAD = { l: 32, r: 8, t: 14, b: 26 }

function yScale(h, max) {
  return (v) => PAD.t + (h - PAD.t - PAD.b) * (1 - v / max)
}

function Grid({ h, y, ticks }) {
  return ticks.map((t) => (
    <g key={t}>
      <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="grid" />
      <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" className="axis">{t}</text>
    </g>
  ))
}

// data: [{ label, value (0-100 หรือ null), current?: boolean }]
export function BarChart({ data, height = 190, label = 'กราฟแท่ง' }) {
  const y = yScale(height, 100)
  const n = Math.max(1, data.length)
  const bw = (W - PAD.l - PAD.r) / n
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="chart" role="img" aria-label={label}>
      <Grid h={height} y={y} ticks={[0, 50, 100]} />
      {data.map((d, i) => {
        const x = PAD.l + i * bw + bw * 0.18
        const w = bw * 0.64
        return (
          <g key={i}>
            {d.value == null ? (
              <rect x={x} y={y(0) - 3} width={w} height="3" rx="1.5" className="bar-empty" />
            ) : (
              <>
                <rect
                  x={x} y={y(d.value)} width={w} height={Math.max(3, y(0) - y(d.value))}
                  rx="4" className={d.current ? 'bar bar-now' : 'bar'}
                />
                <text x={x + w / 2} y={y(d.value) - 4} textAnchor="middle" className="val">{d.value}</text>
              </>
            )}
            <text x={x + w / 2} y={height - 8} textAnchor="middle" className="axis">{d.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

// series: [{ name, cls: 's1'|'s2', values: [number|null] }]
export function LineChart({ labels, series, height = 200, label = 'กราฟเส้น' }) {
  const y = yScale(height, 100)
  const n = labels.length
  const step = n > 1 ? (W - PAD.l - PAD.r) / (n - 1) : 0
  const x = (i) => PAD.l + i * step
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${height}`} className="chart" role="img" aria-label={label}>
        <Grid h={height} y={y} ticks={[0, 50, 100]} />
        {series.map((s) => {
          let d = ''
          let pen = false
          s.values.forEach((v, i) => {
            if (v == null) { pen = false; return }
            d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)} `
            pen = true
          })
          return (
            <g key={s.name}>
              <path d={d} className={`line line-${s.cls}`} fill="none" />
              {s.values.map((v, i) =>
                v == null ? null : <circle key={i} cx={x(i)} cy={y(v)} r="3.5" className={`dot dot-${s.cls}`} />
              )}
            </g>
          )
        })}
        {labels.map((l, i) => (
          <text key={i} x={x(i)} y={height - 8} textAnchor="middle" className="axis">{l}</text>
        ))}
      </svg>
      <div className="legend">
        {series.map((s) => (
          <span key={s.name}><i className={`swatch swatch-${s.cls}`} />{s.name}</span>
        ))}
      </div>
    </div>
  )
}

export function Ring({ value, caption, size = 104 }) {
  const r = 40
  const c = 2 * Math.PI * r
  const v = value == null ? 0 : Math.max(0, Math.min(100, value))
  return (
    <div className="ring-wrap">
      <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`${caption} ${value ?? '-'}%`}>
        <circle cx="50" cy="50" r={r} className="ring-bg" fill="none" strokeWidth="10" />
        <circle
          cx="50" cy="50" r={r} className="ring-fg" fill="none" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${(c * v) / 100} ${c}`} transform="rotate(-90 50 50)"
        />
        <text x="50" y="57" textAnchor="middle" className="ring-text">{value == null ? '–' : `${value}%`}</text>
      </svg>
      <span className="ring-cap">{caption}</span>
    </div>
  )
}

// แถบสัดส่วนสถานะ: parts = [{ label, value, cls }]
export function StackBar({ parts }) {
  const total = parts.reduce((s, p) => s + p.value, 0)
  if (!total) return <p className="muted">ยังไม่มีข้อมูล</p>
  return (
    <div>
      <div className="stack" role="img" aria-label="สัดส่วนสถานะละหมาด">
        {parts.filter((p) => p.value > 0).map((p) => (
          <span key={p.label} className={`seg ${p.cls}`} style={{ width: `${(p.value / total) * 100}%` }} />
        ))}
      </div>
      <div className="legend">
        {parts.map((p) => (
          <span key={p.label}><i className={`swatch ${p.cls}`} />{p.label} {p.value}</span>
        ))}
      </div>
    </div>
  )
}
