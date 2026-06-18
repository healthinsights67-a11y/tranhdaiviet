import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Users, FileText, Ruler, Hammer, Truck, CheckCircle2, ChevronRight, PlayCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/src/lib/utils';

interface WorkflowGuideWidgetProps {
  setActiveTab?: (tab: string) => void;
}

const WORKFLOW_STEPS = [
  {
    id: 'step-1',
    title: '1. Tiếp nhận Khách hàng',
    tab: 'customers',
    icon: Users,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    description: 'Bắt đầu bằng việc nhập thông tin khách hàng tiềm năng.',
    details: [
      'Vào mục Khách hàng.',
      'Nhấn "Thêm khách hàng".',
      'Điền thông tin liên hệ và nhu cầu (tủ bếp, tủ quần áo, giường...).',
      'Phân công nhân viên Sale chăm sóc.'
    ]
  },
  {
    id: 'step-2',
    title: '2. Lên Báo giá & Chốt cọc',
    tab: 'quotations',
    icon: FileText,
    color: 'text-amber-500',
    bgColor: 'bg-amber-50',
    description: 'Tạo báo giá chi tiết và nhận tiền cọc của khách hàng.',
    details: [
      'Vào mục Báo giá hoặc Sale Planner.',
      'Tạo file báo giá dựa trên kích thước dự kiến.',
      'Chuyển trạng thái khách hàng sang "Chốt Cọc".'
    ]
  },
  {
    id: 'step-3',
    title: '3. Khảo sát Đo đạc',
    tab: 'measurements',
    icon: Ruler,
    color: 'text-purple-500',
    bgColor: 'bg-purple-50',
    description: 'Lên lịch hẹn thợ đến nhà khách hàng để đo đạc thực tế.',
    details: [
      'Vào mục Lịch Đo Đạc.',
      'Tạo lịch hẹn mới, chọn khách hàng và thời gian.',
      'Giao việc cho thợ đo đạc.',
      'Cập nhật kết quả đo đạc (hình ảnh, bản vẽ phác thảo).'
    ]
  },
  {
    id: 'step-4',
    title: '4. Thiết kế & Sản xuất',
    tab: 'production',
    icon: Hammer,
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-50',
    description: 'Lên bản vẽ 3D/2D và chuyển xuống xưởng sản xuất.',
    details: [
      'Vào mục Sản Xuất.',
      'Cập nhật trạng thái bản vẽ (Đang thiết kế -> Chốt thiết kế).',
      'Giao việc cắt CNC, dán cạnh, khoan cam cho thợ.',
      'Theo dõi tiến độ ra ván và đóng gói.'
    ]
  },
  {
    id: 'step-5',
    title: '5. Lắp đặt',
    tab: 'installations',
    icon: Truck,
    color: 'text-teal-500',
    bgColor: 'bg-teal-50',
    description: 'Chuyển hàng đến nhà khách và tiến hành thi công lắp ráp.',
    details: [
      'Vào mục Lịch Lắp Đặt.',
      'Tạo lịch đi lắp, sắp xếp xe tải và thợ lắp ráp.',
      'Thợ cập nhật hình ảnh thi công thực tế tại công trình.'
    ]
  },
  {
    id: 'step-6',
    title: '6. Hoàn thiện & Thu tiền',
    tab: 'customers', // Can point to customers or orders to update status
    icon: CheckCircle2,
    color: 'text-green-500',
    bgColor: 'bg-green-50',
    description: 'Nghiệm thu, thu hồi công nợ và chuyển sang bảo hành.',
    details: [
      'Khách hàng nghiệm thu sản phẩm.',
      'Cập nhật thanh toán đợt cuối.',
      'Đổi trạng thái khách hàng sang "Hoàn thành".'
    ]
  }
];

export function WorkflowGuideWidget({ setActiveTab }: WorkflowGuideWidgetProps) {
  return (
    <Card className="col-span-full border border-primary/20 shadow-sm bg-gradient-to-br from-white to-primary/5">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-primary" />
              Quy trình làm việc chuẩn
            </CardTitle>
            <CardDescription>
              Hướng dẫn các bước thực hiện một đơn hàng từ khi bắt đầu đến lúc hoàn thiện.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {WORKFLOW_STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <Dialog key={step.id}>
                <div className="relative group">
                  <div className={cn("p-4 rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-all duration-200 h-full flex flex-col cursor-pointer", "hover:border-" + step.color.split('-')[1] + "-200")}>
                    <div className="flex items-start justify-between mb-3">
                      <div className={cn("p-2.5 rounded-lg", step.bgColor)}>
                        <Icon className={cn("h-5 w-5", step.color)} />
                      </div>
                      <Badge variant="outline" className="text-[10px] font-semibold text-gray-400">
                        Bước {index + 1}
                      </Badge>
                    </div>
                    
                    <h4 className="font-bold text-gray-800 text-sm mb-1 group-hover:text-primary transition-colors">
                      {step.title}
                    </h4>
                    <p className="text-xs text-gray-500 line-clamp-2 mb-4 flex-1">
                      {step.description}
                    </p>
                    
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-50">
                      <DialogTrigger className="h-7 text-xs px-2 text-primary hover:bg-primary/10 inline-flex items-center justify-center rounded-md font-medium transition-colors">
                        Xem chi tiết
                      </DialogTrigger>
                      {setActiveTab && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-7 text-xs px-2 gap-1"
                          onClick={() => setActiveTab(step.tab)}
                        >
                          Tới trang <ChevronRight className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <DialogContent className="sm:max-w-md rounded-2xl">
                  <DialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={cn("p-3 rounded-xl", step.bgColor)}>
                        <Icon className={cn("h-6 w-6", step.color)} />
                      </div>
                      <div>
                        <DialogTitle className="text-xl">{step.title}</DialogTitle>
                        <DialogDescription className="mt-1">
                          {step.description}
                        </DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>
                  <div className="p-4 bg-gray-50 rounded-xl mt-2">
                    <h4 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">Các thao tác cần làm</h4>
                    <ul className="space-y-3">
                      {step.details.map((detail, idx) => (
                        <li key={idx} className="flex gap-3 text-sm text-gray-600 leading-relaxed">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[11px] font-bold mt-0.5">
                            {idx + 1}
                          </span>
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {setActiveTab && (
                    <div className="mt-4 flex justify-end">
                      <DialogTrigger 
                        onClick={() => setActiveTab(step.tab)}
                        className="w-full sm:w-auto font-semibold gap-2 shadow-sm rounded-xl inline-flex items-center justify-center h-9 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        Đi tới trang {step.title.split('. ')[1]}
                        <ChevronRight className="h-4 w-4" />
                      </DialogTrigger>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
