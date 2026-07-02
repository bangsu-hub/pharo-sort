import { NextRequest } from 'next/server'

export function isAuthorized(req: NextRequest): boolean {
  const token = process.env.MCP_ACCESS_TOKEN
  if (!token) return false

  const header = req.headers.get('authorization') ?? ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1] === token
}
