import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'SKIBKK - จองสนามกีฬาออนไลน์',
  description: 'ระบบจองสนามกีฬาออนไลน์ ง่าย สะดวก รวดเร็ว ดูตารางว่าง เลือกเวลา ชำระเงินออนไลน์',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th">
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1e1e3a',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
            },
          }}
        />
      </body>
    </html>
  )
}
