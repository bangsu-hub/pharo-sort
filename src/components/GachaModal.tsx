'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Request } from '@/types'
import { TEAM_MEMBERS } from '@/lib/constants'

const MEMBER_EMOJI: Record<string, string> = {
  '구자영': '🐰', '윤난희': '🐮', '방수진': '🐹', '박종민': '🐑', '허주희': '🐴',
}

const CONFETTI_COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#14b8a6',
]

interface Props {
  requests: Request[]
  currentUser: string | null
  onAssigned: (requestId: number, assignee: string) => void
  onClose: () => void
}

function Confetti() {
  const pieces = Array.from({ length: 36 }, (_, i) => i)
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
      {pieces.map(i => {
        const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length]
        const left  = `${(i * 97 + 7) % 100}%`
        const delay = `${(i * 0.07).toFixed(2)}s`
        const size  = i % 3 === 0 ? 8 : i % 3 === 1 ? 6 : 4
        const rotate = (i * 47) % 360
        return (
          <div
            key={i}
            className="absolute top-0 animate-confetti"
            style={{ left, animationDelay: delay, width: size, height: size, backgroundColor: color,
              borderRadius: i % 2 === 0 ? '50%' : '2px', transform: `rotate(${rotate}deg)` }}
          />
        )
      })}
    </div>
  )
}

type Phase = 'select' | 'spinning' | 'result'

export default function GachaModal({ requests, currentUser, onAssigned, onClose }: Props) {
  const [phase,          setPhase]          = useState<Phase>('select')
  const [targetId,       setTargetId]       = useState<number | ''>('')
  const [displayMember,  setDisplayMember]  = useState(TEAM_MEMBERS[0])
  const [winner,         setWinner]         = useState<string | null>(null)
  const [saving,         setSaving]         = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const unassigned = requests.filter(r => !r.assignee?.trim() && r.status !== '완료')
  const all        = requests.filter(r => r.status !== '완료')

  // targetId 기본값: 미배정 첫 번째 건
  useEffect(() => {
    if (unassigned.length > 0) setTargetId(unassigned[0].id)
    else if (all.length > 0)   setTargetId(all[0].id)
  }, []) // eslint-disable-line

  const targetRequest = all.find(r => r.id === Number(targetId)) ?? null

  const spin = useCallback(() => {
    setPhase('spinning')
    setWinner(null)

    // 미리 당첨자 결정
    const final = TEAM_MEMBERS[Math.floor(Math.random() * TEAM_MEMBERS.length)]

    let elapsed  = 0
    let interval = 60  // ms — 빠르게 시작
    const totalMs = 3200

    const tick = () => {
      const pick = TEAM_MEMBERS[Math.floor(Math.random() * TEAM_MEMBERS.length)]
      setDisplayMember(pick)
      elapsed += interval
      interval = Math.min(interval * 1.12, 480)  // 점점 느려짐

      if (elapsed < totalMs) {
        timerRef.current = setTimeout(tick, interval)
      } else {
        setDisplayMember(final)
        setWinner(final)
        setPhase('result')
      }
    }
    timerRef.current = setTimeout(tick, interval)
  }, [])

  // 언마운트 시 타이머 정리
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const handleConfirm = async () => {
    if (!winner || !targetRequest) return
    setSaving(true)
    try {
      const res = await fetch(`/api/requests/${targetRequest.id}`, {
        method:  'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Name':  encodeURIComponent(currentUser ?? ''),
        },
        body: JSON.stringify({ assignee: winner }),
      })
      if (!res.ok) throw new Error()
      const updated: Request = await res.json()
      onAssigned(updated.id, winner)
      onClose()
    } catch {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setPhase('select')
    setWinner(null)
    setDisplayMember(TEAM_MEMBERS[0])
  }

  return (
    /* 오버레이 */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

        {phase === 'result' && <Confetti />}

        {/* 헤더 */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎰</span>
            <div>
              <h2 className="text-white font-bold text-base leading-tight">담당자 가챠</h2>
              <p className="text-indigo-200 text-xs">룰렛을 돌려 담당자를 배정하세요</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5">

          {/* 이슈 선택 */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">배정할 이슈 선택</label>
            <select
              value={targetId}
              onChange={e => setTargetId(Number(e.target.value))}
              disabled={phase !== 'select'}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-gray-50 disabled:text-gray-400"
            >
              {unassigned.length > 0 && (
                <optgroup label="미배정 건">
                  {unassigned.map(r => (
                    <option key={r.id} value={r.id}>[미배정] {r.title}</option>
                  ))}
                </optgroup>
              )}
              <optgroup label="전체 (완료 제외)">
                {all.map(r => (
                  <option key={r.id} value={r.id}>
                    [{r.assignee || '미배정'}] {r.title}
                  </option>
                ))}
              </optgroup>
            </select>
            {targetRequest && (
              <p className="mt-1.5 text-xs text-gray-400 truncate">
                현재 담당자: <span className="font-medium text-gray-600">
                  {targetRequest.assignee
                    ? `${MEMBER_EMOJI[targetRequest.assignee] ?? '👤'} ${targetRequest.assignee}`
                    : '없음'}
                </span>
              </p>
            )}
          </div>

          {/* 룰렛 디스플레이 */}
          <div className={`
            relative flex flex-col items-center justify-center
            rounded-2xl border-4 py-6 transition-all duration-300
            ${phase === 'spinning' ? 'border-indigo-400 bg-indigo-50 animate-pulse' :
              phase === 'result'   ? 'border-yellow-400 bg-yellow-50' :
                                     'border-gray-200 bg-gray-50'}
          `}>
            {/* 슬롯 창 */}
            <div className={`
              text-7xl mb-3 transition-transform duration-100
              ${phase === 'spinning' ? 'scale-110' : 'scale-100'}
            `}>
              {MEMBER_EMOJI[displayMember] ?? '👤'}
            </div>
            <p className={`
              text-lg font-black transition-all
              ${phase === 'result' ? 'text-yellow-600 text-2xl' : 'text-gray-700'}
            `}>
              {displayMember}
            </p>

            {phase === 'result' && (
              <div className="mt-2 flex flex-col items-center gap-1">
                <span className="text-2xl animate-bounce">🎉</span>
                <p className="text-xs text-yellow-600 font-semibold">당첨!</p>
              </div>
            )}

            {phase === 'spinning' && (
              <div className="absolute inset-x-0 top-0 bottom-0 flex items-center justify-center pointer-events-none">
                <div className="w-full h-0.5 bg-indigo-300 opacity-50" />
              </div>
            )}
          </div>

          {/* 팀원 미리보기 */}
          {phase === 'select' && (
            <div className="flex justify-center gap-3">
              {TEAM_MEMBERS.map(m => (
                <div key={m} className="flex flex-col items-center gap-0.5">
                  <span className="text-xl">{MEMBER_EMOJI[m] ?? '👤'}</span>
                  <span className="text-xs text-gray-400">{m.slice(-1)}</span>
                </div>
              ))}
            </div>
          )}

          {/* 액션 버튼 */}
          {phase === 'select' && (
            <button
              onClick={spin}
              disabled={!targetId}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
            >
              <span className="text-xl">🎰</span>
              룰렛 돌리기!
            </button>
          )}

          {phase === 'spinning' && (
            <div className="w-full py-3 bg-indigo-100 text-indigo-400 font-bold rounded-xl text-center text-sm">
              두근두근...
            </div>
          )}

          {phase === 'result' && (
            <div className="flex flex-col gap-2">
              <p className="text-center text-sm text-gray-600">
                <span className="font-bold text-gray-900">&ldquo;{targetRequest?.title}&rdquo;</span>의<br/>
                담당자를 <span className="font-black text-indigo-600">{winner}</span>으로 배정할까요?
              </p>
              <button
                onClick={handleConfirm}
                disabled={saving}
                className="w-full py-3 bg-gradient-to-r from-yellow-400 to-orange-400 text-white font-bold rounded-xl hover:from-yellow-500 hover:to-orange-500 transition-all shadow-md hover:shadow-lg disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? '저장 중...' : '🎊 배정 확정!'}
              </button>
              <button
                onClick={handleReset}
                className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                다시 돌리기
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
