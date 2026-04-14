import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { RequestInput } from '@/types'

// GET /api/requests — 전체 요청 목록 조회
export async function GET() {
  const { data, error } = await supabase
    .from('requests')
    .select('*')
    .order('id', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

// POST /api/requests — 새 요청 등록
export async function POST(req: NextRequest) {
  let body: RequestInput
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ error: '기획건명은 필수 항목입니다.' }, { status: 400 })
  }
  if (!body.request_date) {
    return NextResponse.json({ error: '요청일자는 필수 항목입니다.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('requests')
    .insert([body])
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
