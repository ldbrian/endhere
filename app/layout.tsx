import type { Metadata, Viewport } from 'next'
import './globals.css'
import WorldEngine from './components/WorldEngine' // <-- [CTO 注入] 引入世界引擎
import DataMigrator from './components/DataMigrator' // <-- [CTO 注入] 引入数据迁移组件
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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#1a1612',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>
        {/* [CTO 注入] 将世界引擎挂载到根节点，静默监听 Supabase 的物理状态 */}
        <WorldEngine />
        <DataMigrator />
        
        <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {children}
        </main>
      </body>
    </html>
  )
}