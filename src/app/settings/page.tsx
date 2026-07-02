'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { MCP_READ_TOOLS, MCP_WRITE_TOOLS } from '@/lib/mcpToolsMeta'

type ClientTab = 'claude' | 'codex' | 'other'

const TABS: { key: ClientTab; label: string }[] = [
  { key: 'claude', label: 'Claude Code' },
  { key: 'codex',  label: 'Codex CLI' },
  { key: 'other',  label: '기타 (Desktop·Cursor)' },
]

function claudeStyleConfig(url: string, token: string) {
  return JSON.stringify(
    { mcpServers: { 'pharo-sort': { type: 'http', url, headers: { Authorization: `Bearer ${token}` } } } },
    null, 2
  )
}

function codexConfig(url: string, token: string) {
  return `[mcp_servers.pharo-sort]\ncommand = "npx"\nargs = ["-y", "mcp-remote", "${url}", "--header", "Authorization:Bearer ${token}"]`
}

const FILE_HINT: Record<ClientTab, string> = {
  claude: '.mcp.json (프로젝트 루트) 또는 ~/.claude.json',
  codex:  '~/.codex/config.toml',
  other:  'claude_desktop_config.json 또는 .cursor/mcp.json',
}

export default function SettingsPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [origin, setOrigin] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [tokenConfigured, setTokenConfigured] = useState(true)
  const [tab, setTab] = useState<ClientTab>('claude')
  const [guideOpen, setGuideOpen] = useState(true)
  const [copied, setCopied] = useState(false)

  // 개인 Jira 계정
  const [jiraConfigured, setJiraConfigured] = useState(false)
  const [jiraSavedEmail, setJiraSavedEmail] = useState<string | null>(null)
  const [jiraEmailInput, setJiraEmailInput] = useState('')
  const [jiraTokenInput, setJiraTokenInput] = useState('')
  const [jiraSaving, setJiraSaving] = useState(false)
  const [jiraMessage, setJiraMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [jiraLoaded, setJiraLoaded] = useState(false)

  const loadJiraStatus = (user: string) => {
    fetch(`/api/jira-credentials?user_name=${encodeURIComponent(user)}`)
      .then(r => r.json())
      .then(data => {
        setJiraConfigured(!!data.configured)
        setJiraSavedEmail(data.email ?? null)
        setJiraEmailInput(data.email ?? '')
        setJiraLoaded(true)
      })
      .catch(() => setJiraLoaded(true))
  }

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) { router.replace('/login'); return }
    setCurrentUser(user)
    setOrigin(window.location.origin)
    loadJiraStatus(user)

    fetch('/api/mcp/info')
      .then(r => r.json())
      .then(data => {
        setTokenConfigured(!!data.tokenConfigured)
        setToken(data.token)
      })
      .catch(() => setTokenConfigured(false))
  }, [router])

  const handleSaveJira = async () => {
    if (!currentUser) return
    if (!jiraEmailInput.trim() || !jiraTokenInput.trim()) {
      setJiraMessage({ type: 'error', text: 'Jira 이메일과 API 토큰을 모두 입력하세요.' })
      return
    }
    setJiraSaving(true)
    setJiraMessage(null)
    try {
      const res = await fetch('/api/jira-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_name: currentUser, jira_email: jiraEmailInput.trim(), jira_api_token: jiraTokenInput.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '저장에 실패했습니다.')
      setJiraTokenInput('')
      loadJiraStatus(currentUser)
      setJiraMessage({ type: 'success', text: 'Jira 개인 계정이 저장되었습니다.' })
    } catch (e) {
      setJiraMessage({ type: 'error', text: e instanceof Error ? e.message : String(e) })
    } finally {
      setJiraSaving(false)
    }
  }

  const handleUnlinkJira = async () => {
    if (!currentUser) return
    setJiraSaving(true)
    setJiraMessage(null)
    try {
      const res = await fetch(`/api/jira-credentials?user_name=${encodeURIComponent(currentUser)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('연동 해제에 실패했습니다.')
      setJiraConfigured(false)
      setJiraSavedEmail(null)
      setJiraEmailInput('')
      setJiraMessage({ type: 'success', text: 'Jira 개인 계정 연동이 해제되었습니다.' })
    } catch (e) {
      setJiraMessage({ type: 'error', text: e instanceof Error ? e.message : String(e) })
    } finally {
      setJiraSaving(false)
    }
  }

  const mcpUrl = origin ? `${origin}/api/mcp` : ''
  const safeToken = token ?? '<YOUR_TOKEN>'

  const code = mcpUrl
    ? tab === 'codex'
      ? codexConfig(mcpUrl, safeToken)
      : claudeStyleConfig(mcpUrl, safeToken)
    : ''

  const handleCopy = () => {
    if (!code) return
    navigator.clipboard.writeText(code)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      })
      .catch(() => {})
  }

  if (!currentUser) return null

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex items-center gap-3 shadow-sm sticky top-0 z-20">
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <div>
          <h1 className="text-base font-bold text-gray-900 leading-tight">설정</h1>
          <p className="text-xs text-gray-400">연결 가이드 및 시스템 정보</p>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto p-4 md:p-6 space-y-4">
        <h2 className="text-sm font-bold text-gray-500 px-1">연결 가이드</h2>

        {/* AI 도구 연동 (MCP) 카드 */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <button
            onClick={() => setGuideOpen(o => !o)}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0 text-lg">
              🔌
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900">AI 도구 연동 (MCP)</p>
              <p className="text-xs text-gray-400">Claude Code·Codex·Claude Desktop에서 Pharo-Sort 업무를 조회·등록·진행시키기</p>
            </div>
            <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${guideOpen ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
            </svg>
          </button>

          {guideOpen && (
            <div className="border-t border-gray-100 px-4 py-4 space-y-4">
              {!tokenConfigured && (
                <div className="text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg px-3 py-2">
                  MCP_ACCESS_TOKEN 환경변수가 설정되지 않았습니다. .env.local에 토큰을 추가하고 서버를 재시작하세요.
                </div>
              )}

              <ol className="text-xs text-gray-600 space-y-1.5 list-decimal list-inside">
                <li>아래 토큰은 이미 발급된 공용 접속 토큰입니다 (외부에 노출되지 않도록 주의하세요).</li>
                <li>사용할 AI 도구의 설정 파일에 아래 내용을 그대로 붙여넣습니다.</li>
                <li>도구를 재시작하면 <code className="bg-gray-100 px-1 rounded">pharo-sort</code> 도구가 활성화됩니다.</li>
              </ol>

              {/* 탭 */}
              <div className="flex gap-1.5">
                {TABS.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                      tab === t.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <p className="text-xs text-gray-400">{FILE_HINT[tab]}</p>

              {tab === 'codex' && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Codex CLI는 버전에 따라 원격 HTTP 서버 지원 방식이 달라, 범용 브릿지(mcp-remote)를 통해 연결합니다.
                </p>
              )}

              {/* 코드 블록 */}
              <div className="relative">
                <pre className="bg-gray-900 text-gray-100 text-xs rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-all">
                  {code || '불러오는 중...'}
                </pre>
                <button
                  onClick={handleCopy}
                  disabled={!code}
                  className="absolute top-2.5 right-2.5 text-xs font-medium bg-white/10 hover:bg-white/20 text-white px-2.5 py-1 rounded-md transition-colors disabled:opacity-40"
                >
                  {copied ? '복사됨' : '복사'}
                </button>
              </div>
            </div>
          )}
        </div>

        <h2 className="text-sm font-bold text-gray-500 px-1 pt-2">내 Jira 개인 계정</h2>

        {/* Jira 개인 계정 연동 카드 */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 text-lg">
              🔑
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{currentUser}님의 Jira 계정</p>
              <p className="text-xs text-gray-400">
                수동 등록 업무를 Jira 이슈로 만들 때({' '}
                <code className="bg-gray-100 px-1 rounded">ps_create_jira_issue</code>), 본인 계정으로 등록되도록 개인 API 토큰을 사용합니다.
              </p>
            </div>
          </div>

          {jiraLoaded && (
            <p className="text-xs">
              {jiraConfigured
                ? <span className="text-green-600 font-medium">✅ 연동됨 ({jiraSavedEmail})</span>
                : <span className="text-gray-400">미설정 — 등록 전까지는 이 계정으로 Jira 이슈를 생성할 수 없습니다.</span>}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="email"
              placeholder="Jira 이메일"
              value={jiraEmailInput}
              onChange={e => setJiraEmailInput(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-300"
            />
            <input
              type="password"
              placeholder={jiraConfigured ? '새 API 토큰 (변경 시에만 입력)' : 'Jira API 토큰'}
              value={jiraTokenInput}
              onChange={e => setJiraTokenInput(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-300"
            />
          </div>

          {jiraMessage && (
            <p className={`text-xs ${jiraMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {jiraMessage.text}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveJira}
              disabled={jiraSaving}
              className="text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {jiraSaving ? '저장 중...' : '저장'}
            </button>
            {jiraConfigured && (
              <button
                onClick={handleUnlinkJira}
                disabled={jiraSaving}
                className="text-xs font-medium text-red-500 hover:text-red-600 px-2 py-1.5 transition-colors disabled:opacity-50"
              >
                연동 해제
              </button>
            )}
            <a
              href="https://id.atlassian.com/manage-profile/security/api-tokens"
              target="_blank" rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-indigo-500 transition-colors ml-auto"
            >
              토큰 발급 페이지 →
            </a>
          </div>
        </div>

        {/* 사용할 수 있는 명령어 */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 space-y-3">
          <div>
            <p className="text-sm font-bold text-gray-900">사용할 수 있는 명령어 (pharo-sort 툴)</p>
            <p className="text-xs text-gray-400 mt-0.5">
              자연어로 말해도 AI가 알아서 호출합니다 (예: &ldquo;pharo-sort에서 내게 배정된 업무 보여줘&rdquo;, &ldquo;52번 업무 상세 보여줘&rdquo;).
              Claude Code 정식 명칭은 <code className="bg-gray-100 px-1 rounded">mcp__pharo-sort__&lt;툴&gt;</code> — <code className="bg-gray-100 px-1 rounded">/mcp</code>로 목록 확인.
            </p>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-xs">
              <tbody>
                <tr className="bg-gray-100">
                  <td colSpan={2} className="px-3 py-1.5 font-bold text-gray-500">읽기</td>
                </tr>
                {MCP_READ_TOOLS.map(t => (
                  <tr key={t.name} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-mono text-indigo-600 whitespace-nowrap align-top">{t.name}</td>
                    <td className="px-3 py-2 text-gray-600">{t.description}</td>
                  </tr>
                ))}
                <tr className="bg-gray-100 border-t border-gray-200">
                  <td colSpan={2} className="px-3 py-1.5 font-bold text-gray-500">쓰기</td>
                </tr>
                {MCP_WRITE_TOOLS.map(t => (
                  <tr key={t.name} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-mono text-indigo-600 whitespace-nowrap align-top">{t.name}</td>
                    <td className="px-3 py-2 text-gray-600">{t.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-400">
            삭제는 되돌릴 수 없어 MCP에는 일부러 넣지 않았습니다 — 삭제가 필요하면 웹에서 직접 진행해주세요.
          </p>
        </div>
      </main>
    </div>
  )
}
