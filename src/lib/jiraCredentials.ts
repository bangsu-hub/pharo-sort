import { supabase } from './supabase'
import { JiraPersonalCredentials } from './jira'

/** MCP에서 Jira 이슈 생성 시 실제 실행자 계정으로 인증하기 위한 조회 (토큰 원문 포함) */
export async function getUserJiraCredentials(userName: string): Promise<JiraPersonalCredentials | null> {
  const { data, error } = await supabase
    .from('user_jira_credentials')
    .select('jira_email, jira_api_token')
    .eq('user_name', userName)
    .single()

  if (error || !data) return null
  return { email: data.jira_email, apiToken: data.jira_api_token }
}

/** 설정 화면 표시용 — 토큰 원문은 절대 반환하지 않음 */
export async function getUserJiraStatus(userName: string): Promise<{ configured: boolean; email: string | null }> {
  const { data, error } = await supabase
    .from('user_jira_credentials')
    .select('jira_email')
    .eq('user_name', userName)
    .single()

  if (error || !data) return { configured: false, email: null }
  return { configured: true, email: data.jira_email }
}

export async function upsertUserJiraCredentials(userName: string, email: string, apiToken: string): Promise<void> {
  const { error } = await supabase
    .from('user_jira_credentials')
    .upsert({ user_name: userName, jira_email: email, jira_api_token: apiToken }, { onConflict: 'user_name' })

  if (error) throw new Error(error.message)
}

export async function deleteUserJiraCredentials(userName: string): Promise<void> {
  const { error } = await supabase.from('user_jira_credentials').delete().eq('user_name', userName)
  if (error) throw new Error(error.message)
}
