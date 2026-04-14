/**
 * Jira Cloud REST API 연동 모듈 (서버 사이드 전용)
 *
 * 환경 변수:
 *   JIRA_BASE_URL      - https://your-domain.atlassian.net
 *   JIRA_EMAIL         - API 토큰을 발급받은 계정 이메일
 *   JIRA_API_TOKEN     - Jira API 토큰 (https://id.atlassian.com/manage-profile/security/api-tokens)
 *   JIRA_TARGET_LABEL  - 수집 대상 라벨 (기본값: planning-request)
 */

import { RequestInput, Status } from '@/types'

const JIRA_BASE_URL   = process.env.JIRA_BASE_URL
const JIRA_EMAIL      = process.env.JIRA_EMAIL
const JIRA_API_TOKEN  = process.env.JIRA_API_TOKEN
const TARGET_LABELS   = (process.env.JIRA_TARGET_LABEL || 'planning-request').split(',').map(l => l.trim())

function getAuthHeader(): string {
  const credentials = `${JIRA_EMAIL}:${JIRA_API_TOKEN}`
  return `Basic ${Buffer.from(credentials).toString('base64')}`
}

/** 지라 상태를 Pharo-Sort Status로 매핑 */
function mapJiraStatus(jiraStatus: string): Status {
  const s = jiraStatus.toLowerCase()
  if (s.includes('done') || s.includes('closed') || s.includes('완료') || s.includes('resolved')) return '완료'
  if (s.includes('progress') || s.includes('진행') || s.includes('review')) return '기획중'
  if (s.includes('open') || s.includes('todo') || s.includes('접수')) return '접수'
  return '검토중'
}

/** Atlassian Document Format(ADF) → 순수 텍스트 재귀 변환 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractADFText(node: any): string {
  if (!node) return ''
  if (node.type === 'text')      return node.text ?? ''
  if (node.type === 'hardBreak') return '\n'
  if (node.type === 'mention')   return `@${node.attrs?.text ?? ''}`

  const children = (node.content ?? []).map(extractADFText).join('')
  switch (node.type) {
    case 'paragraph':
    case 'heading':    return children + '\n'
    case 'listItem':   return '• ' + children
    case 'rule':       return '---\n'
    default:           return children
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapJiraIssueToRequest(issue: any): Partial<RequestInput> & { jira_key: string } {
  const fields = issue.fields
  const description: string = extractADFText(fields.description).trim()

  return {
    jira_key:     issue.key,
    jira_link:    `${JIRA_BASE_URL}/browse/${issue.key}`,
    title:        fields.summary ?? issue.key,
    summary:      description,
    requester:    fields.reporter?.displayName ?? '',
    request_date: fields.created?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    request_team: fields.labels?.find((l: string) => !TARGET_LABELS.includes(l)) ?? '미분류',
    status:       mapJiraStatus(fields.status?.name ?? ''),
    priority:     '★★',  // 기본값; 지라 우선순위 필드와 추가 매핑 가능
    assignee:     '',    // 기획팀 담당자는 대시보드에서 직접 배정
    due_date:     fields.duedate ?? null,
    jira_status:  fields.status?.name ?? null,
  }
}

export interface JiraFetchResult {
  issues: ReturnType<typeof mapJiraIssueToRequest>[]
  total: number
}

export async function fetchJiraIssues(): Promise<JiraFetchResult> {
  if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    throw new Error('Jira 환경 변수(JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN)가 설정되지 않았습니다.')
  }

  // JQL: 대상 라벨 중 하나라도 포함된 이슈 (최신 100건)
  const labelConditions = TARGET_LABELS.map(l => `labels = "${l}"`).join(' OR ')
  const jql = `(${labelConditions}) ORDER BY created DESC`

  const fields = [
    'summary', 'description', 'reporter', 'assignee',
    'created', 'status', 'labels', 'duedate', 'priority',
  ].join(',')

  const url = new URL(`${JIRA_BASE_URL}/rest/api/3/search/jql`)
  url.searchParams.set('jql', jql)
  url.searchParams.set('fields', fields)
  url.searchParams.set('maxResults', '100')

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: getAuthHeader(),
      Accept: 'application/json',
    },
    // Next.js 캐시 무효화 (항상 최신 데이터)
    cache: 'no-store',
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Jira API 오류 ${response.status}: ${errorText}`)
  }

  const data = await response.json()
  const issues = (data.issues ?? []).map(mapJiraIssueToRequest)

  return { issues, total: data.total ?? issues.length }
}
