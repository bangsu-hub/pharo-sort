'use client'

import { Status } from '@/types'

const STATUS_STYLES: Record<string, string> = {
  '대기':   'bg-gray-100 text-gray-500 border border-gray-200',
  '검토중': 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  '기획중': 'bg-purple-100 text-purple-700 border border-purple-200',
  '완료':   'bg-green-100 text-green-700 border border-green-200',
  '보류':   'bg-red-50 text-red-500 border border-red-200',
}
const STATUS_STYLE_FALLBACK = 'bg-gray-100 text-gray-500 border border-gray-200'

const STATUS_DOTS: Record<string, string> = {
  '대기':   'bg-gray-400',
  '검토중': 'bg-yellow-500',
  '기획중': 'bg-purple-500',
  '완료':   'bg-green-500',
  '보류':   'bg-red-400',
}
const STATUS_DOT_FALLBACK = 'bg-gray-400'

interface Props {
  status: Status
  size?: 'sm' | 'md'
}

export default function StatusBadge({ status, size = 'sm' }: Props) {
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap ${STATUS_STYLES[status] ?? STATUS_STYLE_FALLBACK} ${padding}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOTS[status] ?? STATUS_DOT_FALLBACK}`} />
      {status}
    </span>
  )
}
