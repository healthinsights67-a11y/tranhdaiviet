import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Maximize, 
  Download,
  ExternalLink,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/src/lib/utils';

interface ImagePreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  allImages?: string[];
  currentIdx?: number;
  onNavigate?: (idx: number) => void;
}

export function ImagePreviewDialog({ 
  isOpen, 
  onClose, 
  imageUrl, 
  allImages = [], 
  currentIdx = 0,
  onNavigate 
}: ImagePreviewDialogProps) {
  const [scale, setScale] = React.useState(1);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const lastTouchDistance = React.useRef<number | null>(null);

  // Reset scale and position when image changes
  React.useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    lastTouchDistance.current = null;
  }, [imageUrl]);

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.5, 5));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.5, 0.5));
  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent) => {
    // Zoom directly with wheel
    const delta = -e.deltaY;
    setScale(prev => {
      const next = prev + (delta > 0 ? 0.2 : -0.2);
      return Math.min(Math.max(next, 0.5), 5);
    });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const distance = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      lastTouchDistance.current = distance;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDistance.current !== null) {
      const distance = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      
      const delta = distance - lastTouchDistance.current;
      if (Math.abs(delta) > 5) {
        setScale(prev => {
          const next = prev + (delta > 0 ? 0.05 : -0.05);
          return Math.min(Math.max(next, 0.5), 5);
        });
        lastTouchDistance.current = distance;
      }
    }
  };

  const handleTouchEnd = () => {
    lastTouchDistance.current = null;
  };

  if (!isOpen || !imageUrl) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black flex flex-col md:ml-64 transition-all duration-300"
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Vùng hiển thị ảnh chính */}
        <div className="relative flex-1 flex items-center justify-center overflow-hidden p-4">
          <motion.img
            drag={scale > 1}
            dragConstraints={{ left: -1000, right: 1000, top: -1000, bottom: 1000 }}
            dragElastic={0}
            animate={{ 
              scale,
              x: position.x,
              y: position.y
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            src={imageUrl}
            alt="Preview"
            className="max-h-full max-w-full object-contain pointer-events-none select-none shadow-2xl"
            style={{ transform: 'translateZ(0)' }}
            referrerPolicy="no-referrer"
            onDragStart={() => setIsDragging(true)}
            onDragEnd={() => setIsDragging(false)}
          />

          {/* Điều hướng (Navigation) */}
          {allImages.length > 1 && onNavigate && (
            <>
              {/* Nút bên trái */}
              <button 
                className="absolute left-6 top-1/2 -translate-y-1/2 z-[101] h-12 w-12 rounded-full bg-gray-900/60 hover:bg-gray-800 text-white flex items-center justify-center transition-all border border-white/10 backdrop-blur-sm shadow-lg active:scale-90"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate((currentIdx - 1 + allImages.length) % allImages.length);
                }}
                aria-label="Previous"
              >
                <ChevronLeft className="h-7 w-7" />
              </button>

              {/* Nút bên phải */}
              <button 
                className="absolute right-6 top-1/2 -translate-y-1/2 z-[101] h-12 w-12 rounded-full bg-gray-900/60 hover:bg-gray-800 text-white flex items-center justify-center transition-all border border-white/10 backdrop-blur-sm shadow-lg active:scale-90"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate((currentIdx + 1) % allImages.length);
                }}
                aria-label="Next"
              >
                <ChevronRight className="h-7 w-7" />
              </button>
            </>
          )}

          {/* Nút đóng */}
          <button 
            className="absolute top-4 right-4 z-[102] h-10 w-10 rounded-full bg-card text-card-foreground/10 hover:bg-card text-card-foreground/20 text-white flex items-center justify-center backdrop-blur-md border border-white/20"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Thanh điều khiển ở phía dưới */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[101]">
          <div className="bg-black/60 px-4 py-2 rounded-full text-white text-[10px] sm:text-xs border border-white/10 backdrop-blur-md">
            {currentIdx + 1} / {allImages.length} | KÉO ĐỂ DI CHUYỂN | CUỘN CHUỘT ĐỂ ZOOM
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
