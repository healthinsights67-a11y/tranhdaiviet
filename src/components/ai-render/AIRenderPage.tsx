
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Upload, 
  Sparkles, 
  RefreshCw, 
  Image as ImageIcon, 
  Key, 
  Eye, 
  EyeOff, 
  Code, 
  X, 
  Maximize2, 
  Settings2, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Check, 
  Columns, 
  Wand2, 
  Building2, 
  Palette, 
  SlidersHorizontal, 
  FolderPlus, 
  Layers, 
  User,
  ShieldCheck,
  ChevronRight,
  Info
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { 
  simpleRender, 
  renderFromEmptyRoom, 
  validateApiKey, 
  ROOM_TYPE_MAP, 
  DESIGN_STYLE_MAP, 
  MATERIAL_MAP, 
  InteriorDesignConfig,
  RenderResult 
} from "../../services/geminiRenderService";
import DeepEditPage from "./DeepEditPage";
import { db, doc, onSnapshot, collection, getDocs } from "@/src/lib/firebase";

export default function AIRenderPage() {
  // Mode selection: 'empty_room' | 'fusion' | 'retexture'
  const [activeMode, setActiveMode] = useState<'empty_room' | 'fusion' | 'retexture'>('empty_room');

  // Image states
  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [refImage, setRefImage] = useState<string | null>(null);

  // Configuration options
  const [roomType, setRoomType] = useState<string>('living');
  const [designStyle, setDesignStyle] = useState<string>('modern');
  const [primaryMaterial, setPrimaryMaterial] = useState<string>('ecoplast_oak');
  const [accentLighting, setAccentLighting] = useState<string[]>(['led_strip_3000k']);
  const [aspectRatio, setAspectRatio] = useState<string>("1:1");
  const [customPrompt, setCustomPrompt] = useState<string>('');

  // Processing & Results
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStepText, setProcessStepText] = useState<string>('');
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [fusionPrompt, setFusionPrompt] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);

  // API Key & System Config
  const [apiKey, setApiKey] = useState<string>('');
  const [showKey, setShowKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'unchecked' | 'validating' | 'valid' | 'invalid'>('unchecked');
  const [keySource, setKeySource] = useState<'local' | 'system'>('local');

  // Interactive View Modes: 'slider' | 'result_only' | 'side_by_side'
  const [viewMode, setViewMode] = useState<'slider' | 'result_only' | 'side_by_side'>('slider');
  const [sliderPosition, setSliderPosition] = useState<number>(50);
  const isDraggingSlider = useRef(false);

  // Navigation & Modals
  const [isZoomed, setIsZoomed] = useState(false);
  const [showDeepEdit, setShowDeepEdit] = useState(false);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);

  // Customer linkage
  const [customers, setCustomers] = useState<{ id: string; name: string; phone?: string }[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

  // Load API Key from System Config or Local Storage
  useEffect(() => {
    const savedLocalKey = localStorage.getItem('gemini_api_key');
    if (savedLocalKey) {
      setApiKey(savedLocalKey);
      setKeySource('local');
    }

    // Try listening to Firestore configs/storage or configs/system
    const unsub = onSnapshot(doc(db, 'configs', 'storage'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.geminiApiKey && !savedLocalKey) {
          setApiKey(data.geminiApiKey);
          setKeySource('system');
        }
      }
    });

    // Fetch brief customer list for tagging designs
    getDocs(collection(db, 'customers')).then(snap => {
      const list = snap.docs.map(d => ({
        id: d.id,
        name: d.data().name || 'Khách hàng',
        phone: d.data().phone || ''
      }));
      setCustomers(list);
    }).catch(err => console.warn("Cannot load customer list:", err));

    return () => unsub();
  }, []);

  // Quick API Key validation
  const handleValidateKey = async (keyToTest?: string) => {
    const targetKey = keyToTest !== undefined ? keyToTest : apiKey;
    if (!targetKey) {
      toast.error("Vui lòng nhập API Key để kiểm tra");
      setKeyStatus('invalid');
      return;
    }
    setKeyStatus('validating');
    const res = await validateApiKey(targetKey);
    if (res.valid) {
      setKeyStatus('valid');
      toast.success("Kết nối Gemini API thành công! Mô hình sẵn sàng.");
    } else {
      setKeyStatus('invalid');
      toast.error(res.message || "API Key không hợp lệ hoặc bị lỗi kết nối.");
    }
  };

  const handleApiKeyChange = (val: string) => {
    setApiKey(val);
    localStorage.setItem('gemini_api_key', val);
    setKeySource('local');
    setKeyStatus('unchecked');
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'base' | 'ref') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 15 * 1024 * 1024) {
        toast.error("Kích thước ảnh quá lớn (>15MB). Vui lòng chọn ảnh nhỏ hơn để AI xử lý nhanh hơn.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (prev) => {
        if (type === 'base') setBaseImage(prev.target?.result as string);
        else setRefImage(prev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleLightingOption = (lightId: string) => {
    setAccentLighting(prev => 
      prev.includes(lightId) ? prev.filter(item => item !== lightId) : [...prev, lightId]
    );
  };

  const handleStartRender = async () => {
    if (!apiKey) {
      setShowApiKeyDialog(true);
      toast.error("Vui lòng nhập Gemini API Key trước khi render");
      return;
    }
    if (!baseImage) {
      toast.error("Vui lòng tải lên ảnh không gian hiện trạng (Base Image)");
      return;
    }
    if (activeMode === 'fusion' && !refImage) {
      toast.error("Chế độ 'Hòa trộn mẫu tủ' yêu cầu tải lên đủ cả ảnh hiện trạng và mẫu tủ tham khảo");
      return;
    }

    setIsProcessing(true);
    setProcessStepText("Đang khởi tạo kết nối & tải dữ liệu không gian...");
    setFusionPrompt(null);
    setResultImage(null);
    setModelUsed(null);

    const stepInterval = setInterval(() => {
      setProcessStepText(prev => {
        if (prev.includes("khởi tạo")) return "Đang phân tích điểm tụ & kết cấu kiến trúc 3D...";
        if (prev.includes("điểm tụ")) return "Đang mô phỏng bề mặt vật liệu & phân bổ ánh sáng 3000K...";
        if (prev.includes("mô phỏng")) return "Đang hoàn thiện chi tiết độ sắc nét 8K UHD...";
        return prev;
      });
    }, 4500);

    try {
      const config: InteriorDesignConfig = {
        roomType,
        style: designStyle,
        primaryMaterial,
        accentLighting,
        customDetails: customPrompt,
        aspectRatio,
        mode: activeMode
      };

      let result: RenderResult;

      if (activeMode === 'empty_room') {
        result = await renderFromEmptyRoom(apiKey, baseImage, config);
      } else {
        result = await simpleRender(
          apiKey, 
          baseImage, 
          refImage || undefined, 
          customPrompt || undefined, 
          aspectRatio, 
          config
        );
      }

      setFusionPrompt(result.fusionPrompt);
      setModelUsed(result.modelUsed || "Gemini Flash Vision Core");

      if (result.images && result.images.length > 0) {
        setResultImage(result.images[0]);
        toast.success("Diễn họa phối cảnh nội thất thành công!");
      } else {
        toast.warning("AI đã diễn họa xong nhưng chưa trả về file ảnh. Vui lòng thử lại với phong cách khác.");
      }
    } catch (error: any) {
      console.error("AI Render Studio Error:", error);
      toast.error(error.message || "Đã xảy ra lỗi trong quá trình xử lý.", { duration: 6000 });
    } finally {
      clearInterval(stepInterval);
      setIsProcessing(false);
      setProcessStepText('');
    }
  };

  const handleDownloadResult = () => {
    if (!resultImage) return;
    const a = document.createElement('a');
    a.href = resultImage;
    a.download = `tranhdaiviet_ai_${roomType}_${designStyle}_${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("Đã tải ảnh thiết kế về thiết bị");
  };

  // Slider Mouse/Touch movement handlers
  const handleSliderMove = (clientX: number, containerRect: DOMRect) => {
    const x = clientX - containerRect.left;
    const percentage = Math.max(0, Math.min(100, (x / containerRect.width) * 100));
    setSliderPosition(percentage);
  };

  if (showDeepEdit && resultImage) {
    return <DeepEditPage imageUrl={resultImage} onBack={() => setShowDeepEdit(false)} apiKey={apiKey} />;
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-300">
      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
              Studio v3.0 Pro
            </span>
            <span className="text-xs text-muted-foreground font-medium">Thiết Kế & Diễn Họa Nội Thất Chuyên Nghiệp</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight uppercase flex items-center gap-3">
            <Wand2 className="h-7 w-7 text-primary" /> AI Interior Studio
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1 max-w-2xl">
            Diễn họa không gian sống với chuẩn vật liệu thực tế xưởng: Tấm nhựa Ecoplast chống nước 100%, Thùng cánh kính khung nhôm anodized và Gỗ MDF An Cường.
          </p>
        </div>

        {/* API Key Status & Actions */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-xl px-3 text-xs font-bold border-gray-200 hover:border-primary/50 shadow-sm"
            onClick={() => setShowApiKeyDialog(true)}
          >
            <Key className="h-4 w-4 mr-2 text-primary" />
            <span>API Key:</span>
            {apiKey ? (
              <span className="ml-1.5 flex items-center gap-1 font-mono text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                <CheckCircle2 className="h-3 w-3" /> Đã nạp
              </span>
            ) : (
              <span className="ml-1.5 flex items-center gap-1 font-mono text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md">
                <AlertCircle className="h-3 w-3" /> Chưa cấu hình
              </span>
            )}
          </Button>

          {resultImage && (
            <Button
              variant="default"
              size="sm"
              className="h-10 rounded-xl text-xs font-bold shadow-md bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
              onClick={() => setShowDeepEdit(true)}
            >
              <Settings2 className="h-4 w-4 mr-2" /> CHỈNH SỬA BẢN VẼ (DEEP EDIT)
            </Button>
          )}
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Input & Configuration (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* STEP 1: Mode Selection & Upload */}
          <Card className="shadow-sm border-gray-200 overflow-hidden">
            <CardHeader className="pb-4 bg-gray-50/60 dark:bg-gray-900/40 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">1</div>
                  <CardTitle className="text-sm font-bold uppercase">Chế Độ & Không Gian Nguồn</CardTitle>
                </div>
                <span className="text-[11px] font-bold text-muted-foreground uppercase">Nguồn Dữ Liệu</span>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              
              {/* Mode Switcher Tabs */}
              <div className="grid grid-cols-3 gap-2 p-1 bg-secondary/30 rounded-2xl border">
                <button
                  type="button"
                  onClick={() => setActiveMode('empty_room')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all ${
                    activeMode === 'empty_room' 
                      ? 'bg-card text-foreground shadow-sm font-bold border-primary/20' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Building2 className={`h-4 w-4 mb-1 ${activeMode === 'empty_room' ? 'text-primary' : ''}`} />
                  <span className="text-xs">Phòng Trống</span>
                  <span className="text-[9px] opacity-70">Thô ➔ Đầy đủ</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMode('fusion')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all ${
                    activeMode === 'fusion' 
                      ? 'bg-card text-foreground shadow-sm font-bold border-primary/20' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Layers className={`h-4 w-4 mb-1 ${activeMode === 'fusion' ? 'text-primary' : ''}`} />
                  <span className="text-xs">Ghép Mẫu Tủ</span>
                  <span className="text-[9px] opacity-70">Lắp mẫu vào phòng</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMode('retexture')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all ${
                    activeMode === 'retexture' 
                      ? 'bg-card text-foreground shadow-sm font-bold border-primary/20' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Palette className={`h-4 w-4 mb-1 ${activeMode === 'retexture' ? 'text-primary' : ''}`} />
                  <span className="text-xs">Đổi Vật Liệu</span>
                  <span className="text-[9px] opacity-70">Cải tạo bề mặt</span>
                </button>
              </div>

              {/* Upload Areas */}
              <div className={`grid ${activeMode === 'fusion' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'} gap-4`}>
                
                {/* Base Image */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-foreground">
                    <span className="flex items-center gap-1.5">
                      <ImageIcon className="h-3.5 w-3.5 text-primary" /> Ảnh Hiện Trạng Căn Phòng (Base)
                    </span>
                    {baseImage && (
                      <button 
                        onClick={() => setBaseImage(null)}
                        className="text-[10px] text-destructive hover:underline font-bold"
                      >
                        Xóa ảnh
                      </button>
                    )}
                  </div>

                  <div className="aspect-video bg-secondary/15 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 hover:border-primary/50 relative overflow-hidden transition-all group flex items-center justify-center">
                    {baseImage ? (
                      <>
                        <img src={baseImage} alt="Base room" className="w-full h-full object-contain" />
                        <div 
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                          onClick={() => document.getElementById('base-upload-input')?.click()}
                        >
                          <span className="text-white text-xs font-bold uppercase bg-black/60 px-3 py-1.5 rounded-xl backdrop-blur-sm">
                            Đổi ảnh khác
                          </span>
                        </div>
                      </>
                    ) : (
                      <label htmlFor="base-upload-input" className="w-full h-full cursor-pointer flex flex-col items-center justify-center p-4 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                          <Upload className="h-6 w-6 text-primary" />
                        </div>
                        <span className="text-xs font-bold text-foreground">Tải ảnh phòng hiện trạng</span>
                        <span className="text-[10px] text-muted-foreground mt-1">Hỗ trợ JPG, PNG, WEBP (Tối đa 15MB)</span>
                      </label>
                    )}
                    <input 
                      id="base-upload-input" 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => handleUpload(e, 'base')} 
                    />
                  </div>
                </div>

                {/* Reference Image (Only for Fusion Mode) */}
                {activeMode === 'fusion' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-foreground">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-primary" /> Mẫu Tủ / Thiết Kế Tham Khảo
                      </span>
                      {refImage && (
                        <button 
                          onClick={() => setRefImage(null)}
                          className="text-[10px] text-destructive hover:underline font-bold"
                        >
                          Xóa ảnh
                        </button>
                      )}
                    </div>

                    <div className="aspect-video bg-secondary/15 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 hover:border-primary/50 relative overflow-hidden transition-all group flex items-center justify-center">
                      {refImage ? (
                        <>
                          <img src={refImage} alt="Reference furniture" className="w-full h-full object-contain" />
                          <div 
                            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                            onClick={() => document.getElementById('ref-upload-input')?.click()}
                          >
                            <span className="text-white text-xs font-bold uppercase bg-black/60 px-3 py-1.5 rounded-xl backdrop-blur-sm">
                              Đổi ảnh mẫu
                            </span>
                          </div>
                        </>
                      ) : (
                        <label htmlFor="ref-upload-input" className="w-full h-full cursor-pointer flex flex-col items-center justify-center p-4 text-center">
                          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                            <Sparkles className="h-6 w-6 text-primary" />
                          </div>
                          <span className="text-xs font-bold text-foreground">Tải ảnh mẫu nội thất</span>
                          <span className="text-[10px] text-muted-foreground mt-1">Mẫu tủ áo, tủ bếp, kệ TV cần ghép</span>
                        </label>
                      )}
                      <input 
                        id="ref-upload-input" 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => handleUpload(e, 'ref')} 
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* STEP 2: Interior Specifications & Workshop Materials */}
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="pb-4 bg-gray-50/60 dark:bg-gray-900/40 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">2</div>
                  <CardTitle className="text-sm font-bold uppercase">Quy Cách & Tiêu Chuẩn Xưởng</CardTitle>
                </div>
                <span className="text-[11px] font-bold text-muted-foreground uppercase">Thông Số Kỹ Thuật</span>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              
              {/* Room Type */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-primary" /> Không Gian Cần Thiết Kế
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(ROOM_TYPE_MAP).map(([key, item]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setRoomType(key)}
                      className={`p-2.5 rounded-xl text-left border transition-all text-xs flex flex-col justify-between h-14 ${
                        roomType === key 
                          ? 'bg-primary/5 border-primary text-primary font-bold ring-1 ring-primary' 
                          : 'bg-card hover:bg-secondary/30 border-gray-200 text-foreground'
                      }`}
                    >
                      <span className="truncate">{item.vi}</span>
                      <span className="text-[9px] text-muted-foreground truncate uppercase">{key}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Design Style */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Palette className="h-3.5 w-3.5 text-primary" /> Phong Cách Thiết Kế
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(DESIGN_STYLE_MAP).map(([key, item]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setDesignStyle(key)}
                      className={`p-3 rounded-xl text-left border transition-all flex flex-col justify-between ${
                        designStyle === key 
                          ? 'bg-primary/5 border-primary text-primary font-bold ring-1 ring-primary' 
                          : 'bg-card hover:bg-secondary/30 border-gray-200 text-foreground'
                      }`}
                    >
                      <span className="text-xs font-bold">{item.vi}</span>
                      <span className="text-[9px] text-muted-foreground mt-1 line-clamp-1">{item.en}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Workshop Material Focus */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-primary" /> Vật Liệu Chủ Đạo (Đặc Trưng Xưởng)
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(MATERIAL_MAP).map(([key, item]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPrimaryMaterial(key)}
                      className={`p-3 rounded-xl text-left border transition-all flex items-center gap-2.5 ${
                        primaryMaterial === key 
                          ? 'bg-primary/5 border-primary text-primary font-bold ring-1 ring-primary' 
                          : 'bg-card hover:bg-secondary/30 border-gray-200 text-foreground'
                      }`}
                    >
                      <div className={`w-3.5 h-3.5 rounded-full shrink-0 border ${
                        key.includes('oak') ? 'bg-amber-700' :
                        key.includes('walnut') ? 'bg-amber-950' :
                        key.includes('white') ? 'bg-slate-100 border-gray-300' :
                        key.includes('grey') ? 'bg-slate-500' :
                        key.includes('glass') ? 'bg-blue-600' : 'bg-emerald-600'
                      }`} />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs truncate">{item.vi}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Lighting & Options */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Chi Tiết Phụ Kiện & Chiếu Sáng
                </Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'led_strip_3000k', label: 'Đèn LED ấm 3000K âm tủ' },
                    { id: 'magnetic_track', label: 'Đèn ray nam châm trần' },
                    { id: 'under_cabinet', label: 'Đèn rọi hắt đáy tủ bếp' },
                    { id: 'cove_ceiling', label: 'Đèn hắt trần thạch cao' },
                  ].map(light => {
                    const active = accentLighting.includes(light.id);
                    return (
                      <button
                        key={light.id}
                        type="button"
                        onClick={() => toggleLightingOption(light.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                          active 
                            ? 'bg-primary text-primary-foreground border-primary' 
                            : 'bg-card text-muted-foreground hover:text-foreground border-gray-200'
                        }`}
                      >
                        {active && <Check className="h-3 w-3" />}
                        {light.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Aspect Ratio & Custom Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Tỷ Lệ Khung Hình
                  </Label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: "1:1", label: "1:1 (Vuông)" },
                      { id: "16:9", label: "16:9 (Ngang)" },
                      { id: "4:3", label: "4:3 (Tiêu chuẩn)" },
                      { id: "9:16", label: "9:16 (Dọc)" }
                    ].map(r => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setAspectRatio(r.id)}
                        className={`py-2 rounded-xl text-[11px] font-bold border transition-all ${
                          aspectRatio === r.id 
                            ? 'bg-primary text-primary-foreground border-primary' 
                            : 'bg-card text-muted-foreground hover:text-foreground border-gray-200'
                        }`}
                      >
                        {r.id}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Gắn Với Khách Hàng (Tùy chọn)
                  </Label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-card text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">-- Không gắn khách hàng --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Custom Prompt Text */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Ghi Chú Yêu Cầu Kỹ Thuật Riêng (Prompt Bổ Sung)
                </Label>
                <Input
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Ví dụ: Tủ kịch trần 2m6, bố trí khoang máy giặt âm, tay nắm vát chữ J, góc tủ vát chéo..."
                  className="h-11 rounded-xl text-xs bg-background"
                />
              </div>

              {/* Big Action Button */}
              <Button
                size="lg"
                disabled={isProcessing}
                onClick={handleStartRender}
                className="w-full h-14 rounded-2xl text-base font-black uppercase tracking-wider shadow-xl shadow-primary/25 bg-gradient-to-r from-blue-600 via-indigo-600 to-primary hover:opacity-95 text-white transition-all transform active:scale-[0.99]"
              >
                {isProcessing ? (
                  <div className="flex items-center gap-3">
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold tracking-normal">AI ĐANG XỬ LÝ KHÔNG GIAN...</span>
                      <span className="text-[10px] font-medium text-white/80">{processStepText || "Vui lòng chờ trong giây lát"}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    TIẾN HÀNH DỰNG HÌNH AI STUDIO
                  </div>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Interactive Result & Studio Display (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="shadow-lg border-gray-200 overflow-hidden flex flex-col">
            <CardHeader className="pb-3 bg-gray-50/60 dark:bg-gray-900/40 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold uppercase flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-primary" /> Kết Quả Diễn Họa 3D
                </CardTitle>
                <CardDescription className="text-[11px] text-muted-foreground mt-0.5">
                  {modelUsed ? `Render thành công bởi ${modelUsed}` : "Khung hiển thị bản vẽ phối cảnh AI"}
                </CardDescription>
              </div>

              {resultImage && (
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                    title="Tải về"
                    onClick={handleDownloadResult}
                  >
                    <Download className="h-4 w-4 text-primary" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                    title="Phóng to"
                    onClick={() => setIsZoomed(true)}
                  >
                    <Maximize2 className="h-4 w-4 text-foreground" />
                  </Button>
                </div>
              )}
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              
              {/* View Mode Toolbar (When result exists) */}
              {resultImage && baseImage && (
                <div className="flex items-center justify-between border-b pb-3">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase">Chế độ xem:</span>
                  <div className="flex items-center gap-1 bg-secondary/40 p-0.5 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setViewMode('slider')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                        viewMode === 'slider' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Kéo So Sánh
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('side_by_side')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                        viewMode === 'side_by_side' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Song Song
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('result_only')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                        viewMode === 'result_only' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Chỉ Ảnh Mới
                    </button>
                  </div>
                </div>
              )}

              {/* Main Display Container */}
              <div className="aspect-square w-full rounded-2xl bg-secondary/15 border-2 border-dashed border-gray-200 dark:border-gray-800 overflow-hidden relative flex items-center justify-center select-none">
                {resultImage ? (
                  <>
                    {/* View Mode 1: Interactive Before / After Slider */}
                    {viewMode === 'slider' && baseImage ? (
                      <div 
                        className="relative w-full h-full cursor-ew-resize overflow-hidden"
                        onMouseDown={() => (isDraggingSlider.current = true)}
                        onMouseUp={() => (isDraggingSlider.current = false)}
                        onMouseLeave={() => (isDraggingSlider.current = false)}
                        onMouseMove={(e) => {
                          if (isDraggingSlider.current) {
                            handleSliderMove(e.clientX, e.currentTarget.getBoundingClientRect());
                          }
                        }}
                        onTouchMove={(e) => {
                          if (e.touches[0]) {
                            handleSliderMove(e.touches[0].clientX, e.currentTarget.getBoundingClientRect());
                          }
                        }}
                      >
                        {/* Background: Base Image (Before) */}
                        <img 
                          src={baseImage} 
                          alt="Before" 
                          className="absolute inset-0 w-full h-full object-contain pointer-events-none" 
                        />
                        <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider z-10 pointer-events-none">
                          Trước (Hiện trạng)
                        </div>

                        {/* Foreground: Rendered Image (After) with clipPath */}
                        <div 
                          className="absolute inset-0 overflow-hidden pointer-events-none"
                          style={{ clipPath: `polygon(${sliderPosition}% 0, 100% 0, 100% 100%, ${sliderPosition}% 100%)` }}
                        >
                          <img 
                            src={resultImage} 
                            alt="After" 
                            className="w-full h-full object-contain pointer-events-none" 
                          />
                          <div className="absolute top-3 right-3 bg-primary/90 text-primary-foreground px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider z-10 pointer-events-none">
                            Sau (Thiết Kế AI)
                          </div>
                        </div>

                        {/* Splitter Line & Handle */}
                        <div 
                          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)] z-20 pointer-events-none"
                          style={{ left: `${sliderPosition}%` }}
                        >
                          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white text-gray-800 shadow-xl flex items-center justify-center border border-gray-200">
                            <Columns className="h-4 w-4" />
                          </div>
                        </div>
                      </div>
                    ) : viewMode === 'side_by_side' && baseImage ? (
                      /* View Mode 2: Side-by-side */
                      <div className="grid grid-cols-2 w-full h-full divide-x">
                        <div className="relative h-full flex items-center justify-center p-1 bg-black/5">
                          <img src={baseImage} alt="Before" className="w-full h-full object-contain" />
                          <span className="absolute bottom-2 left-2 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">Trước</span>
                        </div>
                        <div className="relative h-full flex items-center justify-center p-1 bg-black/5">
                          <img src={resultImage} alt="After" className="w-full h-full object-contain" />
                          <span className="absolute bottom-2 left-2 bg-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded">Sau</span>
                        </div>
                      </div>
                    ) : (
                      /* View Mode 3: Result Only */
                      <div 
                        className="w-full h-full relative cursor-zoom-in"
                        onClick={() => setIsZoomed(true)}
                      >
                        <img 
                          src={resultImage} 
                          alt="AI Rendered Design" 
                          className="w-full h-full object-contain" 
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <div className="w-16 h-16 rounded-3xl bg-secondary/40 flex items-center justify-center mb-3">
                      <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">Chưa Có Bản Vẽ Render</span>
                    <p className="text-[11px] text-muted-foreground mt-1 max-w-xs">
                      Tải ảnh phòng và nhấn &ldquo;Tiến hành dựng hình AI Studio&rdquo; để hệ thống bắt đầu vẽ phối cảnh.
                    </p>
                  </div>
                )}
              </div>

              {/* Quick Actions after Render */}
              {resultImage && (
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="h-11 rounded-xl text-xs font-bold border-gray-200 hover:bg-secondary/40"
                      onClick={handleDownloadResult}
                    >
                      <Download className="h-4 w-4 mr-2 text-primary" /> TẢI ẢNH FULL HD
                    </Button>
                    <Button
                      variant="default"
                      className="h-11 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
                      onClick={() => setShowDeepEdit(true)}
                    >
                      <Settings2 className="h-4 w-4 mr-2" /> SỬA BẰNG DEEP EDIT
                    </Button>
                  </div>

                  {/* Architectural Analysis Text Box */}
                  {fusionPrompt && (
                    <div className="bg-secondary/30 rounded-xl p-3 border text-[11px] space-y-1">
                      <span className="font-bold flex items-center gap-1.5 text-foreground">
                        <Info className="h-3.5 w-3.5 text-primary" /> Diễn Giải Thiết Kế:
                      </span>
                      <p className="text-muted-foreground italic leading-relaxed">
                        {fusionPrompt}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* API Key Modal Dialog */}
      <AnimatePresence>
        {showApiKeyDialog && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card text-card-foreground rounded-2xl border shadow-2xl max-w-md w-full p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-black uppercase">Cấu hình Gemini API Key</h3>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setShowApiKeyDialog(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-3 text-xs">
                <p className="text-muted-foreground leading-relaxed">
                  Hệ thống AI Interior Studio sử dụng Google Gemini SDK chính hãng để diễn họa 3D và bóc tách phối cảnh.
                </p>

                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase text-muted-foreground">Google Gemini API Key</Label>
                  <div className="relative">
                    <Input
                      type={showKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => handleApiKeyChange(e.target.value)}
                      placeholder="AIzaSy..."
                      className="pr-10 h-11 font-mono text-xs rounded-xl"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowKey(!showKey)}
                    >
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-muted-foreground">
                    Nguồn key: <strong>{keySource === 'system' ? 'Cấu hình hệ thống (Firestore)' : 'Cục bộ trình duyệt (Local)'}</strong>
                  </span>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-primary hover:underline font-bold"
                  >
                    Lấy Key miễn phí ↗
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-10 rounded-xl text-xs font-bold"
                  onClick={() => handleValidateKey()}
                  disabled={keyStatus === 'validating'}
                >
                  {keyStatus === 'validating' ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <ShieldCheck className="h-3.5 w-3.5 mr-1" />}
                  Kiểm tra kết nối
                </Button>

                <Button
                  variant="default"
                  size="sm"
                  className="flex-1 h-10 rounded-xl text-xs font-bold"
                  onClick={() => {
                    setShowApiKeyDialog(false);
                    toast.success("Đã lưu API Key thành công");
                  }}
                >
                  Xác nhận & Đóng
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {isZoomed && resultImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 cursor-pointer"
            onClick={() => setIsZoomed(false)}
          >
            <div className="relative max-w-5xl max-h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
              <img
                src={resultImage}
                alt="Zoomed"
                className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 text-white hover:bg-white/20 h-10 w-10 rounded-full"
                onClick={() => setIsZoomed(false)}
              >
                <X className="h-6 w-6" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

