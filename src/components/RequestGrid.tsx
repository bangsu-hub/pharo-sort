'use client'

import { useEffect, useMemo, useState } from 'react'
import { Request, Status, TestStatus, Priority } from '@/types'
import StatusBadge from './StatusBadge'
import TestStatusBadge from './TestStatusBadge'
import JiraStatusBadge from './JiraStatusBadge'
import { isAfter, parseISO, startOfToday } from 'date-fns'
import { TEAM_MEMBERS, REQUEST_TEAMS } from '@/lib/constants'
import { toDateStr, businessDaysDiff } from '@/lib/weekUtils'

const STATUSES: Status[] = ['대기', '검토중', '기획중', '완료', '보류']
const TEST_STATUSES: TestStatus[] = ['테스트 대기', '테스트 중', '테스트 완료']
const PRIORITIES: Priority[] = ['★', '★★', '★★★']
const STATUS_ORDER: Record<string, number> = { '대기': 0, '검토중': 1, '기획중': 2, '완료': 3, '보류': 4 }

const PRIORITY_STYLE: Record<string, string> = {
  '★':   'text-gray-400',
  '★★':  'text-orange-400 font-semibold',
  '★★★': 'text-red-500 font-bold',
}

type SortKey = 'id' | 'status' | 'due_date' | 'actual_due_date' | 'deploy_date' | 'request_date' | 'title' | 'summary' | 'assignee' | 'requester' | 'jira_status' | 'jira_key' | 'priority'
type SortDir = 'asc' | 'desc' | null

function getSortValue(r: Request, key: SortKey): string | number | null {
  switch (key) {
    case 'id':              return r.id
    case 'status':          return STATUS_ORDER[r.status] ?? 99
    case 'due_date':        return r.due_date
    case 'actual_due_date': return r.actual_due_date
    case 'deploy_date':     return r.deploy_date
    case 'request_date':    return r.request_date
    case 'title':           return r.title
    case 'summary':         return r.summary
    case 'assignee':        return r.assignee || null
    case 'requester':       return r.requester
    case 'jira_status':     return r.jira_status
    case 'jira_key':        return r.jira_key
    case 'priority':        return r.priority
  }
}

/** 기획이 '완료'인데 테스트 일정이 존재하면, 그 시점부터는 테스트진행상태를 대표 상태로 노출한다 */
function effectiveTestPhase(r: Request) {
  return r.status === '완료' && r.test_status ? r.test_status : null
}

// ← 컴포넌트 밖으로 이동 (리렌더링마다 새 타입으로 인식되는 문제 방지)
function ThSort({ label, active, dir, onClick, className }: {
  label: string
  active: boolean
  dir: SortDir
  onClick: () => void
  className?: string
}) {
  return (
    <th className={`cursor-pointer select-none hover:text-indigo-600 transition-colors ${className ?? ''}`} onClick={onClick}>
      <span className="inline-flex items-center gap-0.5">
        {label}
        <span className={active && dir ? 'text-indigo-600' : 'text-gray-300'}>
          {active && dir === 'asc' ? '▲' : active && dir === 'desc' ? '▼' : '↕'}
        </span>
      </span>
    </th>
  )
}

/**
 * 네이티브 date input은 값이 비어있을 때 달력에서 월만 이동해도 브라우저가 일/연도를
 * 자동완성해 change 이벤트를 바로 쏘는 경우가 있어, 즉시 저장 대신 blur 시점에만 반영한다.
 */
function DateCell({ value, onCommit, className, onClick }: {
  value: string | null
  onCommit: (v: string | null) => void
  className?: string
  onClick?: (e: React.MouseEvent<HTMLInputElement>) => void
}) {
  const [draft, setDraft] = useState(value ?? '')

  useEffect(() => { setDraft(value ?? '') }, [value])

  return (
    <input
      type="date"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => {
        const next = draft || null
        if (next !== (value ?? null)) onCommit(next)
      }}
      onClick={onClick}
      className={className}
    />
  )
}

interface Props {
  requests: Request[]
  selectedIds: Set<number>
  onToggleSelect: (id: number) => void
  onToggleSelectAll: () => void
  onEdit: (r: Request) => void
  onDeleteSingle: (r: Request) => void
  onStatusChange: (id: number, status: Status) => void
  onTestStatusChange: (id: number, testStatus: TestStatus) => void
  onAssigneeChange: (id: number, assignee: string) => void
  onDueDateChange: (id: number, date: string | null) => void
  onActualDueDateChange: (id: number, date: string | null) => void
  onDeployDateChange: (id: number, date: string | null) => void
  onTeamChange: (id: number, team: string) => void
  onPriorityChange: (id: number, priority: string) => void
  onCreateJiraIssue: (r: Request) => Promise<void>
}

function isOverdue(r: Request): boolean {
  if (!r.due_date || r.status === '완료') return false
  return isAfter(startOfToday(), parseISO(r.due_date))
}
/** 영업일(주말/공휴일 제외) 기준 D-day. 미래면 양수(D-N), 과거면 음수(D+N) */
function daysLeft(due: string | null): number | null {
  if (!due) return null
  return businessDaysDiff(toDateStr(new Date()), due)
}
function isNewJiraItem(r: Request): boolean {
  if (!r.jira_key || !r.created_at) return false
  const createdDate = r.created_at.slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)
  return createdDate === today
}

export default function RequestGrid({
  requests, selectedIds,
  onToggleSelect, onToggleSelectAll,
  onEdit, onDeleteSingle,
  onStatusChange, onTestStatusChange, onAssigneeChange, onDueDateChange, onActualDueDateChange, onDeployDateChange, onTeamChange, onPriorityChange,
  onCreateJiraIssue,
}: Props) {
  const allSelected = requests.length > 0 && requests.every(r => selectedIds.has(r.id))
  const someSelected = requests.some(r => selectedIds.has(r.id))
  const [creatingJiraId, setCreatingJiraId] = useState<number | null>(null)
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)

  const handleSort = (key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key)
      setSortDir('asc')
    } else if (sortDir === 'asc') {
      setSortDir('desc')
    } else if (sortDir === 'desc') {
      setSortKey(null)
      setSortDir(null)
    } else {
      setSortDir('asc')
    }
  }

  const sortedRequests = useMemo(() => {
    if (!sortKey || !sortDir) return requests
    const dir = sortDir === 'asc' ? 1 : -1
    return [...requests].sort((a, b) => {
      const av = getSortValue(a, sortKey)
      const bv = getSortValue(b, sortKey)
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
  }, [requests, sortKey, sortDir])

  const handleCreateJira = async (r: Request) => {
    setCreatingJiraId(r.id)
    try {
      await onCreateJiraIssue(r)
    } finally {
      setCreatingJiraId(null)
    }
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-white border border-gray-200 rounded-lg">
        <svg className="w-10 h-10 mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z"/>
        </svg>
        <p className="text-sm">조건에 맞는 업무가 없습니다.</p>
      </div>
    )
  }

  return (
    <>
      {/* ── 모바일 카드 뷰 ── */}
      <div className="md:hidden flex flex-col gap-3">
        {requests.map(r => {
          const overdue   = isOverdue(r)
          const done      = r.status === '완료'
          const days      = daysLeft(r.due_date)
          const isChecked = selectedIds.has(r.id)
          const isNew     = isNewJiraItem(r)
          const testPhase = effectiveTestPhase(r)

          return (
            <div key={r.id}
              className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
                isChecked ? 'border-indigo-300 ring-2 ring-indigo-200' :
                overdue   ? 'border-red-200' :
                done      ? 'border-gray-100' : 'border-gray-200'
              } ${overdue ? 'bg-red-50' : done ? 'bg-gray-50' : ''}`}
            >
              {/* 카드 헤더 */}
              <div className="flex items-start gap-3 px-4 pt-3 pb-2">
                <input type="checkbox" checked={isChecked}
                  onChange={() => onToggleSelect(r.id)}
                  className="mt-1 w-4 h-4 accent-indigo-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <button onClick={() => onEdit(r)}
                    className="text-sm font-semibold text-gray-900 hover:text-indigo-600 text-left line-clamp-2 w-full">
                    {isNew && <span className="mr-1 inline-block text-xs font-bold bg-indigo-500 text-white rounded px-1.5 py-0.5 align-middle">N</span>}
                    {r.title}
                    {overdue && <span className="ml-1 inline-block text-xs font-bold bg-red-500 text-white rounded px-1">D+{Math.abs(days ?? 0)}</span>}
                  </button>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {testPhase ? <TestStatusBadge status={testPhase} /> : <StatusBadge status={r.status} />}
                    <span className={`text-xs ${PRIORITY_STYLE[r.priority]}`}>{r.priority}</span>
                    {r.jira_key && (
                      <a href={r.jira_link ?? '#'} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline">{r.jira_key}</a>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => onEdit(r)} className="p-1.5 text-gray-400 hover:text-indigo-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                  </button>
                  <button onClick={() => onDeleteSingle(r)} className="p-1.5 text-gray-400 hover:text-red-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* 카드 바디 */}
              <div className="grid grid-cols-2 gap-2 px-4 pb-3 text-xs">
                {/* 요청팀 */}
                <div>
                  <p className="text-gray-400 mb-0.5">요청팀</p>
                  <select value={r.request_team} onChange={e => onTeamChange(r.id, e.target.value)}
                    className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300">
                    <option value="">미해당</option>
                    {REQUEST_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                    {!REQUEST_TEAMS.includes(r.request_team) && r.request_team && (
                      <option value={r.request_team}>{r.request_team}</option>
                    )}
                  </select>
                </div>

                {/* 기획/테스트진행상태 */}
                <div>
                  <p className="text-gray-400 mb-0.5">기획/테스트진행상태</p>
                  <select value={r.status} onChange={e => onStatusChange(r.id, e.target.value as Status)}
                    className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300">
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {testPhase && (
                    <>
                      <select value={testPhase} onChange={e => onTestStatusChange(r.id, e.target.value as TestStatus)}
                        className="w-full border border-orange-200 rounded px-1.5 py-1 text-xs mt-1 focus:outline-none focus:ring-1 focus:ring-orange-300">
                        {TEST_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <div className="mt-1"><TestStatusBadge status={testPhase} /></div>
                    </>
                  )}
                </div>

                {/* 기획 담당자 */}
                <div>
                  <p className="text-gray-400 mb-0.5">기획 담당자</p>
                  <select value={r.assignee ?? ''} onChange={e => onAssigneeChange(r.id, e.target.value)}
                    className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300">
                    <option value="">미배정</option>
                    {TEAM_MEMBERS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>

                {/* 기획 완료 예정일 */}
                <div>
                  <p className="text-gray-400 mb-0.5">기획 완료 예정일</p>
                  <DateCell value={r.due_date} onCommit={v => onDueDateChange(r.id, v)}
                    className={`w-full border rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300 ${overdue ? 'border-red-300 text-red-600' : 'border-gray-200 text-gray-700'}`}
                  />
                  {days !== null && !done && (
                    <p className={`text-xs mt-0.5 ${overdue ? 'text-red-500' : days <= 3 ? 'text-orange-500' : 'text-gray-400'}`}>
                      {days === 0 ? '오늘 마감' : days > 0 ? `D-${days}` : `D+${Math.abs(days)}`}
                    </p>
                  )}
                </div>

                {/* 실제 완료일 */}
                <div>
                  <p className="text-gray-400 mb-0.5">실제 완료일</p>
                  <DateCell value={r.actual_due_date} onCommit={v => onActualDueDateChange(r.id, v)}
                    className="w-full border rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300 border-gray-200 text-gray-700"
                  />
                </div>

                {/* 배포예정일 */}
                <div>
                  <p className="text-gray-400 mb-0.5">배포예정일</p>
                  <DateCell value={r.deploy_date} onCommit={v => onDeployDateChange(r.id, v)}
                    className="w-full border rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300 border-gray-200 text-gray-700"
                  />
                </div>
              </div>

              {/* 지라 보드 상태 */}
              {r.jira_status && (
                <div className="px-4 pb-3">
                  <JiraStatusBadge status={r.jira_status} />
                </div>
              )}
              {!r.jira_key && (
                <div className="px-4 pb-3">
                  <button
                    onClick={() => handleCreateJira(r)}
                    disabled={creatingJiraId === r.id}
                    className="text-xs text-indigo-600 border border-indigo-200 rounded-lg px-2.5 py-1 hover:bg-indigo-50 disabled:opacity-50 transition-colors"
                  >
                    {creatingJiraId === r.id ? '생성 중...' : 'Jira 이슈 생성'}
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {/* 모바일 전체 선택 */}
        <div className="flex items-center gap-2 px-1 py-2">
          <input type="checkbox" checked={allSelected}
            ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
            onChange={onToggleSelectAll}
            className="w-4 h-4 accent-indigo-600" />
          <span className="text-xs text-gray-500">전체 선택</span>
        </div>
      </div>

      {/* ── 데스크톱 테이블 뷰 ── */}
      <div className="hidden md:block overflow-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="grid-table">
          <thead>
            <tr>
              <th className="w-10 text-center">
                <input type="checkbox" checked={allSelected}
                  ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
                  onChange={onToggleSelectAll}
                  className="w-4 h-4 accent-indigo-600 cursor-pointer" />
              </th>
              <ThSort label="No."             active={sortKey === 'id'}              dir={sortDir} onClick={() => handleSort('id')}              className="w-12 text-center" />
              <ThSort label="기획/테스트진행상태" active={sortKey === 'status'}          dir={sortDir} onClick={() => handleSort('status')}          className="w-28" />
              <ThSort label="기획 완료 예정일"   active={sortKey === 'due_date'}        dir={sortDir} onClick={() => handleSort('due_date')}        className="w-36" />
              <ThSort label="실제 완료일"      active={sortKey === 'actual_due_date'} dir={sortDir} onClick={() => handleSort('actual_due_date')} className="w-36" />
              <ThSort label="배포예정일"       active={sortKey === 'deploy_date'}     dir={sortDir} onClick={() => handleSort('deploy_date')}     className="w-32" />
              <ThSort label="등록일자"        active={sortKey === 'request_date'} dir={sortDir} onClick={() => handleSort('request_date')} className="w-24" />
              <ThSort label="기획건명"        active={sortKey === 'title'}        dir={sortDir} onClick={() => handleSort('title')}        className="min-w-[200px]" />
              <ThSort label="내용 요약"       active={sortKey === 'summary'}      dir={sortDir} onClick={() => handleSort('summary')}      className="min-w-[160px]" />
              <ThSort label="기획 담당자"     active={sortKey === 'assignee'}     dir={sortDir} onClick={() => handleSort('assignee')}     className="w-28" />
              <ThSort label="요청자"         active={sortKey === 'requester'}    dir={sortDir} onClick={() => handleSort('requester')}    className="w-20" />
              <ThSort label="지라 보드 상태"  active={sortKey === 'jira_status'}  dir={sortDir} onClick={() => handleSort('jira_status')}  className="w-32" />
              <ThSort label="지라"           active={sortKey === 'jira_key'}     dir={sortDir} onClick={() => handleSort('jira_key')}     className="w-20 text-center" />
              <th className="w-16 text-center">관리</th>
              <ThSort label="우선순위"       active={sortKey === 'priority'}     dir={sortDir} onClick={() => handleSort('priority')}     className="w-20 text-center" />
            </tr>
          </thead>
          <tbody>
            {sortedRequests.map((r) => {
              const overdue   = isOverdue(r)
              const done      = r.status === '완료'
              const days      = daysLeft(r.due_date)
              const isChecked = selectedIds.has(r.id)
              const isNew     = isNewJiraItem(r)
              const testPhase = effectiveTestPhase(r)
              const rowCls = isChecked ? 'bg-indigo-50' : overdue ? 'row-overdue' : done ? 'row-done' : 'row-normal'

              return (
                <tr key={r.id} className={rowCls}>
                  <td className="text-center">
                    <input type="checkbox" checked={isChecked} onChange={() => onToggleSelect(r.id)}
                      className="w-4 h-4 accent-indigo-600 cursor-pointer" />
                  </td>
                  <td className="text-center text-gray-400 text-xs">{r.id}</td>
                  <td>
                    <div className="flex flex-col gap-1">
                      <select value={r.status} onChange={e => onStatusChange(r.id, e.target.value as Status)}
                        onClick={e => e.stopPropagation()}
                        className="text-xs border-0 bg-transparent focus:outline-none cursor-pointer">
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      {testPhase && (
                        <select value={testPhase} onChange={e => onTestStatusChange(r.id, e.target.value as TestStatus)}
                          onClick={e => e.stopPropagation()}
                          className="text-xs border-0 bg-transparent focus:outline-none cursor-pointer text-orange-600">
                          {TEST_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )}
                      {testPhase ? <TestStatusBadge status={testPhase} /> : <StatusBadge status={r.status} />}
                    </div>
                  </td>
                  <td>
                    <DateCell value={r.due_date} onCommit={v => onDueDateChange(r.id, v)}
                      onClick={e => e.stopPropagation()}
                      className={`text-xs border rounded px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-300 w-full ${overdue ? 'border-red-300 text-red-600 bg-red-50' : days !== null && days <= 3 && !done ? 'border-orange-300 text-orange-600' : 'border-gray-200 text-gray-600'}`}
                    />
                    {days !== null && !done && (
                      <p className={`text-xs mt-0.5 ${overdue ? 'text-red-500' : days <= 3 ? 'text-orange-500' : 'text-gray-400'}`}>
                        {days === 0 ? '오늘 마감' : days > 0 ? `D-${days}` : `D+${Math.abs(days)}`}
                      </p>
                    )}
                  </td>
                  <td>
                    <DateCell value={r.actual_due_date} onCommit={v => onActualDueDateChange(r.id, v)}
                      onClick={e => e.stopPropagation()}
                      className="text-xs border rounded px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-300 w-full border-gray-200 text-gray-600"
                    />
                  </td>
                  <td>
                    <DateCell value={r.deploy_date} onCommit={v => onDeployDateChange(r.id, v)}
                      onClick={e => e.stopPropagation()}
                      className="text-xs border rounded px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-300 w-full border-gray-200 text-gray-600"
                    />
                  </td>
                  <td className="text-xs whitespace-nowrap">{r.request_date?.slice(0, 10) ?? '-'}</td>
                  <td>
                    <div className="flex items-start gap-1.5">
                      {isNew && (
                        <span className="shrink-0 mt-0.5 text-xs font-bold bg-indigo-500 text-white rounded px-1.5 py-0.5">N</span>
                      )}
                      <div>
                        <button onClick={() => onEdit(r)}
                          className="text-left text-sm font-medium text-gray-800 hover:text-indigo-600 hover:underline transition-colors line-clamp-2 w-full">
                          {r.title}
                        </button>
                        {overdue && <span className="badge-delay">D+{Math.abs(days ?? 0)}</span>}
                      </div>
                    </div>
                  </td>
                  <td><p className="text-xs text-gray-500 line-clamp-2 whitespace-pre-line">{r.summary || '—'}</p></td>
                  <td>
                    <select value={r.assignee ?? ''} onChange={e => onAssigneeChange(r.id, e.target.value)}
                      onClick={e => e.stopPropagation()}
                      className={`text-sm border rounded px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-300 w-full ${r.assignee ? 'border-gray-200 text-gray-800' : 'border-dashed border-gray-300 text-gray-400'}`}>
                      <option value="">미배정</option>
                      {TEAM_MEMBERS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </td>
                  <td className="text-xs">{r.requester}</td>
                  <td><JiraStatusBadge status={r.jira_status ?? null} /></td>
                  <td className="text-center">
                    {r.jira_link
                      ? <a href={r.jira_link} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                          onClick={e => e.stopPropagation()}>
                          {r.jira_key ?? '링크'}
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                          </svg>
                        </a>
                      : <button
                          onClick={e => { e.stopPropagation(); handleCreateJira(r) }}
                          disabled={creatingJiraId === r.id}
                          className="text-xs text-indigo-600 border border-indigo-200 rounded px-1.5 py-0.5 hover:bg-indigo-50 disabled:opacity-50 transition-colors whitespace-nowrap"
                          title="Jira 이슈 생성"
                        >
                          {creatingJiraId === r.id ? '생성 중...' : 'Jira 생성'}
                        </button>
                    }
                  </td>
                  <td className="text-center">
                    <div className="flex justify-center gap-1">
                      <button onClick={() => onEdit(r)} className="p-1 text-gray-400 hover:text-indigo-600 transition-colors" title="수정">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                      </button>
                      <button onClick={() => onDeleteSingle(r)} className="p-1 text-gray-400 hover:text-red-500 transition-colors" title="삭제">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                  <td className="text-center">
                    <select value={r.priority} onChange={e => onPriorityChange(r.id, e.target.value)}
                      onClick={e => e.stopPropagation()}
                      className={`text-sm border-0 bg-transparent focus:outline-none cursor-pointer text-center ${PRIORITY_STYLE[r.priority] ?? ''}`}>
                      {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
