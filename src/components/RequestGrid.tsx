'use client'

import { Request, Status } from '@/types'
import StatusBadge from './StatusBadge'
import JiraStatusBadge from './JiraStatusBadge'
import { isAfter, parseISO, startOfToday, differenceInDays } from 'date-fns'
import { TEAM_MEMBERS, REQUEST_TEAMS } from '@/lib/constants'

const STATUSES: Status[] = ['접수', '검토중', '기획중', '완료']

const PRIORITY_STYLE: Record<string, string> = {
  '★':   'text-gray-400',
  '★★':  'text-orange-400 font-semibold',
  '★★★': 'text-red-500 font-bold',
}

interface Props {
  requests: Request[]
  selectedIds: Set<number>
  onToggleSelect: (id: number) => void
  onToggleSelectAll: () => void
  onEdit: (r: Request) => void
  onDeleteSingle: (r: Request) => void
  onStatusChange: (id: number, status: Status) => void
  onAssigneeChange: (id: number, assignee: string) => void
  onDueDateChange: (id: number, date: string | null) => void
  onTeamChange: (id: number, team: string) => void
}

function isOverdue(r: Request): boolean {
  if (!r.due_date || r.status === '완료') return false
  return isAfter(startOfToday(), parseISO(r.due_date))
}
function daysLeft(due: string | null): number | null {
  if (!due) return null
  return differenceInDays(parseISO(due), startOfToday())
}

export default function RequestGrid({
  requests, selectedIds,
  onToggleSelect, onToggleSelectAll,
  onEdit, onDeleteSingle,
  onStatusChange, onAssigneeChange, onDueDateChange, onTeamChange,
}: Props) {
  const allSelected = requests.length > 0 && requests.every(r => selectedIds.has(r.id))
  const someSelected = requests.some(r => selectedIds.has(r.id))

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-white border border-gray-200 rounded-lg">
        <svg className="w-10 h-10 mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z"/>
        </svg>
        <p className="text-sm">조건에 맞는 요청이 없습니다.</p>
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
                    {r.title}
                    {overdue && <span className="ml-1 inline-block text-xs font-bold bg-red-500 text-white rounded px-1">D+{Math.abs(days ?? 0)}</span>}
                  </button>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <StatusBadge status={r.status} />
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
                    {REQUEST_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                    {!REQUEST_TEAMS.includes(r.request_team) && r.request_team && (
                      <option value={r.request_team}>{r.request_team}</option>
                    )}
                  </select>
                </div>

                {/* 기획진행상태 */}
                <div>
                  <p className="text-gray-400 mb-0.5">기획진행상태</p>
                  <select value={r.status} onChange={e => onStatusChange(r.id, e.target.value as Status)}
                    className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300">
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
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

                {/* 완료 예정일 */}
                <div>
                  <p className="text-gray-400 mb-0.5">완료 예정일</p>
                  <input type="date" value={r.due_date ?? ''}
                    onChange={e => onDueDateChange(r.id, e.target.value || null)}
                    className={`w-full border rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300 ${overdue ? 'border-red-300 text-red-600' : 'border-gray-200 text-gray-700'}`}
                  />
                  {days !== null && !done && (
                    <p className={`text-xs mt-0.5 ${overdue ? 'text-red-500' : days <= 3 ? 'text-orange-500' : 'text-gray-400'}`}>
                      {days === 0 ? '오늘 마감' : days > 0 ? `D-${days}` : `D+${Math.abs(days)}`}
                    </p>
                  )}
                </div>
              </div>

              {/* 지라 보드 상태 */}
              {r.jira_status && (
                <div className="px-4 pb-3">
                  <JiraStatusBadge status={r.jira_status} />
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
              <th className="w-12 text-center">No.</th>
              <th className="w-24">요청일자</th>
              <th className="w-24">요청팀</th>
              <th className="w-20">요청자</th>
              <th className="min-w-[200px]">기획건명</th>
              <th className="min-w-[160px]">내용 요약</th>
              <th className="w-20 text-center">우선순위</th>
              <th className="w-28">기획 담당자</th>
              <th className="w-28">기획진행상태</th>
              <th className="w-32">지라 보드 상태</th>
              <th className="w-36">완료 예정일</th>
              <th className="w-20 text-center">지라</th>
              <th className="w-16 text-center">관리</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => {
              const overdue   = isOverdue(r)
              const done      = r.status === '완료'
              const days      = daysLeft(r.due_date)
              const isChecked = selectedIds.has(r.id)
              const rowCls = isChecked ? 'bg-indigo-50' : overdue ? 'row-overdue' : done ? 'row-done' : 'row-normal'

              return (
                <tr key={r.id} className={rowCls}>
                  <td className="text-center">
                    <input type="checkbox" checked={isChecked} onChange={() => onToggleSelect(r.id)}
                      className="w-4 h-4 accent-indigo-600 cursor-pointer" />
                  </td>
                  <td className="text-center text-gray-400 text-xs">{r.id}</td>
                  <td className="text-xs whitespace-nowrap">{r.request_date?.slice(0, 10) ?? '-'}</td>
                  <td>
                    <select value={r.request_team} onChange={e => onTeamChange(r.id, e.target.value)}
                      onClick={e => e.stopPropagation()}
                      className="text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-300 w-full">
                      {REQUEST_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                      {!REQUEST_TEAMS.includes(r.request_team) && r.request_team && (
                        <option value={r.request_team}>{r.request_team}</option>
                      )}
                    </select>
                  </td>
                  <td className="text-xs">{r.requester}</td>
                  <td>
                    <button onClick={() => onEdit(r)}
                      className="text-left text-sm font-medium text-gray-800 hover:text-indigo-600 hover:underline transition-colors line-clamp-2 w-full">
                      {r.title}
                    </button>
                    {overdue && <span className="badge-delay">D+{Math.abs(days ?? 0)}</span>}
                  </td>
                  <td><p className="text-xs text-gray-500 line-clamp-2 whitespace-pre-line">{r.summary || '—'}</p></td>
                  <td className="text-center">
                    <span className={`text-sm ${PRIORITY_STYLE[r.priority] ?? ''}`}>{r.priority}</span>
                  </td>
                  <td>
                    <select value={r.assignee ?? ''} onChange={e => onAssigneeChange(r.id, e.target.value)}
                      onClick={e => e.stopPropagation()}
                      className={`text-sm border rounded px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-300 w-full ${r.assignee ? 'border-gray-200 text-gray-800' : 'border-dashed border-gray-300 text-gray-400'}`}>
                      <option value="">미배정</option>
                      {TEAM_MEMBERS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </td>
                  <td>
                    <div className="flex flex-col gap-1">
                      <select value={r.status} onChange={e => onStatusChange(r.id, e.target.value as Status)}
                        onClick={e => e.stopPropagation()}
                        className="text-xs border-0 bg-transparent focus:outline-none cursor-pointer">
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <StatusBadge status={r.status} />
                    </div>
                  </td>
                  <td><JiraStatusBadge status={r.jira_status ?? null} /></td>
                  <td>
                    <input type="date" value={r.due_date ?? ''}
                      onChange={e => onDueDateChange(r.id, e.target.value || null)}
                      onClick={e => e.stopPropagation()}
                      className={`text-xs border rounded px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-300 w-full ${overdue ? 'border-red-300 text-red-600 bg-red-50' : days !== null && days <= 3 && !done ? 'border-orange-300 text-orange-600' : 'border-gray-200 text-gray-600'}`}
                    />
                    {days !== null && !done && (
                      <p className={`text-xs mt-0.5 ${overdue ? 'text-red-500' : days <= 3 ? 'text-orange-500' : 'text-gray-400'}`}>
                        {days === 0 ? '오늘 마감' : days > 0 ? `D-${days}` : `D+${Math.abs(days)}`}
                      </p>
                    )}
                  </td>
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
                      : <span className="text-gray-300">—</span>
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
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
