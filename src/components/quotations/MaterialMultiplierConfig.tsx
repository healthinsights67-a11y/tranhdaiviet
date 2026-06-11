import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getMaterialMultipliers, saveMaterialMultipliers, DEFAULT_MATERIAL_MULTIPLIERS } from '@/src/services/materialConfigService';
import { MaterialMultiplier } from '@/src/types';
import { Plus, Trash2, Save, RotateCcw, Settings, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface MaterialMultiplierConfigProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MaterialMultiplierConfig({ isOpen, onClose }: MaterialMultiplierConfigProps) {
  const [items, setItems] = useState<MaterialMultiplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await getMaterialMultipliers();
      setItems(data.length > 0 ? data : DEFAULT_MATERIAL_MULTIPLIERS);
    } catch (error) {
      toast.error('Lỗi khi tải cấu hình giá vật liệu');
      setItems(DEFAULT_MATERIAL_MULTIPLIERS);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveMaterialMultipliers(items);
      toast.success('Đã lưu cấu hình giá vật liệu thành công!');
      onClose();
    } catch (error) {
      toast.error('Có lỗi xảy ra khi lưu cấu hình.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (window.confirm('Bạn có chắc chắn muốn khôi phục về cấu hình mặc định ban đầu? Các thay đổi hiện tại sẽ bị ghi đè.')) {
      setItems([...DEFAULT_MATERIAL_MULTIPLIERS]);
      toast.success('Đã khôi phục cấu hình mặc định (chưa lưu). Vui lòng nhấn Lưu thay đổi.');
    }
  };

  const handleAddItem = () => {
    const maxStt = items.length > 0 ? Math.max(...items.map(i => i.stt || 0)) : 0;
    const newItem: MaterialMultiplier = {
      id: Math.random().toString(36).substr(2, 9),
      stt: maxStt + 1,
      code: '',
      material: '',
      description: '',
      globalBasePrice: undefined,
      percentage: 100
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleChange = (id: string, field: keyof MaterialMultiplier, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[100vw] lg:max-w-5xl h-[100dvh] sm:h-[90vh] sm:max-w-[95vw] !rounded-none sm:!rounded-xl flex flex-col p-0 overflow-hidden bg-card text-card-foreground border-none shadow-2xl">
        <DialogHeader className="px-6 py-4 border-b bg-muted/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black tracking-tight text-foreground">
                Cấu Hình Hệ Số Giá Theo Vật Liệu
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Quản lý phần trăm quy đổi giá so với giá gốc cho từng loại vật liệu
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="w-16 text-center font-bold">STT</TableHead>
                    <TableHead className="w-32 font-bold">Mã vật liệu</TableHead>
                    <TableHead className="w-48 font-bold">Tên vật liệu</TableHead>
                    <TableHead className="font-bold">Nội dung / Mô tả</TableHead>
                    <TableHead className="w-32 font-bold">Giá gốc (VNĐ)</TableHead>
                    <TableHead className="w-24 text-center font-bold">Tỉ lệ (%)</TableHead>
                    <TableHead className="w-16 text-center"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell className="p-2">
                        <Input 
                          type="number" 
                          value={item.stt} 
                          onChange={(e) => handleChange(item.id, 'stt', parseInt(e.target.value) || 0)}
                          className="h-9 text-center font-medium"
                        />
                      </TableCell>
                      <TableCell className="p-2">
                        <Input 
                          value={item.code} 
                          onChange={(e) => handleChange(item.id, 'code', e.target.value)}
                          className="h-9 font-bold text-xs"
                          placeholder="Mã..."
                        />
                      </TableCell>
                      <TableCell className="p-2">
                        <Input 
                          value={item.material} 
                          onChange={(e) => handleChange(item.id, 'material', e.target.value)}
                          className="h-9 font-bold text-primary"
                          placeholder="Tên vật liệu..."
                        />
                      </TableCell>
                      <TableCell className="p-2">
                        <Input 
                          value={item.description} 
                          onChange={(e) => handleChange(item.id, 'description', e.target.value)}
                          className="h-9 text-sm"
                          placeholder="Mô tả thêm..."
                        />
                      </TableCell>
                      <TableCell className="p-2">
                        <Input 
                          type="number" 
                          value={item.globalBasePrice || ''} 
                          onChange={(e) => handleChange(item.id, 'globalBasePrice', parseFloat(e.target.value) || undefined)}
                          className="h-9 font-mono text-xs text-right pr-3"
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell className="p-2">
                        <div className="relative">
                          <Input 
                            type="number" 
                            value={item.percentage} 
                            onChange={(e) => handleChange(item.id, 'percentage', parseFloat(e.target.value) || 0)}
                            className="h-9 pr-6 text-right font-black text-emerald-600"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">%</span>
                        </div>
                      </TableCell>
                      <TableCell className="p-2 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveItem(item.id)}
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Chưa có dữ liệu. Vui lòng thêm vật liệu hoặc khôi phục mặc định.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <div className="p-4 border-t bg-slate-50 flex justify-center">
                <Button 
                  onClick={handleAddItem} 
                  variant="outline" 
                  className="border-dashed border-2 border-primary/30 text-primary font-bold hover:bg-primary/5 w-full max-w-sm"
                >
                  <Plus className="w-4 h-4 mr-2" /> Thêm dòng mới
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-background shrink-0 flex items-center justify-between">
          <Button variant="outline" onClick={handleReset} className="text-muted-foreground" disabled={isLoading || isSaving}>
            <RotateCcw className="w-4 h-4 mr-2" /> Khôi phục mặc định
          </Button>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onClose} disabled={isSaving}>Hủy bỏ</Button>
            <Button onClick={handleSave} disabled={isLoading || isSaving} className="font-bold px-6 shadow-md">
              {isSaving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang lưu...</>
              ) : (
                <><Save className="w-4 h-4 mr-2" /> Lưu thay đổi</>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
