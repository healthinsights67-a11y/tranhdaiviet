import * as React from 'react';
import { 
  Package, 
  Search, 
  Tag, 
  Box, 
  Maximize2, 
  ShoppingCart,
  CheckCircle2,
  Filter,
  Pencil,
  Trash2,
  Plus,
  ImagePlus,
  Upload,
  X,
  LayoutGrid,
  List,
  FileSpreadsheet
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { STANDARD_PRICES } from '@/src/constants/priceList';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { db, doc, getDoc } from '@/src/lib/firebase';
import { toast } from 'sonner';
import { uploadToImgBB } from '@/src/services/uploadService';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

interface ProductLibraryProps {
  products?: any[];
  user: any;
  onSave: (product: any) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function ProductLibrary({ products = [], user, onSave, onDelete }: ProductLibraryProps) {
  // Use a local state derived from props and constants for the initial list
  const productList = React.useMemo(() => {
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
        description: p.description,
        imageUrl: p.imageUrl,
        isStandard: false
      };
      
      if (idx !== -1) merged[idx] = mapped;
      else merged.push(mapped);
    });
    return merged;
  }, [products]);

  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');
  const [viewMode, setViewMode] = React.useState<'grid' | 'table'>('table');
  const [editingProduct, setEditingProduct] = React.useState<any>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  // Form State
  const [formName, setFormName] = React.useState('');
  const [formPrice, setFormPrice] = React.useState(0);
  const [formUnit, setFormUnit] = React.useState('');
  const [formDescription, setFormDescription] = React.useState('');
  const [formCategory, setFormCategory] = React.useState('');
  const [customCategory, setCustomCategory] = React.useState('');

  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const availableCategories = React.useMemo(() => {
    const list = new Set(["Phòng khách", "Phòng ngủ", "Phòng bếp", "Phòng thờ", "Hàng đóng sẵn", "Khác"]);
    productList.forEach(p => {
      if (p.category) {
        list.add(p.category.trim());
      }
    });
    return Array.from(list).filter(Boolean);
  }, [productList]);

  const categories = ['all', ...availableCategories];

  const filteredProducts = productList.filter(p => {
    const matchesSearch = p.productName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         p.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 1. Show immediate local preview
      const localUrl = URL.createObjectURL(file);
      setPreviewUrl(localUrl);
      
      setIsUploading(true);
      try {
        // Background upload
        const uploadedUrl = await uploadToImgBB(file);
        
        if (uploadedUrl) {
          setPreviewUrl(uploadedUrl); // Update with final URL
        }
      } catch (err) {
        console.error("Error uploading:", err);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleSave = async () => {
    if (!editingProduct) return;

    const productToSave = {
      id: editingProduct.id,
      productName: formName,
      unitPrice: Number(formPrice),
      unit: formUnit,
      description: formDescription,
      imageUrl: previewUrl || '',
      category: formCategory === 'custom' ? customCategory.trim() : formCategory,
      userId: user?.uid || 'anonymous'
    };

    try {
      await onSave(productToSave);
      setEditingProduct(null);
      setPreviewUrl('');
    } catch (e) {
      console.error("Lỗi khi lưu:", e);
      // Don't close if error
    }
  };

  const resetForm = (product: any) => {
    setFormName(product.productName || '');
    setFormPrice(product.unitPrice || 0);
    setFormUnit(product.unit || '');
    setFormDescription(product.description || '');
    setFormCategory(product.category || 'Phòng khách');
    setCustomCategory('');
  };

  const handleAddNew = () => {
    const newProduct = {
      id: `temp-${Date.now()}`,
      productName: 'Sản phẩm mới',
      category: 'Phòng khách',
      unitPrice: 0,
      unit: 'md',
      description: '',
      imageUrl: ''
    };
    setEditingProduct(newProduct);
    setPreviewUrl('');
    resetForm(newProduct);
  };

  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Bảng Giá Sản Phẩm', {
        pageSetup: { paperSize: 9, orientation: 'portrait' }
      });

      // Set columns
      sheet.columns = [
        { width: 8 },   // STT
        { width: 22 },  // Danh mục
        { width: 35 },  // Tên sản phẩm
        { width: 12 },  // ĐVT
        { width: 20 },  // Đơn giá gốc (VNĐ)
        { width: 50 },  // Mô tả chi tiết
      ];

      // Helper function to add merged headers
      const addTitleHeader = (text: string, bold: boolean, size: number, colorHex: string, italic = false) => {
        const row = sheet.addRow([text]);
        sheet.mergeCells(row.number, 1, row.number, 6);
        const cell = row.getCell(1);
        cell.font = { name: 'Times New Roman', bold, size, italic, color: { argb: colorHex } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        row.height = size * 1.8;
        return row;
      };

      // Header Brand Info
      addTitleHeader('CÔNG TY CỔ PHẦN QUỐC TẾ TỦ 3 MIỀN', true, 13, 'FF1E3A8A');
      addTitleHeader('Địa chỉ: Số 12, Đường 3, KCN Bắc Thăng Long, Đông Anh, Hà Nội', false, 10, 'FF4B5563');
      addTitleHeader('Điện thoại: 0976.191.583 - 0983.487.411 | Website: i-noi-that.vercel.app', false, 10, 'FF4B5563');
      
      const spaceRow = sheet.addRow([]);
      spaceRow.height = 10;

      // Document Title
      addTitleHeader('DANH MỤC BÁO GIÁ TOÀN BỘ SẢN PHẨM', true, 16, 'FF1E3A8A');
      
      const today = new Date();
      const dateString = `Ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`;
      addTitleHeader(dateString, false, 11, 'FF374151', true);

      const spaceRow2 = sheet.addRow([]);
      spaceRow2.height = 15;

      // Table Header Row
      const headerRow = sheet.addRow([
        'STT', 
        'DANH MỤC', 
        'TÊN SẢN PHẨM', 
        'ĐVT', 
        'ĐƠN GIÁ GỐC (VNĐ)', 
        'MÔ TẢ CHI TIẾT'
      ]);
      headerRow.height = 28;

      // Style Table Headers
      for (let i = 1; i <= 6; i++) {
        const cell = headerRow.getCell(i);
        cell.font = { name: 'Times New Roman', bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1E3A8A' } // Brand dark blue
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF94A3B8' } },
          left: { style: 'thin', color: { argb: 'FF94A3B8' } },
          bottom: { style: 'medium', color: { argb: 'FF1E3A8A' } },
          right: { style: 'thin', color: { argb: 'FF94A3B8' } }
        };
      }

      // Add Data Rows
      productList.forEach((product, idx) => {
        const dataRow = sheet.addRow([
          idx + 1,
          product.category || 'Khác',
          product.productName || '',
          product.unit || '—',
          product.unitPrice || 0,
          product.description || ''
        ]);
        dataRow.height = 24;

        // Apply styles to data row cells
        for (let i = 1; i <= 6; i++) {
          const cell = dataRow.getCell(i);
          cell.font = { name: 'Times New Roman', size: 11 };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };

          // Alternating backgrounds (zebra styling)
          if (idx % 2 === 1) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF8FAFC' } // light slate grey
            };
          }

          // Alignment logic
          if (i === 1 || i === 4) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else if (i === 2) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else if (i === 3) {
            cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
          } else if (i === 5) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = '#,##0" ₫"'; // Format currency beautifully
          } else if (i === 6) {
            cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
          }
        }
      });

      // Add Signature Block
      sheet.addRow([]);
      const signTitleRow = sheet.addRow(['', 'KHÁCH HÀNG XÁC NHẬN', '', '', 'ĐẠI DIỆN CÔNG TY', '']);
      sheet.mergeCells(signTitleRow.number, 2, signTitleRow.number, 3);
      sheet.mergeCells(signTitleRow.number, 5, signTitleRow.number, 6);
      signTitleRow.height = 20;

      signTitleRow.getCell(2).font = { name: 'Times New Roman', bold: true, size: 11, color: { argb: 'FF4B5563' } };
      signTitleRow.getCell(2).alignment = { horizontal: 'center' };
      signTitleRow.getCell(5).font = { name: 'Times New Roman', bold: true, size: 11, color: { argb: 'FF4B5563' } };
      signTitleRow.getCell(5).alignment = { horizontal: 'center' };

      const signSubtitleRow = sheet.addRow(['', '(Ký và ghi rõ họ tên)', '', '', '(Ký tên, đóng dấu)', '']);
      sheet.mergeCells(signSubtitleRow.number, 2, signSubtitleRow.number, 3);
      sheet.mergeCells(signSubtitleRow.number, 5, signSubtitleRow.number, 6);
      signSubtitleRow.height = 18;

      signSubtitleRow.getCell(2).font = { name: 'Times New Roman', italic: true, size: 9, color: { argb: 'FF9CA3AF' } };
      signSubtitleRow.getCell(2).alignment = { horizontal: 'center' };
      signSubtitleRow.getCell(5).font = { name: 'Times New Roman', italic: true, size: 9, color: { argb: 'FF9CA3AF' } };
      signSubtitleRow.getCell(5).alignment = { horizontal: 'center' };

      // Write to buffer and save
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `Bang_Bao_Gia_SanPham_${today.getFullYear()}${(today.getMonth()+1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}.xlsx`);
      
      toast.success('Đã xuất file excel báo giá kho sản phẩm thành công!');
    } catch (error) {
      console.error('Lỗi xuất excel:', error);
      toast.error('Lỗi khi xuất excel sản phẩm');
    }
  };

  const openEdit = (product: any) => {
    setEditingProduct(product);
    setPreviewUrl(product.imageUrl || '');
    resetForm(product);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-card text-card-foreground p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-4 flex-1 w-full max-2xl">
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Tìm kiếm mẫu sản phẩm..." 
              className="pl-10 h-10 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-primary/20"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button 
            onClick={handleExportExcel}
            variant="outline"
            className="rounded-xl h-10 px-4 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 font-bold text-xs uppercase tracking-wider transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Xuất Excel
          </Button>
          <Button 
            onClick={handleAddNew}
            className="rounded-xl h-10 px-4 bg-primary text-primary-foreground font-bold text-xs uppercase tracking-wider shadow-lg shadow-primary/20 hover:shadow-xl hover:bg-primary/90 transition-all"
          >
            <Plus className="w-4 h-4 mr-2" />
            Thêm SP Mới
          </Button>
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none w-full md:w-auto">
          <div className="flex items-center gap-1 bg-gray-100/50 p-1 rounded-xl mr-2">
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              className={cn("rounded-lg h-8 px-3 transition-all", viewMode === 'table' ? "shadow-md shadow-primary/20" : "")}
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className={cn("rounded-lg h-8 px-3 transition-all", viewMode === 'grid' ? "shadow-md shadow-primary/20" : "")}
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
          </div>
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "rounded-full h-8 px-4 text-[10px] font-bold uppercase tracking-tight transition-all",
                selectedCategory === cat ? "shadow-md shadow-primary/20" : "bg-card text-card-foreground border-gray-200"
              )}
            >
              {cat === 'all' ? 'Tất cả' : cat}
            </Button>
          ))}
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredProducts.map((product, idx) => (
            <motion.div
              key={product.id || product.productName}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card className="group relative overflow-hidden border-none shadow-sm hover:shadow-xl transition-all duration-300 bg-card text-card-foreground rounded-3xl flex flex-col h-full">
                <div className="aspect-[4/3] w-full bg-gradient-to-br from-gray-50 to-gray-100/50 flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.productName} className="w-full h-full object-cover transition-transform duration-500 transform group-hover:scale-110" referrerPolicy="no-referrer" />
                  ) : (
                    <Package className="h-12 w-12 text-gray-200 group-hover:text-primary/20 transition-all duration-500 transform group-hover:scale-125" />
                  )}
                  
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-card text-card-foreground/80 backdrop-blur-md text-primary border-primary/10 text-[9px] font-black tracking-widest px-2 shadow-sm">
                      {product.category?.toUpperCase()}
                    </Badge>
                  </div>
                  
                  <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-black/60 backdrop-blur-md text-white px-2 py-1 rounded-lg text-[9px] font-bold shadow-lg">
                    <Box className="w-3 h-3" />
                    ĐVT: {product.unit}
                  </div>

                  {/* Overlay Actions */}
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-3">
                    <Button 
                      size="icon" 
                      variant="secondary" 
                      className="rounded-2xl h-12 w-12 hover:scale-110 transition-transform"
                      onClick={() => openEdit(product)}
                    >
                      <Pencil className="w-5 h-5 text-slate-700" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="destructive" 
                      className="rounded-2xl h-12 w-12 hover:scale-110 transition-transform shadow-lg shadow-red-500/20"
                      onClick={() => onDelete(product.id)}
                      disabled={product.isStandard}
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </div>

                <CardContent className="p-5 flex-1 flex flex-col">
                  <div className="space-y-1 mb-4">
                    <h3 className="font-black text-lg text-foreground group-hover:text-primary transition-colors leading-tight truncate">
                      {product.productName}
                    </h3>
                    <div className="min-h-[40px]">
                      <p className="text-[11px] text-muted-foreground font-medium leading-relaxed line-clamp-2">
                        {product.description || 'Sản phẩm tiêu chuẩn chất lượng cao được thiết kế riêng.'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-auto space-y-4">
                    <div className="flex items-end justify-between border-t border-gray-50 pt-4">
                      <div>
                        <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-0.5">Đơn giá niêm yết</p>
                        <p className="text-xl font-black text-primary font-mono tracking-tighter">
                          {product.unitPrice?.toLocaleString()}
                          <span className="text-xs ml-1 opacity-60">VNĐ</span>
                        </p>
                      </div>
                      <div className="h-10 w-10 rounded-2xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white mb-1 shadow-sm transition-all pointer-events-none">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="border rounded-2xl bg-card overflow-hidden flex flex-col shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                <tr>
                  <th className="px-4 py-4 font-semibold text-center w-12">STT</th>
                  <th className="px-4 py-4 font-semibold">Hình ảnh</th>
                  <th className="px-4 py-4 font-semibold">Tên sản phẩm</th>
                  <th className="px-4 py-4 font-semibold">Danh mục</th>
                  <th className="px-4 py-4 font-semibold text-center">ĐVT</th>
                  <th className="px-4 py-4 font-semibold text-right">Đơn giá gốc (VNĐ)</th>
                  <th className="px-4 py-4 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredProducts.map((product, index) => (
                  <tr key={product.id || product.productName} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-center font-medium text-muted-foreground">{index + 1}</td>
                    <td className="px-4 py-3">
                      <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.productName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <Package className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {product.productName}
                      {product.isStandard && (
                        <Badge variant="secondary" className="ml-2 text-[9px] px-1.5 py-0">Mẫu</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{product.category}</td>
                    <td className="px-4 py-3 text-center">{product.unit}</td>
                    <td className="px-4 py-3 text-right font-bold text-primary font-mono tracking-tighter text-base">
                      {product.unitPrice?.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50" onClick={() => openEdit(product)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" 
                          onClick={() => onDelete(product.id)}
                          disabled={product.isStandard}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={!!editingProduct} onOpenChange={(open) => {
        if (!open) {
          setEditingProduct(null);
          setPreviewUrl('');
        }
      }}>
        <DialogContent 
          className="sm:max-w-[700px] p-0 rounded-[32px] border-none shadow-2xl bg-card text-card-foreground max-h-[95vh] flex flex-col overflow-y-auto"
        >
          <div className="flex flex-col md:flex-row flex-1">
            {/* Image Section */}
            <div className="w-full md:w-2/5 bg-slate-50 p-8 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-100 group/img relative">
              <div 
                className="w-full aspect-square rounded-3xl bg-card text-card-foreground border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-3 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer overflow-hidden p-2 group relative"
                onClick={() => !isUploading && fileInputRef.current?.click()}
              >
                {isUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
                    <span className="text-[10px] font-bold uppercase">Đang tải...</span>
                  </div>
                ) : previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover rounded-2xl" referrerPolicy="no-referrer" />
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-4">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                      <ImagePlus className="w-8 h-8" />
                    </div>
                    <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1">Tải ảnh mẫu</p>
                    <p className="text-[10px] font-medium text-slate-400 leading-tight px-4">Định dạng JPG, PNG. Tối đa 5MB.</p>
                  </div>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden" 
                  onChange={handleFileChange}
                  accept="image/*"
                />
                
                {previewUrl && !isUploading && (
                  <>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button variant="secondary" size="sm" className="rounded-xl font-bold bg-card text-card-foreground/90">
                        <Upload className="w-4 h-4 mr-2" />
                        Thay đổi ảnh
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-3 right-3 z-20 rounded-full w-8 h-8 shadow-md opacity-90 hover:opacity-100 hover:scale-105 transition-all bg-red-600 hover:bg-red-700 text-white border-none"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewUrl('');
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
              
              <div className="mt-6 w-full space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">
                  <Package className="w-3 h-3" />
                  Thư viện ảnh gốc
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[1,2,3].map(i => (
                    <div key={i} className="aspect-square rounded-xl bg-card text-card-foreground border border-slate-100 flex items-center justify-center text-slate-200 hover:border-primary/30 hover:text-primary/30 transition-all cursor-pointer">
                      <Upload className="w-4 h-4" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Content Section */}
            <div className="w-full md:w-3/5 p-8 flex flex-col">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-1">Sửa Sản Phẩm</h2>
                  <p className="text-sm font-medium text-slate-500">
                    {editingProduct?.isStandard ? 'Thành phần hệ thống' : `Mã: ${editingProduct?.category?.toUpperCase()}-${editingProduct?.id?.substring(0, 4).toUpperCase()}`}
                  </p>
                </div>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto pr-2 scrollbar-thin">
                <div className="space-y-2">
                  <Label htmlFor="edit-name" className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Tên sản phẩm</Label>
                  <Input 
                    id="edit-name" 
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="h-14 rounded-2xl bg-slate-50/50 border-slate-100 focus:bg-card text-card-foreground focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all font-bold text-slate-800 text-base px-5" 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-category" className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Danh mục</Label>
                  <Select value={formCategory} onValueChange={setFormCategory}>
                    <SelectTrigger id="edit-category" className="h-14 w-full rounded-2xl bg-slate-50/50 border-slate-100 focus:bg-card text-card-foreground focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all font-bold px-5">
                      <SelectValue placeholder="Chọn danh mục" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-gray-100 shadow-xl">
                      {availableCategories.map(cat => (
                        <SelectItem key={cat} value={cat} className="rounded-lg font-medium">{cat}</SelectItem>
                      ))}
                      <SelectItem value="custom" className="rounded-lg font-medium text-primary border-t border-slate-100 mt-1 pt-2">+ Thêm danh mục mới...</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {formCategory === 'custom' && (
                    <div className="pt-2">
                      <Input 
                        placeholder="Nhập tên danh mục mới..."
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        className="h-14 rounded-2xl bg-primary/5 border-primary/20 focus:bg-card focus:border-primary/50 transition-all font-bold text-sm px-5 text-primary" 
                        autoFocus
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-price" className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Giá niêm yết (VNĐ)</Label>
                    <div className="relative group">
                      <Input 
                        id="edit-price" 
                        type="number" 
                        value={formPrice}
                        onChange={(e) => setFormPrice(Number(e.target.value))}
                        className="h-14 w-full rounded-2xl bg-emerald-50/30 border-emerald-100/50 focus:bg-card text-card-foreground focus:border-emerald-500/30 focus:ring-4 focus:ring-emerald-500/5 transition-all font-mono font-black text-emerald-600 text-lg px-5 pr-12" 
                      />
                      <Tag className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-300" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-unit" className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Đơn vị tính</Label>
                    <Input 
                      id="edit-unit" 
                      value={formUnit}
                      onChange={(e) => setFormUnit(e.target.value)}
                      className="h-14 w-full rounded-2xl bg-slate-50/50 border-slate-100 focus:bg-card text-card-foreground focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all font-bold text-slate-800 text-center px-5 uppercase" 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-description" className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Mô tả cấu tạo chi tiết</Label>
                  <Textarea 
                    id="edit-description" 
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="rounded-2xl bg-slate-50/50 border-slate-100 focus:bg-card text-card-foreground focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all font-medium text-slate-600 text-sm p-5 min-h-[120px] resize-none leading-relaxed" 
                  />
                </div>
              </div>

              <div className="mt-10 flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1 h-14 rounded-2xl border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all"
                  onClick={() => setEditingProduct(null)}
                >
                  Hủy bỏ
                </Button>
                <Button 
                  onClick={handleSave} 
                  disabled={isUploading}
                  className="flex-[2] h-14 rounded-2xl bg-primary text-primary-foreground font-black text-sm uppercase tracking-wider shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 hover:translate-y-[-2px] active:translate-y-[0px] transition-all"
                >
                  {isUploading ? 'Đang xử lý...' : 'Lưu Thay Đổi'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {filteredProducts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-4 opacity-50 bg-card text-card-foreground rounded-3xl border-2 border-dashed border-gray-200">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
            <Filter className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold">Không tìm thấy sản phẩm</h2>
            <p className="text-muted-foreground text-sm max-w-xs">
              Thử thay đổi từ khóa tìm kiếm hoặc chọn danh mục khác.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => {setSearchTerm(''); setSelectedCategory('all')}} className="rounded-xl">Xóa bộ lọc</Button>
        </div>
      )}
    </div>
  );
}
