import { useState, useEffect } from 'react';

export function useWindowSize() {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const fn = () => setWidth(window.innerWidth);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return {
    width,
    isMobile:  width < 768,
    isTablet:  width >= 768 && width < 1024,
    isDesktop: width >= 1024,
    isTV:      width >= 1440,
  };
}
