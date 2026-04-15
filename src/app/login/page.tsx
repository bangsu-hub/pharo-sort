'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser, setCurrentUser } from '@/lib/auth'
import { TEAM_MEMBERS } from '@/lib/constants'

const MEMBER_STYLE: Record<string, {
  emoji: string; bg: string; border: string; text: string
}> = {
  '구자영': { emoji: '🐱', bg: 'bg-pink-50',   border: 'border-pink-200 hover:border-pink-400',     text: 'text-pink-700'   },
  '윤난희': { emoji: '🐰', bg: 'bg-violet-50', border: 'border-violet-200 hover:border-violet-400', text: 'text-violet-700' },
  '방수진': { emoji: '🐻', bg: 'bg-amber-50',  border: 'border-amber-200 hover:border-amber-400',   text: 'text-amber-700'  },
  '박종민': { emoji: '🦊', bg: 'bg-orange-50', border: 'border-orange-200 hover:border-orange-400', text: 'text-orange-700' },
  '허주희': { emoji: '🐼', bg: 'bg-teal-50',   border: 'border-teal-200 hover:border-teal-400',     text: 'text-teal-700'   },
}

export default function LoginPage() {
  const router = useRouter()

  useEffect(() => {
    if (getCurrentUser()) router.replace('/')
  }, [router])

  const handleSelect = (name: string) => {
    setCurrentUser(name)
    router.replace('/')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 flex flex-col items-center justify-center p-6">

      {/* 로고 */}
      <div className="mb-10 text-center">
        <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
        </div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Pharo-Sort</h1>
        <p className="text-sm text-gray-400 mt-1">파로스 기획팀 요청 관리 시스템</p>
      </div>

      {/* 안내 */}
      <div className="mb-7 text-center">
        <h2 className="text-lg font-bold text-gray-700">안녕하세요 👋</h2>
        <p className="text-sm text-gray-400 mt-1">이름을 선택해 시작하세요</p>
      </div>

      {/* 멤버 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 w-full max-w-2xl">
        {TEAM_MEMBERS.map(name => {
          const s = MEMBER_STYLE[name] ?? {
            emoji: '🙂', bg: 'bg-gray-50', border: 'border-gray-200 hover:border-gray-400', text: 'text-gray-700',
          }
          return (
            <button
              key={name}
              onClick={() => handleSelect(name)}
              className={`
                ${s.bg} ${s.border} border-2 rounded-2xl p-6
                flex flex-col items-center gap-3
                transition-all duration-150
                hover:shadow-lg hover:-translate-y-1
                active:scale-95 active:shadow-sm
              `}
            >
              <span className="text-4xl">{s.emoji}</span>
              <span className={`text-sm font-bold ${s.text}`}>{name}</span>
            </button>
          )
        })}
      </div>

      <p className="mt-10 text-xs text-gray-300">파로스(Pharos) + 분류(Sort)</p>
    </div>
  )
}
