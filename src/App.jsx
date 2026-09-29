import { useMemo, useRef, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea,
} from 'recharts'
import { ACTUAL_UNTIL, METRICS, isForecast, parseWorkbook } from './parse.js'

const ALL = '전체'
const TANK_STYLE = [
  { color: '#2997ff', dash: '' },
  { color: '#ffffff', dash: '' },
  { color: '#8ec5ff', dash: '6 4' },
  { color: '#cccccc', dash: '6 4' },
  { color: '#7a7a7a', dash: '' },
  { color: '#5eaeff', dash: '2 3' },
]

const fmt = (n) => Math.round(n).toLocaleString('ko-KR')
const monthLabel = (m) => (isForecast(m) ? `${m} (예상)` : m)
const pct = (v) => (v == null ? '-' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)}%`)

export default function App() {
  const [data, setData] = useState(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  const [zone, setZone] = useState(ALL)
  const [month, setMonth] = useState(ALL)
  const [metricFilter, setMetricFilter] = useState(ALL)
  const [query, setQuery] = useState('')
  const [chartMetric, setChartMetric] = useState('저장량')
  const [hiddenTanks, setHiddenTanks] = useState([])

  async function load(file) {
    if (!file) return
    if (!/\.xlsx$/i.test(file.name)) {
      setError('.xlsx 파일만 업로드할 수 있습니다.')
      return
    }
    try {
      const parsed = await parseWorkbook(file)
      setData(parsed)
      setFileName(file.name)
      setError('')
      setZone(ALL); setMonth(ALL); setMetricFilter(ALL); setQuery('')
      setHiddenTanks([])
    } catch (e) {
      setError(e.message || '파일을 읽는 중 오류가 발생했습니다.')
    }
  }

  const zones = useMemo(() => (data ? [...new Set(data.rows.map((r) => r.zone))] : []), [data])
  const months = useMemo(
    () => (data ? [...new Set(data.rows.map((r) => r.month))].sort() : []),
    [data],
  )
  const metrics = useMemo(() => {
    if (!data) return METRICS
    const present = new Set(data.rows.map((r) => r.metric))
    return [...METRICS.filter((m) => present.has(m)), ...[...present].filter((m) => !METRICS.includes(m))]
  }, [data])

  // 구역 필터는 카드·차트·표 모두에 적용
  const zoneRows = useMemo(
    () => (data ? data.rows.filter((r) => zone === ALL || r.zone === zone) : []),
    [data, zone],
  )

  // 카드: 선택 구역·월 기준 (월 미선택 시 기간 합계)
  const cards = useMemo(() => {
    return metrics.map((m) => {
      const rs = zoneRows.filter(
        (r) => r.metric === m && (month === ALL ? !isForecast(r.month) : r.month === month),
      )
      const total = rs.reduce((s, r) => s + r.total, 0)
      const unit = rs[0]?.unit || ''
      let mom = null
      if (month !== ALL) {
        const idx = months.indexOf(month)
        if (idx > 0) {
          const prev = zoneRows
            .filter((r) => r.metric === m && r.month === months[idx - 1])
            .reduce((s, r) => s + r.total, 0)
          mom = prev ? (total - prev) / prev : null
        }
      }
      return { metric: m, total, unit, mom, forecast: month !== ALL && isForecast(month) }
    })
  }, [zoneRows, metrics, month, months])

  // 차트: 선택 지표의 탱크별 월별 수치 (선택 구역 합산)
  const chartData = useMemo(() => {
    if (!data) return []
    return months.map((mo) => {
      const point = { month: mo }
      data.tanks.forEach((t) => {
        point[t] = zoneRows
          .filter((r) => r.metric === chartMetric && r.month === mo)
          .reduce((s, r) => s + r.tanks[t], 0)
      })
      return point
    })
  }, [data, zoneRows, months, chartMetric])
  const chartUnit = zoneRows.find((r) => r.metric === chartMetric)?.unit || ''

  // 표: 모든 필터 + 검색
  const tableRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return zoneRows.filter((r) => {
      if (month !== ALL && r.month !== month) return false
      if (metricFilter !== ALL && r.metric !== metricFilter) return false
      if (q && !`${r.zone} ${r.month} ${r.metric} ${r.note}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [zoneRows, month, metricFilter, query])

  const toggleTank = (t) =>
    setHiddenTanks((h) => (h.includes(t) ? h.filter((x) => x !== t) : [...h, t]))

  const reset = () => { setZone(ALL); setMonth(ALL); setMetricFilter(ALL); setQuery('') }

  return (
    <>
      <nav className="global-nav">
        <span>광양터미널 운영 대시보드</span>
        {data && <span className="nav-file">{fileName}</span>}
      </nav>

      {/* 1. Hero + 업로드 */}
      <section className="tile tile-light hero">
        <h1>광양터미널<br />월간 운영 실적</h1>
        <p className="lead">엑셀 파일을 올리면 표와 차트로 바로 보여드립니다.</p>
        <div
          className={`dropzone ${dragOver ? 'over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); load(e.dataTransfer.files[0]) }}
        >
          <input
            ref={inputRef} type="file" accept=".xlsx" hidden
            onChange={(e) => { load(e.target.files[0]); e.target.value = '' }}
          />
          <button className="btn-primary" onClick={() => inputRef.current.click()}>
            {data ? '다른 파일 선택' : '.xlsx 파일 선택'}
          </button>
          <span className="hint">또는 여기로 파일을 끌어다 놓으세요</span>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        {data && (
          <p className="meta">
            {fileName} · 첫 번째 시트 “{data.sheetName}” · {data.rows.length}행 · {zones.length}개 구역 · {months.length}개월
          </p>
        )}
      </section>

      {data && (
        <>
          {/* 필터 바 */}
          <div className="filter-bar">
            <div className="filter-inner">
              <Select label="구역" value={zone} onChange={setZone} options={[ALL, ...zones]} />
              <Select label="월" value={month} onChange={setMonth} options={[ALL, ...months]} labelOf={monthLabel} />
              <Select label="지표" value={metricFilter} onChange={setMetricFilter} options={[ALL, ...metrics]} />
              <input
                className="search" type="search" placeholder="검색 (구역, 월, 지표, 비고)"
                value={query} onChange={(e) => setQuery(e.target.value)}
              />
              <button className="btn-ghost" onClick={reset}>초기화</button>
            </div>
          </div>

          {/* 2. 지표 카드 */}
          <section className="tile tile-parchment">
            <h2>운영지표</h2>
            <p className="sub">
              {zone} · {month === ALL ? `실적 합계 (~${ACTUAL_UNTIL}, 예상 제외)` : `${monthLabel(month)} ${isForecast(month) ? '' : '실적'}`} — 카드를 누르면 아래 차트 지표가 바뀝니다.
            </p>
            <div className="cards">
              {cards.map((c) => (
                <button
                  key={c.metric}
                  className={`card ${chartMetric === c.metric ? 'selected' : ''}`}
                  onClick={() => setChartMetric(c.metric)}
                >
                  <span className="card-label">{c.metric}</span>
                  <span className="card-value">{fmt(c.total)}<small>{c.unit}</small></span>
                  <span className="card-mom">
                    {month === ALL ? '실적 합계' : `${c.forecast ? '예상 · ' : ''}전월대비 ${pct(c.mom)}`}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* 3. 탱크별 월별 차트 */}
          <section className="tile tile-dark">
            <h2>탱크별 월별 {chartMetric}</h2>
            <p className="sub">{zone} · 단위 {chartUnit || '-'} · 음영 구간은 예상({months.find(isForecast) || '-'}~)</p>
            <div className="chips">
              {data.tanks.map((t, i) => (
                <button
                  key={t}
                  className={`chip ${hiddenTanks.includes(t) ? 'off' : ''}`}
                  onClick={() => toggleTank(t)}
                >
                  <i style={{ background: TANK_STYLE[i % 6].color }} />{t}
                </button>
              ))}
            </div>
            <div className="chart">
              <ResponsiveContainer width="100%" height={380}>
                <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#3a3a3d" vertical={false} />
                  <XAxis dataKey="month" stroke="#cccccc" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#cccccc" tick={{ fontSize: 12 }} tickFormatter={fmt} width={64} />
                  <Tooltip
                    formatter={(v) => `${fmt(v)} ${chartUnit}`}
                    contentStyle={{ background: '#1d1d1f', border: '1px solid #3a3a3d', borderRadius: 8 }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Legend />
                  {months.some(isForecast) && (
                    <ReferenceArea
                      x1={months.find(isForecast)} x2={months[months.length - 1]}
                      fill="#ffffff" fillOpacity={0.06}
                      label={{ value: '예상', fill: '#cccccc', fontSize: 12, position: 'insideTop' }}
                    />
                  )}
                  {data.tanks.map((t, i) =>
                    hiddenTanks.includes(t) ? null : (
                      <Line
                        key={t} type="monotone" dataKey={t} dot={false} strokeWidth={2.5}
                        stroke={TANK_STYLE[i % 6].color} strokeDasharray={TANK_STYLE[i % 6].dash}
                      />
                    ),
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="tile tile-light">
            <h2>원본 데이터</h2>
            <p className="sub">{tableRows.length} / {data.rows.length}행 표시</p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>구역</th><th>월</th><th>운영지표</th><th>단위</th>
                    {data.tanks.map((t) => <th key={t} className="r">{t}</th>)}
                    <th className="r">합계</th><th className="r">전월대비</th><th>비고</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((r, i) => (
                    <tr key={i} className={isForecast(r.month) ? 'forecast' : ''}>
                      <td>{r.zone}</td><td>{r.month}{isForecast(r.month) && <em className="badge">예상</em>}</td><td>{r.metric}</td><td>{r.unit}</td>
                      {data.tanks.map((t) => (
                        <td key={t} className={`r ${r.tanks[t] === 0 ? 'zero' : ''}`}>{fmt(r.tanks[t])}</td>
                      ))}
                      <td className="r strong">{fmt(r.total)}</td>
                      <td className={`r ${r.mom > 0 ? 'up' : ''}`}>{pct(r.mom)}</td>
                      <td>{r.note}</td>
                    </tr>
                  ))}
                  {tableRows.length === 0 && (
                    <tr><td colSpan={8 + data.tanks.length} className="empty">조건에 맞는 데이터가 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  )
}

function Select({ label, value, onChange, options, labelOf = (o) => o }) {
  return (
    <label className="select">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o} value={o}>{labelOf(o)}</option>)}
      </select>
    </label>
  )
}
