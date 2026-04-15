'use client'

import { useState } from 'react'
import { FilterState, Priority, Status } from '@/types'
import { TEAM_MEMBERS, REQUEST_TEAMS } from '@/lib/constants'

const STATUSES: Status[]     = ['접수', '검토중', '기획중', '완료']
const PRIORITIES: Priority[] = ['★', '★★', '★★★']

// Jira 보드 상태 목록 (API 반환값 기준)
const JIRA_STATUSES = [
  '참고', '대기', '해야 할 일', '진행 중',
  'DEV PR', 'STG 테스트요청', 'STG 테스트완료', '완료',
]

// 표시용 라벨 매핑
const JIRA_DISPLAY: Record<string, string> = {
  '해야 할 일': '할일',
  '진행 중':    '진행중',
}

interface Props {
  filters: FilterState
  onChange: (f: FilterState) => void
  onReset: () => void
}

export default function FilterBar({ filters, onChange, onReset }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const update = (key: keyof FilterState, value: string | boolean) =>
    onChange({ ...filters, [key]: value })

  const hasActive =
    filters.team || filters.status || filters.assignee ||
    filters.priority || filters.search || filters.jiraStatus ||
    filters.unassignedOnly || filters.excludeDone

  return (
    <div className="flex flex-col gap-2 bg-white border border-gray-200 rounded-lg px-3 md:px-4 py-3 shadow-sm">
      {/* 모바일 헤더 (토글 버튼) */}
      <div className="flex items-center justify-between md:hidden">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 010 2H4a1 1 0 01-1-1zm3 5a1 1 0 011-1h10a1 1 0 010 2H7a1 1 0 01-1-1zm4 5a1 1 0 011-1h2a1 1 0 010 2h-2a1 1 0 01-1-1z"/>
          </svg>
          <span className="text-sm font-medium text-gray-700">필터</span>
          {hasActive && <span className="text-xs bg-indigo-100 text-indigo-600 font-medium px-2 py-0.5 rounded-full">적용 중</span>}
        </div>
        <button
          onClick={() => setMobileOpen(o => !o)}
          className="flex items-center gap-1 text-sm text-gray-500 px-2 py-1 rounded-md hover:bg-gray-50"
        >
          <svg className={`w-4 h-4 transition-transform ${mobileOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
          </svg>
          {mobileOpen ? '닫기' : '열기'}
        </button>
      </div>

      {/* 필터 내용 — 데스크톱은 항상 표시, 모바일은 토글 */}
      <div className={`${mobileOpen ? 'flex' : 'hidden'} md:flex flex-col gap-2`}>

      {/* 1행: 기본 필터 */}
      <div className="flex flex-nowrap overflow-x-auto md:flex-wrap items-center gap-2 pb-1 md:pb-0">
        {/* 검색 */}
        <div className="relative">
          <svg className="absolute left-2.5 top-2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
          </svg>
          <input
            type="text"
            placeholder="건명 / 요청자 검색"
            value={filters.search}
            onChange={e => update('search', e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md w-44 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

        <div className="h-5 border-l border-gray-200" />

        {/* 요청팀 */}
        <select
          value={filters.team}
          onChange={e => update('team', e.target.value)}
          className="text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="">전체 요청팀</option>
          {REQUEST_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        {/* 기획진행상태 */}
        <select
          value={filters.status}
          onChange={e => update('status', e.target.value)}
          className="text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="">전체 기획진행상태</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* 담당자 */}
        <select
          value={filters.assignee}
          onChange={e => update('assignee', e.target.value)}
          className="text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="">전체 담당자</option>
          {TEAM_MEMBERS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        {/* 우선순위 */}
        <select
          value={filters.priority}
          onChange={e => update('priority', e.target.value)}
          className="text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="">전체 우선순위</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <div className="h-4 border-l border-gray-200 mx-0.5" />

        {/* 미배정 토글 */}
        <button
          onClick={() => update('unassignedOnly', !filters.unassignedOnly)}
          className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-medium transition-all border whitespace-nowrap ${
            filters.unassignedOnly
              ? 'bg-orange-500 text-white border-orange-500'
              : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300 hover:text-orange-500'
          }`}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
          </svg>
          미배정만 보기
        </button>

        {/* 완료 제외 토글 */}
        <button
          onClick={() => update('excludeDone', !filters.excludeDone)}
          className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-medium transition-all border whitespace-nowrap ${
            filters.excludeDone
              ? 'bg-green-600 text-white border-green-600'
              : 'bg-white text-gray-600 border-gray-200 hover:border-green-400 hover:text-green-600'
          }`}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
          </svg>
          완료 제외
        </button>

        {/* 초기화 */}
        {hasActive && (
          <button
            onClick={onReset}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-500 transition-colors px-2 py-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
            초기화
          </button>
        )}

        <div className="ml-auto">
          {hasActive && <span className="text-xs bg-indigo-100 text-indigo-600 font-medium px-2 py-0.5 rounded-full">필터 적용 중</span>}
        </div>
      </div>

      {/* 2행: 지라 보드 상태 */}
      <div className="flex flex-nowrap overflow-x-auto md:flex-wrap items-center gap-2 pt-2 border-t border-gray-100 pb-1 md:pb-0">
        <span className="text-xs text-gray-400 font-medium whitespace-nowrap">지라 상태</span>

        {/* 전체(초기화) */}
        <button
          onClick={() => update('jiraStatus', '')}
          className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all border ${
            !filters.jiraStatus
              ? 'bg-gray-800 text-white border-gray-800'
              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
          }`}
        >
          전체
        </button>

        {JIRA_STATUSES.map(s => {
          const label = JIRA_DISPLAY[s] ?? s
          const isActive = filters.jiraStatus === s
          return (
            <button
              key={s}
              onClick={() => update('jiraStatus', isActive ? '' : s)}
              className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all border whitespace-nowrap ${
                isActive
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
              }`}
            >
              {label}
            </button>
          )
        })}

      </div>

      </div>{/* end collapsible */}
    </div>
  )
}
