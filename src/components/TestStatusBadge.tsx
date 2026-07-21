'use client'

import { TestStatus } from '@/types'

const TEST_STATUS_STYLES: Record<TestStatus, string> = {
  '테스트 대기': 'bg-orange-50 text-orange-500 border border-orange-200',
  '테스트 중':   'bg-orange-100 text-orange-700 border border-orange-300',
  '테스트 완료': 'bg-orange-200 text-orange-800 border border-orange-400',
}

const TEST_STATUS_DOTS: Record<TestStatus, string> = {
  '테스트 대기': 'bg-orange-300',
  '테스트 중':   'bg-orange-500',
  '테스트 완료': 'bg-orange-600',
}

interface Props {
  status: TestStatus
  size?: 'sm' | 'md'
}

export default function TestStatusBadge({ status, size = 'sm' }: Props) {
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap ${TEST_STATUS_STYLES[status]} ${padding}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${TEST_STATUS_DOTS[status]}`} />
      {status}
    </span>
  )
}
