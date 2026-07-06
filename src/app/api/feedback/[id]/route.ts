import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

type Ctx = { params: Promise<{ id: string }> }

// PATCH /api/feedback/[id] — 상태 변경 (접수/확인중/반영완료/반려)
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })

  const { data, error } = await supabase
    .from('feedback')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/feedback/[id]
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const { error } = await supabase.from('feedback').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
