import * as React from 'react';
import { Save, Printer, CheckCircle2, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { auth } from '@/src/lib/firebase';
import { Customer } from '@/src/types';

export interface ProductionChecklistItem {
  id: string;
  department: string;
  stt: number;
  description: string;
  roles?: string[];
  confirmedBy?: string;
  timestamp?: string;
  notes?: string;
  confirmedRole?: string;
}

const ROLES = [
  { id: 'KT', label: 'Kế Toán' },
  { id: 'SX', label: 'Nhóm SX' },
  { id: 'LD', label: 'Đội Lắp Đặt' },
];

const DEFAULT_ITEMS: ProductionChecklistItem[] = [
  // Kế Toán
  { id: 'kt-1', department: 'Kế Toán', stt: 1, description: 'Nhập vật tư', roles: ['KT'] },
  { id: 'kt-2', department: 'Kế Toán', stt: 2, description: 'Xuất vật tư khung cánh (Lần 1)', roles: ['KT'] },
  { id: 'kt-3', department: 'Kế Toán', stt: 3, description: 'Xuất vật tư: bản lề, ray, tay nắm (Lần 2)', roles: ['KT'] },
  { id: 'kt-4', department: 'Kế Toán', stt: 4, description: 'Phiếu xuất kho', roles: ['KT'] },
  { id: 'kt-5', department: 'Kế Toán', stt: 5, description: 'Hóa đơn bán hàng', roles: ['KT'] },
  { id: 'kt-1', department: 'Kế Toán', stt: 3, description: 'Nhập vật tư', roles: ['KT'] },
  { id: 'kt-2', department: 'Kế Toán', stt: 4, description: 'Xuất vật tư khung cánh (Lần 1)', roles: ['KT'] },
  { id: 'kt-3', department: 'Kế Toán', stt: 5, description: 'Xuất vật tư: bản lề, ray, tay nắm (Lần 2)', roles: ['KT'] },
  { id: 'kt-4', department: 'Kế Toán', stt: 6, description: 'Phiếu xuất kho', roles: ['KT'] },
  { id: 'kt-5', department: 'Kế Toán', stt: 7, description: 'Hóa đơn bán hàng', roles: ['KT'] },
  
  // Nhóm SX
  { id: 'sx-1', department: 'Nhóm SX', stt: 1, description: 'Ký nhận đủ Hồ sơ & Vật tư (Đã kiểm đếm)', roles: ['SX'] },
  { id: 'sx-2', department: 'Nhóm SX', stt: 2, description: 'Cắt khung', roles: ['SX'] },
  { id: 'sx-3', department: 'Nhóm SX', stt: 3, description: 'Cắt cánh', roles: ['SX'] },
  { id: 'sx-4', department: 'Nhóm SX', stt: 4, description: 'Khoan Bản lề Cánh', roles: ['SX'] },
  { id: 'sx-5', department: 'Nhóm SX', stt: 5, description: 'Dán nẹp cạnh', roles: ['SX'] },
  { id: 'sx-6', department: 'Nhóm SX', stt: 6, description: 'Bắn Mộng/ Chốt cam', roles: ['SX'] },
  { id: 'sx-7', department: 'Nhóm SX', stt: 7, description: 'Ráp Khung', roles: ['SX'] },
  { id: 'sx-8', department: 'Nhóm SX', stt: 8, description: 'Ngăn kéo', roles: ['SX'] },
  { id: 'sx-9', department: 'Nhóm SX', stt: 9, description: 'Alu', roles: ['SX'] },
  { id: 'sx-10', department: 'Nhóm SX', stt: 10, description: 'Tay Nắm / Thanh Treo', roles: ['SX'] },
  { id: 'sx-11', department: 'Nhóm SX', stt: 11, description: 'Vệ Sinh Tẩy Keo', roles: ['SX'] },
  { id: 'sx-12', department: 'Nhóm SX', stt: 12, description: 'Quấn Màng bảo Vệ', roles: ['SX'] },
  { id: 'sx-13', department: 'Nhóm SX', stt: 13, description: 'Ghi nhận vật tư phát sinh', roles: ['SX'] },
  
  // Đội Lắp Đặt
  { id: 'ld-1', department: 'Đội Lắp Đặt', stt: 1, description: 'Chuẩn bị đồ nghề', roles: ['LD'] },
  { id: 'ld-2', department: 'Đội Lắp Đặt', stt: 2, description: 'Kiểm tra hàng đủ bộ trước khi bốc xe vận chuyển', roles: ['LD'] },
  { id: 'ld-3', department: 'Đội Lắp Đặt', stt: 3, description: 'Dò điện/nước trước khi khoan tường', roles: ['LD'] },
  { id: 'ld-4', department: 'Đội Lắp Đặt', stt: 4, description: 'Lót sàn bảo vệ nhà khách trước khi thi công', roles: ['LD'] },
  { id: 'ld-5', department: 'Đội Lắp Đặt', stt: 5, description: 'Cân chỉnh cánh, ngăn kéo & Đi keo hoàn thiện', roles: ['LD'] },
  { id: 'ld-6', department: 'Đội Lắp Đặt', stt: 6, description: 'Vệ sinh sạch sẽ sản phẩm & mặt bằng bàn giao', roles: ['LD'] },
  { id: 'ld-7', department: 'Đội Lắp Đặt', stt: 7, description: 'Chụp ảnh & Quay video', roles: ['LD'] },
  
  // Nghiệm thu
  { id: 'nt-1', department: 'Nghiệm thu', stt: 1, description: 'KHÁCH HÀNG KÝ BIÊN BẢN NGHIỆM THU', roles: ['LD'] },
  { id: 'nt-2', department: 'Nghiệm thu', stt: 2, description: 'Xác nhận sản phẩm đúng bản vẽ thiết kế & tiêu chuẩn', roles: ['LD', 'KT'] },
  { id: 'nt-4', department: 'Nghiệm thu', stt: 3, description: 'Đối soát hồ sơ đủ chữ ký & ĐÓNG DỰ ÁN', roles: ['KT'] },
];

const DEPARTMENT_CONFIG: Record<string, { color: string; bg: string; border: string; lightBg: string }> = {
  'Kinh Doanh': { color: 'text-blue-600', bg: 'bg-blue-600', border: 'border-blue-200', lightBg: 'bg-blue-50/50' },
  'Thiết Kế': { color: 'text-emerald-600', bg: 'bg-emerald-600', border: 'border-emerald-200', lightBg: 'bg-emerald-50/50' },
  'Quản Lý': { color: 'text-orange-600', bg: 'bg-orange-600', border: 'border-orange-200', lightBg: 'bg-orange-50/50' },
  'Kế Toán': { color: 'text-purple-600', bg: 'bg-purple-600', border: 'border-purple-200', lightBg: 'bg-purple-50/50' },
  'Nhóm SX': { color: 'text-amber-600', bg: 'bg-amber-600', border: 'border-amber-200', lightBg: 'bg-amber-50/50' },
  'Đội Lắp Đặt': { color: 'text-sky-600', bg: 'bg-sky-600', border: 'border-sky-200', lightBg: 'bg-sky-50/50' },
  'Nghiệm thu': { color: 'text-rose-600', bg: 'bg-rose-600', border: 'border-rose-200', lightBg: 'bg-rose-50/50' },
};

interface ProductionChecklistFormProps {
  taskTitle: string;
  data?: any;
  onSave: (data: any) => void;
  customerInfo?: Customer;
}

export function ProductionChecklistForm({ taskTitle, data, onSave, customerInfo }: ProductionChecklistFormProps) {
  const filteredDefaultItems = React.useMemo(() => {
    return DEFAULT_ITEMS;
  }, []);

  const [formData, setFormData] = React.useState({
    customerName: data?.customerName || customerInfo?.name || '',
    customerId: data?.customerId || customerInfo?.code || '',
    address: data?.address || customerInfo?.address || '',
    productionLead: data?.productionLead || '',
    projectName: data?.projectName || taskTitle || '',
    colorCode: data?.colorCode || '',
    productionDate: data?.productionDate || '',
    installationDate: data?.installationDate || '',
    items: data?.items 
      ? data.items.filter((i: any) => !['Kinh Doanh', 'Thiết Kế', 'Quản Lý'].includes(i.department))
      : filteredDefaultItems
  });

  const handleUpdateItem = (id: string, updates: Partial<ProductionChecklistItem>) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item: any) => item.id === id ? { ...item, ...updates } : item)
    }));
  };

  const handleConfirmRow = (item: ProductionChecklistItem, roleId: string) => {
    const user = auth.currentUser;
    const userName = user?.displayName || user?.email?.split('@')[0] || 'Unknown User';
    const now = new Date();
    const timestampStr = now.toLocaleDateString('vi-VN') + ' ' + now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    if (item.confirmedRole === roleId) {
      // Toggle off
      handleUpdateItem(item.id, { 
        confirmedBy: '', 
        timestamp: '', 
        confirmedRole: undefined 
      });
      toast.info('Đã gỡ xác nhận');
    } else {
      // Toggle on
      handleUpdateItem(item.id, { 
        confirmedBy: userName, 
        timestamp: timestampStr, 
        confirmedRole: roleId 
      });
      toast.success(`Đã xác nhận bởi ${userName} (${roleId})`);
    }
  };

  const groupedItems = React.useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    formData.items.forEach((item: any) => {
      if (!groups[item.department]) groups[item.department] = [];
      groups[item.department].push(item);
    });
    console.log('DEBUG: groupedItems', groups);
    return groups;
  }, [formData.items]);

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) {
      toast.error('Trình duyệt đã chặn cửa sổ in. Vui lòng cho phép popup.');
      return;
    }
    
    let rowsHtml = '';
    
    Object.entries(groupedItems).forEach(([dept, deptItems]) => {
      rowsHtml += `
        <tr style="background-color: #f8f9fa;">
          <td colspan="6" style="font-weight: bold; font-size: 14px; text-transform: uppercase;">📌 ${dept}</td>
        </tr>
      `;
      deptItems.forEach((item: any) => {
        rowsHtml += `
          <tr>
            <td style="text-align: center;">${item.stt}</td>
            <td>${item.description}</td>
            <td style="text-align: center; font-weight: bold;">${item.roles?.join(', ') || ''}</td>
            <td style="text-align: center; color: ${item.confirmedBy ? 'green' : '#666'};">${item.confirmedBy ? 'DONE' : 'Chờ'}</td>
            <td style="text-align: center;">${item.confirmedBy || ''}</td>
            <td>${item.notes || ''}</td>
          </tr>
        `;
      });
    });

    const html = `
      <html>
        <head>
          <title>Bản Tiến Độ - ${formData.projectName || formData.customerName}</title>
          <style>
            @media print {
              @page { margin: 10mm; size: landscape; }
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
            body { font-family: Arial, sans-serif; padding: 20px; font-size: 13px; color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px 10px; }
            th { background-color: #f0f0f0; font-weight: bold; text-align: center; font-size: 12px; text-transform: uppercase; }
            .header { text-align: center; margin-bottom: 25px; }
            h2 { margin: 0 0 10px 0; font-size: 24px; text-transform: uppercase; color: #111; }
            .info { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; background: #f9fafb; padding: 15px; border-radius: 8px; border: 1px solid #eee; }
            .info-item { font-size: 14px; }
          </style>
        </head>
        <body onload="setTimeout(() => window.print(), 500);">
          <div class="header">
            <h2>BẢN TIẾN ĐỘ THI CÔNG - QUY TRÌNH CHUẨN HÓA</h2>
          </div>
          <div class="info">
            <div class="info-item"><strong>Khách hàng:</strong> ${formData.customerName || '...'}</div>
            <div class="info-item"><strong>Công trình:</strong> ${formData.projectName || '...'}</div>
            <div class="info-item"><strong>Mã KH:</strong> ${formData.customerId || '...'}</div>
            <div class="info-item"><strong>Mã màu:</strong> ${formData.colorCode || '...'}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 50px;">STT</th>
                <th>Nội dung công việc</th>
                <th style="width: 100px;">Phụ Trách</th>
                <th style="width: 80px;">Trạng thái</th>
                <th style="width: 160px;">Người xác nhận</th>
                <th style="width: 250px;">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </body>
      </html>
    `;
    
    win.document.write(html);
    win.document.close();
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="z-20 bg-card text-card-foreground px-4 py-3 border-b space-y-3 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-2xl shadow-inner text-primary shrink-0">
               <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-lg font-black uppercase tracking-tight text-foreground leading-tight">Bản tiến độ</h3>
              <p className="text-[9px] text-muted-foreground font-medium italic">Quy trình chuẩn hóa</p>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={handlePrint} className="flex-1 h-8 px-4 rounded-xl text-[10px] font-bold border-2">
              <Printer className="h-3 w-3 mr-1.5" /> In (A4)
            </Button>
            <Button onClick={() => onSave(formData)} className="flex-1 h-8 px-6 rounded-xl text-[10px] font-bold bg-primary text-primary-foreground">
              <Save className="h-3 w-3 mr-1.5" /> Lưu
            </Button>
          </div>
        </div>
        
        {/* Compact Form Grid */}
        <div className="grid grid-cols-2 gap-2">
          <Input value={formData.customerName} onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))} placeholder="Khách hàng..." className="h-8 text-[11px] bg-secondary/5 rounded-lg px-2" />
          <Input value={formData.projectName} onChange={(e) => setFormData(prev => ({ ...prev, projectName: e.target.value }))} placeholder="Công trình..." className="h-8 text-[11px] bg-secondary/5 rounded-lg px-2" />
          <Input value={formData.customerId} onChange={(e) => setFormData(prev => ({ ...prev, customerId: e.target.value }))} placeholder="Mã KH..." className="h-8 text-[11px] bg-secondary/5 rounded-lg px-2" />
          <Input value={formData.colorCode} onChange={(e) => setFormData(prev => ({ ...prev, colorCode: e.target.value }))} placeholder="Mã màu..." className="h-8 text-[11px] bg-secondary/5 rounded-lg px-2" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 sm:p-4">
         {/* Table for Desktop */}
         <div className="hidden md:block min-w-[1600px] border-2 border-secondary/20 rounded-2xl overflow-hidden bg-background shadow-xl">
            <table className="w-full border-collapse">
              <thead className="bg-secondary/10 border-b-2">
                 <tr className="bg-secondary/5">
                    <th rowSpan={2} className="w-[100px] px-2 py-3 text-center text-[10px] font-black uppercase text-muted-foreground border-r tracking-wider">Bộ Phận</th>
                    <th rowSpan={2} className="w-[45px] px-2 py-3 text-center text-[10px] font-black uppercase text-muted-foreground border-r tracking-wider">STT</th>
                    <th rowSpan={2} className="w-[280px] px-5 py-3 text-left text-[10px] font-black uppercase text-muted-foreground border-r tracking-wider">Nội dung chi tiết</th>
                    <th colSpan={6} className="px-2 py-1.5 text-center text-[10px] font-black uppercase text-secondary border-r tracking-wider bg-secondary/10">Trách nhiệm Phụ Trách (Click để xác nhận)</th>
                    <th rowSpan={2} className="w-[150px] px-2 py-3 text-center text-[10px] font-black uppercase text-muted-foreground border-r tracking-wider">Người xác nhận</th>
                    <th rowSpan={2} className="w-[160px] px-2 py-3 text-center text-[10px] font-black uppercase text-muted-foreground border-r tracking-wider">Ngày-Giờ</th>
                    <th rowSpan={2} className="min-w-[200px] px-4 py-3 text-left text-[10px] font-black uppercase text-muted-foreground tracking-wider">Ghi chú</th>
                 </tr>
                 <tr className="bg-secondary/5">
                   {ROLES.map(role => (
                     <th key={role.id} className="w-[50px] px-1 py-1.5 text-center text-[8px] font-black border-r border-t bg-secondary/5">{role.id}</th>
                   ))}
                 </tr>
              </thead>
              <tbody className="divide-y divide-secondary/10 font-medium">
                {Object.entries(groupedItems).map(([dept, deptItems]) => {
                  const config = DEPARTMENT_CONFIG[dept] || DEPARTMENT_CONFIG['Quản Lý'];
                  return (
                    <React.Fragment key={dept}>
                      <tr className={`${config.lightBg} border-y bg-opacity-30`}>
                        <td colSpan={12} className="px-5 py-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${config.bg} shadow-sm`} />
                            <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${config.color}`}>📌 {dept}</span>
                          </div>
                        </td>
                      </tr>
                      {deptItems.map((item: ProductionChecklistItem) => (
                        <tr key={item.id} className="hover:bg-primary/5 transition-colors group">
                          <td className="px-2 py-2.5 text-center font-bold text-muted-foreground/80 border-r text-[9px] uppercase">{item.department}</td>
                          <td className="px-2 py-2.5 text-center font-bold text-muted-foreground/60 border-r text-[11px]">{item.stt}</td>
                          <td className="px-5 py-2.5 font-bold text-foreground/80 border-r text-[10px] items-center h-full">
                            <div className="whitespace-nowrap overflow-hidden text-ellipsis" title={item.description}>{item.description}</div>
                          </td>
                          {ROLES.map(role => {
                            const isResponsible = item.roles?.includes(role.id);
                            const isConfirmedHere = item.confirmedRole === role.id;
                            return (
                              <td 
                                key={role.id} 
                                onClick={isResponsible ? () => handleConfirmRow(item, role.id) : undefined}
                                className={`px-1 py-1.5 text-center border-r transition-all select-none
                                  ${isResponsible ? (isConfirmedHere ? 'bg-emerald-500/20' : 'bg-primary/5 hover:bg-primary/10 cursor-pointer') : 'bg-secondary/5 cursor-not-allowed'}`}
                              >
                                {isResponsible && isConfirmedHere && (
                                  <span className="text-[8px] font-black text-emerald-700 tracking-tighter">DONE</span>
                                )}
                              </td>
                            );
                          })}
                          <td className={`px-2 py-2.5 border-r text-center transition-all ${item.confirmedBy ? 'bg-emerald-50/50' : ''}`}>
                            <span className="text-[10px] font-black text-foreground block truncate px-1">
                              {item.confirmedBy || '---'}
                            </span>
                          </td>
                          <td className={`px-2 py-2.5 border-r text-center transition-all ${item.timestamp ? 'bg-emerald-50/50' : ''}`}>
                            <span className="text-[9px] font-bold text-muted-foreground">
                              {item.timestamp || '---'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <Input 
                              value={item.notes || ''}
                              onChange={(e) => handleUpdateItem(item.id, { notes: e.target.value })}
                              className="h-8 text-[11px] font-medium border-none bg-secondary/5 hover:bg-secondary/10 focus:bg-background rounded-lg px-2 w-full transition-all"
                              placeholder="..."
                            />
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
         </div>

         {/* Card Layout for Mobile */}
         <div className="md:hidden space-y-3">
            {formData.items.map((item: ProductionChecklistItem) => {
              const config = DEPARTMENT_CONFIG[item.department] || DEPARTMENT_CONFIG['Quản Lý'];
              return (
                  <div key={item.id} className="bg-card p-2 rounded-lg border shadow-sm border-l-4" style={{ borderLeftColor: config.color.replace('text-', '').replace('-600', '') }}>
                   <div className="flex justify-between items-start text-xs font-bold text-foreground mb-1">
                     <span className="opacity-60">{item.id}.</span>                
                     <span className="flex-1 px-2 text-xs leading-tight">{item.description}</span>
                   </div>
                   
                   <div className="grid grid-cols-3 gap-1">
                      {ROLES.map(role => {
                         const isResponsible = item.roles?.includes(role.id);
                         const isConfirmedHere = item.confirmedRole === role.id;
                         return (
                           <button
                             key={role.id}
                             disabled={!isResponsible}
                             onClick={() => handleConfirmRow(item, role.id)}
                             className={`h-8 flex items-center justify-between px-2 rounded border text-[10px] font-bold transition-all
                               ${!isResponsible ? 'opacity-30 bg-secondary/20 cursor-not-allowed' : 
                                 (isConfirmedHere ? 'bg-emerald-500/10 border-emerald-500 text-emerald-800' : 'bg-secondary/20 border-transparent text-foreground')}`}
                           >
                             <span>{role.id}</span>
                             {isConfirmedHere ? <span className="text-emerald-600">☑</span> : <span className="opacity-30">☐</span>}
                           </button>
                         );
                      })}
                   </div>
                   
                   {item.confirmedBy && (
                    <div className="text-[9px] text-muted-foreground pt-1 flex justify-between">
                        <span>{item.confirmedBy}</span>
                        <span>{item.timestamp}</span>
                    </div>
                   )}
                 </div>
              );
            })}
         </div>
      </div>

      {/* Empty space for scrolling */}
      <div className="h-4" />
    </div>
  );
}
