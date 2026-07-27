'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Request, RequestInput, Status, TestStatus } from '@/types'
import { TEAM_MEMBERS } from '@/lib/constants'
import { getCurrentUser, clearCurrentUser } from '@/lib/auth'
import { isOverdue, isThisWeek } from '@/lib/weekUtils'
import JiraStatusBadge from '@/components/JiraStatusBadge'
import WeeklySummary from '@/components/WeeklySummary'
import MemberCalendar from '@/components/MemberCalendar'
import RequestForm from '@/components/RequestForm'

const STATUS_TEXT: Record<Status, string> = {
  '대기':   'text-gray-500 bg-gray-100',
  '검토중': 'text-yellow-700 bg-yellow-100',
  '기획중': 'text-purple-700 bg-purple-100',
  '완료':   'text-green-700 bg-green-100',
  '보류':   'text-red-500 bg-red-50',
}
const STATUS_BAR: Record<Status, string> = {
  '대기':   'bg-gray-400',
  '검토중': 'bg-yellow-400',
  '기획중': 'bg-purple-400',
  '완료':   'bg-green-400',
  '보류':   'bg-red-400',
}
const STATUSES: Status[] = ['대기', '검토중', '기획중', '완료', '보류']

const TEST_STATUS_TEXT: Record<TestStatus, string> = {
  '테스트 대기': 'text-orange-500 bg-orange-50',
  '테스트 중':   'text-orange-700 bg-orange-100',
  '테스트 완료': 'text-orange-800 bg-orange-200',
}
const TEST_STATUS_BAR: Record<TestStatus, string> = {
  '테스트 대기': 'bg-orange-300',
  '테스트 중':   'bg-orange-500',
  '테스트 완료': 'bg-orange-600',
}
const TEST_STATUSES: TestStatus[] = ['테스트 대기', '테스트 중', '테스트 완료']

// 담당자별 귀여운 동물 아이콘 & 카드 색상
const MEMBER_STYLE: Record<string, { emoji: string; bg: string; ring: string; text: string }> = {
  '구자영': { emoji: '🐰', bg: 'from-pink-50 to-pink-100',   ring: 'ring-pink-300',   text: 'text-pink-700' },
  '윤난희': { emoji: '🐮', bg: 'from-violet-50 to-violet-100', ring: 'ring-violet-300', text: 'text-violet-700' },
  '방수진': { emoji: '🐷', bg: 'from-amber-50 to-amber-100',  ring: 'ring-amber-300',  text: 'text-amber-700' },
  '박종민': { emoji: '🐑', bg: 'from-orange-50 to-orange-100', ring: 'ring-orange-300', text: 'text-orange-700' },
  '허주희': { emoji: '🐴', bg: 'from-teal-50 to-teal-100',    ring: 'ring-teal-300',   text: 'text-teal-700' },
  '신지희': { emoji: '🐯', bg: 'from-sky-50 to-sky-100',     ring: 'ring-sky-300',    text: 'text-sky-700'  },
}

type MemberStats = {
  name: string
  total: number
  active: number
  byStatus: Record<Status, number>
  byTestStatus: Record<TestStatus, number>
  issues: Request[]
}

function statusBreakdown(issues: Request[]): Record<Status, number> {
  return Object.fromEntries(STATUSES.map(s => [s, issues.filter(r => r.status === s).length])) as Record<Status, number>
}

/** 기획이 '완료'인데 테스트 일정이 존재하면, 그 시점부터는 테스트진행상태를 대표 상태로 노출한다 */
function effectiveTestPhase(r: Request): TestStatus | null {
  return r.status === '완료' && r.test_status ? r.test_status : null
}

/** 이슈 한 건 표시 행. showAssignee는 여러 담당자가 섞인 목록(전체 진행중 등)에서만 켠다 */
function IssueRow({ r, showAssignee, onSelect }: { r: Request; showAssignee?: boolean; onSelect?: (r: Request) => void }) {
  const overdue = isOverdue(r)
  const isStg = r.jira_status === 'STG 테스트요청'
  const assigneeStyle = r.assignee ? MEMBER_STYLE[r.assignee] : null
  const testPhase = effectiveTestPhase(r)
  return (
    <div className={`px-3 md:px-5 py-3 flex items-start md:items-center gap-2 md:gap-3 ${isStg ? 'bg-amber-50 border-l-4 border-amber-400' : overdue ? 'bg-red-50' : ''}`}>
      {isStg && <span className="text-base shrink-0 mt-0.5 md:mt-0" title="STG 테스트 검수 필요">🧪</span>}
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5 md:mt-0 ${testPhase ? TEST_STATUS_TEXT[testPhase] : STATUS_TEXT[r.status]}`}>
        {testPhase ?? r.status}
      </span>
      {showAssignee && (
        assigneeStyle
          ? <span className={`text-xs font-semibold shrink-0 mt-0.5 md:mt-0 ${assigneeStyle.text}`}>{assigneeStyle.emoji} {r.assignee}</span>
          : <span className="text-xs font-semibold text-orange-500 shrink-0 mt-0.5 md:mt-0">미배정</span>
      )}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelect?.(r)}>
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-sm font-medium text-gray-800 truncate hover:text-indigo-600 hover:underline">{r.title}</p>
          {isStg && <span className="text-xs font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded shrink-0">STG 검수</span>}
        </div>
        {r.summary && <p className="text-xs text-gray-400 truncate mt-0.5">{r.summary}</p>}
        {/* 모바일: 메타정보 하단에 */}
        <div className="flex flex-wrap items-center gap-1.5 mt-1 md:hidden">
          <JiraStatusBadge status={r.jira_status ?? null} />
          <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{r.request_team}</span>
          {r.jira_key && (
            <a href={r.jira_link ?? '#'} target="_blank" rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:underline" onClick={e => e.stopPropagation()}>
              {r.jira_key}
            </a>
          )}
          {r.due_date && (
            <span className={`text-xs ${overdue ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
              {r.due_date.slice(0, 10)}
            </span>
          )}
        </div>
      </div>
      {/* 데스크톱: 오른쪽 메타정보 */}
      <div className="hidden md:flex items-center gap-2">
        <JiraStatusBadge status={r.jira_status ?? null} />
        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded shrink-0">{r.request_team}</span>
        {r.jira_key && (
          <a href={r.jira_link ?? '#'} target="_blank" rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:underline shrink-0" onClick={e => e.stopPropagation()}>
            {r.jira_key}
          </a>
        )}
        {r.due_date && (
          <span className={`text-xs shrink-0 ${overdue ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
            {r.due_date.slice(0, 10)}
          </span>
        )}
      </div>
    </div>
  )
}

/** 주간 현황 요약 카드(전체 진행중/마감 목표/기한 초과/미배정) 클릭 시 담당자 카드 밑에 뜨는 상세 패널 */
function SummaryDetailPanel({ title, icon, issues, showAssignee, onSelectIssue }: { title: string; icon: string; issues: Request[]; showAssignee?: boolean; onSelectIssue?: (r: Request) => void }) {
  const byStatus = statusBreakdown(issues)
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{icon}</span>
          <div>
            <h3 className="text-base font-bold text-gray-800">{title}</h3>
            <p className="text-xs text-gray-400">{issues.length}건</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {STATUSES.map(s => byStatus[s] > 0 && (
            <span key={s} className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_TEXT[s]}`}>
              {s} {byStatus[s]}
            </span>
          ))}
        </div>
      </div>
      {issues.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-10">해당하는 이슈가 없습니다.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {issues.map(r => <IssueRow key={r.id} r={r} showAssignee={showAssignee} onSelect={onSelectIssue} />)}
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  const [requests, setRequests]       = useState<Request[]>([])
  const [loading, setLoading]         = useState(true)
  const [expanded, setExpanded]       = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<Status | ''>('')
  const [editing, setEditing]         = useState<Request | null>(null)
  const [showForm, setShowForm]       = useState(false)

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) { router.replace('/login'); return }
    setCurrentUser(user)
    setAuthChecked(true)
    fetch('/api/requests')
      .then(r => r.json())
      .then(data => { setRequests(data); setLoading(false) })
  }, [router])

  const handleSave = async (data: RequestInput) => {
    if (!editing) return
    const res = await fetch(`/api/requests/${editing.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-User-Name': encodeURIComponent(currentUser ?? '') },
      body: JSON.stringify(data),
    })
    if (!res.ok) return
    const updated: Request = await res.json()
    setRequests(prev => prev.map(r => r.id === updated.id ? updated : r))
    setEditing(null)
    setShowForm(false)
  }

  const memberStats = useMemo<MemberStats[]>(() => {
    return TEAM_MEMBERS.map(name => {
      const mine = requests.filter(r => r.assignee === name)
      const byStatus = Object.fromEntries(
        STATUSES.map(s => [s, mine.filter(r => r.status === s).length])
      ) as Record<Status, number>
      // 기획이 완료되고 테스트가 진행 중인 건도 상태 배분에 함께 노출한다
      const byTestStatus = Object.fromEntries(
        TEST_STATUSES.map(s => [s, mine.filter(r => r.status === '완료' && r.test_status === s).length])
      ) as Record<TestStatus, number>
      return { name, total: mine.length, active: mine.filter(r => r.status === '검토중' || r.status === '기획중').length, byStatus, byTestStatus, issues: mine }
    })
  }, [requests])

  const unassigned = useMemo(() => requests.filter(r => !r.assignee?.trim()), [requests])

  // 주간 현황 요약 카드(전체 진행중/이번 주 마감 목표/기한 초과) 클릭 시 보여줄 목록
  const weeklyActiveIssues  = useMemo(() => requests.filter(r => r.status !== '완료' && r.status !== '대기'), [requests])
  const weeklyTargetIssues  = useMemo(() => requests.filter(r => r.due_date && isThisWeek(r.due_date)), [requests])
  const weeklyOverdueIssues = useMemo(() => requests.filter(isOverdue), [requests])

  const totalStats = useMemo(() => ({
    total:   requests.length,
    active:  requests.filter(r => r.status === '검토중' || r.status === '기획중').length,
    overdue: requests.filter(r => {
      if (!r.due_date || r.status === '완료') return false
      return new Date(r.due_date) < new Date(new Date().toDateString())
    }).length,
  }), [requests])

  const filteredIssues = (issues: Request[]) =>
    statusFilter ? issues.filter(r => r.status === statusFilter) : issues

  // STG 테스트요청 — 기획자 STG 테스트 진행 필요 건
  const stgRequired = useMemo(
    () => requests.filter(r => r.jira_status === 'STG 테스트요청'),
    [requests]
  )

  const handleLogout = () => {
    clearCurrentUser()
    router.replace('/login')
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
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 px-3 md:px-6 py-3 flex items-center justify-between shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex items-center gap-2 md:gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="Pharo-Sort" className="w-8 h-8 rounded-lg object-contain shrink-0" />
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-tight">Pharo-Sort</h1>
              <p className="hidden md:block text-xs text-gray-400">파로스 기획팀 업무 관리 시스템 / 파로스(Pharos) + 분류(Sort)</p>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-1.5 bg-gray-100 rounded-xl p-1">
            <a href="/" className="text-sm font-medium text-gray-500 hover:text-gray-700 px-4 py-1.5 rounded-lg transition-colors">
              📋 업무 목록
            </a>
            <span className="text-sm font-semibold text-white bg-indigo-600 px-4 py-1.5 rounded-lg shadow-sm">
              👥 담당자 대시보드
            </span>
            <a href="/timeline" className="text-sm font-medium text-gray-500 hover:text-gray-700 px-4 py-1.5 rounded-lg transition-colors">
              📅 캘린더
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="hidden md:block bg-gray-100 text-gray-600 px-2.5 py-1.5 rounded-full">전체 {totalStats.total}</div>
          <div className="hidden md:block bg-indigo-100 text-indigo-700 px-2.5 py-1.5 rounded-full font-medium">진행 {totalStats.active}</div>
          {totalStats.overdue > 0 && (
            <div className="bg-red-100 text-red-600 font-bold px-2.5 py-1.5 rounded-full animate-pulse">지연 {totalStats.overdue}</div>
          )}
          {/* 유저 + 로그아웃 + 이력 */}
          <div className="hidden md:flex items-center gap-2 border-l border-gray-100 pl-3 ml-1">
            <span>{MEMBER_STYLE[currentUser ?? '']?.emoji ?? '👤'}</span>
            <span className="font-medium text-gray-700">{currentUser}</span>
            <button onClick={handleLogout} className="text-gray-300 hover:text-gray-500 transition-colors">
              로그아웃
            </button>
            <a href="/history" className="text-xs text-gray-400 hover:text-indigo-500 transition-colors whitespace-nowrap">
              변경이력보기
            </a>
            <a href="/settings" className="text-xs text-gray-400 hover:text-indigo-500 transition-colors whitespace-nowrap">
              ⚙️ 설정
            </a>
          </div>
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
        <span className="flex-1 flex flex-col items-center justify-center py-2.5 text-indigo-600 border-t-2 border-indigo-600">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
          </svg>
          <span className="text-xs font-bold mt-0.5">대시보드</span>
        </span>
        <a href="/timeline" className="flex-1 flex flex-col items-center justify-center py-2.5 text-gray-400 border-t-2 border-transparent">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
          <span className="text-xs mt-0.5">캘린더</span>
        </a>
      </nav>

      <main className="flex-1 p-3 md:p-6 space-y-4 md:space-y-6 pb-20 md:pb-6">

        {/* ── 주간 현황 요약 ── */}
        <WeeklySummary
          requests={requests}
          selected={expanded}
          onSelect={key => setExpanded(e => e === key ? null : key)}
        />

        {/* ── STG 테스트 필요 알림 배너 ── */}
        {stgRequired.length > 0 && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl px-5 py-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">🧪</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-amber-800">
                  STG 테스트 진행 필요 — {stgRequired.length}건
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  아래 이슈들의 지라 상태가 <strong>STG 테스트요청</strong>입니다. 기획자 STG 테스트를 진행해주세요.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {stgRequired.map(r => {
                    const assigneeStyle = r.assignee ? MEMBER_STYLE[r.assignee] : null
                    return (
                      <div key={r.id}
                        className="flex items-center gap-2 bg-white border border-amber-200 rounded-lg px-3 py-1.5 text-xs shadow-sm">
                        {assigneeStyle && <span>{assigneeStyle.emoji}</span>}
                        <span className="font-medium text-gray-700 max-w-[200px] truncate">{r.title}</span>
                        {r.assignee
                          ? <span className={`font-semibold ${assigneeStyle?.text ?? 'text-gray-500'}`}>{r.assignee}</span>
                          : <span className="text-orange-500 font-semibold">미배정</span>
                        }
                        {r.jira_key && (
                          <a href={r.jira_link ?? '#'} target="_blank" rel="noopener noreferrer"
                            className="text-blue-500 hover:underline" onClick={e => e.stopPropagation()}>
                            {r.jira_key}
                          </a>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 상태 필터 */}
        <div className="flex flex-nowrap overflow-x-auto items-center gap-2 pb-1">
          <span className="text-sm text-gray-500 font-medium">상태 필터</span>
          <button onClick={() => setStatusFilter('')}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${statusFilter === '' ? 'bg-gray-800 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            전체
          </button>
          {STATUSES.map(s => (
            <button key={s} onClick={() => setStatusFilter(f => f === s ? '' : s)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${statusFilter === s ? STATUS_TEXT[s] + ' ring-2 ring-offset-1' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {s}
            </button>
          ))}
        </div>

        {/* ── 담당자 카드 (가로 배열) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
          {memberStats.map(m => {
            const style   = MEMBER_STYLE[m.name] ?? { emoji: '🙂', bg: 'from-gray-50 to-gray-100', ring: 'ring-gray-300', text: 'text-gray-700' }
            const ratio   = Math.min(m.active / 5, 1)
            const barColor = ratio >= 1 ? 'bg-red-400' : ratio >= 0.7 ? 'bg-orange-400' : ratio >= 0.4 ? 'bg-yellow-400' : 'bg-green-400'
            const isOpen  = expanded === m.name
            const stgCount = m.issues.filter(r => r.jira_status === 'STG 테스트요청').length

            return (
              <button
                key={m.name}
                onClick={() => setExpanded(e => e === m.name ? null : m.name)}
                className={`bg-gradient-to-b ${style.bg} rounded-2xl p-5 flex flex-col items-center gap-3 border-2 transition-all shadow-sm hover:shadow-md ${
                  isOpen ? `${style.ring} ring-2 shadow-md` : 'border-transparent'
                }`}
              >
                {/* 동물 아이콘 + STG 뱃지 */}
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center text-4xl">
                    {style.emoji}
                  </div>
                  {stgCount > 0 && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-400 text-white text-xs font-black rounded-full flex items-center justify-center shadow-md animate-bounce">
                      {stgCount}
                    </div>
                  )}
                </div>

                {/* 이름 */}
                <div className="text-center">
                  <p className={`text-sm font-bold ${style.text}`}>{m.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">전체 {m.total}건</p>
                </div>

                {/* 활성 건수 강조 */}
                <div className={`text-2xl font-black ${m.active >= 5 ? 'text-red-500' : style.text}`}>
                  {m.active}
                  <span className="text-sm font-medium text-gray-400">건 진행</span>
                </div>

                {/* 상태별 미니 바 */}
                <div className="w-full space-y-1">
                  {STATUSES.filter(s => m.byStatus[s] > 0).map(s => (
                    <div key={s} className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500 w-10 text-right shrink-0">{s}</span>
                      <div className="flex-1 h-1.5 bg-white/70 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${STATUS_BAR[s]}`}
                          style={{ width: `${Math.min((m.byStatus[s] / Math.max(m.total, 1)) * 100, 100)}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-gray-600 w-4 shrink-0">{m.byStatus[s]}</span>
                    </div>
                  ))}
                  {/* 기획완료 + 테스트 진행 중인 건도 함께 노출 */}
                  {TEST_STATUSES.filter(s => m.byTestStatus[s] > 0).map(s => (
                    <div key={s} className="flex items-center gap-1.5">
                      <span className="text-[10px] text-orange-500 w-16 text-right shrink-0 whitespace-nowrap">{s}</span>
                      <div className="flex-1 h-1.5 bg-white/70 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${TEST_STATUS_BAR[s]}`}
                          style={{ width: `${Math.min((m.byTestStatus[s] / Math.max(m.total, 1)) * 100, 100)}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-gray-600 w-4 shrink-0">{m.byTestStatus[s]}</span>
                    </div>
                  ))}
                </div>

                {/* 업무 부하 바 */}
                <div className="w-full">
                  <div className="h-2 bg-white/70 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${ratio * 100}%` }} />
                  </div>
                  <p className={`text-xs text-center mt-1 ${ratio >= 1 ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                    {ratio >= 1 ? '⚠️ 과부하' : ratio >= 0.7 ? '주의' : '여유'}
                  </p>
                </div>

                {/* 펼침 화살표 */}
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                </svg>
              </button>
            )
          })}
        </div>

        {/* ── 주간 현황 요약 카드 클릭 시 상세 패널 ── */}
        {expanded === '__weekly_active' && (
          <SummaryDetailPanel title="전체 진행중" icon="📋" issues={filteredIssues(weeklyActiveIssues)} showAssignee
            onSelectIssue={r => { setEditing(r); setShowForm(true) }} />
        )}
        {expanded === '__weekly_target' && (
          <SummaryDetailPanel title="이번 주 마감 목표" icon="📅" issues={filteredIssues(weeklyTargetIssues)} showAssignee
            onSelectIssue={r => { setEditing(r); setShowForm(true) }} />
        )}
        {expanded === '__weekly_overdue' && (
          <SummaryDetailPanel title="기한 초과" icon="⚠️" issues={filteredIssues(weeklyOverdueIssues)} showAssignee
            onSelectIssue={r => { setEditing(r); setShowForm(true) }} />
        )}
        {expanded === '__unassigned' && (
          <SummaryDetailPanel title="미배정" icon="❓" issues={filteredIssues(unassigned)}
            onSelectIssue={r => { setEditing(r); setShowForm(true) }} />
        )}

        {/* ── 이슈 상세 패널 (담당자 카드 클릭 시 펼침) ── */}
        {memberStats.map(m => {
          if (expanded !== m.name) return null
          const style  = MEMBER_STYLE[m.name] ?? { emoji: '🙂', bg: 'from-gray-50 to-gray-100', ring: 'ring-gray-300', text: 'text-gray-700' }
          const issues = filteredIssues(m.issues)
          return (
            <div key={m.name} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{style.emoji}</span>
                  <div>
                    <h3 className={`text-base font-bold ${style.text}`}>{m.name}</h3>
                    <p className="text-xs text-gray-400">전체 {m.total}건 · 진행 중 {m.active}건</p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                  {STATUSES.map(s => m.byStatus[s] > 0 && (
                    <span key={s} className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_TEXT[s]}`}>
                      {s} {m.byStatus[s]}
                    </span>
                  ))}
                  {TEST_STATUSES.map(s => m.byTestStatus[s] > 0 && (
                    <span key={s} className={`text-xs px-2.5 py-1 rounded-full font-medium ${TEST_STATUS_TEXT[s]}`}>
                      {s} {m.byTestStatus[s]}
                    </span>
                  ))}
                </div>
              </div>

              {/* 담당자 일정 캘린더 (기획시작일자 ~ 기획완료예정일) */}
              <div className="border-b border-gray-100">
                <MemberCalendar issues={m.issues} />
              </div>

              {issues.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">해당 상태의 이슈가 없습니다.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {issues.map(r => <IssueRow key={r.id} r={r} onSelect={r => { setEditing(r); setShowForm(true) }} />)}
                </div>
              )}
            </div>
          )
        })}
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
