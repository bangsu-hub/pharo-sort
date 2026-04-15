'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Request } from '@/types'
import { getCurrentUser, clearCurrentUser } from '@/lib/auth'
import { getWeekBounds, getWeekDays, isOverdue, isThisWeek, toDateStr } from '@/lib/weekUtils'
import TimelineCard from '@/components/TimelineCard'

const MEMBER_EMOJI: Record<string, string> = {
  '구자영': '🐰', '윤난희': '🐮', '방수진': '🐷', '박종민': '🐑', '허주희': '🐴',
}

type Toast = { id: number; type: 'success' | 'error' | 'info'; message: string }

export default function TimelinePage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [dragOverDay, setDragOverDay] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)

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

  /* ── 주간 데이터 계산 ── */
  const weekDays = useMemo(() => getWeekDays(), [])
  const todayStr = useMemo(() => toDateStr(new Date()), [])
  const { mondayStr, fridayStr } = useMemo(() => getWeekBounds(), [])

  const activeRequests = useMemo(
    () => showDone ? requests : requests.filter(r => r.status !== '완료'),
    [requests, showDone]
  )

  /* 요일별 컬럼 Map */
  const columns = useMemo(() => {
    const map = new Map<string, Request[]>()
    weekDays.forEach(d => map.set(d.dateStr, []))
    activeRequests.forEach(r => {
      if (r.due_date && isThisWeek(r.due_date)) {
        map.get(r.due_date)?.push(r)
      }
    })
    // 각 컬럼: 기한 초과 먼저, 그 다음 id 역순
    map.forEach((arr, key) => {
      map.set(key, [...arr].sort((a, b) => {
        const ao = isOverdue(a) ? 0 : 1
        const bo = isOverdue(b) ? 0 : 1
        return ao !== bo ? ao - bo : b.id - a.id
      }))
    })
    return map
  }, [activeRequests, weekDays])

  /* 미배정 / 이번 주 외 */
  const unscheduled = useMemo(
    () => activeRequests.filter(r => !r.due_date || !isThisWeek(r.due_date)),
    [activeRequests]
  )

  /* ── 드래그앤드롭 ── */
  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, id: number) => {
    e.dataTransfer.setData('requestId', String(id))
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, dateStr: string | null) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverDay(dateStr)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent, newDateStr: string | null) => {
    e.preventDefault()
    setDragOverDay(null)
    const id = Number(e.dataTransfer.getData('requestId'))
    if (!id) return

    const prev = requests.find(r => r.id === id)
    if (!prev) return
    if (prev.due_date === newDateStr) return   // 변화 없음

    // 낙관적 업데이트
    setRequests(reqs => reqs.map(r => r.id === id ? { ...r, due_date: newDateStr } : r))

    try {
      const res = await fetch(`/api/requests/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Name': encodeURIComponent(currentUser ?? ''),
        },
        body: JSON.stringify({ due_date: newDateStr }),
      })
      if (!res.ok) throw new Error('업데이트 실패')
      addToast('info', newDateStr ? `완료 예정일 → ${newDateStr}` : '완료 예정일 삭제')
    } catch {
      // 롤백
      setRequests(reqs => reqs.map(r => r.id === id ? { ...r, due_date: prev.due_date } : r))
      addToast('error', '날짜 변경에 실패했습니다.')
    }
  }, [requests, currentUser, addToast])

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
              <p className="hidden md:block text-xs text-gray-400">파로스 기획팀 요청 관리 시스템 / 파로스(Pharos) + 분류(Sort)</p>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-1.5 bg-gray-100 rounded-xl p-1">
            <a href="/" className="text-sm font-medium text-gray-500 hover:text-gray-700 px-4 py-1.5 rounded-lg transition-colors">
              📋 요청 목록
            </a>
            <a href="/dashboard" className="text-sm font-medium text-gray-500 hover:text-gray-700 px-4 py-1.5 rounded-lg transition-colors">
              👥 담당자 대시보드
            </a>
            <span className="text-sm font-semibold text-white bg-indigo-600 px-4 py-1.5 rounded-lg shadow-sm">
              📅 주간 타임라인
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
        </div>
      </header>

      {/* 모바일 하단 네비 */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-20 shadow-lg">
        <a href="/" className="flex-1 flex flex-col items-center justify-center py-2.5 text-gray-400 border-t-2 border-transparent">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
          <span className="text-xs mt-0.5">요청 목록</span>
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
          <span className="text-xs font-bold mt-0.5">타임라인</span>
        </span>
      </nav>

      <main className="flex-1 flex flex-col gap-4 p-3 md:p-5 pb-20 md:pb-6 overflow-hidden">

        {/* 주간 헤더 + 옵션 */}
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h2 className="text-sm font-bold text-gray-800">
              {mondayStr.slice(0, 7).replace('-', '년 ')}월 &nbsp;
              <span className="text-indigo-600">{mondayStr.slice(8)}일(월)</span>
              {' ~ '}
              <span className="text-indigo-600">{fridayStr.slice(8)}일(금)</span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">완료 예정일 기준으로 배치됩니다. 카드를 드래그해서 날짜를 변경하세요.</p>
          </div>
          <button
            onClick={() => setShowDone(v => !v)}
            className={`ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
              showDone
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-white text-gray-500 border-gray-200 hover:border-green-400 hover:text-green-600'
            }`}
          >
            완료 건 {showDone ? '숨기기' : '보기'}
          </button>
        </div>

        {/* ── 5컬럼 타임라인 ── */}
        <div className="grid grid-cols-5 gap-2 md:gap-3 flex-1 min-h-0">
          {weekDays.map(day => {
            const isToday = day.dateStr === todayStr
            const isOver  = dragOverDay === day.dateStr
            const cards   = columns.get(day.dateStr) ?? []
            const overdueCount = cards.filter(isOverdue).length

            return (
              <div
                key={day.dateStr}
                onDragOver={e => handleDragOver(e, day.dateStr)}
                onDragLeave={() => setDragOverDay(null)}
                onDrop={e => handleDrop(e, day.dateStr)}
                className={`
                  rounded-xl flex flex-col gap-2 p-2 md:p-3
                  overflow-y-auto transition-all duration-150
                  ${isToday ? 'bg-indigo-50 ring-2 ring-indigo-300' : 'bg-gray-100'}
                  ${isOver  ? 'ring-2 ring-blue-400 bg-blue-50 scale-[1.01]' : ''}
                `}
                style={{ minHeight: '420px' }}
              >
                {/* 컬럼 헤더 */}
                <div className={`flex items-center gap-1 pb-1 border-b ${isToday ? 'border-indigo-200' : 'border-gray-200'}`}>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold ${isToday ? 'text-indigo-700' : 'text-gray-600'}`}>
                      {day.label}
                    </p>
                    {isToday && (
                      <span className="text-xs bg-indigo-600 text-white px-1.5 py-0.5 rounded-full font-semibold">
                        오늘
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {overdueCount > 0 && (
                      <span className="text-xs bg-red-500 text-white font-bold w-4 h-4 rounded-full flex items-center justify-center">
                        {overdueCount}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{cards.length}</span>
                  </div>
                </div>

                {/* 카드 목록 */}
                {cards.map(r => (
                  <TimelineCard key={r.id} request={r} onDragStart={handleDragStart} />
                ))}

                {/* 드롭 힌트 */}
                {isOver && (
                  <div className="border-2 border-dashed border-blue-300 rounded-lg h-16 flex items-center justify-center">
                    <span className="text-xs text-blue-400">여기에 놓기</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* ── 미배정 / 이번 주 외 섹션 ── */}
        <div className="bg-white border border-gray-200 rounded-xl p-3 md:p-4">
          <h3 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            미배정 / 이번 주 외
            <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">
              {unscheduled.length}건
            </span>
          </h3>
          {unscheduled.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">모든 건에 이번 주 완료 예정일이 설정되어 있습니다 🎉</p>
          ) : (
            <div
              className={`flex flex-wrap gap-2 min-h-[60px] p-2 rounded-lg border-2 border-dashed transition-colors ${
                dragOverDay === '__unscheduled' ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
              }`}
              onDragOver={e => handleDragOver(e, '__unscheduled')}
              onDragLeave={() => setDragOverDay(null)}
              onDrop={e => handleDrop(e, null)}
            >
              {unscheduled.map(r => (
                <div key={r.id} className="w-48">
                  <TimelineCard request={r} onDragStart={handleDragStart} />
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  )
}
