import { supabase } from './supabase'

export const FIELD_LABELS: Record<string, string> = {
  assignee:     '담당자',
  status:       '기획진행상태',
  start_date:   '기획시작일자',
  due_date:     '기획완료예정일',
  actual_due_date: '실제완료일',
  test_start_date: '테스트시작일',
  test_due_date: '테스트종료일',
  test_status:  '테스트진행상태',
  deploy_date:  '배포예정일',
  request_team: '요청팀',
  priority:     '우선순위',
  title:        '제목',
  summary:      '내용요약',
  requester:    '요청자',
  request_date: '등록일자',
  jira_link:    'Jira 링크',
  jira_key:     'Jira 키',
  jira_status:  'Jira 상태',
  schedule_history: '일정 변경 이력',
}

interface LogEntry {
  user_name: string
  action: 'create' | 'update' | 'delete'
  request_id: number | null
  request_title: string
  field_name?: string | null
  field_label?: string | null
  old_value?: string | null
  new_value?: string | null
}

export async function logActivity(entry: LogEntry): Promise<void> {
  try {
    const { error } = await supabase.from('activity_logs').insert(entry)
    if (error) console.error('[logger] insert error:', error.message)
  } catch (e) {
    console.error('[logger] unexpected error:', e)
  }
}
