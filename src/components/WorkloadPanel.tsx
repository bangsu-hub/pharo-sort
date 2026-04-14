'use client'

import { WorkloadItem } from '@/types'

const MAX_LOAD = 5  // 인디케이터 포화 기준 (5건 = 100%)

const LOAD_COLORS = (ratio: number) => {
  if (ratio >= 1)   return 'bg-red-500'
  if (ratio >= 0.7) return 'bg-orange-400'
  if (ratio >= 0.4) return 'bg-yellow-400'
  return 'bg-green-400'
}

interface Props {
  workload: WorkloadItem[]
  selectedAssignee: string
  onSelect: (name: string) => void
}

export default function WorkloadPanel({ workload, selectedAssignee, onSelect }: Props) {
  if (workload.length === 0) {
    return (
      <aside className="w-full md:w-60 md:shrink-0 bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">업무 부하 현황</h2>
        <p className="text-xs text-gray-400 text-center py-8">담당자 없음</p>
      </aside>
    )
  }

  const sorted = [...workload].sort((a, b) => b.active - a.active)

  return (
    <aside className="w-full md:w-60 md:shrink-0 bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-700 mb-1">업무 부하 현황</h2>
      <p className="text-xs text-gray-400 mb-4">진행 중 기준 (완료 제외)</p>

      {/* 데스크톱: 세로 목록 */}
      <ul className="hidden md:block space-y-3">
        {sorted.map(item => {
          const ratio = Math.min(item.active / MAX_LOAD, 1)
          const isSelected = selectedAssignee === item.assignee
          return (
            <li
              key={item.assignee}
              onClick={() => onSelect(isSelected ? '' : item.assignee)}
              className={`cursor-pointer rounded-md p-2 transition-colors ${
                isSelected ? 'bg-indigo-50 ring-1 ring-indigo-300' : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className={`text-sm font-medium ${isSelected ? 'text-indigo-700' : 'text-gray-700'}`}>
                  {item.assignee}
                </span>
                <span className="text-xs text-gray-500">
                  <span className={`font-bold ${item.active >= MAX_LOAD ? 'text-red-500' : 'text-gray-700'}`}>
                    {item.active}
                  </span>
                  <span className="text-gray-400">/{item.total}건</span>
                </span>
              </div>
              <div className="workload-bar">
                <div
                  className={`workload-fill ${LOAD_COLORS(ratio)}`}
                  style={{ width: `${ratio * 100}%` }}
                />
              </div>
              {item.active >= MAX_LOAD && (
                <p className="text-xs text-red-500 mt-0.5">업무 과부하 주의</p>
              )}
            </li>
          )
        })}
      </ul>

      {/* 모바일: 가로 스크롤 카드 */}
      <div className="md:hidden flex gap-2 overflow-x-auto pb-1">
        {sorted.map(item => {
          const ratio = Math.min(item.active / MAX_LOAD, 1)
          const isSelected = selectedAssignee === item.assignee
          return (
            <button
              key={item.assignee}
              onClick={() => onSelect(isSelected ? '' : item.assignee)}
              className={`flex flex-col items-center gap-1 rounded-xl p-3 min-w-[72px] transition-colors border ${
                isSelected ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-300' : 'bg-gray-50 border-gray-200'
              }`}
            >
              <span className={`text-sm font-bold ${item.active >= MAX_LOAD ? 'text-red-500' : 'text-gray-800'}`}>
                {item.active}
              </span>
              <div className="w-full workload-bar">
                <div className={`workload-fill ${LOAD_COLORS(ratio)}`} style={{ width: `${ratio * 100}%` }} />
              </div>
              <span className="text-xs text-gray-500 whitespace-nowrap">{item.assignee}</span>
            </button>
          )
        })}
      </div>

      <div className="hidden md:block mt-4 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />여유
          <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />보통
          <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />주의
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />과부하
        </div>
      </div>
    </aside>
  )
}
