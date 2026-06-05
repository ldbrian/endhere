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

  return lang;
}