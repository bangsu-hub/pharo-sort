export type Status = '대기' | '검토중' | '기획중' | '완료' | '보류'
export type Priority = '★' | '★★' | '★★★'
export type TestStatus = '테스트 대기' | '테스트 중' | '테스트 완료'

/** 일정 변경 차수 이력 항목. schedule_history[0]은 [최초] 계획, 이후는 [변경 N]으로 사유와 함께 기록됨 */
export interface ScheduleChange {
  start_date: string | null
  due_date: string | null
  reason: string | null   // [최초] 항목은 null
}

export interface Request {
  id: number
  request_date: string        // ISO 날짜 문자열 (YYYY-MM-DD)
  request_team: string
  requester: string
  title: string
  summary: string
  priority: Priority
  assignee: string
  status: Status
  start_date: string | null   // 기획 시작일자 (현재/최신 일정)
  due_date: string | null     // 기획 완료 예정일 (현재/최신 일정)
  actual_due_date: string | null  // 실제 완료일
  test_start_date: string | null  // 테스트 시작일
  test_due_date: string | null    // 테스트 종료일
  test_status: TestStatus | null  // 테스트 진행상태 (null = 테스트 단계 미해당/미시작)
  deploy_date: string | null  // 배포 예정일
  jira_link: string | null
  jira_key: string | null
  jira_status: string | null  // 지라 보드 상태 (원본)
  schedule_history: ScheduleChange[]
  created_at: string
  updated_at: string
}

export type RequestInput = Omit<Request, 'id' | 'created_at' | 'updated_at'>

export interface WorkloadItem {
  assignee: string
  active: number   // 완료 제외 건수
  total: number    // 전체 담당 건수
}

export interface FilterState {
  team: string
  status: string
  testStatus: string
  assignee: string
  search: string
  priority: string
  jiraStatus: string
  unassignedOnly: boolean
  excludeDone: boolean
  excludeWaiting: boolean
  myWeekOnly: boolean
}

export interface JiraSyncResult {
  created: number
  skipped: number
  errors: number
  issues: Partial<Request>[]
}

export type FeedbackType = '버그' | '개선요청' | '신규기능'
export type FeedbackStatus = '접수' | '확인중' | '반영완료' | '반려'

export interface Feedback {
  id: number
  user_name: string
  page: string
  type: FeedbackType
  title: string
  description: string
  related_request_id: number | null
  status: FeedbackStatus
  created_at: string
  updated_at: string
}

export type FeedbackInput = Omit<Feedback, 'id' | 'created_at' | 'updated_at'>
