import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { logActivity, FIELD_LABELS } from '@/lib/logger'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const { data, error } = await supabase
    .from('requests')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const body     = await req.json()
  const userName = req.headers.get('x-user-name') || ''

  // ① 먼저 기존 데이터 가져오기 (로그용)
  const { data: before } = await supabase
    .from('requests').select('*').eq('id', id).single()

  // ② 업데이트
  const { data, error } = await supabase
    .from('requests')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ③ 로그 기록 (fire-and-forget — 실패해도 응답에 영향 없음)
  if (userName && before && data) {
    const loggedFields = [
      'title', 'summary', 'requester', 'request_date', 'request_team',
      'priority', 'assignee', 'status', 'due_date', 'jira_link', 'jira_key',
    ]
    loggedFields
      .filter(f => String((before as Record<string,unknown>)[f] ?? '') !== String((body as Record<string,unknown>)[f] ?? ''))
      .forEach(f => {
        const b = before as Record<string, unknown>
        logActivity({
          user_name:     userName,
          action:        'update',
          request_id:    Number(id),
          request_title: String(b.title ?? ''),
          field_name:    f,
          field_label:   FIELD_LABELS[f] ?? f,
          old_value:     b[f] != null ? String(b[f]) : null,
          new_value:     (body as Record<string,unknown>)[f] != null ? String((body as Record<string,unknown>)[f]) : null,
        }).catch(() => {})
      })
  }

  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const body     = await req.json()
  const userName = req.headers.get('x-user-name') || ''

  // ① 먼저 기존 데이터 가져오기 (로그용)
  const { data: before } = await supabase
    .from('requests').select('*').eq('id', id).single()

  // ② 업데이트 (핵심 로직 — 로그와 무관하게 항상 실행)
  const { data, error } = await supabase
    .from('requests')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ③ 로그 기록 (fire-and-forget — 실패해도 응답에 영향 없음)
  if (userName && before) {
    const b = before as Record<string, unknown>
    const patch = body as Record<string, unknown>
    Object.entries(patch)
      .filter(([f, newVal]) => String(b[f] ?? '') !== String(newVal ?? ''))
      .forEach(([f, newVal]) => {
        logActivity({
          user_name:     userName,
          action:        'update',
          request_id:    Number(id),
          request_title: String(b.title ?? ''),
          field_name:    f,
          field_label:   FIELD_LABELS[f] ?? f,
          old_value:     b[f] != null ? String(b[f]) : null,
          new_value:     newVal != null ? String(newVal) : null,
        }).catch(() => {})
      })
  }

  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const userName = req.headers.get('x-user-name') || ''

  // 삭제 전 제목 조회
  const { data: before } = await supabase
    .from('requests').select('title').eq('id', id).single()

  const { error } = await supabase.from('requests').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 로그 기록 (fire-and-forget)
  if (userName && before) {
    const b = before as Record<string, unknown>
    logActivity({
      user_name:     userName,
      action:        'delete',
      request_id:    null,
      request_title: String(b.title ?? ''),
    }).catch(() => {})
  }

  return NextResponse.json({ success: true })
}
