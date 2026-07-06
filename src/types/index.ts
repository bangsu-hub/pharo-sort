export type Status = '대기' | '검토중' | '기획중' | '완료' | '보류'
export type Priority = '★' | '★★' | '★★★'

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
  start_date: string | null   // 기획 시작일자
  due_date: string | null     // 기획 완료 예정일
  deploy_date: string | null  // 배포 예정일
  jira_link: string | null
  jira_key: string | null
  jira_status: string | null  // 지라 보드 상태 (원본)
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
