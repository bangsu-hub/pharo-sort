'use client'

import { useState, useEffect, useRef } from 'react'
import { Request, RequestInput, Status, Priority } from '@/types'
import { TEAM_MEMBERS, REQUEST_TEAMS } from '@/lib/constants'

const STATUSES: Status[]     = ['대기', '검토중', '기획중', '완료', '보류']
const PRIORITIES: Priority[] = ['★', '★★', '★★★']

const IMAGE_MARKDOWN = /!\[[^\]]*\]\(([^)]+)\)/g

/** 요약 텍스트 안에 포함된 이미지 마크다운(![이미지](url))을 전부 추출 */
function extractImageUrls(text: string): string[] {
  return Array.from(text.matchAll(IMAGE_MARKDOWN)).map(m => m[1])
}

const EMPTY: RequestInput = {
  request_date: new Date().toISOString().slice(0, 10),
  request_team: '',
  requester: '',
  title: '',
  summary: '',
  priority: '★★',
  assignee: '',
  status: '대기',
  start_date: null,
  due_date: null,
  deploy_date: null,
  jira_link: null,
  jira_key: null,
  jira_status: null,
}

// ← 컴포넌트 밖으로 이동 (리렌더링마다 새 타입으로 인식되는 문제 방지)
function Field({ label, required, error, children }: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  )
}

function inputCls(err?: string) {
  return `w-full text-sm border rounded-md px-3 py-2 focus:outline-none focus:ring-2 ${
    err ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-indigo-300'
  }`
}

interface Props {
  initial?: Request | null
  currentUser?: string | null
  onSave: (data: RequestInput) => Promise<void>
  onClose: () => void
}

export default function RequestForm({ initial, currentUser, onSave, onClose }: Props) {
  const [form, setForm] = useState<RequestInput>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const summaryRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (initial) {
      const { id, created_at, updated_at, ...rest } = initial
      void id; void created_at; void updated_at
      setForm(rest)
    } else {
      setForm({ ...EMPTY, request_date: new Date().toISOString().slice(0, 10) })
    }
    setErrors({})
  }, [initial])

  const update = (key: keyof RequestInput, value: string | null) =>
    setForm(f => ({ ...f, [key]: value }))

  const handlePasteSummary = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image/'))
    if (!item) return // 일반 텍스트 붙여넣기는 그대로 진행

    e.preventDefault()
    const file = item.getAsFile()
    if (!file) return

    setUploading(true)
    setUploadError(null)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '이미지 업로드에 실패했습니다.')

      const textarea = summaryRef.current
      const insertion = `![이미지](${data.url})`
      if (textarea) {
        const start = textarea.selectionStart ?? form.summary.length
        const end = textarea.selectionEnd ?? form.summary.length
        const next = form.summary.slice(0, start) + insertion + form.summary.slice(end)
        update('summary', next)
      } else {
        update('summary', form.summary ? `${form.summary}\n${insertion}` : insertion)
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err))
    } finally {
      setUploading(false)
    }
  }

  /** '기획중'이 아니었다가 '기획중'으로 바뀌는 순간 기획시작일자가 비어있으면 오늘 날짜로 자동 세팅 (이미 값이 있으면 유지) */
  const handleStatusChange = (next: Status) => {
    setForm(f => ({
      ...f,
      status: next,
      start_date: f.status !== '기획중' && next === '기획중' && !f.start_date
        ? new Date().toISOString().slice(0, 10)
        : f.start_date,
    }))
  }

  const removeImage = (url: string) => {
    const next = form.summary.replace(new RegExp(`!\\[[^\\]]*\\]\\(${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)\\n?`), '')
    update('summary', next)
  }

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!form.title.trim())        e.title = '업무명을 입력하세요.'
    if (!form.request_date)        e.request_date = '등록일자를 입력하세요.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      const requester = form.requester.trim() || form.assignee.trim() || currentUser || ''
      await onSave({ ...form, requester })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
    <div
      className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white w-full md:max-w-3xl md:mx-4 md:rounded-xl rounded-t-2xl shadow-2xl max-h-[92vh] md:max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* 모바일 드래그 핸들 */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">
            {initial ? '업무 수정' : '새 업무 등록'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="px-4 md:px-6 py-4 md:py-5 space-y-4">
          {/* Row 1: 등록일자 + 요청팀 */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="등록일자" required error={errors.request_date}>
              <input
                type="date"
                value={form.request_date}
                onChange={e => update('request_date', e.target.value)}
                className={inputCls(errors.request_date)}
              />
            </Field>
            <Field label="요청팀">
              <select
                value={form.request_team}
                onChange={e => update('request_team', e.target.value)}
                className={inputCls()}
              >
                <option value="">미해당 (개인 업무)</option>
                {REQUEST_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>

          {/* Row 2: 요청자 + 우선순위 */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="요청자">
              <input
                type="text"
                value={form.requester}
                onChange={e => update('requester', e.target.value)}
                placeholder="비워두면 담당자로 자동 설정"
                className={inputCls()}
              />
            </Field>
            <Field label="우선순위">
              <select
                value={form.priority}
                onChange={e => update('priority', e.target.value)}
                className={inputCls()}
              >
                {PRIORITIES.map(p => (
                  <option key={p} value={p}>
                    {p} {p === '★' ? '(낮음)' : p === '★★' ? '(중간)' : '(높음)'}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* 기획건명 */}
          <Field label="기획건명" required error={errors.title}>
            <input
              type="text"
              value={form.title}
              onChange={e => update('title', e.target.value)}
              placeholder="업무 타이틀을 입력하세요"
              className={inputCls(errors.title)}
            />
          </Field>

          {/* 내용 요약 */}
          <Field label="내용 요약">
            <textarea
              ref={summaryRef}
              value={form.summary}
              onChange={e => update('summary', e.target.value)}
              onPaste={handlePasteSummary}
              placeholder="요구사항 요약 내용을 입력하세요 (이미지 붙여넣기 가능)"
              rows={12}
              className={`${inputCls()} resize-y min-h-[220px]`}
            />
            {uploading && (
              <p className="text-xs text-indigo-500 mt-1 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                이미지 업로드 중...
              </p>
            )}
            {uploadError && <p className="text-xs text-red-500 mt-1">{uploadError}</p>}
            {extractImageUrls(form.summary).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {extractImageUrls(form.summary).map(url => (
                  <div key={url} className="relative group">
                    <button type="button" onClick={() => setPreviewImage(url)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="첨부 이미지" className="w-16 h-16 object-cover rounded-md border border-gray-200 hover:opacity-80 transition-opacity" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeImage(url)}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gray-700 text-white rounded-full text-xs leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Field>

          {/* Row 3: 기획 담당자 + 기획시작일자 + 기획진행상태 */}
          <div className="grid grid-cols-3 gap-4">
            <Field label="기획 담당자">
              <select
                value={form.assignee}
                onChange={e => update('assignee', e.target.value)}
                className={inputCls()}
              >
                <option value="">미배정</option>
                {TEAM_MEMBERS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="기획시작일자">
              <input
                type="date"
                value={form.start_date ?? ''}
                onChange={e => update('start_date', e.target.value || null)}
                className={inputCls()}
              />
            </Field>
            <Field label="기획진행상태">
              <select
                value={form.status}
                onChange={e => handleStatusChange(e.target.value as Status)}
                className={inputCls()}
              >
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          {/* Row 4: 기획 완료 예정일 + 배포예정일 */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="기획 완료 예정일">
              <input
                type="date"
                value={form.due_date ?? ''}
                onChange={e => update('due_date', e.target.value || null)}
                className={inputCls()}
              />
            </Field>
            <Field label="배포예정일">
              <input
                type="date"
                value={form.deploy_date ?? ''}
                onChange={e => update('deploy_date', e.target.value || null)}
                className={inputCls()}
              />
            </Field>
          </div>

          {/* Row 5: 지라 링크 */}
          <Field label="지라 링크">
            <input
              type="url"
              value={form.jira_link ?? ''}
              onChange={e => update('jira_link', e.target.value || null)}
              placeholder="https://..."
              className={inputCls()}
            />
          </Field>

          {/* 버튼 */}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors font-medium"
            >
              {saving ? '저장 중...' : initial ? '수정 완료' : '등록'}
            </button>
          </div>
        </form>
      </div>
    </div>

    {previewImage && (
      <div
        className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4"
        onClick={() => setPreviewImage(null)}
      >
        <div className="relative max-w-3xl max-h-[85vh]" onClick={e => e.stopPropagation()}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewImage} alt="첨부 이미지 미리보기" className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain" />
          <button
            type="button"
            onClick={() => setPreviewImage(null)}
            className="absolute -top-3 -right-3 w-8 h-8 bg-white text-gray-700 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
          <a
            href={previewImage} target="_blank" rel="noopener noreferrer"
            className="absolute bottom-2 right-2 text-xs bg-black/50 text-white px-2 py-1 rounded hover:bg-black/70 transition-colors"
          >
            새 탭에서 열기 →
          </a>
        </div>
      </div>
    )}
    </>
  )
}
