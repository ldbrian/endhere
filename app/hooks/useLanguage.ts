import { useState, useEffect } from 'react';
import { EN } from '../lib/lang';

// 1. 补全 CN 定义，确保结构与 EN 一致
const CN = {
  HOME: {
    welcome: "欢迎光临。",
    prompt: "今天过得怎么样？",
    saySomething: "我有很多话想说",
    tired: "我只是有点累",
    nostalgia: "我想起了一些以前的事",
    back: "[ 退回门厅 ]"
  },
  SPEAKING: {
    placeholder: "在这里写下吧...",
    to: "想留给:",
    submit: "[ 压入收银台 ]",
    typing: "正在听...",
    print: "[ 打印小票 ]",
    leave: "[ 留在抽屉并离开 ]"
  },
  ENV: {
    bar_hint: "吧台上多了一样东西：",
    default_summary: "收音机里发出微弱的沙沙声。"
  },
  RESTING: {
    intro: "[ 你在角落的木凳上坐了下来。 ]",
    mint: "[ 吧台边缘有一颗薄荷糖。 ]",
    orange: "[ 角落里放着半只干瘪的橘子。 ]",
    consumeMint: "[ 你剥开吃掉了它。喉咙里泛起一丝微弱的凉意。 ]",
    consumeOrange: "[ 橘子有点干瘪，但汁水带着一丝微酸的暖意。 ]",
    noises: [
      '灰尘在从窗外透进来的光柱里翻滚。', '外面偶尔有车经过的声音。', '木凳有一点轻微的嘎吱声。', '...外面的世界还在继续。',
      '外面在下雨。木凳有点潮湿。', '夕阳的光斑在吧台上缓慢移动。', '能听到屋檐滴水的空灵声。', '...天快黑了，该回去了。',
      '除了冰箱压缩机的低鸣，这里什么声音都没有。', '能听到自己微弱的呼吸声。', '窗外的夜色像深海一样沉。', '...夜深了。去睡吧。'
    ]
  }
};

export function useLanguage() {
  // 2. 将初始值明确设为 CN，防止 undefined
  const [lang, setLang] = useState(CN);

  useEffect(() => {
    const isEnglish = window.location.hostname.includes('en.') || 
                      window.location.hostname.includes('nightshift');
    setLang(isEnglish ? EN : CN);
  }, []);

  return lang as typeof CN;
}