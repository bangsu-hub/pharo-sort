'use client'

import { useMemo } from 'react'
import { Request } from '@/types'
import { isOverdue, isThisWeek, getWeekBounds } from '@/lib/weekUtils'

interface Props { requests: Request[] }

export default function WeeklySummary({ requests }: Props) {
  const { mondayStr, fridayStr } = getWeekBounds()

  const stats = useMemo(() => {
    const totalActive     = requests.filter(r => r.status !== '완료' && r.status !== '대기').length
    const weeklyTarget    = requests.filter(r => r.due_date && isThisWeek(r.due_date)).length
    const overdueCount    = requests.filter(isOverdue).length
    const unassignedCount = requests.filter(r => !r.assignee?.trim()).length
    return { totalActive, weeklyTarget, overdueCount, unassignedCount }
  }, [requests])

  const weekLabel = `${mondayStr.slice(5).replace('-', '/')} ~ ${fridayStr.slice(5).replace('-', '/')}`

  const cards = [
    {
      label: '전체 진행중',
      value: stats.totalActive,
      sub:   '완료·대기 제외',
      bg:    'bg-indigo-50',
      num:   'text-indigo-700',
      icon:  (
        <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
        </svg>
      ),
    },
    {
      label: '이번 주 마감 목표',
      value: stats.weeklyTarget,
      sub:   weekLabel,
      bg:    'bg-blue-50',
      num:   'text-blue-700',
      icon:  (
        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
      ),
    },
    {
      label: '기한 초과',
      value: stats.overdueCount,
      sub:   '미완료 + 기한 지남',
      bg:    stats.overdueCount > 0 ? 'bg-red-50' : 'bg-gray-50',
      num:   stats.overdueCount > 0 ? 'text-red-600' : 'text-gray-400',
      pulse: stats.overdueCount > 0,
      icon:  (
        <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        </svg>
      ),
    },
    {
      label: '미배정 요청',
      value: stats.unassignedCount,
      sub:   '담당자 없음',
      bg:    stats.unassignedCount > 0 ? 'bg-yellow-50' : 'bg-gray-50',
      num:   stats.unassignedCount > 0 ? 'text-yellow-600' : 'text-gray-400',
      icon:  (
        <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
        </svg>
      ),
    },
  ]

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
        </svg>
        <h2 className="text-sm font-bold text-gray-700">주간 현황 요약</h2>
        <span className="text-xs text-gray-400 ml-auto">{weekLabel}</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map(c => (
          <div key={c.label} className={`${c.bg} rounded-xl p-3 flex flex-col gap-1`}>
            <div className="flex items-center justify-between">
              {c.icon}
              <span className={`text-2xl font-black ${c.num} ${c.pulse ? 'animate-pulse' : ''}`}>{c.value}</span>
            </div>
            <p className="text-xs font-semibold text-gray-700 mt-1">{c.label}</p>
            <p className="text-xs text-gray-400">{c.sub}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
