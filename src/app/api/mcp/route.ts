import { NextRequest, NextResponse } from 'next/server'
import { createMcpHandler } from 'mcp-handler'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { logActivity, FIELD_LABELS } from '@/lib/logger'
import { TEAM_MEMBERS, REQUEST_TEAMS } from '@/lib/constants'
import { isOverdue } from '@/lib/weekUtils'
import { syncJiraIssues } from '@/lib/jiraSync'
import { createJiraIssueForRequest } from '@/lib/createJiraIssueForRequest'
import { isAuthorized } from '@/lib/mcpAuth'
import { Request as PSRequest, Status, FeedbackStatus } from '@/types'

const STATUSES: Status[] = ['대기', '검토중', '기획중', '완료', '보류']
const FEEDBACK_STATUSES: FeedbackStatus[] = ['접수', '확인중', '반영완료', '반려']

function text(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

function errorText(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true }
}

async function fetchRequestById(id: number): Promise<PSRequest | null> {
  const { data, error } = await supabase.from('requests').select('*').eq('id', id).single()
  if (error || !data) return null
  return data as PSRequest
}

/** PATCH 후 변경 필드만 골라 활동 로그를 남기는 공용 헬퍼 */
async function patchRequest(id: number, patch: Partial<PSRequest>, userName: string): Promise<PSRequest | null> {
  const before = await fetchRequestById(id)
  if (!before) return null

  const { data, error } = await supabase.from('requests').update(patch).eq('id', id).select().single()
  if (error) throw new Error(error.message)

  const b = before as unknown as Record<string, unknown>
  Object.entries(patch as Record<string, unknown>).forEach(([field, newVal]) => {
    if (String(b[field] ?? '') === String(newVal ?? '')) return
    logActivity({
      user_name:     userName,
      action:        'update',
      request_id:    id,
      request_title: String(b.title ?? ''),
      field_name:    field,
      field_label:   FIELD_LABELS[field] ?? field,
      old_value:     b[field] != null ? String(b[field]) : null,
      new_value:     newVal != null ? String(newVal) : null,
    }).catch(() => {})
  })

  return data as PSRequest
}

const handler = createMcpHandler(
  (server) => {
    // ───────────────────────── 읽기 ─────────────────────────

    server.registerTool(
      'ps_list_requests',
      {
        title: '업무 목록 조회',
        description: '조건에 맞는 파로스 기획 업무 목록을 조회합니다.',
        inputSchema: {
          status:          z.enum(STATUSES as [Status, ...Status[]]).optional().describe('기획진행상태'),
          assignee:        z.string().optional().describe('담당자 이름'),
          request_team:    z.string().optional().describe(`요청팀 (${REQUEST_TEAMS.join('/')})`),
          jira_status:     z.string().optional().describe('지라 보드 상태 원본 (예: STG 테스트요청)'),
          unassigned_only: z.boolean().optional().describe('담당자 미배정 건만 조회'),
          exclude_done:    z.boolean().optional().describe('완료 건 제외'),
          search:          z.string().optional().describe('제목/요청자/요약/지라이슈번호 검색어'),
          limit:           z.number().int().min(1).max(200).optional().describe('최대 반환 건수 (기본 50)'),
        },
      },
      async ({ status, assignee, request_team, jira_status, unassigned_only, exclude_done, search, limit }) => {
        const { data, error } = await supabase.from('requests').select('*').order('id', { ascending: false })
        if (error) return errorText(error.message)

        let rows = (data ?? []) as PSRequest[]
        if (status)       rows = rows.filter(r => r.status === status)
        if (assignee)     rows = rows.filter(r => r.assignee === assignee)
        if (request_team) rows = rows.filter(r => r.request_team === request_team)
        if (jira_status)  rows = rows.filter(r => r.jira_status === jira_status)
        if (unassigned_only) rows = rows.filter(r => !r.assignee?.trim())
        if (exclude_done)    rows = rows.filter(r => r.status !== '완료')
        if (search) {
          const q = search.toLowerCase()
          rows = rows.filter(r =>
            r.title.toLowerCase().includes(q) ||
            r.requester.toLowerCase().includes(q) ||
            r.summary.toLowerCase().includes(q) ||
            (r.jira_key ?? '').toLowerCase().includes(q))
        }

        return text(rows.slice(0, limit ?? 50))
      }
    )

    server.registerTool(
      'ps_get_request',
      {
        title: '업무 상세 조회',
        description: 'ID로 업무 1건의 상세 정보를 조회합니다.',
        inputSchema: { id: z.number().int().describe('업무 ID') },
      },
      async ({ id }) => {
        const row = await fetchRequestById(id)
        return row ? text(row) : errorText(`업무 #${id}를 찾을 수 없습니다.`)
      }
    )

    server.registerTool(
      'ps_list_my_requests',
      {
        title: '내 담당 업무 조회',
        description: '특정 담당자의 업무 목록을 조회합니다.',
        inputSchema: {
          user_name:    z.string().describe(`담당자 이름 (${TEAM_MEMBERS.join('/')})`),
          exclude_done: z.boolean().optional().describe('완료 건 제외 (기본 true)'),
        },
      },
      async ({ user_name, exclude_done }) => {
        const { data, error } = await supabase
          .from('requests').select('*').eq('assignee', user_name).order('id', { ascending: false })
        if (error) return errorText(error.message)

        let rows = (data ?? []) as PSRequest[]
        if (exclude_done !== false) rows = rows.filter(r => r.status !== '완료')
        return text(rows)
      }
    )

    server.registerTool(
      'ps_workload_summary',
      {
        title: '담당자별 업무 부하 요약',
        description: '팀원별 전체/진행중(완료 제외) 업무 건수를 요약합니다.',
        inputSchema: {},
      },
      async () => {
        const { data, error } = await supabase.from('requests').select('*')
        if (error) return errorText(error.message)

        const rows = (data ?? []) as PSRequest[]
        const summary = TEAM_MEMBERS.map(name => {
          const mine = rows.filter(r => r.assignee === name)
          return { assignee: name, total: mine.length, active: mine.filter(r => r.status !== '완료').length }
        })
        return text(summary)
      }
    )

    server.registerTool(
      'ps_list_overdue',
      {
        title: '지연 건 조회',
        description: '기획 완료 예정일이 지났고 아직 완료되지 않은 업무를 조회합니다.',
        inputSchema: {},
      },
      async () => {
        const { data, error } = await supabase.from('requests').select('*')
        if (error) return errorText(error.message)
        return text(((data ?? []) as PSRequest[]).filter(isOverdue))
      }
    )

    server.registerTool(
      'ps_list_stg_required',
      {
        title: 'STG 테스트요청 건 조회',
        description: '기획자의 STG 테스트 진행이 필요한 건(지라 상태 = STG 테스트요청)을 조회합니다.',
        inputSchema: {},
      },
      async () => {
        const { data, error } = await supabase.from('requests').select('*').eq('jira_status', 'STG 테스트요청')
        if (error) return errorText(error.message)
        return text(data ?? [])
      }
    )

    server.registerTool(
      'ps_list_activity_log',
      {
        title: '변경 이력 조회',
        description: '업무 건의 등록/수정/삭제 이력을 조회합니다.',
        inputSchema: {
          limit:      z.number().int().min(1).max(200).optional().describe('최대 반환 건수 (기본 50)'),
          request_id: z.number().int().optional().describe('특정 업무 ID로 필터'),
          user_name:  z.string().optional().describe('특정 처리자로 필터'),
        },
      },
      async ({ limit, request_id, user_name }) => {
        let query = supabase.from('activity_logs').select('*').order('created_at', { ascending: false })
        if (request_id != null) query = query.eq('request_id', request_id)
        if (user_name)          query = query.eq('user_name', user_name)

        const { data, error } = await query.limit(limit ?? 50)
        if (error) return errorText(error.message)
        return text(data ?? [])
      }
    )

    server.registerTool(
      'ps_list_feedback',
      {
        title: 'Pharo-Sort 자체 피드백 조회',
        description: '기획팀원이 Pharo-Sort 사용 중 남긴 버그/개선요청/신규기능 피드백을 조회합니다.',
        inputSchema: {
          status: z.enum(FEEDBACK_STATUSES as [FeedbackStatus, ...FeedbackStatus[]]).optional().describe('처리 상태로 필터 (기본: 전체)'),
          limit:  z.number().int().min(1).max(200).optional().describe('최대 반환 건수 (기본 50)'),
        },
      },
      async ({ status, limit }) => {
        let query = supabase.from('feedback').select('*').order('id', { ascending: false })
        if (status) query = query.eq('status', status)

        const { data, error } = await query.limit(limit ?? 50)
        if (error) return errorText(error.message)
        return text(data ?? [])
      }
    )

    // ───────────────────────── 쓰기 ─────────────────────────

    server.registerTool(
      'ps_create_request',
      {
        title: '새 업무 등록',
        description: '새 업무(외부 요청 또는 개인 업무)를 수동으로 등록합니다 (기획진행상태는 접수로 시작).',
        inputSchema: {
          user_name:    z.string().describe('등록 처리자 이름 (변경 이력에 기록됨)'),
          title:        z.string().min(1).describe('업무명'),
          summary:      z.string().optional().describe('내용 요약'),
          requester:    z.string().optional().describe('요청자, 미입력 시 담당자(또는 등록 처리자)로 자동 설정'),
          request_date: z.string().describe('등록일자 (YYYY-MM-DD)'),
          request_team: z.string().optional().describe(`요청팀 (${REQUEST_TEAMS.join('/')}), 개인 업무면 미지정`),
          priority:     z.enum(['★', '★★', '★★★']).optional().describe('우선순위 (기본 ★★)'),
          assignee:     z.string().optional().describe(`담당자 (${TEAM_MEMBERS.join('/')}), 미지정 시 미배정`),
          due_date:     z.string().optional().describe('기획 완료 예정일 (YYYY-MM-DD)'),
        },
      },
      async ({ user_name, title, summary, requester, request_date, request_team, priority, assignee, due_date }) => {
        const body = {
          title,
          summary:      summary ?? '',
          requester:    requester?.trim() || assignee?.trim() || user_name,
          request_date,
          request_team: request_team ?? '',
          priority: priority ?? '★★',
          assignee: assignee ?? '',
          status:   '대기' as Status,
          due_date: due_date ?? null,
          jira_link: null, jira_key: null, jira_status: null,
        }

        const { data, error } = await supabase.from('requests').insert([body]).select().single()
        if (error) return errorText(error.message)

        await logActivity({
          user_name, action: 'create', request_id: data.id, request_title: data.title,
        }).catch(() => {})

        return text(data)
      }
    )

    server.registerTool(
      'ps_update_status',
      {
        title: '진행 상태 변경',
        description: '업무의 기획진행상태를 변경합니다.',
        inputSchema: {
          user_name: z.string().describe('처리자 이름 (변경 이력에 기록됨)'),
          id:        z.number().int().describe('업무 ID'),
          status:    z.enum(STATUSES as [Status, ...Status[]]),
        },
      },
      async ({ user_name, id, status }) => {
        try {
          const updated = await patchRequest(id, { status }, user_name)
          return updated ? text(updated) : errorText(`업무 #${id}를 찾을 수 없습니다.`)
        } catch (e) {
          return errorText(e instanceof Error ? e.message : String(e))
        }
      }
    )

    server.registerTool(
      'ps_assign',
      {
        title: '담당자 배정',
        description: '업무의 담당자를 배정하거나 해제합니다.',
        inputSchema: {
          user_name: z.string().describe('처리자 이름 (변경 이력에 기록됨)'),
          id:        z.number().int().describe('업무 ID'),
          assignee:  z.string().describe(`담당자 이름 (${TEAM_MEMBERS.join('/')}), 빈 문자열이면 배정 해제`),
        },
      },
      async ({ user_name, id, assignee }) => {
        try {
          const updated = await patchRequest(id, { assignee }, user_name)
          return updated ? text(updated) : errorText(`업무 #${id}를 찾을 수 없습니다.`)
        } catch (e) {
          return errorText(e instanceof Error ? e.message : String(e))
        }
      }
    )

    server.registerTool(
      'ps_set_due_date',
      {
        title: '기획 완료 예정일 변경',
        description: '업무의 기획 완료 예정일을 설정하거나 삭제합니다.',
        inputSchema: {
          user_name: z.string().describe('처리자 이름 (변경 이력에 기록됨)'),
          id:        z.number().int().describe('업무 ID'),
          due_date:  z.string().nullable().describe('기획 완료 예정일 (YYYY-MM-DD), null이면 삭제'),
        },
      },
      async ({ user_name, id, due_date }) => {
        try {
          const updated = await patchRequest(id, { due_date } as Partial<PSRequest>, user_name)
          return updated ? text(updated) : errorText(`업무 #${id}를 찾을 수 없습니다.`)
        } catch (e) {
          return errorText(e instanceof Error ? e.message : String(e))
        }
      }
    )

    server.registerTool(
      'ps_set_start_date',
      {
        title: '기획시작일자 변경',
        description: '업무의 기획시작일자를 설정하거나 삭제합니다.',
        inputSchema: {
          user_name:  z.string().describe('처리자 이름 (변경 이력에 기록됨)'),
          id:         z.number().int().describe('업무 ID'),
          start_date: z.string().nullable().describe('기획시작일자 (YYYY-MM-DD), null이면 삭제'),
        },
      },
      async ({ user_name, id, start_date }) => {
        try {
          const updated = await patchRequest(id, { start_date } as Partial<PSRequest>, user_name)
          return updated ? text(updated) : errorText(`업무 #${id}를 찾을 수 없습니다.`)
        } catch (e) {
          return errorText(e instanceof Error ? e.message : String(e))
        }
      }
    )

    server.registerTool(
      'ps_add_schedule_change',
      {
        title: '일정 변경 이력 추가',
        description: '업무의 기획시작일자/완료예정일 변경 시 사유와 함께 차수별 이력을 남기고 현재 일정을 최신 값으로 갱신합니다. 최초 호출 시 기존 일정이 자동으로 [최초] 항목으로 기록됩니다.',
        inputSchema: {
          user_name:  z.string().describe('처리자 이름 (변경 이력에 기록됨)'),
          id:         z.number().int().describe('업무 ID'),
          start_date: z.string().describe('변경된 기획시작일자 (YYYY-MM-DD)'),
          due_date:   z.string().describe('변경된 기획완료예정일 (YYYY-MM-DD)'),
          reason:     z.string().describe('일정 변경 사유'),
        },
      },
      async ({ user_name, id, start_date, due_date, reason }) => {
        try {
          const before = await fetchRequestById(id)
          if (!before) return errorText(`업무 #${id}를 찾을 수 없습니다.`)

          const history = Array.isArray(before.schedule_history) ? [...before.schedule_history] : []
          if (history.length === 0) {
            history.push({ start_date: before.start_date, due_date: before.due_date, reason: null })
          }
          history.push({ start_date, due_date, reason })

          const updated = await patchRequest(id, { schedule_history: history, start_date, due_date } as Partial<PSRequest>, user_name)
          return updated ? text(updated) : errorText(`업무 #${id}를 찾을 수 없습니다.`)
        } catch (e) {
          return errorText(e instanceof Error ? e.message : String(e))
        }
      }
    )

    server.registerTool(
      'ps_delete_schedule_change',
      {
        title: '일정 변경 이력 항목 삭제',
        description: '업무의 "일정 변경 이력" 목록에서 [최초]/[변경 N] 항목 하나를 삭제합니다. 마지막(최신) 항목을 삭제하면 그 앞 항목이 새 현재 일정이 되어 기획시작일자/완료예정일에도 자동 반영됩니다.',
        inputSchema: {
          user_name: z.string().describe('처리자 이름 (변경 이력에 기록됨)'),
          id:        z.number().int().describe('업무 ID'),
          index:     z.number().int().min(0).describe('삭제할 이력 항목의 인덱스 (0=최초, 1=변경 1, 2=변경 2, ...)'),
        },
      },
      async ({ user_name, id, index }) => {
        try {
          const before = await fetchRequestById(id)
          if (!before) return errorText(`업무 #${id}를 찾을 수 없습니다.`)

          const history = Array.isArray(before.schedule_history) ? before.schedule_history : []
          if (index >= history.length) {
            return errorText(`인덱스 ${index}에 해당하는 이력 항목이 없습니다 (전체 ${history.length}건).`)
          }

          const wasLast = index === history.length - 1
          const newHistory = history.filter((_, i) => i !== index)

          const patch: Partial<PSRequest> = { schedule_history: newHistory }
          if (wasLast && newHistory.length > 0) {
            const newLast = newHistory[newHistory.length - 1]
            patch.start_date = newLast.start_date
            patch.due_date = newLast.due_date
          }

          const updated = await patchRequest(id, patch, user_name)
          return updated ? text(updated) : errorText(`업무 #${id}를 찾을 수 없습니다.`)
        } catch (e) {
          return errorText(e instanceof Error ? e.message : String(e))
        }
      }
    )

    server.registerTool(
      'ps_set_deploy_date',
      {
        title: '배포예정일 변경',
        description: '업무의 배포예정일을 설정하거나 삭제합니다.',
        inputSchema: {
          user_name:   z.string().describe('처리자 이름 (변경 이력에 기록됨)'),
          id:          z.number().int().describe('업무 ID'),
          deploy_date: z.string().nullable().describe('배포예정일 (YYYY-MM-DD), null이면 삭제'),
        },
      },
      async ({ user_name, id, deploy_date }) => {
        try {
          const updated = await patchRequest(id, { deploy_date } as Partial<PSRequest>, user_name)
          return updated ? text(updated) : errorText(`업무 #${id}를 찾을 수 없습니다.`)
        } catch (e) {
          return errorText(e instanceof Error ? e.message : String(e))
        }
      }
    )

    server.registerTool(
      'ps_sync_jira',
      {
        title: 'Jira 동기화',
        description: '대상 라벨이 달린 지라 이슈를 가져와 신규 업무를 등록하고, 기존 업무의 지라 상태를 갱신합니다.',
        inputSchema: {},
      },
      async () => {
        try {
          return text(await syncJiraIssues())
        } catch (e) {
          return errorText(e instanceof Error ? e.message : String(e))
        }
      }
    )

    server.registerTool(
      'ps_create_jira_issue',
      {
        title: '수동 등록 업무를 Jira 이슈로 생성',
        description: '지라 연동 없이 수동으로 등록된 업무 건에 대해 새 Jira 이슈를 생성하고 연결합니다. 처리자 본인의 Jira 개인 계정(설정 화면에서 등록)으로 인증하여 실제 등록자가 정확히 남습니다. 개인 토큰 미등록 시 실패합니다. 이미 지라 이슈가 연결된 건도 실패 처리됩니다.',
        inputSchema: {
          user_name: z.string().describe(`처리자 이름 (${TEAM_MEMBERS.join('/')}) — 이 사람의 Jira 개인 토큰으로 이슈가 생성됩니다`),
          id:        z.number().int().describe('업무 ID'),
        },
      },
      async ({ user_name, id }) => {
        try {
          const data = await createJiraIssueForRequest(id, user_name)
          return text(data)
        } catch (e) {
          return errorText(e instanceof Error ? e.message : String(e))
        }
      }
    )

    server.registerTool(
      'ps_update_feedback_status',
      {
        title: '피드백 처리 상태 변경',
        description: '접수된 Pharo-Sort 자체 피드백의 처리 상태를 변경합니다 (예: 반영 완료 후 반영완료로 표시).',
        inputSchema: {
          id:     z.number().int().describe('피드백 ID'),
          status: z.enum(FEEDBACK_STATUSES as [FeedbackStatus, ...FeedbackStatus[]]),
        },
      },
      async ({ id, status }) => {
        const { data, error } = await supabase.from('feedback').update({ status }).eq('id', id).select().single()
        if (error) return errorText(error.message)
        if (!data) return errorText(`피드백 #${id}를 찾을 수 없습니다.`)
        return text(data)
      }
    )

    server.registerTool(
      'ps_delete_activity_log',
      {
        title: '변경 이력 삭제',
        description: '업무 변경 이력(활동 로그) 1건을 영구 삭제합니다. 삭제 후 복구할 수 없으니 신중히 사용하세요.',
        inputSchema: {
          id: z.number().int().describe('삭제할 활동 로그 ID (ps_list_activity_log 조회 결과의 id 값)'),
        },
      },
      async ({ id }) => {
        const { data: before } = await supabase.from('activity_logs').select('id').eq('id', id).single()
        if (!before) return errorText(`활동 로그 #${id}를 찾을 수 없습니다.`)

        const { error } = await supabase.from('activity_logs').delete().eq('id', id)
        if (error) return errorText(error.message)

        return text({ deleted: true, id })
      }
    )
  },
  {},
  { basePath: '/api', maxDuration: 60 }
)

async function withAuth(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return handler(req)
}

export { withAuth as GET, withAuth as POST, withAuth as DELETE }
