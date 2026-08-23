import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth } from '@/src/lib/firebase';
import { MaterialConfig, Task, Quotation, AccessoryConfig, InventoryTransaction } from '@/src/types';
import { MaterialConfigSchema, AccessoryConfigSchema, InventoryTransactionSchema } from '@/src/schemas';
import { Plus, Pencil, Trash2, Search, FileSpreadsheet, Upload, X, Check, AlertCircle, Sparkles, ArrowDownLeft, ArrowUpRight, History, Settings, AlertTriangle, FileText, Package } from 'lucide-react';
import { scanInvoice, ScannedInvoiceItem } from '@/src/services/geminiRenderService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from 'sonner';
import { ProfitAnalysis } from './ProfitAnalysis';

interface MaterialConfigPageProps {
  tasks?: Task[];
  quotations?: Quotation[];
}

export const MaterialConfigPage: React.FC<MaterialConfigPageProps> = ({ tasks = [], quotations = [] }) => {
  const [materials, setMaterials] = useState<MaterialConfig[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MaterialConfig | null>(null);

  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [bulkInputText, setBulkInputText] = useState('');
  const [bulkItems, setBulkItems] = useState<any[]>([]);
  const [bulkDefaults, setBulkDefaults] = useState({
    category: 'HẠNG MỤC BÁO GIÁ NHỰA ECOPLAST',
    unit: 'Hộp',
    width: '',
    thickness: '',
    length: '',
    itemsPerBox: '',
    preTaxMeterPrice: '',
    preTaxBoxPrice: '',
    listedMeterPrice: '',
    listedBoxPrice: '',
    discountPercent: '',
  });

  const [tempDiscounts, setTempDiscounts] = useState<Record<string, string>>({});
  const [quickApplyCategory, setQuickApplyCategory] = useState('');
  const [quickApplyPercent, setQuickApplyPercent] = useState('');

  // Accessory config states
  const [accessories, setAccessories] = useState<AccessoryConfig[]>([]);
  const [accessorySearchTerm, setAccessorySearchTerm] = useState('');
  const [isAccessoryDialogOpen, setIsAccessoryDialogOpen] = useState(false);
  const [editingAccessory, setEditingAccessory] = useState<AccessoryConfig | null>(null);
  const [accessoryFormData, setAccessoryFormData] = useState({
    name: '',
    code: '',
    option: '',
    unit: 'Cái',
    preTaxPrice: 0,
    listedPrice: 0,
    discountPercent: 0
  });
  const [tempAccessoryDiscounts, setTempAccessoryDiscounts] = useState<Record<string, string>>({});
  const [quickApplyAccName, setQuickApplyAccName] = useState('');
  const [quickApplyAccPercent, setQuickApplyAccPercent] = useState('');

  // Inventory state hooks
  const [inventorySearchTerm, setInventorySearchTerm] = useState('');
  const [inventoryFilter, setInventoryFilter] = useState<'all' | 'material' | 'accessory'>('all');
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState<'all' | 'inStock' | 'outOfStock' | 'lowStock'>('all');
  const [inventorySubView, setInventorySubView] = useState<'status' | 'history'>('status');

  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [isMinStockDialogOpen, setIsMinStockDialogOpen] = useState(false);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<any>(null);
  
  const [transactionForm, setTransactionForm] = useState({
    type: 'import' as 'import' | 'export',
    quantity: 1,
    unit: 'Hộp',
    note: ''
  });
  
  const [minStockForm, setMinStockForm] = useState({
    minStock: 0,
    stock: 0
  });

  const [isLoading, setIsLoading] = useState(false);

  // Invoice scan state hooks
  const [scannedItems, setScannedItems] = useState<ScannedInvoiceItem[]>([]);
  const [isScanConfirmDialogOpen, setIsScanConfirmDialogOpen] = useState(false);
  const [selectedScanItems, setSelectedScanItems] = useState<Record<string, boolean>>({});
  const [scannedQuantities, setScannedQuantities] = useState<Record<string, string>>({});

  const handleOpenTransactionDialog = (item: any) => {
    setSelectedInventoryItem(item);
    setTransactionForm({
      type: 'import',
      quantity: 1,
      unit: item.type === 'material' ? 'Tấm' : (item.unit || 'Cái'),
      note: ''
    });
    setIsTransactionDialogOpen(true);
  };

  const handleSaveTransaction = async () => {
    if (!selectedInventoryItem) return;
    if (transactionForm.quantity <= 0) {
      toast.error('Số lượng phải lớn hơn 0');
      return;
    }
    
    const userEmail = auth.currentUser?.email || 'Hệ thống';
    const currentStock = selectedInventoryItem.stock || 0;
    
    // Calculate quantity in main unit (e.g. Hộp)
    let qtyInMainUnit = transactionForm.quantity;
    const isSheetUnit = selectedInventoryItem.type === 'material' && transactionForm.unit === 'Tấm';
    const itemsPerBox = parseFloat(selectedInventoryItem.itemsPerBox) || 1;
    
    if (isSheetUnit) {
      qtyInMainUnit = transactionForm.quantity / itemsPerBox;
    }
    
    if (transactionForm.type === 'export' && qtyInMainUnit > currentStock) {
      if (isSheetUnit) {
        const currentStockInSheets = Math.round(currentStock * itemsPerBox * 10) / 10;
        toast.error(`Số lượng xuất kho (${transactionForm.quantity} Tấm) lớn hơn số lượng tồn kho hiện tại (${currentStockInSheets} Tấm / ${currentStock} Hộp)`);
      } else {
        toast.error(`Số lượng xuất kho (${transactionForm.quantity} ${transactionForm.unit}) lớn hơn số lượng tồn kho hiện tại (${currentStock} ${selectedInventoryItem.unit})`);
      }
      return;
    }
    
    setIsLoading(true);
    try {
      const batch = writeBatch(db);
      
      // 1. Create transaction document
      const txRef = doc(collection(db, 'inventoryTransactions'));
      const txData = {
        id: txRef.id,
        itemId: selectedInventoryItem.id,
        itemType: selectedInventoryItem.type,
        itemCode: selectedInventoryItem.code,
        itemName: selectedInventoryItem.name,
        type: transactionForm.type,
        quantity: transactionForm.quantity,
        unit: transactionForm.unit,
        note: transactionForm.note,
        createdBy: userEmail,
        createdAt: new Date().toISOString()
      };
      
      // Validate schema
      InventoryTransactionSchema.parse(txData);
      
      batch.set(txRef, txData);
      
      // 2. Update stock in item
      const itemRef = doc(
        db, 
        selectedInventoryItem.type === 'material' ? 'materialConfigs' : 'accessoryConfigs', 
        selectedInventoryItem.id
      );
      
      let newStock = transactionForm.type === 'import' 
        ? currentStock + qtyInMainUnit 
        : currentStock - qtyInMainUnit;
        
      newStock = Math.round(newStock * 1000) / 1000;
        
      batch.update(itemRef, {
        stock: newStock,
        updatedAt: new Date().toISOString()
      });
      
      await batch.commit();
      toast.success(`${transactionForm.type === 'import' ? 'Nhập kho' : 'Xuất kho'} thành công mã ${selectedInventoryItem.code}`);
      setIsTransactionDialogOpen(false);
    } catch (error: any) {
      console.error("Save transaction error:", error);
      toast.error('Lỗi khi thực hiện giao dịch: ' + (error?.message || ''));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenMinStockDialog = (item: any) => {
    setSelectedInventoryItem(item);
    setMinStockForm({
      minStock: item.minStock || 0,
      stock: item.stock || 0
    });
    setIsMinStockDialogOpen(true);
  };

  const handleSaveMinStock = async () => {
    if (!selectedInventoryItem) return;
    
    setIsLoading(true);
    try {
      const itemRef = doc(
        db, 
        selectedInventoryItem.type === 'material' ? 'materialConfigs' : 'accessoryConfigs', 
        selectedInventoryItem.id
      );
      
      await updateDoc(itemRef, {
        minStock: Number(minStockForm.minStock),
        stock: Number(minStockForm.stock),
        updatedAt: new Date().toISOString()
      });
      
      toast.success(`Đã cập nhật tồn kho & hạn mức mã ${selectedInventoryItem.code}`);
      setIsMinStockDialogOpen(false);
    } catch (error: any) {
      console.error("Save min stock error:", error);
      toast.error('Lỗi khi cập nhật hạn mức: ' + (error?.message || ''));
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const apiKey = localStorage.getItem('gemini_api_key') || '';
    if (!apiKey) {
      toast.error("Vui lòng cấu hình Gemini API Key trước (tại tab Thiết kế AI hoặc Cài đặt hệ thống) để sử dụng chức năng quét AI.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      const toastId = toast.loading("AI đang đọc và trích xuất dữ liệu phiếu xuất kho...");
      
      try {
        const items = await scanInvoice(apiKey, base64);
        if (items.length === 0) {
          toast.error("Không trích xuất được mặt hàng nào từ ảnh. Vui lòng kiểm tra lại ảnh chụp.", { id: toastId });
          return;
        }

        // Initialize state
        setScannedItems(items);
        
        const initialSelected: Record<string, boolean> = {};
        const initialQuantities: Record<string, string> = {};
        items.forEach((item, index) => {
          const key = item.code || `item_${index}`;
          initialSelected[key] = true;
          initialQuantities[key] = String(item.quantity);
        });

        setSelectedScanItems(initialSelected);
        setScannedQuantities(initialQuantities);
        setIsScanConfirmDialogOpen(true);
        toast.success(`Đã trích xuất thành công ${items.length} mặt hàng từ phiếu!`, { id: toastId });
      } catch (err: any) {
        console.error(err);
        toast.error("Lỗi khi quét phiếu: " + (err.message || "Vui lòng thử lại."), { id: toastId });
      }
    };
    reader.readAsDataURL(file);
    
    // Reset file input so same file can be uploaded again
    e.target.value = '';
  };

  const handleSaveScannedInvoice = async () => {
    const activeScanItems = scannedItems.filter((item, index) => {
      const key = item.code || `item_${index}`;
      return selectedScanItems[key];
    });

    if (activeScanItems.length === 0) {
      toast.error("Vui lòng chọn ít nhất một mặt hàng để nhập kho");
      return;
    }

    setIsLoading(true);
    const userEmail = auth.currentUser?.email || 'Hệ thống (Quét AI)';
    
    try {
      const batch = writeBatch(db);
      
      for (let i = 0; i < scannedItems.length; i++) {
        const item = scannedItems[i];
        const key = item.code || `item_${i}`;
        if (!selectedScanItems[key]) continue;
        
        const quantity = parseFloat(scannedQuantities[key]) || 0;
        if (quantity <= 0) continue;
        
        // Find existing match
        const matchedMaterial = materials.find(m => m.code === item.code);
        const matchedAccessory = accessories.find(a => a.code === item.code);
        
        let itemId = '';
        let itemType: 'material' | 'accessory' = 'material';
        let finalItemName = item.name;
        let itemsPerBox = 1;
        let currentStock = 0;
        
        if (matchedMaterial) {
          itemId = matchedMaterial.id;
          itemType = 'material';
          finalItemName = matchedMaterial.name || `Tấm nhựa mã ${matchedMaterial.code}`;
          itemsPerBox = parseFloat(matchedMaterial.itemsPerBox) || 1;
          currentStock = matchedMaterial.stock || 0;
        } else if (matchedAccessory) {
          itemId = matchedAccessory.id;
          itemType = 'accessory';
          finalItemName = matchedAccessory.name;
          currentStock = matchedAccessory.stock || 0;
        } else {
          // New item - auto create
          const isAccessory = item.unit.toLowerCase() === 'cái' || item.unit.toLowerCase() === 'bộ' || item.unit.toLowerCase() === 'chiếc';
          itemType = isAccessory ? 'accessory' : 'material';
          
          const newDocRef = doc(collection(db, itemType === 'material' ? 'materialConfigs' : 'accessoryConfigs'));
          itemId = newDocRef.id;
          
          if (itemType === 'material') {
            const newMaterialData = {
              id: itemId,
              code: item.code,
              category: 'VẬT TƯ NHỰA MỚI (QUÉT AI)',
              unit: item.unit,
              itemsPerBox: '6',
              stock: 0,
              minStock: 5,
              createdAt: new Date().toISOString()
            };
            MaterialConfigSchema.parse(newMaterialData);
            batch.set(newDocRef, newMaterialData);
          } else {
            const newAccessoryData = {
              id: itemId,
              code: item.code,
              name: item.name,
              unit: item.unit,
              stock: 0,
              minStock: 10,
              createdAt: new Date().toISOString()
            };
            AccessoryConfigSchema.parse(newAccessoryData);
            batch.set(newDocRef, newAccessoryData);
          }
        }
        
        // Calculate stock increment
        let qtyInMainUnit = quantity;
        const isSheetUnit = itemType === 'material' && item.unit === 'Tấm';
        if (isSheetUnit) {
          qtyInMainUnit = quantity / itemsPerBox;
        }
        
        // Create transaction log
        const txRef = doc(collection(db, 'inventoryTransactions'));
        const txData = {
          id: txRef.id,
          itemId: itemId,
          itemType: itemType,
          itemCode: item.code,
          itemName: finalItemName,
          type: 'import' as const,
          quantity: quantity,
          unit: item.unit,
          note: 'Nhập kho tự động quét từ ảnh phiếu xuất kho',
          createdBy: userEmail,
          createdAt: new Date().toISOString()
        };
        
        InventoryTransactionSchema.parse(txData);
        batch.set(txRef, txData);
        
        // Update stock
        const itemDocRef = doc(
          db, 
          itemType === 'material' ? 'materialConfigs' : 'accessoryConfigs', 
          itemId
        );
        
        let newStock = currentStock + qtyInMainUnit;
        newStock = Math.round(newStock * 1000) / 1000;
        
        batch.update(itemDocRef, {
          stock: newStock,
          updatedAt: new Date().toISOString()
        });
      }
      
      await batch.commit();
      toast.success(`Đã lưu thành công ${activeScanItems.length} mặt hàng vào kho!`);
      setIsScanConfirmDialogOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error("Lỗi khi lưu dữ liệu quét: " + (err.message || "Vui lòng kiểm tra lại."));
    } finally {
      setIsLoading(false);
    }
  };

  const parsePrice = (val: string | number | undefined | null): number => {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return val;
    const cleaned = val.replace(/[^0-9]/g, '');
    return cleaned ? parseInt(cleaned, 10) : 0;
  };

  const handleSaveInlineDiscount = async (item: MaterialConfig, valueStr: string) => {
    const value = Number(valueStr);
    if (isNaN(value) || value < 0 || value > 100) {
      toast.error('Chiết khấu phải là số từ 0 đến 100');
      return;
    }
    const finalPrice = Math.round((item.preTaxBoxPrice || 0) * (1 - value / 100));
    try {
      await updateDoc(doc(db, 'materialConfigs', item.id), {
        discountPercent: value,
        finalPrice: finalPrice,
        updatedAt: new Date().toISOString()
      });
      toast.success(`Đã cập nhật chiết khấu mã ${item.code} thành ${value}%`);
      setTempDiscounts(prev => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    } catch (error: any) {
      toast.error('Không thể cập nhật chiết khấu: ' + (error?.message || ''));
    }
  };

  const handleApplyCategoryDiscount = async () => {
    if (!quickApplyCategory) {
      toast.error('Vui lòng chọn hạng mục sản phẩm');
      return;
    }
    const percent = Number(quickApplyPercent);
    if (isNaN(percent) || percent < 0 || percent > 100 || quickApplyPercent.trim() === '') {
      toast.error('Vui lòng nhập chiết khấu hợp lệ (từ 0 đến 100)');
      return;
    }

    const itemsToUpdate = materials.filter(m => m.category === quickApplyCategory);
    if (itemsToUpdate.length === 0) {
      toast.error('Không tìm thấy sản phẩm nào trong hạng mục này');
      return;
    }

    try {
      const batch = writeBatch(db);
      itemsToUpdate.forEach(item => {
        const finalPrice = Math.round((item.preTaxBoxPrice || 0) * (1 - percent / 100));
        batch.update(doc(db, 'materialConfigs', item.id), {
          discountPercent: percent,
          finalPrice: finalPrice,
          updatedAt: new Date().toISOString()
        });
      });
      await batch.commit();
      toast.success(`Đã cập nhật chiết khấu ${percent}% cho toàn bộ ${itemsToUpdate.length} sản phẩm thuộc ${quickApplyCategory}`);
      setQuickApplyPercent('');
    } catch (error: any) {
      toast.error('Lỗi khi cập nhật chiết khấu hàng loạt: ' + (error?.message || ''));
    }
  };

  const handleParseText = () => {
    if (!bulkInputText.trim()) {
      toast.error('Vui lòng nhập hoặc dán dữ liệu');
      return;
    }

    const lines = bulkInputText.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    const parsedRows: any[] = [];
    let currentCategory = bulkDefaults.category || 'HẠNG MỤC BÁO GIÁ NHỰA ECOPLAST';
    let lastWidth = '';

    lines.forEach((line, index) => {
      const upperLine = line.toUpperCase();
      
      if (upperLine.includes('HẠNG MỤC BÁO GIÁ') || upperLine.includes('BÁO GIÁ')) {
        currentCategory = line.trim();
        return;
      }

      if (upperLine.includes('CHIỀU RỘNG') || upperLine.includes('ĐỘ DÀY') || upperLine.includes('MÃ HÀNG') || upperLine.includes('SỐ TẤM')) {
        return;
      }

      let processedLine = line;
      processedLine = processedLine.replace(/Chân\s+đáy\s+70/gi, 'Chân-đáy-70');
      processedLine = processedLine.replace(/Chân\s+đáy/gi, 'Chân-đáy');

      const cells = processedLine.includes('\t') 
        ? processedLine.split('\t') 
        : processedLine.split(/[\s,;]+/);

      const trimmedCells = cells.map(c => c.trim().replace(/-/g, ' ')).filter(c => c.length > 0);

      if (trimmedCells.length < 5) {
        return;
      }

      let isSttPresent = !isNaN(Number(trimmedCells[0]));
      let tokens = isSttPresent ? trimmedCells.slice(1) : trimmedCells;

      if (tokens.length < 4) return;

      let width = '';
      let thickness = '';
      let length = '';
      let code = '';
      let itemsPerBox = '';
      let unit = bulkDefaults.unit || 'Hộp';
      let preTaxMeterPrice = 0;
      let preTaxBoxPrice = 0;
      let listedMeterPrice = 0;
      let listedBoxPrice = 0;

      const firstToken = tokens[0];
      const isFirstTokenThickness = !isNaN(Number(firstToken)) && Number(firstToken) < 10;

      if (isFirstTokenThickness && lastWidth) {
        width = lastWidth;
        thickness = tokens[0] || '';
        length = tokens[1] || '';
        code = tokens[2] || '';
        itemsPerBox = tokens[3] || '';
        unit = tokens[4] || bulkDefaults.unit || 'Hộp';
        preTaxMeterPrice = parsePrice(tokens[5]);
        preTaxBoxPrice = parsePrice(tokens[6]);
        listedMeterPrice = parsePrice(tokens[7]);
        listedBoxPrice = parsePrice(tokens[8]);
      } else {
        width = tokens[0] || '';
        if (width) lastWidth = width;
        thickness = tokens[1] || '';
        length = tokens[2] || '';
        code = tokens[3] || '';
        itemsPerBox = tokens[4] || '';
        unit = tokens[5] || bulkDefaults.unit || 'Hộp';
        preTaxMeterPrice = parsePrice(tokens[6]);
        preTaxBoxPrice = parsePrice(tokens[7]);
        listedMeterPrice = parsePrice(tokens[8]);
        listedBoxPrice = parsePrice(tokens[9]);
      }

      parsedRows.push({
        id: `temp-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
        category: currentCategory,
        code,
        width,
        thickness,
        length,
        itemsPerBox,
        unit,
        preTaxMeterPrice,
        preTaxBoxPrice,
        listedMeterPrice,
        listedBoxPrice,
        discountPercent: Number(bulkDefaults.discountPercent) || 0,
      });
    });

    setBulkItems(parsedRows);
    toast.success(`Đã phân tích thành công ${parsedRows.length} dòng vật tư`);
  };

  const handleUpdateCell = (index: number, field: string, value: any) => {
    setBulkItems(prev => prev.map((item, idx) => {
      if (idx === index) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleUpdateCellPrice = (index: number, field: string, value: string) => {
    const numericVal = parsePrice(value);
    setBulkItems(prev => prev.map((item, idx) => {
      if (idx === index) {
        return { ...item, [field]: numericVal };
      }
      return item;
    }));
  };

  const handleRemoveRow = (index: number) => {
    setBulkItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleAddEmptyRow = () => {
    setBulkItems(prev => [
      ...prev,
      {
        id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        category: bulkDefaults.category,
        code: '',
        width: bulkDefaults.width,
        thickness: bulkDefaults.thickness,
        length: bulkDefaults.length,
        itemsPerBox: bulkDefaults.itemsPerBox,
        unit: bulkDefaults.unit,
        preTaxMeterPrice: Number(bulkDefaults.preTaxMeterPrice) || 0,
        preTaxBoxPrice: Number(bulkDefaults.preTaxBoxPrice) || 0,
        listedMeterPrice: Number(bulkDefaults.listedMeterPrice) || 0,
        listedBoxPrice: Number(bulkDefaults.listedBoxPrice) || 0,
        discountPercent: Number(bulkDefaults.discountPercent) || 0,
      }
    ]);
  };

  const handleApplyDefaults = () => {
    setBulkItems(prev => prev.map(item => {
      const updated = { ...item };
      if (!updated.category && bulkDefaults.category) updated.category = bulkDefaults.category;
      if (!updated.unit && bulkDefaults.unit) updated.unit = bulkDefaults.unit;
      if (!updated.width && bulkDefaults.width) updated.width = bulkDefaults.width;
      if (!updated.thickness && bulkDefaults.thickness) updated.thickness = bulkDefaults.thickness;
      if (!updated.length && bulkDefaults.length) updated.length = bulkDefaults.length;
      if (!updated.itemsPerBox && bulkDefaults.itemsPerBox) updated.itemsPerBox = bulkDefaults.itemsPerBox;
      if (!updated.preTaxMeterPrice && bulkDefaults.preTaxMeterPrice) updated.preTaxMeterPrice = Number(bulkDefaults.preTaxMeterPrice);
      if (!updated.preTaxBoxPrice && bulkDefaults.preTaxBoxPrice) updated.preTaxBoxPrice = Number(bulkDefaults.preTaxBoxPrice);
      if (!updated.listedMeterPrice && bulkDefaults.listedMeterPrice) updated.listedMeterPrice = Number(bulkDefaults.listedMeterPrice);
      if (!updated.listedBoxPrice && bulkDefaults.listedBoxPrice) updated.listedBoxPrice = Number(bulkDefaults.listedBoxPrice);
      if ((updated.discountPercent === undefined || updated.discountPercent === 0) && bulkDefaults.discountPercent) updated.discountPercent = Number(bulkDefaults.discountPercent);
      return updated;
    }));
    toast.success('Đã áp dụng thông số mặc định cho các ô trống');
  };

  const handleSaveBulk = async () => {
    if (bulkItems.length === 0) {
      toast.error('Không có vật tư nào để lưu');
      return;
    }

    const validatedItems: any[] = [];
    const errors: string[] = [];

    for (let i = 0; i < bulkItems.length; i++) {
      const item = bulkItems[i];
      if (!item.code) {
        errors.push(`Dòng ${i + 1}: Thiếu mã hàng hoá`);
        continue;
      }
      if (!item.unit) {
        errors.push(`Dòng ${i + 1}: Thiếu đơn vị tính`);
        continue;
      }

      const discount = Number(item.discountPercent) || 0;
      const finalPrice = Math.round((Number(item.preTaxBoxPrice) || 0) * (1 - discount / 100));
      
      try {
        const docRef = doc(collection(db, 'materialConfigs'));
        const validated = MaterialConfigSchema.parse({
          id: docRef.id,
          category: item.category || 'HẠNG MỤC BÁO GIÁ NHỰA ECOPLAST',
          code: item.code.trim(),
          width: item.width || '',
          thickness: item.thickness || '',
          length: item.length || '',
          itemsPerBox: item.itemsPerBox || '',
          unit: item.unit.trim(),
          preTaxMeterPrice: Number(item.preTaxMeterPrice) || 0,
          preTaxBoxPrice: Number(item.preTaxBoxPrice) || 0,
          listedMeterPrice: Number(item.listedMeterPrice) || 0,
          listedBoxPrice: Number(item.listedBoxPrice) || 0,
          discountPercent: discount,
          finalPrice: finalPrice,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        validatedItems.push({ docRef, validated });
      } catch (err: any) {
        errors.push(`Dòng ${i + 1} (${item.code || 'không có mã'}): ${err.message || 'Lỗi kiểm tra dữ liệu'}`);
      }
    }

    if (errors.length > 0) {
      const errorMsg = errors.slice(0, 3).join('\n');
      toast.error(`Dữ liệu không hợp lệ. Vui lòng kiểm tra lại:\n${errorMsg}${errors.length > 3 ? `\n... và ${errors.length - 3} lỗi khác` : ''}`);
      return;
    }

    try {
      const CHUNK_SIZE = 400;
      for (let i = 0; i < validatedItems.length; i += CHUNK_SIZE) {
        const chunk = validatedItems.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(({ docRef, validated }) => {
          batch.set(docRef, validated);
        });
        await batch.commit();
      }
      toast.success(`Đã lưu thành công ${validatedItems.length} vật tư!`);
      setIsBulkDialogOpen(false);
      setBulkInputText('');
      setBulkItems([]);
    } catch (error: any) {
      toast.error('Lỗi khi lưu dữ liệu hàng loạt: ' + (error?.message || ''));
      try {
        handleFirestoreError(error as Error, OperationType.CREATE, 'Lưu vật tư hàng loạt');
      } catch(e) {}
    }
  };

  const [formData, setFormData] = useState({
    code: '',
    width: '',
    thickness: '',
    length: '',
    itemsPerBox: '',
    unit: 'Hộp',
    preTaxMeterPrice: 0,
    preTaxBoxPrice: 0,
    listedMeterPrice: 0,
    listedBoxPrice: 0,
    category: 'HẠNG MỤC BÁO GIÁ NHỰA ECOPLAST',
    discountPercent: 0
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'materialConfigs'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as MaterialConfig);
      // Sort by code or name
      data.sort((a, b) => a.code.localeCompare(b.code));
      setMaterials(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'Tải danh sách vật tư');
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'accessoryConfigs'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as AccessoryConfig);
      data.sort((a, b) => a.name.localeCompare(b.name) || a.code.localeCompare(b.code));
      setAccessories(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'Tải danh sách phụ kiện');
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'inventoryTransactions'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as InventoryTransaction);
      data.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setTransactions(data);
    }, (error) => {
      // Avoid failing application if collection doesn't exist yet
      console.warn("Failed to load inventoryTransactions, might not exist yet:", error);
    });
    return () => unsub();
  }, []);

  const processedMaterials = useMemo(() => {
    // 1. Find templates (items with preTaxBoxPrice > 0 or listedBoxPrice > 0)
    const templates: Record<string, MaterialConfig> = {};
    materials.forEach(m => {
      const baseCode = m.code.split('_').pop() || '';
      const hasPrice = (m.preTaxBoxPrice || 0) > 0 || (m.listedBoxPrice || 0) > 0;
      if (hasPrice && baseCode) {
        if (!templates[baseCode] || m.code === baseCode || m.code.startsWith('AT_') || m.code.startsWith('HN_')) {
          templates[baseCode] = m;
        }
      }
    });

    // 2. Map and inherit properties
    return materials.map(m => {
      const baseCode = m.code.split('_').pop() || '';
      const hasPrice = (m.preTaxBoxPrice || 0) > 0 || (m.listedBoxPrice || 0) > 0;
      
      if (hasPrice) {
        const discount = m.discountPercent !== undefined ? m.discountPercent : 38;
        const finalPrice = Math.round((m.preTaxBoxPrice || 0) * (1 - discount / 100));
        return {
          ...m,
          discountPercent: discount,
          finalPrice,
          isBaseTemplate: true
        };
      }

      const template = templates[baseCode];
      if (template) {
        const discount = m.discountPercent !== undefined ? m.discountPercent : (template.discountPercent !== undefined ? template.discountPercent : 38);
        const finalPrice = Math.round((template.preTaxBoxPrice || 0) * (1 - discount / 100));
        return {
          ...m,
          width: m.width || template.width,
          thickness: m.thickness || template.thickness,
          length: m.length || template.length,
          itemsPerBox: m.itemsPerBox || template.itemsPerBox,
          preTaxMeterPrice: template.preTaxMeterPrice,
          preTaxBoxPrice: template.preTaxBoxPrice,
          listedMeterPrice: template.listedMeterPrice,
          listedBoxPrice: template.listedBoxPrice,
          discountPercent: discount,
          finalPrice,
          isInherited: true,
          inheritedFrom: template.code
        };
      }

      return {
        ...m,
        discountPercent: m.discountPercent !== undefined ? m.discountPercent : 38,
        finalPrice: 0
      };
    });
  }, [materials]);

  const inventoryItems = useMemo(() => {
    const mats = processedMaterials.map(m => ({
      ...m,
      name: m.name || `Tấm nhựa mã ${m.code}`,
      type: 'material' as const,
      category: m.category || 'Vật tư nhựa'
    }));
    const accs = accessories.map(a => ({
      ...a,
      type: 'accessory' as const,
      category: 'Phụ kiện'
    }));
    return [...mats, ...accs];
  }, [materials, accessories]);

  const filteredInventory = useMemo(() => {
    return inventoryItems.filter(item => {
      const matchesSearch = 
        item.code.toLowerCase().includes(inventorySearchTerm.toLowerCase()) ||
        item.name.toLowerCase().includes(inventorySearchTerm.toLowerCase()) ||
        (item.category || '').toLowerCase().includes(inventorySearchTerm.toLowerCase());
      
      const matchesType = 
        inventoryFilter === 'all' || 
        item.type === inventoryFilter;
        
      const stockVal = item.stock || 0;
      const minStockVal = item.minStock || 0;
      
      let matchesStatus = true;
      if (inventoryStatusFilter === 'inStock') {
        matchesStatus = stockVal > 0;
      } else if (inventoryStatusFilter === 'outOfStock') {
        matchesStatus = stockVal === 0;
      } else if (inventoryStatusFilter === 'lowStock') {
        matchesStatus = stockVal <= minStockVal;
      }
      
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [inventoryItems, inventorySearchTerm, inventoryFilter, inventoryStatusFilter]);
  const totalInventoryValue = useMemo(() => {
    return inventoryItems.reduce((sum, item) => {
      const stock = item.stock || 0;
      const price = item.type === 'material' 
        ? (item.finalPrice || item.preTaxBoxPrice || 0) 
        : (item.finalPrice || item.preTaxPrice || 0);
      return sum + (stock * price);
    }, 0);
  }, [inventoryItems]);

  const totalFilteredValue = useMemo(() => {
    return filteredInventory.reduce((sum, item) => {
      const stock = item.stock || 0;
      const price = item.type === 'material' 
        ? (item.finalPrice || item.preTaxBoxPrice || 0) 
        : (item.finalPrice || item.preTaxPrice || 0);
      return sum + (stock * price);
    }, 0);
  }, [filteredInventory]);
  const handleOpenAccessoryDialog = (item?: AccessoryConfig) => {
    if (item) {
      setEditingAccessory(item);
      setAccessoryFormData({
        name: item.name,
        code: item.code,
        option: item.option || '',
        unit: item.unit,
        preTaxPrice: item.preTaxPrice || 0,
        listedPrice: item.listedPrice || 0,
        discountPercent: item.discountPercent || 0
      });
    } else {
      setEditingAccessory(null);
      setAccessoryFormData({
        name: '',
        code: '',
        option: '',
        unit: 'Cái',
        preTaxPrice: 0,
        listedPrice: 0,
        discountPercent: 0
      });
    }
    setIsAccessoryDialogOpen(true);
  };

  const handleSaveAccessory = async () => {
    try {
      const parsedData = AccessoryConfigSchema.parse({
        id: editingAccessory ? editingAccessory.id : doc(collection(db, 'accessoryConfigs')).id,
        name: accessoryFormData.name.trim(),
        code: accessoryFormData.code.trim(),
        option: accessoryFormData.option.trim(),
        unit: accessoryFormData.unit.trim(),
        preTaxPrice: Number(accessoryFormData.preTaxPrice) || 0,
        listedPrice: Number(accessoryFormData.listedPrice) || 0,
        discountPercent: Number(accessoryFormData.discountPercent) || 0,
        finalPrice: Math.round((Number(accessoryFormData.preTaxPrice) || 0) * (1 - (Number(accessoryFormData.discountPercent) || 0) / 100))
      });

      const docId = parsedData.id;
      await setDoc(doc(db, 'accessoryConfigs', docId), {
        ...parsedData,
        createdAt: editingAccessory ? (editingAccessory.createdAt || new Date().toISOString()) : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      toast.success(editingAccessory ? 'Cập nhật phụ kiện thành công' : 'Thêm phụ kiện mới thành công');
      setIsAccessoryDialogOpen(false);
    } catch (error: any) {
      toast.error('Lỗi khi lưu phụ kiện: ' + (error?.message || error));
    }
  };

  const handleDeleteAccessory = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'accessoryConfigs', id));
      toast.success('Đã xóa phụ kiện thành công');
    } catch (error: any) {
      toast.error('Lỗi khi xóa phụ kiện: ' + (error?.message || error));
    }
  };

  const handleSaveInlineAccessoryDiscount = async (item: AccessoryConfig, valueStr: string) => {
    const value = Number(valueStr);
    if (isNaN(value) || value < 0 || value > 100) {
      toast.error('Chiết khấu phải là số từ 0 đến 100');
      return;
    }
    const finalPrice = Math.round((item.preTaxPrice || 0) * (1 - value / 100));
    try {
      await updateDoc(doc(db, 'accessoryConfigs', item.id), {
        discountPercent: value,
        finalPrice: finalPrice,
        updatedAt: new Date().toISOString()
      });
      toast.success(`Đã cập nhật chiết khấu phụ kiện mã ${item.code} thành ${value}%`);
      setTempAccessoryDiscounts(prev => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    } catch (error: any) {
      toast.error('Không thể cập nhật chiết khấu phụ kiện: ' + (error?.message || ''));
    }
  };

  const handleApplyAccessoryGroupDiscount = async () => {
    if (!quickApplyAccName) {
      toast.error('Vui lòng chọn tên phụ kiện');
      return;
    }
    const percent = Number(quickApplyAccPercent);
    if (isNaN(percent) || percent < 0 || percent > 100 || quickApplyAccPercent.trim() === '') {
      toast.error('Vui lòng nhập chiết khấu hợp lệ (từ 0 đến 100)');
      return;
    }

    const itemsToUpdate = accessories.filter(acc => acc.name === quickApplyAccName);
    if (itemsToUpdate.length === 0) {
      toast.error('Không tìm thấy sản phẩm phụ kiện nào');
      return;
    }

    try {
      const batch = writeBatch(db);
      itemsToUpdate.forEach(item => {
        const finalPrice = Math.round((item.preTaxPrice || 0) * (1 - percent / 100));
        batch.update(doc(db, 'accessoryConfigs', item.id), {
          discountPercent: percent,
          finalPrice: finalPrice,
          updatedAt: new Date().toISOString()
        });
      });
      await batch.commit();
      toast.success(`Đã cập nhật chiết khấu ${percent}% cho toàn bộ ${itemsToUpdate.length} phụ kiện "${quickApplyAccName}"`);
      setQuickApplyAccPercent('');
    } catch (error: any) {
      toast.error('Lỗi khi cập nhật chiết khấu hàng loạt phụ kiện: ' + (error?.message || ''));
    }
  };

  const handleOpenDialog = (item?: MaterialConfig) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        code: item.code,
        width: item.width || '',
        thickness: item.thickness || '',
        length: item.length || '',
        itemsPerBox: item.itemsPerBox || '',
        unit: item.unit,
        preTaxMeterPrice: item.preTaxMeterPrice || 0,
        preTaxBoxPrice: item.preTaxBoxPrice || 0,
        listedMeterPrice: item.listedMeterPrice || 0,
        listedBoxPrice: item.listedBoxPrice || 0,
        category: item.category || 'HẠNG MỤC BÁO GIÁ NHỰA ECOPLAST',
        discountPercent: item.discountPercent || 0
      });
    } else {
      setEditingItem(null);
      setFormData({ 
        code: '', width: '', thickness: '', length: '', itemsPerBox: '', unit: 'Hộp', 
        preTaxMeterPrice: 0, preTaxBoxPrice: 0, listedMeterPrice: 0, listedBoxPrice: 0, 
        category: 'HẠNG MỤC BÁO GIÁ NHỰA ECOPLAST',
        discountPercent: 0
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.code || !formData.unit) {
      toast.error('Vui lòng nhập đủ mã hàng và đơn vị tính');
      return;
    }
    const discount = formData.discountPercent || 0;
    const finalPrice = Math.round((formData.preTaxBoxPrice || 0) * (1 - discount / 100));

    try {
      if (editingItem) {
        await updateDoc(doc(db, 'materialConfigs', editingItem.id), {
          ...formData,
          finalPrice,
          updatedAt: new Date().toISOString()
        });
        toast.success('Cập nhật vật tư thành công');
      } else {
        const newRef = doc(collection(db, 'materialConfigs'));
        await setDoc(newRef, {
          id: newRef.id,
          ...formData,
          finalPrice,
          createdAt: new Date().toISOString()
        });
        toast.success('Thêm vật tư thành công');
      }
      setIsDialogOpen(false);
    } catch (error: any) {
      toast.error('Lỗi khi lưu dữ liệu. Vui lòng kiểm tra kết nối mạng và quyền truy cập Firestore. Chi tiết: ' + (error?.message || ''));
      try {
        handleFirestoreError(error as Error, editingItem ? OperationType.UPDATE : OperationType.CREATE, 'Lưu vật tư');
      } catch(e) {} // ignore the thrown error from handleFirestoreError
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'materialConfigs', id));
      toast.success('Xóa vật tư thành công');
    } catch (error) {
      handleFirestoreError(error as Error, OperationType.DELETE, 'Xóa vật tư');
    }
  };

  const filteredMaterials = processedMaterials.filter(m => 
    m.code.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (m.width || '').toLowerCase().includes(searchTerm.toLowerCase()) || (m.category || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-3 sm:p-4 md:p-6 h-full flex flex-col space-y-4 sm:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">Quản lý Vật tư & Lợi nhuận</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
            Cấu hình giá thành nguyên vật liệu và phân tích lãi thực tế của các đơn hàng.
          </p>
        </div>
      </div>

      <Tabs defaultValue="profit" className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid grid-cols-4 w-full bg-secondary/50 p-1 rounded-xl h-11 gap-1">
          <TabsTrigger value="profit" className="rounded-lg text-[11px] sm:text-xs font-bold px-1 py-1.5 text-center leading-tight">
            <span className="hidden sm:inline">Phân tích </span>Lãi Thực
          </TabsTrigger>
          <TabsTrigger value="config" className="rounded-lg text-[11px] sm:text-xs font-bold px-1 py-1.5 text-center leading-tight">
            <span className="hidden sm:inline">Giá </span>Vật Tư Nhựa
          </TabsTrigger>
          <TabsTrigger value="accessory" className="rounded-lg text-[11px] sm:text-xs font-bold px-1 py-1.5 text-center leading-tight">
            <span className="hidden sm:inline">Giá </span>Phụ Kiện
          </TabsTrigger>
          <TabsTrigger value="inventory" className="rounded-lg text-[11px] sm:text-xs font-bold px-1 py-1.5 text-center leading-tight">
            <span className="hidden sm:inline">Quản lý </span>Kho Hàng
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="config" className="flex-1 flex flex-col mt-4 min-h-0 data-[state=active]:flex space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-card p-3 sm:p-4 rounded-xl border shadow-sm">
            <div className="relative flex-1 min-w-[150px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input 
                placeholder="Tìm mã hoặc tên vật tư..." 
                className="pl-8 h-9 text-xs rounded-xl"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 sm:flex items-center gap-1.5">
              <Button onClick={() => setIsBulkDialogOpen(true)} variant="outline" className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5 h-9 text-xs font-bold rounded-xl justify-center">
                <FileSpreadsheet className="h-3.5 w-3.5" /> Nhập Excel
              </Button>
              <Button onClick={() => handleOpenDialog()} className="gap-1.5 h-9 text-xs font-bold rounded-xl justify-center">
                <Plus className="h-3.5 w-3.5" /> Thêm vật tư
              </Button>
            </div>
          </div>

          {/* Quick Apply Category Discount Panel */}
          <div className="flex items-center justify-between gap-4 bg-amber-50/20 border border-amber-200/50 p-4 rounded-xl shadow-sm flex-wrap">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-800">Áp dụng nhanh chiết khấu cho nhóm:</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap flex-1 justify-end">
              <select
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring max-w-xs flex-1"
                value={quickApplyCategory}
                onChange={(e) => setQuickApplyCategory(e.target.value)}
              >
                <option value="">-- Chọn hạng mục sản phẩm --</option>
                {Array.from(new Set(materials.map(m => m.category || 'HẠNG MỤC BÁO GIÁ NHỰA ECOPLAST'))).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <div className="flex items-center gap-1.5 w-24">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="26"
                  className="h-9 text-center font-bold text-amber-700 bg-amber-50/30 border-amber-200"
                  value={quickApplyPercent}
                  onChange={(e) => setQuickApplyPercent(e.target.value)}
                />
                <span className="text-sm font-bold text-amber-800">%</span>
              </div>
              <Button 
                onClick={handleApplyCategoryDiscount} 
                className="h-9 bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                disabled={!quickApplyCategory || !quickApplyPercent}
              >
                <Check className="h-4 w-4" /> Áp dụng
              </Button>
            </div>
          </div>

          {/* Info Alert: Quy ước kế thừa đơn giá */}
          <div className="bg-indigo-50 border border-indigo-100 text-indigo-700 p-3.5 rounded-xl flex items-start gap-2.5 text-xs font-semibold shadow-xs">
            <AlertCircle className="h-4 w-4 text-indigo-600 mt-0.5 flex-none animate-pulse" />
            <div>
              <span className="font-bold text-indigo-800">Quy ước giá tự động theo Mã gốc:</span> Các biến thể màu phụ (ví dụ: <code className="font-mono bg-white px-1 py-0.5 rounded border border-indigo-200">A12_4024</code>, <code className="font-mono bg-white px-1 py-0.5 rounded border border-indigo-200">AH_4024</code>, <code className="font-mono bg-white px-1 py-0.5 rounded border border-indigo-200">LUX_01_4024</code>) sẽ tự động thừa hưởng kích thước và đơn giá gốc từ mã gốc (kết thúc bằng <code className="font-mono bg-white px-1 py-0.5 rounded border border-indigo-200">4024</code>). Bạn chỉ cần thiết lập giá cho mã gốc (ví dụ: <code className="font-mono bg-white px-1 py-0.5 rounded border border-indigo-200">AT_4024</code>) và hệ thống sẽ tự động cập nhật đồng bộ.
            </div>
          </div>

          <div className="border rounded-xl bg-card flex-1 overflow-hidden flex flex-col shadow-sm">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-4 font-semibold w-12 text-center" rowSpan={2}>STT</th>
                    <th className="px-4 py-4 font-semibold text-center border-l" colSpan={3}>TÊN SẢN PHẨM</th>
                    <th className="px-4 py-4 font-semibold text-center border-l" rowSpan={2}>MÃ HÀNG HOÁ</th>
                    <th className="px-4 py-4 font-semibold text-center border-l" rowSpan={2}>SỐ TẤM / 1 HỘP</th>
                    <th className="px-4 py-4 font-semibold text-center border-l" rowSpan={2}>ĐVT</th>
                    <th className="px-4 py-4 font-semibold text-center border-l" colSpan={2}>Đơn giá trước thuế</th>
                    <th className="px-4 py-4 font-semibold text-center border-l" rowSpan={2}>CK (%)</th>
                    <th className="px-4 py-4 font-semibold text-center border-l font-bold text-amber-700" rowSpan={2}>Giá sau CK</th>
                    <th className="px-4 py-4 font-semibold text-center border-l" colSpan={2}>Đơn giá niêm yết</th>
                    <th className="px-4 py-4 font-semibold text-right border-l" rowSpan={2}>Thao tác</th>
                  </tr>
                  <tr>
                    <th className="px-2 py-2 font-semibold text-center border-t border-l">Chiều rộng</th>
                    <th className="px-2 py-2 font-semibold text-center border-t border-l">Độ dày (Cm)</th>
                    <th className="px-2 py-2 font-semibold text-center border-t border-l">Chiều dài (Cm)</th>
                    <th className="px-2 py-2 font-semibold text-center border-t border-l">Mét dài</th>
                    <th className="px-2 py-2 font-semibold text-center border-t border-l">Giá hộp</th>
                    <th className="px-2 py-2 font-semibold text-center border-t border-l">Mét dài</th>
                    <th className="px-2 py-2 font-semibold text-center border-t border-l">Giá hộp</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredMaterials.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="px-6 py-12 text-center text-muted-foreground">
                        Không tìm thấy vật tư nào
                      </td>
                    </tr>
                  ) : (
                    filteredMaterials.map((item, index) => (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors border-b">
                        <td className="px-4 py-3 text-center font-medium text-muted-foreground">{index + 1}</td>
                        <td className="px-2 py-3 text-center border-l">{item.width || '-'}</td>
                        <td className="px-2 py-3 text-center border-l">{item.thickness || '-'}</td>
                        <td className="px-2 py-3 text-center border-l">{item.length || '-'}</td>
                        <td className="px-4 py-3 font-semibold text-center border-l">
                          <span className="bg-primary/10 text-primary px-2 py-1 rounded-md text-xs font-mono">
                            {item.code}
                          </span>
                          {(item as any).isInherited && (
                            <div className="text-[9px] text-indigo-500 font-bold mt-1 uppercase" title={`Thừa hưởng đơn giá & kích thước từ mã gốc ${(item as any).inheritedFrom}`}>
                              Kế thừa: {(item as any).inheritedFrom}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center font-medium border-l">{item.itemsPerBox || '-'}</td>
                        <td className="px-4 py-3 text-center font-medium border-l">{item.unit || '-'}</td>
                        
                        <td className="px-4 py-3 text-right font-medium border-l">{(item.preTaxMeterPrice || 0).toLocaleString('vi-VN')}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-700 border-l">{(item.preTaxBoxPrice || 0).toLocaleString('vi-VN')}</td>
                        
                        <td className="px-4 py-2 text-center border-l w-24">
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              className="w-14 h-7 text-center rounded border border-amber-200/50 bg-amber-50/10 text-xs font-bold text-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
                              value={tempDiscounts[item.id] !== undefined ? tempDiscounts[item.id] : (item.discountPercent || '')}
                              onChange={(e) => {
                                setTempDiscounts(prev => ({ ...prev, [item.id]: e.target.value }));
                              }}
                              onBlur={(e) => handleSaveInlineDiscount(item, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveInlineDiscount(item, (e.target as HTMLInputElement).value);
                                }
                              }}
                              placeholder="0"
                            />
                            <span className="text-xs font-semibold text-amber-600">%</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-amber-700 border-l bg-amber-50/30">
                          {(() => {
                            const activeDiscountStr = tempDiscounts[item.id] !== undefined ? tempDiscounts[item.id] : String(item.discountPercent || 0);
                            const activeDiscount = Number(activeDiscountStr);
                            const discount = isNaN(activeDiscount) ? 0 : activeDiscount;
                            const finalPrice = Math.round((item.preTaxBoxPrice || 0) * (1 - discount / 100));
                            return finalPrice.toLocaleString('vi-VN');
                          })()}
                        </td>

                        <td className="px-4 py-3 text-right font-medium text-muted-foreground border-l">{(item.listedMeterPrice || 0).toLocaleString('vi-VN')}</td>
                        <td className="px-4 py-3 text-right font-bold text-green-600 dark:text-green-400 border-l">{(item.listedBoxPrice || 0).toLocaleString('vi-VN')}</td>
                        
                        <td className="px-4 py-3 text-right border-l">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500" onClick={() => handleOpenDialog(item)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8 text-red-500">
                                <Trash2 className="h-4 w-4" />
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Xóa vật tư</AlertDialogTitle>
                                  <AlertDialogDescription>Bạn có chắc chắn muốn xóa vật tư này?</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Hủy</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(item.id)}>Xóa</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="accessory" className="flex-1 flex flex-col mt-4 min-h-0 data-[state=active]:flex space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-card p-3 sm:p-4 rounded-xl border shadow-sm">
            <div className="relative flex-1 min-w-[150px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input 
                placeholder="Tìm kiếm theo mã hoặc tên phụ kiện..." 
                className="pl-8 h-9 text-xs rounded-xl"
                value={accessorySearchTerm}
                onChange={(e) => setAccessorySearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Button onClick={() => handleOpenAccessoryDialog()} className="gap-1.5 h-9 text-xs font-bold rounded-xl w-full sm:w-auto justify-center">
                <Plus className="h-3.5 w-3.5" /> Thêm phụ kiện
              </Button>
            </div>
          </div>

          {/* Quick Apply Accessory Discount Panel */}
          <div className="flex items-center justify-between gap-4 bg-amber-50/20 border border-amber-200/50 p-4 rounded-xl shadow-sm flex-wrap">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-800">Áp dụng nhanh chiết khấu cho nhóm phụ kiện:</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap flex-1 justify-end">
              <select
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring max-w-xs flex-1"
                value={quickApplyAccName}
                onChange={(e) => setQuickApplyAccName(e.target.value)}
              >
                <option value="">-- Chọn tên phụ kiện --</option>
                {Array.from(new Set(accessories.map(a => a.name))).map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <div className="flex items-center gap-1.5 w-24">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="20"
                  className="h-9 text-center font-bold text-amber-700 bg-amber-50/30 border-amber-200"
                  value={quickApplyAccPercent}
                  onChange={(e) => setQuickApplyAccPercent(e.target.value)}
                />
                <span className="text-sm font-bold text-amber-800">%</span>
              </div>
              <Button 
                onClick={handleApplyAccessoryGroupDiscount} 
                className="h-9 bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                disabled={!quickApplyAccName || !quickApplyAccPercent}
              >
                <Check className="h-4 w-4" /> Áp dụng
              </Button>
            </div>
          </div>

          <div className="border rounded-xl bg-card flex-1 overflow-hidden flex flex-col shadow-sm">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-4 py-4 font-semibold w-12 text-center">STT</th>
                    <th className="px-4 py-4 font-semibold border-l">Tên phụ kiện</th>
                    <th className="px-4 py-4 font-semibold text-center border-l w-28">Mã phụ kiện</th>
                    <th className="px-4 py-4 font-semibold text-center border-l">Phân loại</th>
                    <th className="px-4 py-4 font-semibold text-center border-l w-20">ĐVT</th>
                    <th className="px-4 py-4 font-semibold text-right border-l w-32">Đơn giá trước thuế</th>
                    <th className="px-4 py-4 font-semibold text-center border-l w-24 text-amber-700">CK (%)</th>
                    <th className="px-4 py-4 font-semibold text-right border-l w-32 text-amber-800 bg-amber-50/10">Giá sau CK</th>
                    <th className="px-4 py-4 font-semibold text-right border-l w-32 text-green-600 dark:text-green-450">Niêm yết</th>
                    <th className="px-4 py-4 font-semibold text-center border-l w-24">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {accessories.filter(a => 
                    a.name.toLowerCase().includes(accessorySearchTerm.toLowerCase()) ||
                    a.code.toLowerCase().includes(accessorySearchTerm.toLowerCase()) ||
                    (a.option || '').toLowerCase().includes(accessorySearchTerm.toLowerCase())
                  ).length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground text-xs">
                        Không tìm thấy phụ kiện nào
                      </td>
                    </tr>
                  ) : (
                    accessories.filter(a => 
                      a.name.toLowerCase().includes(accessorySearchTerm.toLowerCase()) ||
                      a.code.toLowerCase().includes(accessorySearchTerm.toLowerCase()) ||
                      (a.option || '').toLowerCase().includes(accessorySearchTerm.toLowerCase())
                    ).map((item, idx) => (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-center font-medium">{idx + 1}</td>
                        <td className="px-4 py-3 font-semibold text-foreground/80 border-l">{item.name}</td>
                        <td className="px-4 py-3 text-center border-l font-mono text-xs">{item.code}</td>
                        <td className="px-4 py-3 text-center border-l">{item.option || '-'}</td>
                        <td className="px-4 py-3 text-center border-l font-medium">{item.unit}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-700 border-l">{(item.preTaxPrice || 0).toLocaleString('vi-VN')}</td>
                        
                        <td className="px-4 py-2 text-center border-l w-24">
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              className="w-14 h-7 text-center rounded border border-amber-200/50 bg-amber-50/10 text-xs font-bold text-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
                              value={tempAccessoryDiscounts[item.id] !== undefined ? tempAccessoryDiscounts[item.id] : (item.discountPercent || '')}
                              onChange={(e) => {
                                setTempAccessoryDiscounts(prev => ({ ...prev, [item.id]: e.target.value }));
                              }}
                              onBlur={(e) => handleSaveInlineAccessoryDiscount(item, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveInlineAccessoryDiscount(item, (e.target as HTMLInputElement).value);
                                }
                              }}
                              placeholder="0"
                            />
                            <span className="text-xs font-semibold text-amber-600">%</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-amber-700 border-l bg-amber-50/30">
                          {(() => {
                            const activeDiscountStr = tempAccessoryDiscounts[item.id] !== undefined ? tempAccessoryDiscounts[item.id] : String(item.discountPercent || 0);
                            const activeDiscount = Number(activeDiscountStr);
                            const discount = isNaN(activeDiscount) ? 0 : activeDiscount;
                            const finalPrice = Math.round((item.preTaxPrice || 0) * (1 - discount / 100));
                            return finalPrice.toLocaleString('vi-VN');
                          })()}
                        </td>

                        <td className="px-4 py-3 text-right font-bold text-green-600 dark:text-green-400 border-l">{(item.listedPrice || 0).toLocaleString('vi-VN')}</td>
                        
                        <td className="px-4 py-2 text-center border-l">
                          <div className="flex items-center justify-center gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500" onClick={() => handleOpenAccessoryDialog(item)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8 text-red-500">
                                <Trash2 className="h-4 w-4" />
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Xác nhận xóa phụ kiện</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Bạn có chắc chắn muốn xóa phụ kiện <strong>{item.name} ({item.option || ''})</strong> có mã <strong>{item.code}</strong> khỏi hệ thống? Thao tác này không thể hoàn tác.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Hủy</AlertDialogCancel>
                                  <AlertDialogAction className="bg-red-500 hover:bg-red-600 text-white" onClick={() => handleDeleteAccessory(item.id)}>Xóa phụ kiện</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="profit" className="flex-1 mt-4 data-[state=active]:block">
          <ProfitAnalysis tasks={tasks} quotations={quotations} />
        </TabsContent>

        <TabsContent value="inventory" className="flex-1 flex flex-col mt-4 min-h-0 data-[state=active]:flex space-y-4 animate-in fade-in-50 duration-200">
          {/* Subview selectors and filter dashboard */}
          <div className="flex flex-col gap-3 bg-card p-3 sm:p-4 rounded-xl border shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
              <div className="grid grid-cols-2 bg-secondary/30 p-1 rounded-xl gap-1 w-full md:w-auto shrink-0">
                <Button 
                  variant={inventorySubView === 'status' ? 'default' : 'ghost'} 
                  size="sm" 
                  onClick={() => setInventorySubView('status')}
                  className="gap-1.5 rounded-lg text-xs font-bold h-8 justify-center"
                >
                  <Package className="h-3.5 w-3.5" /> Trạng thái tồn kho
                </Button>
                <Button 
                  variant={inventorySubView === 'history' ? 'default' : 'ghost'} 
                  size="sm" 
                  onClick={() => setInventorySubView('history')}
                  className="gap-1.5 rounded-lg text-xs font-bold h-8 justify-center"
                >
                  <History className="h-3.5 w-3.5" /> Lịch sử Nhập/Xuất
                </Button>
              </div>

              {inventorySubView === 'status' && (
                <div className="grid grid-cols-3 gap-1.5 w-full md:w-auto md:flex md:items-center">
                  <Button 
                    size="sm" 
                    onClick={() => {
                      setEditingItem(null);
                      setFormData({
                        code: '',
                        width: '',
                        thickness: '',
                        length: '',
                        itemsPerBox: '',
                        unit: 'Hộp',
                        preTaxMeterPrice: 0,
                        preTaxBoxPrice: 0,
                        listedMeterPrice: 0,
                        listedBoxPrice: 0,
                        category: 'HẠNG MỤC BÁO GIÁ NHỰA ECOPLAST',
                        discountPercent: 0
                      });
                      setIsDialogOpen(true);
                    }}
                    className="gap-1 rounded-xl text-[11px] sm:text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white h-8 px-1 sm:px-2.5 justify-center"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                    <span>+ Nhựa<span className="hidden sm:inline"> (Vật tư)</span></span>
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => handleOpenAccessoryDialog()}
                    className="gap-1 rounded-xl text-[11px] sm:text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white h-8 px-1 sm:px-2.5 justify-center"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                    <span>+ Phụ kiện</span>
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="gap-1 rounded-xl text-[11px] sm:text-xs font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50 bg-indigo-50/50 h-8 px-1 sm:px-2.5 justify-center"
                    onClick={() => document.getElementById('invoice-scanner-input')?.click()}
                  >
                    <Sparkles className="h-3.5 w-3.5 text-indigo-600 animate-pulse shrink-0" />
                    <span>Quét AI</span>
                  </Button>
                  <input 
                    id="invoice-scanner-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleInvoiceUpload}
                  />
                </div>
              )}
            </div>

            {inventorySubView === 'status' && (
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center pt-2 border-t border-border/50">
                <div className="relative flex-1 min-w-[150px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input 
                    placeholder="Tìm mã hoặc tên..." 
                    className="pl-8 h-8 md:h-9 text-xs rounded-xl"
                    value={inventorySearchTerm}
                    onChange={(e) => setInventorySearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex gap-1.5">
                  <select
                    value={inventoryFilter}
                    onChange={(e) => setInventoryFilter(e.target.value as any)}
                    className="h-8 md:h-9 rounded-xl border border-border bg-card px-2 text-xs font-semibold focus:outline-none flex-1 text-foreground"
                  >
                    <option value="all">Tất cả loại</option>
                    <option value="material">Vật tư nhựa</option>
                    <option value="accessory">Phụ kiện</option>
                  </select>
                  <select
                    value={inventoryStatusFilter}
                    onChange={(e) => setInventoryStatusFilter(e.target.value as any)}
                    className="h-8 md:h-9 rounded-xl border border-border bg-card px-2 text-xs font-semibold focus:outline-none flex-1 text-foreground"
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="inStock">Còn hàng</option>
                    <option value="outOfStock">Hết hàng</option>
                    <option value="lowStock">Cảnh báo thiếu</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Core Inventory Views */}
          {inventorySubView === 'status' ? (
            <div className="flex-1 min-h-0 bg-card border rounded-2xl shadow-sm overflow-hidden flex flex-col">
              {/* Summary stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 p-2.5 sm:p-4 border-b bg-gray-50/50 dark:bg-zinc-900/50">
                <div className="p-2.5 sm:p-3 bg-card border rounded-xl shadow-xs">
                  <p className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase leading-tight">Tổng mặt hàng</p>
                  <p className="text-base sm:text-xl font-black text-foreground mt-0.5">{inventoryItems.length}</p>
                </div>
                <div className="p-2.5 sm:p-3 bg-card border rounded-xl shadow-xs">
                  <p className="text-[9px] sm:text-[10px] font-bold text-indigo-600 uppercase leading-tight">Vốn tồn kho tổng</p>
                  <p className="text-xs sm:text-base font-black text-indigo-700 mt-0.5 truncate" title={`${totalInventoryValue.toLocaleString('vi-VN')} ₫`}>
                    {totalInventoryValue.toLocaleString('vi-VN')} ₫
                  </p>
                </div>
                <div className="p-2.5 sm:p-3 bg-card border rounded-xl shadow-xs">
                  <p className="text-[9px] sm:text-[10px] font-bold text-red-600 uppercase leading-tight">Hết hàng</p>
                  <p className="text-base sm:text-xl font-black text-red-600 mt-0.5">{inventoryItems.filter(i => (i.stock || 0) === 0).length}</p>
                </div>
                <div className="p-2.5 sm:p-3 bg-card border rounded-xl shadow-xs">
                  <p className="text-[9px] sm:text-[10px] font-bold text-amber-600 uppercase leading-tight">Cảnh báo thiếu</p>
                  <p className="text-base sm:text-xl font-black text-amber-500 mt-0.5">{inventoryItems.filter(i => (i.stock || 0) <= (i.minStock || 0)).length}</p>
                </div>
                <div className="p-2.5 sm:p-3 bg-card border rounded-xl shadow-xs col-span-2 sm:col-span-1">
                  <p className="text-[9px] sm:text-[10px] font-bold text-blue-600 uppercase leading-tight">Giá trị đã lọc</p>
                  <p className="text-xs sm:text-base font-black text-blue-700 mt-0.5 truncate" title={`${totalFilteredValue.toLocaleString('vi-VN')} ₫`}>
                    {totalFilteredValue.toLocaleString('vi-VN')} ₫
                  </p>
                </div>
              </div>

              {/* Table */}
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse min-w-[850px] table-fixed">
                  <thead>
                    <tr className="border-b bg-muted/30 text-xs font-bold text-muted-foreground select-none">
                      <th className="p-3 w-[10%]">Mã hàng</th>
                      <th className="p-3 w-[22%]">Tên / Phân loại</th>
                      <th className="p-3 w-[18%]">Hạng mục</th>
                      <th className="p-3 w-[6%] text-center">ĐVT</th>
                      <th className="p-3 w-[12%] text-center">Tồn kho / Tối thiểu</th>
                      <th className="p-3 w-[10%] text-right">Đơn giá</th>
                      <th className="p-3 w-[12%] text-right">Giá trị tồn</th>
                      <th className="p-3 w-[10%] text-right pr-4">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm">
                    {filteredInventory.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-muted-foreground">
                          <p className="font-semibold text-sm">Không tìm thấy mặt hàng nào trong kho.</p>
                          <p className="text-xs text-muted-foreground/80 mt-1 mb-4">
                            Hãy thêm mới vật tư nhựa hoặc phụ kiện để quản lý và theo dõi tồn kho.
                          </p>
                          <div className="flex justify-center gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => {
                                setEditingItem(null);
                                setFormData({
                                  code: '',
                                  width: '',
                                  thickness: '',
                                  length: '',
                                  itemsPerBox: '',
                                  unit: 'Hộp',
                                  preTaxMeterPrice: 0,
                                  preTaxBoxPrice: 0,
                                  listedMeterPrice: 0,
                                  listedBoxPrice: 0,
                                  category: 'HẠNG MỤC BÁO GIÁ NHỰA ECOPLAST',
                                  discountPercent: 0
                                });
                                setIsDialogOpen(true);
                              }}
                              className="text-xs font-bold gap-1 border-blue-200 text-blue-600 hover:bg-blue-50"
                            >
                              <Plus className="h-3.5 w-3.5" /> Thêm vật tư nhựa
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleOpenAccessoryDialog()}
                              className="text-xs font-bold gap-1 border-slate-300 text-slate-700 hover:bg-slate-50"
                            >
                              <Plus className="h-3.5 w-3.5" /> Thêm phụ kiện
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredInventory.map(item => {
                        const stockVal = item.stock || 0;
                        const minStockVal = item.minStock || 0;
                        const isLow = stockVal <= minStockVal;

                        let unitPrice = 0;
                        if (item.type === 'material') {
                          unitPrice = item.finalPrice || item.preTaxBoxPrice || 0;
                        } else {
                          unitPrice = item.finalPrice || item.preTaxPrice || 0;
                        }
                        const itemTotalValue = stockVal * unitPrice;
                        
                        let statusColor = "bg-emerald-50 text-emerald-700 border-emerald-100";
                        let statusLabel = "Còn hàng";
                        if (stockVal === 0) {
                          statusColor = "bg-red-50 text-red-700 border-red-100";
                          statusLabel = "Hết hàng";
                        } else if (isLow) {
                          statusColor = "bg-amber-50 text-amber-700 border-amber-100";
                          statusLabel = "Sắp hết";
                        }

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-3 font-mono font-bold text-slate-700">{item.code}</td>
                            <td className="p-3">
                              <p className="font-semibold text-foreground truncate">{item.name}</p>
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold border border-slate-200 mt-1 inline-block uppercase">
                                {item.type === 'material' ? 'Nhựa' : 'Phụ kiện'}
                              </span>
                            </td>
                            <td className="p-3 text-muted-foreground text-xs font-medium truncate">{item.category}</td>
                            <td className="p-3 text-center font-medium text-slate-500">{item.unit}</td>
                            <td className="p-3">
                              <div className="flex flex-col items-center">
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-base font-extrabold ${stockVal === 0 ? 'text-red-600' : isLow ? 'text-amber-500' : 'text-slate-800'}`}>
                                    {stockVal}
                                  </span>
                                  <span className="text-muted-foreground text-[10px]">/</span>
                                  <span className="text-muted-foreground text-xs font-semibold">{minStockVal}</span>
                                </div>
                                <span className={`text-[10px] font-bold border px-1.5 py-0.5 rounded-md mt-1 ${statusColor}`}>
                                  {statusLabel}
                                </span>
                              </div>
                            </td>
                            <td className="p-3 text-right font-semibold text-slate-600">
                              {unitPrice.toLocaleString('vi-VN')} ₫
                            </td>
                            <td className="p-3 text-right font-extrabold text-slate-800">
                              {itemTotalValue.toLocaleString('vi-VN')} ₫
                            </td>
                            <td className="p-3 text-right pr-4">
                              <div className="flex justify-end gap-1.5">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-8 text-xs font-bold gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  onClick={() => handleOpenTransactionDialog(item)}
                                >
                                  Nhập/Xuất
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                  onClick={() => handleOpenMinStockDialog(item)}
                                  title="Cài đặt tồn kho & Hạn mức"
                                >
                                  <Settings className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Historical Logs View */
            <div className="flex-1 min-h-0 bg-card border rounded-2xl shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b bg-gray-50/50 flex justify-between items-center">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <History className="h-4 w-4 text-blue-600" />
                  Nhật ký giao dịch nhập xuất kho nguyên vật liệu
                </h3>
                <span className="text-xs text-muted-foreground font-semibold">
                  Tổng cộng: {transactions.length} lượt giao dịch
                </span>
              </div>
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse min-w-[700px] table-fixed">
                  <thead>
                    <tr className="border-b bg-muted/30 text-xs font-bold text-muted-foreground select-none">
                      <th className="p-3 w-[18%]">Thời gian</th>
                      <th className="p-3 w-[12%]">Mã vật tư</th>
                      <th className="p-3 w-[25%]">Tên vật tư / phụ kiện</th>
                      <th className="p-3 w-[12%] text-center">Giao dịch</th>
                      <th className="p-3 w-[10%] text-center">Số lượng</th>
                      <th className="p-3 w-[13%]">Người thực hiện</th>
                      <th className="p-3 w-[10%]">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-xs font-medium">
                    {transactions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-muted-foreground font-medium">
                          Chưa có lịch sử giao dịch kho nào được ghi lại.
                        </td>
                      </tr>
                    ) : (
                      transactions.map(tx => (
                        <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-3 text-muted-foreground font-mono">
                            {new Date(tx.createdAt).toLocaleString('vi-VN')}
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-700">{tx.itemCode}</td>
                          <td className="p-3 truncate">
                            <p className="font-semibold text-foreground truncate">{tx.itemName}</p>
                            <span className="text-[9px] text-slate-400 capitalize">
                              {tx.itemType === 'material' ? 'Vật tư nhựa' : 'Phụ kiện'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            {tx.type === 'import' ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full font-bold font-semibold">
                                <ArrowDownLeft className="h-3 w-3" /> Nhập kho
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full font-bold font-semibold">
                                <ArrowUpRight className="h-3 w-3" /> Xuất kho
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center font-extrabold text-slate-800 text-sm">
                            {tx.quantity} {tx.unit}
                          </td>
                          <td className="p-3 text-slate-600 truncate" title={tx.createdBy}>{tx.createdBy.split('@')[0]}</td>
                          <td className="p-3 text-muted-foreground italic truncate" title={tx.note}>{tx.note || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog: Nhập/Xuất kho */}
      <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
        <DialogContent className="max-w-[450px] w-[95vw] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {transactionForm.type === 'import' ? (
                <ArrowDownLeft className="h-5 w-5 text-emerald-600 bg-emerald-50 rounded-md p-0.5" />
              ) : (
                <ArrowUpRight className="h-5 w-5 text-amber-600 bg-amber-50 rounded-md p-0.5" />
              )}
              {transactionForm.type === 'import' ? 'Nhập kho vật tư' : 'Xuất kho vật tư'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Mã hàng: <strong className="text-foreground">{selectedInventoryItem?.code}</strong> - Tên: <strong className="text-foreground">{selectedInventoryItem?.name}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground">Loại giao dịch</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  type="button"
                  variant={transactionForm.type === 'import' ? 'default' : 'outline'}
                  className="rounded-xl h-10 font-bold"
                  onClick={() => setTransactionForm({ ...transactionForm, type: 'import' })}
                >
                  Nhập kho (+)
                </Button>
                <Button 
                  type="button"
                  variant={transactionForm.type === 'export' ? 'default' : 'outline'}
                  className="rounded-xl h-10 font-bold"
                  onClick={() => setTransactionForm({ ...transactionForm, type: 'export' })}
                >
                  Xuất kho (-)
                </Button>
              </div>
            </div>

            {selectedInventoryItem?.type === 'material' && (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground">Đơn vị tính giao dịch</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    type="button"
                    variant={transactionForm.unit === 'Tấm' ? 'default' : 'outline'}
                    className="rounded-xl h-9 text-xs font-bold"
                    onClick={() => setTransactionForm({ ...transactionForm, unit: 'Tấm' })}
                  >
                    Tấm (Lẻ)
                  </Button>
                  <Button 
                    type="button"
                    variant={transactionForm.unit === 'Hộp' ? 'default' : 'outline'}
                    className="rounded-xl h-9 text-xs font-bold"
                    onClick={() => setTransactionForm({ ...transactionForm, unit: 'Hộp' })}
                  >
                    Hộp (Nguyên)
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground/80 mt-1">
                  * Quy đổi: 1 Hộp = {selectedInventoryItem.itemsPerBox || 1} Tấm.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="tx-qty" className="text-xs font-bold text-muted-foreground">Số lượng ({transactionForm.unit})</Label>
              <Input 
                id="tx-qty"
                type="number"
                min="1"
                value={transactionForm.quantity}
                onChange={(e) => setTransactionForm({ ...transactionForm, quantity: Math.max(1, parseInt(e.target.value) || 0) })}
                className="h-11 rounded-xl text-sm focus:border-blue-400 font-bold"
              />
              <div className="text-[11px] text-muted-foreground font-medium flex flex-col gap-0.5 mt-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <p>
                  Tồn kho hiện tại: <span className="font-bold text-foreground">{selectedInventoryItem?.stock || 0} Hộp</span>
                </p>
                {selectedInventoryItem?.type === 'material' && (
                  <p>
                    Quy đổi: <span className="font-bold text-foreground">
                      {Math.round((selectedInventoryItem?.stock || 0) * (parseFloat(selectedInventoryItem?.itemsPerBox) || 1) * 10) / 10} Tấm
                    </span>
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tx-note" className="text-xs font-bold text-muted-foreground">Ghi chú giao dịch</Label>
              <Input 
                id="tx-note"
                placeholder="VD: Nhập thêm lô hàng nhựa mới, Xuất kho lắp tủ bếp..."
                value={transactionForm.note}
                onChange={(e) => setTransactionForm({ ...transactionForm, note: e.target.value })}
                className="h-11 rounded-xl text-sm focus:border-blue-400"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsTransactionDialogOpen(false)} className="rounded-xl flex-1 sm:flex-none">
              Hủy
            </Button>
            <Button 
              onClick={handleSaveTransaction} 
              disabled={isLoading}
              className={`rounded-xl flex-1 sm:flex-none ${transactionForm.type === 'import' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-500 hover:bg-amber-600'}`}
            >
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Hạn mức & Tồn kho */}
      <Dialog open={isMinStockDialogOpen} onOpenChange={setIsMinStockDialogOpen}>
        <DialogContent className="max-w-[400px] w-[95vw] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-blue-600 bg-blue-50 rounded-md p-0.5" />
              Thiết lập kho & Hạn mức
            </DialogTitle>
            <DialogDescription className="text-xs">
              Mã hàng: <strong className="text-foreground">{selectedInventoryItem?.code}</strong> - Tên: <strong className="text-foreground">{selectedInventoryItem?.name}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label htmlFor="inv-stock" className="text-xs font-bold text-muted-foreground">Điều chỉnh số lượng tồn kho thực tế</Label>
              <Input 
                id="inv-stock"
                type="number"
                min="0"
                value={minStockForm.stock}
                onChange={(e) => setMinStockForm({ ...minStockForm, stock: Math.max(0, parseInt(e.target.value) || 0) })}
                className="h-11 rounded-xl text-sm focus:border-blue-400 font-bold text-slate-800"
              />
              <p className="text-[10px] text-muted-foreground italic">
                * Lưu ý: Đây là số tồn kho thực tế của xưởng hiện tại.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="inv-min-stock" className="text-xs font-bold text-muted-foreground">Hạn mức báo động tối thiểu</Label>
              <Input 
                id="inv-min-stock"
                type="number"
                min="0"
                value={minStockForm.minStock}
                onChange={(e) => setMinStockForm({ ...minStockForm, minStock: Math.max(0, parseInt(e.target.value) || 0) })}
                className="h-11 rounded-xl text-sm focus:border-blue-400 font-bold text-slate-800"
              />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                * Khi tồn kho thực tế chạm hoặc thấp hơn mức này, hệ thống sẽ hiện cảnh báo thiếu hàng để bạn kịp thời đặt nhập kho thêm.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsMinStockDialogOpen(false)} className="rounded-xl flex-1 sm:flex-none">
              Hủy
            </Button>
            <Button onClick={handleSaveMinStock} disabled={isLoading} className="rounded-xl flex-1 sm:flex-none">
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Xác nhận quét phiếu nhập kho */}
      <Dialog open={isScanConfirmDialogOpen} onOpenChange={setIsScanConfirmDialogOpen}>
        <DialogContent className="max-w-[750px] w-[95vw] rounded-2xl h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2 flex-none">
            <DialogTitle className="flex items-center gap-2 text-indigo-700">
              <Sparkles className="h-5 w-5 text-indigo-600 bg-indigo-50 rounded-md p-0.5" />
              Kết quả phân tích phiếu nhập kho (AI)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Gemini đã trích xuất danh sách mặt hàng dưới đây. Hãy kiểm tra lại số lượng và đánh dấu các mặt hàng bạn muốn nhập vào kho.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-2 space-y-4">
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b bg-muted/50 font-bold text-muted-foreground select-none">
                    <th className="p-3 w-[8%] text-center">Chọn</th>
                    <th className="p-3 w-[18%]">Mã hàng</th>
                    <th className="p-3 w-[32%]">Tên trích xuất</th>
                    <th className="p-3 w-[12%] text-center">Đơn vị</th>
                    <th className="p-3 w-[15%] text-center">Số lượng</th>
                    <th className="p-3 w-[15%] text-center">Đối chiếu</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-medium">
                  {scannedItems.map((item, index) => {
                    const key = item.code || `item_${index}`;
                    const isSelected = selectedScanItems[key] || false;
                    const quantity = scannedQuantities[key] || '0';
                    
                    // Match with database
                    const matchedMaterial = materials.find(m => m.code === item.code);
                    const matchedAccessory = accessories.find(a => a.code === item.code);
                    const isMatched = !!matchedMaterial || !!matchedAccessory;

                    return (
                      <tr 
                        key={key} 
                        className={`transition-colors ${isSelected ? 'bg-indigo-50/10' : 'bg-slate-50/30 text-slate-400'}`}
                      >
                        <td className="p-3 text-center">
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={(e) => setSelectedScanItems({
                              ...selectedScanItems,
                              [key]: e.target.checked
                            })}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-800">{item.code || 'N/A'}</td>
                        <td className="p-3">
                          <p className="font-semibold text-slate-800 truncate" title={item.name}>{item.name}</p>
                        </td>
                        <td className="p-3 text-center text-slate-600 font-semibold">{item.unit}</td>
                        <td className="p-3 text-center">
                          <Input 
                            type="number"
                            min="0"
                            step="any"
                            value={quantity}
                            disabled={!isSelected}
                            onChange={(e) => setScannedQuantities({
                              ...scannedQuantities,
                              [key]: e.target.value
                            })}
                            className="h-8 w-20 text-center font-bold text-slate-800 focus:border-indigo-400 mx-auto"
                          />
                        </td>
                        <td className="p-3 text-center">
                          {isMatched ? (
                            <span className="inline-flex items-center gap-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full text-[10px] font-bold">
                              Khớp hàng
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full text-[10px] font-bold" title="Hệ thống sẽ tự động tạo mặt hàng mới này">
                              Mặt hàng mới
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-50 border rounded-xl p-3.5 space-y-1.5">
              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                Lưu ý quan trọng
              </h4>
              <ul className="text-[11px] text-muted-foreground list-disc pl-4 space-y-1">
                <li>Các mặt hàng có trạng thái <strong className="text-emerald-700">Khớp hàng</strong> sẽ trực tiếp cộng dồn số lượng vào tồn kho hiện tại.</li>
                <li>Các mặt hàng có trạng thái <strong className="text-amber-700">Mặt hàng mới</strong> sẽ tự động được khai báo tạo mới trong mục cấu hình (hạng mục mặc định sẽ là VẬT TƯ NHỰA MỚI) và nhập kho với số lượng trích xuất.</li>
              </ul>
            </div>
          </div>

          <DialogFooter className="p-6 border-t bg-slate-50/50 flex gap-2 flex-none">
            <Button 
              variant="outline" 
              onClick={() => setIsScanConfirmDialogOpen(false)} 
              className="rounded-xl flex-1 sm:flex-none"
            >
              Hủy
            </Button>
            <Button 
              onClick={handleSaveScannedInvoice} 
              disabled={isLoading}
              className="rounded-xl flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white gap-2 font-bold"
            >
              <Check className="h-4 w-4" /> Lưu tất cả vào kho
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-[800px] h-[90vh] md:h-auto overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Sửa thông tin vật tư' : 'Thêm vật tư mới'}</DialogTitle>
            <DialogDescription>Nhập thông tin sản phẩm và giá (Nhựa Ecoplast, Luxury, v.v.).</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 py-4">
            
            <div className="col-span-1 md:col-span-2 space-y-2">
              <Label>Hạng mục (Tên Loại Nhựa)</Label>
              <Input
                placeholder="VD: HẠNG MỤC BÁO GIÁ NHỰA ECOPLAST"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value.toUpperCase() })}
              />
            </div>

            <div className="space-y-2">
              <Label>Mã Hàng Hoá</Label>
              <Input
                placeholder="VD: 1425"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Số tấm / 1 hộp</Label>
              <Input
                placeholder="VD: 20"
                value={formData.itemsPerBox}
                onChange={(e) => setFormData({ ...formData, itemsPerBox: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Đơn vị tính (ĐVT)</Label>
              <Input
                placeholder="VD: Hộp"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              />
            </div>

            <div className="col-span-1 md:col-span-2 mt-2">
               <h4 className="font-semibold text-sm text-primary border-b pb-2">Thông số (TÊN SẢN PHẨM)</h4>
            </div>

            <div className="space-y-2">
              <Label>Chiều rộng</Label>
              <Input
                placeholder="VD: 140"
                value={formData.width}
                onChange={(e) => setFormData({ ...formData, width: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Độ dày (Cm)</Label>
              <Input
                placeholder="VD: 1.5"
                value={formData.thickness}
                onChange={(e) => setFormData({ ...formData, thickness: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Chiều dài (Cm)</Label>
              <Input
                placeholder="VD: 2.5"
                value={formData.length}
                onChange={(e) => setFormData({ ...formData, length: e.target.value })}
              />
            </div>
            
            <div className="col-span-1 md:col-span-2 mt-2">
               <h4 className="font-semibold text-sm text-primary border-b pb-2">Báo giá (VNĐ)</h4>
            </div>

            <div className="space-y-2">
              <Label>Đơn giá trước thuế (Mét dài)</Label>
              <Input
                type="text"
                value={formData.preTaxMeterPrice ? formData.preTaxMeterPrice.toLocaleString('vi-VN') : ''}
                onChange={(e) => {
                  const rawValue = e.target.value.replace(/\D/g, '');
                  setFormData({ ...formData, preTaxMeterPrice: Number(rawValue) });
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Đơn giá trước thuế (Giá hộp)</Label>
              <Input
                type="text"
                value={formData.preTaxBoxPrice ? formData.preTaxBoxPrice.toLocaleString('vi-VN') : ''}
                onChange={(e) => {
                  const rawValue = e.target.value.replace(/\D/g, '');
                  setFormData({ ...formData, preTaxBoxPrice: Number(rawValue) });
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Đơn giá niêm yết (Mét dài)</Label>
              <Input
                type="text"
                value={formData.listedMeterPrice ? formData.listedMeterPrice.toLocaleString('vi-VN') : ''}
                onChange={(e) => {
                  const rawValue = e.target.value.replace(/\D/g, '');
                  setFormData({ ...formData, listedMeterPrice: Number(rawValue) });
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Đơn giá niêm yết (Giá hộp)</Label>
              <Input
                type="text"
                value={formData.listedBoxPrice ? formData.listedBoxPrice.toLocaleString('vi-VN') : ''}
                onChange={(e) => {
                  const rawValue = e.target.value.replace(/\D/g, '');
                  setFormData({ ...formData, listedBoxPrice: Number(rawValue) });
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Chiết khấu (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={formData.discountPercent || ''}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setFormData({ ...formData, discountPercent: isNaN(val) ? 0 : val });
                }}
                placeholder="VD: 10"
              />
            </div>

            <div className="space-y-2">
              <Label className="font-bold text-amber-700">Giá sau chiết khấu (Tự động tính)</Label>
              <Input
                type="text"
                disabled
                className="bg-amber-50/50 font-bold text-amber-800 border-amber-200"
                value={Math.round((formData.preTaxBoxPrice || 0) * (1 - (formData.discountPercent || 0) / 100)).toLocaleString('vi-VN')}
              />
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Hủy</Button>
            <Button onClick={handleSave}>Lưu thông tin</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Accessory Add/Edit Dialog */}
      <Dialog open={isAccessoryDialogOpen} onOpenChange={setIsAccessoryDialogOpen}>
        <DialogContent className="max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingAccessory ? 'Sửa thông tin phụ kiện' : 'Thêm phụ kiện mới'}</DialogTitle>
            <DialogDescription>
              Nhập đầy đủ thông tin phụ kiện. Giá bán thực tế (sau chiết khấu) sẽ tự động tính toán.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Tên phụ kiện</Label>
              <Input
                className="col-span-3 font-semibold"
                value={accessoryFormData.name}
                onChange={(e) => setAccessoryFormData({ ...accessoryFormData, name: e.target.value })}
                placeholder="Ví dụ: Bản lề, Tay nắm, Pittông..."
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Mã hàng hoá</Label>
              <Input
                className="col-span-3 font-mono font-bold"
                value={accessoryFormData.code}
                onChange={(e) => setAccessoryFormData({ ...accessoryFormData, code: e.target.value })}
                placeholder="Ví dụ: BL-01, TN-03..."
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Phân loại/Quy cách</Label>
              <Input
                className="col-span-3"
                value={accessoryFormData.option}
                onChange={(e) => setAccessoryFormData({ ...accessoryFormData, option: e.target.value })}
                placeholder="Ví dụ: Thẳng, Cong vừa, 14mm..."
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Đơn vị tính</Label>
              <Input
                className="col-span-3"
                value={accessoryFormData.unit}
                onChange={(e) => setAccessoryFormData({ ...accessoryFormData, unit: e.target.value })}
                placeholder="Ví dụ: Cái, Bộ, Cuộn..."
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Giá trước thuế</Label>
              <div className="col-span-3 relative">
                <Input
                  type="text"
                  className="font-mono text-right pr-9 font-bold"
                  value={accessoryFormData.preTaxPrice ? accessoryFormData.preTaxPrice.toLocaleString('vi-VN') : ''}
                  onChange={(e) => setAccessoryFormData({ ...accessoryFormData, preTaxPrice: parsePrice(e.target.value) })}
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">đ</span>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Đơn giá niêm yết</Label>
              <div className="col-span-3 relative">
                <Input
                  type="text"
                  className="font-mono text-right pr-9 font-bold text-green-600"
                  value={accessoryFormData.listedPrice ? accessoryFormData.listedPrice.toLocaleString('vi-VN') : ''}
                  onChange={(e) => setAccessoryFormData({ ...accessoryFormData, listedPrice: parsePrice(e.target.value) })}
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-600 font-semibold">đ</span>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Chiết khấu (%)</Label>
              <div className="col-span-3 relative">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  className="font-mono text-right pr-9 font-semibold text-amber-600"
                  value={accessoryFormData.discountPercent || ''}
                  onChange={(e) => setAccessoryFormData({ ...accessoryFormData, discountPercent: Number(e.target.value) })}
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-amber-600 font-bold">%</span>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-amber-800 font-bold">Giá sau chiết khấu</Label>
              <Input
                type="text"
                disabled
                className="col-span-3 bg-amber-50/50 font-bold text-amber-800 border-amber-200 text-right pr-4"
                value={Math.round((accessoryFormData.preTaxPrice || 0) * (1 - (accessoryFormData.discountPercent || 0) / 100)).toLocaleString('vi-VN')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAccessoryDialogOpen(false)}>Hủy</Button>
            <Button onClick={handleSaveAccessory}>Lưu phụ kiện</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
        <DialogContent className="max-w-[1100px] w-[95vw] max-h-[90vh] flex flex-col p-6 overflow-hidden">
          <DialogHeader className="pb-2 border-b flex-none">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Sparkles className="h-5 w-5 text-primary" /> Nhập nhanh / Hàng loạt vật tư
            </DialogTitle>
            <DialogDescription>
              Hỗ trợ gõ trực tiếp hoặc dán văn bản quét được từ ảnh (OCR). Trình phân tích thông minh sẽ tự động tách dòng và cột.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 space-y-6 pr-1">
            {/* Step 1: Input text area */}
            <div className="space-y-2">
              <h4 className="font-semibold text-sm text-primary flex items-center gap-1.5">
                <span className="bg-primary/10 text-primary w-5 h-5 rounded-full flex items-center justify-center text-xs">1</span>
                Dán dữ liệu thô (từ Excel hoặc OCR chữ trên ảnh)
              </h4>
              <Textarea
                placeholder={`Dán văn bản bảng giá tại đây. Ví dụ:
1  140  1.5  2.5  1425  20  Hộp  28,714  1,435,694  31,011  1,550,550
2  300  1.5  2.4  3024  6   Hộp  75,981  1,094,120  82,059  1,181,650
(Hoặc đổi sang danh mục bằng cách gõ: HẠNG MỤC BÁO GIÁ NHỰA LUXURY)`}
                className="min-h-[120px] font-mono text-xs"
                value={bulkInputText}
                onChange={(e) => setBulkInputText(e.target.value)}
              />
              <div className="flex justify-between items-center gap-4 flex-wrap">
                <p className="text-[11px] text-muted-foreground italic">
                  * Trình phân tích sẽ tự động điền chiều rộng gộp từ dòng trên xuống nếu ô bị khuyết thiếu do gộp ô.
                </p>
                <Button onClick={handleParseText} size="sm" className="gap-1.5 flex-none">
                  <Upload className="h-3.5 w-3.5" /> Phân tích dữ liệu
                </Button>
              </div>
            </div>

            {/* Default values Fill Down */}
            <div className="p-4 rounded-xl border bg-muted/30 space-y-3">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5 font-bold text-slate-800">
                  Bộ lọc thông số mặc định (Áp dụng nhanh cho các ô trống)
                </h4>
                <Button onClick={handleApplyDefaults} variant="outline" size="sm" className="h-7 text-xs border-primary/20 text-primary hover:bg-primary/5">
                  Áp dụng cho ô trống
                </Button>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase">Hạng mục chính</label>
                  <Input 
                    placeholder="Tên loại nhựa..." 
                    className="h-8 text-xs"
                    value={bulkDefaults.category}
                    onChange={(e) => setBulkDefaults({...bulkDefaults, category: e.target.value.toUpperCase()})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase">ĐVT mặc định</label>
                  <Input 
                    placeholder="Hộp..." 
                    className="h-8 text-xs"
                    value={bulkDefaults.unit}
                    onChange={(e) => setBulkDefaults({...bulkDefaults, unit: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase">Rộng mặc định</label>
                  <Input 
                    placeholder="450..." 
                    className="h-8 text-xs"
                    value={bulkDefaults.width}
                    onChange={(e) => setBulkDefaults({...bulkDefaults, width: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase">Dày mặc định (cm)</label>
                  <Input 
                    placeholder="2..." 
                    className="h-8 text-xs"
                    value={bulkDefaults.thickness}
                    onChange={(e) => setBulkDefaults({...bulkDefaults, thickness: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase">Dài mặc định (cm)</label>
                  <Input 
                    placeholder="2.5..." 
                    className="h-8 text-xs"
                    value={bulkDefaults.length}
                    onChange={(e) => setBulkDefaults({...bulkDefaults, length: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase">Số tấm / hộp</label>
                  <Input 
                    placeholder="4..." 
                    className="h-8 text-xs"
                    value={bulkDefaults.itemsPerBox}
                    onChange={(e) => setBulkDefaults({...bulkDefaults, itemsPerBox: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase text-amber-700 font-bold">Chiết khấu (%)</label>
                  <Input 
                    placeholder="10%..." 
                    type="number"
                    min="0"
                    max="100"
                    className="h-8 text-xs font-semibold text-amber-700 bg-amber-50/20 border-amber-200"
                    value={bulkDefaults.discountPercent}
                    onChange={(e) => setBulkDefaults({...bulkDefaults, discountPercent: e.target.value})}
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Preview & direct edit grid */}
            <div className="space-y-2 flex flex-col">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <h4 className="font-semibold text-sm text-primary flex items-center gap-1.5">
                  <span className="bg-primary/10 text-primary w-5 h-5 rounded-full flex items-center justify-center text-xs">2</span>
                  Danh sách hàng chờ & Chỉnh sửa trực tiếp
                </h4>
                <Button onClick={handleAddEmptyRow} variant="outline" size="sm" className="h-8 text-xs">
                  <Plus className="h-3 w-3 mr-1" /> Thêm dòng trống
                </Button>
              </div>

              {bulkItems.length === 0 ? (
                <div className="border border-dashed rounded-xl p-8 text-center text-muted-foreground text-xs bg-muted/10">
                  Chưa có dữ liệu hàng chờ. Hãy dán văn bản và bấm "Phân tích dữ liệu" hoặc bấm "Thêm dòng trống" để tự gõ.
                </div>
              ) : (
                <div className="border rounded-xl bg-card overflow-hidden max-h-[35vh] flex flex-col shadow-sm">
                  <div className="overflow-x-auto overflow-y-auto flex-1">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="text-[10px] text-muted-foreground uppercase bg-muted/60 sticky top-0 z-10 border-b">
                        <tr>
                          <th className="px-2 py-2 font-semibold border-r min-w-[200px]">Hạng mục</th>
                          <th className="px-2 py-2 font-semibold border-r w-24 text-center">Mã hàng</th>
                          <th className="px-2 py-2 font-semibold border-r w-20 text-center">Chiều rộng</th>
                          <th className="px-2 py-2 font-semibold border-r w-20 text-center">Độ dày (cm)</th>
                          <th className="px-2 py-2 font-semibold border-r w-20 text-center">Chiều dài (cm)</th>
                          <th className="px-2 py-2 font-semibold border-r w-20 text-center">Số tấm</th>
                          <th className="px-2 py-2 font-semibold border-r w-20 text-center">ĐVT</th>
                          <th className="px-2 py-2 font-semibold border-r w-28 text-right">Trước thuế (m)</th>
                          <th className="px-2 py-2 font-semibold border-r w-28 text-right">Trước thuế (Hộp)</th>
                          <th className="px-2 py-2 font-semibold border-r w-16 text-center text-amber-700">CK (%)</th>
                          <th className="px-2 py-2 font-semibold border-r w-28 text-right text-amber-800">Giá sau CK</th>
                          <th className="px-2 py-2 font-semibold border-r w-28 text-right">Niêm yết (m)</th>
                          <th className="px-2 py-2 font-semibold border-r w-28 text-right">Niêm yết (Hộp)</th>
                          <th className="px-2 py-2 font-semibold text-center w-12">Xóa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {bulkItems.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                            <td className="p-1 border-r">
                              <input
                                type="text"
                                className="w-full bg-transparent px-1 border-none focus:outline-none focus:ring-1 focus:ring-primary rounded text-left font-medium"
                                value={item.category}
                                onChange={(e) => handleUpdateCell(idx, 'category', e.target.value)}
                              />
                            </td>
                            <td className="p-1 border-r text-center">
                              <input
                                type="text"
                                className="w-full bg-transparent px-1 border-none focus:outline-none focus:ring-1 focus:ring-primary rounded text-center font-bold text-primary"
                                value={item.code}
                                onChange={(e) => handleUpdateCell(idx, 'code', e.target.value)}
                                placeholder="VD: 5525"
                              />
                            </td>
                            <td className="p-1 border-r text-center">
                              <input
                                type="text"
                                className="w-full bg-transparent px-1 border-none focus:outline-none focus:ring-1 focus:ring-primary rounded text-center"
                                value={item.width}
                                onChange={(e) => handleUpdateCell(idx, 'width', e.target.value)}
                                placeholder="VD: 55"
                              />
                            </td>
                            <td className="p-1 border-r text-center">
                              <input
                                type="text"
                                className="w-full bg-transparent px-1 border-none focus:outline-none focus:ring-1 focus:ring-primary rounded text-center"
                                value={item.thickness}
                                onChange={(e) => handleUpdateCell(idx, 'thickness', e.target.value)}
                                placeholder="VD: 2"
                              />
                            </td>
                            <td className="p-1 border-r text-center">
                              <input
                                type="text"
                                className="w-full bg-transparent px-1 border-none focus:outline-none focus:ring-1 focus:ring-primary rounded text-center"
                                value={item.length}
                                onChange={(e) => handleUpdateCell(idx, 'length', e.target.value)}
                                placeholder="VD: 250"
                              />
                            </td>
                            <td className="p-1 border-r text-center">
                              <input
                                type="text"
                                className="w-full bg-transparent px-1 border-none focus:outline-none focus:ring-1 focus:ring-primary rounded text-center"
                                value={item.itemsPerBox}
                                onChange={(e) => handleUpdateCell(idx, 'itemsPerBox', e.target.value)}
                                placeholder="VD: 4"
                              />
                            </td>
                            <td className="p-1 border-r text-center">
                              <input
                                type="text"
                                className="w-full bg-transparent px-1 border-none focus:outline-none focus:ring-1 focus:ring-primary rounded text-center"
                                value={item.unit}
                                onChange={(e) => handleUpdateCell(idx, 'unit', e.target.value)}
                                placeholder="VD: Tấm"
                              />
                            </td>
                            <td className="p-1 border-r text-right">
                              <input
                                type="text"
                                className="w-full bg-transparent px-1 border-none focus:outline-none focus:ring-1 focus:ring-primary rounded text-right font-mono"
                                value={item.preTaxMeterPrice ? item.preTaxMeterPrice.toLocaleString('vi-VN') : ''}
                                onChange={(e) => handleUpdateCellPrice(idx, 'preTaxMeterPrice', e.target.value)}
                                placeholder="0"
                              />
                            </td>
                            <td className="p-1 border-r text-right">
                              <input
                                type="text"
                                className="w-full bg-transparent px-1 border-none focus:outline-none focus:ring-1 focus:ring-primary rounded text-right font-mono font-semibold"
                                value={item.preTaxBoxPrice ? item.preTaxBoxPrice.toLocaleString('vi-VN') : ''}
                                onChange={(e) => handleUpdateCellPrice(idx, 'preTaxBoxPrice', e.target.value)}
                                placeholder="0"
                              />
                            </td>
                            <td className="p-1 border-r text-center w-16">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                className="w-full bg-transparent px-1 border-none focus:outline-none focus:ring-1 focus:ring-primary rounded text-center font-semibold text-amber-600"
                                value={item.discountPercent !== undefined ? item.discountPercent : ''}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  handleUpdateCell(idx, 'discountPercent', isNaN(val) ? 0 : val);
                                }}
                                placeholder="0"
                              />
                            </td>
                            <td className="p-1 border-r text-right w-28 bg-amber-50/10 font-mono font-bold text-amber-700">
                              {Math.round((item.preTaxBoxPrice || 0) * (1 - (item.discountPercent || 0) / 100)).toLocaleString('vi-VN')}
                            </td>
                            <td className="p-1 border-r text-right">
                              <input
                                type="text"
                                className="w-full bg-transparent px-1 border-none focus:outline-none focus:ring-1 focus:ring-primary rounded text-right font-mono"
                                value={item.listedMeterPrice ? item.listedMeterPrice.toLocaleString('vi-VN') : ''}
                                onChange={(e) => handleUpdateCellPrice(idx, 'listedMeterPrice', e.target.value)}
                                placeholder="0"
                              />
                            </td>
                            <td className="p-1 border-r text-right">
                              <input
                                type="text"
                                className="w-full bg-transparent px-1 border-none focus:outline-none focus:ring-1 focus:ring-primary rounded text-right font-mono font-semibold text-green-600"
                                value={item.listedBoxPrice ? item.listedBoxPrice.toLocaleString('vi-VN') : ''}
                                onChange={(e) => handleUpdateCellPrice(idx, 'listedBoxPrice', e.target.value)}
                                placeholder="0"
                              />
                            </td>
                            <td className="p-1 text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                onClick={() => handleRemoveRow(idx)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="pt-4 border-t flex-none">
            <div className="flex w-full items-center justify-between gap-4">
              <p className="text-xs font-semibold text-muted-foreground">
                {bulkItems.length > 0 && `Chuẩn bị lưu: ${bulkItems.length} vật tư`}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsBulkDialogOpen(false)}>
                  Hủy bỏ
                </Button>
                <Button onClick={handleSaveBulk} disabled={bulkItems.length === 0} className="gap-2">
                  <Check className="h-4 w-4" /> Lưu tất cả
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
