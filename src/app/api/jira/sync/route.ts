/**
 * POST /api/jira/sync
 * 지라에서 대상 라벨이 달린 이슈를 가져와 Supabase에 Upsert 합니다.
 */

import { NextResponse } from 'next/server'
import { syncJiraIssues } from '@/lib/jiraSync'

export async function POST() {
  try {
    const result = await syncJiraIssues()
    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Jira 동기화 오류:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
