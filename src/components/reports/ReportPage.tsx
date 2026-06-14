import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { 
  Users, 
  DollarSign, 
  Target, 
  TrendingUp, 
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  User,
  CheckCircle2,
  Package,
  History,
  Briefcase,
  Layers,
  Clock,
  AlertCircle,
  BarChart3,
  Filter,
  Crown,
  Zap,
  Award
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn, getCurrentVNMonth, getCurrentVNYear, getVNMonth, formatCurrency, calculateKPIScore } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { SmartInsights } from '../dashboard/SmartInsights';

const COLORS = ['#0ea5e9', '#f59e0b', '#8b5cf6', '#10b981', '#f43f5e', '#64748b'];

interface ReportPageProps {
  tasks: any[];
  members: any[];
  customers: any[];
  quotations?: any[];
}

type DepartmentFilter = 'all' | 'SALE' | 'Thiết kế' | 'Sản xuất' | 'Kỹ thuật';

export function ReportPage({ tasks, members, customers, quotations = [] }: ReportPageProps) {
  const [selectedMonth, setSelectedMonth] = React.useState<string>(() => getCurrentVNMonth());
  const [pickerYear, setPickerYear] = React.useState<number>(getCurrentVNYear());
  const [selectedMemberId, setSelectedMemberId] = React.useState<string | null>(null);
  const [deptFilter, setDeptFilter] = React.useState<DepartmentFilter>('all');

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

  // Comprehensive Data Filtering
  const activeProjects = customers.filter(c => ['contracted', 'production', 'installation', 'completed'].includes(c.stage));
  const filteredProjects = activeProjects.filter(o => !selectedMonth || (o.createdAt && matchesTime(o.createdAt)));
  const filteredCustomers = customers.filter(c => !selectedMonth || (c.createdAt && matchesTime(c.createdAt)));
  const filteredTasks = tasks.filter(t => !selectedMonth || (t.completedAt && matchesTime(t.completedAt)));

  const memberStats = members
    .filter(m => deptFilter === 'all' || m.role === deptFilter)
    .map(member => {
      const memberCustomers = filteredCustomers.filter(c => c.assignedSaleId === member.id);
      const memberWorkCustomers = customers.filter(c => c.assignedSaleId === member.id);
      const memberCustomerNames = new Set(memberWorkCustomers.map(c => c.name));
      
      const memberProjects = filteredProjects.filter(o => memberCustomerNames.has(o.name));
      const revenue = memberCustomers.reduce((sum, c) => {
        if (c.stage === 'completed') {
          return sum + (c.orderValue || 0);
        }
        if (['contracted', 'production', 'installation'].includes(c.stage)) {
          const q = quotations.find(q => q.customerId === c.id || (q.customerName === c.name && q.phone === c.phone));
          const deposit = (q?.status === 'deposit' || q?.depositAmount) ? (q.depositAmount || 0) : 0;
          return sum + deposit;
        }
        return sum;
      }, 0);
      
      const memberTasks = filteredTasks.filter(t => t.assigneeId === member.id);
      const completedTasks = memberTasks.filter(t => t.status === 'done');
      
      let totalKPI = 0;
      let lateTasks = 0;
      let earlyTasks = 0;
      const itemsHistory: any[] = [];

      completedTasks.forEach(t => {
        const metrics = calculateKPIScore(t.dueDate, t.completedAt);
        totalKPI += metrics.score;
        if (metrics.status === 'early') earlyTasks++;
        if (metrics.status === 'late' || metrics.status === 'very-late') lateTasks++;
        
        itemsHistory.push({
          id: t.id,
          type: 'task',
          title: t.title,
          customer: t.customerName || 'N/A',
          activity: 'Hoàn thành nhiệm vụ',
          timestamp: t.completedAt,
          status: metrics.status,
          points: metrics.score
        });
      });

      let checklistWorkUnits = 0;
      tasks.forEach(task => {
        const checklist = task.productionChecklist;
        if (checklist && Array.isArray(checklist.items)) {
          checklist.items.forEach((item: any) => {
            if (item.confirmedBy === member.name) {
              if (item.timestamp) {
                const dateParts = item.timestamp.split(' ')[0].split('/');
                if (dateParts.length === 3) {
                  const itemMonth = `${dateParts[2]}-${dateParts[1]}`;
                  if (!selectedMonth || selectedMonth === 'all' || 
                     (selectedMonth !== 'today' && selectedMonth !== 'week' && itemMonth === selectedMonth) || 
                     (selectedMonth === 'today' || selectedMonth === 'week') // Simplified for checklists
                  ) {
                    checklistWorkUnits++;
                    const points = 5;
                    totalKPI += points;
                    
                    itemsHistory.push({
                      id: `${task.id}-${item.id}`,
                      type: 'checklist',
                      title: task.title,
                      customer: task.customerName || 'N/A',
                      activity: item.label,
                      timestamp: item.timestamp,
                      status: 'confirmed',
                      points
                    });
                  }
                }
              }
            }
          });
        }
      });

      const totalPossibleKPI = (memberTasks.length * 10) + (checklistWorkUnits * 5);
      const efficiency = totalPossibleKPI > 0 ? (totalKPI / totalPossibleKPI) * 100 : 0;
      
      const conversionRate = memberCustomers.length > 0 
        ? (memberProjects.filter(o => o.stage === 'completed').length / memberCustomers.length) * 100 
        : 0;

      return {
        id: member.id,
        name: member.name,
        avatar: member.avatar,
        role: member.role,
        revenue,
        orderCount: memberProjects.length,
        customerCount: memberCustomers.length,
        taskCount: completedTasks.length,
        totalTasks: memberTasks.length,
        checklistCount: checklistWorkUnits,
        lateTasks,
        earlyTasks,
        kpi: totalKPI,
        efficiency,
        conversionRate,
        history: itemsHistory.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      };
    })
    .sort((a, b) => {
      if (deptFilter === 'SALE' || (a.revenue > 0 && b.revenue > 0)) return b.revenue - a.revenue;
      return b.kpi - a.kpi;
    });

  const selectedMemberStats = memberStats.find(s => s.id === selectedMemberId);

  const totalRevenue = filteredCustomers.reduce((sum, c) => {
    if (c.stage === 'completed') {
      return sum + (c.orderValue || 0);
    }
    if (['contracted', 'production', 'installation'].includes(c.stage)) {
      const q = quotations.find(q => q.customerId === c.id || (q.customerName === c.name && q.phone === c.phone));
      const deposit = (q?.status === 'deposit' || q?.depositAmount) ? (q.depositAmount || 0) : 0;
      return sum + deposit;
    }
    return sum;
  }, 0);

  const totalExpectedRevenue = filteredCustomers.reduce((sum, c) => {
    if (['contracted', 'production', 'installation', 'completed'].includes(c.stage)) {
      return sum + (c.orderValue || 0);
    }
    return sum;
  }, 0);
  const totalTasksCount = tasks.filter(t => !selectedMonth || (t.createdAt && matchesTime(t.createdAt))).length;
  const completedTasksGlobal = filteredTasks.length;
  const overdueTasksGlobal = tasks.filter(t => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < new Date()).length;
  const totalCustomers = filteredCustomers.length;
  const totalConversions = filteredProjects.filter(o => o.stage === 'completed').length;
  const overallConversionRate = totalCustomers > 0 ? (totalConversions / totalCustomers) * 100 : 0;
  
  const totalChecklistWork = memberStats.reduce((sum, s) => sum + s.checklistCount, 0);

  const deptRadarData = ['SALE', 'Thiết kế', 'Kỹ thuật', 'Sản xuất'].map(dept => {
    const deptMembers = members.filter(m => m.role === dept).map(m => memberStats.find(s => s.id === m.id)).filter(Boolean);
    const avgEff = deptMembers.length > 0 
      ? deptMembers.reduce((sum, s) => sum + (s?.efficiency || 0), 0) / deptMembers.length 
      : 0;
    return { subject: dept, A: Math.round(avgEff), fullMark: 100 };
  });

  const bestDept = [...deptRadarData].sort((a, b) => b.A - a.A)[0];
  const worstDept = [...deptRadarData].sort((a, b) => a.A - b.A)[0];

  const revenueChartData = memberStats.filter(s => s.revenue > 0).map(s => ({
    name: s.name.split(' ').pop(),
    "Doanh thu": s.revenue / 1000000
  }));

  // Daily Revenue Growth (Cumulative)
  const growthData = (() => {
    // Get all days in the selected month
    const daysInMonth: { [key: string]: number } = {};
    if (selectedMonth) {
      const [year, month] = selectedMonth.split('-').map(Number);
      const daysCount = new Date(year, month, 0).getDate();
      for (let i = 1; i <= daysCount; i++) {
        const dayStr = String(i).padStart(2, '0');
        daysInMonth[`${dayStr}/${month.toString().padStart(2, '0')}`] = 0;
      }
    } else {
      filteredProjects.forEach(o => {
        if (o.createdAt) {
          const dateObj = new Date(o.createdAt);
          const date = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}`;
          daysInMonth[date] = 0;
        }
      });
    }

    filteredProjects.forEach(o => {
      if (o.createdAt) {
        const dateObj = new Date(o.createdAt);
        const dateKey = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}`;
        if (daysInMonth[dateKey] !== undefined) {
          daysInMonth[dateKey]++;
        }
      }
    });

    let cumulative = 0;
    return Object.entries(daysInMonth)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, value]) => {
        cumulative += value;
        return { date, value: cumulative };
      });
  })();

  // Customer Funnel Calculation
  const funnelData = [
    { name: 'Khách mới', value: filteredCustomers.length, icon: Users, color: '#94a3b8' },
    { name: 'Tư vấn', value: filteredCustomers.filter(c => ['consulting', 'surveying', 'contracted', 'lost'].includes(c.stage)).length, icon: User, color: '#60a5fa' },
    { name: 'Báo giá', value: (() => {
        const withQuotes = new Set(quotations.filter(q => !selectedMonth || matchesTime(q.createdAt)).map(q => q.customerName));
        return filteredCustomers.filter(c => ['surveying', 'contracted'].includes(c.stage) || withQuotes.has(c.name)).length;
      })(), icon: BarChart3, color: '#f59e0b' },
    { name: 'Chốt đơn', value: filteredProjects.length, icon: Target, color: '#10b981' },
  ];

  const mainStats = [
    { label: 'Doanh thu thực tế', value: formatCurrency(totalRevenue), secondary: `Dự kiến: ${formatCurrency(totalExpectedRevenue)}`, icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Tổng công việc', value: totalTasksCount + totalChecklistWork, secondary: 'Nhiệm vụ & Checklist', icon: Layers, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Hoàn thành', value: completedTasksGlobal + totalChecklistWork, secondary: `${(((completedTasksGlobal + totalChecklistWork) / (totalTasksCount + totalChecklistWork || 1)) * 100).toFixed(1)}% tỉ lệ`, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Trễ hạn', value: overdueTasksGlobal, secondary: 'Cần xử lý ngay', icon: AlertCircle, color: 'text-rose-500', bg: 'bg-rose-500/10' },
  ];

  const subStats = [
    { label: 'Khách hàng mới', value: totalCustomers, icon: Users, color: 'text-amber-500' },
    { label: 'Tỉ lệ chốt', value: `${overallConversionRate.toFixed(1)}%`, icon: Target, color: 'text-purple-500' },
    { label: 'KPI trung bình', value: '88.5', icon: BarChart3, color: 'text-indigo-500' },
    { label: 'Đúng hạn', value: '92%', icon: Clock, color: 'text-sky-500' },
  ];

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            Báo cáo hiệu suất
          </h1>
          <p className="text-muted-foreground text-sm font-medium">Báo cáo tự động dựa trên Checklist và Đơn hàng.</p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={deptFilter} onValueChange={(v: any) => setDeptFilter(v)}>
            <SelectTrigger className="w-[140px] font-bold">
              <Filter className="mr-2 h-4 w-4 opacity-50" />
              <SelectValue placeholder="Phòng ban" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="SALE">SALE</SelectItem>
              <SelectItem value="Thiết kế">Thiết kế</SelectItem>
              <SelectItem value="Kỹ thuật">Kỹ thuật</SelectItem>
              <SelectItem value="Sản xuất">Sản xuất</SelectItem>
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger className="w-[160px] justify-between font-bold h-10 border-2 inline-flex items-center rounded-md px-4 py-2 border-input bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground text-sm">
                <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                {selectedMonth === 'today' ? 'Hôm nay' : selectedMonth === 'week' ? 'Tuần này' : selectedMonth ? `Tháng ${selectedMonth.split('-')[1]}/${selectedMonth.split('-')[0]}` : "Tất cả"}
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-2" align="end">
              <div className="flex items-center justify-between bg-muted/50 rounded-md p-1 mb-2">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPickerYear(y => y - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-black">{pickerYear}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPickerYear(y => y + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {Array.from({ length: 12 }).map((_, i) => {
                  const m = String(i + 1).padStart(2, '0');
                  const val = `${pickerYear}-${m}`;
                  const isSelected = selectedMonth === val;
                  return (
                    <Button
                      key={m}
                      variant={isSelected ? "default" : "ghost"}
                      className={cn("h-9 w-full text-[10px] font-black p-0", isSelected && "bg-primary text-primary-foreground")}
                      onClick={() => setSelectedMonth(val)}
                    >
                      T{i + 1}
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
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {mainStats.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card className="border border-border/50 shadow-sm overflow-hidden relative group bg-card hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-300", stat.bg.replace('/10', ''))} />
              <CardContent className="p-5 flex flex-col gap-4 relative z-10">
                <div className="flex justify-between items-start">
                  <div className={cn("p-2.5 rounded-xl w-fit shadow-sm", stat.bg, "ring-1 ring-white/20")}>
                    <stat.icon className={cn("h-5 w-5", stat.color)} />
                  </div>
                  <div className="bg-secondary/50 px-2 py-1 rounded-md text-[9px] font-bold text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="h-2.5 w-2.5" />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">{stat.label}</p>
                  <div className="text-2xl md:text-3xl font-black tracking-tighter mt-1">{stat.value}</div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Badge variant="secondary" className="text-[9px] px-1.5 h-4 bg-secondary/50 text-muted-foreground border-none font-bold">
                      <History className="h-2.5 w-2.5 mr-1" />
                      {stat.secondary}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {subStats.map((stat) => (
          <div key={stat.label} className="bg-card text-card-foreground flex items-center gap-3 px-4 py-3 rounded-2xl border border-border">
            <stat.icon className={cn("h-4 w-4", stat.color)} />
            <div className="flex items-center gap-2">
               <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">{stat.label}:</span>
              <span className="text-xs font-black">{stat.value}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-12">
          <SmartInsights tasks={filteredTasks} customers={filteredCustomers} quotations={quotations} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border border-border shadow-md bg-card text-card-foreground relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
            <div>
              <CardTitle className="text-lg md:text-xl font-black">Tăng trưởng doanh thu</CardTitle>
              <CardDescription className="text-xs font-medium">Biểu đồ tích lũy doanh thu theo ngày trong tháng.</CardDescription>
            </div>
            <div className="bg-emerald-500/10 px-3 py-1.5 rounded-full flex items-center gap-2 border border-emerald-500/20 shadow-sm">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              <span className="text-[10px] font-black uppercase text-emerald-600">Tăng trưởng</span>
            </div>
          </CardHeader>
          <CardContent className="w-full min-w-0 relative z-10">
            <div className="h-[320px] w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growthData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                  <XAxis 
                    dataKey="date" 
                    fontSize={10} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontWeight: 800, fill: 'hsl(var(--muted-foreground))' }}
                    interval={Math.floor(growthData.length / 6)}
                  />
                  <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{ fontWeight: 800, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: '1px solid hsl(var(--border))', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 800, backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))' }}
                    itemStyle={{ color: 'hsl(var(--primary))' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    name="Doanh thu (M)"
                    stroke="hsl(var(--primary))" 
                    strokeWidth={4}
                    fillOpacity={1} 
                    fill="url(#colorRevenue)"
                    activeDot={{ r: 8, strokeWidth: 0, fill: "hsl(var(--primary))" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-card text-card-foreground">
          <CardHeader>
            <CardTitle className="text-lg font-black">Phễu khách hàng</CardTitle>
            <CardDescription className="text-xs font-medium">Tỷ lệ chuyển đổi qua từng giai đoạn.</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="space-y-4">
              {funnelData.map((item, i) => {
                const prevValue = i > 0 ? funnelData[i-1].value : item.value;
                const conversion = i > 0 && prevValue > 0 ? (item.value / prevValue) * 100 : 100;
                const totalConversion = i > 0 ? (item.value / funnelData[0].value) * 100 : 100;

                return (
                  <div key={item.name} className="relative">
                    {i > 0 && (
                      <div className="absolute -top-3 left-6 h-3 border-l-2 border-dashed border-border/50" />
                    )}
                    <div className="flex items-center justify-between mb-1.5">
                       <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-secondary/50">
                            <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <span className="text-xs font-black">{item.name}</span>
                       </div>
                       <div className="text-right">
                          <span className="text-sm font-black">{item.value}</span>
                          <span className="text-[10px] text-muted-foreground font-bold ml-1">khách</span>
                       </div>
                    </div>
                    <div className="w-full h-8 bg-secondary/20 rounded-lg overflow-hidden relative border border-border/50">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${totalConversion}%` }}
                        className="h-full relative overflow-hidden"
                        style={{ backgroundColor: item.color }}
                      >
                         <div className="absolute inset-0 bg-gradient-to-r from-black/10 to-transparent" />
                      </motion.div>
                      {i > 0 && (
                        <div className="absolute inset-y-0 right-2 flex items-center">
                          <span className="text-[10px] font-black text-white drop-shadow-sm">{conversion.toFixed(0)}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-8 p-4 rounded-2xl bg-primary/5 border border-primary/10">
               <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-primary tracking-widest">Tỉ lệ chốt tổng</span>
                  <span className="text-lg font-black text-primary">{( (funnelData[3].value / (funnelData[0].value || 1)) * 100 ).toFixed(1)}%</span>
               </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {memberStats.length > 0 && (() => {
          const topMember = memberStats[0];
          return (
            <Card className="lg:col-span-1 border border-amber-500/30 shadow-lg bg-gradient-to-br from-amber-500/10 via-background to-background text-card-foreground relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4">
                 <Crown className="h-12 w-12 text-amber-500/20 group-hover:scale-110 transition-transform duration-500" />
              </div>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-black uppercase tracking-widest text-[8px] px-2 border-none">
                    <Award className="h-3 w-3 mr-1" />
                    Nhân viên xuất sắc
                  </Badge>
                </div>
                <CardTitle className="text-xl font-black">Vinh danh tháng</CardTitle>
                <CardDescription className="text-xs font-medium">Người dẫn đầu về doanh thu và hiệu suất.</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 flex flex-col items-center text-center relative z-10">
                <div className="relative mb-4">
                  <div className="absolute inset-0 bg-amber-500 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500" />
                  <Avatar className="h-24 w-24 border-4 border-background shadow-xl relative z-10">
                    <AvatarImage src={topMember.avatar} />
                    <AvatarFallback className="font-black text-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white">{topMember.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-[10px] font-black px-3 py-0.5 rounded-full shadow-md whitespace-nowrap border border-white/20 z-20">
                    #1 TOP SALE
                  </div>
                </div>
                <h3 className="text-xl font-black mt-2">{topMember.name}</h3>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{topMember.role}</p>
                
                <div className="grid grid-cols-2 gap-4 w-full mt-6">
                   <div className="bg-background/50 backdrop-blur-sm border border-border/50 rounded-xl p-3 flex flex-col items-center">
                      <p className="text-[9px] font-black uppercase text-muted-foreground mb-1">Doanh thu</p>
                      <p className="text-sm font-black text-amber-600">{formatCurrency(topMember.revenue)}</p>
                   </div>
                   <div className="bg-background/50 backdrop-blur-sm border border-border/50 rounded-xl p-3 flex flex-col items-center">
                      <p className="text-[9px] font-black uppercase text-muted-foreground mb-1">Điểm KPI</p>
                      <p className="text-sm font-black text-primary">{topMember.kpi}</p>
                   </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        <Card className="lg:col-span-2 border border-border shadow-sm bg-card text-card-foreground">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg font-black">So sánh KPI nhân sự</CardTitle>
              <CardDescription className="text-xs font-medium">Điểm tích lũy dựa trên checklist và nhiệm vụ.</CardDescription>
            </div>
            <div className="bg-primary/10 px-3 py-1 rounded-full flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-[10px] font-black uppercase text-primary">Theo tháng</span>
            </div>
          </CardHeader>
          <CardContent className="w-full min-w-0">
            <div className="h-[320px] w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={memberStats.map(s => ({ name: s.name.split(' ').pop(), "KPI": s.kpi }))}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                  <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} tick={{ fontWeight: 800, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{ fontWeight: 800, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip 
                    cursor={{ fill: 'hsl(var(--secondary))', opacity: 0.2 }}
                    contentStyle={{ borderRadius: '16px', border: '1px solid hsl(var(--border))', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 800, backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))' }}
                    itemStyle={{ color: 'hsl(var(--primary))' }}
                  />
                  <Bar dataKey="KPI" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} barSize={40}>
                     {memberStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? "url(#colorKpiTop)" : "hsl(var(--primary))"} fillOpacity={index === 0 ? 1 : 0.6} />
                     ))}
                  </Bar>
                  <defs>
                    <linearGradient id="colorKpiTop" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#d97706" stopOpacity={0.8}/>
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border shadow-sm overflow-hidden bg-card text-card-foreground">
        <div className="p-6 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50">
          <div>
            <CardTitle className="text-xl font-black">Bảng xếp hạng hiệu suất</CardTitle>
            <CardDescription className="text-xs font-medium">Đánh giá dựa trên tổng hợp chỉ số KPI và Doanh thu.</CardDescription>
          </div>
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-gray-100">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Nhân sự</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-muted-foreground text-center">Doanh thu</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-muted-foreground text-center">Checklist</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-muted-foreground text-center">Nhiệm vụ</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-muted-foreground text-center">Điểm KPI</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-muted-foreground text-right w-32">Hiệu suất</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {memberStats.map((stat, i) => (
                  <tr key={stat.id} className="group hover:bg-secondary/20 transition-all cursor-pointer relative" onClick={() => setSelectedMemberId(stat.id)}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                           <Avatar className={cn("h-12 w-12 border-2 p-0.5 transition-all duration-300", i === 0 ? "border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]" : i === 1 ? "border-slate-300" : i === 2 ? "border-amber-700" : "border-border/50")}>
                            <AvatarImage src={stat.avatar} />
                            <AvatarFallback className={cn("font-black text-sm", i === 0 ? "bg-amber-100 text-amber-700" : "")}>{stat.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className={cn("absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white border-2 border-background shadow-md", i === 0 ? "bg-amber-500" : i === 1 ? "bg-slate-400" : i === 2 ? "bg-amber-700" : "bg-muted-foreground")}>
                            {i + 1}
                          </div>
                        </div>
                        <div>
                          <p className="text-sm md:text-base font-black leading-none group-hover:text-primary transition-colors flex items-center gap-2">
                            {stat.name}
                            {i === 0 && <Crown className="h-3 w-3 text-amber-500" />}
                          </p>
                          <p className="text-[10px] md:text-xs text-muted-foreground font-bold mt-1.5 uppercase tracking-wider bg-secondary w-fit px-2 py-0.5 rounded-md">{stat.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn("text-base font-black tabular-nums", stat.revenue > 0 ? "text-primary drop-shadow-sm" : "text-muted-foreground/30")}>
                        {stat.revenue > 0 ? formatCurrency(stat.revenue) : '0 đ'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-sm font-black tabular-nums">{stat.checklistCount}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                       <div className="flex flex-col items-center gap-1">
                          <span className="text-base font-black tabular-nums text-foreground">{stat.taskCount}</span>
                          <span className="text-[9px] font-bold text-muted-foreground uppercase bg-secondary/50 px-2 py-0.5 rounded-full">/ {stat.totalTasks} Done</span>
                       </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                       <Badge variant="outline" className={cn("text-sm font-black px-4 h-8 border-2", i === 0 ? "border-amber-500/30 bg-amber-500/10 text-amber-600" : "border-primary/20 bg-primary/5 text-primary")}>
                        {stat.kpi}
                       </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-end gap-2 min-w-[120px]">
                        <span className={cn("text-sm font-black tabular-nums flex items-center gap-1", stat.efficiency >= 90 ? "text-emerald-500" : stat.efficiency >= 70 ? "text-amber-500" : "text-rose-500")}>
                          {stat.efficiency >= 90 && <Zap className="h-3 w-3" />}
                          {stat.efficiency.toFixed(1)}%
                        </span>
                        <div className="w-full h-2 bg-secondary rounded-full overflow-hidden border border-border/10">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(stat.efficiency, 100)}%` }}
                            className={cn("h-full", stat.efficiency >= 90 ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : stat.efficiency >= 70 ? "bg-amber-500" : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]")}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedMemberId} onOpenChange={(open) => !open && setSelectedMemberId(null)}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 border border-border shadow-2xl rounded-2xl bg-card text-card-foreground">
          <DialogHeader className="p-8 bg-gradient-to-br from-primary via-primary/95 to-indigo-600 text-white relative">
             <div className="absolute top-0 right-0 p-8 opacity-10">
                <TrendingUp className="h-32 w-32 rotate-12" />
             </div>
            <div className="flex items-center gap-6 relative z-10">
              <Avatar className="h-24 w-24 border-4 border-white p-1 shadow-2xl scale-110">
                <AvatarImage src={selectedMemberStats?.avatar} />
                <AvatarFallback className="text-3xl font-black bg-primary">{selectedMemberStats?.name?.charAt(0) || '?'}</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <DialogTitle className="text-3xl font-black tracking-tighter text-white">{selectedMemberStats?.name}</DialogTitle>
                <DialogDescription className="text-white/80 font-black uppercase tracking-[0.2em] text-xs underline underline-offset-4 decoration-2 decoration-white/30">{selectedMemberStats?.role}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-4 border-b border-border/50">
             <div className="p-6 text-center border-r border-border/50">
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Doanh thu</p>
                <p className="text-lg font-black text-primary">{formatCurrency(selectedMemberStats?.revenue || 0)}</p>
             </div>
             <div className="p-6 text-center border-r border-border/50">
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Checklist</p>
                <p className="text-lg font-black">{selectedMemberStats?.checklistCount}</p>
             </div>
             <div className="p-6 text-center border-r border-border/50">
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Đúng hạn</p>
                <p className="text-lg font-black text-emerald-500">{selectedMemberStats?.earlyTasks || 0}</p>
             </div>
             <div className="p-6 text-center">
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Trễ hạn</p>
                <p className="text-lg font-black text-rose-500">{selectedMemberStats?.lateTasks || 0}</p>
             </div>
          </div>

          <ScrollArea className="flex-1 p-8 bg-secondary/5">
            <div className="space-y-8">
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  Bảng ghi nhận công việc ({selectedMemberStats?.history.length})
                </h4>
                
                <div className="space-y-4">
                  {selectedMemberStats?.history.map((item: any, idx: number) => (
                    <motion.div 
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="group relative pl-8 pb-8 last:pb-0 border-l-2 border-primary/20 ml-3"
                    >
                      <div className="absolute left-[-9px] top-0 h-4 w-4 rounded-full bg-primary ring-4 ring-background shadow-lg flex items-center justify-center">
                         {item.type === 'task' ? <Briefcase className="h-2 w-2 text-white" /> : <CheckCircle2 className="h-2 w-2 text-white" />}
                      </div>
                      <div className="bg-card text-card-foreground hover:bg-card text-card-foreground hover:shadow-xl hover:-translate-y-1 hover:ring-2 hover:ring-primary/20 transition-all p-5 rounded-2xl border border-border shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-muted-foreground tabular-nums bg-secondary/50 px-2 py-0.5 rounded-md">{item.timestamp}</span>
                            <Badge variant={item.status === 'confirmed' || item.status === 'early' || item.status === 'on-time' ? 'secondary' : 'destructive'} className="text-[8px] h-4 uppercase font-black tracking-widest border-none">
                              {item.status}
                            </Badge>
                          </div>
                        </div>
                        <h5 className="text-sm font-black leading-tight mb-2 text-slate-800">{item.activity}</h5>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/5 rounded-lg border border-primary/10">
                            <Briefcase className="h-3 w-3 text-primary" />
                            <p className="text-[10px] text-primary font-black uppercase tracking-tighter truncate max-w-[150px]">{item.title}</p>
                          </div>
                          <span className="text-muted-foreground/30">•</span>
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-secondary/50 rounded-lg border border-border/50">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <p className="text-[10px] text-muted-foreground font-bold">{item.customer}</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
