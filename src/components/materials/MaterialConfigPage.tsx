import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { MaterialConfig, Task, Quotation } from '@/src/types';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
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
    category: 'HẠNG MỤC BÁO GIÁ NHỰA ECOPLAST'
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
        width: item.width || '',
        thickness: item.thickness || '',
        length: item.length || '',
        itemsPerBox: item.itemsPerBox || '',
        unit: item.unit,
        preTaxMeterPrice: item.preTaxMeterPrice || 0,
        preTaxBoxPrice: item.preTaxBoxPrice || 0,
        listedMeterPrice: item.listedMeterPrice || 0,
        listedBoxPrice: item.listedBoxPrice || 0,
        category: item.category || 'HẠNG MỤC BÁO GIÁ NHỰA ECOPLAST'
      });
    } else {
      setEditingItem(null);
      setFormData({ 
        code: '', width: '', thickness: '', length: '', itemsPerBox: '', unit: 'Hộp', 
        preTaxMeterPrice: 0, preTaxBoxPrice: 0, listedMeterPrice: 0, listedBoxPrice: 0, 
        category: 'HẠNG MỤC BÁO GIÁ NHỰA ECOPLAST' 
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.code || !formData.unit) {
      toast.error('Vui lòng nhập đủ mã hàng và đơn vị tính');
      return;
    }
    const finalPrice = formData.preTaxBoxPrice || 0;

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

  const filteredMaterials = materials.filter(m => 
    m.code.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (m.width || '').toLowerCase().includes(searchTerm.toLowerCase()) || (m.category || '').toLowerCase().includes(searchTerm.toLowerCase())
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

      <Tabs defaultValue="profit" className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full md:w-auto self-start bg-secondary/50 p-1 rounded-xl">
          <TabsTrigger value="profit" className="rounded-lg">Phân tích Lãi Thực</TabsTrigger>
          <TabsTrigger value="config" className="rounded-lg">Cấu hình Giá</TabsTrigger>
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
                    <th className="px-4 py-4 font-semibold w-12 text-center" rowSpan={2}>STT</th>
                    <th className="px-4 py-4 font-semibold text-center border-l" colSpan={3}>TÊN SẢN PHẨM</th>
                    <th className="px-4 py-4 font-semibold text-center border-l" rowSpan={2}>MÃ HÀNG HOÁ</th>
                    <th className="px-4 py-4 font-semibold text-center border-l" rowSpan={2}>SỐ TẤM / 1 HỘP</th>
                    <th className="px-4 py-4 font-semibold text-center border-l" rowSpan={2}>ĐVT</th>
                    <th className="px-4 py-4 font-semibold text-center border-l" colSpan={2}>Đơn giá trước thuế</th>
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
                      <td colSpan={12} className="px-6 py-12 text-center text-muted-foreground">
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
                        </td>
                        <td className="px-4 py-3 text-center font-medium border-l">{item.itemsPerBox || '-'}</td>
                        <td className="px-4 py-3 text-center font-medium border-l">{item.unit || '-'}</td>
                        
                        <td className="px-4 py-3 text-right font-medium border-l">{(item.preTaxMeterPrice || 0).toLocaleString('vi-VN')}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-700 border-l">{(item.preTaxBoxPrice || 0).toLocaleString('vi-VN')}</td>
                        
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

        <TabsContent value="profit" className="flex-1 mt-4 data-[state=active]:block">
          <ProfitAnalysis tasks={tasks} quotations={quotations} />
        </TabsContent>
      </Tabs>

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
