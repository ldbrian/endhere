'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function PlasticBag() {
  const [isOpen, setIsOpen] = useState(false)
  const [isFlipped, setIsFlipped] = useState(false) // 记录塑料袋是否翻面
  const [mounted, setMounted] = useState(false)

  // 确保 Portal 仅在客户端渲染，避免 Next.js 的水合报错
  useEffect(() => {
    setMounted(true)
  }, [])

  // 核心视觉底噪
  const noiseTexture = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.12'/%3E%3C/svg%3E")`

  return (
    <>
      {/* ======== 状态一：右上角收起 ======== */}
      {/* 【修复】：移除导致定位漂移的 fixed，彻底融入父组件的 flex 布局 */}
      {!isOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => { setIsOpen(true); setIsFlipped(false); }}
            style={{
              width: '28px', 
              height: '44px',
              backgroundColor: 'rgba(255, 255, 255, 0.06)', 
              backgroundImage: noiseTexture,
              backdropFilter: 'blur(6px)',
              clipPath: 'polygon(0% 0%, 28% 0%, 35% 20%, 65% 20%, 72% 0%, 100% 0%, 100% 100%, 0% 100%)',
              cursor: 'pointer',
              transform: 'rotate(-1deg)', 
              transition: 'all 0.3s ease',
              border: 'none',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' 
            }}
            aria-label="扯一个塑料袋"
          />
        </div>
      )}

      {/* ======== 状态二：展开后的背心袋 ======== */}
      {/* 【修复】：使用 createPortal 把弹窗传送到顶层 body，摆脱父级 transform 旋转的毁灭性影响 */}
      {mounted && isOpen && createPortal(
        <div 
          onClick={() => setIsOpen(false)} 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, // 使用 inset 代替 100vw，防止出现横向滚动条
            backgroundColor: 'rgba(26, 22, 18, 0.7)', zIndex: 9999, // 置于绝对顶层
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            padding: '20px', cursor: 'pointer'
          }}
        >
          <div style={{ filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.5))', width: '100%', maxWidth: '320px' }}>
            <div 
              onClick={(e) => e.stopPropagation()} 
              style={{
                width: '100%',
                height: '420px',
                background: 'rgba(255, 255, 255, 0.82)',
                backgroundImage: noiseTexture,
                backdropFilter: 'blur(10px)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                padding: '100px 20px 40px 20px',
                clipPath: 'polygon(0% 0%, 25% 0%, 35% 22%, 65% 22%, 75% 0%, 100% 0%, 100% 100%, 0% 100%)',
                transform: 'rotate(-1deg)',
                transition: 'transform 0.4s ease'
              }}
            >
              
              {!isFlipped ? (
                /* ======== 正面：绝对纯粹的视觉空间 ======== */
                <>
                  <div style={{ textAlign: 'center', marginTop: '30px', opacity: 0.85 }}>
                    <img 
                      src="/logo.png" 
                      alt="End Here Logo" 
                      style={{ 
                        width: '64px', height: '64px', marginBottom: '8px',
                        transform: 'rotate(2deg)',
                        mixBlendMode: 'multiply',
                        filter: 'grayscale(100%) contrast(1.2) opacity(0.8)'
                      }} 
                    />
                    <div style={{ fontSize: '18px', letterSpacing: '0.2em', color: '#333'}}>
                      END HERE
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%', position: 'absolute', bottom: '60px', left: 0, padding: '0 20px' }}>
                    <div style={{ opacity: 0.7, paddingBottom: '5px' }}>
                      <p style={{ color: '#222', fontSize: '13px', fontFamily: 'monospace', margin: '0 0 4px 0' }}>127.0.0.1</p>
                      <p style={{ color: '#222', fontSize: '12px', margin: 0 }}>断网巷 404 号</p>
                    </div>

                    <div style={{ transform: 'rotate(-15deg)', marginRight: '10px', position: 'relative' }}>
                      <h2 style={{ color: 'rgba(190, 40, 40, 0.9)', fontSize: '18px', fontWeight: 'bold', margin: 0, textShadow: '0.5px 0.5px 1px rgba(190,40,40,0.3)' }}>
                        坏情绪<br/>禁止外带
                      </h2>
                      <div style={{ width: '120%', height: '2px', background: 'rgba(190, 40, 40, 0.5)', position: 'absolute', bottom: '-4px', left: '-10px', transform: 'rotate(2deg)' }} />
                      <div style={{ width: '100%', height: '1px', background: 'rgba(190, 40, 40, 0.4)', position: 'absolute', bottom: '-8px', left: '-2px', transform: 'rotate(-3deg)' }} />
                    </div>
                  </div>
                </>
              ) : (
                /* ======== 背面：PWA 安装说明 ======== */
                <div style={{ marginTop: '20px', padding: '0 10px', opacity: 0.85 }}>
                  <h3 style={{ color: '#222', fontSize: '15px', letterSpacing: '0.1em', marginBottom: '16px', borderBottom: '1px solid rgba(0,0,0,0.2)', paddingBottom: '8px' }}>
                    把破店揣进兜里：
                  </h3>
                  <ol style={{ color: '#333', fontSize: '13px', lineHeight: '2.2', paddingLeft: '20px', margin: 0 }}>
                    <li>点击手机浏览器底部的 <strong>[ 分享 / 菜单 ]</strong></li>
                    <li>往下滑，找到 <strong>[ 添加到主屏幕 ]</strong></li>
                    <li>确认添加</li>
                  </ol>
                  <p style={{ color: 'rgba(190, 40, 40, 0.8)', fontSize: '12px', marginTop: '30px', fontStyle: 'italic', letterSpacing: '0.05em' }}>
                    * 免下载，不占内存。<br/>
                    * 下次遇上烂事，顺着地址回来。
                  </p>
                </div>
              )}

              {/* ======== 底部物理翻面按钮 ======== */}
              <button 
                onClick={(e) => { e.stopPropagation(); setIsFlipped(!isFlipped); }}
                style={{ 
                  position: 'absolute', bottom: '15px', width: '100%', left: 0, 
                  textAlign: 'center', background: 'transparent', border: 'none', 
                  color: 'rgba(0,0,0,0.5)', fontSize: '11px', cursor: 'pointer',
                  textDecoration: 'underline', textUnderlineOffset: '4px'
                }}
              >
                {isFlipped ? '翻回正面' : '翻到背面看怎么带走'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}