'use client'

import { useMemo, useState } from 'react'
import { Request, Status } from '@/types'

const MEMBERS = ['구자영', '윤난희', '방수진', '박종민', '허주희', '신지희']

const MEMBER_EMOJI: Record<string, string> = {
  '구자영': '🐰', '윤난희': '🐮', '방수진': '🐷', '박종민': '🐑', '허주희': '🐴', '신지희': '🐯',
}

const STATUS_BAR_COLOR: Record<Status, string> = {
  '대기':   'bg-gray-400',
  '검토중': 'bg-yellow-400',
  '기획중': 'bg-purple-400',
  '완료':   'bg-green-400',
  '보류':   'bg-red-400',
}

const STATUSES: Status[] = ['대기', '검토중', '기획중', '완료', '보류']
const DAY_KR = ['일', '월', '화', '수', '목', '금', '토']

/**
 * 대한민국 법정공휴일 (설날/추석 등 음력 연휴는 매년 날짜가 바뀌므로 연도별로 직접 등록).
 * 2025~2027년만 등록되어 있음 — 이후 연도는 매년 갱신 필요.
 */
const KR_HOLIDAYS = new Set([
  // 2025
  '2025-01-01', '2025-01-28', '2025-01-29', '2025-01-30', '2025-03-01', '2025-03-03',
  '2025-05-05', '2025-05-06', '2025-06-06', '2025-08-15',
  '2025-10-03', '2025-10-05', '2025-10-06', '2025-10-07', '2025-10-08', '2025-10-09',
  '2025-12-25',
  // 2026
  '2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18', '2026-03-01', '2026-03-02',
  '2026-05-05', '2026-05-24', '2026-05-25', '2026-06-03', '2026-06-06', '2026-07-17',
  '2026-08-15', '2026-08-17', '2026-09-24', '2026-09-25', '2026-09-26',
  '2026-10-03', '2026-10-05', '2026-10-09', '2026-12-25',
  // 2027
  '2027-01-01', '2027-02-06', '2027-02-07', '2027-02-08', '2027-02-09', '2027-03-01',
  '2027-05-05', '2027-05-13', '2027-06-06', '2027-06-07', '2027-07-17',
  '2027-08-15', '2027-08-16', '2027-09-14', '2027-09-15', '2027-09-16',
  '2027-10-03', '2027-10-04', '2027-10-09', '2027-10-11', '2027-12-25', '2027-12-27',
])

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/** 날짜 구간을 현재 보이는 달력 범위에 맞춰 잘라 좌표(%)로 변환. 범위 밖이면 null */
function clipToGrid(
  start: string | null, end: string | null,
  rangeStart: string, rangeEnd: string, days: Date[], cellCount: number
): { left: number; width: number } | null {
  const s = start ?? end
  const e = end ?? start
  if (!s || !e || e < rangeStart || s > rangeEnd) return null
  const cs = s > rangeStart ? s : rangeStart
  const ce = e < rangeEnd ? e : rangeEnd
  const si = days.findIndex(d => toDateStr(d) === cs)
  const ei = days.findIndex(d => toDateStr(d) === ce)
  if (si === -1 || ei === -1) return null
  return { left: (si / cellCount) * 100, width: Math.max(((ei - si + 1) / cellCount) * 100, 100 / cellCount) }
}

type ViewMode = 'week' | 'month'

interface Bar {
  r: Request
  startIdx: number
  endIdx: number
  hasStart: boolean
  lane: number
}

interface Props {
  requests: Request[]
  onSelectIssue: (r: Request) => void
}

const BAR_H = 22
const BAR_GAP = 6
const ROW_PAD = 10

/** 전체 담당자를 Y축, 기간을 X축으로 하는 통합 리소스 타임라인 (기획시작일자~기획완료예정일 막대) */
export default function GlobalTimeline({ requests, onSelectIssue }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [offset, setOffset] = useState(0)
  const [unplottableOpen, setUnplottableOpen] = useState(false)
  const [sortByAssignee, setSortByAssignee] = useState(false)
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null)

  const changeMode = (mode: ViewMode) => {
    setViewMode(mode)
    setOffset(0)
  }

  const { days, rangeLabel } = useMemo(() => {
    if (viewMode === 'week') {
      const today = new Date()
      const dow = today.getDay()
      const monday = new Date(today)
      monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) + offset * 7)
      monday.setHours(0, 0, 0, 0)
      const arr = Array.from({ length: 5 }, (_, i) => {
        const d = new Date(monday)
        d.setDate(monday.getDate() + i)
        return d
      })
      const first = arr[0]
      const last = arr[arr.length - 1]
      const label = `${first.getFullYear()}년 ${first.getMonth() + 1}월 ${first.getDate()}일(월) ~ ${last.getDate()}일(금)`
      return { days: arr, rangeLabel: label }
    }
    const base = new Date()
    base.setDate(1)
    base.setMonth(base.getMonth() + offset)
    const year = base.getFullYear()
    const month = base.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const arr: Date[] = []
    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) arr.push(new Date(d))
    return { days: arr, rangeLabel: `${year}년 ${month + 1}월` }
  }, [viewMode, offset])

  const rangeStart = toDateStr(days[0])
  const rangeEnd = toDateStr(days[days.length - 1])
  const todayStr = toDateStr(new Date())
  const cellCount = days.length
  const todayIdx = days.findIndex(d => toDateStr(d) === todayStr)

  const laneRows = useMemo(() => {
    return MEMBERS.map(name => {
      const memberBars = requests
        .filter(r =>
          r.assignee === name &&
          r.due_date &&
          r.due_date >= rangeStart &&
          (r.start_date ?? r.due_date) <= rangeEnd
        )
        .map(r => {
          const hasStart = !!r.start_date
          // 기획시작일자 미입력 건(대개 '대기' 상태)은 구간 전체를 채우면 시각적으로 어지러우므로
          // 기획완료예정일 위치에 마커 하나로만 표기한다.
          const start = hasStart
            ? (r.start_date! > rangeStart ? r.start_date! : rangeStart)
            : r.due_date!
          const end = r.due_date! < rangeEnd ? r.due_date! : rangeEnd
          const startIdx = days.findIndex(d => toDateStr(d) === start)
          const endIdx = days.findIndex(d => toDateStr(d) === end)
          return {
            r,
            startIdx: startIdx === -1 ? 0 : startIdx,
            endIdx: endIdx === -1 ? days.length - 1 : endIdx,
            hasStart,
          }
        })
        .sort((a, b) => a.startIdx - b.startIdx)

      const laneEnds: number[] = []
      const bars: Bar[] = memberBars.map(b => {
        let lane = laneEnds.findIndex(end => end < b.startIdx)
        if (lane === -1) {
          lane = laneEnds.length
          laneEnds.push(b.endIdx)
        } else {
          laneEnds[lane] = b.endIdx
        }
        return { ...b, lane }
      })

      return { name, bars, laneCount: Math.max(laneEnds.length, 1) }
    })
  }, [requests, days, rangeStart, rangeEnd])

  const unplottable = useMemo(
    () => requests.filter(r => !r.assignee || !r.due_date),
    [requests]
  )

  const unplottableSorted = useMemo(() => {
    if (!sortByAssignee) return unplottable
    return [...unplottable].sort((a, b) => {
      const ai = a.assignee ? MEMBERS.indexOf(a.assignee) : -1
      const bi = b.assignee ? MEMBERS.indexOf(b.assignee) : -1
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    })
  }, [unplottable, sortByAssignee])

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 md:p-4 flex flex-col gap-3">
      {/* 컨트롤 바 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => setOffset(o => o - 1)}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <p className="text-sm font-bold text-gray-800 min-w-[170px] md:min-w-[220px] text-center">{rangeLabel}</p>
          <button onClick={() => setOffset(o => o + 1)}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
            </svg>
          </button>
          {offset !== 0 && (
            <button onClick={() => setOffset(0)} className="text-xs text-indigo-500 hover:underline ml-1">오늘</button>
          )}
        </div>

        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button onClick={() => changeMode('week')}
            className={`text-xs font-medium px-3 py-1 rounded-md transition-colors ${viewMode === 'week' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>
            주간
          </button>
          <button onClick={() => changeMode('month')}
            className={`text-xs font-medium px-3 py-1 rounded-md transition-colors ${viewMode === 'month' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>
            월간
          </button>
        </div>

        <p className="text-xs text-gray-400 ml-auto hidden md:block">기획시작일자~기획완료예정일 구간 · 막대 클릭 시 수정</p>
      </div>

      {/* 타임라인 그리드 */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: cellCount * (viewMode === 'week' ? 110 : 28) + 100 }}>
          {/* 날짜 헤더 */}
          <div className="flex">
            <div className="w-24 shrink-0" />
            <div className="flex-1 flex">
              {days.map(d => {
                const isToday = toDateStr(d) === todayStr
                const dow = d.getDay()
                const isOff = dow === 0 || dow === 6 || KR_HOLIDAYS.has(toDateStr(d))
                return (
                  <div key={toDateStr(d)}
                    className={`flex-1 text-center text-xs pb-1.5 border-b-2 rounded-t ${
                      isToday
                        ? 'text-indigo-600 font-bold border-indigo-400'
                        : isOff
                          ? 'text-red-400 border-red-100'
                          : 'text-gray-400 border-gray-100'
                    }`}>
                    {d.getMonth() + 1}/{d.getDate()}
                    <span className="block text-[10px]">{DAY_KR[dow]}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 담당자별 행 */}
          <div className="mt-1 divide-y divide-gray-50">
            {laneRows.map(({ name, bars, laneCount }) => (
              <div key={name}>
                <div className="flex items-stretch py-1.5">
                  <div className="w-24 shrink-0 flex items-center gap-1.5 pr-2">
                    <span className="text-lg">{MEMBER_EMOJI[name]}</span>
                    <span className="text-xs font-medium text-gray-600 truncate">{name}</span>
                  </div>
                  <div className="flex-1 relative" style={{ height: laneCount * (BAR_H + BAR_GAP) + ROW_PAD }}>
                    {todayIdx !== -1 && (
                      <div className="absolute top-0 bottom-0 w-px bg-indigo-200"
                        style={{ left: `${((todayIdx + 0.5) / cellCount) * 100}%` }} />
                    )}
                    {bars.length === 0 ? (
                      <div className="absolute inset-0 flex items-center">
                        <span className="text-xs text-gray-300">일정 없음</span>
                      </div>
                    ) : bars.map(({ r, startIdx, endIdx, hasStart, lane }) => {
                      const history = r.schedule_history ?? []
                      const hasHistory = history.length > 0
                      const barLeft = (startIdx / cellCount) * 100
                      const tooltip = [
                        `${r.title} (${r.start_date ?? '시작일 미정'} ~ ${r.due_date})`,
                        ...history.map((h, i) =>
                          `${i === 0 ? '[최초]' : `[변경 ${i}]`} ${h.start_date ?? '미정'} ~ ${h.due_date ?? '미정'}${h.reason ? ` (사유: ${h.reason})` : ''}`
                        ),
                      ].join('\n')
                      return (
                        <div key={r.id} className="absolute" style={{ left: 0, right: 0, top: lane * (BAR_H + BAR_GAP), height: BAR_H }}>
                          <button
                            type="button"
                            onClick={() => onSelectIssue(r)}
                            title={tooltip}
                            className={`absolute top-0 rounded-md px-2 flex items-center text-[11px] font-medium text-white truncate text-left hover:brightness-95 transition-all ${STATUS_BAR_COLOR[r.status]} ${hasStart ? '' : 'opacity-60 border border-dashed border-white/70'}`}
                            style={{
                              left: `${barLeft}%`,
                              width: `${Math.max(((endIdx - startIdx + 1) / cellCount) * 100, 100 / cellCount)}%`,
                              height: BAR_H,
                            }}
                          >
                            {r.title}
                          </button>
                          {hasHistory && (
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); setExpandedTaskId(id => id === r.id ? null : r.id) }}
                              title="일정 변경 이력 보기"
                              className="absolute z-10 w-4 h-4 rounded-full bg-white text-[9px] leading-none flex items-center justify-center shadow border border-gray-200 hover:scale-110 transition-transform"
                              style={{ left: `calc(${barLeft}% - 7px)`, top: -6 }}
                            >
                              ⚠️
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* 변경 이력 아코디언 — 아이콘 클릭 시 해당 건의 최초~직전 변경 이력을 행 아래에 펼침 */}
                {bars.filter(b => (b.r.schedule_history?.length ?? 0) > 0).map(({ r }) => {
                  const isOpen = expandedTaskId === r.id
                  const history = r.schedule_history ?? []
                  const pastEntries = history.slice(0, -1)
                  return (
                    <div key={r.id} style={{ display: 'grid', gridTemplateRows: isOpen ? '1fr' : '0fr', transition: 'grid-template-rows 200ms ease' }}>
                      <div style={{ overflow: 'hidden' }}>
                        <div className="pt-1.5 pb-2 bg-gray-50/70 border-t border-dashed border-gray-200 space-y-1">
                          {pastEntries.map((h, i) => {
                            const pos = clipToGrid(h.start_date, h.due_date, rangeStart, rangeEnd, days, cellCount)
                            const label = i === 0 ? '최초 계획' : `변경 ${i}회차`
                            // 사유는 "이 구간에서 다음 구간으로 바뀐 이유"이므로, 한 칸 뒤(다음 차수)의 사유를 이 줄에 표시한다
                            const nextReason = history[i + 1]?.reason ?? null
                            return (
                              <div key={i} className="flex items-stretch">
                                <div className="w-24 shrink-0 pl-4 pr-2 flex items-center">
                                  <span className="text-[10px] text-gray-400 truncate">└ {label}</span>
                                </div>
                                <div className="flex-1 relative" style={{ height: 18 }}>
                                  {pos && (
                                    <div
                                      className="absolute top-0.5 rounded bg-gray-200 text-gray-500 text-[10px] px-1.5 flex items-center truncate"
                                      style={{ left: `${pos.left}%`, width: `${pos.width}%`, height: 15 }}
                                      title={`${label}: ${h.start_date ?? '미정'} ~ ${h.due_date ?? '미정'}${nextReason ? ` (변경사유: ${nextReason})` : ''}`}
                                    >
                                      {h.start_date ?? '미정'}~{h.due_date ?? '미정'}{nextReason ? ` (변경사유: ${nextReason})` : ''}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 pt-1 border-t border-gray-100">
        {STATUSES.map(s => (
          <span key={s} className="flex items-center gap-1">
            <span className={`w-2.5 h-2.5 rounded-full inline-block ${STATUS_BAR_COLOR[s]}`} />{s}
          </span>
        ))}
        <span className="flex items-center gap-1 ml-2">
          <span className="w-2.5 h-2.5 rounded-full inline-block border border-dashed border-gray-400" />기획시작일자 미입력
        </span>
        <span className="flex items-center gap-1 text-red-400">
          <span className="w-2.5 h-2.5 rounded-full inline-block border border-red-300" />주말/공휴일
        </span>
        <span className="flex items-center gap-1">
          <span className="text-[10px]">⚠️</span>일정 변경 이력 있음 (아이콘 클릭 시 상세 펼침)
        </span>
      </div>

      {/* 배치 불가 항목 (미배정 또는 기획완료예정일 미설정) */}
      {unplottable.length > 0 && (
        <div className="pt-2 border-t border-gray-100">
          <button type="button" onClick={() => setUnplottableOpen(v => !v)}
            className="w-full flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors">
            <svg className={`w-3 h-3 shrink-0 transition-transform ${unplottableOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
            </svg>
            미배정 / 기획완료예정일 미설정 ({unplottable.length}건)
          </button>

          {unplottableOpen && (
          <div className="mt-2">
            <div className="flex justify-end mb-1.5">
              <button type="button" onClick={() => setSortByAssignee(v => !v)}
                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                  sortByAssignee ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-gray-200 text-gray-400 hover:text-gray-600'
                }`}>
                담당자순 정렬
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
            {unplottableSorted.map(r => (
              <button key={r.id} type="button" onClick={() => onSelectIssue(r)}
                className="text-xs bg-gray-50 border border-gray-200 text-gray-600 rounded-full px-2.5 py-1 hover:bg-gray-100 transition-colors">
                {r.assignee ? `${MEMBER_EMOJI[r.assignee] ?? ''} ${r.assignee}` : '미배정'} · {r.title}
              </button>
            ))}
          </div>
        </div>
        )}
        </div>
      )}
    </div>
  )
}
