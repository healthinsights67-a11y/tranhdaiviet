import React, { useMemo } from 'react';
import { Task, Quotation, MaterialConfig, Customer } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BadgeDollarSign, TrendingUp, TrendingDown, Package, CheckCircle2, Calendar } from 'lucide-react';
import { db } from '@/src/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { TaskCard } from '../kanban/TaskCard';

interface ProfitAnalysisProps {
  tasks: Task[];
  quotations: Quotation[];
}

const getStartOfWeek = (d: Date) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
};

export const ProfitAnalysis: React.FC<ProfitAnalysisProps> = ({ tasks, quotations }) => {
  const [materialConfigs, setMaterialConfigs] = React.useState<MaterialConfig[]>([]);
  const [customers, setCustomers] = React.useState<Customer[]>([]);

  React.useEffect(() => {
    const unsub = onSnapshot(collection(db, 'materialConfigs'), (snap) => {
      setMaterialConfigs(snap.docs.map(d => ({ id: d.id, ...d.data() }) as MaterialConfig));
    });
    return () => unsub();
  }, []);

  React.useEffect(() => {
    const unsub = onSnapshot(collection(db, 'customers'), (snap) => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Customer));
    });
    return () => unsub();
  }, []);

  const completedTasks = useMemo(() => {
    return tasks.filter(t => t.status === 'done');
  }, [tasks]);

  const [timeFilter, setTimeFilter] = React.useState<string>('all');
  const [selectedMonth, setSelectedMonth] = React.useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = React.useState<number>(new Date().getFullYear());

  const profitData = useMemo(() => {
    // 1. Filter completed tasks to only keep design tasks
    const designTasks = completedTasks.filter(task => 
      task.type === 'design' || 
      task.title.toLowerCase().includes('thiết kế')
    );

    // 2. Group by customer name to ensure unique customers
    const grouped: Record<string, {
      taskId: string;
      taskTitle: string;
      customerName: string;
      quotationValue: number;
      materialCost: number;
      profit: number;
      date: string;
      task: Task;
    }> = {};

    designTasks.forEach(task => {
      // Find corresponding customer
      const cust = customers.find(c => 
        (task.customerId && c.id === task.customerId) || 
        (task.phone && c.phone?.trim()?.replace(/\D/g, '') === task.phone?.trim()?.replace(/\D/g, ''))
      );
      
      const hasPostDepositStage = cust && ['contracted', 'production', 'installation', 'completed'].includes(cust.stage);
      
      const matchingQuotations = quotations.filter(q => {
        if (task.customerId && q.customerId === task.customerId) return true;
        if (task.phone && q.phone?.trim()?.replace(/\D/g, '') === task.phone?.trim()?.replace(/\D/g, '')) return true;
        if (cust && q.customerId === cust.id) return true;
        if (cust && q.phone?.trim()?.replace(/\D/g, '') === cust.phone?.trim()?.replace(/\D/g, '')) return true;
        return false;
      });

      const hasValidQuotation = matchingQuotations.some(q => q.status === 'deposit' || q.status === 'accepted');

      // Only show if customer has deposited (chốt cọc) or accepted (chốt báo giá)
      if (!hasPostDepositStage && !hasValidQuotation) {
        return;
      }

      const quotation = matchingQuotations.find(q => q.status === 'accepted' || q.status === 'deposit') || matchingQuotations[0];
      const resolvedCustomerName = (task.customerName || quotation?.customerName || cust?.name || 'N/A').trim();
      
      if (!resolvedCustomerName || resolvedCustomerName === 'N/A') return;

      // Calculate material cost
      let taskMaterialCost = 0;
      const requisitionItems = task.materialRequisition?.items || [];
      
      requisitionItems.forEach(item => {
        // try to match item.type or item.name with materialConfigs
        const searchStr = (item.type || '').toLowerCase();
        let matchedConfig = materialConfigs.find(m => {
          const codeMatch = searchStr.includes(m.code.toLowerCase());
          const nameLower = (m.name || '').toLowerCase();
          const nameMatch = nameLower ? (searchStr === nameLower || searchStr.includes(nameLower)) : false;
          return codeMatch || nameMatch;
        });

        if (!matchedConfig) {
          // try matching by name
          matchedConfig = materialConfigs.find(m => {
            const nameLower = (m.name || '').toLowerCase();
            return nameLower ? item.name.toLowerCase().includes(nameLower) : false;
          });
        }

        if (matchedConfig) {
          const qty = parseFloat(item.quantity) || 0;
          let itemPrice = matchedConfig.finalPrice || 0;
          
          const configUnit = (matchedConfig.unit || '').trim().toLowerCase();
          const reqUnit = (item.unit || '').trim().toLowerCase();
          
          if (configUnit === 'hộp' && reqUnit !== 'hộp') {
            const itemsPerBox = parseFloat(String(matchedConfig.itemsPerBox)) || 1;
            if (itemsPerBox > 0) {
              itemPrice = itemPrice / itemsPerBox;
            }
          }
          
          taskMaterialCost += Math.round(qty * itemPrice);
        }
      });

      const quotationValue = quotation?.totalAmount || 0;

      if (!grouped[resolvedCustomerName]) {
        grouped[resolvedCustomerName] = {
          taskId: task.id,
          taskTitle: task.title,
          customerName: resolvedCustomerName,
          quotationValue,
          materialCost: taskMaterialCost,
          profit: 0,
          date: task.completedAt || task.createdAt,
          task: task,
        };
      } else {
        // Accumulate material cost
        grouped[resolvedCustomerName].materialCost += taskMaterialCost;
        // Keep the latest task for this customer
        const currentTaskDate = task.completedAt || task.createdAt;
        const groupedTaskDate = grouped[resolvedCustomerName].task.completedAt || grouped[resolvedCustomerName].date;
        if (new Date(currentTaskDate).getTime() > new Date(groupedTaskDate).getTime()) {
          grouped[resolvedCustomerName].date = currentTaskDate;
          grouped[resolvedCustomerName].taskId = task.id;
          grouped[resolvedCustomerName].taskTitle = task.title;
          grouped[resolvedCustomerName].task = task;
        }
      }
    });

    return Object.values(grouped).map(item => {
      item.profit = item.quotationValue - item.materialCost;
      return item;
    });
  }, [completedTasks, materialConfigs, quotations, customers]);

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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-blue-50/50 border-blue-100">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <CheckCircle2 className="h-8 w-8 text-blue-500 mb-2" />
            <p className="text-sm text-blue-600/80 font-medium">Khách hàng thiết kế</p>
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
                  <tr key={data.taskId} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-3 font-medium text-primary">
                      <TaskCard task={data.task} renderAsTextOnly={true} />
                    </td>
                    <td className="px-6 py-3">{data.customerName || 'N/A'}</td>
                    <td className="px-6 py-3 text-right text-muted-foreground">
                      {new Date(data.date).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-6 py-3 text-right font-medium text-emerald-600">
                      {data.quotationValue > 0 ? data.quotationValue.toLocaleString('vi-VN') : '0'}
                    </td>
                    <td className="px-6 py-3 text-right font-medium text-amber-600">
                      {data.materialCost > 0 ? data.materialCost.toLocaleString('vi-VN') : '0'}
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
    </div>
  );
};
