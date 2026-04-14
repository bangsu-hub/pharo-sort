'use client'

import { useState, useEffect } from 'react'
import { Request, RequestInput, Status, Priority } from '@/types'
import { TEAM_MEMBERS, REQUEST_TEAMS } from '@/lib/constants'

const STATUSES: Status[]     = ['접수', '검토중', '기획중', '완료']
const PRIORITIES: Priority[] = ['★', '★★', '★★★']

const EMPTY: RequestInput = {
  request_date: new Date().toISOString().slice(0, 10),
  request_team: '',
  requester: '',
  title: '',
  summary: '',
  priority: '★★',
  assignee: '',
  status: '접수',
  due_date: null,
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
  onSave: (data: RequestInput) => Promise<void>
  onClose: () => void
}

export default function RequestForm({ initial, onSave, onClose }: Props) {
  const [form, setForm] = useState<RequestInput>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

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

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!form.title.trim())        e.title = '기획건명을 입력하세요.'
    if (!form.request_date)        e.request_date = '요청일자를 입력하세요.'
    if (!form.request_team.trim()) e.request_team = '요청팀을 입력하세요.'
    if (!form.requester.trim())    e.requester = '요청자를 입력하세요.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white w-full md:max-w-2xl md:mx-4 md:rounded-xl rounded-t-2xl shadow-2xl max-h-[92vh] md:max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* 모바일 드래그 핸들 */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">
            {initial ? '요청 수정' : '새 요청 등록'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="px-4 md:px-6 py-4 md:py-5 space-y-4">
          {/* Row 1: 요청일자 + 요청팀 */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="요청일자" required error={errors.request_date}>
              <input
                type="date"
                value={form.request_date}
                onChange={e => update('request_date', e.target.value)}
                className={inputCls(errors.request_date)}
              />
            </Field>
            <Field label="요청팀" required error={errors.request_team}>
              <select
                value={form.request_team}
                onChange={e => update('request_team', e.target.value)}
                className={inputCls(errors.request_team)}
              >
                <option value="">선택하세요</option>
                {REQUEST_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>

          {/* Row 2: 요청자 + 우선순위 */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="요청자" required error={errors.requester}>
              <input
                type="text"
                value={form.requester}
                onChange={e => update('requester', e.target.value)}
                placeholder="요청 담당자 성함"
                className={inputCls(errors.requester)}
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
              value={form.summary}
              onChange={e => update('summary', e.target.value)}
              placeholder="요구사항 요약 내용을 입력하세요"
              rows={3}
              className={`${inputCls()} resize-none`}
            />
          </Field>

          {/* Row 3: 기획 담당자 + 기획진행상태 */}
          <div className="grid grid-cols-2 gap-4">
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
            <Field label="기획진행상태">
              <select
                value={form.status}
                onChange={e => update('status', e.target.value as Status)}
                className={inputCls()}
              >
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          {/* Row 4: 완료 예정일 + 지라 링크 */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="완료 예정일">
              <input
                type="date"
                value={form.due_date ?? ''}
                onChange={e => update('due_date', e.target.value || null)}
                className={inputCls()}
              />
            </Field>
            <Field label="지라 링크">
              <input
                type="url"
                value={form.jira_link ?? ''}
                onChange={e => update('jira_link', e.target.value || null)}
                placeholder="https://..."
                className={inputCls()}
              />
            </Field>
          </div>

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
  )
}
