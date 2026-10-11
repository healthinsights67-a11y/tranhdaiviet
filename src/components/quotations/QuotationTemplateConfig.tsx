import React, { useState, useEffect, useRef } from 'react';
import { Settings, Upload, Save, X, Trash2, Building, Landmark, CheckSquare, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { uploadToImgBB } from '@/src/services/uploadService';
import { cn } from '@/src/lib/utils';
import html2canvas from 'html2canvas';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db, doc, getDoc, setDoc } from '@/src/lib/firebase';
import { getNormalizedWorkshopId } from '@/src/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface QuotationTemplate {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyWebsite: string;
  logoUrl: string;
  bankName: string;
  bankAccount: string;
  bankAccountName: string;
  qrCodeUrl: string;
  terms: string;
}

export const defaultTemplate: QuotationTemplate = {
  companyName: 'TRANH ĐẠI VIỆT',
  companyAddress: '',
  companyPhone: '',
  companyEmail: '',
  companyWebsite: '',
  logoUrl: '',
  bankName: '',
  bankAccount: '',
  bankAccountName: '',
  qrCodeUrl: '',
  terms: '- Tạm ứng 30% ngay sau khi ký hợp đồng.\n- Thanh toán 70% còn lại trước khi giao hàng.\n- Báo giá có giá trị trong vòng 15 ngày.',
};

export const QuotationTemplateConfig = ({ trigger, currentUser }: { trigger?: React.ReactNode, currentUser?: any }) => {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<QuotationTemplate>(defaultTemplate);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingQR, setIsUploadingQR] = useState(false);

  const userWorkshop = currentUser?.workshop && currentUser?.workshop !== 'all' ? getNormalizedWorkshopId(currentUser.workshop) : 'Hà Nội';
  const [selectedWorkshop, setSelectedWorkshop] = useState<string>(userWorkshop);

  // Sync selectedWorkshop when currentUser's workshop updates
  useEffect(() => {
    if (currentUser?.workshop && currentUser?.workshop !== 'all') {
      setSelectedWorkshop(getNormalizedWorkshopId(currentUser.workshop));
    }
  }, [currentUser]);

  const queryClient = useQueryClient();
  const { data: dbConfig } = useQuery<QuotationTemplate>({
    queryKey: ['quotation_template_config', selectedWorkshop],
    queryFn: async () => {
      const docRef = doc(db, 'configs', `quotation_template_${selectedWorkshop}`);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.companyName?.includes('PLASTIHOME') || data.companyName === 'CÔNG TY TNHH ABC') {
          await setDoc(docRef, defaultTemplate);
          return defaultTemplate;
        }
        return { ...defaultTemplate, ...data } as QuotationTemplate;
      }
      
      // Fallback to global config
      const globalRef = doc(db, 'configs', 'quotation_template');
      const globalSnap = await getDoc(globalRef);
      if (globalSnap.exists()) {
        const globalData = globalSnap.data();
        return { ...defaultTemplate, ...globalData } as QuotationTemplate;
      }
      
      // Fallback to localStorage if no Firestore data yet
      const saved = localStorage.getItem(`quotation_template_config_${selectedWorkshop}`);
      if (saved && saved.trim() !== 'undefined' && saved.trim() !== 'null') {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') {
            return { ...defaultTemplate, ...parsed } as QuotationTemplate;
          }
        } catch (e) {
          console.error('Failed to parse saved config', e);
        }
      }
      return defaultTemplate;
    },
    staleTime: Infinity
  });

  useEffect(() => {
    if (dbConfig) {
      setConfig(dbConfig);
    }
  }, [dbConfig, open]);

  const handleChange = (field: keyof QuotationTemplate, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      const docRef = doc(db, 'configs', `quotation_template_${selectedWorkshop}`);
      await setDoc(docRef, config);
      localStorage.setItem(`quotation_template_config_${selectedWorkshop}`, JSON.stringify(config));
      queryClient.setQueryData(['quotation_template_config', selectedWorkshop], config);
      toast.success(`Đã lưu cấu hình biểu mẫu báo giá cho cơ sở ${selectedWorkshop} lên hệ thống!`);
      setOpen(false);
    } catch (error) {
      console.error('Failed to save config', error);
      toast.error('Có lỗi xảy ra khi lưu cấu hình lên hệ thống.');
    }
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>, field: 'logoUrl' | 'qrCodeUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Kích thước ảnh quá lớn (tối đa 10MB)');
      return;
    }

    const setUploading = field === 'logoUrl' ? setIsUploadingLogo : setIsUploadingQR;
    
    try {
      setUploading(true);
      const url = await uploadToImgBB(file);
      if (url) {
        handleChange(field, url);
        toast.success(`Tải ảnh ${field === 'logoUrl' ? 'Logo' : 'QR Code'} lên thành công!`);
      }
    } catch (error) {
      console.error('Lỗi khi tải ảnh:', error);
      toast.error('Có lỗi xảy ra khi tải ảnh lên.');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (field: 'logoUrl' | 'qrCodeUrl') => {
    handleChange(field, '');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger 
        render={(trigger || (
          <Button variant="outline" className="h-10 md:h-12 px-4 rounded-xl shadow-sm gap-2 text-xs md:text-sm">
            <Settings className="w-4 h-4" />
            <span className="hidden md:inline">Cấu hình biểu mẫu</span>
          </Button>
        )) as React.ReactElement}
      />
      
      <DialogContent className="max-w-[100vw] lg:max-w-6xl p-0 h-[100dvh] sm:h-[90vh] md:h-[85vh] sm:max-w-[95vw] !rounded-none sm:!rounded-2xl flex flex-col gap-0 overflow-hidden bg-background">
        <DialogHeader className="px-5 py-4 border-b border-border bg-card pr-12 md:pr-6 shrink-0">
          <DialogTitle className="text-lg md:text-xl font-bold flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary shrink-0" />
            Cấu hình Mẫu Báo Giá
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 min-h-0">
          {/* CỘT TRÁI: Form Cấu hình */}
          <div className="h-full w-full overflow-y-auto border-r border-border bg-muted/20">
            <div className="p-6 space-y-8">
              
              {(!currentUser?.workshop || currentUser?.workshop === 'all') ? (
                <div className="space-y-2 mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Chọn Cơ sở cấu hình</Label>
                  <Select value={selectedWorkshop} onValueChange={setSelectedWorkshop}>
                    <SelectTrigger className="h-10 w-full rounded-xl bg-card border-slate-200 text-xs font-bold px-4">
                      <SelectValue placeholder="Chọn cơ sở" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-gray-100 shadow-xl">
                      <SelectItem value="Hà Nội" className="rounded-lg font-medium">Hà Nội</SelectItem>
                      <SelectItem value="Cần Thơ" className="rounded-lg font-medium">Cần Thơ</SelectItem>
                      <SelectItem value="Đồng Nai" className="rounded-lg font-medium">Đồng Nai</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="p-3 bg-primary/5 border border-primary/20 text-primary text-[10px] font-black rounded-xl mb-6 text-center uppercase tracking-widest">
                  Cơ sở cấu hình: {selectedWorkshop}
                </div>
              )}

              {/* Section: Thông tin doanh nghiệp */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  Thông tin doanh nghiệp
                </h3>
                
                <div className="p-4 bg-card rounded-xl border border-border shadow-sm space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Tên công ty / Thương hiệu</Label>
                    <Input 
                      placeholder="CÔNG TY TNHH ABC..." 
                      value={config.companyName} 
                      onChange={(e) => handleChange('companyName', e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Địa chỉ</Label>
                    <Input 
                      placeholder="Nhập địa chỉ..." 
                      value={config.companyAddress} 
                      onChange={(e) => handleChange('companyAddress', e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Số điện thoại</Label>
                      <Input 
                        placeholder="0909..." 
                        value={config.companyPhone} 
                        onChange={(e) => handleChange('companyPhone', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Email</Label>
                      <Input 
                        placeholder="contact@abc.vn" 
                        value={config.companyEmail} 
                        onChange={(e) => handleChange('companyEmail', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Website</Label>
                    <Input 
                      placeholder="www.abc.vn" 
                      value={config.companyWebsite} 
                      onChange={(e) => handleChange('companyWebsite', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Section: Nhận diện thương hiệu & Logo */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  Nhận diện thương hiệu (Logo)
                </h3>
                
                <div className="p-4 bg-card rounded-xl border border-border shadow-sm">
                  {config.logoUrl ? (
                    <div className="relative group w-32 h-32 border border-border rounded-lg bg-white flex items-center justify-center p-2">
                      <img src={config.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                        <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => removeImage('logoUrl')}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full">
                      <Label htmlFor="logo-upload" className="cursor-pointer flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                        {isUploadingLogo ? (
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs font-medium">Đang tải lên...</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Upload className="w-8 h-8 opacity-50" />
                            <span className="text-xs font-medium">Nhấn để tải Logo lên</span>
                          </div>
                        )}
                      </Label>
                      <Input 
                        id="logo-upload" 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => handleUploadImage(e, 'logoUrl')}
                        disabled={isUploadingLogo}
                      />
                    </div>
                  )}
                </div>
              </div>

               {/* Section: Thông tin thanh toán */}
               <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Landmark className="w-4 h-4" />
                  Thông tin thanh toán
                </h3>
                
                <div className="p-4 bg-card rounded-xl border border-border shadow-sm space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Ngân hàng</Label>
                      <Input 
                        placeholder="Vietcombank" 
                        value={config.bankName} 
                        onChange={(e) => handleChange('bankName', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Số tài khoản</Label>
                      <Input 
                        placeholder="0123456789" 
                        value={config.bankAccount} 
                        onChange={(e) => handleChange('bankAccount', e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Chủ tài khoản</Label>
                    <Input 
                      placeholder="CONG TY TNHH ABC" 
                      value={config.bankAccountName} 
                      onChange={(e) => handleChange('bankAccountName', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2 pt-2 border-t border-border">
                     <Label className="text-xs font-semibold mb-2 block">Mã QR Thanh toán</Label>
                     {config.qrCodeUrl ? (
                      <div className="relative group w-32 h-32 border border-border rounded-lg bg-white flex items-center justify-center p-2">
                        <img src={config.qrCodeUrl} alt="QR Code" className="max-w-full max-h-full object-contain" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                          <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => removeImage('qrCodeUrl')}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full">
                        <Label htmlFor="qr-upload" className="cursor-pointer flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                          {isUploadingQR ? (
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                              <span className="text-xs font-medium">Đang tải lên...</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                              <Upload className="w-8 h-8 opacity-50" />
                              <span className="text-xs font-medium">Tải mã QR Code lên</span>
                            </div>
                          )}
                        </Label>
                        <Input 
                          id="qr-upload" 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => handleUploadImage(e, 'qrCodeUrl')}
                          disabled={isUploadingQR}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

               {/* Section: Điều khoản */}
               <div className="space-y-4 pb-8">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <CheckSquare className="w-4 h-4" />
                  Điều khoản & Ghi chú
                </h3>
                
                <div className="p-4 bg-card rounded-xl border border-border shadow-sm">
                  <Textarea 
                    rows={6}
                    placeholder="- Tạm ứng 50%..."
                    value={config.terms}
                    onChange={(e) => handleChange('terms', e.target.value)}
                    className="resize-none"
                  />
                  <p className="text-[10px] text-muted-foreground mt-2">Nội dung này sẽ tự động được thêm vào cuối mỗi báo giá khi in/xuất PDF.</p>
                </div>
              </div>

            </div>
          </div>

          {/* CỘT PHẢI: Live Preview A4 */}
          <div className="bg-muted p-4 md:p-8 flex items-start justify-center overflow-y-auto">
            <div className="w-full max-w-[210mm] bg-white text-black shadow-2xl p-6 md:p-10 shrink-0 min-h-[297mm] relative origin-top scale-[0.6] sm:scale-[0.8] lg:scale-100 transition-transform">
              
              {/* Preview Header */}
              <div className="flex justify-between items-start border-b-2 border-gray-100 pb-6 mb-6">
                 {/* Logo */}
                 <div className="w-32 h-16 bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center shrink-0">
                    {config.logoUrl ? (
                      <img src={config.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <span className="text-xs text-gray-400 font-medium">LOGO</span>
                    )}
                 </div>
                 {/* Company Info */}
                 <div className="text-right flex-1 ml-6">
                    <h2 className="text-base font-black text-gray-900 uppercase">
                      {config.companyName || 'TÊN CÔNG TY'}
                    </h2>
                    <p className="text-xs text-gray-600 mt-1">{config.companyAddress}</p>
                    <div className="text-[10px] text-gray-500 mt-1">
                      {config.companyPhone && <span>Tel: {config.companyPhone}</span>}
                      {config.companyEmail && <span className="ml-2">| Email: {config.companyEmail}</span>}
                      {config.companyWebsite && <span className="ml-2">| Web: {config.companyWebsite}</span>}
                    </div>
                 </div>
              </div>

              {/* Title & Mock Info */}
              <div className="text-center mb-8">
                <h1 className="text-2xl font-black text-gray-900 uppercase tracking-widest">BÁO GIÁ SẢN PHẨM</h1>
                <p className="text-xs text-gray-500 mt-1">Số: BG-2026-0501 | Ngày: 16/05/2026</p>
              </div>

              {/* Mock Table */}
              <div className="mb-8 opacity-50 grayscale pointer-events-none">
                 <table className="w-full border-collapse border border-gray-200 text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="p-2 border-r border-gray-200">STT</th>
                        <th className="p-2 border-r border-gray-200 text-left">Tên sản phẩm</th>
                        <th className="p-2 border-r border-gray-200">SL</th>
                        <th className="p-2 border-r border-gray-200">Đơn giá VNĐ</th>
                        <th className="p-2">Đơn giá USD</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-200">
                        <td className="p-2 border-r border-gray-200 text-center">1</td>
                        <td className="p-2 border-r border-gray-200">Tủ bếp Acrylic chữ L</td>
                        <td className="p-2 border-r border-gray-200 text-center">1</td>
                        <td className="p-2 border-r border-gray-200 text-right">Mẫu mờ</td>
                        <td className="p-2 text-right font-bold">Mẫu mờ</td>
                      </tr>
                    </tbody>
                 </table>
              </div>

              {/* Footer / Terms / Payment */}
              <div className="grid grid-cols-2 gap-8 mt-auto pt-8 border-t border-gray-100">
                {/* Bank Info */}
                <div>
                   <h4 className="text-xs font-bold text-gray-900 uppercase mb-2">Thông tin thanh toán</h4>
                   <div className="text-xs text-gray-600 space-y-1">
                     <p><span className="font-medium">Ngân hàng:</span> {config.bankName}</p>
                     <p><span className="font-medium">Số tài khoản:</span> <span className="font-bold text-gray-900">{config.bankAccount}</span></p>
                     <p><span className="font-medium">Chủ tài khoản:</span> {config.bankAccountName}</p>
                   </div>
                   {config.qrCodeUrl && (
                     <div className="mt-3 w-24 h-24 border border-gray-200 p-1 bg-white">
                        <img src={config.qrCodeUrl} className="w-full h-full object-cover" alt="QR" />
                     </div>
                   )}
                </div>

                {/* Terms */}
                <div>
                  <h4 className="text-xs font-bold text-gray-900 uppercase mb-2">Điều khoản & Ghi chú</h4>
                  <div className="text-[10px] text-gray-600 whitespace-pre-line leading-relaxed">
                    {config.terms || 'Chưa có điều khoản'}
                  </div>
                </div>
              </div>

              <div className="mt-16 flex justify-between text-center pb-8">
                 <div className="w-1/3">
                    <p className="text-xs font-bold uppercase">Khách hàng</p>
                    <p className="text-[10px] text-gray-400 mt-1 italic">(Ký & ghi rõ họ tên)</p>
                 </div>
                 <div className="w-1/3">
                    <p className="text-xs font-bold uppercase">Người báo giá</p>
                    <p className="text-[10px] text-gray-400 mt-1 italic">(Ký & ghi rõ họ tên)</p>
                 </div>
              </div>

            </div>
          </div>
        </div>

        <DialogFooter className="px-4 md:px-6 py-4 border-t border-border bg-card flex flex-col-reverse sm:flex-row justify-between items-center w-full gap-3">
          <Button type="button" variant="secondary" onClick={() => setConfig(defaultTemplate)} className="rounded-xl gap-2 w-full sm:w-auto text-xs md:text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200">
            <RefreshCw className="w-4 h-4" />
            Điền nhanh thông tin Tranh Đại Việt
          </Button>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl flex-1 sm:flex-none">Hủy</Button>
            <Button onClick={handleSave} className="rounded-xl px-6 gap-2 flex-1 sm:flex-none">
              <Save className="w-4 h-4" />
              Lưu Cấu Hình
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
