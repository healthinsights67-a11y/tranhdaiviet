import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, ArrowRight, Save, LayoutGrid } from 'lucide-react';
import { extractWardrobe, WardrobeParams, ExtractedMaterial } from '@/src/lib/formulas';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export const MaterialExtractionPage: React.FC = () => {
  const [productType, setProductType] = useState('wardrobe');
  const [params, setParams] = useState<WardrobeParams>({
    width: 1200,
    height: 1900,
    depth: 500,
    doors: 3,
    drawers: 4,
    hasMolding: true,
  });

  const [bom, setBom] = useState<ExtractedMaterial[]>([]);

  const handleCalculate = () => {
    if (productType === 'wardrobe') {
      const result = extractWardrobe(params);
      setBom(result);
      toast.success('Bóc tách thành công!');
    } else {
      toast.info('Loại sản phẩm này đang được phát triển.');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 md:p-6 h-full flex flex-col space-y-6 max-w-[1600px] mx-auto"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
          <LayoutGrid className="h-6 w-6" />
          Bóc Tách Vật Tư
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Nhập kích thước tổng thể để hệ thống tự động bóc tách ra bảng vật tư (BOM).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Input Form */}
        <Card className="lg:col-span-1 border-border shadow-sm">
          <CardHeader className="bg-muted/30 pb-4 border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calculator className="h-5 w-5 text-blue-500" />
              Thông số đầu vào
            </CardTitle>
            <CardDescription>Cấu hình cho sản phẩm cần bóc tách</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Loại sản phẩm</Label>
              <Select value={productType} onValueChange={setProductType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wardrobe">Tủ Quần Áo Cánh Mở</SelectItem>
                  <SelectItem value="kitchen_base" disabled>Tủ Bếp Dưới (Sắp ra mắt)</SelectItem>
                  <SelectItem value="kitchen_wall" disabled>Tủ Bếp Trên (Sắp ra mắt)</SelectItem>
                  <SelectItem value="bed" disabled>Giường Ngủ (Sắp ra mắt)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ngang phủ bì (mm)</Label>
                <Input 
                  type="number" 
                  value={params.width} 
                  onChange={(e) => setParams({...params, width: Number(e.target.value)})}
                />
              </div>
              <div className="space-y-2">
                <Label>Cao phủ bì (mm)</Label>
                <Input 
                  type="number" 
                  value={params.height} 
                  onChange={(e) => setParams({...params, height: Number(e.target.value)})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sâu (mm)</Label>
                <Input 
                  type="number" 
                  value={params.depth} 
                  onChange={(e) => setParams({...params, depth: Number(e.target.value)})}
                />
              </div>
              <div className="space-y-2">
                <Label>Số lượng cánh</Label>
                <Input 
                  type="number" 
                  value={params.doors} 
                  onChange={(e) => setParams({...params, doors: Number(e.target.value)})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Số lượng ngăn kéo</Label>
              <Input 
                type="number" 
                value={params.drawers} 
                onChange={(e) => setParams({...params, drawers: Number(e.target.value)})}
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-xl bg-secondary/20">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold">Tủ có phào đỉnh</Label>
                <p className="text-[10px] text-muted-foreground">Thêm phào nóc tủ 10cm</p>
              </div>
              <input 
                type="checkbox"
                className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                checked={params.hasMolding} 
                onChange={(e) => setParams({...params, hasMolding: e.target.checked})}
              />
            </div>

            <Button onClick={handleCalculate} className="w-full mt-2 font-bold" size="lg">
              <ArrowRight className="h-4 w-4 mr-2" /> Bóc tách ngay
            </Button>
          </CardContent>
        </Card>

        {/* Output BOM Table */}
        <Card className="lg:col-span-2 border-border shadow-sm flex flex-col min-h-[500px]">
          <CardHeader className="bg-muted/30 pb-4 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg text-emerald-600">Bảng Vật Tư (BOM)</CardTitle>
              <CardDescription>Chi tiết vật tư cần sản xuất</CardDescription>
            </div>
            {bom.length > 0 && (
              <Button variant="outline" size="sm" className="gap-2">
                <Save className="h-4 w-4" /> Lưu bảng này
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-auto">
            {bom.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-10 min-h-[300px]">
                <LayoutGrid className="h-12 w-12 opacity-20 mb-3" />
                <p>Nhập thông số và bấm "Bóc tách ngay" để xem kết quả</p>
              </div>
            ) : (
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="text-xs uppercase bg-muted/50 sticky top-0 border-b">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-center border-r" colSpan={3}>Kích thước (mm)</th>
                    <th className="px-4 py-3 font-semibold" rowSpan={2}>Diễn giải</th>
                    <th className="px-4 py-3 font-semibold text-center" rowSpan={2}>ĐVT</th>
                    <th className="px-4 py-3 font-semibold text-center" rowSpan={2}>Số lượng</th>
                  </tr>
                  <tr className="border-b">
                    <th className="px-2 py-2 font-semibold text-center border-r bg-muted/20">Ngang</th>
                    <th className="px-2 py-2 font-semibold text-center border-r bg-muted/20">Cao</th>
                    <th className="px-2 py-2 font-semibold text-center border-r bg-muted/20">Sâu</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {bom.map((item, idx) => (
                    <tr key={idx} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-center border-r">{item.width || ''}</td>
                      <td className="px-4 py-3 text-center border-r font-medium text-slate-700">{item.height || ''}</td>
                      <td className="px-4 py-3 text-center border-r text-muted-foreground">{item.depth || ''}</td>
                      <td className="px-4 py-3 font-medium text-primary">{item.name}</td>
                      <td className="px-4 py-3 text-center">{item.unit}</td>
                      <td className="px-4 py-3 text-center font-bold text-emerald-600">{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
};
