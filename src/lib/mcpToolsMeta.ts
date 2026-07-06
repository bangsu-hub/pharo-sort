export interface McpToolMeta {
  name: string
  description: string
}

/**
 * 설정 화면의 "사용할 수 있는 명령어" 표에 쓰이는 설명용 메타데이터.
 * 실제 툴 정의(입력 스키마 등)는 src/app/api/mcp/route.ts 에 있음 — 이름/설명이 바뀌면 함께 갱신 필요.
 */
export const MCP_READ_TOOLS: McpToolMeta[] = [
  { name: 'ps_list_requests',     description: '상태/담당자/요청팀/검색어 등 조건별 업무 목록 조회' },
  { name: 'ps_get_request',       description: '업무 ID로 상세 1건 조회' },
  { name: 'ps_list_my_requests',  description: '특정 담당자의 담당 건 조회' },
  { name: 'ps_workload_summary',  description: '담당자별 전체/진행중 건수 요약' },
  { name: 'ps_list_overdue',      description: '기획완료예정일 초과 + 미완료 건 조회' },
  { name: 'ps_list_stg_required', description: 'STG 테스트요청 상태 건 조회' },
  { name: 'ps_list_activity_log', description: '등록/수정/삭제 변경 이력 조회' },
  { name: 'ps_list_feedback',     description: 'Pharo-Sort 자체 버그/개선요청/신규기능 피드백 조회' },
]

export const MCP_WRITE_TOOLS: McpToolMeta[] = [
  { name: 'ps_create_request',    description: '새 업무 수동 등록 (대기 상태로 시작, 요청팀/요청자는 선택 입력)' },
  { name: 'ps_update_status',     description: '기획진행상태 변경' },
  { name: 'ps_assign',            description: '담당자 배정/해제' },
  { name: 'ps_set_start_date',    description: '기획시작일자 설정/삭제' },
  { name: 'ps_set_due_date',      description: '기획완료예정일 설정/삭제' },
  { name: 'ps_set_deploy_date',   description: '배포예정일 설정/삭제' },
  { name: 'ps_sync_jira',         description: '지라 → Pharo-Sort 동기화 트리거' },
  { name: 'ps_create_jira_issue', description: '수동 등록 업무 → 신규 Jira 이슈 생성 후 연결 (처리자 개인 Jira 계정 필요)' },
  { name: 'ps_update_feedback_status', description: '피드백 처리 상태 변경 (접수/확인중/반영완료/반려)' },
]
