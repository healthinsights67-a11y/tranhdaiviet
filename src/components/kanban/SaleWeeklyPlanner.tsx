import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Task, Member, Customer, Status, WORKSHOPS } from '@/src/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Check,
  Circle,
  CalendarDays,
  ClipboardList,
  MoreHorizontal,
  Phone,
  User,
  Tag,
  Search,
  SlidersHorizontal,
  Inbox,
  Clock,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  db,
  collection,
  addDoc,
  updateDoc,
  doc,
  handleFirestoreError,
  OperationType,
} from '@/src/lib/firebase';
import { TaskCard } from './TaskCard';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/src/lib/utils';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const DAYS_VN = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const DAYS_FULL_VN = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

function getWeekDays(baseDate: Date): Date[] {
  const day = baseDate.getDay(); // 0=Sun
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - ((day + 6) % 7)); // Monday
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDayLabel(d: Date) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatWeekRange(days: Date[]) {
  const first = days[0];
  const last = days[6];
  const fmtShort = (d: Date) =>
    `${d.getDate()}/${d.getMonth() + 1}`;
  return `${fmtShort(first)} – ${fmtShort(last)}/${last.getFullYear()}`;
}

function isToday(d: Date) {
  const today = new Date();
  return toDateStr(d) === toDateStr(today);
}

// ─── Stage config ──────────────────────────────────────────────────────────────

const SALE_STAGES: { id: Status; label: string; color: string; bg: string }[] = [
  { id: 'todo',        label: 'Tiếp nhận Lead',   color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200' },
  { id: 'in-progress', label: 'Tư vấn & Báo giá', color: 'text-violet-600', bg: 'bg-violet-50 border-violet-200' },
  { id: 'review',      label: 'Chốt đơn & Cọc',   color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-200' },
  { id: 'done',        label: 'Bàn giao KT',       color: 'text-emerald-600',bg: 'bg-emerald-50 border-emerald-200' },
];

const PRIORITY_COLORS: Record<string, string> = {
  high:   'bg-rose-500',
  medium: 'bg-amber-400',
  low:    'bg-slate-300',
};

function StageChip({ status }: { status: Status }) {
  const stage = SALE_STAGES.find(s => s.id === status) ?? SALE_STAGES[0];
  return (
    <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded-full border', stage.bg, stage.color)}>
      {stage.label}
    </span>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface SaleWeeklyPlannerProps {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  members: Member[];
  customers?: Customer[];
  user?: any;
  currentUser?: any;
}

// ─── Task Item row ─────────────────────────────────────────────────────────────

function TaskRow({
  task,
  members,
  customers,
  onToggleDone,
  onOpenDetail,
}: {
  task: Task;
  members: Member[];
  customers?: Customer[];
  onToggleDone: (task: Task) => void;
  onOpenDetail: (task: Task) => void;
}) {
  const assignee = members.find(m => m.id === task.assigneeId);
  const customer = customers?.find(c => c.id === task.customerId);
  const done = task.status === 'done';

  return (
    <div
      className={cn(
        'group flex items-start gap-2 px-2.5 py-2 rounded-xl border transition-all cursor-pointer hover:shadow-sm',
        done
          ? 'bg-secondary/30 border-border/40 opacity-60'
          : 'bg-card border-border hover:border-primary/30 hover:bg-primary/[0.02]'
      )}
      onClick={() => onOpenDetail(task)}
    >
      {/* Checkbox */}
      <button
        className={cn(
          'mt-0.5 shrink-0 h-4 w-4 rounded-full border-2 flex items-center justify-center transition-all',
          done
            ? 'bg-emerald-500 border-emerald-500 text-white'
            : 'border-border hover:border-emerald-400'
        )}
        onClick={e => { e.stopPropagation(); onToggleDone(task); }}
      >
        {done && <Check className="h-2.5 w-2.5" />}
      </button>

      <div className="flex-1 min-w-0">
        {/* Title */}
        <p className={cn('text-xs font-medium leading-tight truncate', done && 'line-through text-muted-foreground')}>
          {task.title.replace(/^(Sale|Thiết kế|Tư vấn):\s*/i, '')}
        </p>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          <StageChip status={task.status} />
          {customer && (
            <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
              <User className="h-2.5 w-2.5" /> {customer.name}
            </span>
          )}
          {task.priority && (
            <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', PRIORITY_COLORS[task.priority])} title={task.priority} />
          )}
        </div>
      </div>

      {/* Assignee */}
      {assignee && (
        <Avatar className="h-5 w-5 shrink-0">
          <AvatarImage src={assignee.avatar} />
          <AvatarFallback className="text-[8px]">{assignee.name.charAt(0)}</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}

// ─── Day Column ────────────────────────────────────────────────────────────────

function DayColumn({
  date,
  tasks,
  members,
  customers,
  onToggleDone,
  onOpenDetail,
  onAddTask,
}: {
  date: Date;
  tasks: Task[];
  members: Member[];
  customers?: Customer[];
  onToggleDone: (task: Task) => void;
  onOpenDetail: (task: Task) => void;
  onAddTask: (date: string) => void;
}) {
  const today = isToday(date);
  const dayIdx = date.getDay();
  const doneCount = tasks.filter(t => t.status === 'done').length;
  const totalCount = tasks.length;

  return (
    <div
      className={cn(
        'flex flex-col rounded-2xl border min-w-[190px] max-w-[220px] flex-1 overflow-hidden transition-all',
        today
          ? 'border-primary/40 bg-primary/[0.03] shadow-md shadow-primary/10'
          : 'border-border bg-card/60'
      )}
    >
      {/* Day header */}
      <div className={cn('px-3 py-2.5 border-b', today ? 'border-primary/20 bg-primary/5' : 'border-border/50 bg-secondary/30')}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className={cn('text-xs font-bold', today ? 'text-primary' : 'text-foreground')}>
              {DAYS_FULL_VN[dayIdx]}
            </span>
            {today && (
              <span className="text-[9px] font-semibold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                Hôm nay
              </span>
            )}
          </div>
          {totalCount > 0 && (
            <span className="text-[9px] text-muted-foreground font-medium">
              {doneCount}/{totalCount}
            </span>
          )}
        </div>
        <p className={cn('text-[10px] mt-0.5', today ? 'text-primary/70' : 'text-muted-foreground')}>
          {formatDayLabel(date)}
        </p>
      </div>

      {/* Task list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-1.5 p-2">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Circle className="h-5 w-5 text-border mb-1.5" />
              <p className="text-[10px] text-muted-foreground/60">Trống</p>
            </div>
          ) : (
            tasks.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                members={members}
                customers={customers}
                onToggleDone={onToggleDone}
                onOpenDetail={onOpenDetail}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Add button */}
      <div className="p-2 border-t border-border/40">
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-7 text-[10px] text-muted-foreground hover:text-primary hover:bg-primary/5 gap-1"
          onClick={() => onAddTask(toDateStr(date))}
        >
          <Plus className="h-3 w-3" /> Thêm việc
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function SaleWeeklyPlanner({
  tasks,
  setTasks,
  members,
  customers,
  user,
  currentUser,
}: SaleWeeklyPlannerProps) {
  const queryClient = useQueryClient();
  const today = new Date();

  // Week navigation
  const [weekBase, setWeekBase] = React.useState<Date>(() => {
    const d = new Date();
    return d;
  });
  const weekDays = React.useMemo(() => getWeekDays(weekBase), [weekBase]);

  // Mobile: selected day tab
  const todayStr = toDateStr(today);
  const todayInWeek = weekDays.find(d => toDateStr(d) === todayStr);
  const [selectedDay, setSelectedDay] = React.useState<string>(() => todayStr);

  // Search / filter
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState<string>('all');
  const [filterAssignee, setFilterAssignee] = React.useState<string>('all');

  // Detail dialog
  const [detailTask, setDetailTask] = React.useState<Task | null>(null);

  // Add task dialog
  const [addDialogDate, setAddDialogDate] = React.useState<string | null>(null);
  const [newTask, setNewTask] = React.useState({
    title: '',
    description: '',
    assigneeId: members[0]?.id || '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    status: 'todo' as Status,
  });
  const [isSaving, setIsSaving] = React.useState(false);

  const handleOpenAddDialog = (dateStr: string) => {
    setAddDialogDate(dateStr);
    setNewTask({
      title: '',
      description: '',
      assigneeId: currentUser?.id || members[0]?.id || '',
      priority: 'medium',
      status: 'todo',
    });
  };

  // Filter tasks for a given date
  const getTasksForDay = React.useCallback(
    (dateStr: string) => {
      return tasks.filter(t => {
        if (t.scheduledDate !== dateStr) return false;
        if (filterStatus !== 'all' && t.status !== filterStatus) return false;
        if (filterAssignee !== 'all' && t.assigneeId !== filterAssignee) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          if (!t.title.toLowerCase().includes(q) && !(t.description || '').toLowerCase().includes(q)) return false;
        }
        return true;
      });
    },
    [tasks, filterStatus, filterAssignee, searchQuery]
  );

  // Unscheduled tasks
  const unscheduledTasks = React.useMemo(() => {
    const weekDateStrs = new Set(weekDays.map(toDateStr));
    return tasks.filter(t => {
      if (t.scheduledDate && weekDateStrs.has(t.scheduledDate)) return false; // scheduled this week
      if (t.scheduledDate) return false; // scheduled other week — hide
      if (filterStatus !== 'all' && t.status !== filterStatus) return false;
      if (filterAssignee !== 'all' && t.assigneeId !== filterAssignee) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !(t.description || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [tasks, weekDays, filterStatus, filterAssignee, searchQuery]);

  // Toggle task done/todo
  const handleToggleDone = async (task: Task) => {
    const newStatus: Status = task.status === 'done' ? 'todo' : 'done';
    const updateData: any = {
      status: newStatus,
      ...(newStatus === 'done' ? { completedAt: new Date().toISOString() } : { completedAt: null }),
    };

    // Optimistic
    queryClient.setQueryData(['tasks'], (prev: Task[] = []) =>
      prev.map(t => (t.id === task.id ? { ...t, ...updateData } : t))
    );

    if (user) {
      try {
        await updateDoc(doc(db, 'tasks', task.id), updateData);
      } catch (err: any) {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        handleFirestoreError(err, OperationType.UPDATE, `tasks/${task.id}`);
      }
    }
  };

  // Create task
  const handleCreateTask = async () => {
    if (!newTask.title.trim()) {
      toast.error('Vui lòng nhập tiêu đề công việc');
      return;
    }
    if (!addDialogDate) return;

    setIsSaving(true);
    const taskData = {
      ...newTask,
      title: newTask.title.trim(),
      description: newTask.description.trim(),
      type: 'sale' as const,
      scheduledDate: addDialogDate,
      dueDate: addDialogDate,
      createdAt: new Date().toISOString(),
      files2D3D: [],
      checklists: [],
      materialList: [],
    };

    try {
      if (user) {
        await addDoc(collection(db, 'tasks'), taskData);
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      } else {
        const local: Task = { id: `task-${Date.now()}`, ...taskData };
        queryClient.setQueryData(['tasks'], (prev: Task[] = []) => [local, ...prev]);
      }
      toast.success('Đã thêm công việc!');
      setAddDialogDate(null);
    } catch (err: any) {
      toast.error('Lỗi khi tạo công việc: ' + (err.message || 'Thử lại'));
    } finally {
      setIsSaving(false);
    }
  };

  // Week nav
  const changeWeek = (delta: number) => {
    setWeekBase(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta * 7);
      return d;
    });
  };

  const goToday = () => {
    setWeekBase(new Date());
    setSelectedDay(toDateStr(new Date()));
  };

  // Stats for header
  const weekTasks = tasks.filter(t => t.scheduledDate && weekDays.some(d => toDateStr(d) === t.scheduledDate));
  const weekDone = weekTasks.filter(t => t.status === 'done').length;

  // Export report professional excel
  const handleExportReport = async () => {
    // Determine which tasks to export based on current filters and visible week
    let tasksToExport = tasks.filter(t => {
      if (filterStatus !== 'all' && t.status !== filterStatus) return false;
      if (filterAssignee !== 'all' && t.assigneeId !== filterAssignee) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !(t.description || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });

    if (tasksToExport.length === 0) {
      toast.error('Không có dữ liệu để xuất');
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Báo cáo Kế hoạch tuần');

      // Add Title
      worksheet.mergeCells('A1:I1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = `BÁO CÁO KẾ HOẠCH TUẦN - BỘ PHẬN SALE`;
      titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0070C0' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 35;

      // Add subtitle
      worksheet.mergeCells('A2:I2');
      const subTitleCell = worksheet.getCell('A2');
      subTitleCell.value = `Ngày xuất báo cáo: ${new Date().toLocaleString('vi-VN')}`;
      subTitleCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF595959' } };
      subTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(2).height = 20;

      // Add blank row
      worksheet.addRow([]);

      // Headers
      const headers = ['STT', 'Tiêu đề', 'Khách hàng', 'Mô tả', 'Giai đoạn', 'Ưu tiên', 'Người thực hiện', 'Ngày lên lịch', 'Trạng thái/Thời gian hoàn thành'];
      const headerRow = worksheet.addRow(headers);
      
      headerRow.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF366092' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
          left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
          bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
          right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
        };
      });
      headerRow.height = 30;

      // Define columns width
      worksheet.columns = [
        { width: 8 },  // STT
        { width: 35 }, // Tiêu đề
        { width: 25 }, // Khách hàng
        { width: 45 }, // Mô tả
        { width: 20 }, // Giai đoạn
        { width: 15 }, // Ưu tiên
        { width: 25 }, // Người thực hiện
        { width: 18 }, // Ngày lên lịch
        { width: 25 }, // Hoàn thành lúc
      ];

      // Add data
      tasksToExport.forEach((t, index) => {
        const stage = SALE_STAGES.find(s => s.id === t.status)?.label || t.status;
        const assignee = members.find(m => m.id === t.assigneeId)?.name || 'Chưa giao';
        const customer = customers?.find(c => c.id === t.customerId)?.name || '';
        const priority = t.priority === 'high' ? 'Cao' : t.priority === 'medium' ? 'Trung bình' : 'Thấp';
        const completedAt = t.status === 'done' ? (t.completedAt ? new Date(t.completedAt).toLocaleString('vi-VN') : 'Đã hoàn thành') : 'Chưa hoàn thành';

        const row = worksheet.addRow([
          index + 1,
          t.title,
          customer,
          t.description || '',
          stage,
          priority,
          assignee,
          t.scheduledDate ? new Date(t.scheduledDate).toLocaleDateString('vi-VN') : 'Chưa lên lịch',
          completedAt
        ]);

        row.eachCell((cell, colNumber) => {
          cell.font = { name: 'Arial', size: 10 };
          cell.alignment = { 
            vertical: 'middle', 
            horizontal: (colNumber === 1 || colNumber === 5 || colNumber === 6 || colNumber === 8 || colNumber === 9) ? 'center' : 'left',
            wrapText: true 
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
            left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
            bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
            right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
          };

          // Colorize priority
          if (colNumber === 6) { // priority
            if (t.priority === 'high') {
              cell.font = { ...cell.font, color: { argb: 'FFC00000' }, bold: true };
            } else if (t.priority === 'medium') {
              cell.font = { ...cell.font, color: { argb: 'FFE36C09' }, bold: true };
            } else {
              cell.font = { ...cell.font, color: { argb: 'FF00B050' } };
            }
          }
          
          // Colorize status
          if (colNumber === 5 || colNumber === 9) {
            if (t.status === 'done') cell.font = { ...cell.font, color: { argb: 'FF00B050' }, bold: true };
            else if (t.status === 'in-progress') cell.font = { ...cell.font, color: { argb: 'FF0070C0' }, bold: true };
          }
        });
      });

      // Save file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `Bao_cao_KH_Tuan_Sale_${toDateStr(new Date())}.xlsx`);
      
      toast.success('Đã xuất báo cáo chuyên nghiệp thành công');
    } catch (error) {
      console.error('Lỗi xuất file Excel:', error);
      toast.error('Có lỗi xảy ra khi xuất báo cáo');
    }
  };

  return (
    <div className="h-full flex flex-col gap-3">
      {/* ── Header ── */}
      <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
        {/* Left: title + stats */}
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <h1 className="text-lg md:text-2xl font-bold tracking-tight">Kế hoạch tuần</h1>
          </div>
          <p className="text-muted-foreground text-[10px] md:text-sm flex items-center gap-2">
            {formatWeekRange(weekDays)}
            {weekTasks.length > 0 && (
              <span className="text-xs font-medium text-primary">
                · {weekDone}/{weekTasks.length} hoàn thành
              </span>
            )}
          </p>
        </div>

        {/* Right: controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Tìm công việc..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 h-8 w-[140px] md:w-48 text-xs"
            />
          </div>

          {/* Filter popover */}
          <Popover>
            <PopoverTrigger className="inline-flex items-center justify-center gap-1.5 text-xs border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 rounded-md px-3 font-medium transition-colors">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Lọc
              {(filterStatus !== 'all' || filterAssignee !== 'all') && (
                <span className="h-2 w-2 rounded-full bg-primary" />
              )}
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3 space-y-3" align="end">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Giai đoạn</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-9 text-xs rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">Tất cả</SelectItem>
                    {SALE_STAGES.map(s => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Người thực hiện</Label>
                <Select value={filterAssignee} onValueChange={setFilterAssignee}>
                  <SelectTrigger className="h-9 text-xs rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">Tất cả</SelectItem>
                    {members.map(m => (
                      <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(filterStatus !== 'all' || filterAssignee !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs text-destructive"
                  onClick={() => { setFilterStatus('all'); setFilterAssignee('all'); }}
                >
                  Xóa bộ lọc
                </Button>
              )}
            </PopoverContent>
          </Popover>

          {/* Week nav */}
          <div className="flex items-center gap-0.5 bg-secondary rounded-xl px-1 py-0.5 border border-border">
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => changeWeek(-1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <button
              onClick={goToday}
              className="text-[10px] font-bold px-1 hover:text-primary transition-colors whitespace-nowrap cursor-pointer"
            >
              {formatWeekRange(weekDays)}
            </button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => changeWeek(1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Export Report */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
            onClick={handleExportReport}
          >
            <Download className="h-3.5 w-3.5" /> Xuất báo cáo
          </Button>

          {/* Add task */}
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => handleOpenAddDialog(toDateStr(today))}
          >
            <Plus className="h-3.5 w-3.5" /> Thêm việc
          </Button>
        </div>
      </div>

      {/* ── Mobile: Day Tabs ── */}
      <div className="flex md:hidden gap-2 overflow-x-auto pb-2 px-1 scrollbar-none snap-x">
        {weekDays.map(d => {
          const ds = toDateStr(d);
          const cnt = getTasksForDay(ds).length;
          const td = isToday(d);
          return (
            <button
              key={ds}
              onClick={() => setSelectedDay(ds)}
              className={cn(
                'shrink-0 snap-start flex flex-col items-center min-w-[64px] px-3 py-2.5 rounded-xl border transition-all duration-200',
                selectedDay === ds
                  ? 'bg-primary text-primary-foreground border-primary shadow-md scale-105'
                  : td
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-card border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <span className="uppercase text-[9px] font-medium mb-0.5 opacity-80">{DAYS_VN[d.getDay()]}</span>
              <span className="font-bold text-sm leading-none">{d.getDate()}</span>
              {cnt > 0 && (
                <span className={cn('mt-1.5 text-[9px] font-bold rounded-full px-1.5 py-0.5 leading-none', selectedDay === ds ? 'bg-white/20' : 'bg-primary/10 text-primary')}>
                  {cnt}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Desktop: Weekly grid + Mobile: Single day ── */}
      <div className="flex-1 min-h-0 flex gap-3 overflow-hidden">
        {/* Desktop columns */}
        <div className="hidden md:flex gap-2.5 flex-1 min-h-0 overflow-x-auto pb-2">
          {weekDays.map(d => {
            const ds = toDateStr(d);
            return (
              <DayColumn
                key={ds}
                date={d}
                tasks={getTasksForDay(ds)}
                members={members}
                customers={customers}
                onToggleDone={handleToggleDone}
                onOpenDetail={setDetailTask}
                onAddTask={handleOpenAddDialog}
              />
            );
          })}

          {/* Unscheduled panel */}
          {unscheduledTasks.length > 0 && (
            <div className="flex flex-col rounded-2xl border border-dashed border-border/80 bg-secondary/20 min-w-[190px] max-w-[220px] flex-none overflow-hidden">
              <div className="px-3 py-2.5 border-b border-border/50">
                <div className="flex items-center gap-1.5">
                  <Inbox className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-bold text-muted-foreground">Chưa lên lịch</span>
                </div>
                <p className="text-[9px] text-muted-foreground mt-0.5">{unscheduledTasks.length} việc</p>
              </div>
              <ScrollArea className="flex-1 min-h-0">
                <div className="flex flex-col gap-1.5 p-2">
                  {unscheduledTasks.map(task => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      members={members}
                      customers={customers}
                      onToggleDone={handleToggleDone}
                      onOpenDetail={setDetailTask}
                    />
                  ))}
                </div>
              </ScrollArea>
              <div className="p-2 border-t border-border/40">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-[10px] text-muted-foreground hover:text-primary hover:bg-primary/5 gap-1"
                  onClick={() => handleOpenAddDialog(toDateStr(today))}
                >
                  <Plus className="h-3 w-3" /> Thêm việc
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Mobile: single day view */}
        <div className="flex md:hidden flex-col flex-1 min-h-0 overflow-hidden rounded-2xl border border-border bg-card">
          {(() => {
            const selDate = weekDays.find(d => toDateStr(d) === selectedDay) ?? weekDays[0];
            const selTasks = getTasksForDay(toDateStr(selDate));
            return (
              <>
                <div className={cn('px-4 py-3 border-b', isToday(selDate) ? 'bg-primary/5 border-primary/20' : 'bg-secondary/30 border-border/50')}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className={cn('text-sm font-bold', isToday(selDate) ? 'text-primary' : '')}>
                        {DAYS_FULL_VN[selDate.getDay()]}
                        {isToday(selDate) && <span className="ml-2 text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">Hôm nay</span>}
                      </span>
                      <p className="text-xs text-muted-foreground">{formatDayLabel(selDate)}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{selTasks.filter(t => t.status === 'done').length}/{selTasks.length}</span>
                  </div>
                </div>
                <ScrollArea className="flex-1 min-h-0">
                  <div className="flex flex-col gap-2 p-3">
                    {selTasks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Circle className="h-8 w-8 text-border mb-2" />
                        <p className="text-sm text-muted-foreground">Không có việc nào</p>
                        <p className="text-xs text-muted-foreground/60 mt-0.5">Nhấn "+ Thêm việc" để lên lịch</p>
                      </div>
                    ) : (
                      selTasks.map(task => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          members={members}
                          customers={customers}
                          onToggleDone={handleToggleDone}
                          onOpenDetail={setDetailTask}
                        />
                      ))
                    )}
                    {/* Unscheduled tasks on mobile */}
                    {unscheduledTasks.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-dashed border-border/60">
                        <p className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1 mb-1.5">
                          <Inbox className="h-3 w-3" /> Chưa lên lịch ({unscheduledTasks.length})
                        </p>
                        {unscheduledTasks.map(task => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            members={members}
                            customers={customers}
                            onToggleDone={handleToggleDone}
                            onOpenDetail={setDetailTask}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
                <div className="p-3 border-t border-border/50">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-9 gap-1.5 text-xs"
                    onClick={() => handleOpenAddDialog(toDateStr(selDate))}
                  >
                    <Plus className="h-3.5 w-3.5" /> Thêm việc hôm nay
                  </Button>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* ── Add Task Dialog ── */}
      <Dialog open={!!addDialogDate} onOpenChange={open => !open && setAddDialogDate(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Thêm công việc
            </DialogTitle>
            <DialogDescription>
              {addDialogDate && (() => {
                const d = new Date(addDialogDate + 'T00:00:00');
                return `${DAYS_FULL_VN[d.getDay()]}, ${formatDayLabel(d)}`;
              })()}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            {/* Title */}
            <div className="grid gap-1.5">
              <Label htmlFor="nw-title" className="text-xs font-semibold">Tiêu đề <span className="text-destructive">*</span></Label>
              <Input
                id="nw-title"
                placeholder="VD: Gọi tư vấn khách Nguyễn Văn A"
                value={newTask.title}
                onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && handleCreateTask()}
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="grid gap-1.5">
              <Label htmlFor="nw-desc" className="text-xs font-semibold">Ghi chú</Label>
              <Input
                id="nw-desc"
                placeholder="Ghi chú thêm..."
                value={newTask.description}
                onChange={e => setNewTask({ ...newTask, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Stage */}
              <div className="grid gap-1.5">
                <Label className="text-xs font-semibold">Giai đoạn</Label>
                <Select
                  value={newTask.status}
                  onValueChange={v => setNewTask({ ...newTask, status: v as Status })}
                >
                  <SelectTrigger className="h-9 text-xs rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SALE_STAGES.map(s => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div className="grid gap-1.5">
                <Label className="text-xs font-semibold">Ưu tiên</Label>
                <Select
                  value={newTask.priority}
                  onValueChange={v => setNewTask({ ...newTask, priority: v as any })}
                >
                  <SelectTrigger className="h-9 text-xs rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low" className="text-xs">Thấp</SelectItem>
                    <SelectItem value="medium" className="text-xs">Trung bình</SelectItem>
                    <SelectItem value="high" className="text-xs">Cao</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Assignee */}
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">Người thực hiện</Label>
              <Select
                value={newTask.assigneeId}
                onValueChange={v => setNewTask({ ...newTask, assigneeId: v })}
              >
                <SelectTrigger className="h-9 text-xs rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="w-auto min-w-[220px]">
                  {members.map(m => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={m.avatar} />
                          <AvatarFallback className="text-[8px]">{m.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium text-xs">{m.name}</span>
                          <span className="text-[9px] text-muted-foreground">{m.role}</span>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Scheduled date override */}
            <div className="grid gap-1.5">
              <Label htmlFor="nw-date" className="text-xs font-semibold">Ngày thực hiện</Label>
              <DatePicker
                value={addDialogDate}
                onChange={setAddDialogDate}
                className="h-9 text-xs rounded-lg"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-lg" onClick={() => setAddDialogDate(null)}>
              Hủy
            </Button>
            <Button
              className="rounded-lg shadow-lg shadow-primary/10"
              onClick={handleCreateTask}
              disabled={isSaving || !newTask.title.trim()}
            >
              {isSaving ? (
                <span className="flex items-center gap-1.5"><span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" /> Đang lưu...</span>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5 mr-1.5" /> Tạo công việc
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Task Detail Dialog (dùng lại TaskCard) ── */}
      {detailTask && (
        <TaskCard
          dialogOnly
          onCloseDialog={() => setDetailTask(null)}
          task={detailTask}
          assignee={members.find(m => m.id === detailTask.assigneeId)}
          members={members}
          customers={customers}
          columns={SALE_STAGES.map(s => ({ id: s.id, title: s.label }))}
          onMoveTask={async (taskId, newStatus) => {
            const updateData: any = { status: newStatus };
            if (newStatus === 'done') updateData.completedAt = new Date().toISOString();
            queryClient.setQueryData(['tasks'], (prev: Task[] = []) =>
              prev.map(t => (t.id === taskId ? { ...t, ...updateData } : t))
            );
            if (user) {
              try {
                await updateDoc(doc(db, 'tasks', taskId), updateData);
              } catch (err: any) {
                queryClient.invalidateQueries({ queryKey: ['tasks'] });
                handleFirestoreError(err, OperationType.UPDATE, `tasks/${taskId}`);
              }
            }
            setDetailTask(prev => prev ? { ...prev, ...updateData } : null);
          }}
        />
      )}
    </div>
  );
}
