const fs = require('fs');
const file = 'src/components/materials/MaterialConfigPage.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace form data state
content = content.replace(
  /const \[formData, setFormData\] = useState\(\{[\s\S]*?\}\);/,
  `const [formData, setFormData] = useState({
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
  });`
);

// Replace handleOpenDialog
content = content.replace(
  /const handleOpenDialog = \(item\?: MaterialConfig\) => \{[\s\S]*?setIsDialogOpen\(true\);\n  \};/,
  `const handleOpenDialog = (item?: MaterialConfig) => {
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
  };`
);

// Replace handleSave
content = content.replace(
  /const handleSave = async \(\) => \{[\s\S]*?if \(!formData.code \|\| !formData.name \|\| !formData.unit\) \{[\s\S]*?toast.error\('Vui lòng nhập đủ mã, tên và đơn vị tính'\);[\s\S]*?return;[\s\S]*?\}[\s\S]*?const finalPrice = Math.round\(\(formData.unitPrice \|\| 0\) \* \(1 - \(formData.discountPercent \|\| 0\) \/ 100\)\);/,
  `const handleSave = async () => {
    if (!formData.code || !formData.unit) {
      toast.error('Vui lòng nhập đủ mã hàng và đơn vị tính');
      return;
    }
    const finalPrice = formData.preTaxBoxPrice || 0;`
);

// Replace table header
content = content.replace(
  /<thead className="text-xs text-muted-foreground uppercase bg-muted\/50 sticky top-0 z-10">[\s\S]*?<\/thead>/,
  `<thead className="text-xs text-muted-foreground uppercase bg-muted/50 sticky top-0 z-10">
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
                </thead>`
);

// Replace table body row
content = content.replace(
  /<tr key=\{item.id\} className="hover:bg-muted\/30 transition-colors">[\s\S]*?<\/tr>/g,
  `{/* Dynamic render inside map */}`
);
content = content.replace(
  /\{\/\* Dynamic render inside map \*\/\}/, // Only replace the first one which is inside map
  `<tr key={item.id} className="hover:bg-muted/30 transition-colors border-b">
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
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDelete(item.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>`
);
content = content.replace(/\{\/\* Dynamic render inside map \*\/\}/g, ''); // remove others if any

// Replace Dialog Content
content = content.replace(
  /<DialogContent className="sm:max-w-\[425px\]">[\s\S]*?<\/DialogContent>/,
  `<DialogContent className="max-w-[800px] h-[90vh] md:h-auto overflow-y-auto">
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
                  const rawValue = e.target.value.replace(/\\D/g, '');
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
                  const rawValue = e.target.value.replace(/\\D/g, '');
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
                  const rawValue = e.target.value.replace(/\\D/g, '');
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
                  const rawValue = e.target.value.replace(/\\D/g, '');
                  setFormData({ ...formData, listedBoxPrice: Number(rawValue) });
                }}
              />
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Hủy</Button>
            <Button onClick={handleSave}>Lưu thông tin</Button>
          </DialogFooter>
        </DialogContent>`
);

content = content.replace(/colSpan=\{8\}/g, "colSpan={12}");
content = content.replace(/m.name.toLowerCase\(\).includes\(searchTerm.toLowerCase\(\)\)/g, "(m.width || '').toLowerCase().includes(searchTerm.toLowerCase()) || (m.category || '').toLowerCase().includes(searchTerm.toLowerCase())");

fs.writeFileSync(file, content);
console.log('Fixed file.');
