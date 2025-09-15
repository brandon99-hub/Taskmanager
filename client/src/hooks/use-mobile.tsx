import * as React from "react"

const MOBILE_BREAKPOINT = 768
const TABLET_BREAKPOINT = 1024

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}

export function useIsTablet() {
  const [isTablet, setIsTablet] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${MOBILE_BREAKPOINT}px) and (max-width: ${TABLET_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsTablet(window.innerWidth >= MOBILE_BREAKPOINT && window.innerWidth < TABLET_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsTablet(window.innerWidth >= MOBILE_BREAKPOINT && window.innerWidth < TABLET_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isTablet
}

export function useScreenSize() {
  const isMobile = useIsMobile()
  const isTablet = useIsTablet()
  const isDesktop = !isMobile && !isTablet

  return {
    isMobile,
    isTablet,
    isDesktop,
    breakpoint: isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop'
  }
}

// Enhanced mobile responsiveness hook
export function useResponsiveDesign() {
  const { isMobile, isTablet } = useScreenSize();
  
  return {
    isMobile,
    isTablet,
    isDesktop: !isMobile && !isTablet,
    // Mobile-specific configurations
    cardColumns: isMobile ? 1 : isTablet ? 2 : 3,
    buttonSize: isMobile ? 'lg' : 'default',
    spacing: isMobile ? 'compact' : 'normal',
    // Touch-friendly configurations
    touchTargetSize: isMobile ? 44 : 32,
    swipeEnabled: isMobile,
    hapticFeedback: isMobile,
    // Layout configurations
    gridCols: isMobile ? 'grid-cols-1' : isTablet ? 'grid-cols-2' : 'grid-cols-3',
    padding: isMobile ? 'p-4' : isTablet ? 'p-6' : 'p-8',
    textSize: isMobile ? 'text-sm' : 'text-base',
    // Mobile-specific UI patterns
    showMobileMenu: isMobile,
    useBottomSheet: isMobile,
    enableSwipeGestures: isMobile
  };
}

// Touch interaction hook
export function useTouchInteractions() {
  const [touchStart, setTouchStart] = React.useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = React.useState<{ x: number; y: number } | null>(null);
  
  const minSwipeDistance = 50;
  
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
  };
  
  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
  };
  
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return null;
    
    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const isLeftSwipe = distanceX > minSwipeDistance;
    const isRightSwipe = distanceX < -minSwipeDistance;
    const isUpSwipe = distanceY > minSwipeDistance;
    const isDownSwipe = distanceY < -minSwipeDistance;
    
    return { isLeftSwipe, isRightSwipe, isUpSwipe, isDownSwipe };
  };
  
  return { onTouchStart, onTouchMove, onTouchEnd };
}
