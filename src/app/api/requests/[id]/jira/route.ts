import { NextRequest, NextResponse } from 'next/server'
import { createJiraIssueForRequest } from '@/lib/createJiraIssueForRequest'

type Ctx = { params: Promise<{ id: string }> }

// POST /api/requests/[id]/jira — 수동 등록 업무를 실행자 본인 Jira 계정으로 이슈 생성
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const userName = decodeURIComponent(req.headers.get('x-user-name') || '')

  if (!userName) {
    return NextResponse.json({ error: '사용자 정보가 없습니다.' }, { status: 400 })
  }

  try {
    const data = await createJiraIssueForRequest(Number(id), userName)
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 })
  }
}
