import * as React from 'react';
import { Task, Member, Customer } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Clock,
  Package,
  Truck,
  CheckCircle2,
  AlertCircle,
  LayoutGrid,
  CalendarDays,
  DollarSign,
  X,
  ClipboardList,
  Plus,
  MapPin,
  Phone,
  User,
  Hammer
} from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, addDays, parseISO } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { vi } from 'date-fns/locale';
import { cn, getCurrentVNDate } from '@/src/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KanbanBoard } from '@/src/components/kanban/KanbanBoard';
import { useQueryClient } from '@tanstack/react-query';
import { doc, updateDoc, setDoc, db } from '@/src/lib/firebase';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

interface ProductionCalendarProps {
  
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  members: Member[];
  customers: Customer[];
  user?: any;
  currentUser?: any;
}

const STATUS_ICONS: Record<string, any> = {
  consulting: Clock,
  surveying: Clock,
  contracted: Clock,
  production: Package,
  installation: Truck,
  completed: CheckCircle2,
  lost: AlertCircle,
};

const STATUS_COLORS: Record<string, string> = {
  consulting: 'bg-yellow-500/10 text-yellow-600 border-yellow-200',
  surveying: 'bg-purple-500/10 text-purple-600 border-purple-200',
  contracted: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  production: 'bg-blue-500/10 text-blue-600 border-blue-200',
  installation: 'bg-orange-500/10 text-orange-600 border-orange-200',
  completed: 'bg-green-500/10 text-green-600 border-green-200',
  lost: 'bg-red-500/10 text-red-600 border-red-200',
};

const STATUS_LABELS: Record<string, string> = {
  consulting: 'Đã tư vấn',
  surveying: 'Đã đo đạc',
  contracted: 'Đã chốt',
  production: 'Sản xuất',
  installation: 'Lắp đặt',
  completed: 'Hoàn thành',
  lost: 'Tạm dừng',
};

export function ProductionCalendar({  tasks, setTasks, members, customers, user, currentUser }: ProductionCalendarProps) {
  const [currentDate, setCurrentDate] = React.useState(() => getCurrentVNDate());
  const [viewMode, setViewMode] = React.useState<'1d' | '7d' | '30d'>('30d');
  const [selectedDay, setSelectedDay] = React.useState<Date | null>(null);

  const isTopManager = (user && (user.email === 'nhoanhkoem01@gmail.com' || user.email === 'haanhtran.cv02@gmail.com')) || 
    (currentUser?.role?.toLowerCase().includes('giám đốc')) || 
    (currentUser?.role?.toLowerCase().includes('quản lý tổng')) ||
    (currentUser?.role?.toLowerCase().includes('quản lý')) ||
    (currentUser?.permissions?.viewPrice === true);

  const canViewPrice = isTopManager;

  const { startDate, endDate } = React.useMemo(() => {
    if (viewMode === '1d') {
      return { startDate: currentDate, endDate: currentDate };
    } else if (viewMode === '7d') {
      return { startDate: currentDate, endDate: addDays(currentDate, 6) };
    } else {
      const monthStart = startOfMonth(currentDate);
      return { 
        startDate: startOfWeek(monthStart, { weekStartsOn: 1 }), 
        endDate: endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 }) 
      };
    }
  }, [currentDate, viewMode]);

  const monthStart = startOfMonth(currentDate);
  const dateFormat = 'd';

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const nextInterval = () => {
    if(viewMode === '1d') setCurrentDate(addDays(currentDate, 1));
    else if(viewMode === '7d') setCurrentDate(addDays(currentDate, 7));
    else setCurrentDate(addMonths(currentDate, 1));
  };
  const prevInterval = () => {
    if(viewMode === '1d') setCurrentDate(addDays(currentDate, -1));
    else if(viewMode === '7d') setCurrentDate(addDays(currentDate, -7));
    else setCurrentDate(subMonths(currentDate, 1));
  };

  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = React.useState(false);
  const [formData, setFormData] = React.useState({
    id: '',
    customerId: '',
    customerName: '',
    phone: '',
    address: '',
    date: new Date().toISOString().slice(0, 16),
    assigneeId: '',
    notes: ''
  });

  const productionTasks = tasks.filter(t => t.type === 'production');

  const productionMembers = React.useMemo(() => {
    return members.filter(m => 
      m.role.toLowerCase().includes('sản xuất') || 
      m.role.toLowerCase().includes('thi công') || 
      m.role.toLowerCase().includes('xưởng') ||
      m.role.toLowerCase().includes('kỹ thuật')
    );
  }, [members]);

  const getTasksForDay = (day: Date) => {
    return tasks.filter(t => 
      t.type === 'production' && 
      t.dueDate && 
      t.dueDate !== '' &&
      isSameDay(parseISO(t.dueDate), day)
    );
  };

  const unscheduledTasksList = React.useMemo(() => {
    return productionTasks.filter(t => 
      t.status !== 'done' && 
      t.status !== 'archived' && 
      (!t.dueDate || t.dueDate === '')
    ).map(t => ({
      id: t.id,
      type: 'task' as const,
      name: t.customerName || t.title.replace(/^sản xuất:\s*/i, '').trim(),
      address: t.address || '',
      phone: t.phone || '',
      rawTask: t,
      rawCustomer: undefined
    }));
  }, [productionTasks]);

  const unscheduledCustomersList = React.useMemo(() => {
    return customers.filter(c => 
      (['contracted', 'production'].includes(c.stage)) && 
      !productionTasks.some(t => {
        if (t.customerId === c.id && t.dueDate && t.dueDate !== '') return true;
        if (t.customerName && t.customerName.toLowerCase() === c.name.toLowerCase() && t.dueDate && t.dueDate !== '') return true;
        return false;
      }) &&
      !unscheduledTasksList.some(t => t.rawTask?.customerId === c.id || (t.rawTask?.customerName && t.rawTask.customerName.toLowerCase() === c.name.toLowerCase()))
    ).map(c => ({
      id: c.id,
      type: 'customer' as const,
      name: c.name,
      address: c.address || '',
      phone: c.phone || '',
      rawTask: undefined,
      rawCustomer: c
    }));
  }, [customers, productionTasks, unscheduledTasksList]);

  const unscheduledProduction = React.useMemo(() => {
    return [...unscheduledTasksList, ...unscheduledCustomersList];
  }, [unscheduledTasksList, unscheduledCustomersList]);

  const handleSaveSchedule = async () => {
    if (!formData.customerName || formData.customerName.trim() === '') {
      toast.error('Vui lòng nhập tên khách hàng');
      return;
    }
    if (!formData.date || formData.date.trim() === '') {
      toast.error('Vui lòng nhập ngày sản xuất');
      return;
    }

    try {
      let taskId = formData.id;
      const dueDateIso = new Date(formData.date).toISOString();

      if (taskId) {
        // Update existing task
        const taskRef = doc(db, 'tasks', taskId);
        await updateDoc(taskRef, {
          dueDate: dueDateIso,
          assigneeId: formData.assigneeId || '',
          description: formData.notes || ''
        });
      } else {
        // Create new production task
        taskId = `prod-${formData.customerId || 'manual'}-${Date.now()}`;
        const prodTask = {
          id: taskId,
          title: `sản xuất: ${formData.customerName}`,
          description: formData.notes || '',
          status: 'todo',
          priority: 'medium',
          assigneeId: formData.assigneeId || '',
          dueDate: dueDateIso,
          createdAt: new Date().toISOString(),
          type: 'production',
          customerId: formData.customerId || '',
          customerName: formData.customerName,
          phone: formData.phone || '',
          address: formData.address || ''
        };
        await setDoc(doc(db, 'tasks', taskId), prodTask);
      }

      // Automatically update customer stage to 'production' if currently 'contracted'
      if (formData.customerId) {
        const customer = customers.find(c => c.id === formData.customerId);
        if (customer && customer.stage === 'contracted') {
          const customerRef = doc(db, 'customers', formData.customerId);
          await updateDoc(customerRef, { stage: 'production' });
          toast.info('Đã tự động chuyển trạng thái khách hàng sang: Sản xuất');
        }
      }

      toast.success('Đã xếp lịch sản xuất thành công');
      setIsOpen(false);
      setFormData({
        id: '',
        customerId: '',
        customerName: '',
        phone: '',
        address: '',
        date: new Date().toISOString().slice(0, 16),
        assigneeId: '',
        notes: ''
      });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    } catch (error) {
      console.error('Lỗi khi xếp lịch sản xuất:', error);
      toast.error('Có lỗi xảy ra khi xếp lịch');
    }
  };

  const getCustomersForDay = (day: Date) => {
    return customers.filter(customer => {
      const isValidStage = ['contracted', 'production', 'installation', 'completed'].includes(customer.stage);
      if (!isValidStage) return false;
      const customerDate = new Date(customer.createdAt);
      return isSameDay(customerDate, day);
    });
  };

  // Map orders to tasks for display in the progress board if they don't have a production task yet
  // This ensures the user sees all "công trình" as requested
  const virtualProductionTasks: Task[] = React.useMemo(() => {
    const existingTitles = new Set(productionTasks.map(t => t.title.toLowerCase()));
    
    const derivedTasks: Task[] = customers
      .filter(customer => 
        (customer.stage === 'production' || customer.stage === 'installation' || customer.stage === 'completed') &&
        !existingTitles.has(`sản xuất: ${customer.name.toLowerCase()}`) && 
        !existingTitles.has(customer.name.toLowerCase())
      )
      .map(customer => ({
        id: `virtual-${customer.id}`,
        title: customer.name,
        description: customer.notes || '',
        status: customer.stage === 'completed' ? 'done' : 
                customer.stage === 'installation' ? 'waiting_install' :
                customer.stage === 'production' ? 'todo' : 'in-progress',
        type: 'production',
        priority: 'medium',
        assigneeId: '',
        createdAt: customer.createdAt,
        dueDate: customer.createdAt,
      } as Task));
      
    return [...productionTasks, ...derivedTasks];
  }, [productionTasks, customers]);

  return (
    <div className="space-y-3 max-w-[1600px] mx-auto px-2">
      {/* Header Section */}
      <div className="flex flex-col space-y-0.5 px-2">
        <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight">
          Quản lý Sản Xuất
        </h1>
        <p className="text-muted-foreground text-xs font-medium">Lập kế hoạch và theo dõi tiến độ thi công thực tế.</p>
      </div>

      {/* Summary Cards Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 px-2">
        <Card className="rounded-xl border bg-card hover:shadow-md transition-all">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Đang sx</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="flex items-center justify-between">
              <div className="text-2xl font-extrabold text-blue-600">
                {customers.filter(c => c.stage === 'production').length}
              </div>
              <Package className="h-5 w-5 text-blue-600/30" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Đơn hàng đang tại cơ sở</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border bg-card hover:shadow-md transition-all">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Chờ lắp tháng này</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="flex items-center justify-between">
              <div className="text-2xl font-extrabold text-purple-600">
                {
                  tasks.filter(t => {
                    if (t.type !== 'production' || t.status !== 'waiting_install' || !t.waiting_install_at) return false;
                    const date = new Date(t.waiting_install_at);
                    return date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear();
                  }).length
                }
              </div>
              <Truck className="h-5 w-5 text-purple-600/30" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Đã hoàn thiện, chờ lắp</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border bg-card hover:shadow-md transition-all">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Hoàn thành tháng này</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="flex items-center justify-between">
              <div className="text-2xl font-extrabold text-green-600">
                {
                  customers.filter(c => {
                    if (c.stage !== 'completed') return false;
                    const date = new Date(c.createdAt);
                    return date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear();
                  }).length + 
                  tasks.filter(t => {
                    if (t.type !== 'production' || t.status !== 'done' || !t.completedAt) return false;
                    const date = new Date(t.completedAt);
                    return date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear();
                  }).length
                }
              </div>
              <CheckCircle2 className="h-5 w-5 text-green-600/30" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Đã bàn giao thành công</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="calendar" className="w-full flex-grow flex flex-col mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 px-2 mb-2">
          <TabsList className="bg-gray-100 p-0.5 rounded-lg w-full sm:w-auto h-9">
            <TabsTrigger value="calendar" className="rounded-md gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm w-full sm:w-auto text-xs h-8">
              <CalendarDays className="h-3.5 w-3.5" />
              Lịch
            </TabsTrigger>
            <TabsTrigger value="progress" className="rounded-md gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm w-full sm:w-auto text-xs h-8">
              <LayoutGrid className="h-3.5 w-3.5" />
              Tiến độ
            </TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-1 bg-card text-card-foreground p-0.5 rounded-lg border border-border shadow-sm h-8">
            <Select value={viewMode} onValueChange={(v: '1d' | '7d' | '30d') => setViewMode(v)}>
              <SelectTrigger className="h-7 w-[70px] text-[10px] border-none px-1">
                <SelectValue placeholder="Chế độ" />
              </SelectTrigger>
              <SelectContent
                className="z-50 bg-card text-card-foreground dark:bg-zinc-900 opacity-100 border shadow-xl backdrop-blur-none rounded-xl"
              >
                <SelectItem value="1d">1 Ngày</SelectItem>
                <SelectItem value="7d">7 Ngày</SelectItem>
                <SelectItem value="30d">30 Ngày</SelectItem>
              </SelectContent>
            </Select>

            <Button type="button" variant="ghost" size="icon" onClick={prevInterval} className="rounded-md h-7 w-7 shrink-0">
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <div className="font-bold text-[10px] min-w-[70px] text-center capitalize shrink-0">
              {format(currentDate, 'MMM yyyy', { locale: vi })}
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={nextInterval} className="rounded-md h-7 w-7 shrink-0">
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <TabsContent value="calendar" className="flex-grow flex flex-col outline-none mt-0">
          <div className="flex flex-col lg:flex-row gap-4 min-h-0 flex-1">
            {/* Left Column: Calendar */}
            <Card className="flex-grow border shadow-sm bg-card overflow-hidden rounded-xl flex flex-col min-h-[400px]">
              <div className="flex-grow flex flex-col">
                <div className="w-full flex-grow flex flex-col">
                  <div className="overflow-x-auto">
                    <div className={cn("grid", viewMode === '1d' ? 'grid-cols-1' : 'grid-cols-7', "border-b border-border bg-gray-50 dark:bg-zinc-900 min-w-[700px]")}>
                      {viewMode !== '1d' && ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'].map((day) => (
                        <div key={day} className="py-2 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                          {day}
                        </div>
                      ))}
                      {viewMode === '1d' && <div className="py-2 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{format(currentDate, 'EEEE', { locale: vi })}</div>}
                    </div>
                    <div className="grid grid-cols-7 min-w-[700px] auto-rows-[minmax(100px,1fr)]">
                      {calendarDays.map((day, i) => {
                        const dayTasks = getTasksForDay(day);
                        const isToday = isSameDay(day, getCurrentVNDate());

                        return (
                          <div 
                            key={day.toString()} 
                            className={cn(
                              "min-h-[100px] p-2 border-b border-r transition-colors hover:bg-gray-50 dark:hover:bg-zinc-850 group relative flex flex-col cursor-pointer",
                              !isSameMonth(day, monthStart) ? "bg-gray-100/50 text-muted-foreground dark:bg-zinc-900/40" : "bg-card text-card-foreground",
                              (i + 1) % 7 === 0 && "border-r-0"
                            )}
                            onClick={() => setSelectedDay(day)}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <span className={cn(
                                "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full transition-all",
                                isToday ? "bg-primary text-primary-foreground shadow-sm" : ""
                              )}>
                                {format(day, dateFormat)}
                              </span>
                            </div>
                            
                            <div className="flex-1 overflow-hidden flex flex-col space-y-1">
                              {dayTasks.slice(0, 3).map((task) => {
                                const customer = customers.find(c => c.id === task.customerId || c.name.toLowerCase() === (task.customerName || '').toLowerCase());
                                const stage = customer?.stage || 'production';
                                const StatusIcon = STATUS_ICONS[stage];
                                return (
                                  <div 
                                    key={task.id}
                                    className={cn(
                                      "text-xs px-2 py-1 rounded truncate border shadow-sm",
                                      STATUS_COLORS[stage]
                                    )}
                                    title={`${task.customerName || task.title} - ${task.address || ''}`}
                                  >
                                    <div className="flex items-center gap-1">
                                      <StatusIcon className="h-3 w-3 shrink-0" />
                                      <span className="font-bold uppercase tracking-tighter truncate">
                                        {customer?.code || customer?.name || task.customerName || task.title}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                              {dayTasks.length > 3 && (
                                <div className="text-xs text-muted-foreground text-center font-medium py-1">
                                  + {dayTasks.length - 3} lịch
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Right Column: Unscheduled production list */}
            <Card className="w-full lg:w-[350px] flex flex-col border border-gray-200 dark:border-zinc-800 rounded-2xl bg-card overflow-hidden shadow-sm shrink-0">
              <CardHeader className="p-4 border-b bg-gray-50 dark:bg-zinc-900 shrink-0">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <ClipboardList className="h-4.5 w-4.5 text-primary" />
                  Chờ xếp lịch sản xuất
                  {unscheduledProduction.length > 0 && (
                    <Badge variant="destructive" className="ml-auto text-[10px] px-1.5 py-0">
                      {unscheduledProduction.length}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-[10px]">
                  Danh sách đơn hàng chưa được xếp ngày sản xuất
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 flex-1 overflow-y-auto">
                {unscheduledProduction.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                    <Package className="h-10 w-10 text-muted-foreground/30 mb-2" />
                    <p className="text-xs font-semibold">Tất cả việc đã xếp lịch</p>
                    <p className="text-[10px] text-muted-foreground/75 max-w-[200px] mt-1">Không có đơn hàng nào đang chờ xếp lịch sản xuất.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {unscheduledProduction.map((item) => (
                      <Card key={item.id} className="p-3 bg-secondary/20 hover:bg-secondary/40 border transition-all duration-200 rounded-xl relative group">
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-start">
                            <span className="text-[10px] font-bold text-primary truncate max-w-[150px]">
                              {item.name}
                            </span>
                            <Badge className="text-[8px] scale-90 px-1 py-0 bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 shadow-none">
                              Chờ SX
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{item.address || 'Chưa cập nhật địa chỉ'}</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                            <Phone className="h-3 w-3 shrink-0" />
                            <span>{item.phone || 'Chưa cập nhật SĐT'}</span>
                          </p>
                          
                          <div className="pt-2 flex justify-between items-center border-t border-border mt-2">
                            <span className="text-[9px] text-muted-foreground">Cần xếp lịch sớm</span>
                            <Button 
                              onClick={() => {
                                if (item.type === 'task') {
                                  const task = item.rawTask!;
                                  setFormData({
                                    id: task.id,
                                    customerId: task.customerId || '',
                                    customerName: task.customerName || task.title,
                                    phone: task.phone || '',
                                    address: task.address || '',
                                    date: new Date().toISOString().slice(0, 16),
                                    assigneeId: task.assigneeId || '',
                                    notes: task.description || ''
                                  });
                                } else {
                                  const customer = item.rawCustomer!;
                                  setFormData({
                                    id: '',
                                    customerId: customer.id,
                                    customerName: customer.name,
                                    phone: customer.phone || '',
                                    address: customer.address || '',
                                    date: new Date().toISOString().slice(0, 16),
                                    assigneeId: '',
                                    notes: ''
                                  });
                                }
                                setIsOpen(true);
                              }}
                              size="sm" 
                              className="h-6 text-[10px] px-2 rounded-lg bg-primary hover:bg-primary/90 font-semibold text-white"
                            >
                              Xếp lịch
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="progress" className="outline-none">
          <KanbanBoard 
            tasks={virtualProductionTasks} 
            setTasks={setTasks} 
            members={members} 
            customers={customers}
            type="production" 
            user={user} 
            currentUser={currentUser}
          />
        </TabsContent>
      </Tabs>

      <AnimatePresence>
        {selectedDay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedDay(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card text-card-foreground rounded-2xl shadow-xl w-full max-w-lg p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">
                  Chi tiết ngày {format(selectedDay, 'dd/MM/yyyy', { locale: vi })}
                </h3>
                <Button variant="ghost" size="icon" onClick={() => setSelectedDay(null)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {getTasksForDay(selectedDay).length === 0 ? (
                  <p className="text-muted-foreground text-sm italic">Không có lịch sản xuất nào.</p>
                ) : (
                  getTasksForDay(selectedDay).map(task => {
                    const customer = customers.find(c => c.id === task.customerId || c.name.toLowerCase() === (task.customerName || '').toLowerCase());
                    const stage = customer?.stage || 'production';
                    const assignee = members.find(m => m.id === task.assigneeId);
                    return (
                      <div key={task.id} className="p-3 border rounded-lg flex items-center justify-between hover:bg-secondary/10">
                        <div>
                          <p className="font-bold text-sm">{task.customerName || task.title}</p>
                          {task.address && <p className="text-xs text-muted-foreground mt-0.5">Địa chỉ: {task.address}</p>}
                          {task.phone && <p className="text-xs text-muted-foreground">SĐT: {task.phone}</p>}
                          {assignee && <p className="text-xs text-muted-foreground">Phụ trách: {assignee.name}</p>}
                          {task.description && <p className="text-xs text-muted-foreground italic mt-1">Ghi chú: {task.description}</p>}
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <Badge className={cn(STATUS_COLORS[stage])}>
                            {STATUS_LABELS[stage]}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px] px-2 rounded-lg"
                            onClick={() => {
                              setFormData({
                                id: task.id,
                                customerId: task.customerId || '',
                                customerName: task.customerName || task.title,
                                phone: task.phone || '',
                                address: task.address || '',
                                date: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
                                assigneeId: task.assigneeId || '',
                                notes: task.description || ''
                              });
                              setIsOpen(true);
                              setSelectedDay(null);
                            }}
                          >
                            Đổi lịch
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hammer className="h-5 w-5 text-primary" />
              {formData.id ? 'Cập Nhật Lịch Sản Xuất' : 'Xếp Lịch Sản Xuất'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Vui lòng điền thông tin ngày sản xuất và phân công phụ trách.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-1">
              <Label htmlFor="customerName" className="text-xs font-semibold">Tên Khách Hàng / Công Trình</Label>
              <Input
                id="customerName"
                value={formData.customerName}
                onChange={e => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                placeholder="Nhập tên khách hàng"
                className="h-9 rounded-lg"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="phone" className="text-xs font-semibold">Số Điện Thoại</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="Nhập số điện thoại"
                  className="h-9 rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="date" className="text-xs font-semibold">Ngày Sản Xuất</Label>
                <Input
                  id="date"
                  type="datetime-local"
                  value={formData.date}
                  onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="h-9 rounded-lg"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="address" className="text-xs font-semibold">Địa Chỉ Công Trình</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Nhập địa chỉ công trình"
                className="h-9 rounded-lg"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Tổ Trưởng Sản Xuất / Người Phụ Trách</Label>
              <Select
                value={formData.assigneeId || 'none'}
                onValueChange={val => setFormData(prev => ({ ...prev, assigneeId: val === 'none' ? '' : val }))}
              >
                <SelectTrigger className="h-9 rounded-lg bg-background">
                  <SelectValue placeholder="Chọn người phụ trách" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-card text-card-foreground dark:bg-zinc-900 border rounded-xl shadow-xl">
                  <SelectItem value="none">-- Chưa phân công --</SelectItem>
                  {productionMembers.map(member => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name} ({member.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="notes" className="text-xs font-semibold">Ghi Chú Sản Xuất</Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Nhập ghi chú (nếu có)"
                className="h-9 rounded-lg"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button variant="outline" onClick={() => setIsOpen(false)} className="h-9 rounded-lg">
              Hủy
            </Button>
            <Button onClick={handleSaveSchedule} className="h-9 rounded-lg text-white bg-primary">
              Lưu Lịch Hẹn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
