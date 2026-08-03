import * as React from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Calculator,
  User,
  Users,
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
  Loader2,
  Settings,
  Check,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { uploadToImgBB } from '@/src/services/uploadService';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
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
import { Quotation, QuotationItem, Customer, ProductLibraryItem, getNormalizedWorkshopId } from '@/src/types';
import { cn, getCurrentVNYear, getCurrentVNDateString } from '@/src/lib/utils';
import { STANDARD_PRICES } from '@/src/constants/priceList';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';

import { MaterialMultiplierConfig } from './MaterialMultiplierConfig';
import { getMaterialMultipliers } from '@/src/services/materialConfigService';
import { MaterialMultiplier } from '@/src/types';


const MATERIAL_COLORS: Record<string, string> = {
  'ECO': '#1e40af', // Blue (Ecoplast)
  'LUX': '#0ea5e9', // Light Blue (Luxury)
  'ECO+': '#16a34a', // Green (Ecoplus)
  'ECOPVC+': '#86efac', // Light Green (Ecoplus Film)
  'PENCO': '#7c3aed', // Purple (Penco)
  'CASAWOOD': '#854d0e', // Brown (Casawood)
  'THANTRE': '#f97316', // Orange (Than tre)
  'PKB': '#64748b', // Grey (Phụ kiện bếp)
  'MSNT': '#64748b', // Grey (Mặt sàn thường)
  'MSNCC': '#64748b', // Grey (Mặt sàn cao cấp)
  'PKTA': '#64748b', // Grey (Phụ kiện tủ áo)
  'PKK': '#64748b', // Grey (Phụ kiện khác)
};

// Danh sách mã vật liệu là PHỤ KIỀN (không áp mặc định ECO)
const ACCESSORY_MATERIAL_CODES = new Set(['PKB', 'MSNT', 'MSNCC', 'PKTA', 'PKK']);

// Kiểm tra tên sản phẩm / danh mục có phải phụ kiện không
const isAccessoryItem = (name: string, category?: string): boolean => {
  const lower = (name + ' ' + (category || '')).toLowerCase();
  return (
    lower.includes('phụ kiện') ||
    lower.includes('phụkiện') ||
    lower.includes('bản lề') ||
    lower.includes('tay nắm') ||
    lower.includes('ray trượt') ||
    lower.includes('khóa') ||
    lower.includes('khóa tủ') ||
    lower.includes('giảm chấn') ||
    lower.includes('mặt sàn') ||
    lower.includes('giá bát') ||
    lower.includes('kệ bát') ||
    lower.includes('xoong nồi') ||
    lower.includes('giá xoong') ||
    lower.includes('dao thớt') ||
    lower.includes('giá dao') ||
    lower.includes('gia vị') ||
    lower.includes('kệ gia vị') ||
    lower.includes('thùng gạo') ||
    lower.includes('thùng rác') ||
    lower.includes('kệ góc') ||
    lower.includes('mâm xoay') ||
    lower.includes('góc liên hoàn') ||
    lower.includes('tủ kho') ||
    lower.includes('giá kho') ||
    lower.includes('móc áo') ||
    lower.includes('móc treo') ||
    lower.includes('suốt treo') ||
    lower.includes('giá gương') ||
    lower.includes('gương âm') ||
    lower.includes('piston') ||
    lower.includes('tay nâng') ||
    lower.includes('đèn led') ||
    lower.includes('khay chia')
  );
};

const getAccessoryMaterialCode = (name: string, category?: string): string => {
  const lower = (name + ' ' + (category || '')).toLowerCase();
  if (
    lower.includes('bếp') || 
    lower.includes('bát') || 
    lower.includes('xoong') || 
    lower.includes('nồi') || 
    lower.includes('dao') || 
    lower.includes('thớt') || 
    lower.includes('gia vị') || 
    lower.includes('gạo') || 
    lower.includes('rác') ||
    lower.includes('kho') ||
    lower.includes('góc') ||
    lower.includes('mâm xoay')
  ) {
    return 'PKB'; // Phụ kiện bếp
  }
  if (
    lower.includes('áo') || 
    lower.includes('quần') || 
    lower.includes('mắc') || 
    lower.includes('treo') || 
    lower.includes('gương') ||
    lower.includes('caravat')
  ) {
    return 'PKTA'; // Phụ kiện tủ áo
  }
  if (lower.includes('sàn')) {
    return 'MSNT'; // Mặt sàn nhựa thường
  }
  return 'PKK'; // Phụ kiện khác
};

const getMaterialDescriptionNote = (code: string): string => {
  switch (code.toUpperCase()) {
    case 'ECO':
      return '- Chất liệu khung cánh Ecoplast';
    case 'LUX':
      return '- Chất liệu khung cánh Ecoplast Luxury';
    case 'ECO+':
      return '- Chất liệu khung cánh Ecoplus';
    case 'ECOPVC+':
      return '- Chất liệu khung cánh Ecoplus Film PVC';
    case 'PENCO':
      return '- Chất liệu khung cánh nhựa Penco';
    case 'CASAWOOD':
      return '- Chất liệu khung cánh nhựa đặc Casawood';
    case 'THANTRE':
      return '- Chất liệu khung cánh than tre';
    default:
      return '';
  }
};

const updateDescriptionWithMaterial = (description: string, materialCode: string): string => {
  const note = getMaterialDescriptionNote(materialCode);
  const lines = description ? description.split('\n') : [];
  
  const materialLineIndex = lines.findIndex(line => 
    line.toLowerCase().includes('chất liệu') || 
    line.toLowerCase().includes('chat lieu')
  );

  if (materialLineIndex !== -1) {
    if (note) {
      lines[materialLineIndex] = note;
    } else {
      lines.splice(materialLineIndex, 1);
    }
  } else {
    if (note) {
      lines.unshift(note);
    }
  }

  return lines.join('\n').trim();
};

const getMaterialColor = (code?: string) => {
  if (!code) return '#1e40af'; // Mặc định Ecoplast
  return MATERIAL_COLORS[code.toUpperCase()] || '#64748b';
};

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
  const getProductPriceForWorkshop = (product: any, workshop?: string) => {
    if (!workshop || workshop === 'all') return product.unitPrice;
    const normWs = getNormalizedWorkshopId(workshop);
    if (product.workshopPrices && product.workshopPrices[normWs] !== undefined && product.workshopPrices[normWs] > 0) {
      return product.workshopPrices[normWs];
    }
    return product.unitPrice;
  };

  const getDisplayValue = (val: any) => {
    if (val === undefined || val === null || val === 0 || val === '0') return '';
    return String(val).replace('.', ',');
  };

  const formatMoneyInput = (val: any) => {
    if (val === undefined || val === null || val === 0 || val === '0' || val === '') return '';
    const num = typeof val === 'number' ? val : parseInt(String(val).replace(/[^0-9]/g, ''));
    if (isNaN(num)) return '';
    return num.toLocaleString('vi-VN');
  };

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
    imageUrls: initialData?.imageUrls || [],
    workshop: initialData?.workshop || '',
    hasVat: initialData?.hasVat || false,
    vatRate: initialData?.vatRate || 8,
    vatAmount: initialData?.vatAmount || 0,
    depositAmount: initialData?.depositAmount || 0,
    type: initialData?.type || 'custom',
  });

  const [isCustomerInfoExpanded, setIsCustomerInfoExpanded] = React.useState(!initialData);
  const [isConfigOpen, setIsConfigOpen] = React.useState(false);
  const [multipliers, setMultipliers] = React.useState<MaterialMultiplier[]>([]);

  const getUpdatedAmounts = (
    items: QuotationItem[],
    discount: number,
    hasVat: boolean
  ) => {
    const subTotal = items.reduce((acc, item) => acc + item.total, 0);
    const vatAmount = hasVat ? Math.round((subTotal - discount) * 0.08) : 0;
    const totalAmount = subTotal - discount + vatAmount;
    return { subTotal, vatAmount, totalAmount };
  };

  React.useEffect(() => {
    getMaterialMultipliers().then(setMultipliers);
  }, [isConfigOpen]);



  const [isProductPickerOpen, setIsProductPickerOpen] = React.useState(false);
  const [pickerSearchTerm, setPickerSearchTerm] = React.useState('');
  const [pickerUnitFilter, setPickerUnitFilter] = React.useState('all');
  const [pickerCategoryFilter, setPickerCategoryFilter] = React.useState('all');
  const [selectedProductsForBulk, setSelectedProductsForBulk] = React.useState<ProductLibraryItem[]>([]);

  const allProducts = React.useMemo(() => {
    const merged = [...STANDARD_PRICES.map(p => ({ 
      id: `std-${p.name}`, 
      productName: p.name, 
      category: p.category, 
      unitPrice: p.price, 
      unit: p.unit, 
      description: p.description,
      imageUrl: '',
      isStandard: true 
    }))];
    
    products.forEach(p => {
      const idx = merged.findIndex(m => m.productName === p.productName);
      const mapped = {
        id: p.id,
        productName: p.productName,
        category: p.category || 'Khác',
        unitPrice: p.unitPrice,
        unit: p.unit,
        description: p.description || '',
        imageUrl: p.imageUrl || '',
        isStandard: false
      };
      
      if (idx !== -1) merged[idx] = mapped;
      else merged.push(mapped);
    });
    return merged;
  }, [products]);

  // Auto-heal missing basePrice for old/existing quotation items using the setup price from allProducts
  React.useEffect(() => {
    if (initialData && initialData.items && allProducts.length > 0) {
      let changed = false;
      const healedItems = formData.items.map(item => {
        if (item.basePrice === undefined || item.basePrice === null || item.basePrice === 0) {
          const matchedProduct = allProducts.find(p => p.productName.toLowerCase() === item.name.toLowerCase());
          if (matchedProduct) {
            changed = true;
            return {
              ...item,
              basePrice: getProductPriceForWorkshop(matchedProduct, formData.workshop)
            };
          }
        }
        return item;
      });
      if (changed) {
        setFormData(prev => ({
          ...prev,
          items: healedItems
        }));
      }
    }
  }, [initialData, allProducts]);

  const uniqueCategories = React.useMemo(() => {
    const cats = new Set<string>();
    allProducts.forEach(p => {
      if (p.category) {
        cats.add(p.category.trim());
      }
    });
    const list = Array.from(cats).filter(Boolean);
    if (list.length === 0) {
      return ["Phòng bếp", "Phòng ngủ", "Phòng khách", "Phòng thờ", "Khác"];
    }
    return list;
  }, [allProducts]);

  const filteredLibraryProducts = allProducts.filter(p => {
    const matchesSearch = p.productName.toLowerCase().includes(pickerSearchTerm.toLowerCase()) || 
                          p.description.toLowerCase().includes(pickerSearchTerm.toLowerCase());
    const matchesUnit = pickerUnitFilter === 'all' || p.unit === pickerUnitFilter;
    const matchesCategory = pickerCategoryFilter === 'all' || p.category === pickerCategoryFilter;
    return matchesSearch && matchesUnit && matchesCategory;
  });
  console.log("DEBUG: QuotationForm products:", allProducts.length, "filtered:", filteredLibraryProducts.length);

  const handleSelectFromLibrary = (product: ProductLibraryItem) => {
    const isSelected = selectedProductsForBulk.some(p => p.id === product.id);
    if (isSelected) {
      setSelectedProductsForBulk(selectedProductsForBulk.filter(p => p.id !== product.id));
    } else {
      setSelectedProductsForBulk([...selectedProductsForBulk, product]);
    }
  };

  const handleBulkAdd = () => {
    if (selectedProductsForBulk.length === 0) return;
    
    const ecoMultiplier = multipliers.find(m => m.code === 'ECO');
    const ecoRatio = ecoMultiplier ? ecoMultiplier.percentage / 100 : 1;

    const newItemsToAdd = selectedProductsForBulk.map(product => {
      const isAccessory = isAccessoryItem(product.productName, product.category);
      const basePrice = getProductPriceForWorkshop(product, formData.workshop);
      const unitPrice = isAccessory ? basePrice : Math.round(basePrice * ecoRatio);
      return {
        id: Math.random().toString(36).substr(2, 9),
        category: product.category || 'Khác',
        name: product.productName,
        description: updateDescriptionWithMaterial(product.description || '', isAccessory ? getAccessoryMaterialCode(product.productName, product.category) : 'ECO'),
        unit: product.unit || 'md',
        quantity: 1,
        basePrice,
        unitPrice,
        total: unitPrice,
        imageUrl: product.imageUrl || '',
        // Mặc định ECO (105%) cho hạng mục nội thất, gán mã phụ kiện tương ứng cho phụ kiện
        materialCode: isAccessory ? getAccessoryMaterialCode(product.productName, product.category) : 'ECO',
        materialName: isAccessory ? getAccessoryMaterialCode(product.productName, product.category) : 'ECO'
      };
    });

    const newItems = [...formData.items, ...newItemsToAdd];
    const amounts = getUpdatedAmounts(newItems, formData.discount, !!formData.hasVat);

    setFormData({ 
      ...formData, 
      items: newItems,
      ...amounts
    });

    setSelectedProductsForBulk([]);
    setIsProductPickerOpen(false);
    toast.success(`Đã thêm ${newItemsToAdd.length} sản phẩm thành công!`);
  };

  const handleAddItem = () => {
    const newItem: QuotationItem = {
      id: Math.random().toString(36).substr(2, 9),
      category: formData.items[formData.items.length - 1]?.category || '',
      name: '',
      description: '',
      unit: 'md',
      quantity: 1,
      basePrice: 0,
      unitPrice: 0,
      total: 0,
      // Mặc định ECO cho hạng mục nội thất mới
      materialCode: 'ECO',
      materialName: 'ECO'
    };
    setFormData({ ...formData, items: [...formData.items, newItem] });
  };

  const handleRemoveItem = (id: string) => {
    if (formData.items.length <= 1) {
       toast.error("Phải có ít nhất một hạng mục");
       return;
    }
    const newItems = formData.items.filter(item => item.id !== id);
    const amounts = getUpdatedAmounts(newItems, formData.discount, !!formData.hasVat);
    setFormData({ 
      ...formData, 
      items: newItems, 
      ...amounts
    });
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const newItems = [...formData.items];
    const temp = newItems[index];
    newItems[index] = newItems[index - 1];
    newItems[index - 1] = temp;
    setFormData({ ...formData, items: newItems });
  };

  const handleMoveDown = (index: number) => {
    if (index >= formData.items.length - 1) return;
    const newItems = [...formData.items];
    const temp = newItems[index];
    newItems[index] = newItems[index + 1];
    newItems[index + 1] = temp;
    setFormData({ ...formData, items: newItems });
  };

  const updateItem = (id: string, updates: Partial<QuotationItem>) => {
    const newItems = formData.items.map(item => {
      if (item.id === id) {
        let updated = { ...item, ...updates };

        if (updates.basePrice !== undefined) {
          // Khi đổi đơn giá gốc
          if (updated.materialCode) {
            const multiplier = multipliers.find(m => m.code === updated.materialCode);
            if (multiplier) {
              updated.unitPrice = Math.round((updated.basePrice || 0) * (multiplier.percentage / 100));
            } else {
              updated.unitPrice = updated.basePrice;
            }
          } else {
            updated.unitPrice = updated.basePrice;
          }
        } else if (updates.materialCode !== undefined) {
          // Khi đổi vật liệu
          if (updates.materialCode === '') {
            updated.materialName = '';
            updated.unitPrice = updated.basePrice || updated.unitPrice;
            updated.description = updateDescriptionWithMaterial(updated.description || '', '');
          } else {
            const multiplier = multipliers.find(m => m.code === updates.materialCode);
            if (multiplier) {
              updated.materialName = multiplier.code;
              if (!updated.basePrice && multiplier.globalBasePrice) {
                updated.basePrice = multiplier.globalBasePrice;
              }
              updated.unitPrice = Math.round((updated.basePrice || updated.unitPrice || 0) * (multiplier.percentage / 100));
              updated.description = updateDescriptionWithMaterial(updated.description || '', updates.materialCode);
            }
          }
        }

        // Tự động nhảy đơn giá & đơn vị nếu khớp tên hạng mục mẫu
        if (updates.name !== undefined && updates.name.length > 2) {
          const standard = allProducts.find(p => 
            updates.name!.toLowerCase().includes(p.productName.toLowerCase())
          );
          if (standard) {
            const resolvedPrice = getProductPriceForWorkshop(standard, formData.workshop);
            updated.basePrice = resolvedPrice;
            updated.unit = standard.unit;
            const isAcc = isAccessoryItem(standard.productName, standard.category);
            const accCode = isAcc ? getAccessoryMaterialCode(standard.productName, standard.category) : 'ECO';
            updated.materialCode = accCode;
            updated.materialName = accCode;
            
            const multiplier = multipliers.find(m => m.code === accCode);
            if (multiplier) {
              updated.unitPrice = Math.round(resolvedPrice * (multiplier.percentage / 100));
            } else {
              updated.unitPrice = resolvedPrice;
            }
            
            updated.description = standard.description || updated.description || '';
            updated.description = updateDescriptionWithMaterial(updated.description, accCode);
          } else {
            // Tự động nhận diện nếu là phụ kiện để gán mã phụ kiện tương ứng
            if (isAccessoryItem(updates.name, updated.category)) {
              const accCode = getAccessoryMaterialCode(updates.name, updated.category);
              updated.materialCode = accCode;
              updated.materialName = accCode;
              const multiplier = multipliers.find(m => m.code === accCode);
              if (multiplier && updated.basePrice) {
                updated.unitPrice = Math.round(updated.basePrice * (multiplier.percentage / 100));
              }
              updated.description = updateDescriptionWithMaterial(updated.description || '', accCode);
            } else {
              // Nếu không phải phụ kiện mà trước đó đang là phụ kiện (PKB, PKK, PKTA), chuyển về ECO
              if (item.materialCode && ACCESSORY_MATERIAL_CODES.has(item.materialCode)) {
                updated.materialCode = 'ECO';
                updated.materialName = 'ECO';
                const multiplier = multipliers.find(m => m.code === 'ECO');
                if (multiplier && updated.basePrice) {
                  updated.unitPrice = Math.round(updated.basePrice * (multiplier.percentage / 100));
                }
                updated.description = updateDescriptionWithMaterial(updated.description || '', 'ECO');
              } else {
                // Nếu không phải phụ kiện và trước đó cũng không phải phụ kiện, đảm bảo mô tả khớp với vật liệu hiện tại
                updated.description = updateDescriptionWithMaterial(updated.description || '', updated.materialCode || 'ECO');
              }
            }
          }
        }

        const parseNumber = (val: any): number => {
          if (val === undefined || val === null || val === '') return 0;
          if (typeof val === 'number') return val;
          const normalized = String(val).replace(/,/g, '.');
          const parsed = parseFloat(normalized);
          return isNaN(parsed) ? 0 : parsed;
        };

        // Tự động gán/xóa Góc L dựa trên việc nhập Cạnh 2 (height) cho đơn vị 'md'
        if (updated.unit === 'md') {
          if (updates.height !== undefined) {
            const hVal = parseNumber(updates.height);
            if (hVal > 0) {
              if (updated.cornerL === undefined || parseNumber(updated.cornerL) === 0) {
                updated.cornerL = 0;
              }
            } else {
              updated.cornerL = 0;
            }
          }
        }

        // Tính toán số lượng dựa trên kích thước (nếu có)
        if (updated.unit === 'm2') {
          const w = parseNumber(updated.width);
          const h = parseNumber(updated.height);
          if (w && h) {
            updated.quantity = Number((w * h).toFixed(2));
          }
        } else if (updated.unit === 'md') {
          const c1 = parseNumber(updated.width);
          const c2 = parseNumber(updated.height);
          const corner = updated.cornerL !== undefined ? parseNumber(updated.cornerL) : 0;
          
          if (c1 > 0 || c2 > 0) {
            updated.quantity = Number((c1 + c2 - corner).toFixed(2));
            if (updated.quantity < 0) updated.quantity = 0;
          }
        }

        updated.total = (updated.quantity || 0) * (updated.unitPrice || 0);
        return updated;
      }
      return item;
    });
    
    const amounts = getUpdatedAmounts(newItems, formData.discount, !!formData.hasVat);
    setFormData({ 
      ...formData, 
      items: newItems, 
      ...amounts
    });
  };

  const handleCustomerSelect = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      let newQuotationNumber = formData.quotationNumber;
      if (customer.code) {
        const baseCode = customer.code.split(/[_-]/)[0].trim();
        newQuotationNumber = `BG-${baseCode}`;
      }

      setFormData({
        ...formData,
        customerId: customer.id,
        customerName: customer.name,
        phone: customer.phone,
        address: customer.address,
        quotationNumber: newQuotationNumber,
        constructionType: customer.workshop ? `Thi công ${customer.workshop}` : formData.constructionType,
        workshop: customer.workshop || ''
      });
      setIsCustomerInfoExpanded(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.type !== 'ready-made' && !formData.customerName) {
      toast.error("Vui lòng chọn khách hàng");
      return;
    }
    if (formData.items.some(item => !item.name || item.total <= 0)) {
      toast.error("Vui lòng kiểm tra lại thông tin các hạng mục");
      return;
    }
    
    const finalData = {
      ...formData,
      customerName: formData.customerName || (formData.type === 'ready-made' ? 'Khách lẻ' : ''),
    };
    
    onSubmit(finalData);
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
          <div className="flex-1 overflow-y-auto w-full">
            <div className="p-3 md:p-6 space-y-3.5 md:space-y-6 max-w-6xl mx-auto">
            {/* --- Section: Customer Info --- */}
            <section className="space-y-3">
              <div 
                className="flex items-center justify-between border-b border-border pb-2 cursor-pointer select-none"
                onClick={() => setIsCustomerInfoExpanded(!isCustomerInfoExpanded)}
              >
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <User className="h-4 w-4" />
                  </div>
                  <h3 className="font-bold text-sm md:text-base">Thông tin khách hàng</h3>
                </div>
                <div className="text-muted-foreground flex items-center gap-1 text-xs font-semibold">
                  {isCustomerInfoExpanded ? 'Thu gọn' : 'Mở rộng'}
                  <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isCustomerInfoExpanded && "rotate-180")} />
                </div>
              </div>
              
              {isCustomerInfoExpanded ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3 rounded-lg border border-border bg-slate-50/50">
                  <div className="space-y-2 lg:col-span-3 mb-2 pb-3 border-b border-border/50">
                    <Label className="text-xs font-bold text-slate-700">Loại Báo Giá</Label>
                    <div className="flex items-center gap-6">
                      <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                        <input 
                          type="radio" 
                          className="accent-primary w-4 h-4"
                          checked={formData.type !== 'ready-made'} 
                          onChange={() => setFormData({ ...formData, type: 'custom' })} 
                        />
                        Báo giá thi công (Mặc định)
                      </label>
                      <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                        <input 
                          type="radio" 
                          className="accent-primary w-4 h-4"
                          checked={formData.type === 'ready-made'} 
                          onChange={() => setFormData({ ...formData, type: 'ready-made' })} 
                        />
                        Báo giá hàng đóng sẵn
                      </label>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      Khách hàng {formData.type !== 'ready-made' && <span className="text-destructive">*</span>}
                    </Label>
                    <div className="flex gap-1 items-center">
                      <div className="relative flex-1">
                        <Input 
                          className="h-9 w-full bg-white text-xs font-medium pr-8"
                          placeholder="Nhập tên khách hàng..."
                          value={formData.customerName}
                          onChange={(e) => {
                            const val = e.target.value;
                            const matched = customers.find(c => c.name.toLowerCase() === val.toLowerCase());
                            if (matched) {
                              handleCustomerSelect(matched.id);
                            } else {
                              setFormData(prev => ({
                                ...prev,
                                customerName: val,
                                customerId: ''
                              }));
                            }
                          }}
                          list="customer-suggestions"
                        />
                        <datalist id="customer-suggestions">
                          {customers.map((c) => (
                            <option key={c.id} value={c.name}>
                              {c.phone ? `${c.phone}` : ''}
                            </option>
                          ))}
                        </datalist>
                      </div>

                      {customers.length > 0 && (
                        <Select 
                          onValueChange={(id) => handleCustomerSelect(id)} 
                          value={formData.customerId || ''}
                        >
                          <SelectTrigger className="h-9 px-2 bg-white text-xs text-slate-600 hover:text-slate-900 border border-input w-auto shrink-0" title="Chọn từ danh sách khách hàng">
                            <span className="hidden sm:inline text-xs font-medium mr-1">Chọn từ DS</span>
                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          </SelectTrigger>
                          <SelectContent align="end" className="max-h-60 overflow-y-auto">
                            {customers.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                <div className="flex flex-col items-start">
                                  <span className="font-medium text-xs">{c.name}</span>
                                  <span className="text-[10px] text-muted-foreground">{c.phone}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {(formData.customerId || formData.customerName) && (
                        <Button 
                          type="button"
                          variant="outline" 
                          size="icon" 
                          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive" 
                          onClick={() => {
                            setFormData({
                              ...formData,
                              customerId: '',
                              customerName: '',
                              phone: '',
                              address: '',
                              quotationNumber: `BG-${getCurrentVNYear()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`
                            });
                          }}
                          title="Bỏ chọn/Xóa tên khách hàng"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">SĐT liên hệ</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input 
                        className="pl-9 h-9 w-full bg-white"
                        placeholder="09xx xxx xxx"
                        value={formData.phone} 
                        onChange={(e) => {
                          const inputVal = e.target.value;
                          const cleanVal = inputVal.trim().replace(/\D/g, '');
                          
                          // Look for matching customer SĐT
                          let matchedCustomer = null;
                          if (cleanVal.length >= 9) {
                            matchedCustomer = customers.find(c => c.phone.trim().replace(/\D/g, '') === cleanVal);
                          }
                          
                          if (matchedCustomer) {
                            // Extract quotation number prefix from customer code
                            let newQuotationNumber = formData.quotationNumber;
                            if (matchedCustomer.code) {
                              const baseCode = matchedCustomer.code.split(/[_-]/)[0].trim();
                              newQuotationNumber = `BG-${baseCode}`;
                            }
                            
                            setFormData({
                              ...formData,
                              phone: inputVal,
                              customerId: matchedCustomer.id,
                              customerName: matchedCustomer.name,
                              address: matchedCustomer.address,
                              quotationNumber: newQuotationNumber,
                              constructionType: matchedCustomer.workshop ? `Thi công ${matchedCustomer.workshop}` : formData.constructionType,
                              workshop: matchedCustomer.workshop || ''
                            });
                            
                            toast.success(`Đã tự động nhận diện khách hàng: ${matchedCustomer.name} (${matchedCustomer.code})`);
                          } else {
                            setFormData({ ...formData, phone: inputVal });
                          }
                        }}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">Mã báo giá (Hồ sơ)</Label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input 
                        className="pl-9 h-9 w-full bg-white font-mono "
                        placeholder="Vd: BG-HN060"
                        value={formData.quotationNumber} 
                        onChange={(e) => setFormData({ ...formData, quotationNumber: e.target.value })}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-1 lg:col-span-1 md:col-span-2">
                    <Label className="text-xs font-bold text-slate-700">Địa chỉ thi công</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input 
                        className="pl-9 h-9 w-full bg-white"
                        placeholder="Nhập địa chỉ chi tiết..."
                        value={formData.address} 
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">Loại công trình</Label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input 
                        className="pl-9 h-9 w-full bg-white"
                        placeholder="Vd: Tủ bếp, Nội thất trọn gói..."
                        value={formData.constructionType} 
                        onChange={(e) => setFormData({ ...formData, constructionType: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">Thi công dự kiến (ngày)</Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input 
                        type="number"
                        className="pl-9 h-9 w-full text-center bg-white"
                        value={formData.estimatedTime} 
                        onChange={(e) => setFormData({ ...formData, estimatedTime: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">Ngày hiệu lực báo giá</Label>
                    <DatePicker 
                      className="h-9 w-full bg-white"
                      value={formData.date} 
                      onChange={(val) => setFormData({ ...formData, date: val })}
                    />
                  </div>
                </div>
              ) : (
                <div 
                  className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-slate-50 hover:bg-slate-100/80 transition-colors cursor-pointer"
                  onClick={() => setIsCustomerInfoExpanded(true)}
                >
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs md:text-sm font-medium">
                    <span className="font-bold text-slate-800">{formData.customerName || 'Chưa chọn khách hàng'}</span>
                    {formData.phone && (
                      <span className="text-slate-500 flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        {formData.phone}
                      </span>
                    )}
                    {formData.address && (
                      <span className="text-slate-500 flex items-center gap-1 truncate max-w-[200px] sm:max-w-xs md:max-w-md">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        {formData.address}
                      </span>
                    )}
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsCustomerInfoExpanded(true);
                    }}
                    className="h-7 text-[10px] font-bold text-primary shrink-0 hover:bg-slate-200/60 rounded px-2"
                  >
                    Thay đổi
                  </Button>
                </div>
              )}
            </section>

            {/* --- Section: Quotation Items --- */}
            <section className="space-y-4">
              <div className="sticky top-0 z-20 bg-card py-2 flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-primary/10 gap-3">
                 <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                       <Calculator className="h-4 w-4" />
                    </div>
                    <h3 className="font-bold text-base whitespace-nowrap">Danh sách hạng mục chi tiết</h3>
                    <Badge variant="secondary" className="h-6 px-2 text-xs font-mono">{formData.items.length} hạng mục</Badge>
                 </div>
                 <div className="grid grid-cols-3 gap-2 w-full sm:w-auto">
                   <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsConfigOpen(true)} 
                    className="h-9 text-[11px] sm:text-xs px-1 border-purple-200 hover:bg-purple-50 text-purple-600 font-bold shadow-sm"
                   >
                    <Settings className="h-3 w-3 mr-1" />
                    Hệ số giá
                  </Button>
                   <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setSelectedProductsForBulk([]);
                      setIsProductPickerOpen(true);
                    }} 
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
                      {/* Header: Số thứ tự, Nút di chuyển lên/xuống và Nút xóa */}
                      <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold font-mono">
                            {index + 1 < 10 ? `0${index + 1}` : index + 1}
                          </div>
                          <div className="flex items-center gap-0.5 bg-slate-100/80 rounded-md p-0.5 border border-slate-200/60">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={index === 0}
                              className="h-5 w-5 text-slate-600 hover:text-blue-600 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent"
                              onClick={() => handleMoveUp(index)}
                              title="Di chuyển lên"
                            >
                              <ArrowUp className="h-3 w-3" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={index === formData.items.length - 1}
                              className="h-5 w-5 text-slate-600 hover:text-blue-600 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent"
                              onClick={() => handleMoveDown(index)}
                              title="Di chuyển xuống"
                            >
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemoveItem(item.id)}
                          title="Xóa hạng mục"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* Body: Form nhập liệu */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                        {/* Cột trái: Thông tin sản phẩm (md:col-span-7) */}
                        <div className="md:col-span-7 space-y-2.5">
                          {/* Dòng 1: Ảnh đại diện + Thư viện mẫu + Vật liệu */}
                          <div className="flex items-start gap-2">
                            {/* Avatar */}
                            <div 
                              className="h-10 w-10 shrink-0 rounded-lg bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-all overflow-hidden relative"
                              onClick={() => document.getElementById(`upload-item-${item.id}`)?.click()}
                            >
                              {item.imageUrl ? (
                                <img src={item.imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <ImagePlus className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>

                            {/* Nhóm chọn Hạng mục & Vật liệu */}
                            <div className="flex-1 grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[10px] font-bold text-slate-500 uppercase">Thư viện mẫu</Label>
                                <Select 
                                  onValueChange={(value) => {
                                    const standard = allProducts.find(p => p.productName === value);
                                    if (standard) {
                                      const isAccessory = isAccessoryItem(standard.productName, standard.category);
                                      const ecoMultiplier = multipliers.find(m => m.code === 'ECO');
                                      const ecoRatio = ecoMultiplier ? ecoMultiplier.percentage / 100 : 1;
                                      const basePrice = getProductPriceForWorkshop(standard, formData.workshop);
                                      const unitPrice = isAccessory ? basePrice : Math.round(basePrice * ecoRatio);
                                      const accCode = isAccessory ? getAccessoryMaterialCode(standard.productName, standard.category) : 'ECO';
                                      const desc = updateDescriptionWithMaterial(standard.description || '', accCode);
                                      updateItem(item.id, { 
                                        name: standard.productName,
                                        unit: standard.unit,
                                        basePrice,
                                        unitPrice,
                                        description: desc,
                                        category: standard.category,
                                        materialCode: accCode,
                                        materialName: accCode
                                      });
                                    }
                                  }}
                                >
                                  <SelectTrigger className="h-9 text-xs font-semibold bg-slate-50 hover:bg-slate-100 border-dashed truncate">
                                    <SelectValue placeholder="Chọn mẫu..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {item.category ? (
                                      <>
                                        <SelectLabel className="text-[9px] uppercase font-bold text-primary">Hạng mục {item.category}</SelectLabel>
                                        {allProducts.filter(p => p.category === item.category).map(p => (
                                          <SelectItem key={p.productName} value={p.productName}>{p.productName}</SelectItem>
                                        ))}
                                        <SelectSeparator />
                                        <SelectLabel className="text-[9px] uppercase font-bold">Gợi ý khác</SelectLabel>
                                        {allProducts.filter(p => p.category !== item.category).map(p => (
                                          <SelectItem key={p.productName} value={p.productName}>{p.productName} ({p.category})</SelectItem>
                                        ))}
                                      </>
                                    ) : (
                                      allProducts.map(p => (
                                        <SelectItem key={p.productName} value={p.productName}>{p.productName}</SelectItem>
                                      ))
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-1">
                                <Label className="text-[10px] font-bold text-slate-500 uppercase">Vật liệu</Label>
                                <Select 
                                  value={item.materialCode || ''}
                                  onValueChange={(val) => updateItem(item.id, { materialCode: val })}
                                >
                                  <SelectTrigger className="h-9 text-xs bg-slate-50 hover:bg-slate-100 border-dashed truncate">
                                    <SelectValue placeholder="Mặc định" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {multipliers.map(m => (
                                      <SelectItem key={m.id} value={m.code}>
                                        <div className="flex items-center gap-1.5">
                                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getMaterialColor(m.code) }} />
                                          <span className="truncate">{ACCESSORY_MATERIAL_CODES.has(m.code) ? m.material : m.code} ({m.percentage}%)</span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>

                          {/* Tên sản phẩm */}
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase">Tên sản phẩm</Label>
                            <Input 
                              className="h-9 font-bold text-xs bg-card border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary"
                              placeholder="Vd: Tủ bếp dưới..." 
                              value={item.name} 
                              onChange={(e) => updateItem(item.id, { name: e.target.value })}
                            />
                          </div>

                          {/* Mô tả / Ghi chú */}
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase">Mô tả / Ghi chú</Label>
                            <Textarea 
                              className="min-h-[50px] resize-none text-xs leading-relaxed bg-card border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary"
                              placeholder="Mô tả cụ thể..."
                              value={item.description}
                              onChange={(e) => updateItem(item.id, { description: e.target.value })}
                            />
                          </div>
                        </div>

                        {/* Cột phải: Kích thước & Giá cả (md:col-span-5) */}
                        <div className="md:col-span-5 bg-slate-50/70 p-2.5 rounded-lg border border-slate-100 space-y-2.5">
                          {/* Hàng 1: Khu vực | Đơn vị | Số lượng */}
                          <div className="grid grid-cols-10 gap-2 items-end">
                            <div className="col-span-4 space-y-1">
                              <Label className="text-[10px] font-bold text-slate-500 uppercase">Khu vực</Label>
                              <Input 
                                className="h-9 text-xs w-full bg-white border-slate-200" 
                                placeholder="Vd: Phòng khách" 
                                value={item.category} 
                                onChange={(e) => updateItem(item.id, { category: e.target.value })} 
                              />
                            </div>
                            <div className="col-span-3 space-y-1">
                              <Label className="text-[10px] font-bold text-slate-500 uppercase text-center block">Đơn vị</Label>
                              <Input 
                                className="h-9 text-xs w-full text-center bg-white border-slate-200" 
                                placeholder="md" 
                                value={item.unit} 
                                onChange={(e) => updateItem(item.id, { unit: e.target.value })} 
                              />
                            </div>
                            <div className="col-span-3 space-y-1">
                              <Label className="text-[10px] font-bold text-slate-500 uppercase text-center block">S.Lượng</Label>
                              <Input 
                                type="text" 
                                className="h-9 text-xs w-full text-center bg-white border-slate-200 font-bold" 
                                placeholder="1" 
                                value={getDisplayValue(item.quantity)} 
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[^0-9.,]/g, '').replace(/,/g, '.');
                                  const parsed = parseFloat(val);
                                  updateItem(item.id, { quantity: isNaN(parsed) ? 0 : parsed });
                                }} 
                              />
                            </div>
                          </div>

                          {/* Hàng 2: Kích thước */}
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase">
                              {item.unit === 'md' ? 'Kích thước (Cạnh 1 | Cạnh 2 | Trừ Góc L)' : 'Kích thước (Dài x Rộng)'}
                            </Label>
                            <div className="grid grid-cols-3 gap-1.5">
                              <div className="relative">
                                <Input 
                                  type="text"
                                  placeholder={item.unit === 'md' ? "Cạnh 1" : "Dài"}
                                  className="h-9 bg-white border-slate-200 text-center text-xs font-bold"
                                  value={getDisplayValue(item.width)}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9.,]/g, '');
                                    updateItem(item.id, { width: val });
                                  }}
                                />
                              </div>
                              <div className="relative">
                                <Input 
                                  type="text"
                                  placeholder={item.unit === 'md' ? "Cạnh 2" : "Rộng"}
                                  className="h-9 bg-white border-slate-200 text-center text-xs font-bold"
                                  disabled={item.unit !== 'm2' && item.unit !== 'md'}
                                  value={getDisplayValue(item.height)}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9.,]/g, '');
                                    updateItem(item.id, { height: val });
                                  }}
                                />
                              </div>
                              <div>
                                {item.unit === 'md' ? (
                                  <Input 
                                    type="text"
                                    placeholder="Trừ L (0)"
                                    className="h-9 bg-white text-center text-xs font-bold text-purple-600 border-purple-200 focus:border-purple-400 focus:ring-purple-100"
                                    value={getDisplayValue(item.cornerL)}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/[^0-9.,]/g, '');
                                      updateItem(item.id, { cornerL: val });
                                    }}
                                  />
                                ) : (
                                  <div className="h-9 bg-slate-100/50 border border-dashed border-slate-200 rounded-md flex items-center justify-center text-[10px] text-slate-400 select-none">
                                    N/A
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Hàng 3: Đơn giá gốc | Báo giá | Thành tiền */}
                          <div className="grid grid-cols-3 gap-1.5 items-end">
                            <div className="space-y-1">
                              <Label className="text-[10px] font-bold text-slate-500 uppercase">Đơn giá gốc</Label>
                              <div className="relative">
                                <Input 
                                  type="text"
                                  className="h-9 font-mono font-bold text-right pr-4 text-xs bg-white border-slate-200"
                                  value={formatMoneyInput(item.basePrice !== undefined ? item.basePrice : item.unitPrice)} 
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                    updateItem(item.id, { basePrice: val === '' ? 0 : parseInt(val) });
                                  }}
                                />
                                <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[8px] font-bold text-muted-foreground uppercase">đ</span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] font-bold text-slate-500 uppercase">Báo giá</Label>
                              <div className="relative">
                                <Input 
                                  type="text"
                                  className="h-9 font-mono font-black text-right pr-4 text-xs bg-blue-50/50 border-blue-200 focus:border-blue-400 focus:ring-blue-100"
                                  value={formatMoneyInput(item.unitPrice)} 
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                    updateItem(item.id, { unitPrice: val === '' ? 0 : parseInt(val) });
                                  }}
                                />
                                <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[8px] font-bold text-blue-500 uppercase">đ</span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] font-bold text-primary uppercase block text-center">{formData.type === 'ready-made' ? 'Đơn giá USD' : 'Thành tiền'}</Label>
                              <div className="h-9 flex items-center justify-end px-1.5 bg-primary/10 rounded-lg font-mono text-[11px] font-black text-primary border border-primary/20 truncate">
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
                        type="text" 
                        className="h-8 text-right font-mono font-bold text-destructive bg-destructive/5 text-xs"
                        value={formatMoneyInput(formData.discount)}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          const discount = val === '' ? 0 : parseInt(val);
                          const amounts = getUpdatedAmounts(formData.items, discount, !!formData.hasVat);
                          setFormData({ 
                            ...formData, 
                            discount, 
                            ...amounts 
                          });
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs gap-4">
                    <span className="text-muted-foreground font-medium shrink-0">Đã đặt cọc:</span>
                    <div className="flex items-center gap-2 flex-1 justify-end max-w-[120px]">
                      <Input 
                        type="text" 
                        className="h-8 text-right font-mono font-bold text-emerald-600 bg-emerald-50 text-xs"
                        value={formatMoneyInput(formData.depositAmount)}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          const depositAmount = val === '' ? 0 : parseInt(val);
                          setFormData(prev => ({ 
                            ...prev, 
                            depositAmount 
                          }));
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs gap-4">
                    <span className="text-muted-foreground font-medium shrink-0">Thuế VAT (8%):</span>
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <Checkbox 
                        id="hasVat"
                        checked={formData.hasVat || false}
                        onCheckedChange={(checked) => {
                          const hasVat = !!checked;
                          const amounts = getUpdatedAmounts(formData.items, formData.discount, hasVat);
                          setFormData({ 
                            ...formData, 
                            hasVat,
                            vatRate: hasVat ? 8 : undefined,
                            ...amounts 
                          });
                        }}
                        className="h-4 w-4 rounded border-slate-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                    </div>
                  </div>

                  {formData.hasVat && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground font-medium">Tiền thuế VAT (8%):</span>
                      <span className="font-mono font-bold">{(formData.vatAmount || 0).toLocaleString()} VNĐ</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-border/50 border-dashed space-y-1">
                      <div className="flex justify-between items-end">
                        <span className="text-sm font-black uppercase tracking-tight">Tổng cộng</span>
                        <div className="text-right">
                          <p className="text-2xl font-black text-primary font-mono tracking-tighter tabular-nums drop-shadow-sm">
                            {formData.totalAmount.toLocaleString()}
                          </p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">
                            VNĐ {formData.hasVat ? '(Giá đã bao gồm thuế VAT 8%)' : '(Giá chưa bao gồm thuế)'}
                          </p>
                        </div>
                      </div>
                      {(formData.depositAmount ?? 0) > 0 && (
                        <div className="flex justify-between items-end pt-2 mt-2 border-t border-emerald-100">
                          <span className="text-sm font-black text-emerald-700 uppercase tracking-tight">Còn lại</span>
                          <div className="text-right">
                            <p className="text-xl font-black text-emerald-600 font-mono tracking-tighter tabular-nums drop-shadow-sm">
                              {((formData.totalAmount || 0) - (formData.depositAmount || 0)).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            </section>
            </div>
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

                <Select value={pickerCategoryFilter} onValueChange={setPickerCategoryFilter}>
                  <SelectTrigger className="w-full md:w-[180px] h-11 bg-card text-card-foreground border-gray-200 rounded-xl font-medium">
                    <SelectValue placeholder="Hạng mục" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-gray-100 shadow-xl">
                    <SelectItem value="all" className="rounded-lg font-medium">Tất cả hạng mục</SelectItem>
                    <SelectSeparator />
                    {uniqueCategories.map(cat => (
                      <SelectItem key={cat} value={cat} className="rounded-lg font-medium">{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 overflow-y-auto w-full p-8 bg-card text-card-foreground">
                {filteredLibraryProducts.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredLibraryProducts.map((product) => {
                      const isSelected = selectedProductsForBulk.some(p => p.id === product.id);
                      return (
                        <Card 
                          key={product.id} 
                          className={cn(
                            "cursor-pointer border hover:shadow-xl hover:shadow-blue-50 transition-all group relative overflow-hidden flex flex-col rounded-2xl",
                            isSelected ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md shadow-blue-50" : "border-border hover:border-blue-300"
                          )}
                          onClick={() => handleSelectFromLibrary(product as ProductLibraryItem)}
                        >
                          {isSelected && (
                            <div className="absolute top-2 left-2 z-10 w-6 h-6 rounded-full bg-blue-600 border border-white flex items-center justify-center text-white shadow-md">
                              <Check className="h-3.5 w-3.5 stroke-[3]" />
                            </div>
                          )}
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
                                {isSelected ? (
                                  <Check className="h-10 w-10 text-white opacity-0 group-hover:opacity-100 transition-all scale-50 group-hover:scale-100 drop-shadow-lg" />
                                ) : (
                                  <Plus className="h-10 w-10 text-white opacity-0 group-hover:opacity-100 transition-all scale-50 group-hover:scale-100 drop-shadow-lg" />
                                )}
                              </div>
                              <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                                <Badge className="bg-black/40 backdrop-blur-md border-none text-[9px] h-5 px-1.5 font-bold">
                                  {product.unit}
                                </Badge>
                                {product.category && (
                                  <Badge className="bg-blue-600/70 backdrop-blur-md border-none text-[8px] h-4.5 px-1 font-bold">
                                    {product.category}
                                  </Badge>
                                )}
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
                                    {getProductPriceForWorkshop(product, formData.workshop).toLocaleString()} <span className="text-[9px] opacity-60">VNĐ</span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
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
              
              <DialogFooter className="p-6 border-t bg-card text-card-foreground font-bold flex flex-row items-center justify-between sm:justify-between w-full shrink-0">
                <div className="text-xs sm:text-sm font-semibold text-slate-500">
                  {selectedProductsForBulk.length > 0 
                    ? `Đã chọn: ${selectedProductsForBulk.length} sản phẩm` 
                    : 'Chưa chọn sản phẩm nào'}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" onClick={() => {
                    setSelectedProductsForBulk([]);
                    setIsProductPickerOpen(false);
                  }} className="rounded-xl h-11 px-6 text-xs sm:text-sm">HỦY BỎ</Button>
                  <Button 
                    onClick={handleBulkAdd} 
                    disabled={selectedProductsForBulk.length === 0} 
                    className="rounded-xl h-11 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50 text-xs sm:text-sm shadow-md"
                  >
                    Thêm vào báo giá
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
      <MaterialMultiplierConfig isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} />
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
