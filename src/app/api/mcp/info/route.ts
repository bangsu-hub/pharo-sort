import { NextResponse } from 'next/server'

// GET /api/mcp/info — 설정 화면의 연결 가이드에 표시할 토큰 발급 여부/값 조회
export async function GET() {
  const token = process.env.MCP_ACCESS_TOKEN ?? null
  return NextResponse.json({ tokenConfigured: !!token, token })
}
