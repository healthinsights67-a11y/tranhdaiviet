
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Sparkles, RefreshCw, Image as ImageIcon, Key, Eye, EyeOff, Code, X, Maximize2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { simpleRender } from "../../services/geminiRenderService";
import DeepEditPage from "./DeepEditPage";

export default function AIRenderPage() {
  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [refImage, setRefImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [fusionPrompt, setFusionPrompt] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>('');
  const [showKey, setShowKey] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<string>("1:1");
  const [isZoomed, setIsZoomed] = useState(false);
  const [showDeepEdit, setShowDeepEdit] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) setApiKey(savedKey);
  }, []);

  const handleApiKeyChange = (val: string) => {
    setApiKey(val);
    localStorage.setItem('gemini_api_key', val);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'base' | 'ref') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (prev) => {
        if (type === 'base') setBaseImage(prev.target?.result as string);
        else setRefImage(prev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStartRender = async () => {
    if (!apiKey) {
      toast.error("Vui lòng nhập Gemini API Key");
      return;
    }
    if (!baseImage || !refImage) {
      toast.error("Vui lòng tải lên đủ 2 ảnh");
      return;
    }
    
    setIsProcessing(true);
    setFusionPrompt(null);
    setResultImage(null);

    try {
      const base64Base = baseImage.split(',')[1];
      const base64Ref = refImage.split(',')[1];
      
      toast.info("Đang bắt đầu hòa trộn không gian... (Có thể mất 20-30s)");

      // Thêm timeout 120s để xử lý các mô hình Image Gen chậm
      const renderPromise = simpleRender(apiKey, base64Base, base64Ref, undefined, aspectRatio);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Yêu cầu quá hạn (120s). Vui lòng thử lại.")), 120000)
      );

      const result = await Promise.race([renderPromise, timeoutPromise]) as any;
      
      setFusionPrompt(result.fusionPrompt);
      
      if (result.images && result.images.length > 0) {
        setResultImage(result.images[0]);
        toast.success("Hòa trộn không gian thành công!");
      } else {
        toast.warning("AI đã phân tích xong nhưng chưa trả về file ảnh. Vui lòng tải lại trang hoặc thử ảnh khác.");
      }
      
    } catch (error: any) {
      console.error("Render Error:", error);
      let errorMsg = error.message || "Đã xảy ra lỗi không xác định.";
      
      if (errorMsg.includes("429") || errorMsg.includes("quota")) {
        errorMsg = "API Gemini đang hết lượt dùng (Quota Exceeded). Vui lòng thử lại sau 1-5 phút hoặc dùng Key khác.";
      } else if (errorMsg.includes("403")) {
        errorMsg = "API Key không hợp lệ hoặc chưa kích hoạt dịch vụ Google AI SDK.";
      } else if (errorMsg.includes("fetch")) {
        errorMsg = "Lỗi kết nối mạng (CORS). Hãy chắc chắn bạn đang dùng Key API chính chủ.";
      } else if (errorMsg.includes("circular")) {
        errorMsg = "Lỗi dữ liệu (Circular structure). Vui lòng tải lại ảnh.";
      }
      
      toast.error(errorMsg, { duration: 5000 });
    } finally {
      setIsProcessing(false);
    }
  };

  if (showDeepEdit && resultImage) {
    return <DeepEditPage imageUrl={resultImage} onBack={() => setShowDeepEdit(false)} apiKey={apiKey} />;
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-black tracking-tighter uppercase">AI Interior Design v2</h1>
        <p className="text-muted-foreground">Phát triển lại từ đầu theo yêu cầu người dùng.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          {/* API Key Configuration */}
          <Card className="border-none shadow-sm bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold uppercase flex items-center gap-2">
                <Key className="h-4 w-4 text-primary" /> Cấu hình Gemini API
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Input 
                  type={showKey ? "text" : "password"}
                  placeholder="Nhập Gemini API Key của bạn..."
                  value={apiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  className="pr-10 h-10 rounded-xl bg-background border-primary/20 focus-visible:ring-primary/30"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-10 w-10 text-muted-foreground hover:bg-transparent"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground flex items-center justify-between px-1">
                <span>Lưu ý: API Key được lưu cục bộ trong trình duyệt của bạn.</span>
                <a 
                  href="https://aistudio.google.com/app/apikey" 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-primary hover:underline font-bold"
                >
                  Lấy API Key tại đây
                </a>
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 border-dashed relative group">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold uppercase flex items-center gap-2">
                <ImageIcon className="h-4 w-4" /> Không gian (Base)
              </CardTitle>
              {baseImage && (
                <Button 
                  variant="destructive" 
                  size="icon" 
                  className="h-7 w-7 rounded-full transition-all group-hover:scale-105"
                  onClick={() => setBaseImage(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-secondary/20 rounded-xl flex flex-col items-center justify-center relative overflow-hidden group">
                {baseImage ? (
                  <>
                    <img src={baseImage} className="absolute inset-0 w-full h-full object-contain" />
                    <div 
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                      onClick={() => document.getElementById('base-upload')?.click()}
                    >
                      <span className="text-white text-[10px] font-bold uppercase">Thay thế ảnh</span>
                    </div>
                  </>
                ) : (
                  <Label className="cursor-pointer flex flex-col items-center gap-2 w-full h-full justify-center">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <span className="text-xs font-medium">Tải lên ảnh phòng trống</span>
                    <Input id="base-upload" type="file" className="hidden" onChange={(e) => handleUpload(e, 'base')} />
                  </Label>
                )}
                {baseImage && <Input id="base-upload" type="file" className="hidden" onChange={(e) => handleUpload(e, 'base')} />}
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-dashed relative group">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold uppercase flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Mẫu tủ (Reference)
              </CardTitle>
              {refImage && (
                <Button 
                  variant="destructive" 
                  size="icon" 
                  className="h-7 w-7 rounded-full transition-all group-hover:scale-105"
                  onClick={() => setRefImage(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-secondary/20 rounded-xl flex flex-col items-center justify-center relative overflow-hidden group">
                {refImage ? (
                  <>
                    <img src={refImage} className="absolute inset-0 w-full h-full object-contain" />
                    <div 
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                      onClick={() => document.getElementById('ref-upload')?.click()}
                    >
                      <span className="text-white text-[10px] font-bold uppercase">Thay thế ảnh</span>
                    </div>
                  </>
                ) : (
                  <Label className="cursor-pointer flex flex-col items-center gap-2 w-full h-full justify-center">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <span className="text-xs font-medium">Tải lên mẫu thiết kế</span>
                    <Input id="ref-upload" type="file" className="hidden" onChange={(e) => handleUpload(e, 'ref')} />
                  </Label>
                )}
                {refImage && <Input id="ref-upload" type="file" className="hidden" onChange={(e) => handleUpload(e, 'ref')} />}
              </div>
            </CardContent>
          </Card>

          {/* Aspect Ratio Selection */}
          <div className="space-y-3">
            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Tỷ lệ khung hình</Label>
            <div className="grid grid-cols-4 gap-2">
              {["1:1", "4:3", "16:9", "9:16"].map((ratio) => (
                <Button
                  key={ratio}
                  variant={aspectRatio === ratio ? "default" : "outline"}
                  size="sm"
                  className="h-9 rounded-xl text-[10px] font-bold transition-all"
                  onClick={() => setAspectRatio(ratio)}
                >
                  {ratio}
                </Button>
              ))}
            </div>
          </div>

          <Button 
            className="w-full h-14 text-lg font-bold rounded-2xl shadow-xl shadow-primary/20"
            disabled={isProcessing}
            onClick={handleStartRender}
          >
            {isProcessing ? <RefreshCw className="h-5 w-5 animate-spin mr-2" /> : <Sparkles className="h-5 w-5 mr-2" />}
            BẮT ĐẦU PHÁT TRIỂN MỚI
          </Button>
        </div>

        <div className="space-y-6">
          <Card className="h-full min-h-[400px] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold uppercase">Kết quả Render</CardTitle>
              {resultImage && (
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 rounded-lg text-[10px] font-bold border-primary text-primary hover:bg-primary/5"
                    onClick={() => setShowDeepEdit(true)}
                  >
                    <Settings2 className="h-3 w-3 mr-1" /> CHỈNH SỬA CHUYÊN SÂU
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 rounded-lg text-[10px] font-bold"
                    onClick={() => setIsZoomed(true)}
                  >
                    <Maximize2 className="h-3 w-3 mr-1" /> PHÓNG TO
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="flex-1 flex items-center justify-center border-2 border-dashed m-6 rounded-2xl bg-secondary/5 overflow-hidden group relative">
              {resultImage ? (
                <div 
                  className="w-full h-full relative cursor-zoom-in"
                  onClick={() => setIsZoomed(true)}
                >
                  <img src={resultImage} className="w-full h-full object-contain rounded-xl transition-transform duration-500 group-hover:scale-[1.02]" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="bg-card text-card-foreground/90 p-2 rounded-full shadow-lg">
                      <Maximize2 className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-2 opacity-30">
                  <ImageIcon className="h-12 w-12 mx-auto" />
                  <p className="text-xs font-medium uppercase tracking-widest">Chưa có kết quả</p>
                </div>
              )}
            </CardContent>
          </Card>

          {fusionPrompt && (
            <Card className="border-none shadow-sm bg-secondary/5 overflow-hidden">
              <CardHeader className="py-2.5 px-4 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold flex items-center gap-2">
                  <Code className="h-3.5 w-3.5 text-primary" /> PHÂN TÍCH THIẾT KẾ (Fusion Prompt)
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="bg-black/5 p-4 rounded-xl">
                  <p className="text-[12px] leading-relaxed text-muted-foreground italic">
                    {fusionPrompt}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Lightbox Overlay */}
      <AnimatePresence>
        {isZoomed && resultImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 md:p-12 cursor-pointer"
            onClick={() => setIsZoomed(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative max-w-full max-h-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img 
                src={resultImage} 
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                alt="Zoomed design"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute -top-12 right-0 text-white hover:bg-card text-card-foreground/10 h-10 w-10"
                onClick={() => setIsZoomed(false)}
              >
                <X className="h-6 w-6" />
              </Button>
              
              <div className="absolute -bottom-12 left-0 right-0 text-center">
                <p className="text-white/60 text-xs font-bold tracking-widest uppercase">
                  Nhấn bất kỳ đâu để đóng
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
