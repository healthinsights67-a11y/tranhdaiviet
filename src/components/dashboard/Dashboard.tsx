import * as React from 'react';
import * as XLSX from 'xlsx';
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
  Area
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Users, 
  DollarSign, 
  Target, 
  TrendingUp, 
  Calendar as CalendarIcon,
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  Package, 
  AlertCircle, 
  BarChart3, 
  Filter, 
  Crown, 
  Award,
  CalendarDays,
  Hammer,
  Wrench,
  FileSpreadsheet,
  Megaphone,
  LayoutDashboard,
  Boxes
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  DialogFooter
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn, getCurrentVNMonth, getCurrentVNYear, getVNMonth, formatCurrency, calculateKPIScore } from '@/src/lib/utils';
import { SmartInsights } from './SmartInsights';
import { notifyCustomMembers, TargetGroup } from '@/src/services/notificationService';
import { db, collection, onSnapshot } from '@/src/lib/firebase';
import { MaterialConfig, AccessoryConfig } from '@/src/types';
import { toast } from 'sonner';

const COLORS = ['#0ea5e9', '#f59e0b', '#8b5cf6', '#10b981', '#f43f5e', '#64748b'];

interface DashboardProps {
  tasks: any[];
  members: any[];
  customers?: any[];
  quotations?: any[];
  currentUser?: any;
  schedules?: any[];
  installations?: any[];
  setActiveTab?: (tab: string) => void;
}

type DepartmentFilter = 'all' | 'SALE' | 'Thiết kế' | 'Sản xuất' | 'Kỹ thuật' | 'Marketing';

export function Dashboard({ 
  tasks = [], 
  members = [], 
  customers = [], 
  quotations = [], 
  currentUser, 
  schedules = [], 
  installations = [], 
  setActiveTab 
}: DashboardProps) {
  const [selectedMonth, setSelectedMonth] = React.useState<string>(() => getCurrentVNMonth());
  const [pickerYear, setPickerYear] = React.useState<number>(getCurrentVNYear());
  const [deptFilter, setDeptFilter] = React.useState<DepartmentFilter>('all');
  const [activeSubTab, setActiveSubTab] = React.useState<'overview' | 'sales' | 'production' | 'inventory' | 'hr'>('overview');
  const [selectedMemberId, setSelectedMemberId] = React.useState<string | null>(null);

  // Announcement modal states
  const [announcementText, setAnnouncementText] = React.useState('');
  const [announcementTarget, setAnnouncementTarget] = React.useState<TargetGroup>('all');
  const [isSendingAnnouncement, setIsSendingAnnouncement] = React.useState(false);
  const [isAnnouncementOpen, setIsAnnouncementOpen] = React.useState(false);

  // Inventory realtime states
  const [materials, setMaterials] = React.useState<MaterialConfig[]>([]);
  const [accessories, setAccessories] = React.useState<AccessoryConfig[]>([]);

  React.useEffect(() => {
    const unsubMats = onSnapshot(collection(db, 'materialConfigs'), snap => {
      setMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() }) as MaterialConfig));
    }, () => {});
    const unsubAccs = onSnapshot(collection(db, 'accessoryConfigs'), snap => {
      setAccessories(snap.docs.map(d => ({ id: d.id, ...d.data() }) as AccessoryConfig));
    }, () => {});
    return () => { unsubMats(); unsubAccs(); };
  }, []);

  const isAdmin = currentUser?.role?.toLowerCase() === 'admin';
  const isManager = isAdmin || !!(currentUser?.role && ['quản lý', 'giám đốc', 'trợ lý', 'kế toán', 'chủ sở hữu'].some(r => currentUser.role.toLowerCase().includes(r)));
  const canViewRevenue = isManager || currentUser?.permissions?.viewRevenue !== false;

  const matchesTime = React.useCallback((dateStr?: string) => {
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
  }, [selectedMonth]);

  // Inventory calculations
  const totalInventoryValue = React.useMemo(() => {
    const matVal = materials.reduce((sum, m) => sum + ((m.stock || 0) * (m.finalPrice || m.preTaxBoxPrice || 0)), 0);
    const accVal = accessories.reduce((sum, a) => sum + ((a.stock || 0) * (a.finalPrice || a.preTaxPrice || 0)), 0);
    return matVal + accVal;
  }, [materials, accessories]);

  const lowStockCount = React.useMemo(() => {
    const lowMats = materials.filter(m => (m.stock || 0) <= (m.minStock || 0)).length;
    const lowAccs = accessories.filter(a => (a.stock || 0) <= (a.minStock || 0)).length;
    return lowMats + lowAccs;
  }, [materials, accessories]);

  // Core metrics calculation
  const {
    filteredCustomers,
    filteredProjects,
    filteredTasks,
    filteredQuotations,
    memberStats,
    totalRevenue,
    totalExpectedRevenue,
    conversionRate,
    overdueTasksList,
    revenueByDayData,
    customerFunnelData,
    sourceDistributionData,
    departmentWorkloadData,
    statusDistributionData,
    topSalePerformers
  } = React.useMemo(() => {
    const fCustomers = customers.filter(c => !selectedMonth || (c.createdAt && matchesTime(c.createdAt)));
    const activeProjects = customers.filter(c => ['contracted', 'production', 'installation', 'completed'].includes(c.stage));
    const fProjects = activeProjects.filter(o => !selectedMonth || (o.createdAt && matchesTime(o.createdAt)));
    const fQuotations = quotations.filter(q => !selectedMonth || (q.createdAt && matchesTime(q.createdAt)));
    const fTasks = tasks.filter(t => {
      if (deptFilter !== 'all' && t.type !== deptFilter && t.department !== deptFilter) return false;
      if (!selectedMonth || selectedMonth === 'all') return true;
      return (t.createdAt && matchesTime(t.createdAt)) || (t.completedAt && matchesTime(t.completedAt)) || (t.dueDate && matchesTime(t.dueDate));
    });

    // Revenue calculations
    let totalRev = 0;
    let totalExpRev = 0;
    fCustomers.forEach(c => {
      if (c.stage === 'completed') {
        totalRev += (c.orderValue || 0);
      } else if (['contracted', 'production', 'installation'].includes(c.stage)) {
        const q = quotations.find(q => q.customerId === c.id || (q.customerName === c.name && q.phone === c.phone));
        const deposit = (q?.status === 'deposit' || q?.depositAmount) ? (q.depositAmount || 0) : 0;
        totalRev += deposit;
        totalExpRev += (c.orderValue || q?.totalAmount || 0);
      } else {
        totalExpRev += (c.orderValue || 0);
      }
    });

    // Overdue tasks
    const nowTime = new Date().getTime();
    const overdueList = tasks.filter(t => {
      if (t.status === 'done' || t.status === 'archived' || !t.dueDate) return false;
      return new Date(t.dueDate).getTime() < nowTime;
    });

    // Conversion rate
    const contractedCount = fCustomers.filter(c => ['contracted', 'production', 'installation', 'completed'].includes(c.stage)).length;
    const convRate = fCustomers.length > 0 ? Math.round((contractedCount / fCustomers.length) * 1000) / 10 : 0;

    // Member KPI stats
    const mStats = members
      .filter(m => deptFilter === 'all' || m.role === deptFilter)
      .map(member => {
        const memberCustomers = fCustomers.filter(c => c.assignedSaleId === member.id);
        const revenue = memberCustomers.reduce((sum, c) => {
          if (c.stage === 'completed') return sum + (c.orderValue || 0);
          if (['contracted', 'production', 'installation'].includes(c.stage)) {
            const q = quotations.find(q => q.customerId === c.id || (q.customerName === c.name && q.phone === c.phone));
            return sum + ((q?.status === 'deposit' || q?.depositAmount) ? (q.depositAmount || 0) : 0);
          }
          return sum;
        }, 0);

        const memberTasks = fTasks.filter(t => t.assigneeId === member.id);
        const completedTasks = memberTasks.filter(t => t.status === 'done');
        
        let totalKPI = 0;
        let onTimeCount = 0;
        const itemsHistory: any[] = [];

        completedTasks.forEach(t => {
          const metrics = calculateKPIScore(t.dueDate, t.completedAt);
          totalKPI += metrics.score;
          if (metrics.status === 'early' || metrics.status === 'on-time') onTimeCount++;
          itemsHistory.push({
            id: t.id,
            title: t.title,
            customer: t.customerName || 'N/A',
            timestamp: t.completedAt,
            status: metrics.status,
            points: metrics.score
          });
        });

        const onTimeRate = completedTasks.length > 0 ? Math.round((onTimeCount / completedTasks.length) * 100) : 100;

        return {
          id: member.id,
          name: member.name,
          role: member.role,
          avatar: member.avatar,
          totalTasks: memberTasks.length,
          completedTasks: completedTasks.length,
          revenue,
          kpiScore: totalKPI,
          onTimeRate,
          itemsHistory
        };
      }).sort((a, b) => b.kpiScore - a.kpiScore);

    // Revenue by day chart
    const daysMap: Record<number, number> = {};
    fCustomers.forEach(c => {
      if (c.createdAt && ['contracted', 'production', 'installation', 'completed'].includes(c.stage)) {
        const d = new Date(c.createdAt).getDate();
        daysMap[d] = (daysMap[d] || 0) + (c.orderValue || 0);
      }
    });
    const revDayData = Object.keys(daysMap).map(day => ({
      day: `Ngày ${day}`,
      revenue: daysMap[Number(day)]
    })).slice(0, 31);

    // Customer Funnel
    const funnelStages = [
      { name: 'Khách mới', count: fCustomers.filter(c => c.stage === 'lead' || !c.stage).length },
      { name: 'Tư vấn', count: fCustomers.filter(c => c.stage === 'consulting').length },
      { name: 'Đo đạc', count: fCustomers.filter(c => c.stage === 'surveying').length },
      { name: 'Chốt cọc', count: fCustomers.filter(c => c.stage === 'contracted').length },
      { name: 'Sản xuất', count: fCustomers.filter(c => c.stage === 'production').length },
      { name: 'Lắp đặt', count: fCustomers.filter(c => c.stage === 'installation').length },
      { name: 'Hoàn thành', count: fCustomers.filter(c => c.stage === 'completed').length },
    ];

    // Source distribution
    const sourceMap: Record<string, number> = {};
    fCustomers.forEach(c => {
      const src = c.source || 'Tự nhiên / Trực tiếp';
      sourceMap[src] = (sourceMap[src] || 0) + 1;
    });
    const srcData = Object.entries(sourceMap).map(([name, value]) => ({ name, value }));

    // Department Workload
    const deptMap: Record<string, number> = {};
    fTasks.forEach(t => {
      const d = t.type === 'sale' ? 'Sale' : t.type === 'design' ? 'Thiết kế' : t.type === 'production' ? 'Sản xuất' : t.type === 'marketing' ? 'Marketing' : 'Khác';
      deptMap[d] = (deptMap[d] || 0) + 1;
    });
    const deptData = Object.entries(deptMap).map(([name, count]) => ({ name, count }));

    // Status distribution
    const statusMap: Record<string, number> = {
      'Đang thực hiện': fTasks.filter(t => t.status === 'in-progress' || t.status === 'todo').length,
      'Hoàn thành': fTasks.filter(t => t.status === 'done').length,
      'Trễ hạn': overdueList.length,
      'Chờ cọc / Duyệt': fTasks.filter(t => t.status === 'review' || t.status === 'waiting_install').length
    };
    const statusData = Object.entries(statusMap).map(([name, value]) => ({ name, value }));

    // Top sale performers
    const salePerformers = mStats.filter(m => m.revenue > 0).slice(0, 5);

    return {
      filteredCustomers: fCustomers,
      filteredProjects: fProjects,
      filteredTasks: fTasks,
      filteredQuotations: fQuotations,
      memberStats: mStats,
      totalRevenue: totalRev,
      totalExpectedRevenue: totalExpRev,
      conversionRate: convRate,
      overdueTasksList: overdueList,
      revenueByDayData: revDayData,
      customerFunnelData: funnelStages,
      sourceDistributionData: srcData,
      departmentWorkloadData: deptData,
      statusDistributionData: statusData,
      topSalePerformers: salePerformers
    };
  }, [customers, tasks, quotations, members, selectedMonth, matchesTime, deptFilter]);

  // Export Excel handler
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Tổng quan
      const summaryData = [
        ['CHỈ SỐ TỔNG QUAN', 'GIÁ TRỊ'],
        ['Kỳ báo cáo', selectedMonth || 'Tất cả'],
        ['Doanh thu thực tế', totalRevenue],
        ['Doanh thu dự kiến', totalExpectedRevenue],
        ['Tổng khách hàng', filteredCustomers.length],
        ['Dự án triển khai', filteredProjects.length],
        ['Tỉ lệ chốt cọc', `${conversionRate}%`],
        ['Tổng công việc', filteredTasks.length],
        ['Nhiệm vụ trễ hạn', overdueTasksList.length],
        ['Giá trị tồn kho', totalInventoryValue],
        ['Mặt hàng thiếu hụt', lowStockCount]
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Tong_Quan');

      // Sheet 2: Khách hàng
      const custData = filteredCustomers.map(c => ({
        'Mã KH': c.code || '',
        'Tên khách hàng': c.name,
        'Số điện thoại': c.phone || '',
        'Địa chỉ': c.address || '',
        'Giai đoạn': c.stage,
        'Nguồn': c.source || '',
        'Giá trị đơn hàng': c.orderValue || 0,
        'Ngày tạo': c.createdAt ? new Date(c.createdAt).toLocaleDateString('vi-VN') : ''
      }));
      const wsCust = XLSX.utils.json_to_sheet(custData);
      XLSX.utils.book_append_sheet(wb, wsCust, 'Khach_Hang');

      // Sheet 3: Hiệu suất Nhân viên
      const empData = memberStats.map(m => ({
        'Nhân viên': m.name,
        'Phòng ban': m.role,
        'Tổng việc': m.totalTasks,
        'Hoàn thành': m.completedTasks,
        'Doanh số (VNĐ)': m.revenue,
        'Điểm KPI': m.kpiScore,
        'Tỉ lệ đúng hạn': `${m.onTimeRate}%`
      }));
      const wsEmp = XLSX.utils.json_to_sheet(empData);
      XLSX.utils.book_append_sheet(wb, wsEmp, 'KPI_Nhan_Vien');

      XLSX.writeFile(wb, `Bao_Cao_Tong_Hop_INoiThat_${selectedMonth || 'All'}.xlsx`);
      toast.success('Đã xuất báo cáo Excel thành công!');
    } catch (e: any) {
      toast.error('Lỗi khi xuất file Excel: ' + (e.message || ''));
    }
  };

  // Send announcement handler
  const handleSendAnnouncement = async () => {
    if (!announcementText.trim()) {
      toast.error('Vui lòng nhập nội dung thông báo');
      return;
    }
    setIsSendingAnnouncement(true);
    try {
      await notifyCustomMembers(
        '📢 Thông báo từ Ban Giám Đốc',
        announcementText,
        announcementTarget
      );
      toast.success('Đã gửi thông báo thành công');
      setAnnouncementText('');
      setIsAnnouncementOpen(false);
    } catch (e: any) {
      toast.error('Lỗi khi gửi thông báo: ' + (e?.message || ''));
    } finally {
      setIsSendingAnnouncement(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12 px-2 sm:px-4">
      {/* Header Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card p-4 sm:p-5 rounded-2xl border shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-xl text-primary">
              <LayoutDashboard className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                Tổng quan & Báo cáo
              </h1>
              <p className="text-xs text-muted-foreground font-medium">
                Báo cáo điều hành tự động và phân tích chỉ số toàn diện theo các phân hệ ứng dụng.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Department Filter */}
          <Select value={deptFilter} onValueChange={(val: DepartmentFilter) => setDeptFilter(val)}>
            <SelectTrigger className="h-9 rounded-xl text-xs font-bold w-[140px] bg-background">
              <Filter className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Phòng ban" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả phòng ban</SelectItem>
              <SelectItem value="SALE">Kinh doanh (Sale)</SelectItem>
              <SelectItem value="Thiết kế">Thiết kế</SelectItem>
              <SelectItem value="Sản xuất">Sản xuất</SelectItem>
              <SelectItem value="Kỹ thuật">Thi công</SelectItem>
              <SelectItem value="Marketing">Marketing</SelectItem>
            </SelectContent>
          </Select>

          {/* Time Picker */}
          <Popover>
            <PopoverTrigger className="h-9 px-3 border rounded-xl text-xs font-bold inline-flex items-center gap-1.5 bg-background hover:bg-accent text-foreground shadow-xs">
              <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
              {selectedMonth === 'today' ? 'Hôm nay' :
               selectedMonth === 'week' ? 'Tuần này' :
               selectedMonth === 'all' ? 'Tất cả' :
               selectedMonth ? `Tháng ${selectedMonth.split('-')[1]}/${selectedMonth.split('-')[0]}` : 'Tất cả'}
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3 rounded-2xl" align="end">
              <div className="space-y-2 text-xs">
                <p className="font-bold text-muted-foreground uppercase text-[10px]">Chọn nhanh</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button size="sm" variant={selectedMonth === 'today' ? 'default' : 'outline'} className="h-7 text-xs rounded-lg font-semibold" onClick={() => setSelectedMonth('today')}>
                    Hôm nay
                  </Button>
                  <Button size="sm" variant={selectedMonth === 'week' ? 'default' : 'outline'} className="h-7 text-xs rounded-lg font-semibold" onClick={() => setSelectedMonth('week')}>
                    Tuần này
                  </Button>
                  <Button size="sm" variant={selectedMonth === getCurrentVNMonth() ? 'default' : 'outline'} className="h-7 text-xs rounded-lg font-semibold" onClick={() => setSelectedMonth(getCurrentVNMonth())}>
                    Tháng này
                  </Button>
                  <Button size="sm" variant={selectedMonth === 'all' ? 'default' : 'outline'} className="h-7 text-xs rounded-lg font-semibold" onClick={() => setSelectedMonth('all')}>
                    Tất cả
                  </Button>
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-[10px] uppercase text-muted-foreground">Theo tháng ({pickerYear})</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setPickerYear(y => y - 1)}>
                        <ChevronLeft className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setPickerYear(y => y + 1)}>
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {Array.from({ length: 12 }, (_, i) => {
                      const mStr = `${pickerYear}-${String(i + 1).padStart(2, '0')}`;
                      return (
                        <Button
                          key={mStr}
                          size="sm"
                          variant={selectedMonth === mStr ? 'default' : 'ghost'}
                          className="h-6 text-[11px] font-bold p-0 rounded-md"
                          onClick={() => setSelectedMonth(mStr)}
                        >
                          T{i + 1}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Export Excel Button */}
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleExportExcel}
            className="h-9 rounded-xl text-xs font-bold gap-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Xuất Excel
          </Button>

          {/* Announcement Button */}
          {isManager && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAnnouncementOpen(true)}
              className="h-9 rounded-xl text-xs font-bold gap-1.5 text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200"
            >
              <Megaphone className="h-3.5 w-3.5" /> Gửi thông báo
            </Button>
          )}
        </div>
      </div>

      {/* Top Comprehensive Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Card 1: Doanh thu */}
        <Card className="rounded-2xl border shadow-xs hover:shadow-md transition-all">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Doanh thu thực tế</span>
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-emerald-600">
              {canViewRevenue ? formatCurrency(totalRevenue) : '****** ₫'}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Dự kiến: <span className="font-bold">{canViewRevenue ? formatCurrency(totalExpectedRevenue) : '***'}</span>
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Khách hàng & Tỉ lệ chốt */}
        <Card className="rounded-2xl border shadow-xs hover:shadow-md transition-all">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Khách hàng / Tỉ lệ</span>
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-blue-600">
              {filteredCustomers.length} <span className="text-xs font-bold text-muted-foreground">khách</span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Tỉ lệ chốt: <span className="font-bold text-blue-700">{conversionRate}%</span>
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Dự án triển khai */}
        <Card className="rounded-2xl border shadow-xs hover:shadow-md transition-all">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Dự án triển khai</span>
              <Target className="h-4 w-4 text-purple-600" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-purple-600">
              {filteredProjects.length} <span className="text-xs font-bold text-muted-foreground">công trình</span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Báo giá gửi: <span className="font-bold">{filteredQuotations.length}</span>
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Vật tư & Kho */}
        <Card className="rounded-2xl border shadow-xs hover:shadow-md transition-all">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Vốn hàng tồn kho</span>
              <Boxes className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-amber-600 truncate" title={`${totalInventoryValue.toLocaleString('vi-VN')} ₫`}>
              {formatCurrency(totalInventoryValue)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Cảnh báo thiếu: <span className={`font-bold ${lowStockCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{lowStockCount} mã</span>
            </p>
          </CardContent>
        </Card>

        {/* Card 5: Hiệu suất & Trễ hạn */}
        <Card className="rounded-2xl border shadow-xs hover:shadow-md transition-all">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Nhiệm vụ / Trễ hạn</span>
              <CheckCircle2 className="h-4 w-4 text-indigo-600" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-indigo-600">
              {filteredTasks.length} <span className="text-xs font-bold text-muted-foreground">việc</span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Quá hạn: <span className={`font-bold ${overdueTasksList.length > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{overdueTasksList.length} việc</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Urgent Overdue Alert Banner */}
      {overdueTasksList.length > 0 && (
        <div className="p-4 bg-red-50/80 border border-red-200 rounded-2xl shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5 flex-none" />
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  Cảnh báo: Có {overdueTasksList.length} nhiệm vụ đang trễ hạn
                </h4>
                <p className="text-[11px] text-red-600 font-medium mt-0.5">
                  Vui lòng kiểm tra và xử lý gấp để tránh chậm tiến độ sản xuất và lắp đặt của khách hàng.
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
            {overdueTasksList.slice(0, 3).map(task => (
              <div key={task.id} className="p-2.5 bg-white border border-red-100 rounded-xl flex items-center justify-between">
                <div className="min-w-0 pr-2">
                  <p className="font-bold text-xs text-slate-800 truncate">{task.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    Hạn: {task.dueDate ? new Date(task.dueDate).toLocaleDateString('vi-VN') : 'Chưa rõ'}
                  </p>
                </div>
                {setActiveTab && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-7 text-[10px] px-2 rounded-lg text-red-700 border-red-200 hover:bg-red-50 font-bold"
                    onClick={() => setActiveTab(task.type === 'production' ? 'production' : 'sale')}
                  >
                    Xử lý ngay
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Smart Insights */}
      <SmartInsights tasks={tasks} customers={customers} quotations={quotations} />

      {/* Navigation Sub-Tabs by Functional Areas */}
      <Tabs value={activeSubTab} onValueChange={(val: any) => setActiveSubTab(val)} className="space-y-4">
        <TabsList className="bg-card border p-1 rounded-2xl shadow-xs flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="rounded-xl text-xs font-bold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <LayoutDashboard className="h-3.5 w-3.5" /> Tổng quan điều hành
          </TabsTrigger>
          <TabsTrigger value="sales" className="rounded-xl text-xs font-bold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <DollarSign className="h-3.5 w-3.5" /> Kinh doanh & Báo giá
          </TabsTrigger>
          <TabsTrigger value="production" className="rounded-xl text-xs font-bold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Hammer className="h-3.5 w-3.5" /> Sản xuất & Thi công
          </TabsTrigger>
          <TabsTrigger value="inventory" className="rounded-xl text-xs font-bold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Boxes className="h-3.5 w-3.5" /> Vật tư & Kho
          </TabsTrigger>
          <TabsTrigger value="hr" className="rounded-xl text-xs font-bold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Award className="h-3.5 w-3.5" /> Nhân sự & KPI
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: TỔNG QUAN ĐIỀU HÀNH */}
        <TabsContent value="overview" className="space-y-4 m-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Revenue Trend Chart */}
            <Card className="lg:col-span-2 rounded-2xl border shadow-xs">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-primary" /> Tăng trưởng doanh thu
                </CardTitle>
                <CardDescription className="text-xs">
                  Biểu đồ giá trị hợp đồng theo ngày phát sinh trong tháng.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="h-[260px] w-full mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueByDayData}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={val => `${val / 1000000}M`} />
                      <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                      <Area type="monotone" dataKey="revenue" stroke="#0ea5e9" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" name="Doanh thu" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Customer Funnel */}
            <Card className="rounded-2xl border shadow-xs">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <Target className="h-4 w-4 text-purple-600" /> Phễu khách hàng
                </CardTitle>
                <CardDescription className="text-xs">
                  Tỉ lệ chuyển đổi qua từng giai đoạn dự án.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <div className="space-y-2">
                  {customerFunnelData.map((stage) => (
                    <div key={stage.name} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-muted-foreground">{stage.name}</span>
                        <span className="font-bold text-foreground">{stage.count} khách</span>
                      </div>
                      <div className="h-2 bg-secondary/50 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-500 rounded-full transition-all"
                          style={{ width: `${Math.max(5, (stage.count / Math.max(1, filteredCustomers.length)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Workload by Department */}
            <Card className="rounded-2xl border shadow-xs">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4 text-blue-600" /> Phân bổ việc theo phòng ban
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="h-[220px] w-full mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={departmentWorkloadData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Số lượng việc" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Task Status Breakdown */}
            <Card className="rounded-2xl border shadow-xs">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Trạng thái công việc
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="h-[220px] w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusDistributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {statusDistributionData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: KINH DOANH & BÁO GIÁ */}
        <TabsContent value="sales" className="space-y-4 m-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Top Sales Leaderboard */}
            <Card className="lg:col-span-2 rounded-2xl border shadow-xs">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <Crown className="h-4 w-4 text-amber-500" /> Thành tích chốt đơn Sale
                </CardTitle>
                <CardDescription className="text-xs">
                  Bảng xếp hạng doanh số và số hợp đồng theo nhân sự kinh doanh.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <div className="space-y-3">
                  {topSalePerformers.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-4 text-center">Chưa có dữ liệu chốt đơn trong kỳ này.</p>
                  ) : (
                    topSalePerformers.map((sp, idx) => (
                      <div key={sp.id} className="p-3 bg-secondary/10 border rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${idx === 0 ? 'bg-amber-100 text-amber-700' : idx === 1 ? 'bg-slate-200 text-slate-700' : 'bg-orange-100 text-orange-700'}`}>
                            {idx + 1}
                          </span>
                          <div>
                            <p className="font-bold text-sm text-foreground">{sp.name}</p>
                            <p className="text-[10px] text-muted-foreground">Hoàn thành: {sp.completedTasks} việc | Đúng hạn: {sp.onTimeRate}%</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-sm text-emerald-600">{formatCurrency(sp.revenue)}</p>
                          <span className="text-[10px] font-bold text-muted-foreground">Điểm KPI: {sp.kpiScore}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Customer Source Distribution */}
            <Card className="rounded-2xl border shadow-xs">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <Filter className="h-4 w-4 text-blue-600" /> Nguồn khách hàng
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="h-[240px] w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sourceDistributionData}
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {sourceDistributionData.map((_, index) => (
                          <Cell key={`cell-src-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 3: SẢN XUẤT, ĐO ĐẠC & THI CÔNG */}
        <TabsContent value="production" className="space-y-4 m-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="rounded-2xl border p-4 bg-purple-50/40 border-purple-200">
              <div className="flex items-center gap-2 text-purple-700 font-bold text-xs uppercase">
                <CalendarDays className="h-4 w-4" /> Lịch Đo Đạc
              </div>
              <p className="text-2xl font-black text-purple-700 mt-2">{schedules.length}</p>
              <p className="text-[11px] text-purple-600 mt-0.5">
                Đã đo: {schedules.filter((s: any) => s.status === 'completed').length} | Chờ đo: {schedules.filter((s: any) => s.status !== 'completed').length}
              </p>
            </Card>

            <Card className="rounded-2xl border p-4 bg-emerald-50/40 border-emerald-200">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase">
                <Package className="h-4 w-4" /> Xưởng Sản Xuất
              </div>
              <p className="text-2xl font-black text-emerald-700 mt-2">
                {customers.filter(c => c.stage === 'production').length}
              </p>
              <p className="text-[11px] text-emerald-600 mt-0.5">Dự án đang tại xưởng gia công</p>
            </Card>

            <Card className="rounded-2xl border p-4 bg-orange-50/40 border-orange-200">
              <div className="flex items-center gap-2 text-orange-700 font-bold text-xs uppercase">
                <Wrench className="h-4 w-4" /> Lắp Đặt & Thi Công
              </div>
              <p className="text-2xl font-black text-orange-700 mt-2">{installations.length}</p>
              <p className="text-[11px] text-orange-600 mt-0.5">Lịch thi công công trình thực tế</p>
            </Card>
          </div>

          <Card className="rounded-2xl border shadow-xs">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                <Hammer className="h-4 w-4 text-primary" /> Dự án đang triển khai thực tế
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="divide-y text-xs font-medium">
                {filteredProjects.length === 0 ? (
                  <p className="py-6 text-center text-muted-foreground italic">Không có dự án nào trong giai đoạn này.</p>
                ) : (
                  filteredProjects.slice(0, 6).map(project => (
                    <div key={project.id} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-sm text-foreground">{project.name}</p>
                        <p className="text-muted-foreground text-[10px]">
                          Địa chỉ: {project.address || 'Chưa rõ'} | SĐT: {project.phone || 'Chưa rõ'}
                        </p>
                      </div>
                      <Badge className={
                        project.stage === 'production' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        project.stage === 'installation' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                        'bg-blue-50 text-blue-700 border-blue-200'
                      }>
                        {project.stage === 'production' ? 'Đang Sản Xuất' :
                         project.stage === 'installation' ? 'Đang Lắp Đặt' : 'Hoàn Thành'}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: VẬT TƯ & KHO */}
        <TabsContent value="inventory" className="space-y-4 m-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="rounded-2xl border p-4 bg-amber-50/40 border-amber-200">
              <span className="text-xs font-extrabold text-amber-700 uppercase">Tổng giá trị tồn kho</span>
              <p className="text-2xl font-black text-amber-700 mt-1">{formatCurrency(totalInventoryValue)}</p>
              <p className="text-[10px] text-amber-600 mt-0.5">Quy đổi toàn bộ vật tư & phụ kiện</p>
            </Card>
            <Card className="rounded-2xl border p-4 bg-blue-50/40 border-blue-200">
              <span className="text-xs font-extrabold text-blue-700 uppercase">Tổng số mặt hàng</span>
              <p className="text-2xl font-black text-blue-700 mt-1">{materials.length + accessories.length} mã</p>
              <p className="text-[10px] text-blue-600 mt-0.5">Nhựa: {materials.length} | Phụ kiện: {accessories.length}</p>
            </Card>
            <Card className="rounded-2xl border p-4 bg-red-50/40 border-red-200">
              <span className="text-xs font-extrabold text-red-700 uppercase">Cảnh báo thiếu hụt</span>
              <p className="text-2xl font-black text-red-700 mt-1">{lowStockCount} mã</p>
              <p className="text-[10px] text-red-600 mt-0.5">Chạm hoặc dưới hạn mức tối thiểu</p>
            </Card>
          </div>

          <Card className="rounded-2xl border shadow-xs">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-red-600" /> Mặt hàng cần nhập kho gấp
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="divide-y text-xs">
                {materials.filter(m => (m.stock || 0) <= (m.minStock || 0)).slice(0, 5).map(item => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-foreground">{item.name || `Tấm nhựa mã ${item.code}`}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">Mã: {item.code} | ĐVT: {item.unit || 'Hộp'}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-red-600 text-sm">{item.stock || 0}</span>
                      <span className="text-[10px] text-muted-foreground"> / Tối thiểu {item.minStock || 5}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: NHÂN SỰ & KPI */}
        <TabsContent value="hr" className="space-y-4 m-0">
          <Card className="rounded-2xl border shadow-xs">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                <Award className="h-4 w-4 text-primary" /> Bảng xếp hạng nhân viên xuất sắc
              </CardTitle>
              <CardDescription className="text-xs">
                Đánh giá toàn diện dựa trên số lượng công việc, tỷ lệ đúng hạn và điểm tích lũy KPI.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <div className="divide-y text-xs font-medium">
                {memberStats.map((member, idx) => (
                  <div 
                    key={member.id} 
                    className="py-3 flex items-center justify-between hover:bg-secondary/10 px-2 rounded-xl cursor-pointer transition-all"
                    onClick={() => setSelectedMemberId(member.id)}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${idx === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>
                        {idx + 1}
                      </span>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.avatar} />
                        <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-bold text-sm text-foreground">{member.name}</p>
                        <span className="text-[10px] text-muted-foreground font-semibold">{member.role}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <p className="font-bold text-foreground">{member.completedTasks}/{member.totalTasks}</p>
                        <p className="text-[10px] text-muted-foreground">Việc xong</p>
                      </div>
                      <div>
                        <p className="font-bold text-emerald-600">{member.onTimeRate}%</p>
                        <p className="text-[10px] text-muted-foreground">Đúng hạn</p>
                      </div>
                      <div>
                        <p className="font-black text-primary text-sm">{member.kpiScore}</p>
                        <p className="text-[10px] text-muted-foreground">Điểm KPI</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Member Details Modal */}
      {selectedMemberId && (() => {
        const member = memberStats.find(m => m.id === selectedMemberId);
        if (!member) return null;
        return (
          <Dialog open={!!selectedMemberId} onOpenChange={() => setSelectedMemberId(null)}>
            <DialogContent className="max-w-[600px] rounded-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={member.avatar} />
                    <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  {member.name} ({member.role})
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Chi tiết đóng góp và lịch sử hoàn thành nhiệm vụ tích lũy điểm KPI.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 bg-secondary/20 rounded-xl">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase">Hoàn thành</span>
                    <p className="text-lg font-black text-foreground">{member.completedTasks}</p>
                  </div>
                  <div className="p-2.5 bg-secondary/20 rounded-xl">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase">Tỉ lệ đúng hạn</span>
                    <p className="text-lg font-black text-emerald-600">{member.onTimeRate}%</p>
                  </div>
                  <div className="p-2.5 bg-secondary/20 rounded-xl">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase">Điểm KPI</span>
                    <p className="text-lg font-black text-primary">{member.kpiScore}</p>
                  </div>
                </div>

                <div className="border rounded-xl p-3 max-h-[300px] overflow-y-auto space-y-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase">Nhật ký nhiệm vụ gần nhất</p>
                  {member.itemsHistory.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-3 text-center">Chưa có nhiệm vụ hoàn thành trong kỳ này.</p>
                  ) : (
                    member.itemsHistory.map((item: any) => (
                      <div key={item.id} className="p-2 bg-card border rounded-lg flex items-center justify-between text-xs">
                        <div>
                          <p className="font-semibold text-foreground">{item.title}</p>
                          <p className="text-[10px] text-muted-foreground">{item.customer} | {item.timestamp ? new Date(item.timestamp).toLocaleDateString('vi-VN') : ''}</p>
                        </div>
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                          +{item.points}đ
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Announcement Dialog */}
      <Dialog open={isAnnouncementOpen} onOpenChange={setIsAnnouncementOpen}>
        <DialogContent className="max-w-[500px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-blue-600" />
              Gửi Thông Báo Toàn Công Ty
            </DialogTitle>
            <DialogDescription className="text-xs">
              Thông báo sẽ được gửi qua popup & thông báo đẩy đến tất cả nhân viên.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Đối tượng nhận *</Label>
              <Select value={announcementTarget} onValueChange={(val: any) => setAnnouncementTarget(val)}>
                <SelectTrigger className="h-10 rounded-xl text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toàn bộ nhân sự công ty</SelectItem>
                  <SelectItem value="sale">Phòng Kinh Doanh (Sale)</SelectItem>
                  <SelectItem value="design">Phòng Thiết Kế</SelectItem>
                  <SelectItem value="production">Xưởng Sản Xuất</SelectItem>
                  <SelectItem value="installation">Đội Thi Công</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Nội dung thông báo *</Label>
              <Textarea 
                placeholder="Nhập thông điệp cần truyền đạt..."
                rows={4}
                value={announcementText}
                onChange={e => setAnnouncementText(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsAnnouncementOpen(false)} className="rounded-xl">
              Hủy
            </Button>
            <Button 
              onClick={handleSendAnnouncement} 
              disabled={isSendingAnnouncement}
              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
            >
              Gửi ngay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
