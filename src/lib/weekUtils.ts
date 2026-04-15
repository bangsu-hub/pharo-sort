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
