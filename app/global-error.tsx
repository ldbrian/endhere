'use client'

import { useEffect } from 'react'

// 根布局错误边界：整棵应用树的兜底，必须自带 <html>/<body>
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[EndHere] 全局崩溃:', error)
  }, [error])

  return (
    <html lang="zh-CN">
      <body className="bg-[#110f0e]">
        <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#110f0e] px-6 text-center">
          <p className="text-sm tracking-[0.3em] text-stone-500">这一页暂时合上了</p>
          <p className="max-w-sm text-stone-400">书页出了点问题，你的内容都还安全地收在书里。</p>
          <button
            type="button"
            onClick={reset}
            className="rounded-full border border-stone-700/70 px-6 py-2 text-sm text-stone-300 transition-colors hover:border-[#c9a86c] hover:text-[#c9a86c]"
          >
            重新翻开
          </button>
        </main>
      </body>
    </html>
  )
}
