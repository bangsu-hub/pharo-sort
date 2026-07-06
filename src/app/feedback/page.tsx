'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { Feedback, FeedbackStatus, FeedbackType } from '@/types'

const MEMBER_EMOJI: Record<string, string> = {
  '구자영': '🐰', '윤난희': '🐮', '방수진': '🐷', '박종민': '🐑', '허주희': '🐴', '신지희': '🐯',
}

const STATUSES: FeedbackStatus[] = ['접수', '확인중', '반영완료', '반려']
const TYPES: FeedbackType[] = ['버그', '개선요청', '신규기능']

const STATUS_STYLE: Record<FeedbackStatus, string> = {
  '접수':   'bg-blue-100 text-blue-700',
  '확인중': 'bg-yellow-100 text-yellow-700',
  '반영완료': 'bg-green-100 text-green-700',
  '반려':   'bg-gray-100 text-gray-500',
}

const TYPE_STYLE: Record<FeedbackType, string> = {
  '버그':     'bg-red-100 text-red-600',
  '개선요청': 'bg-indigo-100 text-indigo-600',
  '신규기능': 'bg-purple-100 text-purple-600',
}

const IMAGE_MARKDOWN = /!\[[^\]]*\]\(([^)]+)\)/g
function extractImageUrls(text: string): string[] {
  return Array.from(text.matchAll(IMAGE_MARKDOWN)).map(m => m[1])
}
function stripImageMarkdown(text: string): string {
  return text.replace(IMAGE_MARKDOWN, '').trim()
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

export default function FeedbackPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [items, setItems] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<FeedbackStatus | ''>('')
  const [filterType, setFilterType] = useState<FeedbackType | ''>('')
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  const load = () => {
    fetch('/api/feedback')
      .then(r => r.json())
      .then(data => { setItems(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) { router.replace('/login'); return }
    setCurrentUser(user)
    load()
  }, [router])

  const filtered = useMemo(() => items.filter(f => {
    if (filterStatus && f.status !== filterStatus) return false
    if (filterType   && f.type   !== filterType)   return false
    return true
  }), [items, filterStatus, filterType])

  const handleStatusChange = async (id: number, status: FeedbackStatus) => {
    const res = await fetch(`/api/feedback/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) return
    const updated: Feedback = await res.json()
    setItems(prev => prev.map(f => f.id === updated.id ? updated : f))
  }

  const handleDelete = async (id: number) => {
    if (!confirm('이 피드백을 삭제하시겠습니까?')) return
    const res = await fetch(`/api/feedback/${id}`, { method: 'DELETE' })
    if (!res.ok) return
    setItems(prev => prev.filter(f => f.id !== id))
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex items-center gap-3 shadow-sm sticky top-0 z-20">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <div>
          <h1 className="text-base font-bold text-gray-900 leading-tight">피드백 확인</h1>
          <p className="text-xs text-gray-400">팀원들이 남긴 Pharo-Sort 버그/개선요청/신규기능</p>
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
          <div className="flex gap-1 flex-wrap">
            {(['', ...STATUSES] as const).map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all border whitespace-nowrap ${
                  filterStatus === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-500'
                }`}>
                {s === '' ? '전체 상태' : s}
              </button>
            ))}
          </div>
          <div className="flex gap-1 flex-wrap">
            {(['', ...TYPES] as const).map(t => (
              <button key={t} onClick={() => setFilterType(t)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all border whitespace-nowrap ${
                  filterType === t ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                }`}>
                {t === '' ? '전체 유형' : t}
              </button>
            ))}
          </div>
          <span className="ml-auto text-xs text-gray-400 font-medium">{filtered.length}건</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <svg className="w-7 h-7 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl py-16 text-center text-sm text-gray-400">
            남겨진 피드백이 없습니다
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(f => {
              const images = extractImageUrls(f.description)
              const textOnly = stripImageMarkdown(f.description)
              return (
                <div key={f.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 flex flex-col items-center gap-1 w-12">
                      <span className="text-2xl">{MEMBER_EMOJI[f.user_name] ?? '👤'}</span>
                      <span className="text-xs font-medium text-gray-600 text-center leading-tight">{f.user_name}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_STYLE[f.type]}`}>{f.type}</span>
                        <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">{f.page}</span>
                        {f.related_request_id != null && (
                          <span className="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">업무 #{f.related_request_id}</span>
                        )}
                        <span className="text-sm font-medium text-gray-800">{f.title}</span>
                      </div>
                      {textOnly && <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{textOnly}</p>}
                      {images.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {images.map(url => (
                            <button key={url} onClick={() => setPreviewImage(url)}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt="첨부 이미지" className="w-16 h-16 object-cover rounded-md border border-gray-200 hover:opacity-80 transition-opacity" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-1.5">
                      <select
                        value={f.status}
                        onChange={e => handleStatusChange(f.id, e.target.value as FeedbackStatus)}
                        className={`text-xs font-medium rounded-full px-2 py-1 border-0 focus:outline-none focus:ring-1 focus:ring-indigo-300 ${STATUS_STYLE[f.status]}`}
                      >
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <p className="text-xs text-gray-300">{timeAgo(f.created_at)}</p>
                      <button onClick={() => handleDelete(f.id)} className="text-xs text-gray-300 hover:text-red-500 transition-colors">
                        삭제
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {previewImage && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-3xl max-h-[85vh]" onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewImage} alt="첨부 이미지 미리보기" className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain" />
            <button onClick={() => setPreviewImage(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white text-gray-700 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-100 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
