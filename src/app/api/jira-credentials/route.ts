import { NextRequest, NextResponse } from 'next/server'
import { TEAM_MEMBERS } from '@/lib/constants'
import { getUserJiraStatus, upsertUserJiraCredentials, deleteUserJiraCredentials } from '@/lib/jiraCredentials'

// GET /api/jira-credentials?user_name=신지희 — 연동 여부 조회 (토큰 원문은 절대 반환하지 않음)
export async function GET(req: NextRequest) {
  const userName = req.nextUrl.searchParams.get('user_name') ?? ''
  if (!TEAM_MEMBERS.includes(userName)) {
    return NextResponse.json({ error: '유효하지 않은 사용자입니다.' }, { status: 400 })
  }

  const status = await getUserJiraStatus(userName)
  return NextResponse.json(status)
}

// POST /api/jira-credentials — 개인 Jira 이메일/API 토큰 등록·갱신
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as
    { user_name?: string; jira_email?: string; jira_api_token?: string } | null

  const userName = body?.user_name ?? ''
  const jiraEmail = body?.jira_email?.trim() ?? ''
  const jiraApiToken = body?.jira_api_token?.trim() ?? ''

  if (!TEAM_MEMBERS.includes(userName)) {
    return NextResponse.json({ error: '유효하지 않은 사용자입니다.' }, { status: 400 })
  }
  if (!jiraEmail || !jiraApiToken) {
    return NextResponse.json({ error: 'Jira 이메일과 API 토큰을 모두 입력하세요.' }, { status: 400 })
  }

  try {
    await upsertUserJiraCredentials(userName, jiraEmail, jiraApiToken)
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// DELETE /api/jira-credentials?user_name=신지희 — 연동 해제
export async function DELETE(req: NextRequest) {
  const userName = req.nextUrl.searchParams.get('user_name') ?? ''
  if (!TEAM_MEMBERS.includes(userName)) {
    return NextResponse.json({ error: '유효하지 않은 사용자입니다.' }, { status: 400 })
  }

  await deleteUserJiraCredentials(userName)
  return NextResponse.json({ success: true })
}
