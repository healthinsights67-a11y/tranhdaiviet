import * as React from 'react';
import { Task, Member, Customer, InstallationSchedule, MeasurementSchedule } from '@/src/types';
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
  Hammer,
  Wrench
} from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, addDays, parseISO } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { vi } from 'date-fns/locale';
import { cn, getCurrentVNDate } from '@/src/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KanbanBoard } from '@/src/components/kanban/KanbanBoard';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { doc, updateDoc, setDoc, deleteDoc, db, arrayUnion, getDoc } from '@/src/lib/firebase';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { InstallationScheduleSchema } from '@/src/schemas';
import { z } from 'zod';
import { notifyManagers } from '@/src/services/notificationService';
import { sendSystemNotification } from '@/src/services/botNotificationService';
import { uploadToImgBB } from '@/src/services/uploadService';
import { fetchInstallationSchedules } from '@/src/services/dataService';

interface ProductionCalendarProps {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  members: Member[];
  customers: Customer[];
  user?: any;
  currentUser?: any;
  schedules?: MeasurementSchedule[];
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
  contracted: 'Chốt Cọc',
  production: 'Sản xuất',
  installation: 'Lắp đặt',
  completed: 'Hoàn thành',
  lost: 'Tạm dừng',
};

export function ProductionCalendar({  tasks, setTasks, members, customers, user, currentUser, schedules = [] }: ProductionCalendarProps) {
  const [currentDate, setCurrentDate] = React.useState(() => getCurrentVNDate());
  const [viewMode, setViewMode] = React.useState<'1d' | '7d' | '30d'>('30d');
  const [selectedDay, setSelectedDay] = React.useState<Date | null>(null);
  const [rightTab, setRightTab] = React.useState<'production' | 'installation'>('production');
  const [activeMainTab, setActiveMainTab] = React.useState<'calendar' | 'progress'>('calendar');

  const isTopManager = !!currentUser?.permissions?.menuProduction || 
    !!currentUser?.role?.toLowerCase()?.includes('quản lý tổng') ||
    !!currentUser?.role?.toLowerCase()?.includes('quản lý') ||
    (currentUser?.permissions?.viewPrice === true);

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

  const { data: installationSchedules = [] } = useQuery<any[]>({
    queryKey: ['installation_schedules'],
    queryFn: fetchInstallationSchedules,
    enabled: !!user,
    staleTime: Infinity
  });

  const isInstaller = !!currentUser?.role?.toLowerCase()?.includes('thi công') || 
                      !!currentUser?.role?.toLowerCase()?.includes('lắp đặt') || 
                      !!currentUser?.role?.toLowerCase()?.includes('sản xuất') ||
                      !!currentUser?.role?.toLowerCase()?.includes('kỹ thuật');

  const hasInstallationsPermission = !!(currentUser?.permissions as any)?.menuInstallations;

  const canViewAllInstalls = isTopManager || !isInstaller || hasInstallationsPermission;

  const filteredInstallationSchedules = React.useMemo(() => {
    return canViewAllInstalls 
      ? installationSchedules 
      : installationSchedules.filter(s => 
          s.assigneeId === currentUser?.id || 
          (s.assigneeIds && currentUser?.id && s.assigneeIds.includes(currentUser.id))
        );
  }, [installationSchedules, canViewAllInstalls, currentUser]);

  const [isOpen, setIsOpen] = React.useState(false);
  const [formData, setFormData] = React.useState({
    id: '',
    customerId: '',
    customerName: '',
    phone: '',
    address: '',
    date: new Date().toISOString().slice(0, 16),
    assigneeId: '',
    notes: '',
    workshop: ''
  });

  const [isInstallOpen, setIsInstallOpen] = React.useState(false);
  const [installFormData, setInstallFormData] = React.useState<any>({
    taskId: '',
    customerId: '',
    customerName: '',
    phone: '',
    address: '',
    date: new Date().toISOString().slice(0, 16),
    assigneeId: '',
    assigneeIds: [],
    notes: '',
    status: 'pending'
  });

  const [editingInstallId, setEditingInstallId] = React.useState<string | null>(null);
  const [isSavingInstall, setIsSavingInstall] = React.useState(false);
  const [isSavingNewInstall, setIsSavingNewInstall] = React.useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = React.useState(false);
  const [editInstallFormData, setEditInstallFormData] = React.useState<Partial<InstallationSchedule>>({});
  const [isUploadingInstall, setIsUploadingInstall] = React.useState<string | null>(null);

  const productionTasks = tasks.filter(t => t.type === 'production');

  const productionMembers = React.useMemo(() => {
    return members.filter(m => 
      !!m.role?.toLowerCase()?.includes('sản xuất') || 
      !!m.role?.toLowerCase()?.includes('thi công') || 
      !!m.role?.toLowerCase()?.includes('xưởng') ||
      !!m.role?.toLowerCase()?.includes('kỹ thuật')
    );
  }, [members]);

  const installerMembers = React.useMemo(() => {
    return members.filter(m => 
      !!m.role?.toLowerCase()?.includes('thi công') || 
      !!m.role?.toLowerCase()?.includes('lắp đặt') || 
      !!m.role?.toLowerCase()?.includes('sản xuất') ||
      !!m.role?.toLowerCase()?.includes('kỹ thuật')
    );
  }, [members]);

  const displayInstallerOptions = React.useMemo(() => {
    const installerOptions = installerMembers.map(m => ({ label: `${m.name} (${m.role})`, value: m.id }));
    return installerOptions.length > 0 
      ? installerOptions 
      : members.map(m => ({ label: `${m.name} (${m.role})`, value: m.id }));
  }, [installerMembers, members]);

  const handleInstallerToggle = (assigneeId: string, type: 'create' | 'edit') => {
    if (type === 'create') {
      const current = installFormData.assigneeIds || [];
      const newIds = current.includes(assigneeId) ? current.filter((id: string) => id !== assigneeId) : [...current, assigneeId];
      setInstallFormData((prev: any) => ({ ...prev, assigneeIds: newIds, assigneeId: newIds[0] || '' }));
    } else {
      const current = editInstallFormData.assigneeIds || [];
      const newIds = current.includes(assigneeId) ? current.filter((id: string) => id !== assigneeId) : [...current, assigneeId];
      setEditInstallFormData(prev => ({ ...prev, assigneeIds: newIds, assigneeId: newIds[0] || '' }));
    }
  };

  const getTasksForDay = (day: Date) => {
    return tasks.filter(t => 
      t.type === 'production' && 
      t.dueDate && 
      t.dueDate !== '' &&
      isSameDay(parseISO(t.dueDate), day)
    );
  };

  const getInstallSchedulesForDay = (day: Date) => {
    return filteredInstallationSchedules.filter((s: any) => 
      s.date && 
      isSameDay(parseISO(s.date), day)
    );
  };

  const getMeasurementSchedulesForDay = (day: Date) => {
    return schedules.filter((s: any) => 
      s.date && 
      isSameDay(parseISO(s.date), day)
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

  const unscheduledInstallTasksList = React.useMemo(() => {
    return tasks.filter(t => 
      t.status === 'waiting_install' && 
      !filteredInstallationSchedules.some((s: any) => {
        if (s.status === 'cancelled') return false;
        if (s.taskId === t.id) return true;
        if (s.customerId && t.customerId && s.customerId === t.customerId) return true;
        if (s.customerName && (t.customerName || t.title) && s.customerName.toLowerCase() === (t.customerName || t.title).replace(/^sản xuất:\s*/i, '').trim().toLowerCase()) return true;
        return false;
      })
    ).map(t => ({
      id: t.id,
      type: 'task' as const,
      name: t.customerName || t.title,
      workshop: t.workshop,
      address: t.address || '',
      phone: t.phone || '',
      rawTask: t,
      rawCustomer: undefined
    }));
  }, [tasks, filteredInstallationSchedules]);

  const unscheduledInstallCustomersList = React.useMemo(() => {
    return customers.filter(c => 
      (['contracted', 'production', 'installation'].includes(c.stage)) && 
      !filteredInstallationSchedules.some((s: any) => {
        if (s.status === 'cancelled') return false;
        if (s.customerId === c.id) return true;
        if (s.customerName && s.customerName.toLowerCase() === c.name.toLowerCase()) return true;
        return false;
      }) &&
      !unscheduledInstallTasksList.some(t => t.rawTask?.customerId === c.id || (t.rawTask?.customerName && t.rawTask.customerName.toLowerCase() === c.name.toLowerCase()))
    ).map(c => ({
      id: c.id,
      type: 'customer' as const,
      name: c.name,
      workshop: c.workshop,
      address: c.address || '',
      phone: c.phone || '',
      rawTask: undefined,
      rawCustomer: c
    }));
  }, [customers, filteredInstallationSchedules, unscheduledInstallTasksList]);

  const unscheduledInstallations = React.useMemo(() => {
    return [...unscheduledInstallTasksList, ...unscheduledInstallCustomersList];
  }, [unscheduledInstallTasksList, unscheduledInstallCustomersList]);

  const taskOptions = React.useMemo(() => {
    const options = [
      { label: '-- Nhập tay / Không liên kết thẻ --', value: 'manual' },
      ...unscheduledInstallations.map(t => ({
        label: `${t.name} (${t.address || 'Không có địa chỉ'})`,
        value: t.id
      }))
    ];
    if (installFormData.taskId && installFormData.taskId !== 'manual' && !options.find(o => o.value === installFormData.taskId)) {
      const t = tasks.find(x => x.id === installFormData.taskId);
      options.push({
        label: t ? `${t.customerName || t.title} (${t.address || 'Không có địa chỉ'})` : installFormData.customerName || installFormData.taskId,
        value: installFormData.taskId
      });
    }
    return options;
  }, [unscheduledInstallations, installFormData.taskId, installFormData.customerName, tasks]);

  const handleSaveSchedule = async () => {
    if (isSavingSchedule) return;
    if (!formData.customerName || formData.customerName.trim() === '') {
      toast.error('Vui lòng nhập tên khách hàng');
      return;
    }
    if (!formData.date || formData.date.trim() === '') {
      toast.error('Vui lòng nhập ngày sản xuất');
      return;
    }

    setIsSavingSchedule(true);
    try {
      let taskId = formData.id;
      const dueDateIso = new Date(formData.date).toISOString();

      if (taskId) {
        const taskRef = doc(db, 'tasks', taskId);
        await updateDoc(taskRef, {
          dueDate: dueDateIso,
          assigneeId: formData.assigneeId || '',
          description: formData.notes || ''
        });

        // Send to external bot platforms (Zalo/Telegram)
        sendSystemNotification(`✏️ Cập nhật lịch sản xuất!\n\n👤 Khách hàng: ${formData.customerName}\n📞 SĐT: ${formData.phone}\n📍 Địa chỉ: ${formData.address}\n⏰ Hạn chót mới: ${format(new Date(dueDateIso), 'HH:mm dd/MM/yyyy')}\n📝 Ghi chú: ${formData.notes || 'Không có'}\n\nĐược cập nhật bởi: ${currentUser?.name || 'Hệ thống'}`, 'production', formData.workshop);
      } else {
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

        // Send to external bot platforms (Zalo/Telegram)
        sendSystemNotification(`🔨 Lịch sản xuất mới!\n\n👤 Khách hàng: ${formData.customerName}\n📞 SĐT: ${formData.phone}\n📍 Địa chỉ: ${formData.address}\n⏰ Hạn chót: ${format(new Date(dueDateIso), 'HH:mm dd/MM/yyyy')}\n📝 Ghi chú: ${formData.notes || 'Không có'}\n\nĐược tạo bởi: ${currentUser?.name || 'Hệ thống'}`, 'production', formData.workshop);
      }

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
        notes: '',
        workshop: ''
      });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    } catch (error) {
      console.error('Lỗi khi xếp lịch sản xuất:', error);
      toast.error('Có lỗi xảy ra khi xếp lịch');
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleSaveInstall = async () => {
    if (isSavingNewInstall) return;
    if (!user) {
      toast.error('Vui lòng đăng nhập để lưu');
      return;
    }
    if (!installFormData.customerName || installFormData.customerName.trim() === '') {
      toast.error('Vui lòng nhập tên khách hàng');
      return;
    }
    if (!installFormData.date || installFormData.date.trim() === '') {
      toast.error('Vui lòng nhập thời gian lắp');
      return;
    }

    setIsSavingNewInstall(true);
    try {
      const id = Date.now().toString();
      const schedule: InstallationSchedule = {
        id,
        date: new Date(installFormData.date!).toISOString(),
        taskId: installFormData.taskId || '',
        customerId: installFormData.customerId || '',
        customerName: installFormData.customerName || '',
        phone: installFormData.phone || '',
        address: installFormData.address || '',
        status: installFormData.status as 'pending' | 'completed' | 'cancelled',
        assigneeId: installFormData.assigneeId || '',
        assigneeIds: installFormData.assigneeIds || [],
        notes: installFormData.notes || '',
        createdAt: new Date().toISOString()
      };

      InstallationScheduleSchema.parse(schedule);
      
      await setDoc(doc(db, 'installation_schedules', id), schedule);

      const assignee = members.find(m => m.id === schedule.assigneeId);
      notifyManagers(
        'Lịch lắp đặt mới',
        `Điều phối lịch lắp đặt cho khách ${schedule.customerName} lúc ${format(new Date(schedule.date), 'HH:mm dd/MM')}. Phụ trách: ${assignee?.name || 'Chưa rõ'}`,
        { taskId: schedule.id, type: 'installation' },
        schedule.assigneeId
      );

      if (schedule.status === 'completed') {
        if (schedule.taskId) {
          const taskRef = doc(db, 'tasks', schedule.taskId);
          await updateDoc(taskRef, {
            status: 'done',
            completedAt: new Date().toISOString()
          });
        }
        if (schedule.customerId) {
          await updateDoc(doc(db, 'customers', schedule.customerId), { 
            stage: 'completed'
          });
        }
      }

      toast.success('Đã xếp lịch lắp đặt thành công');
      setIsInstallOpen(false);
      setInstallFormData({
        taskId: '',
        customerId: '',
        customerName: '',
        phone: '',
        address: '',
        date: new Date().toISOString().slice(0, 16),
        assigneeId: '',
        assigneeIds: [],
        status: 'pending',
        notes: ''
      });
      queryClient.invalidateQueries({ queryKey: ['installation_schedules'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    } catch (error) {
      console.error("Lỗi khi xếp lịch lắp đặt:", error);
      if (error instanceof z.ZodError) {
        const errorMsg = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        toast.error('Lỗi định dạng dữ liệu: ' + errorMsg);
      } else {
        toast.error('Có lỗi xảy ra khi xếp lịch lắp đặt');
      }
    } finally {
      setIsSavingNewInstall(false);
    }
  };

  const handleEditInstallClick = (schedule: InstallationSchedule) => {
    setEditingInstallId(schedule.id);
    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    const localISOTime = (new Date(new Date(schedule.date).getTime() - tzOffset)).toISOString().slice(0, 16);
    setEditInstallFormData({ ...schedule, date: localISOTime, assigneeIds: schedule.assigneeIds || (schedule.assigneeId ? [schedule.assigneeId] : []) });
  };

  const handleCancelInstallEdit = () => {
    setEditingInstallId(null);
    setEditInstallFormData({});
  };

  const handleSaveInstallEdit = async (schedule: InstallationSchedule) => {
    if (!editInstallFormData.customerName || editInstallFormData.customerName.trim() === '') {
        toast.error('Vui lòng nhập tên khách hàng');
        return;
    }
    if (!editInstallFormData.date || editInstallFormData.date.trim() === '') {
        toast.error('Vui lòng nhập thời gian lắp');
        return;
    }
    if (!editInstallFormData.phone || editInstallFormData.phone.trim().length < 9) {
        toast.error('Vui lòng nhập số điện thoại hợp lệ');
        return;
    }

    setIsSavingInstall(true);
    try {
        const scheduleRef = doc(db, 'installation_schedules', schedule.id);
        const updatedData = {
          ...editInstallFormData,
          date: new Date(editInstallFormData.date!).toISOString()
        };

        if (updatedData.status === 'completed' && schedule.status !== 'completed') {
          if (updatedData.taskId) {
            const taskRef = doc(db, 'tasks', updatedData.taskId);
            await updateDoc(taskRef, {
              status: 'done',
              completedAt: new Date().toISOString()
            });
          }

          if (updatedData.customerId) {
            await updateDoc(doc(db, 'customers', updatedData.customerId), { 
              stage: 'completed'
            });
            toast.success(`Đã tự động hoàn tất dự án cho: ${updatedData.customerName}`);
          }
        }

        const { id, createdAt, ...dataToUpdate } = updatedData as any;
        await updateDoc(scheduleRef, dataToUpdate);
        toast.success('Đã cập nhật lịch lắp đặt');
        setEditingInstallId(null);
        setEditInstallFormData({});
        queryClient.invalidateQueries({ queryKey: ['installation_schedules'] });
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        queryClient.invalidateQueries({ queryKey: ['customers'] });
    } catch (error) {
        console.error("Lỗi khi lưu thay đổi lịch lắp đặt:", error);
        toast.error('Lỗi khi lưu thay đổi');
    } finally {
        setIsSavingInstall(false);
    }
  };

  const handleInstallFileUpload = async (schedule: InstallationSchedule, files: FileList) => {
    setIsUploadingInstall(schedule.id);
    const toastId = toast.loading(`Đang tải lên ${files.length} ảnh...`);

    try {
      let successCount = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const newUrl = await uploadToImgBB(file);
        if (newUrl) {
          await updateDoc(doc(db, 'installation_schedules', schedule.id), {
            imageUrls: arrayUnion(newUrl)
          });
          successCount++;
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ['installation_schedules'] });
      
      if (successCount > 0) {
        toast.success(`Đã tải lên ${successCount}/${files.length} ảnh thành công!`, { id: toastId });
      } else {
        toast.error('Không thể tải lên ảnh nào', { id: toastId });
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Lỗi khi tải ảnh: ' + (error instanceof Error ? error.message : 'Unknown'), { id: toastId });
    } finally {
      setIsUploadingInstall(null);
    }
  };

  const handleUpdateInstallStatus = async (item: InstallationSchedule, newStatus: 'pending' | 'completed' | 'cancelled') => {
    try {
      const scheduleRef = doc(db, 'installation_schedules', item.id);
      
      const snap = await getDoc(scheduleRef);
      const freshItem = snap.exists() ? snap.data() as InstallationSchedule : item;

      if (newStatus === 'completed' && (!freshItem.imageUrls || freshItem.imageUrls.length === 0)) {
        toast.error('Vui lòng tải ảnh nghiệm thu lắp đặt lên trước khi hoàn tất!');
        return;
      }

      await updateDoc(scheduleRef, {
        status: newStatus
      });

      if (newStatus === 'completed') {
        if (freshItem.taskId) {
          const taskRef = doc(db, 'tasks', freshItem.taskId);
          await updateDoc(taskRef, {
            status: 'done',
            completedAt: new Date().toISOString()
          });
        }

        if (freshItem.customerId) {
          await updateDoc(doc(db, 'customers', freshItem.customerId), { 
            stage: 'completed'
          });
          toast.success(`Đã tự động hoàn tất dự án cho: ${freshItem.customerName}`);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['installation_schedules'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      
      let message = 'Đã cập nhật trạng thái';
      if (newStatus === 'completed') message = 'Đã hoàn thành lắp đặt';
      else if (newStatus === 'cancelled') message = 'Đã hủy lịch lắp đặt';
      else if (newStatus === 'pending') message = 'Đã đưa về trạng thái chờ lắp';

      toast.success(message);
    } catch (error) {
      console.error("Lỗi khi cập nhật trạng thái lắp đặt:", error);
      toast.error('Có lỗi xảy ra');
    }
  };

  const handleDeleteInstallSchedule = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa lịch lắp đặt này không?')) return;
    try {
      await deleteDoc(doc(db, 'installation_schedules', id));
      queryClient.invalidateQueries({ queryKey: ['installation_schedules'] });
      toast.success('Đã xóa lịch lắp đặt');
      setSelectedDay(null);
    } catch (error) {
      console.error("Lỗi khi xóa lịch lắp đặt:", error);
      toast.error('Có lỗi xảy ra khi xóa');
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

  const virtualProductionTasks: Task[] = React.useMemo(() => {
    const existingTitles = new Set(productionTasks.map(t => t.title.toLowerCase().trim()));
    const existingCustomerIds = new Set(productionTasks.filter(t => t.customerId).map(t => t.customerId));
    
    const derivedTasks: Task[] = customers
      .filter(customer => 
        (customer.stage === 'production' || customer.stage === 'installation' || customer.stage === 'completed') &&
        !existingCustomerIds.has(customer.id) &&
        !existingTitles.has(`sản xuất: ${customer.name.toLowerCase().trim()}`) && 
        !existingTitles.has(customer.name.toLowerCase().trim())
      )
      .map(customer => ({
        id: `virtual-${customer.id}`,
        customerId: customer.id,
        customerName: customer.name,
        phone: customer.phone,
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-2 pb-1">
        <div className="flex flex-col space-y-0.5">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight">
            Lịch Sản Xuất & Thi Công
          </h1>
          <p className="text-muted-foreground text-xs font-medium">Lập kế hoạch và theo dõi tiến độ đo đạc, sản xuất & lắp đặt thực tế.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 bg-card/80 border p-1.5 rounded-xl shadow-xs text-[10px] font-bold">
          <span className="text-muted-foreground uppercase tracking-wider text-[9px] mr-0.5">Chú giải:</span>
          <span className="flex items-center gap-1 bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md border border-purple-200">
            <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse"></span> Đo đạc
          </span>
          <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> Sản xuất
          </span>
          <span className="flex items-center gap-1 bg-orange-50 text-orange-700 px-2 py-0.5 rounded-md border border-orange-200">
            <span className="w-1.5 h-1.5 bg-orange-500 rounded-full"></span> Lắp đặt
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 px-2">
        <Card className="rounded-xl border bg-card hover:shadow-md transition-all">
          <CardHeader className="p-2 sm:p-3 pb-0 sm:pb-1">
            <CardTitle className="text-[7.5px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-tight">Đang sx</CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-3 pt-1 sm:pt-0 pb-2 sm:pb-3">
            <div className="flex items-center justify-between">
              <div className="text-xl sm:text-2xl font-extrabold text-blue-600">
                {customers.filter(c => c.stage === 'production').length}
              </div>
              <Package className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600/30" />
            </div>
            <p className="text-[7.5px] sm:text-[10px] text-muted-foreground mt-0.5 leading-tight">Đang tại xưởng</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border bg-card hover:shadow-md transition-all">
          <CardHeader className="p-2 sm:p-3 pb-0 sm:pb-1">
            <CardTitle className="text-[7.5px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-tight">Chờ lắp tháng này</CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-3 pt-1 sm:pt-0 pb-2 sm:pb-3">
            <div className="flex items-center justify-between">
              <div className="text-xl sm:text-2xl font-extrabold text-purple-600">
                {
                  tasks.filter(t => {
                    if (t.type !== 'production' || t.status !== 'waiting_install' || !t.waiting_install_at) return false;
                    const date = new Date(t.waiting_install_at);
                    return date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear();
                  }).length
                }
              </div>
              <Truck className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600/30" />
            </div>
            <p className="text-[7.5px] sm:text-[10px] text-muted-foreground mt-0.5 leading-tight">Hoàn thiện, chờ lắp</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border bg-card hover:shadow-md transition-all">
          <CardHeader className="p-2 sm:p-3 pb-0 sm:pb-1">
            <CardTitle className="text-[7.5px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-tight">Hoàn thành tháng này</CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-3 pt-1 sm:pt-0 pb-2 sm:pb-3">
            <div className="flex items-center justify-between">
              <div className="text-xl sm:text-2xl font-extrabold text-green-600">
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

      <Tabs value={activeMainTab} onValueChange={(val: any) => setActiveMainTab(val)} className="w-full flex-grow flex flex-col mt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-2 mb-2">
          <TabsList className="bg-secondary/40 p-1 rounded-xl w-full sm:w-auto h-10">
            <TabsTrigger value="calendar" className="rounded-lg gap-2 font-bold data-[state=active]:bg-background data-[state=active]:shadow-xs text-xs h-8 flex-1 sm:flex-initial">
              <CalendarDays className="h-4 w-4" />
              Lịch biểu
            </TabsTrigger>
            <TabsTrigger value="progress" className="rounded-lg gap-2 font-bold data-[state=active]:bg-background data-[state=active]:shadow-xs text-xs h-8 flex-1 sm:flex-initial">
              <LayoutGrid className="h-4 w-4" />
              Tiến độ
            </TabsTrigger>
          </TabsList>
          
          {activeMainTab === 'calendar' && (
            <div className="flex items-center justify-between sm:justify-end gap-1.5 w-full sm:w-auto">
              <div className="flex items-center gap-1 bg-card text-card-foreground p-1 rounded-xl border border-border shadow-xs h-10">
                <Select value={viewMode} onValueChange={(v: '1d' | '7d' | '30d') => setViewMode(v)}>
                  <SelectTrigger className="h-8 w-[72px] text-xs font-bold border-none px-1.5 shadow-none focus:ring-0">
                    <SelectValue placeholder="Chế độ" />
                  </SelectTrigger>
                  <SelectContent className="z-50 bg-card text-card-foreground border shadow-xl rounded-xl">
                    <SelectItem value="1d">1 Ngày</SelectItem>
                    <SelectItem value="7d">7 Ngày</SelectItem>
                    <SelectItem value="30d">30 Ngày</SelectItem>
                  </SelectContent>
                </Select>

                <div className="h-4 w-[1px] bg-border mx-0.5" />

                <Button type="button" variant="ghost" size="icon" onClick={prevInterval} className="rounded-lg h-8 w-8 shrink-0">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="font-black text-xs min-w-[80px] text-center capitalize shrink-0 text-foreground">
                  {format(currentDate, 'MMM yyyy', { locale: vi })}
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={nextInterval} className="rounded-lg h-8 w-8 shrink-0">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <TabsContent value="calendar" className="flex-grow flex flex-col outline-none mt-0">
          <div className="flex flex-col lg:flex-row gap-4 min-h-0 flex-1">
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
                        const dayInstalls = getInstallSchedulesForDay(day);
                        const dayMeasurements = getMeasurementSchedulesForDay(day);

                        const combinedItems = [
                          ...dayMeasurements.map(m => ({ ...m, displayType: 'measurement' as const, sortTime: m.date })),
                          ...dayTasks.map(t => ({ ...t, displayType: 'production' as const, sortTime: t.dueDate })),
                          ...dayInstalls.map(s => ({ ...s, displayType: 'installation' as const, sortTime: s.date }))
                        ].sort((a, b) => {
                          const timeA = a.sortTime ? new Date(a.sortTime).getTime() : 0;
                          const timeB = b.sortTime ? new Date(b.sortTime).getTime() : 0;
                          return timeA - timeB;
                        });

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
                              {combinedItems.slice(0, 3).map((item) => {
                                if (item.displayType === 'measurement') {
                                  const schedule = item as any;
                                  return (
                                    <div 
                                      key={schedule.id}
                                      className="text-[9px] sm:text-xs px-1 sm:px-2 py-0.5 sm:py-1 rounded truncate border font-semibold flex items-center gap-0.5 sm:gap-1 shadow-sm text-purple-700 border-purple-200 bg-purple-50 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-800"
                                      title={`[Đo đạc] ${schedule.customerName} - ${schedule.address || ''}`}
                                    >
                                      <CalendarDays className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0 text-purple-600 dark:text-purple-400 animate-pulse" />
                                      <span className="font-bold opacity-75 hidden xs:inline">{format(parseISO(schedule.date), 'HH:mm')}</span>
                                      <span className="truncate">{schedule.customerName}</span>
                                    </div>
                                  );
                                } else if (item.displayType === 'production') {
                                  const task = item as any;
                                  const customer = customers.find(c => c.id === task.customerId || c.name.toLowerCase() === (task.customerName || '').toLowerCase());
                                  return (
                                    <div 
                                      key={task.id}
                                      className="text-[9px] sm:text-xs px-1 sm:px-2 py-0.5 sm:py-1 rounded truncate border font-semibold flex items-center gap-0.5 sm:gap-1 shadow-sm text-emerald-700 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800"
                                      title={`[Sản xuất] ${task.customerName || task.title} - ${task.address || ''}`}
                                    >
                                      <Package className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                      <span className="truncate">{customer?.name || task.customerName || customer?.code || task.title}</span>
                                    </div>
                                  );
                                } else {
                                  const schedule = item as any;
                                  return (
                                    <div 
                                      key={schedule.id}
                                      className="text-[9px] sm:text-xs px-1 sm:px-2 py-0.5 sm:py-1 rounded truncate border font-semibold flex items-center gap-0.5 sm:gap-1 shadow-sm text-orange-700 border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-800"
                                      title={`[Lắp đặt] ${schedule.customerName} - ${schedule.address || ''}`}
                                    >
                                      <Wrench className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0 text-orange-600 dark:text-orange-400" />
                                      <span className="font-bold opacity-75 hidden xs:inline">{format(parseISO(schedule.date), 'HH:mm')}</span>
                                      <span className="truncate">{schedule.customerName}</span>
                                    </div>
                                  );
                                }
                              })}
                              {combinedItems.length > 3 && (
                                <div className="text-xs text-muted-foreground text-center font-medium py-1">
                                  + {combinedItems.length - 3} lịch
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

            <Card className="w-full lg:w-[350px] flex flex-col border border-gray-200 dark:border-zinc-800 rounded-2xl bg-card overflow-hidden shadow-sm shrink-0 lg:self-start lg:sticky lg:top-4 lg:max-h-[calc(100vh-220px)]">
              <CardHeader className="p-4 border-b bg-gray-50 dark:bg-zinc-900 shrink-0 pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                    <ClipboardList className="h-4.5 w-4.5 text-primary" />
                    Chờ xếp lịch
                  </CardTitle>
                </div>
                <div className="flex mt-2 bg-gray-100 p-0.5 rounded-lg dark:bg-zinc-800">
                  <button 
                    onClick={() => setRightTab('production')}
                    className={cn(
                      "flex-1 text-center py-1.5 text-[10px] font-bold rounded-md transition-all flex items-center justify-center gap-1",
                      rightTab === 'production' ? "bg-white text-primary shadow-sm dark:bg-zinc-700" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Sản xuất
                    {unscheduledProduction.length > 0 && (
                      <span className="bg-destructive text-destructive-foreground text-[8px] px-1 rounded-full scale-90">
                        {unscheduledProduction.length}
                      </span>
                    )}
                  </button>
                  <button 
                    onClick={() => setRightTab('installation')}
                    className={cn(
                      "flex-1 text-center py-1.5 text-[10px] font-bold rounded-md transition-all flex items-center justify-center gap-1",
                      rightTab === 'installation' ? "bg-white text-primary shadow-sm dark:bg-zinc-700" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Lắp đặt
                    {unscheduledInstallations.length > 0 && (
                      <span className="bg-destructive text-destructive-foreground text-[8px] px-1 rounded-full scale-90">
                        {unscheduledInstallations.length}
                      </span>
                    )}
                  </button>
                </div>
              </CardHeader>
              <CardContent className="p-3 flex-1 overflow-y-auto">
                {rightTab === 'production' ? (
                  unscheduledProduction.length === 0 ? (
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
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[9px] text-muted-foreground">Cần xếp lịch sớm</span>
                                {(() => {
                                  const installSchedule = filteredInstallationSchedules.find(s => {
                                    if (s.status === 'cancelled') return false;
                                    if (item.type === 'task' && item.rawTask) {
                                      return s.taskId === item.rawTask.id || 
                                        (s.customerId && s.customerId === item.rawTask.customerId) || 
                                        (s.customerName && s.customerName.toLowerCase() === (item.rawTask.customerName || item.rawTask.title.replace(/^sản xuất:\s*/i, '').trim()).toLowerCase());
                                    } else if (item.rawCustomer) {
                                      return s.customerId === item.rawCustomer.id || 
                                        (s.customerName && s.customerName.toLowerCase() === item.rawCustomer.name.toLowerCase());
                                    }
                                    return false;
                                  });
                                  
                                  if (installSchedule) {
                                    return (
                                      <span className="text-[9px] font-bold text-orange-600 dark:text-orange-400 bg-orange-500/10 px-1 py-0.5 rounded flex items-center gap-1 w-max">
                                        <Hammer className="h-2.5 w-2.5" />
                                        Lắp: {format(parseISO(installSchedule.date), 'dd/MM/yy', { locale: vi })}
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
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
                                      notes: task.description || '',
                                      workshop: task.workshop || ''
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
                                      notes: '',
                                      workshop: customer.workshop || ''
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
                  )
                ) : (
                  unscheduledInstallations.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                      <Wrench className="h-10 w-10 text-muted-foreground/30 mb-2" />
                      <p className="text-xs font-semibold">Tất cả việc đã xếp lịch</p>
                      <p className="text-[10px] text-muted-foreground/75 max-w-[200px] mt-1">Không có dự án nào đang chờ xếp lịch lắp đặt.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {unscheduledInstallations.map((item) => (
                        <Card key={item.id} className="p-3 bg-secondary/20 hover:bg-secondary/40 border transition-all duration-200 rounded-xl relative group">
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-start">
                              <span className="text-[10px] font-bold text-primary truncate max-w-[150px]">
                                {item.name}
                              </span>
                              {item.workshop ? (
                                <Badge className="text-[8px] scale-90 px-1 py-0 bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 shadow-none capitalize">
                                  {item.workshop}
                                </Badge>
                              ) : (
                                <Badge className="text-[8px] scale-90 px-1 py-0 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shadow-none">
                                  KH mới
                                </Badge>
                              )}
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
                                    const customer = task.customerId 
                                      ? customers.find(c => c.id === task.customerId) 
                                      : customers.find(c => c.name.toLowerCase() === (task.customerName || '').toLowerCase());

                                    setInstallFormData((prev: any) => ({
                                      ...prev,
                                      taskId: task.id,
                                      customerId: customer?.id || task.customerId || '',
                                      customerName: customer?.name || task.customerName || task.title.replace(/sản xuất:\s*/i, '').trim(),
                                      phone: customer?.phone || task.phone || '',
                                      address: customer?.address || task.address || '',
                                      date: new Date().toISOString().slice(0, 16)
                                    }));
                                  } else {
                                    const customer = item.rawCustomer!;
                                    setInstallFormData((prev: any) => ({
                                      ...prev,
                                      taskId: '',
                                      customerId: customer.id,
                                      customerName: customer.name,
                                      phone: customer.phone || '',
                                      address: customer.address || '',
                                      date: new Date().toISOString().slice(0, 16)
                                    }));
                                  }
                                  setIsInstallOpen(true);
                                }}
                                size="sm" 
                                className="h-6 text-[10px] px-2 rounded-lg bg-primary hover:bg-primary/90 font-semibold text-white"
                              >
                                Xếp lịch lắp
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )
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
              className="bg-card text-card-foreground rounded-2xl shadow-xl w-full max-w-2xl p-6"
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
              <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
                <div className="space-y-2">
                  <h4 className="font-bold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Package className="h-4 w-4 text-blue-500" />
                    Lịch Sản Xuất ({getTasksForDay(selectedDay).length})
                  </h4>
                  {getTasksForDay(selectedDay).length === 0 ? (
                    <p className="text-muted-foreground text-xs italic pl-6">Không có lịch sản xuất nào.</p>
                  ) : (
                    <div className="space-y-2">
                      {getTasksForDay(selectedDay).map(task => {
                        const customer = customers.find(c => c.id === task.customerId || c.name.toLowerCase() === (task.customerName || '').toLowerCase());
                        const stage = customer?.stage || 'production';
                        const assignee = members.find(m => m.id === task.assigneeId);
                        return (
                          <div key={task.id} className="p-3 border rounded-xl flex items-center justify-between hover:bg-secondary/10 dark:border-zinc-800">
                            <div>
                              <p className="font-bold text-sm">{task.customerName || task.title}</p>
                              {task.address && <p className="text-xs text-muted-foreground mt-0.5">Địa chỉ: {task.address}</p>}
                              {task.phone && <p className="text-xs text-muted-foreground">SĐT: {task.phone}</p>}
                              {assignee && <p className="text-xs text-muted-foreground">Phụ trách: {assignee.name}</p>}
                              {task.description && <p className="text-xs text-muted-foreground italic mt-1">Ghi chú: {task.description}</p>}
                            </div>
                            <div className="flex flex-col items-end gap-1.5 shrink-0 pl-2">
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
                                    notes: task.description || '',
                                    workshop: task.workshop || ''
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
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-2 border-t pt-4 dark:border-zinc-800">
                  <h4 className="font-bold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4 text-purple-500" />
                    Lịch Đo Đạc ({getMeasurementSchedulesForDay(selectedDay).length})
                  </h4>
                  {getMeasurementSchedulesForDay(selectedDay).length === 0 ? (
                    <p className="text-muted-foreground text-xs italic pl-6">Không có lịch đo đạc nào.</p>
                  ) : (
                    <div className="space-y-2">
                      {getMeasurementSchedulesForDay(selectedDay).map(schedule => {
                        const assignee = members.find(m => m.id === schedule.assigneeId);
                        return (
                          <div key={schedule.id} className="p-3 border rounded-xl flex items-center justify-between hover:bg-secondary/10 dark:border-zinc-800">
                            <div>
                              <p className="font-bold text-sm">{schedule.customerName}</p>
                              {schedule.address && <p className="text-xs text-muted-foreground mt-0.5">Địa chỉ: {schedule.address}</p>}
                              {schedule.phone && <p className="text-xs text-muted-foreground">SĐT: {schedule.phone}</p>}
                              {assignee && <p className="text-xs text-muted-foreground">Người đo: {assignee.name}</p>}
                              {schedule.notes && <p className="text-xs text-muted-foreground italic mt-1">Ghi chú: {schedule.notes}</p>}
                            </div>
                            <div className="flex flex-col items-end gap-1.5 shrink-0 pl-2">
                              <Badge className="bg-purple-500/10 text-purple-600 border border-purple-200 shadow-none">
                                {schedule.status === 'completed' ? 'Đã đo' : 'Chưa đo'}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-2 border-t pt-4 dark:border-zinc-800">
                  <h4 className="font-bold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Hammer className="h-4 w-4 text-purple-500" />
                    Lịch Lắp Đặt ({getInstallSchedulesForDay(selectedDay).length})
                  </h4>
                  {getInstallSchedulesForDay(selectedDay).length === 0 ? (
                    <p className="text-muted-foreground text-xs italic pl-6">Không có lịch lắp đặt nào.</p>
                  ) : (
                    <div className="space-y-3">
                      {getInstallSchedulesForDay(selectedDay).map((schedule) => {
                        const assignee = members.find(m => m.id === schedule.assigneeId);
                        const isManager = isTopManager;
                        return (
                          <div key={schedule.id} className="p-4 rounded-xl border bg-card shadow-sm space-y-3 dark:border-zinc-800">
                            {editingInstallId === schedule.id ? (
                              <div className="space-y-4 text-sm">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-bold text-muted-foreground">Ngày giờ lắp *</Label>
                                    <Input 
                                      type="datetime-local"
                                      value={editInstallFormData.date || ''}
                                      onChange={e => setEditInstallFormData({...editInstallFormData, date: e.target.value})}
                                      className="h-10 w-full rounded-xl border border-gray-200 dark:border-zinc-700 text-card-foreground"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-bold text-muted-foreground">Tên khách hàng *</Label>
                                    <Input 
                                      value={editInstallFormData.customerName || ''}
                                      onChange={e => setEditInstallFormData({...editInstallFormData, customerName: e.target.value})}
                                      className="h-10 w-full rounded-xl border border-gray-200 dark:border-zinc-700"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-bold text-muted-foreground">SĐT khách hàng *</Label>
                                    <Input 
                                      type="tel"
                                      value={editInstallFormData.phone || ''}
                                      onChange={e => setEditInstallFormData({...editInstallFormData, phone: e.target.value})}
                                      className="h-10 w-full rounded-xl border border-gray-200 dark:border-zinc-700"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-bold text-muted-foreground">Địa chỉ *</Label>
                                    <Input 
                                      value={editInstallFormData.address || ''}
                                      onChange={e => setEditInstallFormData({...editInstallFormData, address: e.target.value})}
                                      className="h-10 w-full rounded-xl border border-gray-200 dark:border-zinc-700"
                                    />
                                  </div>
                                  <div className="space-y-1.5 flex flex-col">
                                    <Label className="text-xs font-bold text-muted-foreground">Nhân viên thi công *</Label>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger className="h-10 rounded-xl border border-gray-200 bg-card w-full justify-start text-left font-normal px-4 py-2 text-sm flex items-center dark:border-zinc-700 text-card-foreground">
                                        {(editInstallFormData.assigneeIds && editInstallFormData.assigneeIds.length > 0) 
                                          ? `${editInstallFormData.assigneeIds.length} nhân viên được chọn` 
                                          : 'Chọn nhân viên (có thể chọn nhiều)'}
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent className="w-[300px] max-h-[300px] overflow-y-auto bg-card z-50">
                                        {members.map(m => (
                                          <DropdownMenuCheckboxItem
                                            key={m.id}
                                            checked={(editInstallFormData.assigneeIds || []).includes(m.id)}
                                            onCheckedChange={() => handleInstallerToggle(m.id, 'edit')}
                                          >
                                            {m.name || 'Không xác định'}
                                          </DropdownMenuCheckboxItem>
                                        ))}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                    {(editInstallFormData.assigneeIds && editInstallFormData.assigneeIds.length > 0) && (
                                      <div className="flex flex-wrap gap-1 mt-2">
                                        {editInstallFormData.assigneeIds.map((id: string) => {
                                          const m = members.find(x => x.id === id);
                                          return m ? (
                                            <Badge key={id} variant="secondary" className="text-[10px] font-bold">
                                              {m.name || 'Không xác định'}
                                            </Badge>
                                          ) : null;
                                        })}
                                      </div>
                                    )}
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-bold text-muted-foreground">Trạng thái</Label>
                                    <Select 
                                      value={editInstallFormData.status || ''} 
                                      onValueChange={(val: any) => setEditInstallFormData({...editInstallFormData, status: val})}
                                    >
                                      <SelectTrigger className="h-10 w-full rounded-xl border border-gray-200 dark:border-zinc-700 bg-card text-card-foreground">
                                        <SelectValue placeholder="Chọn trạng thái">
                                          {editInstallFormData.status === 'completed' ? 'Đã hoàn thành' : 
                                           editInstallFormData.status === 'cancelled' ? 'Đã hủy' : 
                                           editInstallFormData.status === 'pending' ? 'Chờ lắp đặt' : 'Chọn trạng thái'}
                                        </SelectValue>
                                      </SelectTrigger>
                                      <SelectContent className="bg-card z-50">
                                        <SelectItem value="pending">Chờ lắp đặt</SelectItem>
                                        <SelectItem value="completed">Đã hoàn thành</SelectItem>
                                        <SelectItem value="cancelled">Đã hủy</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold text-muted-foreground">Ghi chú</Label>
                                    <Input 
                                      value={editInstallFormData.notes || ''}
                                      onChange={e => setEditInstallFormData({...editInstallFormData, notes: e.target.value})}
                                      className="h-10 w-full rounded-xl border border-gray-200 dark:border-zinc-700"
                                    />
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                  <Button variant="outline" size="sm" onClick={handleCancelInstallEdit} disabled={isSavingInstall} className="rounded-xl">Hủy</Button>
                                  <Button size="sm" onClick={() => handleSaveInstallEdit(schedule)} disabled={isSavingInstall} className="rounded-xl bg-primary text-white">{isSavingInstall ? 'Đang lưu...' : 'Lưu thay đổi'}</Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex justify-between items-start gap-4">
                                  <div>
                                    <h4 className="font-bold text-base text-primary">{schedule.customerName}</h4>
                                    <div className="flex items-center text-muted-foreground text-xs mt-1 gap-4 font-medium">
                                      <span className="flex items-center gap-1 text-foreground">
                                        <Clock className="w-3.5 h-3.5 text-primary" /> 
                                        {format(parseISO(schedule.date), 'HH:mm')}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <User className="w-3.5 h-3.5" /> 
                                        Phụ trách: {assignee?.name || 'Chưa phân công'}
                                      </span>
                                    </div>
                                  </div>
                                  <Badge className={cn(
                                    "text-[10px] px-2 py-0.5 rounded-lg shadow-none",
                                    schedule.status === 'completed' ? 'bg-emerald-500/15 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-500/20' : 
                                    schedule.status === 'pending' ? 'bg-blue-500/15 text-blue-600 dark:bg-blue-950 dark:text-blue-400 border border-blue-500/20' : 
                                    'bg-red-500/15 text-red-600 dark:bg-red-950 dark:text-red-400 border border-red-500/20'
                                  )}>
                                    {schedule.status === 'completed' ? 'Đã lắp xong' : 
                                     schedule.status === 'pending' ? 'Chờ lắp đặt' : 'Đã hủy lịch'}
                                  </Badge>
                                </div>

                                <div className="grid gap-2 text-xs font-medium text-muted-foreground pt-1">
                                  <div className="flex items-start gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                                    <span className="text-foreground">{schedule.address}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                    <span className="text-foreground">{schedule.phone}</span>
                                  </div>
                                  {schedule.notes && (
                                     <div className="mt-2 text-xs p-3 bg-secondary/35 rounded-xl border text-muted-foreground italic">
                                       {schedule.notes}
                                     </div>
                                  )}
                                </div>

                                <div className="pt-3 border-t dark:border-zinc-800 mt-4 space-y-3">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                      <Label className="text-xs font-bold text-muted-foreground">Ảnh nghiệm thu / lắp đặt hoàn thiện</Label>
                                      {(currentUser?.id === schedule.assigneeId || isManager) && (
                                        <div className="space-y-2">
                                          <Input 
                                            type="file" 
                                            accept="image/*"
                                            multiple
                                            disabled={isUploadingInstall === schedule.id}
                                            onChange={(e) => {
                                              if (e.target.files?.length) {
                                                handleInstallFileUpload(schedule, e.target.files);
                                                e.target.value = '';
                                              }
                                            }}
                                            className="h-9 text-xs file:text-xs file:h-full rounded-xl cursor-pointer"
                                          />
                                          {isUploadingInstall === schedule.id && (
                                            <div className="text-[10px] text-blue-500 animate-pulse font-bold">Đang tải ảnh lên...</div>
                                          )}
                                        </div>
                                      )}
                                      <div className="flex gap-2 mt-2 flex-wrap min-h-[40px]">
                                        {(schedule.imageUrls || []).map((url: string, i: number) => (
                                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="relative group/img cursor-pointer">
                                            <img src={url} alt={`installation-${i}`} className="w-12 h-12 object-cover rounded-lg border hover:scale-105 transition-transform" />
                                          </a>
                                        ))}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                                    <div className="flex gap-1.5">
                                      {(isManager || currentUser?.id === schedule.assigneeId) && schedule.status !== 'completed' && (
                                        <Button 
                                          size="sm" 
                                          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 rounded-xl h-8 text-xs font-semibold"
                                          onClick={() => handleUpdateInstallStatus(schedule, 'completed')}
                                        >
                                          <CheckCircle2 className="w-3.5 h-3.5" />
                                          Hoàn thành lắp
                                        </Button>
                                      )}
                                      {schedule.status === 'completed' && (
                                        <Button 
                                          size="sm" 
                                          variant="outline"
                                          className="gap-1 rounded-xl h-8 text-xs font-semibold text-blue-600 hover:text-blue-700"
                                          onClick={() => handleUpdateInstallStatus(schedule, 'pending')}
                                        >
                                          Mở lại lịch
                                        </Button>
                                      )}
                                      {schedule.status === 'pending' && (
                                        <Button 
                                          size="sm" 
                                          variant="destructive"
                                          className="rounded-xl h-8 text-xs font-semibold"
                                          onClick={() => handleUpdateInstallStatus(schedule, 'cancelled')}
                                        >
                                          Hủy lịch
                                        </Button>
                                      )}
                                    </div>
                                    
                                    <div className="flex gap-1.5">
                                      <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="rounded-xl h-8 text-xs font-semibold hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                                        onClick={() => handleDeleteInstallSchedule(schedule.id)}
                                      >
                                        Xóa lịch
                                      </Button>
                                      <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="rounded-xl h-8 text-xs font-semibold"
                                        onClick={() => handleEditInstallClick(schedule)}
                                      >
                                        Chỉnh sửa
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
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
                <SelectTrigger className="h-9 rounded-lg bg-background text-card-foreground">
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
            <Button onClick={handleSaveSchedule} disabled={isSavingSchedule} className="h-9 rounded-lg text-white bg-primary">
              {isSavingSchedule ? 'Đang lưu...' : 'Lưu Lịch Hẹn'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isInstallOpen} onOpenChange={setIsInstallOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5 font-bold">
              <Hammer className="h-5 w-5 text-primary" />
              Điều phối Lịch Lắp Đặt
            </DialogTitle>
            <DialogDescription className="text-xs">
              Vui lòng điền thông tin và phân công thợ thi công lắp đặt tại công trình.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-3 text-sm">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">Liên kết Công việc Chờ lắp *</Label>
              <Select 
                value={installFormData.taskId || 'manual'} 
                onValueChange={(taskId) => {
                  if (taskId === 'manual') {
                    setInstallFormData((prev: any) => ({ 
                      ...prev, 
                      taskId: '',
                      customerId: '', 
                      customerName: '', 
                      phone: '', 
                      address: '' 
                    }));
                    return;
                  }
                  const task = tasks.find(t => t.id === taskId);
                  if (task) {
                    const customer = task.customerId 
                      ? customers.find(c => c.id === task.customerId) 
                      : customers.find(c => c.name.toLowerCase() === (task.customerName || '').toLowerCase());

                    setInstallFormData((prev: any) => ({
                      ...prev,
                      taskId: task.id,
                      customerId: customer?.id || task.customerId || '',
                      customerName: customer?.name || task.customerName || task.title.replace(/sản xuất:\s*/i, '').trim(),
                      phone: customer?.phone || task.phone || '',
                      address: customer?.address || task.address || ''
                    }));
                  }
                }}
              >
                <SelectTrigger className="h-10 bg-gray-50 border-gray-200 rounded-xl dark:bg-zinc-800 dark:border-zinc-700 w-full text-card-foreground">
                  <SelectValue placeholder="Chọn từ danh sách chờ lắp hoặc tự nhập">
                    {installFormData.taskId && installFormData.taskId !== 'manual' 
                      ? (taskOptions.find(o => o.value === installFormData.taskId)?.label || installFormData.taskId) 
                      : (installFormData.taskId === 'manual' ? '-- Nhập tay / Không liên kết thẻ --' : 'Chọn từ danh sách chờ lắp hoặc tự nhập')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="z-50 bg-card">
                  {taskOptions.map(o => (
                    <SelectItem 
                      key={o.value} 
                      value={o.value}
                      className={o.value === 'manual' ? "font-bold text-primary" : ""}
                    >
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">Tên khách hàng *</Label>
                <Input 
                  value={installFormData.customerName || ''} 
                  onChange={e => setInstallFormData({...installFormData, customerName: e.target.value})} 
                  placeholder="Họ và tên"
                  className="h-10 rounded-xl w-full border-gray-200 dark:border-zinc-700"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">Điện thoại khách *</Label>
                <Input 
                  value={installFormData.phone || ''} 
                  onChange={e => setInstallFormData({...installFormData, phone: e.target.value})} 
                  placeholder="090..."
                  className="h-10 rounded-xl w-full border-gray-200 dark:border-zinc-700"
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">Địa chỉ lắp đặt *</Label>
              <Input 
                value={installFormData.address || ''} 
                onChange={e => setInstallFormData({...installFormData, address: e.target.value})} 
                placeholder="Địa chỉ công trình"
                className="h-10 rounded-xl border-gray-200 dark:border-zinc-700"
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">Thời gian lắp đặt *</Label>
                <Input 
                  type="datetime-local" 
                  value={installFormData.date || ''} 
                  onChange={e => setInstallFormData({...installFormData, date: e.target.value})}
                  className="h-10 rounded-xl bg-gray-50 border-gray-200 cursor-pointer w-full dark:bg-zinc-800 dark:border-zinc-700 text-card-foreground"
                />
              </div>
              <div className="space-y-1.5 flex flex-col">
                <Label className="text-xs font-bold text-muted-foreground">Nhân viên thi công *</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger className="h-10 rounded-xl border border-gray-200 bg-gray-50 w-full justify-start text-left font-normal px-4 py-2 text-sm flex items-center dark:bg-zinc-800 dark:border-zinc-700 text-card-foreground">
                    {(installFormData.assigneeIds && installFormData.assigneeIds.length > 0) 
                      ? `${installFormData.assigneeIds.length} nhân viên được chọn` 
                      : 'Chọn thợ lắp đặt (có thể chọn nhiều)'}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-[300px] max-h-[300px] overflow-y-auto bg-card z-50">
                    {displayInstallerOptions.map(m => (
                      <DropdownMenuCheckboxItem
                        key={m.value}
                        checked={(installFormData.assigneeIds || []).includes(m.value)}
                        onCheckedChange={() => handleInstallerToggle(m.value, 'create')}
                      >
                        {m.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                {(installFormData.assigneeIds && installFormData.assigneeIds.length > 0) && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {installFormData.assigneeIds.map((id: string) => {
                      const m = displayInstallerOptions.find(o => o.value === id);
                      return m ? (
                        <Badge key={id} variant="secondary" className="text-[10px] font-bold">
                          {m.label.split(' (')[0]}
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">Ghi chú lắp đặt</Label>
              <Input 
                value={installFormData.notes || ''} 
                onChange={e => setInstallFormData({...installFormData, notes: e.target.value})} 
                placeholder="Lưu ý về sản phẩm, tiến độ lắp ráp..."
                className="h-10 rounded-xl border-gray-200 dark:border-zinc-700"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInstallOpen(false)} className="rounded-xl">Hủy</Button>
            <Button onClick={handleSaveInstall} disabled={isSavingNewInstall} className="rounded-xl bg-primary text-white hover:bg-primary/90">
              {isSavingNewInstall ? 'Đang lưu...' : 'Lưu thông tin'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
