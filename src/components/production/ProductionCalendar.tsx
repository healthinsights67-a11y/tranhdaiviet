import * as React from 'react';
import { Task, Member, Customer } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  X
} from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, addDays } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { vi } from 'date-fns/locale';
import { cn, getCurrentVNDate } from '@/src/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KanbanBoard } from '@/src/components/kanban/KanbanBoard';

interface ProductionCalendarProps {
  
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  members: Member[];
  customers: Customer[];
  user?: any;
  currentUser?: any;
}

const STATUS_ICONS: Record<string, any> = {
  pending: Clock,
  processing: Package,
  shipping: Truck,
  completed: CheckCircle2,
  cancelled: AlertCircle,
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-200',
  processing: 'bg-blue-500/10 text-blue-600 border-blue-200',
  shipping: 'bg-purple-500/10 text-purple-600 border-purple-200',
  completed: 'bg-green-500/10 text-green-600 border-green-200',
  cancelled: 'bg-red-500/10 text-red-600 border-red-200',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ xử lý',
  processing: 'Đang sản xuất',
  shipping: 'Đang vận chuyển',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
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

  const getCustomersForDay = (day: Date) => {
    return customers.filter(customer => {
      const customerDate = new Date(customer.createdAt);
      return isSameDay(customerDate, day);
    });
  };

  const productionTasks = tasks.filter(t => t.type === 'production');
  
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
          <Card className="border shadow-sm bg-card overflow-hidden rounded-xl flex-grow flex flex-col">
            <div className="flex-grow flex flex-col">
              <div className="w-full flex-grow flex flex-col">
                <div className="overflow-x-auto">
                  <div className={cn("grid", viewMode === '1d' ? 'grid-cols-1' : 'grid-cols-7', "border-b border-border bg-gray-50 min-w-[700px]")}>
                    {viewMode !== '1d' && ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'].map((day) => (
                      <div key={day} className="py-2 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                        {day}
                      </div>
                    ))}
                    {viewMode === '1d' && <div className="py-2 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{format(currentDate, 'EEEE', { locale: vi })}</div>}
                  </div>
                  <div className="grid grid-cols-7 min-w-[700px] auto-rows-[minmax(100px,1fr)]">
                    {calendarDays.map((day, i) => {
                      const dayCustomers = getCustomersForDay(day);
                      const isToday = isSameDay(day, getCurrentVNDate());

                      return (
                        <div 
                          key={day.toString()} 
                          className={cn(
                            "min-h-[100px] p-2 border-b border-r transition-colors hover:bg-gray-50 group relative flex flex-col cursor-pointer",
                            !isSameMonth(day, monthStart) ? "bg-gray-100 text-muted-foreground" : "bg-card text-card-foreground text-card-foreground",
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
                            {dayCustomers.slice(0, 3).map((customer) => {
                              const StatusIcon = STATUS_ICONS[customer.stage];
                              return (
                                <div 
                                  key={customer.id}
                                  className={cn(
                                    "text-xs px-2 py-1 rounded truncate border shadow-sm",
                                    STATUS_COLORS[customer.stage]
                                  )}
                                  title={customer.name}
                                >
                                  <div className="flex items-center gap-1">
                                          <StatusIcon className="h-3 w-3 shrink-0" />
                                          <span className="font-bold uppercase tracking-tighter truncate">{customers.find(c => c.name === customer.name)?.code || customer.id}</span>
                                  </div>
                                </div>
                              );
                            })}
                            {dayCustomers.length > 3 && (
                              <div className="text-xs text-muted-foreground text-center font-medium py-1">
                                + {dayCustomers.length - 3} đơn
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
                {getCustomersForDay(selectedDay).length === 0 ? (
                  <p className="text-muted-foreground text-sm italic">Không có đơn hàng nào.</p>
                ) : (
                  getCustomersForDay(selectedDay).map(customer => (
                    <div key={customer.id} className="p-3 border rounded-lg flex items-center justify-between">
                      <div>
                        <p className="font-bold">{customer.name}</p>
                        <p className="text-xs text-muted-foreground">{customer.notes}</p>
                      </div>
                      <Badge className={cn(STATUS_COLORS[customer.stage])}>
                        {STATUS_LABELS[customer.stage]}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
