import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'End Here',
  description: '避难所',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'End Here',
  },
}

// V3.2：锁死暖深棕 themeColor，并禁止移动端缩放
export const viewport: Viewport = {
  themeColor: '#1B1614',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      {/* V3.2：注入暖黑底色与防溢出类名 */}
      <body className="bg-[#1B1614] text-stone-400 antialiased overflow-x-hidden">
        <main className="w-full">
          {children}
        </main>
      </body>
    </html>
  )
}