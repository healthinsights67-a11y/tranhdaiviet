import React, { useMemo } from 'react';
import { Task, Quotation, MaterialConfig, AccessoryConfig, Customer } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BadgeDollarSign, TrendingUp, TrendingDown, Package, CheckCircle2, Calendar } from 'lucide-react';
import { db } from '@/src/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { TaskCard } from '../kanban/TaskCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ProfitAnalysisProps {
  tasks?: Task[];
  quotations?: Quotation[];
}

const getStartOfWeek = (d: Date) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
};

const formatDate = (dateVal: any) => {
  if (!dateVal) return 'N/A';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('vi-VN');
};

export const ProfitAnalysis: React.FC<ProfitAnalysisProps> = ({ tasks = [], quotations = [] }) => {
  const [materialConfigs, setMaterialConfigs] = React.useState<MaterialConfig[]>([]);
  const [accessoryConfigs, setAccessoryConfigs] = React.useState<AccessoryConfig[]>([]);
  const [customers, setCustomers] = React.useState<Customer[]>([]);

  React.useEffect(() => {
    const unsub = onSnapshot(collection(db, 'materialConfigs'), (snap) => {
      setMaterialConfigs(snap.docs.map(d => ({ id: d.id, ...d.data() }) as MaterialConfig));
    });
    const unsubAcc = onSnapshot(collection(db, 'accessoryConfigs'), (snap) => {
      setAccessoryConfigs(snap.docs.map(d => ({ id: d.id, ...d.data() }) as AccessoryConfig));
    });
    return () => { unsub(); unsubAcc(); };
  }, []);

  React.useEffect(() => {
    const unsub = onSnapshot(collection(db, 'customers'), (snap) => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Customer));
    });
    return () => unsub();
  }, []);

  const [timeFilter, setTimeFilter] = React.useState<string>('all');
  const [selectedMonth, setSelectedMonth] = React.useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = React.useState<number>(new Date().getFullYear());

  const processedMaterialConfigs = React.useMemo(() => {
    const templates: Record<string, MaterialConfig> = {};
    materialConfigs.forEach(m => {
      const baseCode = m.code.split('_').pop() || '';
      const hasPrice = (m.preTaxBoxPrice || 0) > 0 || (m.listedBoxPrice || 0) > 0;
      if (hasPrice && baseCode) {
        if (!templates[baseCode] || m.code === baseCode || m.code.startsWith('AT_') || m.code.startsWith('HN_')) {
          templates[baseCode] = m;
        }
      }
    });

    return materialConfigs.map(m => {
      const baseCode = m.code.split('_').pop() || '';
      const hasPrice = (m.preTaxBoxPrice || 0) > 0 || (m.listedBoxPrice || 0) > 0;
      
      if (hasPrice) {
        return m;
      }

      const template = templates[baseCode];
      if (template) {
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
          discountPercent: m.discountPercent !== undefined ? m.discountPercent : (template.discountPercent !== undefined ? template.discountPercent : 38)
        };
      }

      return m;
    });
  }, [materialConfigs]);

  const profitData = useMemo(() => {
    // 1. Get all quotations that are accepted or deposited
    const contractedQuotes = quotations.filter(q => 
      q.status === 'accepted' || q.status === 'deposit'
    );

    // 2. Group by customer name to ensure unique customers
    const grouped: Record<string, {
      id: string;
      customerName: string;
      quotationValue: number;
      materialCost: number;
      profit: number;
      date: string;
      projectName: string;
      materialDetails: any[];
    }> = {};

    contractedQuotes.forEach(q => {
      const resolvedCustomerName = (q.customerName || 'N/A').trim();
      if (!resolvedCustomerName || resolvedCustomerName === 'N/A') return;

      // Find all tasks related to this customer (to calculate material cost)
      const customerTasks = (tasks || []).filter(t => 
        (t.customerId && q.customerId && t.customerId === q.customerId) ||
        (t.phone && q.phone && String(t.phone).trim().replace(/\D/g, '') === String(q.phone).trim().replace(/\D/g, '')) ||
        (t.customerName && q.customerName && String(t.customerName).trim().toLowerCase() === String(q.customerName).trim().toLowerCase())
      );

      let customerMaterialCost = 0;
      let details: any[] = [];
      customerTasks.forEach(task => {
        const requisitionItems = task.materialRequisition?.items || [];
        requisitionItems.forEach((item, idx) => {
          const qty = parseFloat(item.quantity) || 0;
          if (qty <= 0) return;

          const searchStr = (item.type || '').toLowerCase();
          const itemNameLower = (item.name || '').toLowerCase();
          const optionLower = (item.selectedOption || '').toLowerCase();
          const combinedName = `${itemNameLower} ${optionLower}`.trim();

          let matchedConfig: any = null;

          // 1. Try exact match by code or name from item.type (searchStr)
          if (searchStr) {
            matchedConfig = processedMaterialConfigs.find(m => {
              const codeLower = (m.code || '').toLowerCase();
              return (codeLower && searchStr.includes(codeLower)) || ((m.name || '').toLowerCase() === searchStr);
            });
            if (!matchedConfig) {
              matchedConfig = accessoryConfigs.find(a => {
                const codeLower = (a.code || '').toLowerCase();
                return (codeLower && searchStr.includes(codeLower)) || ((a.name || '').toLowerCase() === searchStr);
              });
            }
          }

          // 2. Try matching accessories by item.name and selectedOption
          if (!matchedConfig) {
             matchedConfig = accessoryConfigs.find(a => {
               const aName = (a.name || '').toLowerCase();
               if (!aName) return false;
               
               // Exact match with combined name (e.g. "bản lề thẳng")
               if (aName === combinedName) return true;
               
               // Or name matches item.name AND option matches item.selectedOption
               if (aName === itemNameLower && (!a.option || (a.option || '').toLowerCase() === optionLower)) return true;
               
               return false;
             });
          }

          // 3. Try partial match by item.name in materialConfigs
          if (!matchedConfig) {
            matchedConfig = processedMaterialConfigs.find(m => {
              const nameLower = (m.name || '').toLowerCase();
              return nameLower ? itemNameLower.includes(nameLower) || nameLower.includes(itemNameLower) : false;
            });
          }
          
          // 4. Try partial match by item.name in accessoryConfigs
          if (!matchedConfig) {
            matchedConfig = accessoryConfigs.find(a => {
              const aName = (a.name || '').toLowerCase();
              return aName ? itemNameLower.includes(aName) || aName.includes(itemNameLower) : false;
            });
          }

          if (matchedConfig) {
            let itemPrice = matchedConfig.finalPrice || matchedConfig.unitPrice || 0;
            
            const configUnit = (matchedConfig.unit || '').trim().toLowerCase();
            const reqUnit = (item.unit || '').trim().toLowerCase();
            
            if (configUnit === 'hộp' && reqUnit !== 'hộp') {
              const itemsPerBox = parseFloat(String(matchedConfig.itemsPerBox)) || 1;
              if (itemsPerBox > 0) {
                itemPrice = itemPrice / itemsPerBox;
              }
            }
            
            const cost = Math.round(qty * itemPrice);
            customerMaterialCost += cost;
            details.push({
               id: `${task.id}-${idx}`,
               name: matchedConfig.name || item.name,
               quantity: qty,
               unit: item.unit || matchedConfig.unit || '',
               price: itemPrice,
               total: cost,
            });
          }
        });
      });

      const projectName = q.constructionType ? `Đơn hàng: ${q.constructionType}` : `Báo giá: ${q.quotationNumber}`;

      if (!grouped[resolvedCustomerName]) {
        grouped[resolvedCustomerName] = {
          id: q.id,
          customerName: resolvedCustomerName,
          quotationValue: q.totalAmount || 0,
          materialCost: customerMaterialCost,
          materialDetails: details,
          profit: 0,
          date: q.date || q.createdAt,
          projectName: projectName,
        };
      } else {
        // Accumulate quotation value if multiple contracted quotes exist
        grouped[resolvedCustomerName].quotationValue += q.totalAmount || 0;
        // Keep the latest date
        const currentQuoteDate = q.date || q.createdAt;
        if (new Date(currentQuoteDate).getTime() > new Date(grouped[resolvedCustomerName].date).getTime()) {
          grouped[resolvedCustomerName].date = currentQuoteDate;
          grouped[resolvedCustomerName].projectName = projectName;
        }
      }
    });

    return Object.values(grouped).map(item => {
      item.profit = item.quotationValue - item.materialCost;
      return item;
    });
  }, [quotations, tasks, processedMaterialConfigs, accessoryConfigs, customers]);

  const filteredProfitData = useMemo(() => {
    const now = new Date();
    
    const clearTime = (d: Date) => {
      const nd = new Date(d);
      nd.setHours(0, 0, 0, 0);
      return nd;
    };

    return profitData.filter(item => {
      if (!item.date) return false;
      const itemDate = new Date(item.date);
      
      if (timeFilter === 'all') return true;
      
      if (timeFilter === 'this-week') {
        const startOfWeek = clearTime(getStartOfWeek(now));
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);
        return itemDate >= startOfWeek && itemDate < endOfWeek;
      }
      
      if (timeFilter === 'last-week') {
        const startOfThisWeek = clearTime(getStartOfWeek(now));
        const startOfLastWeek = new Date(startOfThisWeek);
        startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);
        return itemDate >= startOfLastWeek && itemDate < startOfThisWeek;
      }
      
      if (timeFilter === 'this-month') {
        return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
      }
      
      if (timeFilter === 'last-month') {
        const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        return itemDate.getMonth() === lastMonth && itemDate.getFullYear() === lastMonthYear;
      }
      
      if (timeFilter === 'specific-month') {
        return itemDate.getMonth() === (selectedMonth - 1) && itemDate.getFullYear() === selectedYear;
      }
      
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [profitData, timeFilter, selectedMonth, selectedYear]);

  const totalRevenue = filteredProfitData.reduce((acc, curr) => acc + curr.quotationValue, 0);
  const totalCost = filteredProfitData.reduce((acc, curr) => acc + curr.materialCost, 0);
  const totalProfit = filteredProfitData.reduce((acc, curr) => acc + curr.profit, 0);
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  
  const [selectedOrderDetails, setSelectedOrderDetails] = React.useState<any>(null);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-blue-50/50 border-blue-100">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <CheckCircle2 className="h-8 w-8 text-blue-500 mb-2" />
            <p className="text-sm text-blue-600/80 font-medium">Khách hàng chốt cọc</p>
            <h3 className="text-3xl font-bold text-blue-700">{filteredProfitData.length}</h3>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50/50 border-emerald-100">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <BadgeDollarSign className="h-8 w-8 text-emerald-500 mb-2" />
            <p className="text-sm text-emerald-600/80 font-medium">Tổng doanh thu</p>
            <h3 className="text-2xl font-bold text-emerald-700">{totalRevenue.toLocaleString('vi-VN')}</h3>
          </CardContent>
        </Card>
        <Card className="bg-amber-50/50 border-amber-100">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <Package className="h-8 w-8 text-amber-500 mb-2" />
            <p className="text-sm text-amber-600/80 font-medium">Tổng chi phí vật tư</p>
            <h3 className="text-2xl font-bold text-amber-700">{totalCost.toLocaleString('vi-VN')}</h3>
          </CardContent>
        </Card>
        <Card className="bg-purple-50/50 border-purple-100">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            {totalProfit >= 0 ? <TrendingUp className="h-8 w-8 text-purple-500 mb-2" /> : <TrendingDown className="h-8 w-8 text-red-500 mb-2" />}
            <p className="text-sm text-purple-600/80 font-medium">Lãi thực (Biên lợi nhuận {profitMargin.toFixed(1)}%)</p>
            <h3 className="text-2xl font-bold text-purple-700">{totalProfit.toLocaleString('vi-VN')}</h3>
          </CardContent>
        </Card>
      </div>

      {/* Time Period Filter Bar */}
      <div className="flex items-center justify-between gap-4 bg-card p-4 rounded-xl border shadow-sm flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground/80">Bộ lọc thời gian:</span>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <select
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-w-[160px]"
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
          >
            <option value="all">Tất cả thời gian</option>
            <option value="this-week">Tuần này</option>
            <option value="last-week">Tuần trước</option>
            <option value="this-month">Tháng này</option>
            <option value="last-month">Tháng trước</option>
            <option value="specific-month">Chọn tháng cụ thể</option>
          </select>

          {timeFilter === 'specific-month' && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <select
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-28"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>Tháng {m}</option>
                ))}
              </select>
              
              <select
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-24"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                  <option key={y} value={y}>Năm {y}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
              <tr>
                <th className="px-6 py-4 font-semibold">Công việc / Đơn hàng</th>
                <th className="px-6 py-4 font-semibold">Khách hàng</th>
                <th className="px-6 py-4 font-semibold text-right">Ngày hoàn thành</th>
                <th className="px-6 py-4 font-semibold text-right">Giá trị Hợp đồng</th>
                <th className="px-6 py-4 font-semibold text-right">Chi phí Vật tư</th>
                <th className="px-6 py-4 font-semibold text-right">Biên Lợi nhuận</th>
                <th className="px-6 py-4 font-semibold text-right">Lãi thực</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredProfitData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    Chưa có đơn hàng nào hoàn thành trong khoảng thời gian này
                  </td>
                </tr>
              ) : (
                filteredProfitData.map((data) => (
                  <tr key={data.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setSelectedOrderDetails(data)}>
                    <td className="px-6 py-3 font-semibold text-foreground/80">
                      {data.projectName}
                    </td>
                    <td className="px-6 py-3">{data.customerName || 'N/A'}</td>
                    <td className="px-6 py-3 text-right text-muted-foreground">
                      {formatDate(data.date)}
                    </td>
                    <td className="px-6 py-3 text-right font-medium text-emerald-600">
                      {data.quotationValue > 0 ? data.quotationValue.toLocaleString('vi-VN') : '0'}
                    </td>
                    <td className="px-6 py-3 text-right font-medium text-amber-600">
                      {data.materialCost > 0 ? data.materialCost.toLocaleString('vi-VN') : '0'}
                    </td>
                    <td className="px-6 py-3 text-right font-semibold text-blue-600">
                      {data.quotationValue > 0 ? ((data.profit / data.quotationValue) * 100).toFixed(1) : 0}%
                    </td>
                    <td className="px-6 py-3 text-right font-bold text-purple-600">
                      {data.profit.toLocaleString('vi-VN')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!selectedOrderDetails} onOpenChange={(open) => !open && setSelectedOrderDetails(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Chi tiết Vật tư & Phụ kiện - {selectedOrderDetails?.customerName}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2 mt-4 space-y-4">
             <table className="w-full text-sm text-left">
               <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                 <tr>
                   <th className="px-4 py-2">STT</th>
                   <th className="px-4 py-2">Tên vật tư/phụ kiện</th>
                   <th className="px-4 py-2 text-right">Số lượng</th>
                   <th className="px-4 py-2 text-right">Đơn giá</th>
                   <th className="px-4 py-2 text-right">Thành tiền</th>
                 </tr>
               </thead>
               <tbody className="divide-y">
                 {selectedOrderDetails?.materialDetails?.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Không có dữ liệu vật tư cho đơn hàng này</td>
                    </tr>
                 ) : (
                    selectedOrderDetails?.materialDetails?.map((item: any, idx: number) => (
                      <tr key={item.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2">{idx + 1}</td>
                        <td className="px-4 py-2 font-medium">{item.name}</td>
                        <td className="px-4 py-2 text-right">{item.quantity} {item.unit}</td>
                        <td className="px-4 py-2 text-right">{item.price.toLocaleString('vi-VN')}</td>
                        <td className="px-4 py-2 text-right font-semibold text-amber-600">{item.total.toLocaleString('vi-VN')}</td>
                      </tr>
                    ))
                 )}
               </tbody>
               <tfoot className="bg-muted/20 font-bold">
                 <tr>
                   <td colSpan={4} className="px-4 py-3 text-right">Tổng chi phí vật tư:</td>
                   <td className="px-4 py-3 text-right text-amber-700">{selectedOrderDetails?.materialCost?.toLocaleString('vi-VN')}</td>
                 </tr>
               </tfoot>
             </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
