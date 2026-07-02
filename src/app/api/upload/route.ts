import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const BUCKET = 'task-images'
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

// POST /api/upload — 클립보드로 붙여넣은 이미지를 Supabase Storage에 업로드하고 공개 URL 반환
export async function POST(req: NextRequest) {
  const formData = await req.formData().catch(() => null)
  const file = formData?.get('file')

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: '이미지 파일만 업로드할 수 있습니다.' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: '이미지 용량은 10MB를 넘을 수 없습니다.' }, { status: 400 })
  }

  const ext = file.type.split('/')[1] ?? 'png'
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: '3600',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl })
}
