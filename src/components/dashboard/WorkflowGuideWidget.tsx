import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, FileText, Ruler, Hammer, Truck, CheckCircle2, ChevronRight, Lightbulb, UserPlus, FileEdit, Stamp, Settings, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface WorkflowGuideWidgetProps {
  setActiveTab?: (tab: string) => void;
  onActionComplete?: () => void;
}

const WORKFLOW_STEPS = [
  {
    id: 'step-1',
    title: '1. Tiếp nhận Khách hàng',
    tab: 'customers',
    icon: Users,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    indicatorColor: 'bg-blue-500',
    description: 'Bắt đầu bằng việc nhập thông tin khách hàng tiềm năng.',
    details: [
      'Vào mục Khách hàng.',
      'Nhấn "Thêm khách hàng".',
      'Điền thông tin liên hệ và nhu cầu.',
      'Phân công nhân viên Sale chăm sóc.'
    ],
    tips: 'Lấy càng nhiều thông tin chi tiết về nhu cầu và ngân sách của khách hàng càng tốt để dễ dàng chốt sales.'
  },
  {
    id: 'step-2',
    title: '2. Khảo sát Đo đạc',
    tab: 'measurements',
    icon: Ruler,
    color: 'text-purple-500',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    indicatorColor: 'bg-purple-500',
    description: 'Lên lịch hẹn thợ đến nhà khách hàng để đo đạc thực tế.',
    details: [
      'Vào mục Lịch Đo Đạc.',
      'Tạo lịch hẹn mới, chọn khách hàng và thời gian.',
      'Giao việc cho thợ đo đạc.',
      'Cập nhật kết quả đo đạc.'
    ],
    tips: 'Nhắc thợ chụp ảnh hiện trạng các góc cạnh và đường điện nước để thiết kế chính xác.'
  },
  {
    id: 'step-3',
    title: '3. Lên Báo giá & Chốt cọc',
    tab: 'quotations',
    icon: FileText,
    color: 'text-amber-500',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    indicatorColor: 'bg-amber-500',
    description: 'Tạo báo giá chi tiết và nhận tiền cọc của khách hàng.',
    details: [
      'Vào mục Báo giá hoặc Sale Planner.',
      'Tạo file báo giá dựa trên kích thước.',
      'Chuyển trạng thái khách hàng sang "Chốt Cọc".'
    ],
    tips: 'Sử dụng các mẫu báo giá có sẵn để tiết kiệm thời gian.'
  },
  {
    id: 'step-4',
    title: '4. Thiết kế & Sản xuất',
    tab: 'production',
    icon: Hammer,
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    indicatorColor: 'bg-indigo-500',
    description: 'Lên bản vẽ 3D/2D và chuyển xuống xưởng sản xuất.',
    details: [
      'Vào mục Sản Xuất.',
      'Cập nhật trạng thái bản vẽ.',
      'Giao việc cắt CNC, dán cạnh, khoan cam cho thợ.',
      'Theo dõi tiến độ ra ván và đóng gói.'
    ],
    tips: 'Kiểm tra kỹ kích thước trên bản vẽ 2D trước khi xuất file cắt CNC để tránh sai sót ván.'
  },
  {
    id: 'step-5',
    title: '5. Lắp đặt',
    tab: 'installations',
    icon: Truck,
    color: 'text-teal-500',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
    indicatorColor: 'bg-teal-500',
    description: 'Chuyển hàng đến nhà khách và tiến hành thi công lắp ráp.',
    details: [
      'Vào mục Lịch Lắp Đặt.',
      'Tạo lịch đi lắp, sắp xếp xe tải và thợ lắp ráp.',
      'Thợ cập nhật hình ảnh thi công thực tế tại công trình.'
    ],
    tips: 'Bọc lót ván cẩn thận khi vận chuyển và chú ý vệ sinh công trình sau khi lắp đặt xong.'
  },
  {
    id: 'step-6',
    title: '6. Hoàn thiện & Thu tiền',
    tab: 'customers', 
    icon: CheckCircle2,
    color: 'text-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    indicatorColor: 'bg-green-500',
    description: 'Nghiệm thu, thu hồi công nợ và chuyển sang bảo hành.',
    details: [
      'Khách hàng nghiệm thu sản phẩm.',
      'Cập nhật thanh toán đợt cuối.',
      'Đổi trạng thái khách hàng sang "Hoàn thành".'
    ],
    tips: 'Xin đánh giá (feedback) của khách hàng để làm tư liệu marketing.'
  }
];

const StepSimulation = ({ stepId }: { stepId: string }) => {
  return (
    <div className="w-full h-[140px] md:h-[160px] bg-slate-900 rounded-xl overflow-hidden relative flex items-center justify-center border-4 border-slate-800 shadow-inner">
      <div className="absolute top-3 left-4 flex gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
        <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
      </div>
      
      <AnimatePresence mode="wait">
        <motion.div
          key={stepId}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.3 }}
          className="w-full h-full flex items-center justify-center scale-90 md:scale-100"
        >
          {stepId === 'step-1' && (
            <div className="flex flex-col items-center gap-4">
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="w-40 h-28 bg-white/10 rounded-lg p-3 border border-white/20 backdrop-blur-sm"
              >
                <div className="flex items-center gap-3 mb-3">
                  <UserPlus className="h-6 w-6 text-blue-400" />
                  <div className="space-y-2 flex-1">
                    <motion.div animate={{ width: ['0%', '100%'] }} transition={{ duration: 1, repeat: Infinity, repeatType: "reverse" }} className="h-1.5 bg-blue-400/50 rounded"></motion.div>
                    <motion.div animate={{ width: ['0%', '70%'] }} transition={{ duration: 1, delay: 0.2, repeat: Infinity, repeatType: "reverse" }} className="h-1.5 bg-blue-400/30 rounded"></motion.div>
                  </div>
                </div>
                <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }} className="w-full h-6 bg-blue-500 text-white rounded text-[9px] flex items-center justify-center font-bold">
                  LƯU THÔNG TIN
                </motion.div>
              </motion.div>
            </div>
          )}

          {stepId === 'step-2' && (
            <div className="flex flex-col items-center scale-90">
              <div className="relative">
                <Ruler className="h-12 w-12 text-purple-400" />
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: 100 }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute top-1/2 left-full ml-4 h-0.5 bg-purple-400 border-dashed border-t border-purple-400"
                >
                  <div className="absolute -top-3 right-0 text-[9px] text-purple-300">4500mm</div>
                </motion.div>
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: 60 }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                  className="absolute top-full left-1/2 mt-4 w-0.5 bg-purple-400 border-dashed border-l border-purple-400"
                >
                  <div className="absolute top-1/2 -left-8 text-[9px] text-purple-300">2200mm</div>
                </motion.div>
              </div>
            </div>
          )}

          {stepId === 'step-3' && (
            <div className="flex flex-col items-center relative scale-90">
              <motion.div 
                animate={{ y: [15, 0, 15] }} 
                transition={{ duration: 3, repeat: Infinity }}
                className="w-32 h-40 bg-white/10 rounded-lg p-3 border border-white/20 flex flex-col gap-2"
              >
                <div className="h-2 w-1/2 bg-amber-400/50 rounded"></div>
                <div className="h-1.5 w-full bg-white/20 rounded mt-1"></div>
                <div className="h-1.5 w-full bg-white/20 rounded"></div>
                <div className="h-1.5 w-3/4 bg-white/20 rounded"></div>
                <div className="mt-auto h-5 w-full bg-amber-500/20 border border-amber-500/50 rounded flex items-center justify-between px-1.5">
                  <span className="text-[8px] text-amber-200">Tổng cộng:</span>
                  <span className="text-[8px] text-amber-400 font-bold">45.000.000đ</span>
                </div>
              </motion.div>
              <motion.div 
                initial={{ scale: 3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: 1, repeat: Infinity, repeatDelay: 2 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <div className="border-2 border-red-500 text-red-500 font-black text-sm px-2 py-0.5 rounded rotate-[-15deg] uppercase">ĐÃ CHỐT CỌC</div>
              </motion.div>
            </div>
          )}

          {stepId === 'step-4' && (
            <div className="flex gap-6 items-center scale-90">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 4, ease: "linear", repeat: Infinity }}>
                <Settings className="h-12 w-12 text-indigo-400" />
              </motion.div>
              <div className="flex gap-2">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    initial={{ x: -40, opacity: 0 }}
                    animate={{ x: 40, opacity: 0 }}
                    transition={{ duration: 2, delay: i * 0.6, repeat: Infinity, ease: "linear" }}
                    className="w-10 h-10 bg-indigo-500/20 border-2 border-indigo-500/50 rounded-sm flex items-center justify-center"
                  >
                    <div className="w-6 h-6 border border-indigo-400/50"></div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {stepId === 'step-5' && (
            <div className="w-full relative h-24 overflow-hidden flex items-center">
              <div className="absolute bottom-4 w-full border-b-2 border-dashed border-teal-500/30"></div>
              <motion.div 
                initial={{ x: -100 }}
                animate={{ x: 300 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="absolute bottom-4 text-teal-400 flex items-center"
              >
                <Truck className="h-12 w-12" />
                <motion.div 
                  animate={{ opacity: [1, 0] }} 
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="w-6 h-6 ml-2 border-2 border-teal-500/50 rounded-sm bg-teal-500/20"
                />
              </motion.div>
            </div>
          )}

          {stepId === 'step-6' && (
            <div className="flex flex-col items-center gap-4 scale-90">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1] }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/50"
              >
                <CheckCircle2 className="h-8 w-8 text-white" />
              </motion.div>
              <div className="flex gap-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.8 + (i * 0.1) }}
                  >
                    <Star className="h-6 w-6 text-yellow-400 fill-yellow-400" />
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export function WorkflowGuideWidget({ setActiveTab, onActionComplete }: WorkflowGuideWidgetProps) {
  const [activeStepId, setActiveStepId] = useState(WORKFLOW_STEPS[0].id);

  const activeStep = WORKFLOW_STEPS.find(s => s.id === activeStepId) || WORKFLOW_STEPS[0];

  return (
    <Card className="col-span-full border-0 shadow-none bg-transparent">
      <CardContent className="p-0">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Sidebar - Steps */}
          <div className="w-full lg:w-1/3 flex flex-col space-y-2">
            {WORKFLOW_STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = step.id === activeStepId;
              
              return (
                <button
                  key={step.id}
                  onClick={() => setActiveStepId(step.id)}
                  className={cn(
                    "w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-center gap-4 group relative overflow-hidden",
                    isActive 
                      ? `bg-white shadow-md ${step.borderColor}` 
                      : "bg-transparent border-transparent hover:bg-gray-50 hover:border-gray-200"
                  )}
                >
                  {isActive && (
                    <motion.div 
                      layoutId="active-step-indicator"
                      className={cn("absolute left-0 top-0 bottom-0 w-1.5 rounded-r-full", step.indicatorColor)}
                    />
                  )}
                  
                  <div className={cn("p-2.5 rounded-lg flex-shrink-0 transition-colors", isActive ? step.bgColor : "bg-gray-100 group-hover:bg-gray-200")}>
                    <Icon className={cn("h-5 w-5", isActive ? step.color : "text-gray-500")} />
                  </div>
                  
                  <div className="flex-1">
                    <h4 className={cn("font-bold text-sm transition-colors", isActive ? "text-gray-900" : "text-gray-600 group-hover:text-gray-900")}>
                      {step.title}
                    </h4>
                  </div>
                  
                  <ChevronRight className={cn("h-4 w-4 transition-transform", isActive ? step.color : "text-transparent")} />
                </button>
              );
            })}
          </div>
          
          {/* Right Pane - Details */}
          <div className="w-full lg:w-2/3">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className={cn("h-full bg-white rounded-2xl border shadow-sm p-6 lg:p-8 flex flex-col", activeStep.borderColor)}
              >
                {/* Simulation / Video Mock Area */}
                <div className="mb-8">
                  <StepSimulation stepId={activeStep.id} />
                </div>

                <div className="flex items-start gap-4 mb-6">
                  <div className={cn("p-4 rounded-2xl", activeStep.bgColor)}>
                    <activeStep.icon className={cn("h-8 w-8", activeStep.color)} />
                  </div>
                  <div>
                    <Badge variant="outline" className="mb-2 text-[10px] font-semibold text-gray-400">
                      BƯỚC {WORKFLOW_STEPS.findIndex(s => s.id === activeStep.id) + 1} / {WORKFLOW_STEPS.length}
                    </Badge>
                    <h2 className="text-2xl font-bold text-gray-900">{activeStep.title}</h2>
                    <p className="text-gray-500 mt-1 leading-relaxed">{activeStep.description}</p>
                  </div>
                </div>

                <div className="flex-1 space-y-6">
                  <div>
                    <h4 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wider flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Các thao tác cần làm
                    </h4>
                    <div className="space-y-4">
                      {activeStep.details.map((detail, idx) => (
                        <div key={idx} className="flex gap-4 text-gray-700 bg-gray-50/50 p-4 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
                          <span className={cn("flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shadow-sm", activeStep.bgColor, activeStep.color)}>
                            {idx + 1}
                          </span>
                          <span className="leading-relaxed font-medium mt-0.5">{detail}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {activeStep.tips && (
                    <div className={cn("p-5 rounded-xl border flex gap-4", activeStep.bgColor, activeStep.borderColor)}>
                      <Lightbulb className={cn("h-6 w-6 flex-shrink-0 mt-0.5", activeStep.color)} />
                      <div className="text-sm font-medium text-gray-700 leading-relaxed">
                        <span className={cn("font-bold block mb-1 uppercase text-xs tracking-wider", activeStep.color)}>Mẹo tối ưu: </span>
                        {activeStep.tips}
                      </div>
                    </div>
                  )}
                </div>

                {setActiveTab && (
                  <div className="mt-8 pt-6 border-t flex justify-end">
                    <Button 
                      onClick={() => {
                        setActiveTab(activeStep.tab);
                        onActionComplete?.();
                      }}
                      size="lg"
                      className="w-full sm:w-auto font-semibold gap-2 shadow-md rounded-xl h-12 px-8 bg-primary text-primary-foreground hover:bg-primary/90 transition-all hover:-translate-y-0.5"
                    >
                      Bắt đầu thao tác
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
