'use client'

import { useMemo, useState } from 'react'
import { Request } from '@/types'

const STATUS_BAR_COLOR: Record<string, string> = {
  '대기':   'bg-gray-400',
  '검토중': 'bg-yellow-400',
  '기획중': 'bg-purple-400',
  '완료':   'bg-green-400',
  '보류':   'bg-red-400',
}

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

interface Props {
  issues: Request[]
  onSelectIssue?: (r: Request) => void
}

/** 담당자 카드 클릭 시 펼쳐지는, 기획시작일자~기획완료예정일 구간을 막대로 보여주는 월간 캘린더 */
export default function MemberCalendar({ issues, onSelectIssue }: Props) {
  const [monthOffset, setMonthOffset] = useState(0)

  const { days, monthLabel } = useMemo(() => {
    const base = new Date()
    base.setDate(1)
    base.setMonth(base.getMonth() + monthOffset)
    const year = base.getFullYear()
    const month = base.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const arr: Date[] = []
    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      arr.push(new Date(d))
    }
    return { days: arr, monthLabel: `${year}년 ${month + 1}월` }
  }, [monthOffset])

  const rangeStart = toDateStr(days[0])
  const rangeEnd = toDateStr(days[days.length - 1])
  const todayStr = toDateStr(new Date())

  const bars = useMemo(() => {
    return issues
      .filter(r => r.due_date && r.due_date >= rangeStart && (r.start_date ?? r.due_date) <= rangeEnd)
      .map(r => {
        const start = r.start_date && r.start_date > rangeStart ? r.start_date : rangeStart
        const end = r.due_date! < rangeEnd ? r.due_date! : rangeEnd
        const startIdx = days.findIndex(d => toDateStr(d) === start)
        const endIdx = days.findIndex(d => toDateStr(d) === end)
        return {
          r,
          startIdx: startIdx === -1 ? 0 : startIdx,
          endIdx: endIdx === -1 ? days.length - 1 : endIdx,
          hasStart: !!r.start_date,
        }
      })
  }, [issues, days, rangeStart, rangeEnd])

  const cellCount = days.length

  return (
    <div className="p-4 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={() => setMonthOffset(o => o - 1)}
          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <p className="text-sm font-bold text-gray-700">{monthLabel}</p>
        <button type="button" onClick={() => setMonthOffset(o => o + 1)}
          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: cellCount * 24 + 140 }}>
          {/* 날짜 헤더 */}
          <div className="flex">
            <div className="w-32 shrink-0" />
            <div className="flex-1 flex">
              {days.map(d => {
                const isToday = toDateStr(d) === todayStr
                return (
                  <div key={toDateStr(d)}
                    className={`flex-1 text-center text-[10px] pb-1 border-b ${isToday ? 'text-indigo-600 font-bold border-indigo-300' : 'text-gray-400 border-gray-100'}`}>
                    {d.getDate()}
                  </div>
                )
              })}
            </div>
          </div>

          {/* 이슈별 막대 */}
          {bars.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">이번 달에 표시할 일정이 없습니다.</p>
          ) : (
            <div className="space-y-1.5 mt-2">
              {bars.map(({ r, startIdx, endIdx, hasStart }) => (
                <div key={r.id} className="flex items-center">
                  <button type="button" onClick={() => onSelectIssue?.(r)}
                    className="w-32 shrink-0 text-left text-xs text-gray-600 truncate pr-2 hover:text-indigo-600 transition-colors">
                    {r.title}
                  </button>
                  <div className="flex-1 relative h-5">
                    <div
                      className={`absolute top-0.5 h-4 rounded-full ${STATUS_BAR_COLOR[r.status] ?? 'bg-gray-300'} ${hasStart ? '' : 'opacity-50 border border-dashed border-gray-400'}`}
                      style={{
                        left: `${(startIdx / cellCount) * 100}%`,
                        width: `${Math.max(((endIdx - startIdx + 1) / cellCount) * 100, 100 / cellCount)}%`,
                      }}
                      title={`${r.title} (${r.start_date ?? '시작일 미정'} ~ ${r.due_date})`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="text-[11px] text-gray-300 mt-3">
        진한 막대: 기획시작일자~기획완료예정일 · 옅은 점선 막대: 기획시작일자 미입력(완료예정일 기준 표시)
      </p>
    </div>
  )
}
