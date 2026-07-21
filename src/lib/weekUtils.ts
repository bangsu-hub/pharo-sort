import { Request } from '@/types'

export function toDateStr(d: Date): string {
  const y  = d.getFullYear()
  const m  = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/** 이번 주 월요일~금요일 날짜 반환 */
export function getWeekBounds(): {
  monday: Date; friday: Date; mondayStr: string; fridayStr: string
} {
  const today = new Date()
  const dow = today.getDay() // 0=일, 1=월 … 6=토
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1))
  monday.setHours(0, 0, 0, 0)
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)
  friday.setHours(23, 59, 59, 999)
  return {
    monday, friday,
    mondayStr: toDateStr(monday),
    fridayStr: toDateStr(friday),
  }
}

/** 월(0)~금(4) 5일 배열 */
export function getWeekDays(): {
  date: Date; dateStr: string; label: string; shortLabel: string
}[] {
  const { monday } = getWeekBounds()
  const DAY_KR = ['월', '화', '수', '목', '금']
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const dateStr = toDateStr(d)
    const m = d.getMonth() + 1
    const dd = d.getDate()
    return {
      date: d,
      dateStr,
      label:      `${m}/${dd}(${DAY_KR[i]})`,
      shortLabel: DAY_KR[i],
    }
  })
}

export function isThisWeek(dateStr: string): boolean {
  const { mondayStr, fridayStr } = getWeekBounds()
  return dateStr >= mondayStr && dateStr <= fridayStr
}

export function isOverdue(r: Request): boolean {
  if (!r.due_date || r.status === '완료') return false
  return r.due_date < toDateStr(new Date())
}

/**
 * 대한민국 법정공휴일 (설날/추석 등 음력 연휴는 매년 날짜가 바뀌므로 연도별로 직접 등록).
 * 2025~2027년만 등록되어 있음 — 이후 연도는 매년 갱신 필요.
 */
export const KR_HOLIDAYS = new Set([
  // 2025
  '2025-01-01', '2025-01-28', '2025-01-29', '2025-01-30', '2025-03-01', '2025-03-03',
  '2025-05-05', '2025-05-06', '2025-06-06', '2025-08-15',
  '2025-10-03', '2025-10-05', '2025-10-06', '2025-10-07', '2025-10-08', '2025-10-09',
  '2025-12-25',
  // 2026
  '2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18', '2026-03-01', '2026-03-02',
  '2026-05-05', '2026-05-24', '2026-05-25', '2026-06-03', '2026-06-06', '2026-07-17',
  '2026-08-15', '2026-08-17', '2026-09-24', '2026-09-25', '2026-09-26',
  '2026-10-03', '2026-10-05', '2026-10-09', '2026-12-25',
  // 2027
  '2027-01-01', '2027-02-06', '2027-02-07', '2027-02-08', '2027-02-09', '2027-03-01',
  '2027-05-05', '2027-05-13', '2027-06-06', '2027-06-07', '2027-07-17',
  '2027-08-15', '2027-08-16', '2027-09-14', '2027-09-15', '2027-09-16',
  '2027-10-03', '2027-10-04', '2027-10-09', '2027-10-11', '2027-12-25', '2027-12-27',
])

function isBusinessDay(d: Date): boolean {
  const dow = d.getDay()
  return dow !== 0 && dow !== 6 && !KR_HOLIDAYS.has(toDateStr(d))
}

/** 시작~완료 구간의 영업일 수 (양 끝 날짜 포함, 주말/공휴일 제외) */
export function countBusinessDays(start: string, end: string): number {
  let count = 0
  const d = new Date(`${start}T00:00:00`)
  const endD = new Date(`${end}T00:00:00`)
  while (d <= endD) {
    if (isBusinessDay(d)) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

/**
 * 두 날짜 사이의 영업일 차이 (fromStr 제외, toStr 포함 — date-fns의 differenceInDays와 동일한 방향 규칙).
 * toStr이 fromStr보다 미래면 양수(D-N), 과거면 음수(D+N)로 쓰기 위한 부호를 포함한다.
 */
export function businessDaysDiff(fromStr: string, toStr: string): number {
  if (toStr === fromStr) return 0
  const forward = toStr > fromStr
  const start = forward ? fromStr : toStr
  const end   = forward ? toStr : fromStr
  let count = 0
  const d = new Date(`${start}T00:00:00`)
  d.setDate(d.getDate() + 1) // 시작일 자신은 제외
  const endD = new Date(`${end}T00:00:00`)
  while (d <= endD) {
    if (isBusinessDay(d)) count++
    d.setDate(d.getDate() + 1)
  }
  return forward ? count : -count
}
