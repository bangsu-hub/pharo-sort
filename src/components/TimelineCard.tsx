'use client'

import { Request } from '@/types'
import { isOverdue } from '@/lib/weekUtils'

const MEMBER_EMOJI: Record<string, string> = {
  '구자영': '🐰', '윤난희': '🐮', '방수진': '🦄', '박종민': '🐑', '허주희': '🐴',
}

const PRIORITY_COLOR: Record<string, string> = {
  '★':   'text-gray-400',
  '★★':  'text-orange-400',
  '★★★': 'text-red-500',
}

const STATUS_COLORS: Record<string, string> = {
  '접수':   'bg-blue-100 text-blue-700',
  '검토중': 'bg-yellow-100 text-yellow-700',
  '기획중': 'bg-purple-100 text-purple-700',
  '대기':   'bg-gray-100 text-gray-500',
  '완료':   'bg-green-100 text-green-700',
}

interface Props {
  request: Request
  onDragStart: (e: React.DragEvent<HTMLDivElement>, id: number) => void
}

export default function TimelineCard({ request: r, onDragStart }: Props) {
  const overdue = isOverdue(r)

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, r.id)}
      className={`
        bg-white rounded-lg px-3 py-2 shadow-sm border cursor-grab active:cursor-grabbing
        select-none transition-shadow hover:shadow-md
        ${overdue
          ? 'border-l-4 border-l-red-400 border-t-red-100 border-r-red-100 border-b-red-100'
          : 'border-gray-200'}
      `}
    >
      {/* 상단: 배지 줄 */}
      <div className="flex items-center gap-1 mb-1.5 flex-wrap">
        {overdue && (
          <span className="text-xs font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
            지연
          </span>
        )}
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
          {r.status}
        </span>
        <span className={`text-xs font-bold ml-auto ${PRIORITY_COLOR[r.priority] ?? ''}`}>
          {r.priority}
        </span>
      </div>

      {/* 제목 */}
      <p className="text-xs font-semibold text-gray-800 line-clamp-2 leading-snug mb-1.5">
        {r.title}
      </p>

      {/* 담당자 */}
      <div className="flex items-center gap-1">
        <span className="text-sm">{MEMBER_EMOJI[r.assignee] ?? '👤'}</span>
        <span className="text-xs text-gray-500 truncate">
          {r.assignee || '미배정'}
        </span>
        {r.jira_key && (
          <a
            href={r.jira_link ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-xs text-blue-500 hover:underline shrink-0"
            onClick={e => e.stopPropagation()}
            onDragStart={e => e.stopPropagation()}
          >
            {r.jira_key}
          </a>
        )}
      </div>
    </div>
  )
}
