'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Request, RequestInput } from '@/types'
import { getCurrentUser, clearCurrentUser } from '@/lib/auth'
import GlobalTimeline from '@/components/GlobalTimeline'
import RequestForm from '@/components/RequestForm'

const MEMBER_EMOJI: Record<string, string> = {
  '구자영': '🐰', '윤난희': '🐮', '방수진': '🐷', '박종민': '🐑', '허주희': '🐴', '신지희': '🐯',
}

type Toast = { id: number; type: 'success' | 'error' | 'info'; message: string }

export default function TimelinePage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [showDone, setShowDone] = useState(false)
  const [editing, setEditing] = useState<Request | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<number>>(new Set())

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = Date.now()
    setToasts(p => [...p, { id, type, message }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000)
  }, [])

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) { router.replace('/login'); return }
    setCurrentUser(user)
    setAuthChecked(true)
    fetch('/api/requests')
      .then(r => r.json())
      .then(data => { setRequests(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [router])

  const handleLogout = () => { clearCurrentUser(); router.replace('/login') }

  const activeRequests = useMemo(
    () => showDone ? requests : requests.filter(r => r.status !== '완료'),
    [requests, showDone]
  )

  const historiedTaskIds = useMemo(
    () => activeRequests.filter(r => (r.schedule_history?.length ?? 0) > 0).map(r => r.id),
    [activeRequests]
  )
  const allHistoryOpen = historiedTaskIds.length > 0 && historiedTaskIds.every(id => expandedTaskIds.has(id))

  const toggleHistory = (id: number) => {
    setExpandedTaskIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const toggleAllHistory = () => {
    setExpandedTaskIds(allHistoryOpen ? new Set() : new Set(historiedTaskIds))
  }

  const handleSave = async (data: RequestInput) => {
    if (!editing) return
    const res = await fetch(`/api/requests/${editing.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-User-Name': encodeURIComponent(currentUser ?? '') },
      body: JSON.stringify(data),
    })
    if (!res.ok) { addToast('error', '수정 실패'); return }
    const updated: Request = await res.json()
    setRequests(prev => prev.map(r => r.id === updated.id ? updated : r))
    addToast('success', '업무가 수정되었습니다.')
    setEditing(null)
    setShowForm(false)
  }

  if (!authChecked || loading) {
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
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* 토스트 */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium text-white animate-fade-in
            ${t.type === 'success' ? 'bg-green-500' : t.type === 'error' ? 'bg-red-500' : 'bg-indigo-500'}`}>
            {t.message}
          </div>
        ))}
      </div>

      {/* 헤더 */}
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
              <p className="hidden md:block text-xs text-gray-400">파로스 기획팀 업무 관리 시스템 / 파로스(Pharos) + 분류(Sort)</p>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-1.5 bg-gray-100 rounded-xl p-1">
            <a href="/" className="text-sm font-medium text-gray-500 hover:text-gray-700 px-4 py-1.5 rounded-lg transition-colors">
              📋 업무 목록
            </a>
            <a href="/dashboard" className="text-sm font-medium text-gray-500 hover:text-gray-700 px-4 py-1.5 rounded-lg transition-colors">
              👥 담당자 대시보드
            </a>
            <span className="text-sm font-semibold text-white bg-indigo-600 px-4 py-1.5 rounded-lg shadow-sm">
              📅 캘린더
            </span>
          </nav>
        </div>
        <div className="hidden md:flex items-center gap-2 border-l border-gray-100 pl-3">
          <span className="text-sm">{MEMBER_EMOJI[currentUser ?? ''] ?? '👤'}</span>
          <span className="text-sm font-medium text-gray-700">{currentUser}</span>
          <button onClick={handleLogout} className="text-xs text-gray-300 hover:text-gray-500 transition-colors ml-1">
            로그아웃
          </button>
          <a href="/history" className="text-xs text-gray-400 hover:text-indigo-500 transition-colors whitespace-nowrap">
            변경이력보기
          </a>
          <a href="/settings" className="text-xs text-gray-400 hover:text-indigo-500 transition-colors whitespace-nowrap">
            ⚙️ 설정
          </a>
        </div>
      </header>

      {/* 모바일 하단 네비 */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-20 shadow-lg">
        <a href="/" className="flex-1 flex flex-col items-center justify-center py-2.5 text-gray-400 border-t-2 border-transparent">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
          <span className="text-xs mt-0.5">업무 목록</span>
        </a>
        <a href="/dashboard" className="flex-1 flex flex-col items-center justify-center py-2.5 text-gray-400 border-t-2 border-transparent">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
          </svg>
          <span className="text-xs mt-0.5">대시보드</span>
        </a>
        <span className="flex-1 flex flex-col items-center justify-center py-2.5 text-indigo-600 border-t-2 border-indigo-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
          <span className="text-xs font-bold mt-0.5">캘린더</span>
        </span>
      </nav>

      <main className="flex-1 flex flex-col gap-4 p-3 md:p-5 pb-20 md:pb-6">

        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h2 className="text-sm font-bold text-gray-800">전체 담당자 통합 캘린더</h2>
            <p className="text-xs text-gray-400 mt-0.5">기획시작일자~기획완료예정일 구간을 담당자별로 모아봅니다. 막대 클릭 시 수정할 수 있습니다.</p>
          </div>
          {historiedTaskIds.length > 0 && (
            <button
              onClick={toggleAllHistory}
              className={`ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                allHistoryOpen
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-400 hover:text-indigo-600'
              }`}
            >
              ⚠️ 일정 변경 이력 {allHistoryOpen ? '전체 닫기' : '전체 보기'}
            </button>
          )}
          <button
            onClick={() => setShowDone(v => !v)}
            className={`${historiedTaskIds.length > 0 ? '' : 'ml-auto'} flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
              showDone
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-white text-gray-500 border-gray-200 hover:border-green-400 hover:text-green-600'
            }`}
          >
            완료 건 {showDone ? '숨기기' : '보기'}
          </button>
        </div>

        <GlobalTimeline
          requests={activeRequests}
          onSelectIssue={r => { setEditing(r); setShowForm(true) }}
          expandedTaskIds={expandedTaskIds}
          onToggleHistory={toggleHistory}
        />

      </main>

      {showForm && (
        <RequestForm
          initial={editing}
          currentUser={currentUser}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null) }}
        />
      )}
    </div>
  )
}
