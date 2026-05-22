import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { MaterialConfig, Task, Quotation } from '@/src/types';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
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

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    unit: '',
    unitPrice: 0,
    discountPercent: 0,
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

  const handleOpenDialog = (item?: MaterialConfig) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        code: item.code,
        name: item.name,
        unit: item.unit,
        unitPrice: item.unitPrice,
        discountPercent: item.discountPercent,
      });
    } else {
      setEditingItem(null);
      setFormData({ code: '', name: '', unit: '', unitPrice: 0, discountPercent: 0 });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.code || !formData.name || !formData.unit) {
      toast.error('Vui lòng nhập đủ mã, tên và đơn vị tính');
      return;
    }

    const finalPrice = Math.round(formData.unitPrice * (1 - formData.discountPercent / 100));

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
    } catch (error) {
      handleFirestoreError(error as Error, editingItem ? OperationType.UPDATE : OperationType.CREATE, 'Lưu vật tư');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa vật tư này?')) return;
    try {
      await deleteDoc(doc(db, 'materialConfigs', id));
      toast.success('Xóa vật tư thành công');
    } catch (error) {
      handleFirestoreError(error as Error, OperationType.DELETE, 'Xóa vật tư');
    }
  };

  const filteredMaterials = materials.filter(m => 
    m.code.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 h-full flex flex-col space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quản lý Vật tư & Lợi nhuận</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Cấu hình giá thành nguyên vật liệu và phân tích lãi thực tế của các đơn hàng.
          </p>
        </div>
      </div>

      <Tabs defaultValue="config" className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full md:w-auto self-start bg-secondary/50 p-1 rounded-xl">
          <TabsTrigger value="config" className="rounded-lg">Cấu hình Giá</TabsTrigger>
          <TabsTrigger value="profit" className="rounded-lg">Phân tích Lãi Thực</TabsTrigger>
        </TabsList>
        
        <TabsContent value="config" className="flex-1 flex flex-col mt-4 min-h-0 data-[state=active]:flex space-y-4">
          <div className="flex items-center justify-between gap-4 bg-card p-4 rounded-xl border shadow-sm flex-wrap">
            <div className="relative flex-1 min-w-[250px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Tìm kiếm theo mã hoặc tên vật tư..." 
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm font-medium text-muted-foreground hidden sm:block">
                Tổng số: <span className="text-foreground">{filteredMaterials.length}</span> vật tư
              </div>
              <Button onClick={() => handleOpenDialog()} className="gap-2">
                <Plus className="h-4 w-4" /> Thêm vật tư
              </Button>
            </div>
          </div>

          <div className="border rounded-xl bg-card flex-1 overflow-hidden flex flex-col shadow-sm">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 font-semibold w-16 text-center">STT</th>
                    <th className="px-6 py-4 font-semibold">Mã hàng</th>
                    <th className="px-6 py-4 font-semibold">Tên quy cách</th>
                    <th className="px-6 py-4 font-semibold text-center">ĐVT</th>
                    <th className="px-6 py-4 font-semibold text-right">Đơn giá</th>
                    <th className="px-6 py-4 font-semibold text-center">% CK</th>
                    <th className="px-6 py-4 font-semibold text-right">Thành tiền</th>
                    <th className="px-6 py-4 font-semibold text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredMaterials.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                        Không tìm thấy vật tư nào
                      </td>
                    </tr>
                  ) : (
                    filteredMaterials.map((item, index) => (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-3 text-center font-medium text-muted-foreground">{index + 1}</td>
                        <td className="px-6 py-3 font-semibold">
                          <span className="bg-primary/10 text-primary px-2 py-1 rounded-md text-xs font-mono">
                            {item.code}
                          </span>
                        </td>
                        <td className="px-6 py-3">{item.name}</td>
                        <td className="px-6 py-3 text-center font-medium">{item.unit}</td>
                        <td className="px-6 py-3 text-right font-medium">{item.unitPrice.toLocaleString('vi-VN')}</td>
                        <td className="px-6 py-3 text-center">
                          <span className="inline-flex items-center justify-center bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-0.5 rounded-full text-xs font-bold">
                            {item.discountPercent}%
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right font-bold text-green-600 dark:text-green-400">
                          {item.finalPrice.toLocaleString('vi-VN')}
                        </td>
                        <td className="px-6 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500" onClick={() => handleOpenDialog(item)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDelete(item.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
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
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Sửa thông tin vật tư' : 'Thêm vật tư mới'}</DialogTitle>
            <DialogDescription>Nhập thông tin giá và chiết khấu cho vật tư.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Mã hàng</Label>
              <Input
                className="col-span-3"
                placeholder="VD: AT"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Tên quy cách</Label>
              <Input
                className="col-span-3"
                placeholder="VD: Alu tấm 3mm"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">ĐVT</Label>
              <Input
                className="col-span-3"
                placeholder="VD: Tấm, Thanh, Cái"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Đơn giá</Label>
              <Input
                type="number"
                className="col-span-3"
                value={formData.unitPrice || ''}
                onChange={(e) => setFormData({ ...formData, unitPrice: Number(e.target.value) })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Phần trăm CK</Label>
              <Input
                type="number"
                className="col-span-3"
                value={formData.discountPercent || ''}
                onChange={(e) => setFormData({ ...formData, discountPercent: Number(e.target.value) })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Hủy</Button>
            <Button onClick={handleSave}>Lưu thông tin</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
