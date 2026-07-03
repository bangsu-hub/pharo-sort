import { fetchJiraIssues } from './jira'
import { supabase } from './supabase'

export interface JiraSyncSummary {
  message: string
  created: number
  updated: number
  skipped: number
  errors: number
  total: number
}

/**
 * 지라에서 대상 라벨이 달린 이슈를 가져와 Supabase에 반영합니다.
 * - jira_key 기준으로 신규는 INSERT, 기존은 jira_link/jira_status만 갱신 (기획진행상태는 절대 덮어쓰지 않음)
 */
export async function syncJiraIssues(): Promise<JiraSyncSummary> {
  const { issues, total } = await fetchJiraIssues()

  if (issues.length === 0) {
    return { message: '동기화할 이슈가 없습니다.', created: 0, updated: 0, skipped: 0, errors: 0, total }
  }

  const { data: existing } = await supabase
    .from('requests')
    .select('jira_key')
    .not('jira_key', 'is', null)

  const existingKeys = new Set((existing ?? []).map((r: { jira_key: string }) => r.jira_key))

  const toInsert = issues.filter(i => !existingKeys.has(i.jira_key))
  const toUpdate = issues.filter(i => existingKeys.has(i.jira_key))

  let created = 0
  let errors = 0

  if (toInsert.length > 0) {
    const rows = toInsert.map(i => ({ ...i, status: '대기' }))
    const { error } = await supabase.from('requests').insert(rows)
    if (error) {
      console.error('Jira INSERT 오류:', error.message)
      errors++
    } else {
      created = toInsert.length
    }
  }

  for (const issue of toUpdate) {
    await supabase
      .from('requests')
      .update({ jira_link: issue.jira_link, jira_status: issue.jira_status })
      .eq('jira_key', issue.jira_key)
  }

  return {
    message: `동기화 완료: ${created}건 신규, ${toUpdate.length}건 상태 갱신`,
    created,
    updated: toUpdate.length,
    skipped: 0,
    errors,
    total,
  }
}
