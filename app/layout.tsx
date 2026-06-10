import type { Metadata, Viewport } from 'next'
import './globals.css'
import WorldEngine from './components/WorldEngine'
import DataMigrator from './components/DataMigrator'

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

// 核心修复：锁死 themeColor 为绝对暗黑，并禁止移动端缩放
export const viewport: Viewport = {
  themeColor: '#0C0C0C',
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
      {/* 核心修复：注入 V3 绝对暗黑底色与防溢出类名 */}
      <body className="bg-[#0C0C0C] text-zinc-400 antialiased overflow-x-hidden">
        <WorldEngine />
        <DataMigrator />
        
        {/* 清理了旧版的 style 内联样式和重复挂载的 WorldEngine */}
        <main className="w-full">
          {children}
        </main>
      </body>
    </html>
  )
}