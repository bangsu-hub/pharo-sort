'use client'

import { useMemo, useState } from 'react'
import { Request, Status, TestStatus } from '@/types'
import { toDateStr, KR_HOLIDAYS, countBusinessDays, businessDaysDiff } from '@/lib/weekUtils'

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

/** 테스트 구간 색상 — 배경은 통일하고, 테두리 진하기로만 진행상태를 구분한다 */
const TEST_STATUS_COLOR: Record<TestStatus, string> = {
  '테스트 대기': 'bg-[#FFEDD5] border-solid border-orange-400',
  '테스트 중':   'bg-[#FFEDD5] border-solid border-orange-500',
  '테스트 완료': 'bg-[#FFEDD5] border-solid border-orange-600',
}
const DAY_KR = ['일', '월', '화', '수', '목', '금', '토']

type ViewLayer = 'all' | 'plan' | 'test'

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
  kind: 'plan' | 'test'
  startIdx: number
  endIdx: number
  hasStart: boolean
  lane: number
}

interface Props {
  requests: Request[]
  onSelectIssue: (r: Request) => void
  /** 일정 변경 이력 아코디언이 펼쳐진 업무 ID 집합 (부모에서 관리 — "전체 열기/닫기" 버튼과 공유하기 위함) */
  expandedTaskIds: Set<number>
  onToggleHistory: (id: number) => void
  /** 상단 '완료 건 숨기기' 필터가 켜져 있는 상태 — 기획이 완료된 건은 기획 구간을 숨기고, 테스트가 아직 진행 중이면 테스트 구간만 보여준다 */
  hidePlanIfDone?: boolean
}

const BAR_H = 22
const BAR_GAP = 6
const ROW_PAD = 10

/** 전체 담당자를 Y축, 기간을 X축으로 하는 통합 리소스 타임라인 (기획시작일자~기획완료예정일 막대) */
export default function GlobalTimeline({ requests, onSelectIssue, expandedTaskIds, onToggleHistory, hidePlanIfDone = false }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [viewLayer, setViewLayer] = useState<ViewLayer>('all')
  const [offset, setOffset] = useState(0)
  const [unplottableOpen, setUnplottableOpen] = useState(false)
  const [sortByAssignee, setSortByAssignee] = useState(false)

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
      const memberRequests = requests.filter(r => r.assignee === name)

      type RawBar = { r: Request; kind: 'plan' | 'test'; startIdx: number; endIdx: number; hasStart: boolean }
      const rawBars: RawBar[] = []

      memberRequests.forEach(r => {
        // 기획 구간 — '테스트 일정'만 보기 모드이거나, '완료 건 숨기기'가 켜진 상태에서 기획이 이미 완료된 건이면 숨긴다.
        if (viewLayer !== 'test' && !(hidePlanIfDone && r.status === '완료') &&
            r.due_date && r.due_date >= rangeStart && (r.start_date ?? r.due_date) <= rangeEnd) {
          const hasStart = !!r.start_date
          // 기획시작일자 미입력 건(대개 '대기' 상태)은 구간 전체를 채우면 시각적으로 어지러우므로
          // 기획완료예정일 위치에 마커 하나로만 표기한다.
          const start = hasStart ? (r.start_date! > rangeStart ? r.start_date! : rangeStart) : r.due_date!
          // 실제 완료일 초과분까지 고려해서 레인을 예약해야 다음 업무와 안 겹친다.
          let outerEndRaw = r.due_date!
          if (r.actual_due_date && r.actual_due_date > outerEndRaw) outerEndRaw = r.actual_due_date
          const end = outerEndRaw < rangeEnd ? outerEndRaw : rangeEnd
          const startIdx = days.findIndex(d => toDateStr(d) === start)
          const endIdx = days.findIndex(d => toDateStr(d) === end)
          rawBars.push({ r, kind: 'plan', startIdx: startIdx === -1 ? 0 : startIdx, endIdx: endIdx === -1 ? days.length - 1 : endIdx, hasStart })
        }

        // 테스트 구간 — 기획과 전혀 다른 시기(예: 기획 3월/테스트 5월)에 있을 수 있으므로,
        // 같은 막대에 얹지 않고 자기 자신의 실제 날짜 위치에 독립된 막대로 표시한다.
        if (viewLayer !== 'plan' && r.test_start_date && r.test_due_date &&
            r.test_due_date >= rangeStart && r.test_start_date <= rangeEnd) {
          const start = r.test_start_date > rangeStart ? r.test_start_date : rangeStart
          const end = r.test_due_date < rangeEnd ? r.test_due_date : rangeEnd
          const startIdx = days.findIndex(d => toDateStr(d) === start)
          const endIdx = days.findIndex(d => toDateStr(d) === end)
          if (startIdx !== -1 && endIdx !== -1) {
            rawBars.push({ r, kind: 'test', startIdx, endIdx, hasStart: true })
          }
        }
      })

      rawBars.sort((a, b) => a.startIdx - b.startIdx)

      const laneEnds: number[] = []
      const bars: Bar[] = rawBars.map(b => {
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
  }, [requests, days, rangeStart, rangeEnd, viewLayer, hidePlanIfDone])

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

        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {([['all', '전체 보기'], ['plan', '기획 일정'], ['test', '테스트 일정']] as const).map(([v, label]) => (
            <button key={v} onClick={() => setViewLayer(v)}
              className={`text-xs font-medium px-3 py-1 rounded-md transition-colors ${viewLayer === v ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>
              {label}
            </button>
          ))}
        </div>

        <p className="text-xs text-gray-400 ml-auto hidden md:block">기획시작일자~기획완료예정일 구간 · 막대 클릭 시 수정</p>
      </div>

      {/* 타임라인 그리드 */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: cellCount * (viewMode === 'week' ? 110 : 28) + 100 }}>
          {/* 날짜 헤더 */}
          <div className="flex">
            <div className="w-24 shrink-0 sticky left-0 z-10 bg-white" />
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

          {/* 담당자별 행 — 담당자 1명 = 테두리 있는 카드 하나로 보이게 하고, 카드 사이에 실제 여백을 둬서
              색 차이에만 의존하지 않고 구조적으로도 구분되게 한다 */}
          <div className="flex flex-col gap-4">
            {laneRows.map(({ name, bars, laneCount }, idx) => {
              const subRowBg = 'bg-gray-50'
              // 카드 테두리/여백에 더해, 한 명 걸러 한 명씩 연한 색을 깔아 구분을 한층 더 뚜렷하게 한다
              // (보조 행의 회색과 헷갈리지 않도록 다른 색 계열(인디고)을 사용)
              const groupBg = idx % 2 === 0 ? 'bg-indigo-50/40' : 'bg-white'
              // 일정 개수와 무관하게 담당자 영역이 공통으로 최소 3줄 높이는 확보되게 한다
              const displayLanes = Math.max(laneCount, 3)
              return (
              <div key={name} className={`relative border border-gray-300 ${groupBg}`}>
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-300 z-20" />
                <div className="flex items-stretch py-1.5">
                  <div className={`w-24 shrink-0 flex flex-col items-center justify-center gap-0.5 px-2 sticky left-0 z-10 ${groupBg}`}>
                    <span className="text-2xl leading-none">{MEMBER_EMOJI[name]}</span>
                    <span className="text-sm font-bold text-gray-700 truncate max-w-full">{name}</span>
                  </div>
                  <div className="flex-1 relative" style={{ height: displayLanes * (BAR_H + BAR_GAP) + ROW_PAD }}>
                    {todayIdx !== -1 && (
                      <div className="absolute top-0 bottom-0 w-px bg-indigo-200"
                        style={{ left: `${((todayIdx + 0.5) / cellCount) * 100}%` }} />
                    )}
                    {bars.length === 0 ? (
                      <div className="absolute inset-0 flex items-center">
                        <span className="text-[11px] text-gray-400 bg-gray-100/80 px-2.5 py-1 rounded-full border border-dashed border-gray-200">일정 없음</span>
                      </div>
                    ) : bars.map(({ r, kind, startIdx, endIdx, hasStart, lane }) => {
                      const barLeft = (startIdx / cellCount) * 100
                      const barWidth = Math.max(((endIdx - startIdx + 1) / cellCount) * 100, 100 / cellCount)

                      // 테스트 구간 — 기획과 시기가 전혀 다를 수 있어(예: 기획 3월/테스트 5월) 같은 막대에
                      // 얹지 않고, 일반 업무 막대와 동일하게 자기 날짜 위치에 제목/영업일수까지 다 보이는 독립 막대로 표시한다.
                      if (kind === 'test') {
                        const testBusinessDays = countBusinessDays(r.test_start_date!, r.test_due_date!)
                        const testTooltip = `${r.title} - 테스트 (${r.test_start_date} ~ ${r.test_due_date}) (영업일 ${testBusinessDays}일)${r.test_status ? ` [${r.test_status}]` : ''}`
                        return (
                          <div key={`${r.id}-test`} className="absolute" style={{ left: `${barLeft}%`, width: `${barWidth}%`, top: lane * (BAR_H + BAR_GAP), height: BAR_H }}>
                            <button
                              type="button"
                              onClick={() => onSelectIssue(r)}
                              title={testTooltip}
                              className={`absolute top-0 left-0 w-full h-full rounded-md border-2 px-2 flex items-center text-[11px] font-medium text-black truncate text-left hover:brightness-95 transition-all ${TEST_STATUS_COLOR[r.test_status ?? '테스트 대기']}`}
                            >
                              <span className="opacity-90 font-normal mr-1 shrink-0">[테스트]</span>{r.title}
                              <span className="opacity-80 font-normal"> (영업일 {testBusinessDays}일){r.test_status ? ` · ${r.test_status}` : ''}</span>
                            </button>
                          </div>
                        )
                      }

                      const history = r.schedule_history ?? []
                      const hasHistory = history.length > 0
                      const businessDays = hasStart && r.start_date && r.due_date
                        ? countBusinessDays(r.start_date, r.due_date)
                        : null
                      const businessDaysLabel = businessDays !== null ? ` (영업일 ${businessDays}일)` : ''

                      // 실제 완료일이 예정일과 다르면, 막대를 "계획대로 진행된 구간(상태색)"과
                      // "초과/단축된 구간(경고색/회색)"으로 나눠서 그 차이만큼만 보여준다.
                      const hasActual = !!r.actual_due_date && !!r.due_date
                      const late = hasActual && r.actual_due_date! > r.due_date!
                      const early = hasActual && r.actual_due_date! < r.due_date!
                      const varianceDays = hasActual ? businessDaysDiff(r.due_date!, r.actual_due_date!) : 0
                      const varianceLabel = late ? ` (예정보다 ${varianceDays}일 초과)` : early ? ` (예정보다 ${-varianceDays}일 단축)` : ''

                      const wrapperSpan = endIdx - startIdx + 1
                      const dateToWidthPct = (dateRaw: string) => {
                        const clipped = dateRaw < rangeEnd ? dateRaw : rangeEnd
                        const idx = days.findIndex(d => toDateStr(d) === clipped)
                        return idx !== -1 ? Math.min(100, Math.max(0, ((idx - startIdx + 1) / wrapperSpan) * 100)) : 100
                      }
                      const planWidthPct = dateToWidthPct(late ? r.actual_due_date! : r.due_date!)
                      const solidWidthPct = (late || early) ? dateToWidthPct(early ? r.actual_due_date! : r.due_date!) : planWidthPct
                      const deltaWidthPct = Math.max(0, planWidthPct - solidWidthPct)

                      const tooltip = [
                        `${r.title} (${r.start_date ?? '시작일 미정'} ~ ${r.due_date})${businessDaysLabel}`,
                        ...(hasActual ? [`실제 완료일: ${r.actual_due_date}${varianceLabel}`] : []),
                        ...history.map((h, i) =>
                          `${i === 0 ? '[최초]' : `[변경 ${i}]`} ${h.start_date ?? '미정'} ~ ${h.due_date ?? '미정'}${h.reason ? ` (사유: ${h.reason})` : ''}`
                        ),
                      ].join('\n')
                      return (
                        <div key={r.id} className="absolute" style={{ left: `${barLeft}%`, width: `${barWidth}%`, top: lane * (BAR_H + BAR_GAP), height: BAR_H }}>
                          <button
                            type="button"
                            onClick={() => onSelectIssue(r)}
                            title={tooltip}
                            className={`absolute top-0 h-full ${deltaWidthPct > 0 ? 'rounded-l-md' : 'rounded-md'} px-2 flex items-center text-[11px] font-medium text-white truncate text-left hover:brightness-95 transition-all ${STATUS_BAR_COLOR[r.status]} ${hasStart ? '' : 'opacity-60 border border-dashed border-white/70'}`}
                            style={{ left: 0, width: `${solidWidthPct}%` }}
                          >
                            {r.title}{businessDaysLabel && <span className="opacity-80 font-normal">{businessDaysLabel}</span>}{varianceLabel && <span className="opacity-90 font-semibold">{varianceLabel}</span>}
                          </button>
                          {deltaWidthPct > 0 && (
                            <button
                              type="button"
                              onClick={() => onSelectIssue(r)}
                              title={tooltip}
                              className={`absolute top-0 h-full border-2 border-dashed ${planWidthPct >= 100 ? 'rounded-r-md' : ''} ${
                                late ? 'bg-red-400/70 border-red-600' : 'bg-gray-300/70 border-gray-400'
                              }`}
                              style={{ left: `${solidWidthPct}%`, width: `${deltaWidthPct}%` }}
                            />
                          )}
                          {hasHistory && (
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); onToggleHistory(r.id) }}
                              title="일정 변경 이력 보기"
                              className="absolute z-10 w-4 h-4 rounded-full bg-white text-[9px] leading-none flex items-center justify-center shadow border border-gray-200 hover:scale-110 transition-transform"
                              style={{ left: -7, top: -6 }}
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
                  const isOpen = expandedTaskIds.has(r.id)
                  const history = r.schedule_history ?? []
                  const pastEntries = history.slice(0, -1)
                  return (
                    <div key={r.id} style={{ display: 'grid', gridTemplateRows: isOpen ? '1fr' : '0fr', transition: 'grid-template-rows 200ms ease' }}>
                      <div style={{ overflow: 'hidden' }}>
                        <div className={`pt-1.5 pb-2 ${subRowBg} space-y-1`}>
                          {pastEntries.map((h, i) => {
                            const pos = clipToGrid(h.start_date, h.due_date, rangeStart, rangeEnd, days, cellCount)
                            const label = i === 0 ? '최초 계획' : `변경 ${i}회차`
                            // 사유는 "이 구간에서 다음 구간으로 바뀐 이유"이므로, 한 칸 뒤(다음 차수)의 사유를 이 줄에 표시한다
                            const nextReason = history[i + 1]?.reason ?? null
                            return (
                              <div key={i} className="flex items-stretch">
                                <div className="w-24 shrink-0 pl-4 pr-2 flex items-center">
                                  <span className="text-[10px] text-gray-400 truncate border-l-2 border-gray-300 pl-1.5 -ml-1">{label}</span>
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
              )
            })}
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
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm inline-block bg-red-400/70 border border-dashed border-red-600" />예정보다 초과
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm inline-block bg-gray-300/70 border border-dashed border-gray-400" />예정보다 단축
        </span>
        <span className="flex items-center gap-1 ml-2">
          <span className="w-2.5 h-2.5 rounded-sm inline-block bg-[#FFEDD5] border border-orange-500" />테스트 기간
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
