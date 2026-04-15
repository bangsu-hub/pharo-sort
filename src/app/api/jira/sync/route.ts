/**
 * POST /api/jira/sync
 * 지라에서 대상 라벨이 달린 이슈를 가져와 Supabase에 Upsert 합니다.
 * - jira_key 를 기준으로 중복 방지 (이미 있으면 상태만 업데이트)
 * - 신규 이슈만 INSERT
 */

import { NextResponse } from 'next/server'
import { fetchJiraIssues } from '@/lib/jira'
import { supabase } from '@/lib/supabase'

export async function POST() {
  try {
    const { issues, total } = await fetchJiraIssues()

    if (issues.length === 0) {
      return NextResponse.json({
        message: '동기화할 이슈가 없습니다.',
        created: 0,
        skipped: 0,
        total,
      })
    }

    // 기존 jira_key 목록 조회
    const { data: existing } = await supabase
      .from('requests')
      .select('jira_key')
      .not('jira_key', 'is', null)

    const existingKeys = new Set((existing ?? []).map((r: { jira_key: string }) => r.jira_key))

    const toInsert = issues.filter(i => !existingKeys.has(i.jira_key))
    const toUpdate = issues.filter(i => existingKeys.has(i.jira_key))

    let created = 0
    let errors = 0

    // 신규 이슈 삽입 — 기획진행상태는 항상 '접수'로 고정
    if (toInsert.length > 0) {
      const rows = toInsert.map(i => ({ ...i, status: '접수' }))
      const { error } = await supabase.from('requests').insert(rows)
      if (error) {
        console.error('Jira INSERT 오류:', error.message)
        errors++
      } else {
        created = toInsert.length
      }
    }

    // 기존 이슈 동기화 — 기획진행상태(status)는 수동 관리이므로 절대 덮어쓰지 않음
    for (const issue of toUpdate) {
      await supabase
        .from('requests')
        .update({ jira_link: issue.jira_link, jira_status: issue.jira_status })
        .eq('jira_key', issue.jira_key)
    }

    return NextResponse.json({
      message: `동기화 완료: ${created}건 신규, ${toUpdate.length}건 상태 갱신`,
      created,
      updated: toUpdate.length,
      skipped: 0,
      errors,
      total,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Jira 동기화 오류:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
