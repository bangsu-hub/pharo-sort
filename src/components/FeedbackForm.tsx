'use client'

import { useRef, useState } from 'react'
import { FeedbackInput, FeedbackType } from '@/types'

const PAGES = ['업무 목록', '담당자 대시보드', '캘린더', '설정', '기타']
const TYPES: FeedbackType[] = ['버그', '개선요청', '신규기능']

const IMAGE_MARKDOWN = /!\[[^\]]*\]\(([^)]+)\)/g
function extractImageUrls(text: string): string[] {
  return Array.from(text.matchAll(IMAGE_MARKDOWN)).map(m => m[1])
}

const EMPTY: FeedbackInput = {
  user_name: '',
  page: PAGES[0],
  type: '버그',
  title: '',
  description: '',
  related_request_id: null,
  status: '접수',
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

function inputCls() {
  return 'w-full text-sm border rounded-md px-3 py-2 focus:outline-none focus:ring-2 border-gray-200 focus:ring-indigo-300'
}

interface Props {
  currentUser: string | null
  onSave: (data: FeedbackInput) => Promise<void>
  onClose: () => void
}

export default function FeedbackForm({ currentUser, onSave, onClose }: Props) {
  const [form, setForm] = useState<FeedbackInput>({ ...EMPTY, user_name: currentUser ?? '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const descRef = useRef<HTMLTextAreaElement>(null)

  const update = <K extends keyof FeedbackInput>(key: K, value: FeedbackInput[K]) =>
    setForm(f => ({ ...f, [key]: value }))

  const handlePasteDescription = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image/'))
    if (!item) return
    e.preventDefault()
    const file = item.getAsFile()
    if (!file) return

    setUploading(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '이미지 업로드에 실패했습니다.')

      const textarea = descRef.current
      const insertion = `![이미지](${data.url})`
      if (textarea) {
        const start = textarea.selectionStart ?? form.description.length
        const end = textarea.selectionEnd ?? form.description.length
        update('description', form.description.slice(0, start) + insertion + form.description.slice(end))
      } else {
        update('description', form.description ? `${form.description}\n${insertion}` : insertion)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { setError('제목을 입력하세요.'); return }
    setSaving(true)
    setError(null)
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white w-full md:max-w-xl md:mx-4 md:rounded-xl rounded-t-2xl shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">불편한 점 남기기</h2>
            <p className="text-xs text-gray-400 mt-0.5">Pharo-Sort 자체 버그/개선요청 — 접수되면 확인 후 반영합니다</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 md:px-6 py-4 md:py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="화면 위치" required>
              <select value={form.page} onChange={e => update('page', e.target.value)} className={inputCls()}>
                {PAGES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="유형" required>
              <select value={form.type} onChange={e => update('type', e.target.value as FeedbackType)} className={inputCls()}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>

          <Field label="제목" required>
            <input
              type="text" value={form.title} onChange={e => update('title', e.target.value)}
              placeholder="어떤 문제/요청인지 한 줄로"
              className={inputCls()}
            />
          </Field>

          <Field label="내용">
            <textarea
              ref={descRef}
              value={form.description}
              onChange={e => update('description', e.target.value)}
              onPaste={handlePasteDescription}
              placeholder={'무엇이 불편한지 자세히 적어주세요.\n가능하면 "기대한 동작 / 실제 동작", 재현 방법도 함께 적어주시면 빠르게 확인할 수 있어요.\n스크린샷은 여기에 바로 붙여넣기(Ctrl+V) 하면 됩니다.'}
              rows={8}
              className={`${inputCls()} resize-y min-h-[160px]`}
            />
            {uploading && <p className="text-xs text-indigo-500 mt-1">이미지 업로드 중...</p>}
            {extractImageUrls(form.description).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {extractImageUrls(form.description).map(url => (
                  <button type="button" key={url} onClick={() => setPreviewImage(url)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="첨부 이미지" className="w-16 h-16 object-cover rounded-md border border-gray-200 hover:opacity-80 transition-opacity" />
                  </button>
                ))}
              </div>
            )}
          </Field>

          <Field label="관련 업무 ID (있다면)">
            <input
              type="number"
              value={form.related_request_id ?? ''}
              onChange={e => update('related_request_id', e.target.value ? Number(e.target.value) : null)}
              placeholder="예: 77"
              className={inputCls()}
            />
          </Field>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 mt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
              취소
            </button>
            <button type="submit" disabled={saving}
              className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors font-medium">
              {saving ? '등록 중...' : '등록'}
            </button>
          </div>
        </form>
      </div>
    </div>

    {previewImage && (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4" onClick={() => setPreviewImage(null)}>
        <div className="relative max-w-3xl max-h-[85vh]" onClick={e => e.stopPropagation()}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewImage} alt="첨부 이미지 미리보기" className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain" />
          <button type="button" onClick={() => setPreviewImage(null)}
            className="absolute -top-3 -right-3 w-8 h-8 bg-white text-gray-700 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-100 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
    )}
    </>
  )
}
