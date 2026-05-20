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
  Pencil
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Quotation, Member } from '@/src/types';
import { format } from 'date-fns';
import { useReactToPrint } from 'react-to-print';
import { jsPDF } from 'jspdf';
import { toCanvas } from 'html-to-image';
import { toast } from 'sonner';
import { QuotationTemplate, defaultTemplate } from './QuotationTemplateConfig';

interface QuotationPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  quotation: Quotation;
  member?: Member;
  user: any;
  onUpdateStatus?: (status: Quotation['status']) => void;
  onEdit?: () => void;
}

export function QuotationPreview({ isOpen, onClose, quotation, member, user, onUpdateStatus, onEdit }: QuotationPreviewProps) {
  const printRef = React.useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = React.useState(false);
  const [template, setTemplate] = React.useState<QuotationTemplate>(defaultTemplate);
  const [customerCode, setCustomerCode] = React.useState<string>('KH000');
  const [quotationIndex, setQuotationIndex] = React.useState<number>(1);

  React.useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('quotation_template_config');
      if (saved && saved.trim() !== 'undefined' && saved.trim() !== 'null') {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') {
            setTemplate({ ...defaultTemplate, ...parsed });
          }
        } catch (e) {
          console.error('Failed to parse saved config in preview', e);
        }
      }
    }
  }, [isOpen]);

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

      // Better method using html-to-image + jsPDF with style override to ignore active scale transforms
      const canvas = await toCanvas(element, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        style: {
          transform: 'none',
          transformOrigin: 'top left',
          width: '210mm',
          height: '297mm'
        }
      });

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const margin = 10;
      const printWidth = pdfWidth - margin * 2;
      const printHeight = (canvas.height * printWidth) / canvas.width;

      pdf.addImage(imgData, 'JPEG', margin, margin, printWidth, printHeight);
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

    try {
      setIsExporting(true);
      toast.info("Đang khởi tạo tệp ảnh báo giá...");

      // Render quotation content to canvas with style override to ignore active scale transforms
      const canvas = await toCanvas(element, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        style: {
          transform: 'none',
          transformOrigin: 'top left',
          width: '210mm',
          height: '297mm'
        }
      });

      // Convert canvas to blob
      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast.error("Không thể tạo tệp ảnh báo giá.");
          setIsExporting(false);
          return;
        }

        const file = new File([blob], `${getFileName()}.png`, { type: 'image/png' });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
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
              fallbackShare();
            }
          }
        } else {
          fallbackShare();
        }
        setIsExporting(false);
      }, 'image/png', 1.0);

    } catch (error) {
      console.error('Share Error:', error);
      toast.error("Gặp lỗi trong quá trình chia sẻ báo giá.");
      setIsExporting(false);
    }
  };

  const fallbackShare = () => {
    toast.info("Trình duyệt không hỗ trợ chia sẻ tệp trực tiếp. Đang tải ảnh xuống để bạn gửi thủ công...");
    const element = printRef.current;
    if (!element) return;
    
    toCanvas(element, { 
      pixelRatio: 2, 
      backgroundColor: '#ffffff',
      style: {
        transform: 'none',
        transformOrigin: 'top left',
        width: '210mm',
        height: '297mm'
      }
    }).then((canvas) => {
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `${getFileName()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Đã tải ảnh báo giá thành công! Bạn có thể chọn ảnh này để gửi sang Zalo/Facebook.");
    }).catch(err => {
      console.error(err);
      toast.error("Không hỗ trợ chia sẻ tự động trên trình duyệt này.");
    });
  };

  const handleAccept = () => {
    if (onUpdateStatus) {
      onUpdateStatus('accepted');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] lg:max-w-6xl h-[95vh] flex flex-col p-0 overflow-hidden bg-card text-card-foreground border border-gray-200 shadow-2xl">
        <DialogHeader className="p-3 md:p-6 border-b bg-gray-50 flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg md:rounded-xl bg-blue-50 flex items-center justify-center text-primary">
              <Eye className="h-4 w-4 md:h-6 md:w-6" />
            </div>
            <div className="flex flex-col">
              <DialogTitle className="text-sm md:text-xl font-bold">Xem trước báo giá</DialogTitle>
              <div className="flex items-center gap-2">
                <span className="text-[8px] md:text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{quotation.quotationNumber}</span>
                {quotation.status === 'accepted' && (
                  <Badge className="bg-emerald-500 hover:bg-emerald-600 text-[8px] md:text-[9px] h-3 md:h-4">Đã chốt</Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2 pr-2 md:pr-8">
            <Button variant="outline" size="sm" onClick={onEdit} className="h-8 md:h-10 px-2 md:px-4 gap-1 md:gap-2 font-bold border-2 text-blue-600 border-blue-100 hover:bg-blue-50 text-[10px] md:text-sm">
              <Pencil className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Chỉnh sửa</span>
              <span className="sm:hidden">Sửa</span>
            </Button>
            
            <Button 
               variant="outline" 
               size="sm" 
               onClick={handleShare}
               disabled={isExporting}
               className="h-8 md:h-10 px-2 md:px-4 gap-1 md:gap-2 font-bold border-2 border-emerald-100 hover:bg-emerald-50 text-emerald-600 text-[10px] md:text-sm"
            >
              {isExporting ? (
                <Loader2 className="h-3.5 w-3.5 md:h-4 md:w-4 animate-spin" />
              ) : (
                <Share2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
              )}
              <span className="hidden sm:inline">Chia sẻ</span>
              <span className="sm:hidden">Gửi</span>
            </Button>

            <Button variant="outline" size="sm" onClick={handlePrint} className="h-8 md:h-10 px-2 md:px-4 gap-1 md:gap-2 font-bold border-2 text-[10px] md:text-sm">
              <Printer className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="hidden sm:inline">In báo giá</span>
              <span className="sm:hidden">In</span>
            </Button>
            <Button 
               variant="default" 
               size="sm" 
               onClick={handleDownloadPDF}
               disabled={isExporting}
               className="h-8 md:h-10 px-2 md:px-4 gap-1 md:gap-2 font-bold shadow-sm text-[10px] md:text-sm"
            >
              {isExporting ? (
                <Loader2 className="h-3.5 w-3.5 md:h-4 md:w-4 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5 md:h-4 md:w-4" />
              )}
              {isExporting ? 'Đang tạo...' : 'Tải PDF'}
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 bg-gray-100 overflow-auto custom-scrollbar flex justify-center items-start p-4">
          <div className="p-2 md:p-8 w-full min-w-max flex justify-center">
            <div 
              ref={printRef}
              className="bg-white text-black shadow-2xl p-[10mm] min-h-[297mm] w-[210mm] ring-1 ring-gray-200 relative overflow-hidden print:shadow-none print:p-0 print:m-0 origin-top transform scale-[0.45] sm:scale-[0.7] md:scale-[0.85] lg:scale-100 transition-transform"
              style={{ width: '210mm', minHeight: '297mm', padding: '10mm', background: '#ffffff', color: '#000000' }}
            >
            {/* Background Texture Element */}
            <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none select-none print:hidden">
                <FileText className="h-64 w-64 rotate-12" />
            </div>

            <div className="text-black font-serif text-[12px] leading-snug relative z-10 w-full">
              {/* Header Table */}
              <table className="w-full border-collapse border-2 border-black mb-1 table-fixed">
                <tbody>
                  <tr>
                    <td rowSpan={2} className="w-[30%] p-2 text-center align-middle border-r-2 border-black">
                       <div className="flex flex-col items-center justify-center h-[80px]">
                          {template.logoUrl ? (
                            <img src={template.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
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
                           <img src={template.qrCodeUrl} className="max-w-full max-h-full object-contain" alt="QR Code" />
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
                             BÁO GIÁ THI CÔNG
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
                Kính gửi: I NỘI THẤT xin cảm ơn {quotation.customerName || 'Quý khách hàng'} đã quan tâm tới sản phẩm của công ty. Chúng tôi xin gửi báo giá thi công thực tế như sau:
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
                    <td className="p-1.5 border-r border-black font-bold uppercase text-[9px] tracking-wider">Thời gian</td>
                    <td className="p-1.5 border-r border-black font-bold">{quotation.estimatedTime} ngày làm việc</td>
                    <td className="p-1.5 border-r border-black font-bold uppercase text-[9px] tracking-wider">Ngày báo giá</td>
                    <td className="p-1.5 font-bold">{format(new Date(quotation.date), 'dd/MM/yyyy')}</td>
                  </tr>
                </tbody>
              </table>

              {/* Main Table Title */}
              <div className="bg-black text-white text-center font-bold text-xs py-1.5 uppercase tracking-[0.3em] mb-0 border-x-2 border-t-2 border-black">
                 CHI TIẾT HẠNG MỤC THI CÔNG
              </div>
              <table className="w-full border-2 border-black text-[11px] table-fixed">
                <thead>
                  <tr className="bg-gray-100 font-bold uppercase text-[8px] tracking-widest border-b-2 border-black text-black">
                    <th className="border-r border-black p-1 w-[35px]">STT</th>
                    <th className="border-r border-black p-1 w-[130px]">Tên hạng mục</th>
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
                        <td colSpan={6} className="p-1 px-2 uppercase tracking-[0.2em] text-[10px]">
                          {cat}
                        </td>
                      </tr>
                      {quotation.items.filter(item => item.category === cat).map((item, idx) => (
                        <tr key={item.id} className="border-b border-black last:border-b-0">
                          <td className="border-r border-black p-1 text-center text-gray-500 font-bold">{idx + 1}</td>
                          <td className="border-r border-black p-1.5 font-bold text-black leading-tight">{item.name}</td>
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
                    <td colSpan={6} className="p-2 text-right font-bold uppercase tracking-wider text-gray-500 border-r border-black text-[9px]">Cộng tiền hàng</td>
                    <td className="p-2 text-right font-mono font-bold">
                      {quotation.subTotal.toLocaleString()}
                    </td>
                  </tr>
                  <tr className="bg-gray-50 border-t border-black">
                    <td colSpan={6} className="p-2 text-right font-bold uppercase tracking-wider text-gray-500 border-r border-black text-[9px]">Giảm giá & Chiết khấu</td>
                    <td className="p-2 text-right font-mono font-bold text-red-600">
                      -{quotation.discount.toLocaleString()}
                    </td>
                  </tr>
                  <tr className="bg-gray-100 border-t-2 border-black">
                    <td colSpan={6} className="p-2 text-right text-[11px] font-bold uppercase tracking-[0.2em] text-black border-r border-black">
                       TỔNG GIÁ TRỊ THANH TOÁN (VNĐ)
                    </td>
                    <td className="p-2 pr-3 text-right font-mono text-[14px] font-bold text-gray-950">
                      {quotation.totalAmount.toLocaleString()}
                    </td>
                  </tr>
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
                           <img src={template.qrCodeUrl} alt="QR Code" className="max-w-full max-h-full object-contain" />
                         </div>
                       )}
                    </div>
                    <p className="text-[9px] italic text-gray-500 font-medium leading-tight">Nội dung ghi: <span className="font-bold text-black uppercase tracking-tighter">"{quotation.paymentInfo.content}"</span></p>
                 </div>
              </div>

              <div className="mt-6 text-center opacity-70">
                 <p className="font-serif italic text-lg px-20 text-gray-400">"{template.companyName} — Kiến tạo không gian, nâng tầm cuộc sống"</p>
              </div>

              {/* Signature Section */}
              <div className="mt-4 flex justify-between px-10">
                 <div className="text-center space-y-1">
                    <p className="text-[9px] font-bold uppercase text-gray-400 tracking-wider">Khách hàng xác nhận</p>
                    <p className="text-sm font-bold text-black">KÝ VÀ GHI HỌ TÊN</p>
                    <div className="h-16" />
                    <p className="text-[9px] font-medium text-gray-500 italic pb-2 border-b border-gray-100 items-center justify-center flex gap-1">
                      <Download className="h-3 w-3" /> Ngày ...... / ...... / 202...
                    </p>
                 </div>
                 <div className="text-center space-y-1">
                    <p className="text-[9px] font-bold uppercase text-gray-400 tracking-wider">Đại diện Công ty</p>
                    <p className="text-sm font-bold text-black uppercase">NGƯỜI LẬP BIỂU</p>
                    <div className="h-16 flex items-center justify-center relative">
                       <div className="w-20 h-20 border-2 border-dashed border-red-200 rounded-full flex items-center justify-center text-[7px] font-bold text-red-200 uppercase rotate-[-15deg] absolute">
                          ĐÃ ĐÓNG DẤU HỢP LỆ
                       </div>
                    </div>
                    <p className="font-bold text-gray-950 text-sm border-t border-gray-200 pt-1 px-4">
                       {member?.name || (quotation.createdBy === user?.uid ? user?.displayName : 'BAN QUẢN TRỊ')}
                    </p>
                 </div>
              </div>

              {/* System Footer */}
              <div className="mt-8 pt-4 text-center">
                <p className="text-[7.5px] text-gray-300 font-mono tracking-[0.5em] uppercase italic">Hệ thống quản lý I NỘI THẤT — Mã hồ sơ: {quotation.id.slice(0, 10).toUpperCase()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
    </Dialog>
  );
}
