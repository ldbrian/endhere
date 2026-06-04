import { useState, useEffect } from 'react';

export function useTimeAccumulator() {
  const [accumulated, setAccumulated] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    // 每秒滴答，依靠 document.hidden 阻断后台幽灵计时
    const tick = () => {
      if (!document.hidden) {
        setAccumulated((prev) => prev + 1);
      }
    };

    timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  return accumulated;
}