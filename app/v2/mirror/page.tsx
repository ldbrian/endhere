'use client';

import Link from 'next/link';
import { MirrorTopicPanel } from '../_core/MirrorTopicPanel';

export default function V2MirrorPage() {
  return (
    <main className="min-h-dvh bg-[#101010] text-zinc-100 selection:bg-zinc-700 selection:text-zinc-50">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.05),transparent_34%)]" />
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-6 py-6">
        <header className="shrink-0 border-b border-zinc-800/80 pb-5">
          <div className="flex items-center justify-between gap-4">
            <Link href="/v2" className="text-[11px] tracking-[0.18em] text-zinc-500 transition-colors hover:text-zinc-200">
              {'\u8fd4\u56de'}
            </Link>
            <span className="font-mono text-[10px] tracking-[0.26em] text-zinc-500">THE MIRROR</span>
          </div>
          <h1 className="mt-6 text-[24px] font-light tracking-[0.16em] text-zinc-100">{'\u955c\u5b50'}</h1>
        </header>
        <section className="min-h-0 flex-1 pt-4">
          <MirrorTopicPanel />
        </section>
      </div>
    </main>
  );
}
