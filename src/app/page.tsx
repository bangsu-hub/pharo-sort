'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Request, RequestInput, Status, FilterState, WorkloadItem } from '@/types'
import { TEAM_MEMBERS } from '@/lib/constants'
import { getCurrentUser, clearCurrentUser } from '@/lib/auth'
import FilterBar from '@/components/FilterBar'
import RequestGrid from '@/components/RequestGrid'
import RequestForm from '@/components/RequestForm'
import WorkloadPanel from '@/components/WorkloadPanel'
import ConfirmDialog from '@/components/ConfirmDialog'

const MEMBER_EMOJI: Record<string, string> = {
  '구자영': '🐱', '윤난희': '🐰', '방수진': '🐻', '박종민': '🦊', '허주희': '🐼',
}

const EMPTY_FILTERS: FilterState = {
  team: '', status: '', assignee: '', priority: '', search: '',
  jiraStatus: '', unassignedOnly: false, excludeDone: false,
}

type Toast = { id: number; type: 'success' | 'error' | 'info'; message: string }

interface ConfirmState {
  title: string
  message: string
  onConfirm: () => void
}

export default function HomePage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  const [requests, setRequests]     = useState<Request[]>([])
  const [loading, setLoading]       = useState(true)
  const [filters, setFilters]       = useState<FilterState>(EMPTY_FILTERS)
  const [editing, setEditing]       = useState<Request | null>(null)
  const [showForm, setShowForm]     = useState(false)
  const [syncing, setSyncing]       = useState(false)
  const [toasts, setToasts]         = useState<Toast[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [confirm, setConfirm]       = useState<ConfirmState | null>(null)

  /* ── Toast ── */
  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  /* ── 로그인 체크 ── */
  useEffect(() => {
    const user = getCurrentUser()
    if (!user) { router.replace('/login'); return }
    setCurrentUser(user)
    setAuthChecked(true)
  }, [router])

  /* ── 데이터 로드 ── */
  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/requests')
      if (!res.ok) throw new Error(await res.text())
      setRequests(await res.json())
    } catch (e: unknown) {
      addToast('error', `데이터 로드 실패: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => { fetchAll() }, [fetchAll])

  /* ── 파생 데이터 ── */
  const workload = useMemo<WorkloadItem[]>(() => {
    const map = new Map<string, WorkloadItem>(
      TEAM_MEMBERS.map(name => [name, { assignee: name, active: 0, total: 0 }])
    )
    for (const r of requests) {
      if (!r.assignee || !map.has(r.assignee)) continue
      const item = map.get(r.assignee)!
      item.total++
      if (r.status !== '완료') item.active++
    }
    return Array.from(map.values())
  }, [requests])

  const filtered = useMemo(() => {
    const q = filters.search.toLowerCase()
    return requests.filter(r => {
      if (filters.team           && r.request_team !== filters.team)                   return false
      if (filters.status         && r.status       !== filters.status)                 return false
      if (filters.assignee       && r.assignee     !== filters.assignee)               return false
      if (filters.priority       && r.priority     !== filters.priority)               return false
      if (filters.jiraStatus     && r.jira_status  !== filters.jiraStatus)             return false
      if (filters.unassignedOnly && r.assignee?.trim())                                return false
      if (filters.excludeDone   && r.status === '완료')                               return false
      if (q && !r.title.toLowerCase().includes(q) &&
               !r.requester.toLowerCase().includes(q) &&
               !r.summary.toLowerCase().includes(q)) return false
      return true
    })
  }, [requests, filters])

  const stats = useMemo(() => ({
    접수:   requests.filter(r => r.status === '접수').length,
    검토중: requests.filter(r => r.status === '검토중').length,
    기획중: requests.filter(r => r.status === '기획중').length,
    완료:   requests.filter(r => r.status === '완료').length,
    overdue: requests.filter(r => {
      if (!r.due_date || r.status === '완료') return false
      return new Date(r.due_date) < new Date(new Date().toDateString())
    }).length,
  }), [requests])

  /* ── 선택 핸들러 ── */
  const handleToggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleToggleSelectAll = () => {
    if (filtered.every(r => selectedIds.has(r.id))) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        filtered.forEach(r => next.delete(r.id))
        return next
      })
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev)
        filtered.forEach(r => next.add(r.id))
        return next
      })
    }
  }

  /* ── 실제 삭제 실행 ── */
  const executeDelete = async (ids: number[]) => {
    const results = await Promise.all(
      ids.map(id => fetch(`/api/requests/${id}`, {
        method: 'DELETE',
        headers: { 'X-User-Name': currentUser ?? '' },
      }))
    )
    const failed = results.filter(r => !r.ok).length
    if (failed > 0) {
      addToast('error', `${failed}건 삭제 실패`)
    } else {
      setRequests(prev => prev.filter(r => !ids.includes(r.id)))
      setSelectedIds(prev => {
        const next = new Set(prev)
        ids.forEach(id => next.delete(id))
        return next
      })
      addToast('success', `${ids.length}건이 삭제되었습니다.`)
    }
    setConfirm(null)
  }

  /* ── 단건 삭제 (컨펌 후) ── */
  const handleDeleteSingle = (r: Request) => {
    setConfirm({
      title: '항목 삭제',
      message: `"${r.title}" 항목을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
      onConfirm: () => executeDelete([r.id]),
    })
  }

  /* ── 다중 삭제 (컨펌 후) ── */
  const handleDeleteSelected = () => {
    const ids = Array.from(selectedIds)
    setConfirm({
      title: `${ids.length}건 삭제`,
      message: `선택한 ${ids.length}건을 모두 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
      onConfirm: () => executeDelete(ids),
    })
  }

  /* ── CRUD ── */
  const handleSave = async (data: RequestInput) => {
    if (editing) {
      const res = await fetch(`/api/requests/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-User-Name': currentUser ?? '' },
        body: JSON.stringify(data),
      })
      if (!res.ok) { addToast('error', '수정 실패'); return }
      const updated: Request = await res.json()
      setRequests(prev => prev.map(r => r.id === updated.id ? updated : r))
      addToast('success', '요청이 수정되었습니다.')
    } else {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Name': currentUser ?? '' },
        body: JSON.stringify(data),
      })
      if (!res.ok) { addToast('error', '등록 실패'); return }
      const created: Request = await res.json()
      setRequests(prev => [created, ...prev])
      addToast('success', '새 요청이 등록되었습니다.')
    }
    setEditing(null)
    setShowForm(false)
  }

  const patchField = async (id: number, patch: Partial<Request>, successMsg: string) => {
    const res = await fetch(`/api/requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-User-Name': currentUser ?? '' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) { addToast('error', '변경 실패'); return }
    const updated: Request = await res.json()
    setRequests(prev => prev.map(r => r.id === updated.id ? updated : r))
    addToast('info', successMsg)
  }

  const handleStatusChange   = (id: number, status: Status) =>
    patchField(id, { status }, `상태 → "${status}"`)
  const handleAssigneeChange = (id: number, assignee: string) =>
    patchField(id, { assignee }, assignee ? `담당자 → "${assignee}"` : '담당자 해제')
  const handleDueDateChange  = (id: number, due_date: string | null) =>
    patchField(id, { due_date } as Partial<Request>, due_date ? `완료 예정일 → ${due_date}` : '완료 예정일 삭제')
  const handleTeamChange     = (id: number, request_team: string) =>
    patchField(id, { request_team }, `요청팀 → "${request_team}"`)

  /* ── Jira 동기화 ── */
  const handleJiraSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/jira/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      addToast('success', data.message)
      await fetchAll()
    } catch (e: unknown) {
      addToast('error', `지라 동기화 실패: ${(e as Error).message}`)
    } finally {
      setSyncing(false)
    }
  }

  const selectedCount = selectedIds.size

  const handleLogout = () => {
    clearCurrentUser()
    router.replace('/login')
  }

  // 로그인 확인 전 로딩 스피너
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <svg className="w-8 h-8 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── 헤더 ── */}
      <header className="bg-white border-b border-gray-200 px-3 md:px-6 py-3 flex items-center justify-between shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-tight">Pharo-Sort</h1>
              <p className="hidden md:block text-xs text-gray-400">파로스 기획팀 요청 관리 시스템 / 파로스(Pharos) + 분류(Sort)</p>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-1.5 bg-gray-100 rounded-xl p-1">
            <span className="text-sm font-semibold text-white bg-indigo-600 px-4 py-1.5 rounded-lg shadow-sm">
              📋 요청 목록
            </span>
            <a href="/dashboard" className="text-sm font-medium text-gray-500 hover:text-gray-700 px-4 py-1.5 rounded-lg transition-colors">
              👥 담당자 대시보드
            </a>
          </nav>
        </div>

        {/* 현재 유저 + 로그아웃 + 이력(subtle) */}
        <div className="hidden md:flex items-center gap-2 border-r border-gray-100 pr-3 mr-1">
          <span className="text-sm">{MEMBER_EMOJI[currentUser ?? ''] ?? '👤'}</span>
          <span className="text-sm font-medium text-gray-700">{currentUser}</span>
          <button onClick={handleLogout} className="text-xs text-gray-300 hover:text-gray-500 transition-colors ml-1">
            로그아웃
          </button>
          <a href="/history" className="text-gray-300 hover:text-gray-500 transition-colors" title="변경 이력 보기">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </a>
        </div>

        <div className="flex items-center gap-1.5 md:gap-3">
          {/* 통계 칩 — 클릭 시 해당 상태 필터 */}
          <div className="hidden md:flex items-center gap-2 text-xs">
            {(
              [
                { label: '접수',   count: stats.접수,   color: 'bg-blue-100 text-blue-700 hover:bg-blue-200',     active: 'ring-2 ring-blue-400' },
                { label: '검토중', count: stats.검토중, color: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200', active: 'ring-2 ring-yellow-400' },
                { label: '기획중', count: stats.기획중, color: 'bg-purple-100 text-purple-700 hover:bg-purple-200', active: 'ring-2 ring-purple-400' },
                { label: '완료',   count: stats.완료,   color: 'bg-green-100 text-green-700 hover:bg-green-200',   active: 'ring-2 ring-green-400' },
              ] as const
            ).map(({ label, count, color, active }) => (
              <button
                key={label}
                onClick={() => setFilters(f => ({ ...f, status: f.status === label ? '' : label }))}
                className={`px-2.5 py-1 rounded-full font-medium transition-all cursor-pointer ${color} ${filters.status === label ? active : ''}`}
              >
                {label} {count}
              </button>
            ))}
            {stats.overdue > 0 && (
              <span className="bg-red-100 text-red-600 font-bold px-2.5 py-1 rounded-full animate-pulse">
                지연 {stats.overdue}
              </span>
            )}
          </div>

          {/* 모바일 상태 요약 칩 */}
          <div className="flex md:hidden items-center gap-1 text-xs">
            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{stats.접수}</span>
            <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">{stats.검토중}</span>
            <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">{stats.기획중}</span>
            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{stats.완료}</span>
            {stats.overdue > 0 && <span className="bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full animate-pulse">⚠{stats.overdue}</span>}
          </div>

          {/* 다중 삭제 버튼 */}
          {selectedCount > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm bg-red-50 border border-red-200 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
              <span className="hidden sm:inline">선택 삭제 ({selectedCount})</span>
              <span className="sm:hidden">({selectedCount})</span>
            </button>
          )}

          {/* Jira 동기화 */}
          <button
            onClick={handleJiraSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <svg className={`w-4 h-4 shrink-0 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            <span className="hidden sm:inline">{syncing ? 'Jira 동기화 중...' : 'Jira 동기화'}</span>
          </button>

          {/* 새 요청 등록 */}
          <button
            onClick={() => { setEditing(null); setShowForm(true) }}
            className="flex items-center gap-1.5 px-3 md:px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
            </svg>
            <span className="hidden sm:inline">새 요청 등록</span>
            <span className="sm:hidden">등록</span>
          </button>
        </div>
      </header>

      {/* ── 모바일 하단 네비 ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-20 shadow-lg">
        <span className="flex-1 flex flex-col items-center justify-center py-2.5 text-indigo-600 border-t-2 border-indigo-600">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
          <span className="text-xs font-bold mt-0.5">요청 목록</span>
        </span>
        <a href="/dashboard" className="flex-1 flex flex-col items-center justify-center py-2.5 text-gray-400 border-t-2 border-transparent">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
          </svg>
          <span className="text-xs mt-0.5">대시보드</span>
        </a>
      </nav>

      {/* ── 메인 ── */}
      <main className="flex-1 flex flex-col gap-3 md:gap-4 p-3 md:p-5 pb-20 md:pb-5">
        <FilterBar
          filters={filters}
          onChange={setFilters}
          onReset={() => setFilters(EMPTY_FILTERS)}
        />

        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            {loading ? '불러오는 중...' : (
              <>
                <strong className="text-gray-800">{filtered.length}</strong>건
                {filtered.length !== requests.length && (
                  <span className="text-gray-400"> / 전체 {requests.length}건</span>
                )}
                {selectedCount > 0 && (
                  <span className="ml-2 text-indigo-600 font-medium">{selectedCount}건 선택됨</span>
                )}
              </>
            )}
          </span>
          <button
            onClick={fetchAll}
            className="text-xs text-gray-400 hover:text-indigo-500 transition-colors flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            새로고침
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-3 md:gap-4 md:items-start">
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="bg-white border border-gray-200 rounded-lg p-10 text-center text-gray-400">
                <svg className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                데이터를 불러오는 중입니다...
              </div>
            ) : (
              <RequestGrid
                requests={filtered}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onToggleSelectAll={handleToggleSelectAll}
                onEdit={r => { setEditing(r); setShowForm(true) }}
                onDeleteSingle={handleDeleteSingle}
                onStatusChange={handleStatusChange}
                onAssigneeChange={handleAssigneeChange}
                onDueDateChange={handleDueDateChange}
                onTeamChange={handleTeamChange}
              />
            )}
          </div>

          <WorkloadPanel
            workload={workload}
            selectedAssignee={filters.assignee}
            onSelect={name => setFilters(f => ({ ...f, assignee: name }))}
          />
        </div>
      </main>

      {/* ── 범례 ── */}
      <footer className="hidden md:flex px-5 py-3 border-t border-gray-100 bg-white items-center gap-6 text-xs text-gray-400">
        <div className="flex items-center gap-2">
          <span className="w-4 h-3 rounded bg-red-100 border border-red-200 inline-block" />
          완료 예정일 초과 (지연)
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-3 rounded bg-indigo-100 border border-indigo-200 inline-block" />
          선택된 항목
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-3 rounded bg-gray-50 border border-gray-200 inline-block" />
          완료 항목
        </div>
      </footer>

      {/* ── 모달들 ── */}
      {showForm && (
        <RequestForm
          initial={editing}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null) }}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel="삭제"
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* ── 토스트 ── */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50">
        {toasts.map(t => (
          <div key={t.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white transition-all
              ${t.type === 'success' ? 'bg-green-600' : t.type === 'error' ? 'bg-red-600' : 'bg-indigo-600'}`}
          >
            {t.type === 'success' && <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>}
            {t.type === 'error'   && <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>}
            {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}
