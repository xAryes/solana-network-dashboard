import { useState, useEffect, type RefObject } from 'react';

interface ScrollProgress {
  progress: number; // 0-1 progress through the element
  isInView: boolean;
  hasEntered: boolean;
  hasExited: boolean;
}

export function useScrollProgress(
  ref: RefObject<HTMLElement>,
  options: { offset?: number; once?: boolean } = {}
): ScrollProgress {
  const { offset = 0, once = false } = options;
  const [progress, setProgress] = useState(0);
  const [isInView, setIsInView] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [hasExited, setHasExited] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleScroll = () => {
      const rect = element.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      // Calculate how far through the element we've scrolled
      const elementTop = rect.top - windowHeight + offset;
      const elementHeight = rect.height + windowHeight - offset * 2;
      const scrolled = -elementTop;
      const rawProgress = scrolled / elementHeight;

      const clampedProgress = Math.max(0, Math.min(1, rawProgress));

      const inView = rect.top < windowHeight - offset && rect.bottom > offset;

      if (inView && !hasEntered) {
        setHasEntered(true);
      }

      if (!inView && hasEntered && !hasExited) {
        setHasExited(true);
      }

      if (once && hasExited) return;

      setProgress(clampedProgress);
      setIsInView(inView);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [ref, offset, once, hasEntered, hasExited]);

  return { progress, isInView, hasEntered, hasExited };
}

export function useScrollTrigger(
  ref: RefObject<HTMLElement>,
  threshold: number = 0.5
): boolean {
  const { progress } = useScrollProgress(ref);
  return progress >= threshold;
}
