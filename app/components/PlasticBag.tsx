'use client'

import { useState } from 'react'

export default function PlasticBag() {
  const [isOpen, setIsOpen] = useState(false)
  const [isFlipped, setIsFlipped] = useState(false) // 记录塑料袋是否翻面

  // 核心视觉底噪
  const noiseTexture = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.12'/%3E%3C/svg%3E")`

  return (
    <>
      {/* 状态一：右上角收起。改为微缩背心袋轮廓，纵向排列避开中间 */}
      {!isOpen && (
        <div style={{ position: 'fixed', top: '20px', right: '16px', zIndex: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => { setIsOpen(true); setIsFlipped(false); }}
            style={{
              width: '32px', // 维持原宽度
              height: '48px', // 稍微拉长一点点比例
              backgroundColor: 'rgba(255, 255, 255, 0.06)', // 降低一点亮度，更像薄塑料
              backgroundImage: noiseTexture,
              backdropFilter: 'blur(6px)',
              // 核心绝杀：用 clip-path 裁出一个微缩版的背心袋轮廓 (U型大挖口)
              // 这次我们用一个更精简的 polygon 来模拟
              clipPath: 'polygon(0% 0%, 28% 0%, 35% 20%, 65% 20%, 72% 0%, 100% 0%, 100% 100%, 0% 100%)',
              cursor: 'pointer',
              // 把旋转角度调整为跟正面一致，都是 -1deg，看起来更统一
              transform: 'rotate(-1deg)', 
              transition: 'all 0.3s ease',
              border: 'none',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' // 给小袋子加一点投影，突出物理感
            }}
            aria-label="扯一个塑料袋"
          />
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', letterSpacing: '0.1em' }}>
            扯个袋子
          </span>
        </div>
      )}

      {/* 状态二：展开后的背心袋 */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)} 
          style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            backgroundColor: 'rgba(26, 22, 18, 0.7)', zIndex: 50,
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
                transition: 'transform 0.4s ease' // 给翻面一点心理预期
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
        </div>
      )}
    </>
  )
}