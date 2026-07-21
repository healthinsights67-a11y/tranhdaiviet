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
  ZoomOut,
  FileSpreadsheet,
  Globe
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
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
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

const TotalsFooter = ({ 
  quotation, 
  colSpan, 
  lang = 'vi',
  exchangeRate = 25400,
  formatPrice,
  formatVnd,
  formatUsd,
  isDualCurrency = false
}: { 
  quotation: Quotation, 
  colSpan: number, 
  lang?: 'vi' | 'en' | 'km',
  exchangeRate?: number,
  formatPrice?: (val: number) => string,
  formatVnd?: (val: number) => string,
  formatUsd?: (val: number) => string,
  isDualCurrency?: boolean
}) => {
  if (!isDualCurrency) {
    const fnPrice = formatPrice || ((v) => (v || 0).toLocaleString('vi-VN'));
    const vatVal = quotation.vatAmount || Math.round((quotation.subTotal - quotation.discount) * 0.08);
    const remainingVal = (quotation.totalAmount || 0) - (quotation.depositAmount || 0);

    return (
      <tfoot>
        <tr className="bg-gray-50 border-t-2 border-black">
          <td colSpan={colSpan} className="p-2 text-right font-bold uppercase tracking-wider text-gray-500 border-r border-black text-[9px]">
            {lang === 'en' ? 'Subtotal ($)' : lang === 'km' ? 'សរុបរង ($)' : 'Cộng tiền hàng'}
          </td>
          <td className="p-2 text-right font-mono font-bold text-xs">
            {fnPrice(quotation.subTotal)}
          </td>
        </tr>
        <tr className="bg-gray-50 border-t border-black">
          <td colSpan={colSpan} className="p-2 text-right font-bold uppercase tracking-wider text-gray-500 border-r border-black text-[9px]">
            {lang === 'en' ? 'Discount ($)' : lang === 'km' ? 'ការបញ្ចុះតម្លៃ ($)' : 'Giảm giá & Chiết khấu'}
          </td>
          <td className="p-2 text-right font-mono font-bold text-red-600 text-xs">
            -{fnPrice(quotation.discount)}
          </td>
        </tr>
        {quotation.hasVat && (
          <tr className="bg-gray-50 border-t border-black">
            <td colSpan={colSpan} className="p-2 text-right font-bold uppercase tracking-wider text-gray-500 border-r border-black text-[9px]">
              {lang === 'en' ? 'VAT Tax (8%) ($)' : lang === 'km' ? 'ពន្ធ VAT (8%) ($)' : 'Thuế VAT (8%)'}
            </td>
            <td className="p-2 text-right font-mono font-bold text-xs">
              {fnPrice(vatVal)}
            </td>
          </tr>
        )}
        <tr className="bg-gray-100 border-t-2 border-black">
          <td colSpan={colSpan} className="p-2 text-right text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.15em] text-black border-r border-black">
             {lang === 'en'
               ? `TOTAL QUOTATION AMOUNT ${quotation.hasVat ? '(INCL. VAT 8%)' : '(EXCL. TAX)'} ($)`
               : lang === 'km'
               ? `តម្លៃសរុបរួម ${quotation.hasVat ? '(រាប់បញ្ចូលទាំងពន្ធ VAT 8%)' : '(មិនទាន់រាប់បញ្ចូលពន្ធ)'}`
               : `TỔNG GIÁ TRỊ BÁO GIÁ ${quotation.hasVat ? '(ĐÃ BAO GỒM VAT 8%)' : '(CHƯA BAO GỒM THUẾ)'}`
             }
          </td>
          <td className="p-2 pr-3 text-right font-mono text-[14px] font-bold text-gray-950">
            {fnPrice(quotation.totalAmount)}
          </td>
        </tr>
        {(quotation.depositAmount ?? 0) > 0 && (
          <>
            <tr className="bg-gray-50 border-t border-black">
              <td colSpan={colSpan} className="p-2 text-right font-bold uppercase tracking-wider text-gray-500 border-r border-black text-[9px]">
                {lang === 'en' ? 'Deposit Paid ($)' : lang === 'km' ? 'ប្រាក់កក់បានបង់ ($)' : 'Đã đặt cọc'}
              </td>
              <td className="p-2 pr-3 text-right font-mono font-bold text-emerald-600 text-xs">
                -{fnPrice(quotation.depositAmount || 0)}
              </td>
            </tr>
            <tr className="bg-emerald-50 border-t-2 border-emerald-200">
              <td colSpan={colSpan} className="p-2 text-right text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.15em] text-emerald-700 border-r border-emerald-200">
                 {lang === 'en' ? 'REMAINING BALANCE DUE ($)' : lang === 'km' ? 'ចំនួនប្រាក់នៅសល់ត្រូវទូទាត់ ($)' : 'SỐ TIỀN CÒN LẠI CẦN THANH TOÁN'}
              </td>
              <td className="p-2 pr-3 text-right font-mono text-[14px] font-bold text-emerald-700">
                {fnPrice(remainingVal)}
              </td>
            </tr>
          </>
        )}
        {lang !== 'vi' && exchangeRate > 0 && (
          <tr className="bg-amber-50 border-t border-amber-300">
            <td colSpan={colSpan + 1} className="p-1.5 px-3 text-right font-bold text-[10px] text-amber-900 italic">
              {lang === 'en'
                ? `* Applied Exchange Rate: 1 USD = ${exchangeRate.toLocaleString('vi-VN')} VND`
                : `* អត្រាប្តូរប្រាក់អនុវត្ត៖ 1 USD = ${exchangeRate.toLocaleString('vi-VN')} VND`
              }
            </td>
          </tr>
        )}
      </tfoot>
    );
  }

  const labelColSpan = colSpan;
  const fnVnd = formatVnd || ((v) => (v || 0).toLocaleString('vi-VN'));
  const fnUsd = formatUsd || ((v) => `$${((v || 0) / (exchangeRate || 25400)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  const vatVal = quotation.vatAmount || Math.round((quotation.subTotal - quotation.discount) * 0.08);
  const remainingVal = (quotation.totalAmount || 0) - (quotation.depositAmount || 0);

  return (
    <tfoot>
      <tr className="bg-gray-50 border-t-2 border-black">
        <td colSpan={labelColSpan} className="p-2 text-right font-bold uppercase tracking-wider text-gray-500 border-r border-black text-[9px]">
          {lang === 'en' ? 'Subtotal' : lang === 'km' ? 'សរុបរង' : 'Cộng tiền hàng'}
        </td>
        <td className="p-2 text-right font-mono font-bold border-r border-black text-xs">
          {fnVnd(quotation.subTotal)}
        </td>
        <td className="p-2 text-right font-mono font-bold text-blue-700 bg-gray-50 text-xs">
          {fnUsd(quotation.subTotal)}
        </td>
      </tr>
      <tr className="bg-gray-50 border-t border-black">
        <td colSpan={labelColSpan} className="p-2 text-right font-bold uppercase tracking-wider text-gray-500 border-r border-black text-[9px]">
          {lang === 'en' ? 'Discount' : lang === 'km' ? 'ការបញ្ចុះតម្លៃ' : 'Giảm giá & Chiết khấu'}
        </td>
        <td className="p-2 text-right font-mono font-bold text-red-600 border-r border-black text-xs">
          -{fnVnd(quotation.discount)}
        </td>
        <td className="p-2 text-right font-mono font-bold text-red-600 bg-gray-50 text-xs">
          -{fnUsd(quotation.discount)}
        </td>
      </tr>
      {quotation.hasVat && (
        <tr className="bg-gray-50 border-t border-black">
          <td colSpan={labelColSpan} className="p-2 text-right font-bold uppercase tracking-wider text-gray-500 border-r border-black text-[9px]">
            {lang === 'en' ? 'VAT Tax (8%)' : lang === 'km' ? 'ពន្ធ VAT (8%)' : 'Thuế VAT (8%)'}
          </td>
          <td className="p-2 text-right font-mono font-bold border-r border-black text-xs">
            {fnVnd(vatVal)}
          </td>
          <td className="p-2 text-right font-mono font-bold text-blue-700 bg-gray-50 text-xs">
            {fnUsd(vatVal)}
          </td>
        </tr>
      )}
      <tr className="bg-gray-100 border-t-2 border-black">
        <td colSpan={labelColSpan} className="p-2 text-right text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.15em] text-black border-r border-black">
           {lang === 'en'
             ? `TOTAL QUOTATION AMOUNT ${quotation.hasVat ? '(INCL. VAT 8%)' : '(EXCL. TAX)'}`
             : lang === 'km'
             ? `តម្លៃសរុបរួម ${quotation.hasVat ? '(រាប់បញ្ចូលទាំងពន្ធ VAT 8%)' : '(មិនទាន់រាប់បញ្ចូលពន្ធ)'}`
             : `TỔNG GIÁ TRỊ BÁO GIÁ ${quotation.hasVat ? '(ĐÃ BAO GỒM VAT 8%)' : '(CHƯA BAO GỒM THUẾ)'}`
           }
        </td>
        <td className="p-2 pr-2 text-right font-mono text-[13px] font-bold text-gray-950 border-r border-black">
          {fnVnd(quotation.totalAmount)}
        </td>
        <td className="p-2 pr-2 text-right font-mono text-[13px] font-bold text-blue-700 bg-gray-100">
          {fnUsd(quotation.totalAmount)}
        </td>
      </tr>
      {(quotation.depositAmount ?? 0) > 0 && (
        <>
          <tr className="bg-gray-50 border-t border-black">
            <td colSpan={labelColSpan} className="p-2 text-right font-bold uppercase tracking-wider text-gray-500 border-r border-black text-[9px]">
              {lang === 'en' ? 'Deposit Paid' : lang === 'km' ? 'ប្រាក់កក់បានបង់' : 'Đã đặt cọc'}
            </td>
            <td className="p-2 pr-2 text-right font-mono font-bold text-emerald-600 border-r border-black text-xs">
              -{fnVnd(quotation.depositAmount || 0)}
            </td>
            <td className="p-2 pr-2 text-right font-mono font-bold text-emerald-600 bg-gray-50 text-xs">
              -{fnUsd(quotation.depositAmount || 0)}
            </td>
          </tr>
          <tr className="bg-emerald-50 border-t-2 border-emerald-200">
            <td colSpan={labelColSpan} className="p-2 text-right text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.15em] text-emerald-700 border-r border-emerald-200">
               {lang === 'en' ? 'REMAINING BALANCE DUE' : lang === 'km' ? 'ចំនួនប្រាក់នៅសល់ត្រូវទូទាត់' : 'SỐ TIỀN CÒN LẠI CẦN THANH TOÁN'}
            </td>
            <td className="p-2 pr-2 text-right font-mono text-[13px] font-bold text-emerald-700 border-r border-emerald-200">
              {fnVnd(remainingVal)}
            </td>
            <td className="p-2 pr-2 text-right font-mono text-[13px] font-bold text-emerald-700 bg-emerald-50">
              {fnUsd(remainingVal)}
            </td>
          </tr>
        </>
      )}
      {exchangeRate > 0 && (
        <tr className="bg-amber-50 border-t border-amber-300">
          <td colSpan={labelColSpan + 2} className="p-1.5 px-3 text-right font-bold text-[10px] text-amber-900 italic">
            {lang === 'en'
              ? `* Applied Exchange Rate: 1 USD = ${exchangeRate.toLocaleString('vi-VN')} VND`
              : lang === 'km'
              ? `* អត្រាប្តូរប្រាក់អនុវត្ត៖ 1 USD = ${exchangeRate.toLocaleString('vi-VN')} VND`
              : `* Tỷ giá áp dụng: 1 USD = ${exchangeRate.toLocaleString('vi-VN')} VNĐ`
            }
          </td>
        </tr>
      )}
    </tfoot>
  );
};

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
  const [template, setTemplate] = React.useState<QuotationTemplate>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('quotation_template_config');
      if (saved && saved.trim() !== 'undefined' && saved.trim() !== 'null') {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') {
            return { ...defaultTemplate, ...parsed } as QuotationTemplate;
          }
        } catch (e) {
          console.error('Failed to parse saved config in preview state init', e);
        }
      }
    }
    return defaultTemplate;
  });
  const [customerCode, setCustomerCode] = React.useState<string>('KH000');
  const [quotationIndex, setQuotationIndex] = React.useState<number>(1);
  const [logoDataUrl, setLogoDataUrl] = React.useState<string>('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = React.useState<string>('');
  const [imagesLoading, setImagesLoading] = React.useState<boolean>(true);
  const [shareImageUrl, setShareImageUrl] = React.useState<string>('');
  const [isShareModalOpen, setIsShareModalOpen] = React.useState<boolean>(false);
  const [zoom, setZoom] = React.useState<number>(1);
  const [websiteQrCodeDataUrl, setWebsiteQrCodeDataUrl] = React.useState<string>('');
  const [lang, setLang] = React.useState<'vi' | 'en' | 'km'>('vi');
  const [exchangeRate, setExchangeRate] = React.useState<number>(25400);

  const formatVnd = React.useCallback((amountVnd: number) => {
    return (amountVnd || 0).toLocaleString('vi-VN');
  }, []);

  const formatUsd = React.useCallback((amountVnd: number) => {
    const rate = exchangeRate > 0 ? exchangeRate : 25400;
    const usdAmount = (amountVnd || 0) / rate;
    return `$${usdAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [exchangeRate]);

  const formatPrice = React.useCallback((amountVnd: number) => {
    if (lang === 'vi') {
      return (amountVnd || 0).toLocaleString('vi-VN');
    }
    const rate = exchangeRate > 0 ? exchangeRate : 25400;
    const usdAmount = (amountVnd || 0) / rate;
    return `$${usdAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [lang, exchangeRate]);

  const translateUnit = React.useCallback((unit: string) => {
    if (lang === 'vi') return unit;
    const u = (unit || '').toLowerCase().trim();
    if (lang === 'en') {
      if (u === 'cái' || u === 'chiếc') return 'Pcs';
      if (u === 'bộ') return 'Set';
      if (u === 'md' || u === 'm tới') return 'Lm';
      if (u === 'm2' || u === 'm²') return 'Sqm';
      if (u === 'm3' || u === 'm³') return 'Cbm';
      if (u === 'hệ') return 'Sys';
      if (u === 'lô') return 'Lot';
      if (u === 'kg') return 'Kg';
      if (u === 'tấm') return 'Sheet';
      return unit;
    }
    if (lang === 'km') {
      if (u === 'cái' || u === 'chiếc') return 'គ្រឿង';
      if (u === 'bộ') return 'ឈុត';
      if (u === 'md' || u === 'm tới') return 'ម៉ែត្រ';
      if (u === 'm2' || u === 'm²') return 'ម៉ែត្រការ៉េ';
      if (u === 'm3' || u === 'm³') return 'ម៉ែត្រគូប';
      if (u === 'hệ') return 'ប្រព័ន្ធ';
      if (u === 'lô') return 'ឡូត៍';
      if (u === 'kg') return 'គីឡូក្រាម';
      if (u === 'tấm') return 'បន្ទះ';
      return unit;
    }
  }, [lang]);

  const translateCategory = React.useCallback((cat: string) => {
    if (lang === 'vi' || !cat) return cat;
    const c = cat.trim();
    const cLower = c.toLowerCase();
    
    if (cLower.includes('đóng sẵn')) {
      return lang === 'en' ? 'READY-MADE FURNITURE' : 'គ្រឿងសង្ហារិមស្រាប់';
    }
    if (cLower.includes('phòng khách')) {
      return lang === 'en' ? 'LIVING ROOM' : 'បន្ទប់ទទួលភ្ញៀវ';
    }
    if (cLower.includes('phòng ngủ')) {
      return lang === 'en' ? 'BEDROOM' : 'បន្ទប់គេង';
    }
    if (cLower.includes('bếp') || cLower.includes('phòng ăn')) {
      return lang === 'en' ? 'KITCHEN & DINING' : 'បន្ទប់បាយ';
    }
    if (cLower.includes('tắm') || cLower.includes('vệ sinh')) {
      return lang === 'en' ? 'BATHROOM' : 'បន្ទប់ទឹក';
    }
    if (cLower.includes('làm việc') || cLower.includes('văn phòng')) {
      return lang === 'en' ? 'OFFICE & WORKSPACE' : 'បន្ទប់ធ្វើការ';
    }
    if (cLower.includes('thi công') || cLower.includes('may đo')) {
      return lang === 'en' ? 'CUSTOM FURNITURE & CONSTRUCTION' : 'គ្រឿងសង្ហារិមតាមតម្រូវការ';
    }

    return c;
  }, [lang]);

  const translateName = React.useCallback((name: string) => {
    if (lang === 'vi' || !name) return name;
    let n = name;

    if (lang === 'en') {
      n = n
        .replace(/tủ sơ sinh cho bé|tủ sơ sinh|tủ trẻ em|tủ em bé/gi, 'Nursery Baby Wardrobe')
        .replace(/tủ áo\s*(\d+)\s*cánh\s*(\d+)\s*kệ/gi, '$1-Door Wardrobe ($2 Shelves)')
        .replace(/tủ áo\s*(\d+)\s*cánh/gi, '$1-Door Wardrobe')
        .replace(/tủ áo cánh lùa/gi, 'Sliding Door Wardrobe')
        .replace(/tủ quần áo|tủ áo/gi, 'Wardrobe')
        .replace(/giường ngủ|giường/gi, 'Bed')
        .replace(/bàn trang điểm|bàn phấn/gi, 'Dressing Table')
        .replace(/tủ đầu giường|tab đầu giường/gi, 'Bedside Table')
        .replace(/bàn học|bàn làm việc/gi, 'Desk')
        .replace(/bàn trà|bàn sofa/gi, 'Coffee Table')
        .replace(/kệ sách/gi, 'Bookshelf')
        .replace(/sofa gỗ|ghế sofa|sofa/gi, 'Sofa')
        .replace(/bàn ăn/gi, 'Dining Table')
        .replace(/ghế ăn/gi, 'Dining Chair')
        .replace(/tủ bếp trên/gi, 'Upper Kitchen Cabinet')
        .replace(/tủ bếp dưới/gi, 'Lower Kitchen Cabinet')
        .replace(/tủ bếp/gi, 'Kitchen Cabinet')
        .replace(/tủ giày|tủ giầy/gi, 'Shoe Cabinet')
        .replace(/kệ tivi|kệ tv/gi, 'TV Stand')
        .replace(/vách ốp tường|vách ốp/gi, 'Wall Panel')
        .replace(/vách trang trí/gi, 'Decorative Panel')
        .replace(/tủ rượu/gi, 'Wine Cabinet')
        .replace(/tủ lavabo/gi, 'Vanity Cabinet')
        .replace(/gương soi|gương/gi, 'Mirror')
        .replace(/hàng đóng sẵn/gi, 'Ready-made Item')
        .replace(/\bcó\b|\bkèm\b/gi, 'with')
        .replace(/\bcho bé\b|\bcho trẻ em\b/gi, 'for Baby')
        .replace(/\b1m6\b|\b1m60\b/gi, '1.6m')
        .replace(/\b1m8\b|\b1m80\b/gi, '1.8m')
        .replace(/\b2m\b|\b2m00\b/gi, '2.0m')
        .replace(/\b1m2\b|\b1m20\b/gi, '1.2m')
        .replace(/\b(\d+)\s*cánh\b/gi, '$1 Doors')
        .replace(/\b(\d+)\s*kệ\b/gi, '$1 Shelves');
    } else if (lang === 'km') {
      n = n
        .replace(/tủ sơ sinh cho bé|tủ sơ sinh|tủ trẻ em|tủ em bé/gi, 'ទូសម្លៀកបំពាក់ទារក')
        .replace(/tủ áo\s*(\d+)\s*cánh\s*(\d+)\s*kệ/gi, 'ទូខោអាវទ្វារ$1 មានធ្នើរ$2')
        .replace(/tủ áo\s*(\d+)\s*cánh/gi, 'ទូខោអាវទ្វារ$1')
        .replace(/tủ áo cánh lùa/gi, 'ទូខោអាវទ្វាររុញ')
        .replace(/tủ quần áo|tủ áo/gi, 'ទូខោអាវ')
        .replace(/giường ngủ|giường/gi, 'គ្រែគេង')
        .replace(/bàn trang điểm|bàn phấn/gi, 'តុសំអាង')
        .replace(/tủ đầu giường|tab đầu giường/gi, 'តុចុងគ្រែ')
        .replace(/bàn học|bàn làm việc/gi, 'តុរៀន / តុធ្វើការ')
        .replace(/bàn trà|bàn sofa/gi, 'តុតែ / តុសូហ្វា')
        .replace(/kệ sách/gi, 'ធ្នើររូបសៀវភៅ')
        .replace(/sofa gỗ|ghế sofa|sofa/gi, 'កៅអីសូហ្វា')
        .replace(/bàn ăn/gi, 'តុបាយ')
        .replace(/ghế ăn/gi, 'កៅអីបាយ')
        .replace(/tủ bếp trên/gi, 'ទូបាយលើ')
        .replace(/tủ bếp dưới/gi, 'ទូបាយក្រោម')
        .replace(/tủ bếp/gi, 'ទូបាយ')
        .replace(/tủ giày|tủ giầy/gi, 'ទូស្បែកជើង')
        .replace(/kệ tivi|kệ tv/gi, 'ទូរទស្សន៍')
        .replace(/vách ốp tường|vách ốp/gi, 'ជញ្ជាំងអប')
        .replace(/vách trang trí/gi, 'ផ្ទាំងលម្អ')
        .replace(/tủ rượu/gi, 'ទូស្រា')
        .replace(/tủ lavabo/gi, 'ទូឡាបូ')
        .replace(/gương soi|gương/gi, 'កញ្ចក់')
        .replace(/hàng đóng sẵn/gi, 'គ្រឿងសង្ហារិមស្រាប់')
        .replace(/\bcó\b|\bkèm\b/gi, 'មាន')
        .replace(/\bcho bé\b|\bcho trẻ em\b/gi, 'សម្រាប់ទារក')
        .replace(/\b(\d+)\s*cánh\b/gi, 'ទ្វារ$1')
        .replace(/\b(\d+)\s*kệ\b/gi, 'ធ្នើរ$1');
    }

    return n;
  }, [lang]);

  const translateDescription = React.useCallback((desc: string) => {
    if (lang === 'vi' || !desc) return desc;
    let d = desc;

    if (lang === 'en') {
      d = d
        .replace(/Chất liệu\s*:?/gi, 'Material:')
        .replace(/khung cánh/gi, 'Frame & Door')
        .replace(/Khung/gi, 'Frame')
        .replace(/Cánh/gi, 'Door')
        .replace(/Phần giường/gi, 'Bed Base')
        .replace(/Hậu Tủ|Hậu tủ|hậu tủ/gi, 'Back Panel')
        .replace(/li\b|mm\b/gi, 'mm')
        .replace(/kệ/gi, 'Shelf')
        .replace(/ngăn kéo/gi, 'Drawers')
        .replace(/nhựa/gi, 'PVC Plastic')
        .replace(/gỗ công nghiệp/gi, 'Engineered Wood')
        .replace(/gỗ tự nhiên/gi, 'Solid Wood')
        .replace(/phủ melamine/gi, 'Melamine Coated')
        .replace(/kính cường lực/gi, 'Tempered Glass')
        .replace(/phụ kiện/gi, 'Hardware Fittings')
        .replace(/bản lề giảm chấn/gi, 'Soft-close Hinges')
        .replace(/ray trượt/gi, 'Drawer Slides')
        .replace(/\(R x C x S\)/gi, '(W x H x D)')
        .replace(/\(D x R x C\)/gi, '(L x W x H)');
    } else if (lang === 'km') {
      d = d
        .replace(/Chất liệu\s*:?/gi, 'សម្ភារៈ៖')
        .replace(/khung cánh/gi, 'ស៊ុម និង ទ្វារ')
        .replace(/Khung/gi, 'ស៊ុម')
        .replace(/Cánh/gi, 'ទ្វារ')
        .replace(/Phần giường/gi, 'ផ្នែកគ្រែ')
        .replace(/Hậu Tủ|Hậu tủ|hậu tủ/gi, 'ផ្ទាំងខាងក្រោយ')
        .replace(/li\b|mm\b/gi, 'mm')
        .replace(/kệ/gi, 'ធ្នើរ')
        .replace(/ngăn kéo/gi, 'ថត')
        .replace(/nhựa/gi, 'ប្លាស្ទិក')
        .replace(/gỗ công nghiệp/gi, 'ឈើកែច្នៃ')
        .replace(/gỗ tự nhiên/gi, 'ឈើធម្មជាតិ')
        .replace(/phủ melamine/gi, 'ស្រោប Melamine')
        .replace(/kính cường lực/gi, 'កញ្ចក់ស្វិត')
        .replace(/phụ kiện/gi, 'គ្រឿងបន្លាស់')
        .replace(/bản lề giảm chấn/gi, 'ត្រចៀកកាត់បន្ថយកម្លាំង')
        .replace(/ray trượt/gi, 'រ៉ៃរុញ')
        .replace(/\(R x C x S\)/gi, '(ទទឹង x កំពស់ x ជម្រៅ)')
        .replace(/\(D x R x C\)/gi, '(ប្រវែង x ទទឹង x កំពស់)');
    }

    return d;
  }, [lang]);
  
  const customItems = React.useMemo(() => {
    if (!quotation) return [];
    return quotation.items.filter(item => !item.category?.toLowerCase()?.includes('đóng sẵn'));
  }, [quotation]);

  const readyMadeItems = React.useMemo(() => {
    if (!quotation) return [];
    return quotation.items.filter(item => item.category?.toLowerCase()?.includes('đóng sẵn'));
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

  const { data: dbConfig, isLoading: isConfigLoading } = useQuery<QuotationTemplate>({
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

  const isPreloading = isConfigLoading || imagesLoading;

  const hasBankInfo = React.useMemo(() => {
    return !!(
      template.bankAccount?.trim() ||
      template.bankName?.trim() ||
      template.bankAccountName?.trim()
    );
  }, [template]);

  const fetchAsDataUrl = async (url: string, setter?: (val: string) => void): Promise<string> => {
    if (!url) {
      if (setter) setter('');
      return '';
    }
    if (url.startsWith('data:')) {
      if (setter) setter(url);
      return url;
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
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
      const dataUrl = await toBase64(proxyUrl);
      if (setter) setter(dataUrl);
      return dataUrl;
    } catch (e) {
      console.warn('Local proxy fetch failed. Trying direct fetch with cache-buster...', e);
      try {
        const cacheBuster = url.includes('?') ? `&cb=${Date.now()}` : `?cb=${Date.now()}`;
        const dataUrl = await toBase64(url + cacheBuster);
        if (setter) setter(dataUrl);
        return dataUrl;
      } catch (e2) {
        console.warn('Direct fetch failed. Trying allorigins proxy...', e2);
        try {
          const allOriginsUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}&cb=${Date.now()}`;
          const dataUrl = await toBase64(allOriginsUrl);
          if (setter) setter(dataUrl);
          return dataUrl;
        } catch (e3) {
          console.error('All image loading strategies failed', e3);
          if (setter) setter(url);
          return url;
        }
      }
    }
  };

  React.useEffect(() => {
    // Guard: only load images when dialog is open
    if (!isOpen) return;

    const loadImages = async () => {
      setImagesLoading(true);
      const promises = [];
      if (template.logoUrl) promises.push(fetchAsDataUrl(template.logoUrl, setLogoDataUrl));
      if (template.qrCodeUrl) promises.push(fetchAsDataUrl(template.qrCodeUrl, setQrCodeDataUrl));
      if (template.companyWebsite) {
        let websiteUrl = template.companyWebsite.trim();
        if (!/^https?:\/\//i.test(websiteUrl)) {
          websiteUrl = `https://${websiteUrl}`;
        }
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(websiteUrl)}&margin=0`;
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

  const decodeAllImages = async (element: HTMLElement) => {
    const imgElements = element.querySelectorAll('img');
    const decodePromises = Array.from(imgElements).map(async (img) => {
      if (!img.src) return;
      try {
        if (!img.complete) {
          await new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        }
        if (typeof img.decode === 'function') {
          await img.decode();
        }
      } catch (err) {
        console.warn("Failed to decode image:", img.src, err);
      }
    });
    await Promise.all(decodePromises);
  };

  const ensureAndSwapImages = async (element: HTMLElement) => {
    let finalLogoUrl = logoDataUrl;
    let finalQrCodeUrl = qrCodeDataUrl;
    let finalWebsiteQrCodeUrl = websiteQrCodeDataUrl;

    const loadPromises = [];

    if (!finalLogoUrl && template.logoUrl) {
      loadPromises.push(fetchAsDataUrl(template.logoUrl).then(url => { finalLogoUrl = url; }));
    }
    if (!finalQrCodeUrl && template.qrCodeUrl) {
      loadPromises.push(fetchAsDataUrl(template.qrCodeUrl).then(url => { finalQrCodeUrl = url; }));
    }
    if (!finalWebsiteQrCodeUrl && template.companyWebsite) {
      let websiteUrl = template.companyWebsite.trim();
      if (!/^https?:\/\//i.test(websiteUrl)) {
        websiteUrl = `https://${websiteUrl}`;
      }
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(websiteUrl)}&margin=0`;
      loadPromises.push(fetchAsDataUrl(qrUrl).then(url => { finalWebsiteQrCodeUrl = url; }));
    }

    if (loadPromises.length > 0) {
      await Promise.allSettled(loadPromises);
    }

    const imgElements = element.querySelectorAll('img');
    const imgOriginalSrcs: string[] = [];
    imgElements.forEach((img) => {
      imgOriginalSrcs.push(img.src);
      if (img.src && !img.src.startsWith('data:')) {
        if (finalLogoUrl && (img.src.includes(template.logoUrl || '__NO_MATCH__') || img.getAttribute('alt') === 'Logo' || img.getAttribute('alt') === 'Watermark')) {
          img.src = finalLogoUrl;
        } else if (finalQrCodeUrl && img.getAttribute('alt') === 'QR Code') {
          img.src = finalQrCodeUrl;
        } else if (finalWebsiteQrCodeUrl && img.getAttribute('alt') === 'Website QR Code') {
          img.src = finalWebsiteQrCodeUrl;
        }
      }
    });

    return { imgElements, imgOriginalSrcs };
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

      // Wait for all images to decode and swap them with base64 data URLs
      const { imgElements, imgOriginalSrcs } = await ensureAndSwapImages(element);
      await decodeAllImages(element);

      // 3. Render canvas with high resolution, capturing full height
      const canvas = await toCanvas(element, {
        pixelRatio: 2.5, // Increased to 2.5 for crisp and high-quality PDF/images
        backgroundColor: '#ffffff',
      });

      // Restore img srcs
      imgElements.forEach((img, i) => { img.src = imgOriginalSrcs[i]; });

      // 4. Restore original styles immediately
      element.className = originalClassName;
      element.style.transform = originalStyleTransform;

      const pdfWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      const totalPdfHeight = (imgHeight * pdfWidth) / imgWidth;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      if (totalPdfHeight <= pageHeight) {
        // Fits on a single page
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, totalPdfHeight);
      } else {
        // Multi-page export: slice the canvas into A4 page-sized chunks
        const pxPerPage = (imgWidth * pageHeight) / pdfWidth;
        let sourceY = 0;
        let pageIndex = 0;

        while (sourceY < imgHeight) {
          const sliceHeight = Math.min(pxPerPage, imgHeight - sourceY);
          
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = imgWidth;
          pageCanvas.height = sliceHeight;

          const ctx = pageCanvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, imgWidth, sliceHeight);
            ctx.drawImage(
              canvas,
              0, sourceY, imgWidth, sliceHeight,
              0, 0, imgWidth, sliceHeight
            );
          }

          const pageImgData = pageCanvas.toDataURL('image/jpeg', 1.0);
          const slicePdfHeight = (sliceHeight * pdfWidth) / imgWidth;

          if (pageIndex > 0) {
            pdf.addPage();
          }

          pdf.addImage(pageImgData, 'JPEG', 0, 0, pdfWidth, slicePdfHeight);

          sourceY += pxPerPage;
          pageIndex++;
        }
      }

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

      // Wait for all images to decode and swap them with base64 data URLs
      const { imgElements, imgOriginalSrcs } = await ensureAndSwapImages(element);
      await decodeAllImages(element);

      // 4. Render image directly to Data URL
      const dataUrl = await toJpeg(element, {
        pixelRatio: 2.5, // Increased to 2.5 for crisp and high-quality images
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
              text: `Gửi anh/chị báo giá chi tiết từ Tủ 3 Miền cho công trình ${quotation.constructionType || ''}.`,
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
      // Wait for all images to decode and swap them with base64 data URLs
      const { imgElements, imgOriginalSrcs } = await ensureAndSwapImages(element);
      await decodeAllImages(element);

      try {
        const dataUrl = await toJpeg(element, { 
          pixelRatio: 2.5, // Increased to 2.5 for crisp and high-quality images
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

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Báo Giá', {
         pageSetup: { paperSize: 9, orientation: 'portrait' }
      });

      const maxCol = readyMadeItems.length > 0 ? 8 : 7;

      if (readyMadeItems.length > 0) {
         sheet.columns = [
            { width: 8 },  // STT
            { width: 30 }, // Tên
            { width: 20 }, // Ảnh
            { width: 45 }, // QC
            { width: 10 }, // ĐVT
            { width: 10 }, // SL
            { width: 18 }, // Đơn giá
            { width: 20 }, // Thành tiền
         ];
      } else {
         sheet.columns = [
            { width: 8 },  // STT
            { width: 30 }, // Tên
            { width: 45 }, // QC
            { width: 10 }, // ĐVT
            { width: 10 }, // SL
            { width: 18 }, // Đơn giá
            { width: 20 }, // Thành tiền
         ];
      }

      const addHeader = (text: string, bold: boolean, size: number) => {
         const row = sheet.addRow([text]);
         sheet.mergeCells(row.number, 1, row.number, maxCol);
         row.getCell(1).font = { name: 'Times New Roman', bold, size };
         row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
         row.height = size * 1.5;
         return row;
      };
      const isReadyMade = quotation.type === 'ready-made' || (readyMadeItems.length > 0 && customItems.length === 0);

      addHeader(template.companyName || 'CÔNG TY CỔ PHẦN QUỐC TẾ TỦ 3 MIỀN', true, 16);
      addHeader(isReadyMade ? 'BÁO GIÁ SẢN PHẨM' : 'BÁO GIÁ THI CÔNG', true, 18);
      
      const applyBorderAndFont = (row: ExcelJS.Row, isBold = false) => {
         for(let i=1; i<=maxCol; i++) {
             row.getCell(i).border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
             row.getCell(i).font = { name: 'Times New Roman', bold: isBold, size: 12 };
             row.getCell(i).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
         }
      }

      const getExcelPrice = (val: number) => {
         if (lang === 'vi') return val;
         const rate = exchangeRate > 0 ? exchangeRate : 25400;
         return Number(((val || 0) / rate).toFixed(2));
      };
      const numFmt = lang === 'vi' ? '#,##0' : '$#,##0.00';

      const noRow = sheet.addRow([`HỒ SƠ SỐ: ${quotation.quotationNumber}`]);
      sheet.mergeCells(noRow.number, 1, noRow.number, maxCol);
      noRow.getCell(1).font = { name: 'Times New Roman', bold: true, size: 12 };
      noRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      
      const dearRow = sheet.addRow([`Kính gửi: ${template.companyName || 'CÔNG TY CỔ PHẦN QUỐC TẾ TỦ 3 MIỀN'} xin cảm ơn ${quotation.customerName || 'Quý khách hàng'} đã quan tâm tới sản phẩm của công ty. Chúng tôi xin gửi ${isReadyMade ? 'báo giá sản phẩm' : 'báo giá thi công thực tế'} như sau:`]);
      sheet.mergeCells(dearRow.number, 1, dearRow.number, maxCol);
      dearRow.getCell(1).font = { name: 'Times New Roman', italic: true, size: 11 };
      dearRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

      sheet.addRow([]);

      const addCustomerRow = (label1: string, val1: string, label2: string, val2: string) => {
         const row = sheet.addRow([label1, val1, '', '', label2, val2, '']);
         sheet.mergeCells(row.number, 2, row.number, 4);
         sheet.mergeCells(row.number, 6, row.number, maxCol);
         
         for (let i = 1; i <= maxCol; i++) {
             row.getCell(i).border = {
                top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}
             };
             row.getCell(i).font = { name: 'Times New Roman', size: 12 };
             row.getCell(i).alignment = { vertical: 'middle', wrapText: true };
         }
         row.getCell(1).font = { name: 'Times New Roman', bold: true, size: 12 };
         row.getCell(5).font = { name: 'Times New Roman', bold: true, size: 12 };
         row.height = 25;
      };

      addCustomerRow('KHÁCH HÀNG', quotation.customerName, 'ĐIỆN THOẠI', quotation.phone);
      addCustomerRow('CÔNG TRÌNH', quotation.constructionType || 'Nhà ở dân dụng', 'ĐỊA CHỈ', quotation.address);
      if (isReadyMade) {
         addCustomerRow('ĐƠN HÀNG', 'Đơn hàng đóng sẵn', 'NGÀY BÁO GIÁ', format(new Date(quotation.date), 'dd/MM/yyyy'));
      } else {
         addCustomerRow('THỜI GIAN', quotation.estimatedTime + ' ngày làm việc', 'NGÀY BÁO GIÁ', format(new Date(quotation.date), 'dd/MM/yyyy'));
      }

      sheet.addRow([]);


      if (customItems.length > 0) {
         const titleRow = sheet.addRow(['CHI TIẾT HẠNG MỤC THI CÔNG']);
         sheet.mergeCells(titleRow.number, 1, titleRow.number, maxCol);
         applyBorderAndFont(titleRow, true);
         titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
         titleRow.getCell(1).font = { name: 'Times New Roman', bold: true, size: 12, color: { argb: 'FFFFFFFF' } };

         const headerRow = sheet.addRow(['STT', 'TÊN HẠNG MỤC', 'QC KỸ THUẬT / DIỄN GIẢI', 'ĐVT', 'SL', 'ĐƠN GIÁ', 'THÀNH TIỀN']);
         if (maxCol === 8) {
            sheet.mergeCells(headerRow.number, 3, headerRow.number, 4);
         }
         applyBorderAndFont(headerRow, true);

         Array.from(new Set(customItems.map(item => item.category))).forEach((cat, groupIdx) => {
            const groupRow = sheet.addRow([String.fromCharCode(65 + groupIdx), translateCategory(cat)]);
            sheet.mergeCells(groupRow.number, 2, groupRow.number, maxCol);
            applyBorderAndFont(groupRow, true);
            groupRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };

            customItems.filter(item => item.category === cat).forEach((item, idx) => {
               const uPrice = getExcelPrice(item.unitPrice);
               const tot = getExcelPrice(item.total);
               const dataRow = sheet.addRow([
                  idx + 1,
                  translateName(item.name),
                  translateDescription(item.description),
                  maxCol === 8 ? '' : translateUnit(item.unit),
                  maxCol === 8 ? translateUnit(item.unit) : item.quantity,
                  maxCol === 8 ? item.quantity : uPrice,
                  maxCol === 8 ? uPrice : tot,
                  maxCol === 8 ? tot : ''
               ]);
               
               if (maxCol === 8) {
                   sheet.mergeCells(dataRow.number, 3, dataRow.number, 4);
                   dataRow.getCell(3).value = translateDescription(item.description);
                   dataRow.getCell(5).value = translateUnit(item.unit);
                   dataRow.getCell(6).value = item.quantity;
                   dataRow.getCell(7).value = uPrice;
                   dataRow.getCell(8).value = tot;
               }

               applyBorderAndFont(dataRow, false);
               dataRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
               dataRow.getCell(3).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
               dataRow.getCell(maxCol - 1).numFmt = numFmt;
               dataRow.getCell(maxCol).numFmt = numFmt;
            });
         });
      }

      if (readyMadeItems.length > 0) {
         if (customItems.length > 0) sheet.addRow([]);

         const titleRow = sheet.addRow([lang === 'en' ? 'PRODUCT LIST & SPECIFICATIONS (READY-MADE)' : lang === 'km' ? 'បញ្ជីផលិតផលស្រាប់' : 'CHI TIẾT DANH SÁCH SẢN PHẨM (HÀNG ĐÓNG SẴN)']);
         sheet.mergeCells(titleRow.number, 1, titleRow.number, maxCol);
         applyBorderAndFont(titleRow, true);
         titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
         titleRow.getCell(1).font = { name: 'Times New Roman', bold: true, size: 12, color: { argb: 'FFFFFFFF' } };

         const headerRow = sheet.addRow([
           lang === 'en' ? 'NO.' : lang === 'km' ? 'ល.រ' : 'STT',
           lang === 'en' ? 'ITEM NAME' : lang === 'km' ? 'ឈ្មោះទំនិញ' : 'TÊN HẠNG MỤC',
           lang === 'en' ? 'IMAGE' : lang === 'km' ? 'រូបភាព' : 'HÌNH ẢNH',
           lang === 'en' ? 'TECHNICAL SPECS' : lang === 'km' ? 'លក្ខណៈបច្ចេកទេស' : 'QC KỸ THUẬT / DIỄN GIẢI',
           lang === 'en' ? 'UNIT' : lang === 'km' ? 'ខ្នាត' : 'ĐVT',
           lang === 'en' ? 'QTY' : lang === 'km' ? 'ចំនួន' : 'SL',
           lang === 'en' ? 'UNIT PRICE (VNĐ/USD)' : lang === 'km' ? 'តម្លៃរាយ (VNĐ/USD)' : 'ĐƠN GIÁ VNĐ / USD',
           lang === 'en' ? 'AMOUNT (VNĐ/USD)' : lang === 'km' ? 'តម្លៃសរុប (VNĐ/USD)' : 'THÀNH TIỀN VNĐ / USD'
         ]);
         applyBorderAndFont(headerRow, true);

         Array.from(new Set(readyMadeItems.map(item => item.category))).forEach((cat, groupIdx) => {
            const groupRow = sheet.addRow([String.fromCharCode(65 + (customItems.length > 0 ? new Set(customItems.map(i => i.category)).size : 0) + groupIdx), translateCategory(cat)]);
            sheet.mergeCells(groupRow.number, 2, groupRow.number, maxCol);
            applyBorderAndFont(groupRow, true);
            groupRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };

            readyMadeItems.filter(item => item.category === cat).forEach((item, idx) => {
               const uPrice = getExcelPrice(item.unitPrice);
               const tot = getExcelPrice(item.total);
               const dataRow = sheet.addRow([
                  idx + 1,
                  translateName(item.name),
                  item.imageUrl ? (lang === 'en' ? '(Has Image)' : lang === 'km' ? '(មានរូបភាព)' : '(Có ảnh)') : '', 
                  translateDescription(item.description),
                  translateUnit(item.unit),
                  item.quantity,
                  uPrice,
                  tot
               ]);
               
               applyBorderAndFont(dataRow, false);
               dataRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
               dataRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
               dataRow.getCell(7).numFmt = numFmt;
               dataRow.getCell(8).numFmt = numFmt;
            });
         });
      }

      const addTotalRow = (label: string, val: number, isBold: boolean) => {
         const row = sheet.addRow([]);
         sheet.mergeCells(row.number, 1, row.number, maxCol - 1);
         row.getCell(1).value = label;
         row.getCell(maxCol).value = getExcelPrice(val);

         applyBorderAndFont(row, isBold);
         row.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };
         row.getCell(maxCol).numFmt = numFmt;
      };

      addTotalRow(lang === 'en' ? 'Subtotal' : lang === 'km' ? 'សរុបរង' : 'CỘNG TIỀN HÀNG', quotation.subTotal, false);
      addTotalRow(lang === 'en' ? 'Discount' : lang === 'km' ? 'ការបញ្ចុះតម្លៃ' : 'GIẢM GIÁ & CHIẾT KHẤU', -quotation.discount, false);
      if (quotation.hasVat) {
          addTotalRow(lang === 'en' ? 'VAT Tax (8%)' : lang === 'km' ? 'ពន្ធ VAT (8%)' : 'THUẾ VAT (8%)', quotation.vatAmount || Math.round((quotation.subTotal - quotation.discount) * 0.08), false);
      }
      addTotalRow(lang === 'en' ? 'TOTAL QUOTATION AMOUNT' : lang === 'km' ? 'តម្លៃសរុបរួម' : 'TỔNG GIÁ TRỊ BÁO GIÁ', quotation.totalAmount, true);
      
      if ((quotation.depositAmount || 0) > 0) {
          addTotalRow(lang === 'en' ? 'Deposit Paid' : lang === 'km' ? 'ប្រាក់កក់បានបង់' : 'ĐÃ ĐẶT CỌC', -quotation.depositAmount!, false);
          addTotalRow(lang === 'en' ? 'REMAINING BALANCE DUE' : lang === 'km' ? 'ចំនួនប្រាក់នៅសល់ត្រូវទូទាត់' : 'CÒN LẠI CẦN THANH TOÁN', quotation.totalAmount - quotation.depositAmount!, true);
      }

      sheet.addRow([]);

      const policyRow = sheet.addRow(
        hasBankInfo 
          ? ['CHÍNH SÁCH VÀ GHI CHÚ', '', '', '', 'THANH TOÁN CHUYỂN KHOẢN']
          : ['CHÍNH SÁCH VÀ GHI CHÚ']
      );
      if (hasBankInfo) {
        sheet.mergeCells(policyRow.number, 1, policyRow.number, 4);
        sheet.mergeCells(policyRow.number, 5, policyRow.number, maxCol);
        policyRow.getCell(5).font = { name: 'Times New Roman', bold: true, size: 11 };
      } else {
        sheet.mergeCells(policyRow.number, 1, policyRow.number, maxCol);
      }
      policyRow.getCell(1).font = { name: 'Times New Roman', bold: true, size: 11 };
      
      const policyTextRow = sheet.addRow(
        hasBankInfo
          ? [
             template.terms || 'Chưa có điều khoản', '', '', '',
             `Ngân hàng: ${template.bankName || quotation.paymentInfo.bankName}\nSố tài khoản: ${template.bankAccount || quotation.paymentInfo.accountNumber}\nChủ tài khoản: ${template.bankAccountName || quotation.paymentInfo.accountHolder}\nNội dung ghi: "${quotation.paymentInfo.content}"`
            ]
          : [template.terms || 'Chưa có điều khoản']
      );
      if (hasBankInfo) {
        sheet.mergeCells(policyTextRow.number, 1, policyTextRow.number, 4);
        sheet.mergeCells(policyTextRow.number, 5, policyTextRow.number, maxCol);
        policyTextRow.getCell(5).alignment = { wrapText: true, vertical: 'top' };
        policyTextRow.getCell(5).font = { name: 'Times New Roman', size: 11 };
      } else {
        sheet.mergeCells(policyTextRow.number, 1, policyTextRow.number, maxCol);
      }
      
      policyTextRow.getCell(1).alignment = { wrapText: true, vertical: 'top' };
      policyTextRow.getCell(1).font = { name: 'Times New Roman', size: 11 };
      policyTextRow.height = 80;

      sheet.addRow([]);
      
      const sloganRow = sheet.addRow([`"${template.companyName.toUpperCase()}\nKiến tạo không gian, nâng tầm cuộc sống"`]);
      sheet.mergeCells(sloganRow.number, 1, sloganRow.number, maxCol);
      sloganRow.getCell(1).alignment = { horizontal: 'center', wrapText: true };
      sloganRow.getCell(1).font = { name: 'Times New Roman', italic: true, size: 14, color: { argb: 'FF888888' } };
      sloganRow.height = 40;

      sheet.addRow([]);

      const signTitleRow = sheet.addRow(['KHÁCH HÀNG XÁC NHẬN', '', '', '', 'ĐẠI DIỆN CÔNG TY']);
      sheet.mergeCells(signTitleRow.number, 1, signTitleRow.number, 3);
      sheet.mergeCells(signTitleRow.number, 4, signTitleRow.number, maxCol);
      signTitleRow.getCell(1).font = { name: 'Times New Roman', bold: true, size: 11, color: { argb: 'FF888888' } };
      signTitleRow.getCell(1).alignment = { horizontal: 'center' };
      signTitleRow.getCell(4).font = { name: 'Times New Roman', bold: true, size: 11, color: { argb: 'FF888888' } };
      signTitleRow.getCell(4).alignment = { horizontal: 'center' };
      
      const signSubtitleRow = sheet.addRow(['KÝ VÀ GHI HỌ TÊN', '', '', '', 'NGƯỜI LẬP BIỂU']);
      sheet.mergeCells(signSubtitleRow.number, 1, signSubtitleRow.number, 3);
      sheet.mergeCells(signSubtitleRow.number, 4, signSubtitleRow.number, maxCol);
      signSubtitleRow.getCell(1).font = { name: 'Times New Roman', bold: true, size: 12 };
      signSubtitleRow.getCell(1).alignment = { horizontal: 'center' };
      signSubtitleRow.getCell(4).font = { name: 'Times New Roman', bold: true, size: 12 };
      signSubtitleRow.getCell(4).alignment = { horizontal: 'center' };

      sheet.addRow([]);
      sheet.addRow([]);
      sheet.addRow([]);

      const dateStr = `Ngày ...... / ...... / 202...`;
      const authorStr = member?.name || (quotation.createdBy === user?.uid ? user?.displayName : 'BAN QUẢN TRỊ');
      const signNameRow = sheet.addRow([dateStr, '', '', '', authorStr]);
      sheet.mergeCells(signNameRow.number, 1, signNameRow.number, 3);
      sheet.mergeCells(signNameRow.number, 4, signNameRow.number, maxCol);
      signNameRow.getCell(1).font = { name: 'Times New Roman', italic: true, size: 11, color: { argb: 'FF888888' } };
      signNameRow.getCell(1).alignment = { horizontal: 'center' };
      signNameRow.getCell(4).font = { name: 'Times New Roman', bold: true, size: 12 };
      signNameRow.getCell(4).alignment = { horizontal: 'center' };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `Bao_Gia_${quotation.quotationNumber || Date.now()}.xlsx`);
      
      toast.success("Đã tải xuống file Excel chuẩn form!");
    } catch (error) {
      console.error("Lỗi khi xuất Excel:", error);
      toast.error("Gặp lỗi khi tải file Excel");
    } finally {
      setIsExporting(false);
    }
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
            <div className="flex items-center rounded-lg border-2 border-purple-200 bg-purple-50/60 p-0.5 shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setLang('vi')}
                className={cn(
                  "h-7 md:h-8 px-2 text-[10px] md:text-xs font-black rounded-md transition-all flex items-center gap-1 cursor-pointer border-none",
                  lang === 'vi' ? "bg-purple-600 text-white shadow-sm" : "text-slate-600 hover:bg-purple-100/60"
                )}
                title="Tiếng Việt"
              >
                🇻🇳 VIE
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={cn(
                  "h-7 md:h-8 px-2 text-[10px] md:text-xs font-black rounded-md transition-all flex items-center gap-1 cursor-pointer border-none",
                  lang === 'en' ? "bg-purple-600 text-white shadow-sm" : "text-slate-600 hover:bg-purple-100/60"
                )}
                title="English"
              >
                🇬🇧 ENG
              </button>
              <button
                type="button"
                onClick={() => setLang('km')}
                className={cn(
                  "h-7 md:h-8 px-2 text-[10px] md:text-xs font-black rounded-md transition-all flex items-center gap-1 cursor-pointer border-none",
                  lang === 'km' ? "bg-purple-600 text-white shadow-sm" : "text-slate-600 hover:bg-purple-100/60"
                )}
                title="Tiếng Campuchia (Khmer)"
              >
                🇰🇭 KHM
              </button>
            </div>

            {lang !== 'vi' && (
              <div className="flex items-center gap-1 bg-amber-50 border-2 border-amber-200 text-amber-800 rounded-lg px-2 py-1 text-[10px] md:text-xs font-bold shadow-sm">
                <span className="whitespace-nowrap">💵 1$ =</span>
                <input
                  type="number"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(Math.max(1, Number(e.target.value) || 25400))}
                  className="w-16 md:w-20 px-1 py-0.5 text-center bg-white border border-amber-300 rounded font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 text-[11px]"
                  title="Nhập tỷ giá 1 USD đổi ra bao nhiêu VNĐ"
                />
                <span className="text-[9px] text-amber-600 font-extrabold">VND</span>
              </div>
            )}

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
               disabled={isExporting || isPreloading}
               className="h-8 md:h-10 px-2 md:px-4 gap-1 md:gap-2 font-bold border-2 border-emerald-100 hover:bg-emerald-50 text-emerald-600 text-[10px] md:text-sm"
            >
              {isExporting || isPreloading ? (
                <Loader2 className="h-3.5 w-3.5 md:h-4 md:w-4 animate-spin" />
              ) : (
                <Share2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
              )}
              <span className="hidden sm:inline">Chia sẻ</span>
              <span className="sm:hidden">Gửi</span>
            </Button>

            <Button variant="outline" size="sm" onClick={handlePrint} disabled={isPreloading} className="h-8 md:h-10 px-2 md:px-4 gap-1 md:gap-2 font-bold border-2 text-[10px] md:text-sm">
              <Printer className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="hidden sm:inline">In báo giá</span>
              <span className="sm:hidden">In</span>
            </Button>
            <Button 
               variant="outline" 
               size="sm" 
               onClick={handleExportExcel}
               disabled={isExporting || isPreloading}
               className="h-8 md:h-10 px-2 md:px-4 gap-1 md:gap-2 font-bold shadow-sm border-2 text-[10px] md:text-sm text-green-700 border-green-200 hover:bg-green-50"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Tải Excel</span>
              <span className="sm:hidden">Excel</span>
            </Button>
            <Button 
               variant="default" 

               size="sm" 
               onClick={handleDownloadPDF}
               disabled={isExporting || isPreloading}
               className="h-8 md:h-10 px-2 md:px-4 gap-1 md:gap-2 font-bold shadow-sm text-[10px] md:text-sm"
            >
              {isExporting || isPreloading ? (
                <Loader2 className="h-3.5 w-3.5 md:h-4 md:w-4 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5 md:h-4 md:w-4" />
              )}
              {isExporting ? 'Đang tạo...' : (isPreloading ? 'Đang tải...' : 'Tải PDF')}
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
                    <div className="text-8xl font-black rotate-[-45deg] tracking-widest uppercase">TỦ 3 MIỀN</div>
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
                                 <span className="text-3xl font-black tracking-tighter" style={{ color: '#BE1E2D', fontFamily: 'Inter, sans-serif' }}>TỦ</span>
                                 <span className="text-4xl font-black mx-1" style={{ color: '#FBB03B', fontFamily: 'Inter, sans-serif' }}>3</span>
                                 <span className="text-3xl font-black tracking-tighter" style={{ color: '#BE1E2D', fontFamily: 'Inter, sans-serif' }}>MIỀN</span>
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
                             {lang === 'en'
                               ? ((quotation.type === 'ready-made' || (readyMadeItems.length > 0 && customItems.length === 0)) ? 'PRODUCT QUOTATION' : 'CONSTRUCTION QUOTATION')
                               : lang === 'km'
                               ? ((quotation.type === 'ready-made' || (readyMadeItems.length > 0 && customItems.length === 0)) ? 'ការសម្រង់តម្លៃផលិតផល' : 'ការសម្រង់តម្លៃការងារសាងសង់')
                               : ((quotation.type === 'ready-made' || (readyMadeItems.length > 0 && customItems.length === 0)) ? 'BÁO GIÁ SẢN PHẨM' : 'BÁO GIÁ THI CÔNG')
                             }
                          </div>
                          <div className="mt-1 flex items-center gap-3">
                             <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">
                                {lang === 'en' ? 'QUOTATION NO:' : lang === 'km' ? 'លេខកូដសម្រង់តម្លៃ:' : 'HỒ SƠ SỐ:'}
                             </span>
                             <span className="text-lg font-mono font-bold text-black">{quotation.quotationNumber.split('-')[1]}</span>
                          </div>
                       </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="p-1 px-2 italic text-[10px] text-gray-600 mb-2 font-medium">
                {lang === 'en'
                  ? `Dear Client: ${template.companyName.toUpperCase()} appreciates ${quotation.customerName || 'valued customer'}'s interest in our products and services. We are pleased to submit our quotation as follows:`
                  : lang === 'km'
                  ? `សូមគោរព៖ ${template.companyName.toUpperCase()} សូមថ្លែងអំណរគុណយ៉ាងជ្រាលជ្រៅចំពោះលោក/លោកស្រី ${quotation.customerName || 'អតិថិជន'} ដែលបានចាប់អារម្មណ៍លើផលិតផល និងសេវាកម្មរបស់យើង។ យើងខ្ញុំសូមផ្ញើជូននូវការសម្រង់តម្លៃដូចខាងក្រោម៖`
                  : `Kính gửi: ${template.companyName.toUpperCase()} xin cảm ơn ${quotation.customerName || 'Quý khách hàng'} đã quan tâm tới sản phẩm của công ty. Chúng tôi xin gửi ${(quotation.type === 'ready-made' || (readyMadeItems.length > 0 && customItems.length === 0)) ? 'báo giá sản phẩm' : 'báo giá thi công thực tế'} như sau:`
                }
              </div>

              {/* Customer Information Grid Style */}
              <table className="w-full border-2 border-black mb-3 text-[11px] table-fixed">
                <tbody>
                  <tr className="border-b border-black">
                    <td className="p-1.5 border-r border-black font-bold bg-gray-50 uppercase text-[9px] tracking-wider w-[15%]">
                       {lang === 'en' ? 'Customer' : lang === 'km' ? 'អតិថិជន' : 'Khách hàng'}
                    </td>
                    <td className="p-1.5 border-r border-black font-bold text-base w-[40%] text-blue-700">{quotation.customerName}</td>
                    <td className="p-1.5 border-r border-black font-bold bg-gray-50 uppercase text-[9px] tracking-wider w-[15%]">
                       {lang === 'en' ? 'Phone' : lang === 'km' ? 'លេខទូរស័ព្ទ' : 'Điện thoại'}
                    </td>
                    <td className="p-1.5 font-mono font-bold text-base">{quotation.phone}</td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="p-1.5 border-r border-black font-bold bg-gray-50 uppercase text-[9px] tracking-wider">
                       {lang === 'en' ? 'Project' : lang === 'km' ? 'គម្រោង' : 'Công trình'}
                    </td>
                    <td className="p-1.5 border-r border-black font-bold lowercase first-letter:uppercase">
                       {quotation.constructionType || (lang === 'en' ? 'Residential Project' : lang === 'km' ? 'ផ្ទះលំនៅដ្ឋាន' : 'Nhà ở dân dụng')}
                    </td>
                    <td className="p-1.5 border-r border-black font-bold bg-gray-50 uppercase text-[9px] tracking-wider">
                       {lang === 'en' ? 'Address' : lang === 'km' ? 'អាសយដ្ឋាន' : 'Địa chỉ'}
                    </td>
                    <td className="p-1.5 font-bold">{quotation.address}</td>
                  </tr>
                  <tr className="bg-gray-100">
                    {(quotation.type === 'ready-made' || (readyMadeItems.length > 0 && customItems.length === 0)) ? (
                      <td colSpan={2} className="p-1.5 border-r border-black font-bold uppercase text-[9px] tracking-wider text-center text-blue-700">
                         {lang === 'en' ? 'Ready-Made Products' : lang === 'km' ? 'ការបញ្ជាទិញផលិតផលស្រាប់' : 'Đơn hàng đóng sẵn'}
                      </td>
                    ) : (
                      <>
                        <td className="p-1.5 border-r border-black font-bold uppercase text-[9px] tracking-wider">
                           {lang === 'en' ? 'Duration' : lang === 'km' ? 'រយៈពេល' : 'Thời gian'}
                        </td>
                        <td className="p-1.5 border-r border-black font-bold">
                           {lang === 'en' ? `${quotation.estimatedTime} working days` : lang === 'km' ? `${quotation.estimatedTime} ថ្ងៃធ្វើការ` : `${quotation.estimatedTime} ngày làm việc`}
                        </td>
                      </>
                    )}
                    <td className="p-1.5 border-r border-black font-bold uppercase text-[9px] tracking-wider">
                       {lang === 'en' ? 'Date' : lang === 'km' ? 'កាលបរិច្ឆេទ' : 'Ngày báo giá'}
                    </td>
                    <td className="p-1.5 font-bold">{format(new Date(quotation.date), 'dd/MM/yyyy')}</td>
                  </tr>
                </tbody>
              </table>

              {/* Custom Items Table */}
              {customItems.length > 0 && (
                <>
                  <div className="bg-black text-white text-center font-bold text-xs py-1.5 uppercase tracking-[0.3em] mb-0 border-x-2 border-t-2 border-black">
                     {lang === 'en' ? 'DETAILED SCOPE OF WORK & CUSTOM FURNITURE' : lang === 'km' ? 'ព័ត៌មានលម្អិតអំពីការងារសាងសង់ និងគ្រឿងសង្ហារិម' : 'CHI TIẾT HẠNG MỤC THI CÔNG'}
                  </div>
                  <table className="w-full border-2 border-black text-[11px] table-fixed mb-4">
                    <thead>
                      <tr className="bg-gray-100 font-bold uppercase text-[8px] tracking-widest border-b-2 border-black text-black">
                        <th className="border-r border-black p-1 w-[35px]">{lang === 'en' ? 'No.' : lang === 'km' ? 'ល.រ' : 'STT'}</th>
                        <th className="border-r border-black p-1 w-[130px]">{lang === 'en' ? 'Item Name' : lang === 'km' ? 'ឈ្មោះទំនិញ' : 'Tên hạng mục'}</th>
                        <th className="border-r border-black p-1">{lang === 'en' ? 'Technical Specs & Description' : lang === 'km' ? 'លក្ខណៈបច្ចេកទេស / ការពិពណ៌នា' : 'QC kỹ thuật / Diễn giải'}</th>
                        <th className="border-r border-black p-1 w-[40px]">{lang === 'en' ? 'Unit' : lang === 'km' ? 'ខ្នាត' : 'ĐVT'}</th>
                        <th className="border-r border-black p-1 w-[40px]">{lang === 'en' ? 'Qty' : lang === 'km' ? 'ចំនួន' : 'SL'}</th>
                        <th className="border-r border-black p-1 w-[90px]">{lang === 'en' ? 'Unit Price ($)' : lang === 'km' ? 'តម្លៃរាយ ($)' : 'Đơn giá'}</th>
                        <th className="border-black p-1 w-[100px]">{lang === 'en' ? 'Amount ($)' : lang === 'km' ? 'តម្លៃសរុប ($)' : 'Thành tiền'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from(new Set(customItems.map(item => item.category))).map((cat, groupIdx) => (
                        <React.Fragment key={cat}>
                          <tr className="bg-gray-200 font-bold border-b border-black">
                            <td className="border-r border-black p-1 text-center">{String.fromCharCode(65 + groupIdx)}</td>
                            <td colSpan={6} className="p-1 px-2 uppercase tracking-[0.2em] text-[10px]">
                              {translateCategory(cat)}
                            </td>
                          </tr>
                          {customItems.filter(item => item.category === cat).map((item, idx) => (
                            <tr key={item.id} className="border-b border-black last:border-b-0">
                              <td className="border-r border-black p-1 text-center text-gray-500 font-bold">{idx + 1}</td>
                              <td className="border-r border-black p-1.5 font-bold text-black leading-tight">{translateName(item.name)}</td>
                              <td className="border-r border-black p-1.5 text-gray-700 leading-normal text-[10.5px]">
                                <div className="whitespace-pre-wrap">{translateDescription(item.description)}</div>
                              </td>
                              <td className="border-r border-black p-1 text-center font-bold text-gray-500 text-[9px]">{translateUnit(item.unit)}</td>
                              <td className="border-r border-black p-1 text-center font-bold">{item.quantity}</td>
                              <td className="border-r border-black p-1.5 text-right font-mono text-gray-600">{formatPrice(item.unitPrice)}</td>
                              <td className="p-1.5 text-right font-mono font-bold bg-gray-50">{formatPrice(item.total)}</td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                    {readyMadeItems.length === 0 && (
                      <TotalsFooter quotation={quotation} colSpan={5} lang={lang} exchangeRate={exchangeRate} formatPrice={formatPrice} isDualCurrency={false} />
                    )}
                  </table>
                </>
              )}

              {/* Ready Made Items Table */}
              {readyMadeItems.length > 0 && (
                <>
                  <div className={`bg-black text-white text-center font-bold text-xs py-1.5 uppercase tracking-[0.3em] mb-0 border-x-2 border-t-2 border-black ${customItems.length > 0 ? 'mt-4' : ''}`}>
                     {lang === 'en' ? 'PRODUCT LIST & SPECIFICATIONS (READY-MADE)' : lang === 'km' ? 'បញ្ជីផលិតផលស្រាប់' : 'CHI TIẾT DANH SÁCH SẢN PHẨM (HÀNG ĐÓNG SẴN)'}
                  </div>
                  <table className="w-full border-2 border-black text-[11px] table-fixed">
                    <thead>
                      <tr className="bg-gray-100 font-bold uppercase text-[8px] tracking-widest border-b-2 border-black text-black">
                        <th className="border-r border-black p-1 w-[35px]">{lang === 'en' ? 'No.' : lang === 'km' ? 'ល.រ' : 'STT'}</th>
                        <th className="border-r border-black p-1 w-[130px]">{lang === 'en' ? 'Item Name' : lang === 'km' ? 'ឈ្មោះទំនិញ' : 'Tên hạng mục'}</th>
                        <th className="border-r border-black p-1 w-[80px]">{lang === 'en' ? 'Image' : lang === 'km' ? 'រូបភាព' : 'Hình ảnh'}</th>
                        <th className="border-r border-black p-1">{lang === 'en' ? 'Technical Specs & Description' : lang === 'km' ? 'លក្ខណៈបច្ចេកទេស / ការពិពណ៌នា' : 'QC kỹ thuật / Diễn giải'}</th>
                        <th className="border-r border-black p-1 w-[40px]">{lang === 'en' ? 'Unit' : lang === 'km' ? 'ខ្នាត' : 'ĐVT'}</th>
                        <th className="border-r border-black p-1 w-[40px]">{lang === 'en' ? 'Qty' : lang === 'km' ? 'ចំនួន' : 'SL'}</th>
                        <th className="border-r border-black p-1 w-[90px]">{lang === 'en' ? 'Unit Price ($)' : lang === 'km' ? 'តម្លៃរាយ ($)' : 'Đơn giá VNĐ'}</th>
                        <th className="border-black p-1 w-[100px]">{lang === 'en' ? 'Amount ($)' : lang === 'km' ? 'តម្លៃសរុប ($)' : 'Đơn giá USD'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from(new Set(readyMadeItems.map(item => item.category))).map((cat, groupIdx) => (
                        <React.Fragment key={cat}>
                          <tr className="bg-gray-200 font-bold border-b border-black">
                            <td className="border-r border-black p-1 text-center">{String.fromCharCode(customItems.length > 0 ? 65 + new Set(customItems.map(i => i.category)).size + groupIdx : 65 + groupIdx)}</td>
                            <td colSpan={7} className="p-1 px-2 uppercase tracking-[0.2em] text-[10px]">
                              {translateCategory(cat)}
                            </td>
                          </tr>
                          {readyMadeItems.filter(item => item.category === cat).map((item, idx) => (
                            <tr key={item.id} className="border-b border-black last:border-b-0">
                              <td className="border-r border-black p-1 text-center text-gray-500 font-bold">{idx + 1}</td>
                              <td className="border-r border-black p-1.5 font-bold text-black leading-tight">{translateName(item.name)}</td>
                              <td className="border-r border-black p-1 text-center">
                                {item.imageUrl ? (
                                  <img src={item.imageUrl} alt={item.name} className="w-full max-w-[70px] mx-auto h-auto object-contain rounded" style={{ maxHeight: '70px' }} referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="w-[60px] h-[60px] mx-auto bg-gray-100 flex items-center justify-center text-[8px] text-gray-400 rounded">
                                    {lang === 'en' ? 'No Image' : lang === 'km' ? 'គ្មានរូបភាព' : 'Không có ảnh'}
                                  </div>
                                )}
                              </td>
                              <td className="border-r border-black p-1.5 text-gray-700 leading-normal text-[10.5px]">
                                <div className="whitespace-pre-wrap">{translateDescription(item.description)}</div>
                              </td>
                              <td className="border-r border-black p-1 text-center font-bold text-gray-500 text-[9px]">{translateUnit(item.unit)}</td>
                              <td className="border-r border-black p-1 text-center font-bold">{item.quantity}</td>
                              <td className="border-r border-black p-1.5 text-right font-mono text-gray-600">{formatVnd(item.unitPrice)}</td>
                              <td className="p-1.5 text-right font-mono font-bold bg-gray-50 text-blue-700">{formatUsd(item.unitPrice)}</td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                    <TotalsFooter quotation={quotation} colSpan={6} lang={lang} exchangeRate={exchangeRate} formatVnd={formatVnd} formatUsd={formatUsd} isDualCurrency={true} />
                  </table>
                </>
              )}

              {/* Policy & Payment Section */}
              <div className="mt-4 grid grid-cols-2 gap-4 items-start">
                 <div className={cn("space-y-2", !hasBankInfo && "col-span-2")}>
                    <div className="flex items-center gap-2 font-bold text-black uppercase tracking-widest text-[10px] border-b border-black pb-1">
                       {lang === 'en' ? 'TERMS & CONDITIONS' : lang === 'km' ? 'លក្ខខណ្ឌ និងចំណាំ' : 'CHÍNH SÁCH VÀ GHI CHÚ'}
                    </div>
                    <div className="text-[10px] text-black whitespace-pre-line leading-relaxed pl-1 pt-1 font-medium">
                       {template.terms || (lang === 'en' ? 'No terms specified' : lang === 'km' ? 'មិនទាន់មានលក្ខខណ្ឌ' : 'Chưa có điều khoản')}
                    </div>
                 </div>
                 {hasBankInfo && (
                   <div className="space-y-2">
                      <div className="flex items-center gap-2 font-bold text-black uppercase tracking-widest text-[10px] border-b border-black pb-1">
                         {lang === 'en' ? 'BANK TRANSFER PAYMENT' : lang === 'km' ? 'ការទូទាត់តាមធនាគារ' : 'THANH TOÁN CHUYỂN KHOẢN'}
                      </div>
                      <div className="bg-gray-50 p-2 rounded-sm border border-gray-200 space-y-1 text-[10px] relative">
                         <div className="flex justify-between items-center relative z-10 w-2/3">
                            <span className="text-gray-500 font-bold uppercase text-[8px]">{lang === 'en' ? 'Bank Name' : lang === 'km' ? 'ធនាគារ' : 'Ngân hàng'}</span>
                            <span className="font-bold text-black text-right">{template.bankName || quotation.paymentInfo.bankName}</span>
                         </div>
                         <div className="flex justify-between items-center relative z-10 w-2/3">
                            <span className="text-gray-500 font-bold uppercase text-[8px]">{lang === 'en' ? 'Account No.' : lang === 'km' ? 'លេខគណនី' : 'Số tài khoản'}</span>
                            <span className="font-mono font-bold text-sm tracking-tighter text-primary text-right">{template.bankAccount || quotation.paymentInfo.accountNumber}</span>
                         </div>
                         <div className="flex justify-between items-center relative z-10 w-2/3">
                            <span className="text-gray-500 font-bold uppercase text-[8px]">{lang === 'en' ? 'Account Holder' : lang === 'km' ? 'ឈ្មោះម្ចាស់គណនី' : 'Chủ tài khoản'}</span>
                            <span className="font-bold text-black uppercase tracking-tight text-right">{template.bankAccountName || quotation.paymentInfo.accountHolder}</span>
                         </div>
                         {template.qrCodeUrl && (
                           <div className="absolute right-2 top-2 bottom-2 w-16 bg-white border border-gray-200 p-0.5 z-20 flex items-center justify-center">
                              <img src={qrCodeDataUrl || template.qrCodeUrl} alt="QR Code" className="max-h-full max-w-full object-contain" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                           </div>
                         )}
                      </div>
                      <p className="text-[9px] italic text-gray-500 font-medium leading-tight">
                        {lang === 'en' ? 'Payment Ref:' : lang === 'km' ? 'ខ្លឹមសារទូទាត់៖' : 'Nội dung ghi:'} <span className="font-bold text-black uppercase tracking-tighter">"{quotation.paymentInfo.content}"</span>
                      </p>
                   </div>
                 )}
              </div>

              <div className="mt-3 text-center opacity-70">
                 <div className="font-serif italic text-xs px-10 text-gray-400 leading-normal">
                   <p>
                     {lang === 'en' 
                       ? `"${template.companyName.toUpperCase()} — Creating Spaces, Elevating Living Standard"`
                       : lang === 'km'
                       ? `"${template.companyName.toUpperCase()} — បង្កើតលំហរ រំលេចជីវិតទាន់សម័យ"`
                       : `"${template.companyName.toUpperCase()} — Kiến tạo không gian, nâng tầm cuộc sống"`
                     }
                   </p>
                 </div>
              </div>

              {/* Signature Section */}
              <div className="mt-3 flex justify-between px-10">
                 <div className="text-center space-y-1 w-1/3">
                    <p className="text-[9px] font-bold uppercase text-gray-400 tracking-wider">
                       {lang === 'en' ? 'Client Confirmation' : lang === 'km' ? 'ការបញ្ជាក់ពីអតិថិជន' : 'Khách hàng xác nhận'}
                    </p>
                    <p className="text-sm font-bold text-black">
                       {lang === 'en' ? 'SIGN & FULL NAME' : lang === 'km' ? 'ហត្ថលេខា និងឈ្មោះពេញ' : 'KÝ VÀ GHI HỌ TÊN'}
                    </p>
                    <div className="h-10" />
                    <p className="text-[9px] font-medium text-gray-500 italic pt-1 px-4 border-t border-gray-200 items-center justify-center flex gap-1">
                      <Download className="h-3 w-3" /> {lang === 'en' ? 'Date ...... / ...... / 202...' : lang === 'km' ? 'ថ្ងៃទី ...... / ...... / 202...' : 'Ngày ...... / ...... / 202...'}
                    </p>
                 </div>
                 
                 {template.companyWebsite ? (
                   <div className="w-1/3 flex flex-col items-center justify-center pt-2">
                     <a 
                       href={template.companyWebsite.trim().startsWith('http') ? template.companyWebsite.trim() : `https://${template.companyWebsite.trim()}`} 
                       target="_blank" 
                       rel="noopener noreferrer"
                       className="cursor-pointer hover:scale-105 transition-transform duration-200"
                     >
                       {websiteQrCodeDataUrl ? (
                         <img src={websiteQrCodeDataUrl} alt="Website QR Code" className="w-16 h-16 object-contain mix-blend-multiply opacity-80" />
                       ) : (
                         <div className="w-16 h-16 border border-dashed border-gray-300 flex items-center justify-center text-[6px] text-gray-400">QR CODE</div>
                       )}
                     </a>
                     <span className="text-[8px] uppercase tracking-widest text-gray-400 mt-1 font-bold">
                        {lang === 'en' ? 'Visit Website' : lang === 'km' ? 'ចូលមើលគេហទំព័រ' : 'Truy cập Website'}
                     </span>
                   </div>
                 ) : (
                   <div className="w-1/3" />
                 )}

                 <div className="text-center space-y-1 w-1/3">
                    <p className="text-[9px] font-bold uppercase text-gray-400 tracking-wider">
                       {lang === 'en' ? 'Company Representative' : lang === 'km' ? 'តំណាងក្រុមហ៊ុន' : 'Đại diện Công ty'}
                    </p>
                    <p className="text-sm font-bold text-black uppercase">
                       {lang === 'en' ? 'PREPARED BY' : lang === 'km' ? 'អ្នករៀបចំ' : 'NGƯỜI LẬP BIỂU'}
                    </p>
                    <div className="h-10 flex items-center justify-center relative">
                    </div>
                    <p className="font-bold text-gray-950 text-sm border-t border-gray-200 pt-1 px-4">
                       {member?.name || (quotation.createdBy === user?.uid ? user?.displayName : (lang === 'en' ? 'MANAGEMENT' : lang === 'km' ? 'ក្រុមប្រឹក្សាភិបាល' : 'BAN QUẢN TRỊ'))}
                    </p>
                 </div>
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
