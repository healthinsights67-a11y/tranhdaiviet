import * as React from 'react';
import { STANDARD_PRICES, PriceItem } from '@/src/constants/priceList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Image as ImageIcon, Sparkles, Tag, Calculator } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/src/lib/utils';

export interface SelectedPaintingItem {
  id: string;
  name: string;
  category: string;
  dimensions: string;
  quantity: number;
  unitPrice: number;
  total: number;
  description?: string;
}

interface PaintingQuickSelectorProps {
  items: SelectedPaintingItem[];
  onChange: (items: SelectedPaintingItem[], total: number, summaryText: string) => void;
  className?: string;
}

// Helper to extract dimensions from painting name (e.g. 40x50cm, 50x70cm)
const extractDimensions = (name: string): string => {
  const match = name.match(/(\d+\s*x\s*\d+\s*(?:cm)?)/i);
  return match ? match[1].replace(/\s+/g, '') : '';
};

export const summarizePaintings = (items: SelectedPaintingItem[]): string => {
  if (!items || items.length === 0) return '';
  return items.map(p => {
    const nameClean = (p.name || '').trim();
    const dimClean = (p.dimensions || '').replace(/\s+/g, '');
    const nameNoSpace = nameClean.replace(/\s+/g, '');
    const alreadyHasDim = dimClean && nameNoSpace.toLowerCase().includes(dimClean.toLowerCase());
    const dimText = (p.dimensions && !alreadyHasDim) ? ` ${p.dimensions}` : '';
    return `${nameClean}${dimText} (x${p.quantity})`;
  }).join(', ');
};

export function PaintingQuickSelector({ items, onChange, className }: PaintingQuickSelectorProps) {
  const [selectedCategory, setSelectedCategory] = React.useState<string>('Tranh gạo rang');

  // Filter presets by category
  const filteredPresets = React.useMemo(() => {
    return STANDARD_PRICES.filter(p => p.category === selectedCategory);
  }, [selectedCategory]);

  const categories = React.useMemo<string[]>(() => {
    return Array.from(new Set(STANDARD_PRICES.map(p => p.category))) as string[];
  }, []);

  const updateItems = (newItems: SelectedPaintingItem[]) => {
    const total = newItems.reduce((sum, item) => sum + (item.total || 0), 0);
    const summary = summarizePaintings(newItems);
    onChange(newItems, total, summary);
  };

  const handleAddPreset = (presetName: string) => {
    if (!presetName) return;
    const found = STANDARD_PRICES.find(p => p.name === presetName);
    if (!found) return;

    const existingIndex = items.findIndex(i => i.name === found.name);
    if (existingIndex >= 0) {
      // Tăng số lượng nếu đã có
      const updated = [...items];
      const current = updated[existingIndex];
      const newQty = current.quantity + 1;
      updated[existingIndex] = {
        ...current,
        quantity: newQty,
        total: newQty * current.unitPrice
      };
      updateItems(updated);
    } else {
      const newItem: SelectedPaintingItem = {
        id: Math.random().toString(36).substr(2, 9),
        name: found.name,
        category: found.category,
        dimensions: extractDimensions(found.name),
        quantity: 1,
        unitPrice: found.price,
        total: found.price,
        description: found.description || ''
      };
      updateItems([...items, newItem]);
    }
  };

  const handleAddCustomItem = () => {
    const newItem: SelectedPaintingItem = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'Tranh gạo đặt theo yêu cầu',
      category: 'Tranh theo yêu cầu',
      dimensions: '40x50cm',
      quantity: 1,
      unitPrice: 940000,
      total: 940000,
      description: 'Làm theo market logo / phong cảnh riêng'
    };
    updateItems([...items, newItem]);
  };

  const handleUpdateItem = (index: number, field: keyof SelectedPaintingItem, value: any) => {
    const updated = [...items];
    const current = { ...updated[index], [field]: value };

    if (field === 'quantity' || field === 'unitPrice') {
      const q = field === 'quantity' ? Number(value) || 0 : current.quantity;
      const p = field === 'unitPrice' ? Number(value) || 0 : current.unitPrice;
      current.total = q * p;
    }

    updated[index] = current;
    updateItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    updateItems(updated);
  };

  const grandTotal = React.useMemo(() => {
    return items.reduce((sum, item) => sum + (item.total || 0), 0);
  }, [items]);

  return (
    <div className={cn("rounded-2xl border border-rose-200/80 bg-rose-50/30 p-3 space-y-2.5", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rose-200/60 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/10 text-primary rounded-lg shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-foreground flex items-center gap-1.5">
              Chọn tranh đặt hàng & Báo giá nhanh
              {items.length > 0 && (
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-[10px] h-5 px-1.5">
                  {items.length} tác phẩm
                </Badge>
              )}
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Chọn mẫu tranh có sẵn hoặc tự nhập để hệ thống tự động tạo luôn bản Báo Giá.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddCustomItem}
            className="h-8 text-xs font-bold border-rose-200 text-primary bg-white hover:bg-rose-50"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            + Bức tranh khác
          </Button>
        </div>
      </div>

      {/* Select Preset Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-white/80 p-2.5 rounded-xl border border-rose-100 shadow-2xs">
        <div className="sm:col-span-5">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Dòng tranh</Label>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="h-9 rounded-lg text-xs font-semibold bg-white mt-1 border-rose-100">
              <SelectValue placeholder="Chọn dòng tranh" />
            </SelectTrigger>
            <SelectContent>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="sm:col-span-7">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Chọn quy cách & Thêm nhanh</Label>
          <Select onValueChange={(val: string) => { handleAddPreset(val); }}>
            <SelectTrigger className="h-9 rounded-lg text-xs font-semibold bg-white mt-1 border-rose-100">
              <SelectValue placeholder="Bấm để chọn kích thước & thêm vào đơn..." />
            </SelectTrigger>
            <SelectContent className="max-h-[280px]">
              {filteredPresets.map(preset => (
                <SelectItem key={preset.name} value={preset.name} className="text-xs">
                  <div className="flex items-center justify-between w-full gap-4">
                    <span className="font-medium">{preset.name}</span>
                    <span className="font-bold text-primary font-mono shrink-0">
                      {new Intl.NumberFormat('vi-VN').format(preset.price)} đ
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Items List */}
      {items.length === 0 ? (
        <div className="text-center py-3.5 border border-dashed border-rose-200/80 rounded-xl bg-white/60">
          <ImageIcon className="h-8 w-8 text-rose-300 mx-auto mb-1.5" />
          <p className="text-xs font-bold text-foreground/80">Chưa chọn bức tranh nào cho đơn hàng này</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Hãy chọn một mẫu tranh từ menu phía trên hoặc bấm "+ Bức tranh khác" để nhập nhanh báo giá.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {items.map((item, index) => (
              <div 
                key={item.id || index}
                className="bg-white p-3 rounded-xl border border-rose-100/90 shadow-2xs hover:border-rose-200 transition-all flex flex-col sm:flex-row items-start sm:items-center gap-2.5"
              >
                <div className="flex-1 min-w-0 w-full sm:w-auto">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-black text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded">#{index + 1}</span>
                    <Input
                      value={item.name}
                      onChange={(e) => handleUpdateItem(index, 'name', e.target.value)}
                      placeholder="Tên tranh..."
                      className="h-8 text-xs font-bold border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary p-1"
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      value={item.description || ''}
                      onChange={(e) => handleUpdateItem(index, 'description', e.target.value)}
                      placeholder="Ghi chú (khung gỗ, lời đề tặng, maket...)"
                      className="h-7 text-[11px] text-muted-foreground border-slate-100 bg-slate-50/50 rounded-md px-2"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <div className="flex items-center gap-1">
                    <Label className="text-[10px] text-muted-foreground font-medium sm:hidden">SL:</Label>
                    <Input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => handleUpdateItem(index, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                      className="h-8 w-16 text-center text-xs font-bold font-mono rounded-lg border-rose-100"
                      title="Số lượng"
                    />
                    <span className="text-[10px] text-muted-foreground">bức</span>
                  </div>

                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground sm:hidden">Đơn giá:</span>
                      <Input
                        type="text"
                        value={new Intl.NumberFormat('vi-VN').format(item.unitPrice)}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          handleUpdateItem(index, 'unitPrice', val === '' ? 0 : parseInt(val, 10));
                        }}
                        className="h-8 w-28 text-right text-xs font-bold font-mono rounded-lg border-rose-100"
                        title="Đơn giá"
                      />
                      <span className="text-[10px] text-muted-foreground">đ</span>
                    </div>
                  </div>

                  <div className="w-24 text-right">
                    <span className="text-xs font-black text-primary font-mono block">
                      {new Intl.NumberFormat('vi-VN').format(item.total)} đ
                    </span>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveItem(index)}
                    className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0"
                    title="Xóa tranh này"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Grand Total Bar */}
          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-rose-100/60 to-primary/10 rounded-xl border border-rose-200">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary" />
              <span className="text-xs font-black uppercase text-foreground/90">Tổng tiền báo giá:</span>
            </div>
            <div className="text-right">
              <span className="text-lg font-black text-primary font-mono tracking-tight">
                {new Intl.NumberFormat('vi-VN').format(grandTotal)} đ
              </span>
              <p className="text-[10px] text-muted-foreground">Tự động đồng bộ vào trường Giá trị đơn hàng & Báo giá</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
