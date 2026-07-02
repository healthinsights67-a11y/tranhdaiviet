import React, { useMemo } from 'react';
import { Task, Quotation, MaterialConfig } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BadgeDollarSign, TrendingUp, TrendingDown, Package, CheckCircle2 } from 'lucide-react';
import { db } from '@/src/lib/firebase';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { TaskCard } from '../kanban/TaskCard';

interface ProfitAnalysisProps {
  tasks: Task[];
  quotations: Quotation[];
}

export const ProfitAnalysis: React.FC<ProfitAnalysisProps> = ({ tasks, quotations }) => {
  const [materialConfigs, setMaterialConfigs] = React.useState<MaterialConfig[]>([]);

  React.useEffect(() => {
    const unsub = onSnapshot(collection(db, 'materialConfigs'), (snap) => {
      setMaterialConfigs(snap.docs.map(d => ({ id: d.id, ...d.data() }) as MaterialConfig));
    });
    return () => unsub();
  }, []);

  const completedTasks = useMemo(() => {
    return tasks.filter(t => t.status === 'done');
  }, [tasks]);

  const profitData = useMemo(() => {
    return completedTasks.map(task => {
      // Find corresponding quotation. Prefer accepted quotations.
      const possibleQuotations = quotations.filter(q => 
        (q.customerName && task.customerName && q.customerName === task.customerName) ||
        (q.customerName && task.title.toLowerCase().includes(q.customerName.toLowerCase())) ||
        ((q as any).customerId && task.customerId && (q as any).customerId === task.customerId)
      );
      
      const quotation = possibleQuotations.find(q => q.status === 'accepted') || possibleQuotations[0];
      const resolvedCustomerName = task.customerName || quotation?.customerName;
      const quotationValue = quotation?.totalAmount || 0;

      // Calculate material cost
      let materialCost = 0;
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
           materialCost += qty * matchedConfig.finalPrice;
        }
      });

      const profit = quotationValue - materialCost;

      return {
        taskId: task.id,
        taskTitle: task.title,
        customerName: resolvedCustomerName,
        quotationValue,
        materialCost,
        profit,
        date: task.createdAt,
        task: task,
      };
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [completedTasks, materialConfigs, quotations]);

  const totalRevenue = profitData.reduce((acc, curr) => acc + curr.quotationValue, 0);
  const totalCost = profitData.reduce((acc, curr) => acc + curr.materialCost, 0);
  const totalProfit = profitData.reduce((acc, curr) => acc + curr.profit, 0);
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-blue-50/50 border-blue-100">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <CheckCircle2 className="h-8 w-8 text-blue-500 mb-2" />
            <p className="text-sm text-blue-600/80 font-medium">Đơn đã hoàn thành</p>
            <h3 className="text-3xl font-bold text-blue-700">{completedTasks.length}</h3>
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
              {profitData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    Chưa có đơn hàng nào hoàn thành
                  </td>
                </tr>
              ) : (
                profitData.map((data) => (
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
