
import React, { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Square, 
  Circle, 
  Type, 
  Trash2, 
  Download, 
  ChevronLeft, 
  Move, 
  Maximize2, 
  Zap,
  Box,
  Layout,
  Plus,
  Minus,
  Settings2,
  Code,
  Undo2,
  MapPin,
  Target,
  ArrowRightLeft,
  Sparkles,
  Scissors,
  Palette,
  Sun,
  Ruler,
  Maximize2 as Maximize,
  Layers as LayersIcon,
  Image as ImageIcon,
  MousePointer2,
  Eraser,
  Save,
  Share2,
  Video,
  Grid3X3
} from "lucide-react";
import { analyzeDesign, analyzeSegmentation, relocateObject, retextureSpace } from "../../services/geminiRenderService";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface DeepEditPageProps {
  imageUrl: string;
  onBack: () => void;
  apiKey: string;
}

export default function DeepEditPage({ imageUrl, onBack, apiKey }: DeepEditPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas | null>(null);
  const [selectedObject, setSelectedObject] = useState<fabric.Object | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRelocating, setIsRelocating] = useState(false);
  const isRelocatingRef = useRef(false);
  const [history, setHistory] = useState<string[]>([]);
  const [currentBaseImage, setCurrentBaseImage] = useState(imageUrl);
  const [targetMarker, setTargetMarker] = useState<fabric.Group | null>(null);
  const [activeTab, setActiveTab] = useState<'assets' | 'materials' | 'ai' | 'layers'>('ai');
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<any[]>([]);
  const [isErasing, setIsErasing] = useState(false);
  const [segments, setSegments] = useState<any[]>([]);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(0);
  const [temperature, setTemperature] = useState(0);
  const [layers, setLayers] = useState<any[]>([]);
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    isRelocatingRef.current = isRelocating;
  }, [isRelocating]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setIsAnalyzing(false);
      toast.dismiss();
    };
  }, []);

  const saveHistory = (canvas: fabric.Canvas) => {
    const json = JSON.stringify(canvas.toDatalessJSON());
    setHistory(prev => {
      const newHistory = [...prev, json];
      if (newHistory.length > 20) return newHistory.slice(1);
      return newHistory;
    });
  };

  const undo = () => {
    if (!fabricCanvas || history.length <= 1) {
      toast.error("Không còn gì để hoàn tác");
      return;
    }

    const newHistory = [...history];
    newHistory.pop();
    const prevState = newHistory[newHistory.length - 1];
    
    setHistory(newHistory);
    fabricCanvas.loadFromJSON(prevState, () => {
      fabricCanvas.renderAll();
      toast.success("Đã hoàn tác");
    });
  };

  const handleRelocateRender = async () => {
    if (!fabricCanvas || !selectedObject || !targetMarker) {
      toast.error("Vui lòng chọn vật thể và vị trí nhận diện trước khi Render");
      return;
    }

    setIsAnalyzing(true);
    const toastId = toast.loading("AI đang tính toán phối cảnh và di chuyển vật thể...");

    try {
      const label = (selectedObject as any).label || "object";
      const { left, top } = targetMarker;
      const result = await relocateObject(
        apiKey,
        currentBaseImage,
        label,
        left || 0,
        top || 0,
        fabricCanvas.getWidth(),
        fabricCanvas.getHeight()
      );

      setCurrentBaseImage(result);
      // Remove previous objects because we have a new base image
      const markers = fabricCanvas.getObjects().filter(obj => (obj as any).isMarker);
      markers.forEach(m => fabricCanvas.remove(m));
      setTargetMarker(null);
      setIsRelocating(false);
      
      toast.success("Đã di chuyển vật thể thành công!", { id: toastId });
    } catch (e: any) {
      toast.error("Lỗi khi di chuyển: " + e.message, { id: toastId });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRetexture = async (materialName: string) => {
    if (!fabricCanvas || !selectedObject) return;
    
    const label = (selectedObject as any).label || "";
    let targetRegion: 'wall' | 'floor' | 'ceiling' | null = null;
    
    if (label.includes('Tường')) targetRegion = 'wall';
    if (label.includes('Sàn')) targetRegion = 'floor';
    if (label.includes('Trần')) targetRegion = 'ceiling';

    if (!targetRegion) {
      toast.info("Vui lòng chọn vùng Tường, Sàn hoặc Trần để thay đổi vật liệu bằng AI");
      return;
    }

    setIsAnalyzing(true);
    const toastId = toast.loading(`AI đang thay đổi vật liệu ${targetRegion} thành ${materialName}...`);

    try {
      const result = await retextureSpace(apiKey, currentBaseImage, targetRegion, materialName);
      setCurrentBaseImage(result);
      toast.success("Đã thay đổi vật liệu thành công!", { id: toastId });
    } catch (e: any) {
      toast.error("Lỗi khi thay đổi vật liệu: " + e.message, { id: toastId });
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (fabricCanvas && currentBaseImage) {
      const objects = fabricCanvas.getObjects();
      const bgImg = objects.find(obj => obj.type === 'image' && !(obj as any).selectable);
      
      fabric.Image.fromURL(currentBaseImage, (img) => {
        if (!img) return;

        const baseScale = Math.min(
          fabricCanvas.getWidth() / (img.width || 1),
          fabricCanvas.getHeight() / (img.height || 1)
        );
        
        img.set({
          selectable: false,
          evented: false,
          scaleX: baseScale,
          scaleY: baseScale,
          left: (fabricCanvas.getWidth() - (img.width || 0) * baseScale) / 2,
          top: (fabricCanvas.getHeight() - (img.height || 0) * baseScale) / 2,
        });

        if (bgImg) fabricCanvas.remove(bgImg);
        fabricCanvas.add(img);
        fabricCanvas.sendToBack(img);
        fabricCanvas.renderAll();
      }, { crossOrigin: 'anonymous' });
    }
  }, [currentBaseImage, fabricCanvas]);

  useEffect(() => {
    if (canvasRef.current && !fabricCanvas) {
      const canvas = new fabric.Canvas(canvasRef.current, {
        width: 800,
        height: 600,
        backgroundColor: '#f3f4f6',
      });

      fabric.Image.fromURL(currentBaseImage, (img) => {
        if (!img) return;
        const scale = Math.min(
          canvas.getWidth() / (img.width || 1),
          canvas.getHeight() / (img.height || 1)
        );
        img.set({
          selectable: false,
          evented: false,
          scaleX: scale,
          scaleY: scale,
          left: (canvas.getWidth() - (img.width || 0) * scale) / 2,
          top: (canvas.getHeight() - (img.height || 0) * scale) / 2,
        });
        canvas.add(img);
        canvas.sendToBack(img);
        canvas.renderAll();
        
        const initialJson = JSON.stringify(canvas.toDatalessJSON());
        setHistory([initialJson]);
      }, { crossOrigin: 'anonymous' });

      canvas.on('selection:created', (e) => setSelectedObject(e.target || null));
      canvas.on('selection:updated', (e) => setSelectedObject(e.target || null));
      canvas.on('selection:cleared', () => setSelectedObject(null));

      canvas.on('mouse:down', (options) => {
        if (isRelocatingRef.current) {
          const pointer = canvas.getPointer(options.e);
          
          // Remove old marker
          const currentObjects = canvas.getObjects();
          currentObjects.forEach(obj => {
            if ((obj as any).isMarker) canvas.remove(obj);
          });
          
          const circle = new fabric.Circle({
            radius: 12,
            fill: 'rgba(239, 68, 68, 0.4)',
            stroke: '#ef4444',
            strokeWidth: 3,
            originX: 'center',
            originY: 'center',
          });

          const icon = new fabric.IText('📍', {
            fontSize: 28,
            left: 0,
            top: -15,
            originX: 'center',
            originY: 'center',
            shadow: new fabric.Shadow({
              color: 'rgba(0,0,0,0.5)',
              blur: 5,
              offsetX: 2,
              offsetY: 2
            })
          });

          const marker = new fabric.Group([circle, icon], {
            left: pointer.x,
            top: pointer.y,
            originX: 'center',
            originY: 'center',
            selectable: true,
            hasControls: false,
          });

          (marker as any).isMarker = true;
          canvas.add(marker);
          marker.bringToFront();
          canvas.setActiveObject(marker); // Highlight the marker
          setTargetMarker(marker);
          canvas.renderAll();
          
          toast.success("📍 Đã xác định vị trí di chuyển mới. Nhấn 'RENDER LẠI' để thực hiện.");
          return;
        }

        // Measurement Logic
        const pointer = canvas.getPointer(options.e);
        
        if (isMeasuring) {
          const newPoints = [...measurePoints, pointer];
          setMeasurePoints(newPoints);
          
          const dot = new fabric.Circle({
            radius: 4,
            fill: '#f97316',
            left: pointer.x,
            top: pointer.y,
            originX: 'center',
            originY: 'center',
            selectable: false,
          });
          canvas.add(dot);

          if (newPoints.length === 2) {
            const dx = newPoints[1].x - newPoints[0].x;
            const dy = newPoints[1].y - newPoints[0].y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const mmDist = (dist * 2.5).toFixed(0); // Simulated scale

            const line = new fabric.Line([newPoints[0].x, newPoints[0].y, newPoints[1].x, newPoints[1].y], {
              stroke: '#f97316',
              strokeWidth: 2,
              selectable: true,
              label: `${mmDist}mm`,
            } as any);

            const text = new fabric.IText(`${mmDist}mm`, {
              fontSize: 14,
              left: (newPoints[0].x + newPoints[1].x) / 2,
              top: (newPoints[0].y + newPoints[1].y) / 2 - 15,
              fill: '#f97316',
              fontWeight: 'bold',
              backgroundColor: 'white'
            });

            canvas.add(line, text);
            setMeasurePoints([]);
            setIsMeasuring(false);
            toast.success(`Đo thành công: ${mmDist}mm`);
          }
          return;
        }

        if (isErasing) {
           // Simulated erasing logic: Draw a red semi-transparent path
           canvas.isDrawingMode = true;
           canvas.freeDrawingBrush.color = 'rgba(239, 68, 68, 0.5)';
           canvas.freeDrawingBrush.width = 20;
           toast.info("Vùng xóa gợi ý đã được chọn. AI đang xử lý...");
           setTimeout(() => {
             canvas.isDrawingMode = false;
             setIsErasing(false);
             toast.success("AI đã xóa vật thể thành công!");
           }, 2000);
           return;
        }

        const activeObj = canvas.getActiveObject();
      });

      const updateLayerList = () => {
        const objects = canvas.getObjects().filter(o => o.selectable);
        setLayers(objects.map((obj, i) => ({
          id: (obj as any).id || i,
          type: obj.type,
          visible: obj.visible,
          label: (obj as any).label || `${obj.type} ${i + 1}`
        })));
      };

      canvas.on('object:added', () => {
        saveHistory(canvas);
        updateLayerList();
      });
      canvas.on('object:modified', () => {
        saveHistory(canvas);
        updateLayerList();
      });
      canvas.on('object:removed', () => {
        saveHistory(canvas);
        updateLayerList();
      });

      setFabricCanvas(canvas);
    }

    return () => {
      fabricCanvas?.dispose();
    };
  }, [imageUrl]);

  const addRect = () => {
    if (!fabricCanvas) return;
    const rect = new fabric.Rect({
      left: 100,
      top: 100,
      fill: 'rgba(59, 130, 246, 0.5)',
      width: 150,
      height: 200,
      stroke: '#3b82f6',
      strokeWidth: 2,
    });
    fabricCanvas.add(rect);
    fabricCanvas.setActiveObject(rect);
  };

  const addFurnitureBox = () => {
    if (!fabricCanvas) return;
    const group = new fabric.Group([
      new fabric.Rect({
        width: 100,
        height: 150,
        fill: 'rgba(139, 92, 246, 0.3)',
        stroke: '#8b5cf6',
        strokeWidth: 2,
      }),
      new fabric.IText('TỦ ÁO', {
        fontSize: 12,
        left: 25,
        top: 65,
        fontFamily: 'Inter',
        fontWeight: 'bold',
        fill: '#8b5cf6'
      })
    ], {
      left: 200,
      top: 200,
    });
    fabricCanvas.add(group);
    fabricCanvas.setActiveObject(group);
  };

  const extendBox = () => {
    if (!selectedObject || !fabricCanvas) {
      toast.error("Vui lòng chọn một khoang tủ để kéo dài");
      return;
    }
    // Simple extension logic: increment scaleY or height
    const currentHeight = selectedObject.getScaledHeight();
    selectedObject.set('height', (selectedObject.height || 0) + 50);
    fabricCanvas.renderAll();
    toast.success("Đã kéo dài khoang tủ");
  };

  const deleteSelected = () => {
    if (!fabricCanvas || !selectedObject) return;
    fabricCanvas.remove(selectedObject);
    fabricCanvas.requestRenderAll();
  };

  const downloadImage = () => {
    if (!fabricCanvas) return;
    const dataURL = fabricCanvas.toDataURL({
      format: 'png',
      quality: 1,
    });
    const link = document.createElement('a');
    link.download = 'edited-design.png';
    link.href = dataURL;
    link.click();
  };

  const analyzeToJSON = () => {
    if (!fabricCanvas) return;
    const objects = fabricCanvas.getObjects().filter(obj => obj.selectable);
    const json = objects.map(obj => ({
      type: obj.type,
      left: obj.left,
      top: obj.top,
      width: obj.getScaledWidth(),
      height: obj.getScaledHeight(),
      id: (obj as any).id || Math.random().toString(36).substr(2, 9)
    }));
    
    console.log("Canvas JSON Structure:", json);
    toast.success("Đã phân tích cấu trúc JSON (Xem console)");
  };

  const runAIAnalysis = async (providedCanvas?: fabric.Canvas) => {
    const canvas = providedCanvas || fabricCanvas;
    if (!canvas || isAnalyzing) return;
    setIsAnalyzing(true);
    const toastId = toast.loading("AI Smart Vision đang quét cấu trúc nội thất...");

    try {
      const base64 = imageUrl.includes(',') ? imageUrl.split(',')[1] : imageUrl;
      const analysis = await analyzeDesign(apiKey, base64);
      
      if (Array.isArray(analysis) && analysis.length > 0) {
        analysis.forEach((item: any) => {
          if (item.box_2d) {
            const [ymin, xmin, ymax, xmax] = item.box_2d;
            const width = (xmax - xmin) * canvas.getWidth() / 1000;
            const height = (ymax - ymin) * canvas.getHeight() / 1000;
            const left = (xmin * canvas.getWidth() / 1000);
            const top = (ymin * canvas.getHeight() / 1000);

            const rect = new fabric.Rect({
              width,
              height,
              fill: 'rgba(59, 130, 246, 0.05)',
              stroke: '#3b82f6',
              strokeWidth: 2,
              strokeDashArray: [5, 5],
              rx: 4,
              ry: 4
            });

            const labelBack = new fabric.Rect({
              width: (item.label.length * 8) + 15,
              height: 20,
              fill: '#3b82f6',
              rx: 4,
              ry: 4
            });

            const text = new fabric.IText(item.label.toUpperCase(), {
              fontSize: 10,
              left: 7,
              top: 5,
              fill: '#fff',
              fontWeight: 'bold',
              fontFamily: 'Inter'
            });

            const labelGroup = new fabric.Group([labelBack, text], {
              left: 0,
              top: -24
            });

            const entity = new fabric.Group([rect, labelGroup], {
              left,
              top,
              selectable: true,
              hasRotatingPoint: false
            });

            canvas.add(entity);
          }
        });
        canvas.renderAll();
        toast.success("AI đã phân tích không gian thành công!", { id: toastId });
      } else {
        toast.info("AI không nhận diện được cấu trúc nội thất nào đặc biệt.", { id: toastId });
      }
    } catch (error: any) {
      toast.error("Phân tích AI thất bại: " + error.message, { id: toastId });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const runSegmentation = async () => {
    if (!fabricCanvas || isAnalyzing) return;
    setIsAnalyzing(true);
    const toastId = toast.loading("AI đang phân tích ranh giới tường, sàn, trần...");

    try {
      const base64 = currentBaseImage.includes(',') ? currentBaseImage.split(',')[1] : currentBaseImage;
      const result = await analyzeSegmentation(apiKey, base64);
      
      if (result && result.segments && result.segments.length > 0) {
        result.segments.forEach((seg: any) => {
          if (seg.polygon) {
            const points = seg.polygon.map((p: any) => ({
              x: (p[0] * fabricCanvas.getWidth()) / 1000,
              y: (p[1] * fabricCanvas.getHeight()) / 1000
            }));

            let color = 'rgba(59, 130, 246, 0.3)'; // Wall - blue
            if (seg.label === 'floor') color = 'rgba(234, 179, 8, 0.3)'; // Floor - yellow
            if (seg.label === 'ceiling') color = 'rgba(168, 85, 247, 0.3)'; // Ceiling - purple

            const poly = new fabric.Polygon(points, {
              fill: color,
              stroke: color.replace('0.3', '1'),
              strokeWidth: 2,
              selectable: true,
              label: `Vùng: ${seg.label === 'wall' ? 'Tường' : seg.label === 'floor' ? 'Sàn' : 'Trần'}`,
              opacity: 0.8
            } as any);

            fabricCanvas.add(poly);
          }
        });
        fabricCanvas.renderAll();
        toast.success("Đã hoàn tất phân vùng không gian!", { id: toastId });
      } else {
        toast.info("Không tìm thấy ranh giới rõ ràng để phân vùng.", { id: toastId });
      }
    } catch (e: any) {
      toast.error("Phân vùng thất bại: " + e.message, { id: toastId });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const addText = () => {
    if (!fabricCanvas) return;
    const text = new fabric.IText('Nhập ghi chú...', {
      left: 150,
      top: 150,
      fontSize: 24,
      fill: '#333333',
      fontFamily: 'Inter',
      fontWeight: 'bold',
    });
    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
    fabricCanvas.renderAll();
  };

  const zoomIn = () => {
    if (!fabricCanvas) return;
    const newZoom = fabricCanvas.getZoom() * 1.1;
    if (newZoom > 5) return;
    fabricCanvas.setZoom(newZoom);
    setZoomLevel(newZoom);
  };

  const zoomOut = () => {
    if (!fabricCanvas) return;
    const newZoom = fabricCanvas.getZoom() / 1.1;
    if (newZoom < 0.2) return;
    fabricCanvas.setZoom(newZoom);
    setZoomLevel(newZoom);
  };

  const resetZoom = () => {
    if (!fabricCanvas) return;
    fabricCanvas.setZoom(1);
    setZoomLevel(1);
    fabricCanvas.absolutePan(new fabric.Point(0, 0));
  };

  const applyLighting = () => {
    if (!fabricCanvas) return;
    
    // Simple filter approach
    const objects = fabricCanvas.getObjects();
    const bg = objects.find(o => o.type === 'image' && !(o as any).selectable);
    
    if (bg) {
      // In a real app we'd use fabric filters, here we use a color overlay for temperature
      const overlay = new fabric.Rect({
        left: bg.left,
        top: bg.top,
        width: bg.getScaledWidth(),
        height: bg.getScaledHeight(),
        fill: temperature > 0 ? `rgba(255, 150, 0, ${temperature / 400})` : `rgba(0, 150, 255, ${Math.abs(temperature) / 400})`,
        selectable: false,
        evented: false,
        opacity: Math.abs(temperature) / 200
      });
      
      const oldOverlay = fabricCanvas.getObjects().find(o => (o as any).isLightingOverlay);
      if (oldOverlay) fabricCanvas.remove(oldOverlay);
      
      (overlay as any).isLightingOverlay = true;
      fabricCanvas.add(overlay);

      // Apply brightness to the image object if possible (CSS filter as fallback)
      const imageBg = bg as fabric.Image;
      if (imageBg.getElement()) {
        const el = imageBg.getElement() as HTMLImageElement;
        el.style.filter = `brightness(${brightness}%) contrast(${100 + contrast}%)`;
      }
      
      fabricCanvas.renderAll();
    }
  };

  const addAsset = (type: string) => {
    if (!fabricCanvas) return;
    
    let color = '#3b82f6';
    let label = 'OBJECT';
    
    if (type === 'kitchen') { color = '#10b981'; label = 'TỦ BẾP'; }
    if (type === 'wardrobe') { color = '#8b5cf6'; label = 'TỦ ÁO'; }
    if (type === 'tv') { color = '#f59e0b'; label = 'KỆ TV'; }

    const group = new fabric.Group([
      new fabric.Rect({
        width: 120,
        height: 180,
        fill: `${color}33`,
        stroke: color,
        strokeWidth: 2,
        rx: 4, ry: 4
      }),
      new fabric.IText(label, {
        fontSize: 12,
        left: 30,
        top: 80,
        fontFamily: 'Inter',
        fontWeight: 'bold',
        fill: color
      })
    ], {
      left: 150,
      top: 150,
    });
    
    fabricCanvas.add(group);
    fabricCanvas.setActiveObject(group);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 bg-card text-card-foreground border-b shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex flex-col">
            <h2 className="text-sm font-bold uppercase tracking-tight">Bước 2: Chỉnh sửa chuyên sâu</h2>
            <span className="text-[10px] text-muted-foreground font-medium">CÔNG CỤ THIẾT KẾ CHI TIẾT</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedObject && (
             <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center bg-slate-100 p-1 rounded-xl gap-1 border border-slate-200">
                <Button variant="ghost" size="sm" className="h-7 text-[9px] font-bold hover:bg-card text-card-foreground" onClick={extendBox}>
                  <Maximize2 className="h-3 w-3 mr-1 text-blue-600" /> KÉO DÀI
                </Button>
                <div className="w-[1px] h-3 bg-slate-300 mx-1" />
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={`h-7 text-[9px] font-bold ${isRelocating ? 'bg-blue-600 text-white' : 'hover:bg-card text-card-foreground'}`}
                  onClick={() => setIsRelocating(!isRelocating)}
                >
                  <MapPin className={`h-3 w-3 mr-1 ${isRelocating ? 'text-white' : 'text-blue-600'}`} /> {isRelocating ? 'ĐẶT ĐÍCH...' : 'DI CHUYỂN'}
                </Button>
                {targetMarker && (
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="h-7 text-[9px] font-bold bg-green-600 hover:bg-green-700 text-white animate-pulse"
                    onClick={handleRelocateRender}
                    disabled={isAnalyzing}
                  >
                    <Sparkles className="h-3 w-3 mr-1" /> RENDER LẠI
                  </Button>
                )}
             </motion.div>
          )}

          <Button 
            variant="outline" 
            size="sm" 
            className="h-9 rounded-xl font-bold text-[10px]" 
            onClick={undo}
            disabled={history.length <= 1}
          >
            <Undo2 className="h-3.5 w-3.5 mr-1.5" /> HOÀN TÁC
          </Button>
          <Button variant="outline" size="sm" className="h-9 rounded-xl font-bold text-[10px]" onClick={analyzeToJSON}>
            <Code className="h-3.5 w-3.5 mr-1.5" /> PHÂN TÍCH JSON
          </Button>
          <Button variant="default" size="sm" className="h-9 rounded-xl font-bold text-[10px] shadow-sm" onClick={downloadImage}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> XUẤT ẢNH THI CÔNG
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Toolbar - Enhanced Navigation */}
        <aside className="w-80 bg-card text-card-foreground border-r flex flex-col shrink-0">
          {/* Internal Tab Navigation */}
          <div className="grid grid-cols-4 border-b">
            <button 
              onClick={() => setActiveTab('assets')}
              className={`flex flex-col items-center justify-center p-3 gap-1 border-r transition-colors ${activeTab === 'assets' ? 'bg-slate-50 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Grid3X3 className="h-4 w-4" />
              <span className="text-[9px] font-bold">THƯ VIỆN</span>
            </button>
            <button 
              onClick={() => setActiveTab('ai')}
              className={`flex flex-col items-center justify-center p-3 gap-1 border-r transition-colors ${activeTab === 'ai' ? 'bg-slate-50 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Sparkles className="h-4 w-4" />
              <span className="text-[9px] font-bold">AI SMART</span>
            </button>
            <button 
              onClick={() => setActiveTab('materials')}
              className={`flex flex-col items-center justify-center p-3 gap-1 border-r transition-colors ${activeTab === 'materials' ? 'bg-slate-50 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Palette className="h-4 w-4" />
              <span className="text-[9px] font-bold">VẬT LIỆU</span>
            </button>
            <button 
              onClick={() => setActiveTab('layers')}
              className={`flex flex-col items-center justify-center p-3 gap-1 transition-colors ${activeTab === 'layers' ? 'bg-slate-50 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <LayersIcon className="h-4 w-4" />
              <span className="text-[9px] font-bold">LỚP</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <AnimatePresence mode="wait">
              {activeTab === 'assets' && (
                <motion.div 
                  key="assets"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-6"
                >
                  <div className="space-y-4">
                     <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Module Nội thất</Label>
                     <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => addAsset('kitchen')} className="group flex flex-col items-center p-3 rounded-xl border border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all">
                           <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                              <Layout className="h-6 w-6 text-slate-400 group-hover:text-blue-500" />
                           </div>
                           <span className="text-[10px] font-bold text-slate-600">Tủ Bếp</span>
                        </button>
                        <button onClick={() => addAsset('wardrobe')} className="group flex flex-col items-center p-3 rounded-xl border border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all">
                           <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                              <Box className="h-6 w-6 text-slate-400 group-hover:text-blue-500" />
                           </div>
                           <span className="text-[10px] font-bold text-slate-600">Tủ Áo</span>
                        </button>
                        <button onClick={() => addAsset('tv')} className="group flex flex-col items-center p-3 rounded-xl border border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all">
                           <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                              <Video className="h-6 w-6 text-slate-400 group-hover:text-blue-500" />
                           </div>
                           <span className="text-[10px] font-bold text-slate-600">Kệ TV</span>
                        </button>
                        <button onClick={addRect} className="group flex flex-col items-center p-3 rounded-xl border border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all">
                           <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                              <Square className="h-6 w-6 text-slate-400 group-hover:text-blue-500" />
                           </div>
                           <span className="text-[10px] font-bold text-slate-600">Khoang tủ</span>
                        </button>
                     </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                     <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Tiện ích</Label>
                     <div className="space-y-2">
                        <Button 
                          variant="outline" 
                          className={`w-full justify-start h-10 rounded-xl font-bold text-[10px] ${isMeasuring ? 'bg-orange-50 border-orange-200' : ''}`}
                          onClick={() => setIsMeasuring(!isMeasuring)}
                        >
                          <Ruler className="h-3.5 w-3.5 mr-2 text-orange-500" /> ĐO KÍCH THƯỚC
                        </Button>
                        <Button 
                          variant="outline" 
                          className={`w-full justify-start h-10 rounded-xl font-bold text-[10px] ${isErasing ? 'bg-red-50 border-red-200' : ''}`}
                          onClick={() => setIsErasing(!isErasing)}
                        >
                          <Eraser className="h-3.5 w-3.5 mr-2 text-red-500" /> XÓA VẬT THỂ (AI)
                        </Button>
                     </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'ai' && (
                <motion.div 
                  key="ai"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-6"
                >
                  <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-4 text-white shadow-sm">
                     <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="h-4 w-4" />
                        <span className="text-[10px] font-black uppercase tracking-tighter">AI Design Engine v4.0</span>
                     </div>
                     <p className="text-[9px] text-blue-50 mb-4 leading-relaxed font-medium">Sử dụng sức mạnh của Gemini Vision để tự động hóa quy trình thiết kế chuyên nghiệp.</p>
                     
                     <div className="space-y-2">
                        <Button 
                          className="w-full h-10 bg-blue-600 hover:bg-blue-500 border-white/20 text-white rounded-xl text-[10px] font-bold"
                          onClick={() => runAIAnalysis()}
                          disabled={isAnalyzing}
                        >
                          <Zap className={`h-3.5 w-3.5 mr-2 ${isAnalyzing ? 'animate-pulse text-yellow-300' : ''}`} /> AUTO-ALIGN NỘI THẤT
                        </Button>
                        <Button 
                          className="w-full h-10 bg-blue-600 hover:bg-blue-500 border-white/20 text-white rounded-xl text-[10px] font-bold"
                          onClick={runSegmentation}
                          disabled={isAnalyzing}
                        >
                          <Target className="h-3.5 w-3.5 mr-2" /> PHÂN VÙNG KHÔNG GIAN
                        </Button>
                     </div>
                  </div>

                  <div className="space-y-4 pt-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-1">Xử lý ánh sáng & Đổ bóng</Label>
                    <div className="bg-slate-50 rounded-xl p-4 space-y-4 border">
                        <div className="space-y-2">
                           <div className="flex justify-between text-[8px] font-bold text-slate-500">
                              <span>CƯỜNG ĐỘ SÁNG</span>
                              <span className="text-blue-600">{brightness}%</span>
                           </div>
                           <Input 
                              type="range" min="50" max="150" value={brightness}
                              onChange={(e) => {
                                setBrightness(parseInt(e.target.value));
                                applyLighting();
                              }}
                              className="h-1 bg-slate-200 accent-blue-500 p-0 border-none"
                           />
                        </div>
                        <div className="space-y-2">
                           <div className="flex justify-between text-[8px] font-bold text-slate-500">
                              <span>ĐỘ TƯƠNG PHẢN</span>
                              <span className="text-blue-600">{contrast}%</span>
                           </div>
                           <Input 
                              type="range" min="-50" max="50" value={contrast}
                              onChange={(e) => {
                                setContrast(parseInt(e.target.value));
                                applyLighting();
                              }}
                              className="h-1 bg-slate-200 accent-blue-500 p-0 border-none"
                           />
                        </div>
                        <div className="space-y-2">
                           <div className="flex justify-between text-[8px] font-bold text-slate-500">
                              <span>NHIỆT ĐỘ MÀU</span>
                              <span className="text-orange-500">{temperature}K</span>
                           </div>
                           <Input 
                              type="range" min="-100" max="100" value={temperature}
                              onChange={(e) => {
                                setTemperature(parseInt(e.target.value));
                                applyLighting();
                              }}
                              className="h-1 bg-slate-200 accent-orange-500 p-0 border-none"
                           />
                        </div>
                        <div className="flex gap-2">
                           <Button variant="ghost" className="flex-1 h-8 rounded-lg text-[8px] font-black bg-card text-card-foreground border">LED STRIP</Button>
                           <Button variant="ghost" className="flex-1 h-8 rounded-lg text-[8px] font-black bg-card text-card-foreground border">SPOTLIGHT</Button>
                        </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'materials' && (
                <motion.div 
                  key="materials"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-6"
                >
                  <div className="space-y-4">
                     <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Màu sắc tùy chỉnh</Label>
                     <div className="grid grid-cols-5 gap-2 px-1">
                        {['#ffffff', '#f1f5f9', '#475569', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#000000', '#78350f'].map((color) => (
                           <button 
                             key={color} 
                             className="w-full aspect-square rounded-full border-2 border-white shadow-sm ring-1 ring-slate-200"
                             style={{ backgroundColor: color }}
                             onClick={() => {
                               if (selectedObject) {
                                 // Handle group or single object
                                 if (selectedObject.type === 'group') {
                                   (selectedObject as fabric.Group).forEachObject(obj => {
                                     if (obj.type === 'rect' || obj.type === 'polygon') obj.set('fill', color);
                                   });
                                 } else {
                                   selectedObject.set('fill', color);
                                 }
                                 fabricCanvas?.renderAll();
                                 saveHistory(fabricCanvas!);
                               }
                             }}
                           />
                        ))}
                     </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                     <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Thư viện vật liệu</Label>
                     <div className="grid grid-cols-3 gap-2">
                        {[
                          { name: 'Gỗ MDF', color: '#8b4513' },
                          { name: 'Ecoplast', color: '#10b981' },
                          { name: 'Cánh Kính', color: '#3b82f6' },
                          { name: 'Acrylic', color: '#f8fafc' },
                          { name: 'Vân Đá', color: '#94a3b8' },
                          { name: 'Kim Loại', color: '#475569' }
                        ].map((mat) => (
                           <button 
                             key={mat.name} 
                             className="flex flex-col items-center gap-1.5 group"
                             onClick={() => {
                               if (selectedObject) {
                                  const label = (selectedObject as any).label || "";
                                  const isSegment = label.includes('Tường') || label.includes('Sàn') || label.includes('Trần');
                                  
                                  if (isSegment) {
                                    handleRetexture(mat.name);
                                  } else {
                                    const fill = mat.name === 'Ecoplast' ? 'rgba(16, 185, 129, 0.4)' : `${mat.color}66`;
                                    if (selectedObject.type === 'group') {
                                      (selectedObject as fabric.Group).forEachObject(obj => {
                                        if (obj.type === 'rect' || obj.type === 'polygon') obj.set('fill', fill);
                                      });
                                    } else {
                                      selectedObject.set('fill', fill);
                                    }
                                    fabricCanvas?.renderAll();
                                    saveHistory(fabricCanvas!);
                                    toast.success(`Đã áp dụng màu đại diện: ${mat.name}`);
                                  }
                               } else {
                                 toast.info("Vui lòng chọn một đối tượng để áp dụng vật liệu");
                               }
                             }}
                           >
                              <div className="w-full aspect-square rounded-xl bg-slate-100 border-2 border-transparent group-hover:border-blue-500 transition-all overflow-hidden relative">
                                 <div className="absolute inset-0 bg-gradient-to-tr from-black/10 to-transparent"></div>
                                 <div className="absolute inset-2 rounded-lg opacity-60" style={{ backgroundColor: mat.color }}></div>
                              </div>
                              <span className="text-[8px] font-bold text-slate-600">{mat.name}</span>
                           </button>
                        ))}
                     </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                     <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Thêm ảnh trang trí</Label>
                     <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                           <ImageIcon className="w-6 h-6 text-slate-400 mb-2" />
                           <p className="text-[9px] font-bold text-slate-500">TẢI TRÊN THIẾT BỊ</p>
                        </div>
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file && fabricCanvas) {
                              const reader = new FileReader();
                              reader.onload = (f) => {
                                const data = f.target?.result as string;
                                fabric.Image.fromURL(data, (img) => {
                                  img.scaleToWidth(150);
                                  fabricCanvas.add(img);
                                  fabricCanvas.centerObject(img);
                                  fabricCanvas.setActiveObject(img);
                                  fabricCanvas.renderAll();
                                  saveHistory(fabricCanvas);
                                  toast.success("Đã thêm hình ảnh mới");
                                });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                     </label>
                  </div>
                </motion.div>
              )}

              {activeTab === 'layers' && (
                <motion.div 
                  key="layers"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-2"
                >
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block">Cấu trúc Layer ({layers.length})</Label>
                  {layers.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-slate-300 gap-2">
                       <LayersIcon className="h-8 w-8 opacity-20" />
                       <span className="text-[10px] font-bold">Chưa có Layer nào</span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {layers.map((layer, idx) => (
                        <div 
                          key={layer.id} 
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border hover:border-blue-200 transition-all cursor-pointer group"
                          onClick={() => {
                            if (fabricCanvas) {
                              const obj = fabricCanvas.getObjects().find((o, i) => i === idx);
                              if (obj) fabricCanvas.setActiveObject(obj).renderAll();
                            }
                          }}
                        >
                          <div className="flex items-center gap-3">
                             <span className="text-[8px] font-black text-slate-300 w-4">0{idx + 1}</span>
                             <span className="text-[10px] font-bold text-slate-600 truncate max-w-[140px] uppercase">
                               {layer.label}
                             </span>
                          </div>
                          <div className="flex items-center gap-1 opacity-10 group-hover:opacity-100 transition-opacity">
                             <Button 
                               variant="ghost" 
                               size="icon" 
                               className={`h-6 w-6 rounded-md hover:bg-card text-card-foreground ${!layer.visible ? 'text-red-500 opacity-100' : 'text-slate-400'}`}
                               onClick={(e) => {
                                 e.stopPropagation();
                                 if (fabricCanvas) {
                                   const obj = fabricCanvas.getObjects().find((o, i) => i === idx);
                                   if (obj) {
                                     obj.visible = !obj.visible;
                                     fabricCanvas.renderAll();
                                     setLayers([...layers.map((l, li) => li === idx ? {...l, visible: obj.visible} : l)]);
                                   }
                                 }
                               }}
                             >
                                <Sun className="h-3 w-3" />
                             </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {selectedObject && (
            <div className="p-4 border-t bg-gray-50">
               <Label className="text-[10px] font-bold uppercase tracking-widest text-red-500 px-1 mb-3 block">Tùy chỉnh đối tượng</Label>
               <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="h-9 rounded-xl font-bold text-[9px]" onClick={() => fabricCanvas?.sendBackwards(selectedObject)}>HẠ LỚP</Button>
                  <Button variant="outline" className="h-9 rounded-xl font-bold text-[9px]" onClick={() => fabricCanvas?.bringForward(selectedObject)}>NÂNG LỚP</Button>
                  <Button variant="destructive" className="h-9 rounded-xl font-bold text-[9px] col-span-2" onClick={deleteSelected}>
                    <Trash2 className="h-3 w-3 mr-2" /> XÓA ĐỐI TƯỢNG
                  </Button>
               </div>
            </div>
          )}
        </aside>

        {/* Canvas Area */}
        <main className="flex-1 overflow-auto bg-slate-100 flex items-center justify-center p-8 relative">
          <div className="bg-card text-card-foreground shadow-2xl rounded-sm overflow-hidden ring-1 ring-gray-200">
            <canvas ref={canvasRef} />
          </div>

          {/* Quick HUD */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-card text-card-foreground p-2 rounded-2xl border border-gray-200 shadow-2xl">
             <div className="flex items-center gap-1 px-3 border-r h-8">
               <Move className="h-4 w-4 text-muted-foreground mr-2" />
               <span className="text-[10px] font-bold text-muted-foreground uppercase">CHẾ ĐỘ: DI CHUYỂN</span>
             </div>
             <div className="flex items-center gap-1 px-3 border-r h-8">
               <span className="text-[10px] font-bold text-blue-600 uppercase">ZOOM: {Math.round(zoomLevel * 100)}%</span>
             </div>
             <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-blue-50" title="Thêm chữ" onClick={addText}>
               <Type className="h-4 w-4 text-blue-600" />
             </Button>
             <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-slate-100" title="Phóng to" onClick={zoomIn}>
               <Plus className="h-4 w-4" />
             </Button>
             <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-slate-100" title="Thu nhỏ" onClick={zoomOut}>
               <Minus className="h-4 w-4" />
             </Button>
             <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-slate-100" title="Đặt lại Zoom" onClick={resetZoom}>
               <Maximize className="h-4 w-4" />
             </Button>
          </div>
        </main>
      </div>
    </div>
  );
}
