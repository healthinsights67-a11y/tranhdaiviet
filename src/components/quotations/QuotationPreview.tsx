import * as React from 'react';
import { 
  X, 
  Printer, 
  Download, 
  Share2,
  Mail,
  Eye,
  FileText,
  CheckCircle2,
  Loader2,
  Pencil,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Quotation, Member } from '@/src/types';
import { format } from 'date-fns';
import { useReactToPrint } from 'react-to-print';
import { jsPDF } from 'jspdf';
import { toCanvas, toJpeg } from 'html-to-image';
import { toast } from 'sonner';
import { QuotationTemplate, defaultTemplate } from './QuotationTemplateConfig';
import { cn } from '@/src/lib/utils';
import { useQuery } from '@tanstack/react-query';

interface QuotationPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  quotation: Quotation;
  siblingQuotations?: Quotation[];
  onSwitchQuotation?: (quotation: Quotation) => void;
  onCreateNewVersion?: (quotation: Quotation) => void;
  member?: Member;
  user: any;
  onUpdateStatus?: (status: Quotation['status']) => void;
  onEdit?: () => void;
  onDeleteQuotation?: (id: string) => Promise<void>;
}

export function QuotationPreview({ 
  isOpen, 
  onClose, 
  quotation, 
  siblingQuotations = [], 
  onSwitchQuotation, 
  onCreateNewVersion, 
  member, 
  user, 
  onUpdateStatus, 
  onEdit,
  onDeleteQuotation
}: QuotationPreviewProps) {
  const printRef = React.useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = React.useState(false);
  const [template, setTemplate] = React.useState<QuotationTemplate>(defaultTemplate);
  const [customerCode, setCustomerCode] = React.useState<string>('KH000');
  const [quotationIndex, setQuotationIndex] = React.useState<number>(1);
  const [logoDataUrl, setLogoDataUrl] = React.useState<string>('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = React.useState<string>('');
  const [imagesLoading, setImagesLoading] = React.useState<boolean>(true);
  const [shareImageUrl, setShareImageUrl] = React.useState<string>('');
  const [isShareModalOpen, setIsShareModalOpen] = React.useState<boolean>(false);
  const [zoom, setZoom] = React.useState<number>(1);
  const [websiteQrCodeDataUrl, setWebsiteQrCodeDataUrl] = React.useState<string>('');
  
  const hasImageColumn = React.useMemo(() => {
    if (!quotation) return false;
    return quotation.type === 'ready-made';
  }, [quotation]);
  
  // Pinch to zoom state
  const touchStartRef = React.useRef<{ distance: number; zoom: number } | null>(null);
  const [isPinching, setIsPinching] = React.useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      setIsPinching(true);
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartRef.current = { distance: dist, zoom: zoom };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = dist / touchStartRef.current.distance;
      const newZoom = Math.min(2, Math.max(0.3, touchStartRef.current.zoom * scale));
      setZoom(newZoom);
    }
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
    setIsPinching(false);
  };

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 640) setZoom(0.45);
      else if (window.innerWidth < 768) setZoom(0.7);
      else if (window.innerWidth < 1024) setZoom(0.85);
      else setZoom(1);
    }
  }, [isOpen]);

  const { data: dbConfig } = useQuery<QuotationTemplate>({
    queryKey: ['quotation_template_config'],
    queryFn: async () => {
      const { db, doc, getDoc } = await import('@/src/lib/firebase');
      const docRef = doc(db, 'configs', 'quotation_template');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { ...defaultTemplate, ...docSnap.data() } as QuotationTemplate;
      }
      const saved = localStorage.getItem('quotation_template_config');
      if (saved && saved.trim() !== 'undefined' && saved.trim() !== 'null') {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') {
            return { ...defaultTemplate, ...parsed } as QuotationTemplate;
          }
        } catch (e) {
          console.error('Failed to parse saved config in preview', e);
        }
      }
      return defaultTemplate;
    },
    staleTime: Infinity,
    enabled: isOpen
  });

  React.useEffect(() => {
    if (dbConfig) {
      setTemplate(dbConfig);
    }
  }, [dbConfig, isOpen]);

  React.useEffect(() => {
    const fetchAsDataUrl = async (url: string, setter: (val: string) => void) => {
      if (!url) {
        setter('');
        return;
      }
      if (url.startsWith('data:')) {
        setter(url);
        return;
      }
      
      const toBase64 = async (fetchUrl: string) => {
        const response = await fetch(fetchUrl, { mode: 'cors', cache: 'no-cache' });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const blob = await response.blob();
        if (blob.type.includes('text/html')) throw new Error('Received HTML instead of image');
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      };

      try {
        const cacheBuster = url.includes('?') ? `&cb=${Date.now()}` : `?cb=${Date.now()}`;
        const dataUrl = await toBase64(url + cacheBuster);
        setter(dataUrl);
      } catch (e) {
        console.warn('Direct fetch failed. Trying allorigins proxy...', e);
        try {
          // Add cache-buster to allorigins too — Safari caches proxy responses without CORS headers
          // which causes subsequent exports to fail with a tainted canvas error
          const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}&cb=${Date.now()}`;
          const dataUrl = await toBase64(proxyUrl);
          setter(dataUrl);
        } catch (e2) {
          console.error('All proxies failed', e2);
          setter(url);
        }
      }
    };

    // Guard: only load images when dialog is open
    if (!isOpen) return;

    const loadImages = async () => {
      setImagesLoading(true);
      const promises = [];
      if (template.logoUrl) promises.push(fetchAsDataUrl(template.logoUrl, setLogoDataUrl));
      if (template.qrCodeUrl) promises.push(fetchAsDataUrl(template.qrCodeUrl, setQrCodeDataUrl));
      if (template.companyWebsite) {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(template.companyWebsite)}&margin=0`;
        promises.push(fetchAsDataUrl(qrUrl, setWebsiteQrCodeDataUrl));
      }
      await Promise.allSettled(promises);
      setImagesLoading(false);
    };

    loadImages();
  }, [template.logoUrl, template.qrCodeUrl, template.companyWebsite, isOpen]);

  React.useEffect(() => {
    if (isOpen && quotation.customerId) {
      const fetchCustomerAndIndex = async () => {
        try {
          const { doc, getDoc, collection, getDocs, query, where, db } = await import('@/src/lib/firebase');
          
          // Get customer code
          const customerSnap = await getDoc(doc(db, 'customers', quotation.customerId));
          let resolvedCode = 'KH000';
          if (customerSnap.exists()) {
            const custData = customerSnap.data();
            if (custData.code) {
              const codePart = custData.code.split('_')[0];
              resolvedCode = codePart || 'KH000';
            }
          }
          setCustomerCode(resolvedCode);

          // Get quotation count index for this customer
          const q = query(collection(db, 'quotations'), where('customerId', '==', quotation.customerId));
          const snap = await getDocs(q);
          const allQuots = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
          
          // Sort by date or createdAt ascending
          allQuots.sort((a, b) => new Date(a.createdAt || a.date).getTime() - new Date(b.createdAt || b.date).getTime());
          
          const index = allQuots.findIndex(q => q.id === quotation.id);
          setQuotationIndex(index !== -1 ? index + 1 : allQuots.length + 1);
        } catch (error) {
          console.error('Error fetching customer code/index:', error);
        }
      };
      
      fetchCustomerAndIndex();
    }
  }, [isOpen, quotation.customerId, quotation.id]);

  const removeVietnameseAccents = (str: string) => {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
  };

  const getFileName = () => {
    const customerNameNoAccents = removeVietnameseAccents(quotation.customerName || 'Khach_Hang');
    return `Bao_Gia_${customerCode}_${customerNameNoAccents}_So_${quotationIndex}`;
  };

  const isIframe = () => {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  };

  // Reliable, high-fidelity printing utilizing react-to-print
  const triggerPrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: getFileName(),
    onAfterPrint: () => {
      toast.success('Bắt đầu tiến trình in.');
    },
    onPrintError: (error) => {
      console.error(error);
      toast.error('Có lỗi xảy ra khi in báo giá. Nếu trình duyệt chặn popup, hãy cho phép và thử lại.');
    }
  });

  const handlePrint = () => {
    if (isIframe()) {
      toast.info('Lưu ý: Môi trường xem trước có thể chặn lệnh in trực tiếp. Nếu không thấy gì, hãy thử nút "Tải PDF" hoặc mở ứng dụng trong tab mới.');
    }
    triggerPrint();
  };

  const handleDownloadPDF = async () => {
    const element = printRef.current;
    if (!element) return;

    try {
      setIsExporting(true);
      toast.info("Đang tạo file PDF...");

      // 1. Save original styles and classes
      const originalClassName = element.className;
      const originalStyleTransform = element.style.transform;

      // 2. Temporarily reset styles to allow full height rendering
      element.className = "bg-white text-black p-[10mm] w-[210mm] relative overflow-visible";
      element.style.transform = "none";

      // Allow Safari DOM to recalculate layout before cloning
      await new Promise(resolve => setTimeout(resolve, 150));

      // 3. Render canvas with high resolution, capturing full height
      const canvas = await toCanvas(element, {
        pixelRatio: 1.5, // Reduced to prevent iOS Safari memory crashes on long invoices
        backgroundColor: '#ffffff',
      });

      // 4. Restore original styles immediately
      element.className = originalClassName;
      element.style.transform = originalStyleTransform;

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      
      const pdfWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      // Calculate how high the entire image will be in the PDF
      let pdfImageWidth = pdfWidth;
      let pdfImageHeight = (imgHeight * pdfWidth) / imgWidth;

      // Ensure it fits exactly on 1 page by scaling down if needed
      if (pdfImageHeight > pageHeight) {
        const ratio = pageHeight / pdfImageHeight;
        pdfImageHeight = pageHeight;
        pdfImageWidth = pdfWidth * ratio;
      }

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Center horizontally if it was scaled down
      const xOffset = (pdfWidth - pdfImageWidth) / 2;

      pdf.addImage(imgData, 'JPEG', xOffset, 0, pdfImageWidth, pdfImageHeight);

      pdf.save(`${getFileName()}.pdf`);
      
      toast.success("Đã tải xuống PDF thành công");
    } catch (error) {
      console.error('PDF Export Error:', error);
      toast.error("Lỗi khi tạo PDF. Bạn có thể sử dụng nút 'In' và chọn 'Lưu thành PDF'.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = async () => {
    const element = printRef.current;
    if (!element) return;

    let originalClassName = element.className;
    let originalStyleTransform = element.style.transform;
    let stylesReset = false;

    try {
      setIsExporting(true);
      toast.info("Đang khởi tạo tệp ảnh báo giá...");

      // 1. Save original styles and classes
      originalClassName = element.className;
      originalStyleTransform = element.style.transform;

      // 2. Temporarily reset styles to allow full height rendering
      element.className = "bg-white text-black p-[10mm] w-[210mm] relative overflow-visible";
      element.style.transform = "none";
      stylesReset = true;

      // Allow Safari DOM to recalculate layout before cloning
      await new Promise(resolve => setTimeout(resolve, 150));

      // 3. Inject preloaded base64 data URLs directly into img elements
      // This prevents html-to-image from re-fetching images from external URLs
      // which iOS Safari CORS blocks, causing logos to disappear in exported images
      const imgElements = element.querySelectorAll('img');
      const imgOriginalSrcs: string[] = [];
      imgElements.forEach((img) => {
        imgOriginalSrcs.push(img.src);
        if (img.src && !img.src.startsWith('data:')) {
          if (logoDataUrl && (img.src.includes(template.logoUrl || '__NO_MATCH__') || img.getAttribute('alt') === 'Logo' || img.getAttribute('alt') === 'Watermark')) {
            img.src = logoDataUrl;
          } else if (qrCodeDataUrl && img.getAttribute('alt') === 'QR Code') {
            img.src = qrCodeDataUrl;
          } else if (websiteQrCodeDataUrl && img.getAttribute('alt') === 'Website QR Code') {
            img.src = websiteQrCodeDataUrl;
          }
        }
      });

      // 4. Render image directly to Data URL
      const dataUrl = await toJpeg(element, {
        pixelRatio: 1.5,
        backgroundColor: '#ffffff',
        quality: 1.0,
        skipFonts: false,
        includeQueryParams: true,
      });

      // 5. Restore original img srcs
      imgElements.forEach((img, i) => {
        img.src = imgOriginalSrcs[i];
      });

      // 6. Restore original styles immediately
      element.className = originalClassName;
      element.style.transform = originalStyleTransform;
      stylesReset = false;
      
      if (!dataUrl || !dataUrl.startsWith('data:')) {
        throw new Error('Không thể tạo dữ liệu ảnh từ nội dung.');
      }
      
      try {
        const arr = dataUrl.split(',');
        if (arr.length < 2) {
          throw new Error('Dữ liệu ảnh canvas không đúng định dạng.');
        }

        const mimeMatch = arr[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });

        if (!blob) {
          throw new Error("Không thể tạo tệp ảnh blob từ canvas.");
        }

        const file = new File([blob], `${getFileName()}.jpg`, { type: 'image/jpeg' });

        // Wrap in try-catch to protect against browser canShare quirks in WebView / Zalo
        let canShareFiles = false;
        try {
          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            canShareFiles = true;
          }
        } catch (shareCheckError) {
          console.warn('Browser threw error when checking navigator.canShare:', shareCheckError);
        }

        if (canShareFiles) {
          try {
            await navigator.share({
              files: [file],
              title: `Báo giá ${getFileName()}`,
              text: `Gửi anh/chị báo giá chi tiết từ I NỘI THẤT cho công trình ${quotation.constructionType || ''}.`,
            });
            toast.success("Chia sẻ báo giá thành công!");
          } catch (err: any) {
            if (err.name !== 'AbortError') {
              console.error('Error sharing file:', err);
              fallbackShare(dataUrl);
            }
          }
        } else {
          fallbackShare(dataUrl);
        }
      } catch (fileError: any) {
        console.warn('File constructor or blob generation failed, using fallback mode:', fileError);
        fallbackShare(dataUrl);
      }
      setIsExporting(false);

    } catch (error: any) {
      console.error('Share Error:', error);
      // Restore styles if they were reset and not yet restored
      if (stylesReset) {
        element.className = originalClassName;
        element.style.transform = originalStyleTransform;
      }
      toast.error(`Gặp lỗi trong quá trình chia sẻ báo giá: ${error?.message || error?.toString() || 'Lỗi hệ thống'}`);
      setIsExporting(false);
    }
  };

  const fallbackShare = (customDataUrl?: string) => {
    const triggerFallbackWithData = (dataUrl: string) => {
      setShareImageUrl(dataUrl);
      setIsShareModalOpen(true);
      
      // Also try to download automatically for standard browsers
      try {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `${getFileName()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Đã chuẩn bị ảnh gửi qua Zalo! Nếu ảnh chưa được tải về máy, vui lòng chạm giữ ảnh phía dưới để lưu.");
      } catch (err) {
        console.warn("Auto-download failed:", err);
      }
    };

    if (customDataUrl) {
      triggerFallbackWithData(customDataUrl);
      return;
    }

    toast.info("Đang chuẩn bị ảnh báo giá...");
    const element = printRef.current;
    if (!element) return;
    
    // 1. Save original styles and classes
    const originalClassName = element.className;
    const originalStyleTransform = element.style.transform;

    // 2. Temporarily reset styles to allow full height rendering
    element.className = "bg-white text-black p-[10mm] w-[210mm] relative overflow-visible";
    element.style.transform = "none";

    // Allow Safari DOM to recalculate
    setTimeout(async () => {
      // Inject preloaded base64 data URLs to prevent iOS CORS re-fetch
      const imgElements = element.querySelectorAll('img');
      const imgOriginalSrcs: string[] = [];
      imgElements.forEach((img) => {
        imgOriginalSrcs.push(img.src);
        if (img.src && !img.src.startsWith('data:')) {
          if (logoDataUrl && (img.getAttribute('alt') === 'Logo' || img.getAttribute('alt') === 'Watermark')) {
            img.src = logoDataUrl;
          } else if (qrCodeDataUrl && img.getAttribute('alt') === 'QR Code') {
            img.src = qrCodeDataUrl;
          } else if (websiteQrCodeDataUrl && img.getAttribute('alt') === 'Website QR Code') {
            img.src = websiteQrCodeDataUrl;
          }
        }
      });

      try {
        const dataUrl = await toJpeg(element, { 
          pixelRatio: 1.5, 
          backgroundColor: '#ffffff',
          quality: 1.0,
          skipFonts: false,
          includeQueryParams: true,
        });
        // Restore img srcs and styles
        imgElements.forEach((img, i) => { img.src = imgOriginalSrcs[i]; });
        element.className = originalClassName;
        element.style.transform = originalStyleTransform;
        triggerFallbackWithData(dataUrl);
      } catch (err) {
        console.error(err);
        imgElements.forEach((img, i) => { img.src = imgOriginalSrcs[i]; });
        element.className = originalClassName;
        element.style.transform = originalStyleTransform;
        toast.error("Không thể tạo ảnh báo giá. Vui lòng thử lại hoặc dùng nút Tải PDF.");
      }
    }, 150);
  };

  const handleAccept = () => {
    if (onUpdateStatus) {
      onUpdateStatus('accepted');
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] lg:max-w-6xl h-[95vh] flex flex-col p-0 overflow-hidden bg-card text-card-foreground border border-gray-200 shadow-2xl">
        <DialogHeader className="p-3 md:p-6 border-b bg-gray-50 flex flex-col xl:flex-row items-start xl:items-center justify-between shrink-0 gap-3 xl:gap-0">
          <div className="flex items-start md:items-center gap-2 md:gap-3 flex-wrap w-full xl:w-auto">
            <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg md:rounded-xl bg-blue-50 flex items-center justify-center text-primary shrink-0">
              <Eye className="h-4 w-4 md:h-6 md:w-6" />
            </div>
            <div className="flex flex-col">
              <DialogTitle className="text-sm md:text-xl font-bold">Xem trước báo giá</DialogTitle>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                <span className="text-[8px] md:text-[10px] font-bold text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wider">{quotation.quotationNumber}</span>
                {quotation.status === 'accepted' && (
                  <Badge className="bg-emerald-500 hover:bg-emerald-600 text-[8px] md:text-[9px] h-3.5 md:h-4">Hoàn Thành</Badge>
                )}
                {quotation.status === 'deposit' && (
                  <Badge className="bg-purple-500 hover:bg-purple-600 text-[8px] md:text-[9px] h-3.5 md:h-4">Đã cọc</Badge>
                )}
                
                {siblingQuotations && siblingQuotations.length > 0 && (
                  <div className="flex items-center gap-1.5 ml-2 border-l pl-2 border-slate-200">
                    <span className="text-[9px] text-slate-500 font-black uppercase mr-1">Bản:</span>
                    {siblingQuotations.map((sibling, idx) => {
                      const isActive = sibling.id === quotation.id;
                      return (
                        <div key={sibling.id} className="inline-flex items-stretch rounded-md overflow-hidden border border-slate-200 shadow-sm">
                          <button
                            type="button"
                            onClick={() => onSwitchQuotation && onSwitchQuotation(sibling)}
                            className={cn(
                              "px-2 py-0.5 text-[9.5px] font-black cursor-pointer transition-all border-none rounded-none flex items-center",
                              isActive 
                                ? "bg-primary text-primary-foreground" 
                                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                            )}
                          >
                            Lần {idx + 1}
                          </button>
                          {onDeleteQuotation && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteQuotation(sibling.id);
                              }}
                              className={cn(
                                "px-1.5 py-0.5 text-[9.5px] font-bold cursor-pointer transition-all border-none rounded-none border-l flex items-center justify-center",
                                isActive 
                                  ? "bg-primary text-primary-foreground/80 hover:bg-red-600 hover:text-white border-primary-foreground/20" 
                                  : "bg-slate-50 text-slate-400 border-slate-200 hover:bg-red-50 hover:text-red-600"
                              )}
                              title={`Xóa Lần ${idx + 1}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {onCreateNewVersion && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onCreateNewVersion(quotation);
                        }}
                        className="px-2 py-0.5 text-[9.5px] font-black rounded-md cursor-pointer bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-all flex items-center"
                        title="Tạo bản báo giá mới (Lần tiếp theo) dựa trên bản này"
                      >
                        + Bản Mới
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 md:gap-2 w-full xl:w-auto pb-1 md:pb-0">
            <Button variant="outline" size="sm" onClick={onEdit} className="h-8 md:h-10 px-2 md:px-4 gap-1 md:gap-2 font-bold border-2 text-blue-600 border-blue-100 hover:bg-blue-50 text-[10px] md:text-sm">
              <Pencil className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Chỉnh sửa</span>
              <span className="sm:hidden">Sửa</span>
            </Button>
            
            <div className="flex items-center mx-1 border-2 border-gray-100 rounded-md overflow-hidden bg-white">
               <button type="button" onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} className="h-8 md:h-10 px-2 md:px-3 text-gray-500 hover:bg-gray-100 transition-colors" title="Thu nhỏ">
                  <ZoomOut className="h-4 w-4" />
               </button>
               <div className="w-8 md:w-12 text-center text-[10px] md:text-xs font-bold text-gray-700 bg-gray-50 h-8 md:h-10 flex items-center justify-center border-x border-gray-100">
                  {Math.round(zoom * 100)}%
               </div>
               <button type="button" onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="h-8 md:h-10 px-2 md:px-3 text-gray-500 hover:bg-gray-100 transition-colors" title="Phóng to">
                  <ZoomIn className="h-4 w-4" />
               </button>
            </div>

            <Button 
               variant="outline" 
               size="sm" 
               onClick={handleShare}
               disabled={isExporting || imagesLoading}
               className="h-8 md:h-10 px-2 md:px-4 gap-1 md:gap-2 font-bold border-2 border-emerald-100 hover:bg-emerald-50 text-emerald-600 text-[10px] md:text-sm"
            >
              {isExporting || imagesLoading ? (
                <Loader2 className="h-3.5 w-3.5 md:h-4 md:w-4 animate-spin" />
              ) : (
                <Share2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
              )}
              <span className="hidden sm:inline">Chia sẻ</span>
              <span className="sm:hidden">Gửi</span>
            </Button>

            <Button variant="outline" size="sm" onClick={handlePrint} disabled={imagesLoading} className="h-8 md:h-10 px-2 md:px-4 gap-1 md:gap-2 font-bold border-2 text-[10px] md:text-sm">
              <Printer className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="hidden sm:inline">In báo giá</span>
              <span className="sm:hidden">In</span>
            </Button>
            <Button 
               variant="default" 
               size="sm" 
               onClick={handleDownloadPDF}
               disabled={isExporting || imagesLoading}
               className="h-8 md:h-10 px-2 md:px-4 gap-1 md:gap-2 font-bold shadow-sm text-[10px] md:text-sm"
            >
              {isExporting || imagesLoading ? (
                <Loader2 className="h-3.5 w-3.5 md:h-4 md:w-4 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5 md:h-4 md:w-4" />
              )}
              {isExporting ? 'Đang tạo...' : (imagesLoading ? 'Đang tải...' : 'Tải PDF')}
            </Button>
          </div>
        </DialogHeader>

        <div 
          className="flex-1 bg-gray-100 overflow-auto custom-scrollbar flex justify-center items-start p-4"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ touchAction: 'pan-x pan-y' }}
        >
          <div className="p-2 md:p-8 w-full min-w-max flex justify-center h-fit">
            <div 
              className={cn("origin-top", !isPinching && "transition-transform")}
              style={{ transform: `scale(${zoom})` }}
            >
              <div 
                ref={printRef}
                className="bg-white text-black shadow-2xl p-[10mm] min-h-[297mm] w-[210mm] ring-1 ring-gray-200 relative overflow-visible print:shadow-none print:p-0 print:m-0"
                style={{ width: '210mm', minHeight: '297mm', padding: '10mm', background: '#ffffff', color: '#000000' }}
              >
              {/* Background Texture Element */}
              <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none print:hidden z-0">
                  {logoDataUrl || template.logoUrl ? (
                    <img src={logoDataUrl || template.logoUrl} className="w-[70%] max-w-[500px] object-contain grayscale" alt="Watermark" />
                  ) : (
                    <div className="text-8xl font-black rotate-[-45deg] tracking-widest uppercase">{template.companyName}</div>
                  )}
              </div>

            <div className="text-black font-serif text-[12px] leading-snug relative z-10 w-full">
              {/* Header Table */}
              <table className="w-full border-collapse border-2 border-black mb-1 table-fixed">
                <tbody>
                  <tr>
                    <td rowSpan={2} className="w-[30%] p-2 text-center align-middle border-r-2 border-black">
                       <div className="flex flex-col items-center justify-center h-[80px]">
                          {template.logoUrl ? (
                            <img src={logoDataUrl || template.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" style={{ height: '80px', width: 'auto', maxWidth: '100%', objectFit: 'contain' }} />
                          ) : (
                            <>
                              <div className="flex items-baseline leading-none">
                                 <span className="text-3xl font-black tracking-tighter" style={{ color: '#BE1E2D', fontFamily: 'Inter, sans-serif' }}>I</span>
                                 <span className="text-4xl font-black mx-1" style={{ color: '#FBB03B', fontFamily: 'Inter, sans-serif' }}>NỘI</span>
                                 <span className="text-3xl font-black tracking-tighter" style={{ color: '#BE1E2D', fontFamily: 'Inter, sans-serif' }}>THẤT</span>
                              </div>
                              <div className="text-[8px] font-black uppercase tracking-[0.2em] mt-1 text-black whitespace-nowrap">
                                 Kiến tạo không gian Việt
                              </div>
                            </>
                          )}
                       </div>
                    </td>
                    <td className="p-2 text-center border-r-2 border-black">
                      <div className="text-xl font-bold tracking-tight text-black uppercase">
                        {template.companyName}
                      </div>
                      <div className="mt-0.5 space-y-0 text-[10px] text-gray-600 font-bold">
                        <p>{template.companyAddress}</p>
                        <p>Web: {template.companyWebsite} — Điện thoại: {template.companyPhone} — Email: {template.companyEmail}</p>
                      </div>
                    </td>
                    <td rowSpan={2} className="w-20 p-1 text-center align-middle">
                      {template.qrCodeUrl ? (
                         <div className="w-16 h-16 flex items-center justify-center mx-auto">
                            <img src={qrCodeDataUrl || template.qrCodeUrl} className="max-h-full max-w-full object-contain" alt="QR Code" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                         </div>
                      ) : (
                        <div className="w-16 h-16 border border-dashed border-gray-300 flex items-center justify-center text-[6px] text-gray-400 font-bold uppercase tracking-tighter mx-auto">QR CODE</div>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2 text-center border-t-2 border-r-2 border-black">
                       <div className="flex flex-col items-center">
                          <div className="text-2xl font-bold tracking-[0.2em] text-black uppercase">
                             {quotation.type === 'ready-made' ? 'BÁO GIÁ SẢN PHẨM' : 'BÁO GIÁ THI CÔNG'}
                          </div>
                          <div className="mt-1 flex items-center gap-3">
                             <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">HỒ SƠ SỐ:</span>
                             <span className="text-lg font-mono font-bold text-black">{quotation.quotationNumber.split('-')[1]}</span>
                          </div>
                       </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="p-1 px-2 italic text-[10px] text-gray-600 mb-2 font-medium">
                Kính gửi: {template.companyName.toUpperCase()} xin cảm ơn {quotation.customerName || 'Quý khách hàng'} đã quan tâm tới sản phẩm của công ty. Chúng tôi xin gửi {quotation.type === 'ready-made' ? 'báo giá sản phẩm' : 'báo giá thi công thực tế'} như sau:
              </div>

              {/* Customer Information Grid Style */}
              <table className="w-full border-2 border-black mb-3 text-[11px] table-fixed">
                <tbody>
                  <tr className="border-b border-black">
                    <td className="p-1.5 border-r border-black font-bold bg-gray-50 uppercase text-[9px] tracking-wider w-[15%]">Khách hàng</td>
                    <td className="p-1.5 border-r border-black font-bold text-base w-[40%] text-blue-700">{quotation.customerName}</td>
                    <td className="p-1.5 border-r border-black font-bold bg-gray-50 uppercase text-[9px] tracking-wider w-[15%]">Điện thoại</td>
                    <td className="p-1.5 font-mono font-bold text-base">{quotation.phone}</td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="p-1.5 border-r border-black font-bold bg-gray-50 uppercase text-[9px] tracking-wider">Công trình</td>
                    <td className="p-1.5 border-r border-black font-bold lowercase first-letter:uppercase">{quotation.constructionType || 'Nhà ở dân dụng'}</td>
                    <td className="p-1.5 border-r border-black font-bold bg-gray-50 uppercase text-[9px] tracking-wider">Địa chỉ</td>
                    <td className="p-1.5 font-bold">{quotation.address}</td>
                  </tr>
                  <tr className="bg-gray-100">
                    {quotation.type === 'ready-made' ? (
                      <td colSpan={2} className="p-1.5 border-r border-black font-bold uppercase text-[9px] tracking-wider text-center text-blue-700">Đơn hàng đóng sẵn</td>
                    ) : (
                      <>
                        <td className="p-1.5 border-r border-black font-bold uppercase text-[9px] tracking-wider">Thời gian</td>
                        <td className="p-1.5 border-r border-black font-bold">{quotation.estimatedTime} ngày làm việc</td>
                      </>
                    )}
                    <td className="p-1.5 border-r border-black font-bold uppercase text-[9px] tracking-wider">Ngày báo giá</td>
                    <td className="p-1.5 font-bold">{format(new Date(quotation.date), 'dd/MM/yyyy')}</td>
                  </tr>
                </tbody>
              </table>

              <div className="bg-black text-white text-center font-bold text-xs py-1.5 uppercase tracking-[0.3em] mb-0 border-x-2 border-t-2 border-black">
                 {quotation.type === 'ready-made' ? 'CHI TIẾT DANH SÁCH SẢN PHẨM' : 'CHI TIẾT HẠNG MỤC THI CÔNG'}
              </div>
              <table className="w-full border-2 border-black text-[11px] table-fixed">
                <thead>
                  <tr className="bg-gray-100 font-bold uppercase text-[8px] tracking-widest border-b-2 border-black text-black">
                    <th className="border-r border-black p-1 w-[35px]">STT</th>
                    <th className="border-r border-black p-1 w-[130px]">Tên hạng mục</th>
                    {hasImageColumn && (
                      <th className="border-r border-black p-1 w-[80px]">Hình ảnh</th>
                    )}
                    <th className="border-r border-black p-1">QC kỹ thuật / Diễn giải</th>
                    <th className="border-r border-black p-1 w-[40px]">ĐVT</th>
                    <th className="border-r border-black p-1 w-[40px]">SL</th>
                    <th className="border-r border-black p-1 w-[90px]">Đơn giá</th>
                    <th className="border-black p-1 w-[100px]">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(new Set(quotation.items.map(item => item.category))).map((cat, groupIdx) => (
                    <React.Fragment key={cat}>
                      <tr className="bg-gray-200 font-bold border-b border-black">
                        <td className="border-r border-black p-1 text-center">{String.fromCharCode(65 + groupIdx)}</td>
                        <td colSpan={hasImageColumn ? 7 : 6} className="p-1 px-2 uppercase tracking-[0.2em] text-[10px]">
                          {cat}
                        </td>
                      </tr>
                      {quotation.items.filter(item => item.category === cat).map((item, idx) => (
                        <tr key={item.id} className="border-b border-black last:border-b-0">
                          <td className="border-r border-black p-1 text-center text-gray-500 font-bold">{idx + 1}</td>
                          <td className="border-r border-black p-1.5 font-bold text-black leading-tight">{item.name}</td>
                          {hasImageColumn && (
                            <td className="border-r border-black p-1 text-center">
                              {item.imageUrl ? (
                                <img src={item.imageUrl} alt={item.name} className="w-full max-w-[70px] mx-auto h-auto object-contain rounded" style={{ maxHeight: '70px' }} referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-[60px] h-[60px] mx-auto bg-gray-100 flex items-center justify-center text-[8px] text-gray-400 rounded">Không có ảnh</div>
                              )}
                            </td>
                          )}
                          <td className="border-r border-black p-1.5 text-gray-700 leading-normal text-[10.5px]">
                            <div className="whitespace-pre-wrap">{item.description}</div>
                          </td>
                          <td className="border-r border-black p-1 text-center font-bold text-gray-500 text-[9px]">{item.unit}</td>
                          <td className="border-r border-black p-1 text-center font-bold">{item.quantity}</td>
                          <td className="border-r border-black p-1.5 text-right font-mono text-gray-600">{item.unitPrice.toLocaleString()}</td>
                          <td className="p-1.5 text-right font-mono font-bold bg-gray-50">{item.total.toLocaleString()}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-black">
                    <td colSpan={hasImageColumn ? 7 : 6} className="p-2 text-right font-bold uppercase tracking-wider text-gray-500 border-r border-black text-[9px]">Cộng tiền hàng</td>
                    <td className="p-2 text-right font-mono font-bold">
                      {quotation.subTotal.toLocaleString()}
                    </td>
                  </tr>
                  <tr className="bg-gray-50 border-t border-black">
                    <td colSpan={hasImageColumn ? 7 : 6} className="p-2 text-right font-bold uppercase tracking-wider text-gray-500 border-r border-black text-[9px]">Giảm giá & Chiết khấu</td>
                    <td className="p-2 text-right font-mono font-bold text-red-600">
                      -{quotation.discount.toLocaleString()}
                    </td>
                  </tr>
                  {quotation.hasVat && (
                    <tr className="bg-gray-50 border-t border-black">
                      <td colSpan={hasImageColumn ? 7 : 6} className="p-2 text-right font-bold uppercase tracking-wider text-gray-500 border-r border-black text-[9px]">Thuế VAT (8%)</td>
                      <td className="p-2 text-right font-mono font-bold">
                        {(quotation.vatAmount || Math.round((quotation.subTotal - quotation.discount) * 0.08)).toLocaleString()}
                      </td>
                    </tr>
                  )}
                  <tr className="bg-gray-100 border-t-2 border-black">
                    <td colSpan={hasImageColumn ? 7 : 6} className="p-2 text-right text-[11px] font-bold uppercase tracking-[0.2em] text-black border-r border-black">
                       TỔNG GIÁ TRỊ BÁO GIÁ {quotation.hasVat ? '(ĐÃ BAO GỒM VAT 8%)' : '(CHƯA BAO GỒM THUẾ)'}
                    </td>
                    <td className="p-2 pr-3 text-right font-mono text-[14px] font-bold text-gray-950">
                      {quotation.totalAmount.toLocaleString()}
                    </td>
                  </tr>
                  {(quotation.depositAmount ?? 0) > 0 && (
                    <>
                      <tr className="bg-gray-50 border-t border-black">
                        <td colSpan={hasImageColumn ? 7 : 6} className="p-2 text-right font-bold uppercase tracking-wider text-gray-500 border-r border-black text-[9px]">Đã đặt cọc</td>
                        <td className="p-2 pr-3 text-right font-mono font-bold text-emerald-600">
                          -{(quotation.depositAmount || 0).toLocaleString()}
                        </td>
                      </tr>
                      <tr className="bg-emerald-50 border-t-2 border-emerald-200">
                        <td colSpan={hasImageColumn ? 7 : 6} className="p-2 text-right text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700 border-r border-emerald-200">
                           SỐ TIỀN CÒN LẠI CẦN THANH TOÁN
                        </td>
                        <td className="p-2 pr-3 text-right font-mono text-[14px] font-bold text-emerald-700">
                          {((quotation.totalAmount || 0) - (quotation.depositAmount || 0)).toLocaleString()}
                        </td>
                      </tr>
                    </>
                  )}
                </tfoot>
              </table>

              {/* Policy & Payment Section */}
              <div className="mt-4 grid grid-cols-2 gap-4 items-start">
                 <div className="space-y-2">
                    <div className="flex items-center gap-2 font-bold text-black uppercase tracking-widest text-[10px] border-b border-black pb-1">
                       CHÍNH SÁCH VÀ GHI CHÚ
                    </div>
                    <div className="text-[10px] text-black whitespace-pre-line leading-relaxed pl-1 pt-1 font-medium">
                       {template.terms || 'Chưa có điều khoản'}
                    </div>
                 </div>
                 <div className="space-y-2">
                    <div className="flex items-center gap-2 font-bold text-black uppercase tracking-widest text-[10px] border-b border-black pb-1">
                       THANH TOÁN CHUYỂN KHOẢN
                    </div>
                    <div className="bg-gray-50 p-2 rounded-sm border border-gray-200 space-y-1 text-[10px] relative">
                       <div className="flex justify-between items-center relative z-10 w-2/3">
                          <span className="text-gray-500 font-bold uppercase text-[8px]">Ngân hàng</span>
                          <span className="font-bold text-black text-right">{template.bankName || quotation.paymentInfo.bankName}</span>
                       </div>
                       <div className="flex justify-between items-center relative z-10 w-2/3">
                          <span className="text-gray-500 font-bold uppercase text-[8px]">Số tài khoản</span>
                          <span className="font-mono font-bold text-sm tracking-tighter text-primary text-right">{template.bankAccount || quotation.paymentInfo.accountNumber}</span>
                       </div>
                       <div className="flex justify-between items-center relative z-10 w-2/3">
                          <span className="text-gray-500 font-bold uppercase text-[8px]">Chủ tài khoản</span>
                          <span className="font-bold text-black uppercase tracking-tight text-right">{template.bankAccountName || quotation.paymentInfo.accountHolder}</span>
                       </div>
                       {template.qrCodeUrl && (
                         <div className="absolute right-2 top-2 bottom-2 w-16 bg-white border border-gray-200 p-0.5 z-20 flex items-center justify-center">
                            <img src={qrCodeDataUrl || template.qrCodeUrl} alt="QR Code" className="max-h-full max-w-full object-contain" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                         </div>
                       )}
                    </div>
                    <p className="text-[9px] italic text-gray-500 font-medium leading-tight">Nội dung ghi: <span className="font-bold text-black uppercase tracking-tighter">"{quotation.paymentInfo.content}"</span></p>
                 </div>
              </div>

              <div className="mt-6 text-center opacity-70">
                 <div className="font-serif italic text-lg px-20 text-gray-400 leading-tight">
                   <p>"{template.companyName.toUpperCase()}</p>
                   <p>Kiến tạo không gian, nâng tầm cuộc sống"</p>
                 </div>
              </div>

              {/* Signature Section */}
              <div className="mt-4 flex justify-between px-10">
                 <div className="text-center space-y-1 w-1/3">
                    <p className="text-[9px] font-bold uppercase text-gray-400 tracking-wider">Khách hàng xác nhận</p>
                    <p className="text-sm font-bold text-black">KÝ VÀ GHI HỌ TÊN</p>
                    <div className="h-16" />
                    <p className="text-[9px] font-medium text-gray-500 italic pb-2 border-b border-gray-100 items-center justify-center flex gap-1">
                      <Download className="h-3 w-3" /> Ngày ...... / ...... / 202...
                    </p>
                 </div>
                 
                 {template.companyWebsite ? (
                   <div className="w-1/3 flex flex-col items-center justify-center pt-2">
                     {websiteQrCodeDataUrl ? (
                       <img src={websiteQrCodeDataUrl} alt="Website QR Code" className="w-16 h-16 object-contain mix-blend-multiply opacity-80" />
                     ) : (
                       <div className="w-16 h-16 border border-dashed border-gray-300 flex items-center justify-center text-[6px] text-gray-400">QR CODE</div>
                     )}
                     <span className="text-[6px] uppercase tracking-widest text-gray-400 mt-1 font-bold">Truy cập Website</span>
                   </div>
                 ) : (
                   <div className="w-1/3" />
                 )}

                 <div className="text-center space-y-1 w-1/3">
                    <p className="text-[9px] font-bold uppercase text-gray-400 tracking-wider">Đại diện Công ty</p>
                    <p className="text-sm font-bold text-black uppercase">NGƯỜI LẬP BIỂU</p>
                    <div className="h-16 flex items-center justify-center relative">
                    </div>
                    <p className="font-bold text-gray-950 text-sm border-t border-gray-200 pt-1 px-4">
                       {member?.name || (quotation.createdBy === user?.uid ? user?.displayName : 'BAN QUẢN TRỊ')}
                    </p>
                 </div>
              </div>

              {/* System Footer */}
              <div className="mt-8 pt-4 flex flex-col items-center justify-center text-center">
                <p className="text-[7.5px] text-gray-300 font-mono tracking-[0.5em] uppercase italic">Hệ thống quản lý {template.companyName.toUpperCase()} — Mã hồ sơ: {quotation.id.slice(0, 10).toUpperCase()}</p>
              </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
    </Dialog>

    {/* Fallback Share Dialog */}
    <Dialog open={isShareModalOpen} onOpenChange={setIsShareModalOpen}>
      <DialogContent className="max-w-md w-[90vw] rounded-2xl p-4 bg-card text-card-foreground border border-gray-200 shadow-xl flex flex-col items-center">
        <DialogHeader className="w-full text-center pb-2 border-b">
          <DialogTitle className="text-base font-bold text-center w-full">Gửi Báo Giá</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 my-4 w-full">
          <p className="text-xs text-center text-slate-500 font-medium px-2">
            Trình duyệt không hỗ trợ chia sẻ tự động. <br />
            <strong className="text-primary">Chạm giữ vào ảnh bên dưới</strong> rồi chọn <strong className="text-primary">"Lưu ảnh"</strong> hoặc <strong className="text-primary">"Chia sẻ"</strong> để gửi sang Zalo.
          </p>
          {shareImageUrl ? (
            <div className="border border-slate-200 rounded-xl overflow-y-auto max-h-[50vh] w-full bg-slate-50 shadow-inner p-2 flex justify-center">
              <img 
                src={shareImageUrl} 
                alt="Báo giá" 
                className="w-full h-auto object-contain rounded-lg max-w-[280px]" 
                style={{ userSelect: 'auto', WebkitUserSelect: 'auto' }} 
              />
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
        </div>
        <DialogFooter className="w-full flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setIsShareModalOpen(false)} className="w-full font-bold">
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
