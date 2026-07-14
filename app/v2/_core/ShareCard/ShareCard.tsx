'use client';

import type { BookPage } from '../storage';
import { getPersonaDefinition, normalizePersonaId } from '../personas';
import { extractPageTitle, formatPreviewText } from '../BookNavigator/utils';

// 离屏分享卡。不依赖原页面复杂层叠（blur / radial-gradient / 纸纹），
// 用 html2canvas 能稳定渲染的简单样式。根节点 id="share-card-node"。

export function ShareCard({ page }: { page: BookPage }) {
  const paragraph = page.paragraphs[0];
  const title = page.title.trim() || extractPageTitle(page.paragraphs.map((p) => p.text));
  const personaName = paragraph?.persona ? getPersonaDefinition(normalizePersonaId(paragraph.persona)).name : 'Echo';
  const trace = paragraph?.trace ? formatPreviewText(paragraph.trace, 88) : '';

  return (
    <div
      id="share-card-node"
      // 固定宽度，最小高度。纯色背景——不用 radial-gradient / blur，保证 html2canvas 稳定。
      style={{
        width: 360,
        minHeight: 480,
        backgroundColor: '#181412',
        boxSizing: 'border-box',
        padding: '40px 32px 28px',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif',
        color: '#d6d3d1',
        position: 'relative',
        border: '1px solid rgba(93,70,49,0.55)',
        borderRadius: 6,
      }}
    >
      {/* 页号 + 标题 */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <p style={{ fontSize: 15, letterSpacing: '0.34em', margin: 0, color: '#a8a29e', fontFamily: 'monospace' }}>
          {page.page_number}
        </p>
        {title ? (
          <p style={{ fontSize: 12, letterSpacing: '0.08em', margin: '10px 0 0', color: '#78716c' }}>{title}</p>
        ) : null}
      </div>

      {/* 正文 */}
      <div style={{ borderTop: '1px solid rgba(68,64,60,0.5)', paddingTop: 24, flex: 1 }}>
        {page.paragraphs.map((p) => (
          <p
            key={p.id}
            style={{
              whiteSpace: 'pre-wrap',
              fontSize: 14.5,
              lineHeight: 2,
              letterSpacing: '0.04em',
              margin: '0 0 16px',
              color: '#d6d3d1',
              fontWeight: 300,
              wordBreak: 'break-word',
            }}
          >
            {p.text}
          </p>
        ))}
      </div>

      {/* persona 回应 */}
      {trace ? (
        <div style={{ borderTop: '1px solid rgba(68,64,60,0.5)', marginTop: 8, paddingTop: 16 }}>
          <p style={{ fontSize: 10, letterSpacing: '0.18em', margin: '0 0 6px', color: '#78716c' }}>{personaName}</p>
          <p style={{ fontSize: 12, lineHeight: 1.8, letterSpacing: '0.03em', margin: 0, color: '#a8a29e' }}>{trace}</p>
        </div>
      ) : null}

      {/* 底部：水印 + 二维码 */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 28, paddingTop: 16, borderTop: '1px solid rgba(68,64,60,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" crossOrigin="anonymous" style={{ height: 22, width: 'auto', display: 'block' }} />
          <span style={{ fontSize: 12, letterSpacing: '0.14em', color: '#78716c' }}>EndHere</span>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/qrcode.png" alt="扫码打开 EndHere" crossOrigin="anonymous" style={{ height: 64, width: 64, display: 'block' }} />
      </div>
    </div>
  );
}
