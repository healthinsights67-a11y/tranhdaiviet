import * as React from 'react';
import { Printer, Download, Save, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/src/lib/utils';
import { Customer, Member, MaterialConfig } from '@/src/types';
import { toast } from 'sonner';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';

export interface MaterialItem {
  id: number;
  name: string;
  options?: string[];
  selectedOption?: string;
  unit: string;
  quantity: string;
  type?: string; // For additional info
}

const DEFAULT_MATERIALS: MaterialItem[] = [
  { id: 1, name: 'Alu', options: ['3mm'], selectedOption: '3mm', unit: 'Tấm', quantity: '' },
  { id: 2, name: 'Thanh ngăn kéo', options: ['14mm', '12mm'], unit: 'Thanh', quantity: '' },
  { id: 3, name: 'Thanh treo quần áo', options: ['Nhôm', 'inox'], unit: 'Thanh', quantity: '' },
  { id: 4, name: 'Gác treo', options: ['Nhôm', 'inox'], unit: 'Cái', quantity: '' },
  { id: 5, name: 'Tay nắm', unit: 'Cái', quantity: '' },
  { id: 6, name: 'Ray ngăn kéo', unit: 'Bộ', quantity: '' },
  { id: 7, name: 'Bản lề', options: ['Thẳng'], selectedOption: 'Thẳng', unit: 'Cái', quantity: '' },
  { id: 8, name: 'Bản lề', options: ['Cong vừa'], selectedOption: 'Cong vừa', unit: 'Cái', quantity: '' },
  { id: 9, name: 'Bản lề', options: ['Cong'], selectedOption: 'Cong', unit: 'Cái', quantity: '' },
  { id: 10, name: 'Ray cửa lùa', unit: 'Thanh', quantity: '' },
  { id: 11, name: 'Đèn led', unit: 'Cuộn', quantity: '' },
  { id: 12, name: 'Thanh nhôm đèn led', options: ['V góc', 'Ray âm'], unit: 'Thanh', quantity: '' },
  { id: 13, name: 'Nguồn', unit: 'Cái', quantity: '' },
  { id: 14, name: 'Công tắc', options: ['Vẫy', 'Cơ'], unit: 'Cái', quantity: '' },
  { id: 15, name: 'Pittông', unit: 'Cái', quantity: '' },
  { id: 16, name: 'Kính', unit: 'Tấm', quantity: '' },
  { id: 17, name: 'Gương', unit: 'Tấm', quantity: '' },
  { id: 18, name: 'Đệm', unit: 'Cái', quantity: '' },
  { id: 19, name: 'Nở treo tủ', unit: 'Cái', quantity: '' },
  { id: 20, name: 'Thanh tăng cường', options: ['2cm', '1,5cm'], unit: 'Thanh', quantity: '' },
  // Row 21-40
  { id: 21, name: 'Thanh 7cm', unit: 'Thanh', quantity: '' },
  { id: 22, name: 'Nhựa', unit: 'Tấm', quantity: '' },
  { id: 23, name: 'Nhựa', unit: 'Tấm', quantity: '' },
  { id: 24, name: 'Nhựa', unit: 'Tấm', quantity: '' },
  { id: 25, name: 'Nhựa', unit: 'Tấm', quantity: '' },
  { id: 26, name: 'Nhựa', unit: 'Tấm', quantity: '' },
  { id: 27, name: 'Nhựa', unit: 'Tấm', quantity: '' },
  { id: 28, name: 'Nhựa', unit: 'Tấm', quantity: '' },
  { id: 29, name: 'Nhựa', unit: 'Tấm', quantity: '' },
  { id: 30, name: 'Nhựa', unit: 'Tấm', quantity: '' },
  { id: 31, name: 'Nhựa', unit: 'Tấm', quantity: '' },
  { id: 32, name: 'Nhựa', unit: 'Tấm', quantity: '' },
  { id: 33, name: 'Nẹp', options: ['Bịp đầu', 'Cạnh', 'Vát'], unit: 'cái', quantity: '' },
  { id: 34, name: 'Nẹp', options: ['Bịp đầu', 'Cạnh', 'Vát'], unit: 'cái', quantity: '' },
  { id: 35, name: 'Nẹp', options: ['Bịp đầu', 'Cạnh', 'Vát'], unit: 'cái', quantity: '' },
  { id: 36, name: 'Nẹp', options: ['Bịp đầu', 'Cạnh', 'Vát'], unit: 'cái', quantity: '' },
  { id: 37, name: 'Nẹp', options: ['Bịp đầu', 'Cạnh', 'Vát'], unit: 'cái', quantity: '' },
  { id: 38, name: 'Nẹp', options: ['Bịp đầu', 'Cạnh', 'Vát'], unit: 'cái', quantity: '' },
  { id: 39, name: 'Nẹp', options: ['Bịp đầu', 'Cạnh', 'Vát'], unit: 'cái', quantity: '' },
  { id: 40, name: 'Nẹp', options: ['Bịp đầu', 'Cạnh', 'Vát'], unit: 'cái', quantity: '' },
];

interface MaterialRequisitionFormProps {
  projectTitle: string;
  data?: {
    receiver?: string;
    department?: string;
    customerName?: string;
    address?: string;
    items?: MaterialItem[];
  };
  onSave: (data: any) => void;
  customerInfo?: Customer;
  members?: Member[];
}

export function MaterialRequisitionForm({ projectTitle, data, onSave, customerInfo, members = [] }: MaterialRequisitionFormProps) {
  const [receiver, setReceiver] = React.useState(data?.receiver || '');
  const [department, setDepartment] = React.useState(data?.department || '');
  const [customerName, setCustomerName] = React.useState(data?.customerName || customerInfo?.name || '');
  const [address, setAddress] = React.useState(data?.address || customerInfo?.address || '');
  const [items, setItems] = React.useState<MaterialItem[]>(data?.items || DEFAULT_MATERIALS);
  const [materialConfigs, setMaterialConfigs] = React.useState<MaterialConfig[]>([]);
  const printRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const unsub = onSnapshot(collection(db, 'materialConfigs'), (snap) => {
      setMaterialConfigs(snap.docs.map(d => ({ id: d.id, ...d.data() }) as MaterialConfig));
    });
    return () => unsub();
  }, []);

  const handleUpdateItem = (id: number, field: keyof MaterialItem, value: any) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) {
      toast.error('Trình duyệt đã chặn cửa sổ in. Vui lòng cho phép popup.');
      return;
    }

    win.document.write(`
      <html>
        <head>
          <title>Phiếu lĩnh NVL - ${projectTitle}</title>
          <style>
             @import url('https://fonts.googleapis.com/css2?family=Times+New+Roman&display=swap');
            @media print {
              @page { margin: 8mm; size: landscape; }
              body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
            body { font-family: 'Times New Roman', serif; padding: 0; margin: 0; color: black; box-sizing: border-box; }
            table { width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 11px; }
            th, td { border: 1px solid black; padding: 2px 4px; text-align: left; line-height: 1.1; height: 18px; }
            th { text-align: center; font-weight: bold; background-color: #f8f8f8; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px; }
            .logo { width: 130px; }
            .title { text-align: center; flex: 1; margin-top: -5px; }
            .title h1 { margin: 0 0 5px 0; font-size: 18px; text-decoration: underline; text-transform: uppercase; }
            .title-info { display: flex; flex-direction: column; align-items: flex-start; margin-left: auto; margin-right: auto; width: fit-content; text-align: left; font-size: 13px; line-height: 1.2; }
            .footer { display: flex; justify-content: space-around; margin-top: 10px; font-weight: bold; font-size: 12px; }
            .date { text-align: right; margin-top: 5px; margin-bottom: 5px; font-style: italic; font-size: 11px; }
            .split-container { display: flex; gap: 10px; width: 100%; }
            .split-col { flex: 1; min-width: 0; }
            .checkbox-group { display: flex; gap: 5px; }
            .checkbox { border: 1px solid black; width: 8px; height: 8px; display: inline-block; margin-right: 3px; position: relative; top: 1px; }
            .checkbox.checked { background: black; }
            p { margin: 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">
               <h2 style="color: #e11d48; margin: 0; font-size: 18px;">I<span style="color: #f59e0b;"> NỘI </span>THẤT</h2>
               <p style="font-size: 11px; margin: 0; font-style: italic;">Kiến tạo không gian</p>
            </div>
            <div class="title">
              <h1>PHIẾU LĨNH NVL - CCDC</h1>
              <div class="title-info">
                <p>Công trình: <strong>${projectTitle}</strong></p>
                <p>Họ tên người nhận: <strong>${receiver}</strong></p>
                <p>Bộ phận: <strong>${department}</strong></p>
              </div>
            </div>
          </div>

          <div class="split-container">
            <div class="split-col">
              <table>
                <thead>
                  <tr>
                    <th width="30">TT</th>
                    <th>Tên nguyên liệu, vật liệu</th>
                    <th>Loại, khổ, màu sắc</th>
                    <th width="40">ĐVT</th>
                    <th width="50">SL</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.slice(0, 20).map(item => `
                    <tr>
                      <td align="center">${item.id}</td>
                      <td>${item.name}</td>
                      <td>
                        ${item.options ? item.options.map(opt => `
                          <span style="margin-right: 8px;">
                            ${opt} <div class="checkbox ${item.selectedOption === opt ? 'checked' : ''}"></div>
                          </span>
                        `).join(' ') : ''}
                      </td>
                      <td align="center">${item.unit}</td>
                      <td align="center">${item.quantity || ''}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            <div class="split-col">
              <table>
                <thead>
                  <tr>
                    <th width="30">TT</th>
                    <th>Tên nguyên liệu, vật liệu</th>
                    <th>Loại, khổ, màu sắc</th>
                    <th width="40">ĐVT</th>
                    <th width="50">SL</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.slice(20, 40).map(item => `
                    <tr>
                      <td align="center">${item.id}</td>
                      <td>${item.name}</td>
                      <td>
                        ${item.options ? item.options.map(opt => `
                          <span style="margin-right: 8px;">
                            ${opt} <div class="checkbox ${item.selectedOption === opt ? 'checked' : ''}"></div>
                          </span>
                        `).join(' ') : ''}
                      </td>
                      <td align="center">${item.unit}</td>
                      <td align="center">${item.quantity || ''}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <p class="date">Ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}</p>
          <div class="footer">
            <div>Trưởng bộ phận</div>
            <div>Người nhận</div>
          </div>
        </body>
      </html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <div className="flex flex-col h-full bg-background pb-20">
      <div className="sticky top-0 z-20 bg-card text-card-foreground px-4 py-3 border-b space-y-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-xl shadow-inner shrink-0">
               <Download className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-tight text-foreground/90 leading-tight">Phiếu lĩnh NVL</h3>
              <p className="text-[10px] text-muted-foreground font-medium italic">Quản lý kho</p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={handlePrint} className="h-8 px-2 rounded-lg text-[10px] font-bold border-2">
              <Printer className="h-3 w-3 mr-1" /> In
            </Button>
            <Button size="sm" onClick={() => onSave({ receiver, department, customerName, address, items })} className="h-8 px-3 rounded-lg text-[10px] font-bold shadow-lg shadow-primary/20 bg-primary">
              <Save className="h-3 w-3 mr-1" /> Lưu
            </Button>
          </div>
        </div>

        <datalist id="material-list">
          {materialConfigs.map(m => (
            <option key={m.id} value={`${m.code} - ${m.name}`} />
          ))}
        </datalist>

        <div className="grid grid-cols-1 gap-2">
          <div className="flex gap-2">
            <Input 
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Khách hàng..."
              className="h-9 text-xs bg-secondary/20 border-transparent rounded-lg px-3"
            />
          </div>
          <Input 
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Địa chỉ..."
            className="h-9 text-xs bg-secondary/20 border-transparent rounded-lg px-3"
          />
          <div className="flex gap-2">
            <Select 
              value={receiver}
              onValueChange={setReceiver}
            >
              <SelectTrigger className="flex-1 h-9 text-xs bg-secondary/20 border-transparent rounded-lg px-3">
                <SelectValue placeholder="Chọn người nhận..." />
              </SelectTrigger>
              <SelectContent>
                {members.map(m => (
                  <SelectItem key={m.id} value={m.name}>
                     <div className="flex items-center gap-2">
                       <Avatar className="h-5 w-5">
                         <AvatarImage src={m.avatar} />
                         <AvatarFallback className="text-[8px]">{m.name.charAt(0)}</AvatarFallback>
                       </Avatar>
                       {m.name} <span className="text-[9px] text-muted-foreground">({m.role})</span>
                     </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input 
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="Bộ phận..."
              className="h-9 text-xs bg-secondary/20 border-transparent rounded-lg px-3"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 p-3 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
          <div className="space-y-2">
            {items.slice(0, 20).map((item) => (
              <div key={item.id} className="bg-card p-2.5 rounded-xl border border-secondary/20 shadow-sm flex flex-col gap-1.5 hover:border-primary/30 transition-colors">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-foreground/80">{item.id}. {item.name}</span>
                  <div className="flex items-center gap-1 w-20">                
                    <Input 
                      className="h-7 text-center text-xs font-black bg-secondary/10 hover:bg-secondary/20 focus:bg-primary/5 border-0 rounded-lg transition-colors"
                      value={item.quantity}
                      onChange={(e) => handleUpdateItem(item.id, 'quantity', e.target.value)}
                      placeholder="0"
                    />
                    <span className="text-[10px] text-muted-foreground font-bold w-10 shrink-0">{item.unit}</span>
                  </div>
                </div>
                
                {item.options && (
                  <div className="flex flex-wrap gap-2 pt-1.5 border-t border-secondary/10 mt-0.5">
                      {item.options.map(opt => (
                        <div key={opt} className="flex items-center gap-1.5 bg-secondary/5 px-2 py-0.5 rounded-md hover:bg-secondary/10 transition-colors">
                          <Checkbox 
                            id={`item-${item.id}-${opt}`}
                            checked={item.selectedOption === opt}
                            onCheckedChange={() => handleUpdateItem(item.id, 'selectedOption', opt)}
                            className="h-3.5 w-3.5 rounded border-muted-foreground/50 border-[1.5px] data-[state=checked]:border-primary"
                          />
                          <Label htmlFor={`item-${item.id}-${opt}`} className="text-[10px] cursor-pointer font-medium">{opt}</Label>
                        </div>
                      ))}
                  </div>
                )}
                {!item.options && (
                  <Input 
                    list="material-list"
                    className="h-6 text-[10px] bg-secondary/5 hover:bg-secondary/10 focus:bg-background border-0 rounded-md px-2 mt-0.5 transition-colors"
                    placeholder="Loại/Khổ... (Nhập mã vật tư)"
                    value={item.type || ''}
                    onChange={(e) => handleUpdateItem(item.id, 'type', e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {items.slice(20, 40).map((item) => (
              <div key={item.id} className="bg-card p-2.5 rounded-xl border border-secondary/20 shadow-sm flex flex-col gap-1.5 hover:border-primary/30 transition-colors">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-foreground/80">{item.id}. {item.name}</span>
                  <div className="flex items-center gap-1 w-20">                
                    <Input 
                      className="h-7 text-center text-xs font-black bg-secondary/10 hover:bg-secondary/20 focus:bg-primary/5 border-0 rounded-lg transition-colors"
                      value={item.quantity}
                      onChange={(e) => handleUpdateItem(item.id, 'quantity', e.target.value)}
                      placeholder="0"
                    />
                    <span className="text-[10px] text-muted-foreground font-bold w-10 shrink-0">{item.unit}</span>
                  </div>
                </div>
                
                {item.options && (
                  <div className="flex flex-wrap gap-2 pt-1.5 border-t border-secondary/10 mt-0.5">
                      {item.options.map(opt => (
                        <div key={opt} className="flex items-center gap-1.5 bg-secondary/5 px-2 py-0.5 rounded-md hover:bg-secondary/10 transition-colors">
                          <Checkbox 
                            id={`item-${item.id}-${opt}`}
                            checked={item.selectedOption === opt}
                            onCheckedChange={() => handleUpdateItem(item.id, 'selectedOption', opt)}
                            className="h-3.5 w-3.5 rounded border-muted-foreground/50 border-[1.5px] data-[state=checked]:border-primary"
                          />
                          <Label htmlFor={`item-${item.id}-${opt}`} className="text-[10px] cursor-pointer font-medium">{opt}</Label>
                        </div>
                      ))}
                  </div>
                )}
                {!item.options && (
                  <Input 
                    list="material-list"
                    className="h-6 text-[10px] bg-secondary/5 hover:bg-secondary/10 focus:bg-background border-0 rounded-md px-2 mt-0.5 transition-colors"
                    placeholder="Loại/Khổ... (Nhập mã vật tư)"
                    value={item.type || ''}
                    onChange={(e) => handleUpdateItem(item.id, 'type', e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Sticky Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-2 bg-background border-t shadow-lg flex gap-2">
            <Button variant="outline" className="flex-1 h-10 rounded-xl font-bold" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" /> In phiếu
            </Button>
            <Button className="flex-1 h-10 rounded-xl font-bold bg-primary" onClick={() => onSave({ receiver, department, customerName, address, items })}>
              <Save className="h-4 w-4 mr-2" /> Lưu dữ liệu
            </Button>
      </div>
    </div>
  );
}
