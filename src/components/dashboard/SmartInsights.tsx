import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, AlertTriangle, TrendingDown, CheckCircle2, ArrowRight } from 'lucide-react';

interface InsightProps {
  tasks: any[];
  customers: any[];
  quotations: any[];
}

export function SmartInsights({ tasks, customers, quotations }: InsightProps) {
  // 1. Phân tích công việc (Tasks)
  const lateTasks = tasks.filter(t => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < new Date());
  
  // 2. Phân tích phễu khách hàng (Customers)
  const consultingCustomers = customers.filter(c => c.stage === 'consulting');
  const quotingCustomers = customers.filter(c => c.stage === 'surveying' || c.stage === 'quoting' || c.stage === 'contracted');
  
  // 3. Phân tích doanh thu
  const actualRevenue = customers.reduce((sum, c) => {
    if (c.stage === 'completed') return sum + (c.orderValue || 0);
    if (['contracted', 'production', 'production_completed', 'installation'].includes(c.stage)) {
      const q = quotations.find(q => q.customerId === c.id);
      return sum + (q?.depositAmount || 0);
    }
    return sum;
  }, 0);
  
  const expectedRevenue = customers.reduce((sum, c) => {
    if (['contracted', 'production', 'production_completed', 'installation', 'completed'].includes(c.stage)) {
      return sum + (c.orderValue || 0);
    }
    return sum;
  }, 0);

  const revenueGap = expectedRevenue - actualRevenue;

  return (
    <Card className="h-full border-blue-100 shadow-sm bg-gradient-to-br from-blue-50/50 to-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2 text-blue-800">
          <Lightbulb className="w-5 h-5 text-amber-500" />
          AI Insights & Khuyến nghị
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Insight 1: Tasks */}
        {lateTasks.length > 0 ? (
          <div className="bg-red-50 p-3 rounded-xl border border-red-100">
            <h4 className="font-semibold text-red-800 flex items-center gap-1 text-sm mb-1">
              <AlertTriangle className="w-4 h-4" /> Có {lateTasks.length} công việc đang trễ hạn
            </h4>
            <div className="text-xs text-red-600 mb-2">
              <span className="font-medium text-red-700">Vì sao:</span> Nhân sự có thể đang quá tải hoặc các khâu trước bị chậm trễ.
            </div>
            <div className="text-xs bg-white/60 p-2 rounded-lg flex gap-2 items-start border border-red-100">
              <ArrowRight className="w-3 h-3 text-red-500 mt-0.5 shrink-0" />
              <span className="text-gray-700"><span className="font-semibold text-red-600">Hành động:</span> Yêu cầu cập nhật tiến độ ngay các nhiệm vụ: <span className="font-medium">{lateTasks.slice(0, 2).map(t => t.title).join(', ')}{lateTasks.length > 2 ? '...' : ''}</span>.</span>
            </div>
          </div>
        ) : (
          <div className="bg-green-50 p-3 rounded-xl border border-green-100">
            <h4 className="font-semibold text-green-800 flex items-center gap-1 text-sm">
              <CheckCircle2 className="w-4 h-4" /> Tiến độ công việc ổn định
            </h4>
            <div className="text-xs text-green-700 mt-1">Không phát hiện công việc trễ hạn.</div>
          </div>
        )}

        {/* Insight 2: Customers */}
        {consultingCustomers.length > 3 && (
          <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
            <h4 className="font-semibold text-amber-800 flex items-center gap-1 text-sm mb-1">
              <TrendingDown className="w-4 h-4" /> Nút thắt tại khâu Tư vấn
            </h4>
            <div className="text-xs text-amber-700 mb-2">
              <span className="font-medium text-amber-800">Vì sao:</span> Có {consultingCustomers.length} khách hàng kẹt ở khâu tư vấn quá lâu mà chưa chuyển đổi sang khảo sát/báo giá.
            </div>
            <div className="text-xs bg-white/60 p-2 rounded-lg flex gap-2 items-start border border-amber-100">
              <ArrowRight className="w-3 h-3 text-amber-600 mt-0.5 shrink-0" />
              <span className="text-gray-700"><span className="font-semibold text-amber-700">Hành động:</span> Cung cấp thêm tài liệu mẫu mã, hoặc mời khách đến xưởng tham quan để chốt lịch khảo sát.</span>
            </div>
          </div>
        )}

        {/* Insight 3: Revenue */}
        {revenueGap > 0 && quotingCustomers.length > 0 && (
          <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
            <h4 className="font-semibold text-blue-800 flex items-center gap-1 text-sm mb-1">
              <Lightbulb className="w-4 h-4" /> Tiềm năng tăng trưởng
            </h4>
            <div className="text-xs text-blue-700 mb-2">
              <span className="font-medium text-blue-800">Vì sao:</span> Còn {quotingCustomers.length} dự án đang trong giai đoạn báo giá/chờ chốt chưa thành doanh thu thực tế.
            </div>
            <div className="text-xs bg-white/60 p-2 rounded-lg flex gap-2 items-start border border-blue-100">
              <ArrowRight className="w-3 h-3 text-blue-600 mt-0.5 shrink-0" />
              <span className="text-gray-700"><span className="font-semibold text-blue-700">Hành động:</span> Theo dõi sát sao <span className="font-medium">{quotingCustomers.slice(0, 2).map(c => c.name).join(', ')}</span>. Xem xét có nên thêm chính sách ưu đãi chốt sớm.</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
