import { useState, useEffect, useRef } from 'react';

export function useStreaming(
  text: string,
  speed: number = 8,
): { displayText: string; isComplete: boolean } {
  const [charIndex, setCharIndex] = useState(0);
  const prevTextRef = useRef(text);

  useEffect(() => {
    if (text !== prevTextRef.current) {
      setCharIndex(0);
      prevTextRef.current = text;
    }
  }, [text]);

  useEffect(() => {
    if (charIndex >= text.length) return;

    const interval = setInterval(() => {
      setCharIndex((prev) => {
        const step = Math.max(1, Math.floor(text.length / 200));
        const next = Math.min(prev + step, text.length);
        return next;
      });
    }, speed);

    return () => clearInterval(interval);
    // charIndex intentionally excluded — the interval's updater function
    // handles progression. Including it would clear/recreate on every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speed]);

  return {
    displayText: text.slice(0, charIndex),
    isComplete: charIndex >= text.length,
  };
}
