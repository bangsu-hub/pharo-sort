'use client'

// Jira API 실제 반환값 → 표시명 매핑
const DISPLAY_NAME: Record<string, string> = {
  '해야 할 일': '할일',
  '진행 중':    '진행중',
}

// 표시명 기준 스타일 (API값 & 보드명 모두 커버)
const STYLES: Record<string, string> = {
  '참고':           'bg-gray-100    text-gray-600   border-gray-200',
  '대기':           'bg-yellow-100  text-yellow-700 border-yellow-200',
  '할일':           'bg-blue-100    text-blue-700   border-blue-200',
  '해야 할 일':     'bg-blue-100    text-blue-700   border-blue-200',
  '진행중':         'bg-indigo-100  text-indigo-700 border-indigo-200',
  '진행 중':        'bg-indigo-100  text-indigo-700 border-indigo-200',
  'DEV PR':         'bg-orange-100  text-orange-700 border-orange-200',
  'STG 테스트요청': 'bg-purple-100  text-purple-700 border-purple-200',
  'STG 테스트완료': 'bg-teal-100    text-teal-700   border-teal-200',
  '완료':           'bg-green-100   text-green-700  border-green-200',
  // 기타 발견 상태
  '보류':           'bg-gray-100    text-gray-500   border-gray-200',
  '취소':           'bg-red-50      text-red-400    border-red-200',
  'PR':             'bg-orange-100  text-orange-700 border-orange-200',
  '테스트요청':     'bg-purple-100  text-purple-700 border-purple-200',
  '테스트완료':     'bg-teal-100    text-teal-700   border-teal-200',
}

export default function JiraStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-gray-300 text-xs">—</span>

  const displayName = DISPLAY_NAME[status] ?? status
  const style = STYLES[status] ?? STYLES[displayName] ?? 'bg-gray-100 text-gray-500 border-gray-200'

  return (
    <span className={`inline-block text-xs font-medium rounded px-1.5 py-0.5 border whitespace-nowrap ${style}`}>
      {displayName}
    </span>
  )
}
