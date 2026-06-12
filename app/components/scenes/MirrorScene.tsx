'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSpaceStore } from '../../store/useSpaceStore';
import { useShelterStore } from '../../store/useShelterStore';
import { useLanguage } from '../../hooks/useLanguage';

// 健壮的模糊时间格式化（解决 NaN 问题）
const getFuzzyTime = (timestamp: any) => {
  if (!timestamp) return '很久以前';
  const ts = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
  if (isNaN(ts)) return '很久以前';
  
  const diff = Date.now() - ts;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days <= 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 7) return `${days}天前`;
  if (days < 30) return `${Math.floor(days / 7)}周前`;
  return `${Math.floor(days / 30)}个月前`;
};

export default function MirrorScene() {
  const setScene = useSpaceStore((state) => state.setScene);
  const entries = useShelterStore((state) => state.entries);
  const addEntry = useShelterStore((state) => state.addEntry);
  const lang = useLanguage();

  const [pastCard, setPastCard] = useState<any>(null);
  const [reflectionText, setReflectionText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  // 🟢 核心算法：只抽取“唯一的一张”真实的过去倾诉
  useEffect(() => {
    // 极其严苛的数据清洗：必须是 receipt 倾诉，必须有实质内容，杜绝 virtual_item 乱入
    const validEntries = entries.filter(e => 
      e.status !== 'incinerated' && 
      (e.type === 'receipt' || !e.type) && 
      e.content && 
      e.content.trim().length > 0 &&
      !e.content.includes('_') // 粗暴屏蔽类似 broken_bulb 的机器码
    );

    if (validEntries.length === 0) return;

    // 随机抽取一张
    const randomIndex = Math.floor(Math.random() * validEntries.length);
    setPastCard(validEntries[randomIndex]);
  }, [entries]);

  // 提交回应
  const handleSubmitReflection = () => {
    if (!reflectionText.trim() || isSubmitting) return;
    setIsSubmitting(true);

    const timeRef = getFuzzyTime(pastCard.timestamp);
    const finalContent = `看到 ${timeRef} 的自己。\n${reflectionText.trim()}`;

    addEntry({
      id: crypto.randomUUID(),
      receiptId: `REFLECT-${Date.now().toString().slice(-6)}`,
      timestamp: Date.now(),
      content: finalContent,
      persona: 'User',
      type: 'life_fragment',
      status: 'normal'
    });

    setShowArchived(true);
    
    setTimeout(() => {
      setScene('nostalgia');
    }, 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 1, ease: 'easeInOut' }}
      className="relative w-full h-[100dvh] bg-[#030303] overflow-hidden select-none font-mono flex flex-col items-center"
    >
      {/* 全局绝对定位的返回按钮，彻底解决被挤压排版的问题 */}
      <button
        onClick={() => setScene('entrance')}
        className="absolute top-10 left-8 tracking-[0.2em] text-[11px] text-zinc-600 hover:text-zinc-300 transition-colors duration-500 outline-none z-50 cursor-pointer"
      >
        {lang.HOME.back}
      </button>

      <div className="absolute top-10 left-1/2 -translate-x-1/2 z-40">
        <span className="text-zinc-500 text-[14px] tracking-[0.4em] font-light uppercase">
          照照镜子
        </span>
      </div>

      <div className="w-full h-full flex flex-col items-center justify-center px-6 overflow-y-auto [&::-webkit-scrollbar]:hidden pt-24 pb-16">
        
        {!pastCard ? (
          <p className="text-zinc-700 text-[11px] tracking-widest mt-10">
            [ 镜面蒙着一层灰，痕迹还不够拼凑出你的样子。 ]
          </p>
        ) : (
          <div className="w-full max-w-[400px] flex flex-col items-center">
            
            {/* 🟢 仪式感卡片：居中、立碑感、深邃阴影 */}
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 1.5, ease: 'easeOut' }}
              className="w-full max-w-[320px] min-h-[360px] border border-zinc-800/80 bg-[#060606] shadow-[0_0_50px_rgba(0,0,0,0.6)] flex flex-col items-center justify-center p-8 relative"
            >
              <span className="absolute top-8 text-[10px] text-zinc-600 tracking-[0.2em]">
                {getFuzzyTime(pastCard.timestamp)}
              </span>
              
              <div className="flex-1 flex items-center justify-center w-full my-12">
                <p className="text-[14px] text-zinc-300 tracking-[0.2em] leading-[2.5] text-center font-light whitespace-pre-wrap">
                  {pastCard.content}
                </p>
              </div>
            </motion.div>

            {/* 交互区：无边框隐形输入 */}
            <AnimatePresence mode="wait">
              {showArchived ? (
                <motion.div
                  key="archived"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="w-full flex justify-center mt-20"
                >
                  <span className="text-zinc-500 text-[12px] tracking-[0.3em]">
                    [ 痕迹已更新 ]
                  </span>
                </motion.div>
              ) : (
                <motion.div
                  key="input"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: 2, duration: 1.5 }}
                  className="w-full flex flex-col items-center gap-4 mt-16"
                >
                  <span className="text-zinc-600 text-[11px] tracking-[0.2em] text-center">
                    现在的你，会对这句话说什么？
                  </span>
                  
                  {/* 🟢 彻底移除边框，利用光标和 Placeholder 引导输入 */}
                  <textarea
                    value={reflectionText}
                    onChange={(e) => setReflectionText(e.target.value)}
                    placeholder="我想说..."
                    className="w-full max-w-[320px] h-20 bg-transparent border-none text-zinc-300 text-[13px] tracking-widest outline-none resize-none text-center focus:ring-0 placeholder:text-zinc-800"
                  />
                  
                  <button
                    onClick={handleSubmitReflection}
                    disabled={!reflectionText.trim() || isSubmitting}
                    className="text-zinc-600 hover:text-zinc-300 disabled:opacity-0 text-[11px] tracking-[0.3em] outline-none transition-all duration-500"
                  >
                    [ 留下 ]
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        )}
      </div>
    </motion.div>
  );
}