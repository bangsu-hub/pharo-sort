import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { FeedbackInput } from '@/types'

// GET /api/feedback — 전체 피드백 목록 조회
export async function GET() {
  const { data, error } = await supabase
    .from('feedback')
    .select('*')
    .order('id', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/feedback — 새 피드백 등록
export async function POST(req: NextRequest) {
  let body: FeedbackInput
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ error: '제목은 필수 항목입니다.' }, { status: 400 })
  }
  if (!body.page?.trim()) {
    return NextResponse.json({ error: '화면 위치는 필수 항목입니다.' }, { status: 400 })
  }
  if (!body.user_name?.trim()) {
    return NextResponse.json({ error: '작성자 정보가 없습니다.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('feedback')
    .insert([{ ...body, status: '접수' }])
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
