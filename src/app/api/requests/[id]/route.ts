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
  const body       = await req.json()
  const userName   = req.headers.get('x-user-name') || ''

  // 변경 전 데이터 조회
  const { data: before } = await supabase.from('requests').select('*').eq('id', id).single()

  const { data, error } = await supabase
    .from('requests')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 변경된 필드 로그
  if (userName && before) {
    const loggedFields = ['title','summary','requester','request_date','request_team',
                          'priority','assignee','status','due_date','jira_link','jira_key']
    await Promise.all(
      loggedFields
        .filter(f => String(before[f] ?? '') !== String(body[f] ?? ''))
        .map(f => logActivity({
          user_name:    userName,
          action:       'update',
          request_id:   Number(id),
          request_title: before.title,
          field_name:   f,
          field_label:  FIELD_LABELS[f] ?? f,
          old_value:    before[f] != null ? String(before[f]) : null,
          new_value:    body[f]   != null ? String(body[f])   : null,
        }))
    )
  }

  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const body     = await req.json()
  const userName = req.headers.get('x-user-name') || ''

  // 변경 전 데이터 조회
  const { data: before } = await supabase.from('requests').select('*').eq('id', id).single()

  const { data, error } = await supabase
    .from('requests')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 변경된 필드 로그
  if (userName && before) {
    await Promise.all(
      Object.entries(body)
        .filter(([f, newVal]) => String(before[f] ?? '') !== String(newVal ?? ''))
        .map(([f, newVal]) => logActivity({
          user_name:    userName,
          action:       'update',
          request_id:   Number(id),
          request_title: before.title,
          field_name:   f,
          field_label:  FIELD_LABELS[f] ?? f,
          old_value:    before[f] != null ? String(before[f]) : null,
          new_value:    newVal    != null ? String(newVal)    : null,
        }))
    )
  }

  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const userName = req.headers.get('x-user-name') || ''

  // 삭제 전 제목 조회
  const { data: before } = await supabase.from('requests').select('title').eq('id', id).single()

  const { error } = await supabase.from('requests').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (userName && before) {
    await logActivity({
      user_name:    userName,
      action:       'delete',
      request_id:   null,
      request_title: before.title,
    })
  }

  return NextResponse.json({ success: true })
}
