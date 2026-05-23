import * as React from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Calculator,
  User,
  Phone,
  MapPin,
  Clock,
  Briefcase,
  FileText,
  ChevronDown,
  Info,
  Package,
  Search,
  Image as ImageIcon,
  ImagePlus,
  Loader2
} from 'lucide-react';
import { uploadToImgBB } from '@/src/services/uploadService';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectLabel,
  SelectSeparator,
} from "@/components/ui/select";
import { Quotation, QuotationItem, Customer, ProductLibraryItem } from '@/src/types';
import { cn, getCurrentVNYear, getCurrentVNDateString } from '@/src/lib/utils';
import { STANDARD_PRICES } from '@/src/constants/priceList';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface QuotationFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Quotation, 'id'>) => void;
  customers: Customer[];
  initialData?: Quotation | null;
  products?: ProductLibraryItem[];
}

const DEFAULT_ITEMS: QuotationItem[] = [
  {
    id: '1',
    category: 'Phòng bếp',
    name: 'Tủ bếp dưới Khung bê tông',
    description: '- Chất liệu khung cánh ECOPLAST\n- Bản lề hơi giảm chấn\n- Hậu alu',
    unit: 'md',
    quantity: 1,
    unitPrice: 2200000,
    total: 2200000
  }
];

export function QuotationForm({ isOpen, onClose, onSubmit, customers, initialData, products = [] }: QuotationFormProps) {
  const [formData, setFormData] = React.useState<Omit<Quotation, 'id'>>({
    quotationNumber: initialData?.quotationNumber || `BG-${getCurrentVNYear()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
    customerName: initialData?.customerName || '',
    phone: initialData?.phone || '',
    address: initialData?.address || '',
    constructionType: initialData?.constructionType || '',
    estimatedTime: initialData?.estimatedTime || '5',
    date: initialData?.date || getCurrentVNDateString(),
    items: initialData?.items || [],
    subTotal: initialData?.subTotal || 0,
    discount: initialData?.discount || 0,
    totalAmount: initialData?.totalAmount || 0,
    paymentInfo: initialData?.paymentInfo || {
      bankName: 'Techcombank',
      accountNumber: '19070004987011',
      accountHolder: 'Nguyễn Thị Mai Phương',
      content: 'Chuyển khoản'
    },
    createdBy: initialData?.createdBy || '',
    createdAt: initialData?.createdAt || new Date().toISOString(),
    status: initialData?.status || 'draft',
    customerId: initialData?.customerId || '',
    imageUrls: initialData?.imageUrls || []
  });

  const [isProductPickerOpen, setIsProductPickerOpen] = React.useState(false);
  const [pickerSearchTerm, setPickerSearchTerm] = React.useState('');
  const [pickerUnitFilter, setPickerUnitFilter] = React.useState('all');

  const filteredLibraryProducts = products.filter(p => {
    const matchesSearch = p.productName.toLowerCase().includes(pickerSearchTerm.toLowerCase()) || 
                         p.description.toLowerCase().includes(pickerSearchTerm.toLowerCase());
    const matchesUnit = pickerUnitFilter === 'all' || p.unit === pickerUnitFilter;
    return matchesSearch && matchesUnit;
  });

  const handleSelectFromLibrary = (product: ProductLibraryItem) => {
    const newItem: QuotationItem = {
      id: Math.random().toString(36).substr(2, 9),
      category: 'Khác',
      name: product.productName,
      description: product.description,
      unit: product.unit,
      quantity: 1,
      unitPrice: product.unitPrice,
      total: product.unitPrice,
      imageUrl: product.imageUrl
    };
    
    const newItems = [...formData.items, newItem];
    const subTotal = newItems.reduce((acc, item) => acc + item.total, 0);
    
    setFormData({ 
      ...formData, 
      items: newItems,
      subTotal,
      totalAmount: subTotal - formData.discount
    });
    
    setIsProductPickerOpen(false);
    toast.success(`Đã thêm ${product.productName}`);
  };

  const handleAddItem = () => {
    const newItem: QuotationItem = {
      id: Math.random().toString(36).substr(2, 9),
      category: formData.items[formData.items.length - 1]?.category || '',
      name: '',
      description: '',
      unit: 'md',
      quantity: 1,
      unitPrice: 0,
      total: 0
    };
    setFormData({ ...formData, items: [...formData.items, newItem] });
  };

  const handleRemoveItem = (id: string) => {
    if (formData.items.length <= 1) {
       toast.error("Phải có ít nhất một hạng mục");
       return;
    }
    const newItems = formData.items.filter(item => item.id !== id);
    const subTotal = newItems.reduce((acc, item) => acc + item.total, 0);
    setFormData({ 
      ...formData, 
      items: newItems, 
      subTotal, 
      totalAmount: subTotal - formData.discount 
    });
  };

  const updateItem = (id: string, updates: Partial<QuotationItem>) => {
    const newItems = formData.items.map(item => {
      if (item.id === id) {
        let updated = { ...item, ...updates };

        // Tự động nhảy đơn giá & đơn vị nếu khớp tên hạng mục mẫu
        if (updates.name !== undefined && updates.name.length > 2) {
          const standard = STANDARD_PRICES.find(p => 
            updates.name!.toLowerCase().includes(p.name.toLowerCase())
          );
          if (standard) {
            updated.unitPrice = standard.price;
            updated.unit = standard.unit;
            if (!updated.description) {
               updated.description = standard.description;
            }
          }
        }

        // Tính toán số lượng dựa trên kích thước (nếu có)
        if (updated.unit === 'm2') {
          if (updated.width && updated.height) {
            updated.quantity = Number((updated.width * updated.height).toFixed(2));
          }
        } else if (updated.unit === 'md') {
          if (updated.width) {
            updated.quantity = updated.width;
          }
        }

        updated.total = (updated.quantity || 0) * (updated.unitPrice || 0);
        return updated;
      }
      return item;
    });
    
    const subTotal = newItems.reduce((acc, item) => acc + item.total, 0);
    setFormData({ 
      ...formData, 
      items: newItems, 
      subTotal, 
      totalAmount: subTotal - formData.discount 
    });
  };

  const handleCustomerSelect = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      setFormData({
        ...formData,
        customerId: customer.id,
        customerName: customer.name,
        phone: customer.phone,
        address: customer.address,
        constructionType: customer.workshop ? `Thi công ${customer.workshop}` : formData.constructionType
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName) {
      toast.error("Vui lòng chọn khách hàng");
      return;
    }
    if (formData.items.some(item => !item.name || item.total <= 0)) {
      toast.error("Vui lòng kiểm tra lại thông tin các hạng mục");
      return;
    }
    onSubmit(formData);
  };

  const handleExport = () => {
    setFormData(prev => ({ ...prev, status: 'sent' }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[100vw] lg:max-w-7xl h-[100dvh] sm:h-[95vh] sm:max-w-[95vw] !rounded-none sm:!rounded-xl flex flex-col p-0 overflow-hidden bg-card text-card-foreground border-none shadow-2xl">
        <DialogHeader className="px-4 py-4 border-b bg-muted shrink-0 relative pr-12">
          {/* Header Content */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-black tracking-tight text-foreground truncate">
                  {initialData ? 'Chỉnh sửa báo giá' : 'Tạo báo giá'}
                </DialogTitle>
              </div>
            </div>
            {/* Logo/Code block */}
            <div className="flex items-center justify-between bg-card border border-border rounded-lg p-2 shadow-sm shrink-0">
              <div className="flex flex-col items-start pr-3 border-r border-border shrink-0">
                <div className="flex items-baseline leading-none">
                  <span className="text-[10px] font-black" style={{ color: '#BE1E2D' }}>tủ</span>
                  <span className="text-[12px] font-black mx-0.5" style={{ color: '#FBB03B' }}>3</span>
                  <span className="text-[10px] font-black" style={{ color: '#BE1E2D' }}>miền</span>
                </div>
              </div>
              <div className="flex flex-col items-end min-w-0">
                <span className="text-[8px] font-black text-muted-foreground uppercase truncate max-w-full">Mã hồ sơ</span>
                <span className="text-xs font-mono font-black text-primary truncate max-w-full">{formData.quotationNumber}</span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <form id="quotation-form" onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto w-full p-3 md:p-8 space-y-4 md:space-y-10 max-w-6xl mx-auto">
            {/* --- Section: Customer Info --- */}
            <section className="space-y-4">
              <div className="flex items-center gap-3 border-b-2 border-primary/10 pb-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <User className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-lg">Thông tin khách hàng</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                <div className="space-y-1">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    Khách hàng <span className="text-destructive">*</span>
                  </Label>
                  <Select onValueChange={handleCustomerSelect} value={formData.customerId || undefined}>
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Chọn khách hàng mục tiêu">
                        {formData.customerName || undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <div className="flex flex-col items-start">
                            <span className="font-medium">{c.name}</span>
                            <span className="text-[10px] text-muted-foreground">{c.phone}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1">
                  <Label className="text-sm font-semibold flex items-center gap-2">SĐT liên hệ</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      className="pl-9 h-10 w-full"
                      placeholder="09xx xxx xxx"
                      value={formData.phone} 
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>
                
                <div className="space-y-1 lg:col-span-1 md:col-span-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">Địa chỉ thi công</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      className="pl-9 h-10 w-full"
                      placeholder="Nhập địa chỉ chi tiết..."
                      value={formData.address} 
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-sm font-semibold flex items-center gap-2">Loại công trình</Label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      className="pl-9 h-10 w-full"
                      placeholder="Vd: Tủ bếp, Nội thất trọn gói..."
                      value={formData.constructionType} 
                      onChange={(e) => setFormData({ ...formData, constructionType: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-sm font-semibold flex items-center gap-2">Thi công dự kiến (ngày)</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      type="number"
                      className="pl-9 h-10 w-full text-center"
                      value={formData.estimatedTime} 
                      onChange={(e) => setFormData({ ...formData, estimatedTime: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-sm font-semibold">Ngày hiệu lực báo giá</Label>
                  <Input 
                    type="date"
                    className="h-10 w-full"
                    value={formData.date} 
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
              </div>
            </section>

            {/* --- Section: Quotation Items --- */}
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-primary/10 pb-2 gap-3">
                 <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                       <Calculator className="h-4 w-4" />
                    </div>
                    <h3 className="font-bold text-base whitespace-nowrap">Danh sách hạng mục chi tiết</h3>
                    <Badge variant="secondary" className="h-6 px-2 text-xs font-mono">{formData.items.length} hạng mục</Badge>
                 </div>
                 <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                   <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsProductPickerOpen(true)} 
                    className="h-9 text-[11px] sm:text-xs px-1 border-blue-200 hover:bg-blue-50 text-blue-600 font-bold shadow-sm"
                   >
                    <Package className="h-3 w-3 mr-1" />
                    Kho sp
                  </Button>
                   <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={handleAddItem} 
                    className="h-9 text-[11px] sm:text-xs px-1 border-primary/20 hover:bg-primary/5 text-primary font-bold shadow-sm"
                   >
                    <Plus className="h-3 w-3 mr-1" />
                    Mới
                   </Button>
                 </div>
              </div>
              <div className="space-y-4">
                {formData.items.map((item, index) => (
                  <Card key={item.id} className="relative overflow-hidden group shadow-md border-border/40 hover:border-primary/30 transition-all duration-300">
                    <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-primary/20 group-hover:bg-primary transition-colors" />
                    
                    <CardContent className="p-3">
                      {/* Header: Số thứ tự và Nút xóa */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold font-mono">
                          {index + 1 < 10 ? `0${index + 1}` : index + 1}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemoveItem(item.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Body: Form nhập liệu */}
                      <div className="w-full space-y-3">
                        <div className="flex gap-2 items-start">
                          {/* Avatar */}
                          <div 
                              className="h-10 w-10 shrink-0 rounded-lg bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-all overflow-hidden relative"
                              onClick={() => document.getElementById(`upload-item-${item.id}`)?.click()}
                          >
                              {item.imageUrl ? (
                                <img src={item.imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <ImagePlus className="h-3 w-3 text-muted-foreground" />
                              )}
                          </div>
                          
                          <div className="flex-1 space-y-3">
                            {/* Hạng mục picker */}
                            <div className="w-full space-y-1">
                                <Label className="text-xs font-semibold text-muted-foreground uppercase">Hạng mục</Label>
                                <Select 
                                  onValueChange={(value) => {
                                    const standard = STANDARD_PRICES.find(p => p.name === value);
                                    if (standard) {
                                      updateItem(item.id, { 
                                        name: standard.name,
                                        unit: standard.unit,
                                        unitPrice: standard.price,
                                        description: standard.description,
                                        category: standard.category
                                      });
                                    }
                                  }}
                                >
                                  <SelectTrigger className="h-9 text-xs font-bold bg-gray-50 hover:bg-gray-100 transition-colors border-dashed">
                                    <SelectValue placeholder="Chọn thư viện mẫu..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {item.category ? (
                                      <>
                                        <SelectLabel className="text-[9px] uppercase font-bold text-primary">Hạng mục {item.category}</SelectLabel>
                                        {STANDARD_PRICES.filter(p => p.category === item.category).map(p => (
                                          <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                                        ))}
                                        <SelectSeparator />
                                        <SelectLabel className="text-[9px] uppercase font-bold">Gợi ý khác</SelectLabel>
                                        {STANDARD_PRICES.filter(p => p.category !== item.category).map(p => (
                                          <SelectItem key={p.name} value={p.name}>{p.name} ({p.category})</SelectItem>
                                        ))}
                                      </>
                                    ) : (
                                      STANDARD_PRICES.map(p => (
                                        <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                                      ))
                                    )}
                                  </SelectContent>
                                </Select>
                            </div>
                          </div>
                        </div>

                        {/* Row 1: Khu vực | Đơn vị | Số lượng */}
                        <div className="grid grid-cols-4 gap-2 w-full items-start">
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs font-semibold text-slate-700">Khu vực</Label>
                            <Input className="h-9 text-sm w-full" placeholder="Phòng khách..." value={item.category} onChange={(e) => updateItem(item.id, { category: e.target.value })} />
                          </div>
                          <div className="col-span-1 space-y-1">
                            <Label className="text-xs font-semibold text-slate-700">Đ.vị</Label>
                            <Input className="h-9 text-sm w-full text-center p-1" placeholder="md" value={item.unit} onChange={(e) => updateItem(item.id, { unit: e.target.value })} />
                          </div>
                          <div className="col-span-1 space-y-1">
                            <Label className="text-xs font-semibold text-slate-700">S.lượng</Label>
                            <Input type="number" className="h-9 text-sm w-full text-center p-1" placeholder="1" value={item.quantity} onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) })} />
                          </div>
                        </div>
                            
                        {/* Rows 2-4: Tên, Kích thước, Mô tả */}
                        <div className="w-full space-y-1">
                            <Label className="text-xs font-semibold text-slate-700">Tên sản phẩm</Label>
                            <Input 
                              className="h-9 font-bold text-xs bg-card text-card-foreground transition-colors"
                              placeholder="Vd: Tủ bếp..." 
                              value={item.name} 
                              onChange={(e) => updateItem(item.id, { name: e.target.value })}
                            />
                        </div>
                        <div className="w-full space-y-1">
                            <Label className="text-xs font-semibold text-slate-700">Kích thước (R x S x C)</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <Input 
                                    type="number"
                                    placeholder="Dài"
                                    className="h-9 bg-background font-bold text-center text-xs"
                                    value={item.width || 0}
                                    onChange={(e) => updateItem(item.id, { width: parseFloat(e.target.value) || 0 })}
                                />
                                <Input 
                                  type="number"
                                  placeholder="Rộng"
                                  className="h-9 bg-background font-bold text-center text-xs"
                                  disabled={item.unit !== 'm2'}
                                  value={item.height || 0}
                                  onChange={(e) => updateItem(item.id, { height: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                        </div>
                        <div className="w-full space-y-1">
                            <Label className="text-xs font-semibold text-slate-700">Mô tả / Ghi chú</Label>
                            <Textarea 
                              className="min-h-[50px] resize-none text-xs leading-relaxed bg-card text-card-foreground transition-colors"
                              placeholder="Mô tả cụ thể..."
                              value={item.description}
                              onChange={(e) => updateItem(item.id, { description: e.target.value })}
                            />
                        </div>

                        {/* Row 5: Giá tiền */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold text-slate-700">Đơn giá</Label>
                                <div className="relative">
                                  <Input 
                                    type="number"
                                    className="h-9 font-mono font-black text-right pr-7 text-xs bg-secondary/5"
                                    value={item.unitPrice} 
                                    onChange={(e) => updateItem(item.id, { unitPrice: parseInt(e.target.value) || 0 })}
                                  />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-bold text-muted-foreground uppercase">đ</span>
                                </div>
                            </div>
                            <div className="space-y-0.5">
                                <Label className="text-xs font-semibold text-primary uppercase">Thành tiền</Label>
                                <div className="h-9 flex items-center justify-end px-2 bg-primary/10 rounded-lg font-mono text-xs font-black text-primary border border-primary/20">
                                  {item.total.toLocaleString()} đ
                                </div>
                            </div>
                        </div>

                        {/* Hidden Image input */}
                        <input 
                            id={`upload-item-${item.id}`} 
                            type="file" 
                            className="hidden" 
                            accept="image/*"
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  toast.info("Đang tải ảnh...");
                                  const url = await uploadToImgBB(file);
                                  if (url) {
                                    updateItem(item.id, { imageUrl: url });
                                    toast.success("Đã tải ảnh lên");
                                  }
                                }
                            }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* --- Section: Summary & Totals --- */}
            <section className="bg-gray-50 rounded-xl p-3 md:p-8 border border-border/50 shadow-inner">
              <div className="flex flex-col md:flex-row gap-4 md:gap-8 items-start justify-between">
                {/* Bank Info */}
                <div className="max-w-md w-full p-4 bg-card text-card-foreground rounded-lg border border-dashed border-muted-foreground/30 space-y-2">
                    <h4 className="font-bold flex items-center gap-2 text-xs">
                      <BadgeDollarSign className="h-4 w-4 text-emerald-500" />
                      Thông tin thanh toán
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-[10px]">
                      <div className="space-y-0.5">
                          <p className="text-muted-foreground uppercase text-[9px] font-bold">Ngân hàng</p>
                          <p className="font-medium">{formData.paymentInfo.bankName}</p>
                      </div>
                      <div className="space-y-0.5">
                          <p className="text-muted-foreground uppercase text-[9px] font-bold">Số tài khoản</p>
                          <p className="font-mono font-bold text-primary">{formData.paymentInfo.accountNumber}</p>
                      </div>
                      <div className="col-span-2 space-y-0.5">
                          <p className="text-muted-foreground uppercase text-[9px] font-bold">Chủ tài khoản</p>
                          <p className="font-bold">{formData.paymentInfo.accountHolder}</p>
                      </div>
                    </div>
                </div>

                {/* Pricing Breakdown */}
                <div className="w-full max-w-sm space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground font-medium">Tạm tính:</span>
                    <span className="font-mono font-bold">{formData.subTotal.toLocaleString()} VNĐ</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-xs gap-4">
                    <span className="text-muted-foreground font-medium shrink-0">Chiết khấu:</span>
                    <div className="flex items-center gap-2 flex-1 justify-end max-w-[120px]">
                      <Input 
                        type="number" 
                        className="h-8 text-right font-mono font-bold text-destructive bg-destructive/5 text-xs"
                        value={formData.discount}
                        onChange={(e) => {
                          const discount = parseInt(e.target.value) || 0;
                          setFormData({ ...formData, discount, totalAmount: formData.subTotal - discount });
                        }}
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/50 border-dashed space-y-1">
                      <div className="flex justify-between items-end">
                        <span className="text-sm font-black uppercase tracking-tight">Tổng cộng</span>
                        <div className="text-right">
                          <p className="text-2xl font-black text-primary font-mono tracking-tighter tabular-nums drop-shadow-sm">
                            {formData.totalAmount.toLocaleString()}
                          </p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">VNĐ (Giá chưa bao gồm thuế)</p>
                        </div>
                      </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <DialogFooter className="px-4 py-4 md:px-8 md:py-6 border-t bg-background shrink-0 flex flex-row items-center justify-between gap-2 md:gap-4 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
            <div className="hidden md:flex items-center gap-6">
               <div className="flex items-center gap-2 group cursor-pointer hover:text-destructive transition-colors" onClick={onClose}>
                  <X className="h-4 w-4 text-muted-foreground group-hover:text-destructive" />
                  <span className="text-sm font-bold text-muted-foreground group-hover:text-destructive">Hủy thay đổi</span>
               </div>
            </div>
            <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto justify-end">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose} 
                className="h-10 md:h-12 px-3 md:px-6 font-bold border-2 text-xs md:text-sm"
              >
                Đóng
              </Button>
              <Button 
                type="button" 
                variant="secondary"
                className="h-10 md:h-12 px-3 md:px-6 font-bold border-2 border-primary/20 hover:bg-primary/5 text-primary text-xs md:text-sm hidden sm:flex"
                onClick={() => {
                  setFormData({ ...formData, status: 'draft' });
                  toast.success("Đã lưu bản nháp báo giá");
                }}
              >
                Lưu nháp
              </Button>
              <Button 
                type="submit" 
                form="quotation-form"
                className="h-10 md:h-12 flex-1 md:flex-none md:px-8 lg:px-10 gap-2 md:gap-3 bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20 text-[10px] md:text-sm lg:text-md font-black uppercase tracking-tight"
                onClick={handleExport}
              >
                <FileText className="h-4 w-4 md:h-5 md:w-5" />
                {initialData ? 'Cập nhật' : 'Xuất báo giá'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
      <AnimatePresence>
        {isProductPickerOpen && (
          <Dialog open={isProductPickerOpen} onOpenChange={setIsProductPickerOpen}>
            <DialogContent className="max-w-[100vw] lg:max-w-5xl h-[100dvh] sm:h-[85vh] sm:max-w-[95vw] sm:!rounded-xl !rounded-none flex flex-col p-0 overflow-hidden border-none shadow-2xl">
              <DialogHeader className="p-8 border-b bg-card text-card-foreground relative">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-100">
                    <Package className="h-6 w-6" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-black text-foreground">KHO SẢN PHẨM MẪU</DialogTitle>
                    <DialogDescription className="font-medium">Chọn sản phẩm từ thư viện để thêm vào bản báo giá hiện tại</DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              
              <div className="p-6 border-b bg-gray-50/50 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1 group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-blue-500 transition-colors" />
                  <Input 
                    placeholder="Tìm theo tên sản phẩm hoặc mô tả..." 
                    className="pl-10 h-11 bg-card text-card-foreground border-gray-200 rounded-xl focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all font-medium"
                    value={pickerSearchTerm}
                    onChange={(e) => setPickerSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={pickerUnitFilter} onValueChange={setPickerUnitFilter}>
                  <SelectTrigger className="w-full md:w-[180px] h-11 bg-card text-card-foreground border-gray-200 rounded-xl font-medium">
                    <SelectValue placeholder="Đơn vị" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-gray-100 shadow-xl">
                    <SelectItem value="all" className="rounded-lg font-medium">Tất cả đơn vị</SelectItem>
                    <SelectSeparator />
                    {['md', 'm2', 'bộ', 'chiếc', 'tấm', 'cái'].map(unit => (
                      <SelectItem key={unit} value={unit} className="rounded-lg font-medium">{unit}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 overflow-y-auto w-full p-8 bg-card text-card-foreground">
                {filteredLibraryProducts.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredLibraryProducts.map((product) => (
                      <Card 
                        key={product.id} 
                        className="cursor-pointer border border-border hover:border-blue-300 hover:shadow-xl hover:shadow-blue-50 transition-all group relative overflow-hidden flex flex-col rounded-2xl"
                        onClick={() => handleSelectFromLibrary(product)}
                      >
                        <CardContent className="p-0 flex flex-col h-full">
                          <div className="aspect-video w-full bg-gray-100 overflow-hidden relative">
                            {product.imageUrl ? (
                              <img 
                                src={product.imageUrl} 
                                alt={product.productName}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                                <ImageIcon className="h-10 w-10" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/40 transition-colors flex items-center justify-center">
                              <Plus className="h-10 w-10 text-white opacity-0 group-hover:opacity-100 transition-all scale-50 group-hover:scale-100 drop-shadow-lg" />
                            </div>
                            <div className="absolute top-2 right-2">
                              <Badge className="bg-black/40 backdrop-blur-md border-none text-[9px] h-5 px-1.5 font-bold">
                                {product.unit}
                              </Badge>
                            </div>
                          </div>
                          <div className="p-4 space-y-2 flex-1 flex flex-col">
                            <h4 className="font-extrabold text-sm text-foreground group-hover:text-blue-600 transition-colors line-clamp-1">{product.productName}</h4>
                            <p className="text-[11px] text-muted-foreground line-clamp-2 min-h-[32px] leading-relaxed font-medium">
                              {product.description || 'Không có mô tả chi tiết cho sản phẩm này.'}
                            </p>
                            <div className="flex items-center justify-between pt-3 border-t border-gray-50 mt-auto">
                              <div className="flex flex-col">
                                <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mr-2">Đơn giá</span>
                                <span className="font-black text-blue-700 text-base">
                                  {product.unitPrice.toLocaleString()} <span className="text-[9px] opacity-60">VNĐ</span>
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                    <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                      <Package className="h-10 w-10" />
                    </div>
                    <p className="text-lg font-bold">Không tìm thấy sản phẩm nào</p>
                    <p className="text-sm">Thử thay đổi từ khóa hoặc bộ lọc</p>
                  </div>
                )}
              </div>
              
              <DialogFooter className="p-6 border-t bg-card text-card-foreground font-bold">
                <Button variant="ghost" onClick={() => setIsProductPickerOpen(false)} className="rounded-xl h-12 px-8">HỦY BỎ</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </Dialog>
  );
}

function BadgeDollarSign(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 15h2a2 2 0 1 0 0-4h-3c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2h2" />
      <path d="M11 21v-2" />
      <path d="M11 9V7" />
      <path d="M14 13H5a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2" />
      <path d="M18 3h1a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1" />
    </svg>
  )
}
