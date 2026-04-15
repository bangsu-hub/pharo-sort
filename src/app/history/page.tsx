'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'

const MEMBER_EMOJI: Record<string, string> = {
  '구자영': '🐰', '윤난희': '🐂', '방수진': '🐷', '박종민': '🐑', '허주희': '🐴',
}

const ACTION_STYLE = {
  create: { label: '등록', bg: 'bg-green-100', text: 'text-green-700' },
  update: { label: '수정', bg: 'bg-blue-100',  text: 'text-blue-700'  },
  delete: { label: '삭제', bg: 'bg-red-100',   text: 'text-red-600'   },
} as const

interface Log {
  id: number
  user_name: string
  action: 'create' | 'update' | 'delete'
  request_id: number | null
  request_title: string
  field_name: string | null
  field_label: string | null
  old_value: string | null
  new_value: string | null
  created_at: string
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return '방금'
  if (mins < 60) return `${mins}분 전`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days < 7)  return `${days}일 전`
  return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function fmt(val: string | null): string {
  return val?.trim() ? val : '(없음)'
}

export default function HistoryPage() {
  const router = useRouter()
  const [logs, setLogs]           = useState<Log[]>([])
  const [loading, setLoading]     = useState(true)
  const [filterUser, setFilterUser]     = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [currentUser, setCurrentUser]   = useState<string | null>(null)

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) { router.replace('/login'); return }
    setCurrentUser(user)
    fetch('/api/logs')
      .then(r => r.json())
      .then(data => { setLogs(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [router])

  const allUsers = useMemo(() => Array.from(new Set(logs.map(l => l.user_name))), [logs])

  const filtered = useMemo(() => logs.filter(l => {
    if (filterUser   && l.user_name !== filterUser)   return false
    if (filterAction && l.action    !== filterAction) return false
    return true
  }), [logs, filterUser, filterAction])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex items-center gap-3 shadow-sm sticky top-0 z-20">
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <div>
          <h1 className="text-base font-bold text-gray-900 leading-tight">변경 이력</h1>
          <p className="text-xs text-gray-400">누가 언제 무엇을 바꿨는지 기록</p>
        </div>
        {currentUser && (
          <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-400">
            <span>{MEMBER_EMOJI[currentUser] ?? '👤'}</span>
            <span>{currentUser}</span>
          </div>
        )}
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto p-4 md:p-6 space-y-4">

        {/* 필터 */}
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex flex-wrap gap-2 items-center shadow-sm">
          <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 010 2H4a1 1 0 01-1-1zm3 5a1 1 0 011-1h10a1 1 0 010 2H7a1 1 0 01-1-1zm4 5a1 1 0 011-1h2a1 1 0 010 2h-2a1 1 0 01-1-1z"/>
          </svg>
          <select
            value={filterUser}
            onChange={e => setFilterUser(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-300"
          >
            <option value="">전체 멤버</option>
            {allUsers.map(u => (
              <option key={u} value={u}>{MEMBER_EMOJI[u] ?? '👤'} {u}</option>
            ))}
          </select>

          <div className="flex gap-1">
            {(['', 'create', 'update', 'delete'] as const).map(a => (
              <button
                key={a}
                onClick={() => setFilterAction(a)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all border whitespace-nowrap ${
                  filterAction === a
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-500'
                }`}
              >
                {a === '' ? '전체' : a === 'create' ? '등록' : a === 'update' ? '수정' : '삭제'}
              </button>
            ))}
          </div>

          <span className="ml-auto text-xs text-gray-400 font-medium">{filtered.length}건</span>
        </div>

        {/* 이력 리스트 */}
        {loading ? (
          <div className="flex justify-center py-16">
            <svg className="w-7 h-7 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl py-16 text-center text-sm text-gray-400">
            이력이 없습니다
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(log => {
              const style = ACTION_STYLE[log.action]
              const emoji = MEMBER_EMOJI[log.user_name] ?? '👤'
              return (
                <div key={log.id}
                  className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex gap-3 shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* 왼쪽: 이모지 + 이름 */}
                  <div className="shrink-0 flex flex-col items-center gap-1 w-12">
                    <span className="text-2xl">{emoji}</span>
                    <span className="text-xs font-medium text-gray-600 text-center leading-tight">{log.user_name}</span>
                  </div>

                  {/* 중앙: 내용 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                        {style.label}
                      </span>
                      <span className="text-sm font-medium text-gray-800 truncate">
                        &ldquo;{log.request_title}&rdquo;
                      </span>
                    </div>

                    {log.action === 'update' && log.field_label && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <span className="text-xs text-gray-400 font-medium">{log.field_label}</span>
                        <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded font-medium line-through">
                          {fmt(log.old_value)}
                        </span>
                        <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                        </svg>
                        <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded font-medium">
                          {fmt(log.new_value)}
                        </span>
                      </div>
                    )}
                    {log.action === 'create' && (
                      <p className="text-xs text-gray-400 mt-0.5">새 요청이 등록되었습니다.</p>
                    )}
                    {log.action === 'delete' && (
                      <p className="text-xs text-red-400 mt-0.5">요청이 삭제되었습니다.</p>
                    )}
                  </div>

                  {/* 오른쪽: 시간 */}
                  <div className="shrink-0 text-right min-w-[56px]">
                    <p className="text-xs font-medium text-gray-500">{timeAgo(log.created_at)}</p>
                    <p className="text-xs text-gray-300 mt-0.5">
                      {new Date(log.created_at).toLocaleString('ko-KR', {
                        month: 'numeric', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
