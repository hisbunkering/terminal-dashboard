import * as XLSX from 'xlsx'

export const METRICS = ['저장량', '송출량', '벙커링', '반출입']

// 이 월(포함)까지가 실적, 이후 월은 예상으로 구분한다.
export const ACTUAL_UNTIL = '2026-09'
export const isForecast = (month) => /^\d{4}-\d{2}$/.test(month) && month > ACTUAL_UNTIL

const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// 첫 번째 시트를 읽어 { rows, tanks } 로 변환한다.
// 합계/전월대비는 엑셀 수식(캐시값 없을 수 있음)에 의존하지 않고 직접 계산한다.
export async function parseWorkbook(file) {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

  const hi = aoa.findIndex((r) => r && r.includes('운영지표'))
  if (hi < 0) throw new Error("헤더 행('구역, 월, 운영지표 …')을 찾지 못했습니다.")

  const header = aoa[hi].map((h) => (h == null ? '' : String(h).trim()))
  const col = (name) => header.indexOf(name)
  const cZone = col('구역'), cMonth = col('월'), cMetric = col('운영지표')
  const cUnit = col('단위'), cNote = col('비고')
  const tankCols = header
    .map((h, i) => ({ h, i }))
    .filter((x) => /탱크$/.test(x.h))
  if (cZone < 0 || cMonth < 0 || tankCols.length === 0) {
    throw new Error('필수 컬럼(구역, 월, 탱크)이 없습니다.')
  }
  const tanks = tankCols.map((t) => t.h)

  const rows = []
  for (const r of aoa.slice(hi + 1)) {
    if (!r || !r[cZone] || !r[cMetric]) continue
    const row = {
      zone: String(r[cZone]).trim(),
      month: String(r[cMonth]).trim(),
      metric: String(r[cMetric]).trim(),
      unit: cUnit >= 0 && r[cUnit] ? String(r[cUnit]).trim() : '',
      note: cNote >= 0 && r[cNote] ? String(r[cNote]).trim() : '',
      tanks: {},
    }
    let total = 0
    for (const t of tankCols) {
      row.tanks[t.h] = num(r[t.i])
      total += row.tanks[t.h]
    }
    row.total = total
    rows.push(row)
  }
  if (rows.length === 0) throw new Error('데이터 행이 없습니다.')

  // 전월대비(%) : 같은 구역·지표의 직전 월 대비
  const key = (r) => `${r.zone}|${r.metric}`
  const groups = {}
  rows.forEach((r) => (groups[key(r)] ||= []).push(r))
  Object.values(groups).forEach((g) => {
    g.sort((a, b) => a.month.localeCompare(b.month))
    g.forEach((r, i) => {
      const prev = g[i - 1]
      r.mom = prev && prev.total ? (r.total - prev.total) / prev.total : null
    })
  })

  return { rows, tanks, sheetName: wb.SheetNames[0] }
}
