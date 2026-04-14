import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PS(Pharo-Sort)',
  description: '지라 연동 + 수기 요청 통합 관리 대시보드',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
