import { supabase } from './supabase'
import { logActivity, FIELD_LABELS } from './logger'
import { createJiraIssue } from './jira'
import { getUserJiraCredentials } from './jiraCredentials'
import { Request as PSRequest } from '@/types'

/**
 * 수동 등록된 업무를 실행자 본인의 Jira 개인 계정으로 신규 이슈 생성하고 연결합니다.
 * MCP 툴(ps_create_jira_issue)과 웹 화면의 "Jira 이슈 생성" 버튼이 공유하는 로직입니다.
 */
export async function createJiraIssueForRequest(id: number, userName: string): Promise<PSRequest> {
  const { data: before, error: fetchError } = await supabase.from('requests').select('*').eq('id', id).single()
  if (fetchError || !before) throw new Error(`업무 #${id}를 찾을 수 없습니다.`)
  if (before.jira_key) throw new Error(`이미 Jira 이슈(${before.jira_key})가 연결되어 있습니다.`)

  const credentials = await getUserJiraCredentials(userName)
  if (!credentials) {
    throw new Error(`${userName}님의 Jira 개인 토큰이 설정되지 않았습니다. 설정 화면에서 Jira 개인 계정을 먼저 등록해주세요.`)
  }

  const created = await createJiraIssue({
    title:        before.title,
    summary:      before.summary,
    request_team: before.request_team,
  }, credentials)

  const { data, error } = await supabase
    .from('requests')
    .update({ jira_key: created.key, jira_link: created.link, jira_status: created.status })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)

  const changedFields = ['jira_key', 'jira_link', 'jira_status'] as const
  changedFields.forEach(field => {
    logActivity({
      user_name: userName, action: 'update', request_id: id, request_title: before.title,
      field_name: field, field_label: FIELD_LABELS[field] ?? field,
      old_value: null,
      new_value: String((data as Record<string, unknown>)[field] ?? ''),
    }).catch(() => {})
  })

  return data as PSRequest
}
