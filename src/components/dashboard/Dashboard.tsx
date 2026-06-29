import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MOCK_TASKS, MOCK_MEMBERS } from '../../lib/mockData';
import { CheckCircle2, Clock, AlertCircle, Users, Mail, Calendar, FileText, ChevronRight, Archive, ChevronLeft, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { cn, getCurrentVNMonth, getCurrentVNYear, formatVNTime, getVNMonth } from '@/src/lib/utils';
import { Button } from '@/components/ui/button';
import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";


const COLORS = ['#0ea5e9', '#f59e0b', '#8b5cf6', '#10b981'];

import { CreditCard, DollarSign, Package, Bell, Megaphone } from 'lucide-react';
import { notifyCurrentUser, handleRequestNotification, notifyCustomMembers, TargetGroup } from '@/src/services/notificationService';
import { clearAllAppData } from '@/src/services/dataService';
import { db, collection, addDoc } from '@/src/lib/firebase';
import { SmartInsights } from './SmartInsights';
export function Dashboard({ tasks, members, customers, quotations, currentUser, schedules, installations, setActiveTab }: { tasks: any[], members: any[], customers?: any[], quotations?: any[], currentUser?: any, schedules?: any[], installations?: any[], setActiveTab?: (tab: string) => void }) {
  const activeTasks = (tasks && tasks.length > 0) ? tasks : MOCK_TASKS;
  const activeMembers = (members && members.length > 0) ? members : MOCK_MEMBERS;
  const activeCustomers = customers || [];
  const [selectedMonth, setSelectedMonth] = React.useState<string>(''); // Default to all time
  const [pickerYear, setPickerYear] = React.useState<number>(getCurrentVNYear());
  const [announcementText, setAnnouncementText] = React.useState('');
  const [announcementTarget, setAnnouncementTarget] = React.useState<TargetGroup>('all');
  const [isSendingAnnouncement, setIsSendingAnnouncement] = React.useState(false);
  const [isAnnouncementOpen, setIsAnnouncementOpen] = React.useState(false);
  const [hasShownAlerts, setHasShownAlerts] = React.useState(false);

  const isManager = !!currentUser?.role?.toLowerCase()?.includes('quản lý') || currentUser?.role === 'Giám đốc' || currentUser?.role === 'Trợ lý';
  const canViewRevenue = isManager || currentUser?.permissions?.viewRevenue !== false;
  const canViewPrice = isManager || currentUser?.permissions?.viewPrice !== false;

  const matchesTime = (dateStr?: string) => {
    if (!selectedMonth || selectedMonth === 'all') return true;
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const now = new Date();
    if (selectedMonth === 'today') {
      return date.toDateString() === now.toDateString();
    } else if (selectedMonth === 'week') {
      const day = now.getDay() || 7; 
      const firstDay = new Date(now);
      firstDay.setHours(0, 0, 0, 0);
      firstDay.setDate(now.getDate() - day + 1);
      
      const lastDay = new Date(firstDay);
      lastDay.setDate(firstDay.getDate() + 6);
      lastDay.setHours(23, 59, 59, 999);
      return date >= firstDay && date <= lastDay;
    }
    return getVNMonth(dateStr) === selectedMonth;
  };

  const filteredTasks = activeTasks.filter(t => !selectedMonth || (t.createdAt && matchesTime(t.createdAt)) || (t.updatedAt && matchesTime(t.updatedAt)) || (t.completedAt && matchesTime(t.completedAt)) || !t.createdAt);
  const filteredCustomers = activeCustomers.filter(c => !selectedMonth || (c.createdAt && matchesTime(c.createdAt)) || !c.createdAt);
  const activeProjects = filteredCustomers.filter(c => ['contracted', 'production', 'installation', 'completed'].includes(c.stage));
  const filteredQuotations = (quotations || []).filter(q => !selectedMonth || (q.createdAt && matchesTime(q.createdAt)) || !q.createdAt);

  const statusData = [
    { name: 'Cần làm', value: filteredTasks.filter(t => t.status === 'todo').length },
    { name: 'Đang làm', value: filteredTasks.filter(t => t.status === 'in-progress').length },
    { name: 'Đánh giá', value: filteredTasks.filter(t => t.status === 'review').length },
    { name: 'Hoàn thành', value: filteredTasks.filter(t => t.status === 'done').length },
  ];

  const workloadData = activeMembers.map(member => ({
    name: member.name.split(' ').pop(),
    tasks: filteredTasks.filter(t => t.assigneeId === member.id).length
  }));

  // Statistics for completed tasks
  const completedTasks = activeTasks.filter(t => t.status === 'done' && t.completedAt);
  
  // Group by month
  const tasksByMonth = completedTasks.reduce((acc: any, task) => {
    const month = getVNMonth(task.completedAt) || task.completedAt.substring(0, 7);
    if (!acc[month]) acc[month] = [];
    acc[month].push(task);
    return acc;
  }, {});

  const availableMonths = Object.keys(tasksByMonth).sort((a, b) => b.localeCompare(a));
  const currentMonthTasks = tasksByMonth[selectedMonth] || [];

  // Assignee stats for selected month
  const assigneeStats = activeMembers.map(member => {
    const memberCompletedTasks = currentMonthTasks.filter((t: any) => t.assigneeId === member.id);
    return {
      name: member.name,
      avatar: member.avatar,
      role: member.role,
      count: memberCompletedTasks.length,
      tasks: memberCompletedTasks
    };
  }).sort((a, b) => b.count - a.count);

  const actualRevenue = filteredCustomers.reduce((sum, c) => {
    if (c.stage === 'completed') {
      return sum + (c.orderValue || 0);
    }
    if (['contracted', 'production', 'installation'].includes(c.stage)) {
      const q = (quotations || []).find(q => q.customerId === c.id || (q.customerName === c.name && q.phone === c.phone));
      const deposit = (q?.status === 'deposit' || q?.depositAmount) ? (q.depositAmount || 0) : 0;
      return sum + deposit;
    }
    return sum;
  }, 0);

  const expectedRevenue = filteredCustomers.reduce((sum, c) => {
    if (['contracted', 'production', 'installation', 'completed'].includes(c.stage)) {
      return sum + (c.orderValue || 0);
    }
    return sum;
  }, 0);

  const stats = [
    { label: 'Tổng nhiệm vụ', value: filteredTasks.length, icon: CheckCircle2, color: 'text-blue-500' },
    { label: 'Đang thực hiện', value: filteredTasks.filter(t => t.status === 'in-progress').length, icon: Clock, color: 'text-amber-500' },
    { label: 'Đã hoàn thành', value: filteredTasks.filter(t => t.status === 'done').length, icon: CheckCircle2, color: 'text-green-500' },
    { label: 'Thành viên', value: activeMembers.length, icon: Users, color: 'text-purple-500' },
  ];

  const financialStats = [
    { label: 'Doanh thu thực tế', value: canViewRevenue ? `${(actualRevenue / 1000000).toFixed(1)}M` : '*** ₫', icon: DollarSign, color: 'text-emerald-600' },
    { label: 'Doanh thu dự kiến', value: canViewRevenue ? `${(expectedRevenue / 1000000).toFixed(1)}M` : '*** ₫', icon: CreditCard, color: 'text-yellow-600' },
    { label: 'Dự án triển khai', value: activeProjects.length, icon: Package, color: 'text-indigo-500' },
    { label: 'Khách hàng', value: filteredCustomers.length, icon: Users, color: 'text-blue-500' },
  ];

  const todayDate = new Date();
  todayDate.setHours(0,0,0,0);
  const isToday = (dateStr?: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    d.setHours(0,0,0,0);
    return d.getTime() === todayDate.getTime();
  };

  const todaySchedules = (schedules || []).filter(s => isToday(s.date) || isToday(s.dateStr));
  const todayInstallations = (installations || []).filter(i => isToday(i.date) || isToday(i.dateStr));
  const todayTasks = filteredTasks.filter(t => t.dueDate && isToday(t.dueDate) && t.status !== 'done');
  const overdueTasks = filteredTasks.filter(t => t.dueDate && new Date(t.dueDate).getTime() < todayDate.getTime() && t.status !== 'done');
  
  // Tìm các khách hàng chưa được lên lịch đo đạc (phục vụ cảnh báo bỏ sót)
  const unscheduledMeasurements = React.useMemo(() => {
    const isManager = ['quản lý', 'giám đốc', 'chủ sở hữu'].some(role => 
      currentUser?.role?.toLowerCase()?.includes(role)
    ) || !!currentUser?.permissions?.menuMeasurement;

    return activeCustomers.filter(c => {
      // Chỉ kiểm tra khách hàng ở trạng thái 'consulting' (Đang tư vấn) hoặc 'contracted' (Chốt cọc)
      const matchesStage = c.stage === 'consulting' || c.stage === 'contracted';
      if (!matchesStage) return false;

      // Phân quyền: Sale chỉ xem của mình, Quản lý xem toàn bộ
      const isOwner = isManager || c.assignedSaleId === currentUser?.id;
      if (!isOwner) return false;

      // Kiểm tra xem đã có lịch đo đạc nào chưa (bỏ qua lịch đã bị hủy)
      const hasSchedule = (schedules || []).some(s => {
        if (s.status === 'cancelled') return false;
        if (s.customerId === c.id) return true;
        if (s.customerName && s.customerName.toLowerCase() === c.name.toLowerCase()) return true;
        return false;
      });

      return !hasSchedule;
    });
  }, [activeCustomers, schedules, currentUser]);

  const hasTodayItems = todaySchedules.length > 0 || todayInstallations.length > 0 || todayTasks.length > 0;

  React.useEffect(() => {
    if (!currentUser?.id || hasShownAlerts) return;

    const generateSmartAlerts = async () => {
      const todayStr = todayDate.toDateString();
      const storageKey = `smart_alerts_gen_${currentUser.id}`;
      
      if (localStorage.getItem(storageKey) === todayStr) {
        setHasShownAlerts(true);
        return; // Already generated today
      }

      let generated = false;

      if (todaySchedules.length > 0) {
        toast.info(`Bạn có ${todaySchedules.length} lịch đo đạc/khảo sát trong ngày hôm nay!`, { duration: 5000 });
        await addDoc(collection(db, 'notifications'), {
          title: 'Lịch khảo sát/đo đạc hôm nay',
          message: `Bạn có ${todaySchedules.length} lịch đo đạc/khảo sát cần thực hiện trong ngày hôm nay!`,
          type: 'smart_alert',
          createdAt: new Date().toISOString(),
          readBy: [],
          isGlobal: false,
          userId: currentUser.id
        });
        generated = true;
      }
      if (todayInstallations.length > 0) {
        toast.info(`Bạn có ${todayInstallations.length} lịch lắp đặt trong ngày hôm nay!`, { duration: 5000 });
        await addDoc(collection(db, 'notifications'), {
          title: 'Lịch lắp đặt hôm nay',
          message: `Bạn có ${todayInstallations.length} lịch lắp đặt cần thực hiện trong ngày hôm nay!`,
          type: 'smart_alert',
          createdAt: new Date().toISOString(),
          readBy: [],
          isGlobal: false,
          userId: currentUser.id
        });
        generated = true;
      }
      if (overdueTasks.length > 0) {
        toast.error(`Cảnh báo: Bạn đang có ${overdueTasks.length} nhiệm vụ bị trễ hạn!`, { duration: 8000 });
        await addDoc(collection(db, 'notifications'), {
          title: 'Nhiệm vụ trễ hạn',
          message: `Cảnh báo: Bạn đang có ${overdueTasks.length} nhiệm vụ đã bị trễ hạn! Vui lòng kiểm tra và xử lý ngay.`,
          type: 'smart_alert',
          createdAt: new Date().toISOString(),
          readBy: [],
          isGlobal: false,
          userId: currentUser.id
        });
        generated = true;
      }
      
      if (unscheduledMeasurements.length > 0) {
        toast.warning(`Bạn đang có ${unscheduledMeasurements.length} khách hàng chưa được lên lịch đo đạc!`, { duration: 8000 });
        await addDoc(collection(db, 'notifications'), {
          title: 'Bỏ sót lịch đo đạc',
          message: `Cảnh báo: Bạn đang có ${unscheduledMeasurements.length} khách hàng trong giai đoạn Tư vấn/Chốt cọc chưa được xếp lịch đo đạc. Vui lòng kiểm tra ngay.`,
          type: 'smart_alert',
          createdAt: new Date().toISOString(),
          readBy: [],
          isGlobal: false,
          userId: currentUser.id
        });
        generated = true;
      }
      
      if (generated) {
        localStorage.setItem(storageKey, todayStr);
      }
      setHasShownAlerts(true);
    };

    generateSmartAlerts();
  }, [hasShownAlerts, todaySchedules.length, todayInstallations.length, overdueTasks.length, unscheduledMeasurements.length, currentUser?.id]);

  return (
    <div className="space-y-3 md:space-y-8 max-w-[1600px] mx-auto pb-16 px-0.5">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-2.5">
        <div className="space-y-0 text-center md:text-left flex items-center gap-4">
          <div>
            <h1 className="text-lg md:text-3xl lg:text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/60 leading-tight">
              {selectedMonth ? `Tháng ${selectedMonth.split('-')[1]}/${selectedMonth.split('-')[0]}` : 'Tổng quan'}
            </h1>
            <p className="text-muted-foreground text-[8px] md:text-sm font-medium">Hiệu suất vận hành.</p>
          </div>
          <Popover>
            <PopoverTrigger className="inline-flex items-center justify-between w-[180px] h-9 text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground px-4 py-2 rounded-md ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              {selectedMonth === 'today' ? 'Hôm nay' : selectedMonth === 'week' ? 'Tuần này' : selectedMonth ? `Tháng ${selectedMonth.split('-')[1]} năm ${selectedMonth.split('-')[0]}` : "Chọn thời gian"}
              <Calendar className="mr-2 h-4 w-4 opacity-50" />
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-2" align="start">
              <div className="flex items-center justify-between bg-gray-100 rounded-md p-1 mb-2">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPickerYear(y => y - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-semibold">{pickerYear}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPickerYear(y => y + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 12 }).map((_, i) => {
                  const m = String(i + 1).padStart(2, '0');
                  const val = `${pickerYear}-${m}`;
                  const isSelected = selectedMonth === val;
                  return (
                    <Button
                      key={m}
                      variant={isSelected ? "default" : "ghost"}
                      className={cn("h-9 w-full text-xs", isSelected && "bg-blue-600 hover:bg-blue-700 text-white")}
                      onClick={() => setSelectedMonth(val)}
                    >
                      Thg{i + 1}
                    </Button>
                  );
                })}
              </div>
              <div className="flex flex-col gap-2 mt-4 pt-4 border-t">
                <div className="grid grid-cols-2 gap-2">
                   <Button variant={selectedMonth === 'today' ? 'default' : 'outline'} size="sm" className="text-[10px] h-7 font-bold" onClick={() => setSelectedMonth('today')}>Hôm nay</Button>
                   <Button variant={selectedMonth === 'week' ? 'default' : 'outline'} size="sm" className="text-[10px] h-7 font-bold" onClick={() => setSelectedMonth('week')}>Tuần này</Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="text-[10px] h-7 flex-1 font-bold" onClick={() => { setSelectedMonth(getCurrentVNMonth()); setPickerYear(getCurrentVNYear()); }}>Tháng này</Button>
                  <Button variant="outline" size="sm" className="text-[10px] h-7 flex-1 font-bold" onClick={() => setSelectedMonth('')}>Tất cả</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex flex-wrap items-center justify-center md:justify-end gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="rounded-full h-8 px-4 text-[10px] font-bold border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hidden md:flex items-center gap-1.5"
            onClick={async () => {
              await handleRequestNotification();
              if (Notification.permission === 'granted') {
                 notifyCurrentUser('Thông báo kiểm tra', 'Chúc mừng! Hệ thống thông báo của bạn đã hoạt động tốt.');
              }
            }}
          >
            <Bell className="w-3 h-3" />
            Bật & Kiểm tra thông báo
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden bg-blue-50 text-blue-600 h-8 w-8 rounded-full border border-blue-100"
            onClick={async () => {
              await handleRequestNotification();
              if (Notification.permission === 'granted') {
                 notifyCurrentUser('Thông báo kiểm tra', 'Chúc mừng! Hệ thống thông báo của bạn đã hoạt động tốt.');
              }
            }}
          >
            <Bell className="w-4 h-4" />
          </Button>
          <Tabs defaultValue="overview" className="w-full md:w-[240px]">
             <TabsList className="grid w-full grid-cols-2 rounded-full h-8 p-1 bg-gray-200">
               <TabsTrigger value="overview" className="rounded-full text-[9px] font-bold">Hiện tại</TabsTrigger>
               <TabsTrigger value="archive" className="rounded-full text-[9px] font-bold">Lịch sử</TabsTrigger>
             </TabsList>
          </Tabs>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="hidden">
           <TabsTrigger value="overview">Overview</TabsTrigger>
           <TabsTrigger value="archive">Archive</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-0">
          <div className="grid gap-2 md:gap-4 grid-cols-2 md:grid-cols-4">
            {[...financialStats, ...stats].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="relative overflow-hidden group border border-border shadow-sm bg-card text-card-foreground">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0.5 pt-2 px-2.5">
                    <CardTitle className="text-[8px] md:text-xs font-black uppercase tracking-widest text-muted-foreground/60">{stat.label}</CardTitle>
                    <stat.icon className={cn("h-3 w-3 opacity-50", stat.color)} />
                  </CardHeader>
                  <CardContent className="py-1 pb-2 px-2.5">
                    <div className="text-xl md:text-3xl font-black tracking-tighter tabular-nums leading-none">{stat.value}</div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {unscheduledMeasurements.length > 0 && (
            <Card className="border border-destructive/30 bg-destructive/5 text-destructive-foreground shadow-sm">
              <CardHeader className="p-4 pb-2 flex flex-row items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5 animate-pulse shrink-0" />
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-sm font-bold tracking-tight">Cảnh báo bỏ sót lịch đo đạc</CardTitle>
                  <CardDescription className="text-[10px] text-destructive/80 mt-0.5">
                    {currentUser?.role?.toLowerCase()?.includes('quản lý') || currentUser?.role?.toLowerCase()?.includes('giám đốc') || currentUser?.role?.toLowerCase()?.includes('chủ sở hữu')
                      ? `Phát hiện ${unscheduledMeasurements.length} khách hàng của Sales đang ở trạng thái tư vấn/chốt cọc nhưng chưa được xếp lịch đo đạc.`
                      : `Bạn đang có ${unscheduledMeasurements.length} khách hàng chưa được lên lịch đo đạc. Hãy liên hệ khách hàng để xếp lịch ngay.`}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-1">
                <div className="grid gap-2 md:grid-cols-2 max-h-[220px] overflow-y-auto pr-1">
                  {unscheduledMeasurements.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between p-2.5 bg-card border border-destructive/10 rounded-lg group shadow-sm">
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-bold text-foreground truncate">{c.code} - {c.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          SĐT: {c.phone} | Trạng thái: {c.stage === 'consulting' ? 'Đang tư vấn' : 'Chốt cọc'}
                        </p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        className="h-7 text-[10px] px-3 font-semibold rounded-md shadow-sm shrink-0"
                        onClick={() => setActiveTab && setActiveTab('measurements')}
                      >
                        Xếp lịch đo
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {hasTodayItems && (
            <div className="mb-4">
              <Card className="border-l-4 border-l-blue-500 bg-blue-50/50 shadow-sm border-y border-r border-border overflow-hidden">
                <CardHeader className="py-3 px-4 pb-0 bg-transparent flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-blue-900">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    Việc cần làm hôm nay
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-3 px-4 flex flex-col gap-2">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {todaySchedules.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Lịch đo đạc / Khảo sát</p>
                        {todaySchedules.map((s, i) => (
                          <div key={i} className="bg-white rounded-md p-2 shadow-sm border border-blue-100 flex items-start gap-2">
                            <MapPin className="w-3.5 h-3.5 text-orange-500 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-xs font-bold text-gray-900">{s.customerName}</p>
                              <p className="text-[10px] text-gray-500 line-clamp-1">{s.address || s.addressStr}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {todayInstallations.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Lịch lắp đặt</p>
                        {todayInstallations.map((inst, i) => (
                          <div key={i} className="bg-white rounded-md p-2 shadow-sm border border-blue-100 flex items-start gap-2">
                            <Package className="w-3.5 h-3.5 text-indigo-500 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-xs font-bold text-gray-900">{inst.customerName}</p>
                              <p className="text-[10px] text-gray-500 line-clamp-1">{inst.address || inst.addressStr}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {todayTasks.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Nhiệm vụ đến hạn</p>
                        {todayTasks.map((t, i) => (
                          <div key={i} className="bg-white rounded-md p-2 shadow-sm border border-blue-100 flex items-start gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-xs font-bold text-gray-900">{t.title}</p>
                              <p className="text-[10px] text-gray-500">{t.customerName}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid gap-3 md:gap-6 md:grid-cols-1 lg:grid-cols-12">
            <div className="lg:col-span-3">
              <SmartInsights tasks={filteredTasks} customers={filteredCustomers} quotations={quotations || []} />
            </div>
            <Card className="lg:col-span-5 border border-border shadow-sm bg-card text-card-foreground">
              <CardHeader className="p-3 pb-0">
                <CardTitle className="text-xs md:text-lg font-bold">Phân bổ việc</CardTitle>
              </CardHeader>
              <CardContent className="pl-0 pb-1 w-full min-w-0">
                <div className="h-[300px] mt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={workloadData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis 
                        dataKey="name" 
                        fontSize={9} 
                        tickLine={false} 
                        axisLine={false} 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }}
                      />
                      <YAxis 
                        fontSize={9} 
                        tickLine={false} 
                        axisLine={false} 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }}
                      />
                      <Tooltip 
                        cursor={{ fill: 'hsl(var(--secondary))', opacity: 0.3 }}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          borderColor: 'hsl(var(--border))', 
                          borderRadius: '8px',
                          boxShadow: '0 4px 10px -2px rgb(0 0 0 / 0.1)',
                          fontSize: '9px'
                        }}
                      />
                      <Bar dataKey="tasks" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-4 border border-border shadow-sm bg-card text-card-foreground">
              <CardHeader className="p-4 pb-0">
                <CardTitle className="text-sm md:text-lg font-bold tracking-tight">Trạng thái công việc</CardTitle>
                <CardDescription className="text-[10px]">Phân bổ nhiệm vụ qua các giai đoạn.</CardDescription>
              </CardHeader>
              <CardContent className="p-2 pt-0 h-full w-full min-w-0">
                <div className="h-[300px] flex flex-col items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={6}
                        dataKey="value"
                        stroke="none"
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          borderColor: 'hsl(var(--border))', 
                          borderRadius: '8px',
                          fontSize: '9px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-0">
                    {statusData.map((entry, i) => (
                      <div key={entry.name} className="flex items-center gap-1.5 text-center">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                        <span className="text-[9px] font-semibold text-muted-foreground">{entry.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 md:gap-6 md:grid-cols-2">
            <Card className="border border-border shadow-sm bg-card text-card-foreground">
              <CardHeader className="p-4 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold">Dự án đang triển khai</CardTitle>
                    <CardDescription className="text-[10px]">5 dự án gần nhất.</CardDescription>
                  </div>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="px-2 pb-4">
                <div className="space-y-2">
                  {activeProjects.slice(0, 5).map((project: any) => (
                    <div key={project.id} className="flex items-center justify-between p-3 hover:bg-muted rounded-lg transition-colors border-b border-border last:border-0 cursor-pointer bg-card text-card-foreground">
                       <div>
                         <p className="text-xs font-bold">{project.code || 'KH - [Không xác định]'} - {project.name}</p>
                         <p className="text-[10px] text-muted-foreground mt-0.5">{project.furnitureCategory || 'Sản phẩm'}</p>
                         <p className="text-[10px] font-semibold text-primary mt-0.5">
                           Giá trị: {canViewPrice ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(project.orderValue || 0) : '*** ₫'}
                         </p>
                       </div>
                       <div className="text-right">
                         <Badge variant={project.stage === 'completed' ? 'default' : 'secondary'} className="text-[9px] px-1 py-0 h-4">
                           {project.stage === 'completed' ? 'Hoàn thành' : 
                            project.stage === 'installation' ? 'Lắp đặt' : 
                            project.stage === 'production' ? 'Sản xuất' : 'Chốt Cọc'}
                         </Badge>
                         <p className="text-[10px] font-mono mt-1 font-semibold">{formatVNTime(project.createdAt)}</p>
                       </div>
                    </div>
                  ))}
                  {activeProjects.length === 0 && (
                     <div className="text-center py-6 text-muted-foreground text-xs italic">
                       Chưa có dự án nào
                     </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border shadow-sm bg-card text-card-foreground">
              <CardHeader className="p-4 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold">Khách hàng mới</CardTitle>
                    <CardDescription className="text-[10px]">Danh sách khách hàng gần đây.</CardDescription>
                  </div>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="px-2 pb-4">
                <div className="space-y-2">
                  {filteredCustomers.slice(0, 5).map((customer: any) => (
                    <div key={customer.id} className="flex items-center justify-between p-3 hover:bg-muted rounded-lg transition-colors border-b border-border last:border-0 cursor-pointer bg-card text-card-foreground">
                       <div className="flex items-center gap-3 w-full">
                         <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                           {customer.name.charAt(0)}
                         </div>
                         <div className="flex-1 min-w-0">
                           <div className="flex items-center justify-between">
                             <p className="text-xs font-bold">{customer.name}</p>
                             <Badge variant="outline" className={cn(
                               "text-[8px] uppercase font-bold px-1.5 h-4 border-none",
                               customer.stage === 'consulting' ? 'bg-yellow-500/10 text-yellow-500' :
                               customer.stage === 'surveying' ? 'bg-purple-500/10 text-purple-500' :
                               customer.stage === 'contracted' ? 'bg-green-500/10 text-green-500' :
                               'bg-red-500/10 text-red-500'
                             )}>
                               {customer.stage === 'consulting' ? 'Đã tư vấn' :
                                customer.stage === 'surveying' ? 'Đã đo đạc' :
                                customer.stage === 'contracted' ? 'Chốt Cọc' : 'Tạm dừng'}
                             </Badge>
                           </div>
                           <div className="flex items-center gap-2 mt-0.5">
                             <p className="text-[10px] text-muted-foreground line-clamp-1">{customer.phone}</p>
                             {customer.createdAt && (
                               <>
                                 <span className="text-muted-foreground/30">•</span>
                                 <p className="text-[10px] text-muted-foreground font-mono">
                                   {new Date(customer.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                                 </p>
                               </>
                             )}
                             {customer.furnitureCategory && (
                               <>
                                 <span className="text-muted-foreground/30">•</span>
                                 <p className="text-[10px] text-primary font-medium truncate italic">{customer.furnitureCategory}</p>
                               </>
                             )}
                           </div>
                         </div>
                       </div>
                    </div>
                  ))}
                  {filteredCustomers.length === 0 && (
                     <div className="text-center py-6 text-muted-foreground text-xs italic">
                       Chưa có khách hàng nào
                     </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="archive" className="space-y-8 mt-0">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="md:w-64 space-y-4">
               <h3 className="text-sm font-bold flex items-center gap-2">
                 <Archive className="h-4 w-4 text-primary" />
                 Lịch sử tháng
               </h3>
               <div className="space-y-1">
                 {availableMonths.length > 0 ? (
                   availableMonths.map(month => (
                     <Button
                       key={month}
                       variant={selectedMonth === month ? "secondary" : "ghost"}
                       className={cn("w-full justify-between rounded-xl h-12 text-xs font-medium px-4", 
                         selectedMonth === month ? "bg-primary/10 text-primary hover:bg-primary/20" : "")}
                       onClick={() => setSelectedMonth(month)}
                     >
                       <span>Tháng {month.split('-')[1]}, {month.split('-')[0]}</span>
                       <Badge variant="outline" className="text-[9px] px-1.5">{tasksByMonth[month]?.length || 0}</Badge>
                     </Button>
                   ))
                 ) : (
                   <div className="p-4 text-center border border-dashed rounded-2xl text-[10px] text-muted-foreground italic">
                     Chưa có lịch sử hoàn thành.
                   </div>
                 )}
               </div>
            </div>

            <div className="flex-1 space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                 <Card className="border border-border shadow-sm bg-card text-card-foreground">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-bold">Thống kê theo người phụ trách</CardTitle>
                      <CardDescription className="text-[10px]">Hiệu suất hoàn thành trong tháng được chọn.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {assigneeStats.map(stat => (
                        <div key={stat.name} className="flex items-center gap-3 p-3 rounded-xl bg-muted border border-border hover:bg-card text-card-foreground hover:shadow-sm transition-all group/stat">
                           <Avatar className="h-8 w-8">
                             <AvatarImage src={stat.avatar} />
                             <AvatarFallback>{stat.name.charAt(0)}</AvatarFallback>
                           </Avatar>
                           <div className="flex-1 min-w-0">
                             <p className="text-xs font-bold truncate">{stat.name}</p>
                             <p className="text-[9px] text-muted-foreground truncate">{stat.role}</p>
                           </div>
                           <div className="text-right">
                             <div className="text-sm font-black text-primary tabular-nums">{stat.count}</div>
                             <div className="text-[8px] uppercase font-bold text-muted-foreground">Xong</div>
                           </div>
                        </div>
                      ))}
                      {assigneeStats.length === 0 && (
                        <div className="text-center py-10 text-muted-foreground text-xs italic">
                           Không có dữ liệu hoàn thành cho tháng này.
                        </div>
                      )}
                    </CardContent>
                 </Card>

                 <Card className="border border-border shadow-sm bg-card text-card-foreground overflow-hidden">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-bold">Danh sách công việc đã xong</CardTitle>
                      <CardDescription className="text-[10px]">Chi tiết các nhiệm vụ đã hoàn thành.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                       <ScrollArea className="h-[400px]">
                         <div className="px-6 pb-6 space-y-4">
                           {currentMonthTasks.map((task: any, i: number) => (
                             <div key={task.id} className="group relative pl-4 border-l-2 border-primary/20 hover:border-primary transition-colors py-1">
                               <div className="flex items-center justify-between gap-4">
                                 <h4 className="text-xs font-bold leading-tight group-hover:text-primary transition-colors">{task.title}</h4>
                                 <Badge variant="outline" className="text-[8px] uppercase px-1 h-4 font-mono">{task.type}</Badge>
                               </div>
                               <p className="text-[10px] text-muted-foreground line-clamp-1 mt-1">{task.description}</p>
                               <div className="flex items-center gap-2 mt-2">
                                  <Calendar className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-[10px] font-medium text-muted-foreground">
                                    Xong ngày: {formatVNTime(task.completedAt)}
                                  </span>
                               </div>
                             </div>
                           ))}
                           {currentMonthTasks.length === 0 && (
                             <div className="text-center py-20 text-muted-foreground text-xs italic">
                               Chưa có dữ liệu.
                             </div>
                           )}
                         </div>
                       </ScrollArea>
                    </CardContent>
                 </Card>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="lg:col-span-2 border border-border shadow-sm bg-card text-card-foreground">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold tracking-tight">Đội ngũ của bạn</CardTitle>
                <CardDescription className="text-xs">Thành viên đang tích cực xử lý công việc.</CardDescription>
              </div>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {activeMembers.map((member) => (
                <div key={member.id} className="flex items-center gap-3 p-4 rounded-[12px] bg-card text-card-foreground border border-border hover:bg-muted transition-all shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
                  <Avatar className="h-10 w-10 border border-primary/10">
                    <AvatarImage src={member.avatar} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                      {member.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">{member.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{member.role}</p>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-primary">{activeTasks.filter(t => t.assigneeId === member.id).length}</span>
                    <span className="text-[8px] text-muted-foreground uppercase font-bold">Nhiệm vụ</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card className="border border-border shadow-md bg-primary text-primary-foreground">
          <CardHeader>
            <CardTitle className="text-lg font-bold tracking-tight">Hỗ trợ nhanh</CardTitle>
            <CardTitle className="text-lg font-bold tracking-tight">Thông báo nhanh</CardTitle>
            <CardDescription className="text-xs text-primary-foreground/70">Gửi thông báo tới toàn bộ nhân sự.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-2xl bg-primary-foreground/10 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                  <Megaphone className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold">Thông báo nội bộ</p>
                  <p className="text-[10px] opacity-70 italic">Gửi tới tất cả nhân sự</p>
                </div>
              </div>
              <Dialog open={isAnnouncementOpen} onOpenChange={setIsAnnouncementOpen}>
                <DialogTrigger 
                  render={
                    <Button 
                      variant="secondary" 
                      className="w-full rounded-xl h-10 font-bold text-xs bg-card text-card-foreground text-primary hover:bg-gray-50"
                    >
                      Gửi thông báo nội bộ
                    </Button>
                  }
                />
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Tạo thông báo nội bộ</DialogTitle>
                    <DialogDescription>
                      Tin nhắn này sẽ được đẩy dưới dạng thông báo (Push Notification) tới tất cả điện thoại và máy tính của các nhân sự đã cho phép thông báo.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Đối tượng nhận thông báo</Label>
                      <Select value={announcementTarget} onValueChange={(val: any) => setAnnouncementTarget(val)}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Chọn người nhận" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tất cả mọi người</SelectItem>
                          <SelectItem value="managers">Quản lý / Giám đốc</SelectItem>
                          <SelectItem value="designers">Bộ phận Thiết kế</SelectItem>
                          <SelectItem value="installers">Bộ phận Kỹ thuật / Thi công</SelectItem>
                          <SelectItem value="sales">Bộ phận Kinh doanh</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="message">Nội dung thông báo</Label>
                      <Textarea
                        id="message"
                        value={announcementText}
                        onChange={(e) => setAnnouncementText(e.target.value)}
                        placeholder="Nhập nội dung thông báo..."
                        className="min-h-[120px] resize-none"
                      />
                    </div>
                  </div>
                  <DialogFooter className="flex gap-2 sm:justify-end">
                    <DialogClose 
                      render={<Button variant="outline">Hủy</Button>}
                    />
                    <Button 
                      onClick={async () => {
                        if (!announcementText.trim()) {
                          toast.error("Vui lòng nhập nội dung thông báo");
                          return;
                        }
                        try {
                          setIsSendingAnnouncement(true);
                          await notifyCustomMembers("📢 Thông báo từ Quản lý", announcementText.trim(), announcementTarget);
                          toast.success("Thông báo nội bộ đã được gửi thành công!");
                          setAnnouncementText(''); // Clear on success
                          setIsAnnouncementOpen(false); // Close dialog
                        } catch (error) {
                          toast.error("Có lỗi khi gửi thông báo.");
                        } finally {
                          setIsSendingAnnouncement(false);
                        }
                      }}
                      className="bg-primary hover:bg-primary/90 text-white"
                      disabled={isSendingAnnouncement}
                    >
                      {isSendingAnnouncement ? "Đang gửi..." : "Gửi thông báo"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

