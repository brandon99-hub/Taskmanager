import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useScreenSize } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface MobileTouchCardProps {
  children: React.ReactNode;
  className?: string;
  onTap?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
}

export default function MobileTouchCard({ 
  children, 
  className, 
  onTap, 
  onLongPress, 
  disabled = false 
}: MobileTouchCardProps) {
  const { isMobile } = useScreenSize();
  const [isPressed, setIsPressed] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);

  const handleTouchStart = () => {
    if (disabled) return;
    
    setIsPressed(true);
    
    if (onLongPress && isMobile) {
      const timer = setTimeout(() => {
        onLongPress();
        setIsPressed(false);
      }, 500); // 500ms for long press
      setLongPressTimer(timer);
    }
  };

  const handleTouchEnd = () => {
    if (disabled) return;
    
    setIsPressed(false);
    
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleClick = () => {
    if (disabled) return;
    
    // Only trigger tap if it wasn't a long press
    if (!longPressTimer && onTap) {
      onTap();
    }
  };

  return (
    <Card
      className={cn(
        "transition-all duration-150 cursor-pointer",
        "hover:shadow-md active:shadow-sm",
        isMobile && "active:scale-[0.98]",
        isPressed && isMobile && "scale-[0.98] shadow-sm",
        disabled && "opacity-50 cursor-not-allowed pointer-events-none",
        className
      )}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={!isMobile ? handleTouchStart : undefined}
      onMouseUp={!isMobile ? handleTouchEnd : undefined}
      onClick={handleClick}
    >
      <CardContent className={cn(
        "transition-all duration-150",
        isMobile ? "p-3" : "p-4"
      )}>
        {children}
      </CardContent>
    </Card>
  );
}
