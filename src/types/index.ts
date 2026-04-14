export type Status = '접수' | '검토중' | '기획중' | '완료'
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
  due_date: string | null
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
}

export interface JiraSyncResult {
  created: number
  skipped: number
  errors: number
  issues: Partial<Request>[]
}
