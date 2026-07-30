import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { InstallationSchedule, Member, Customer, Task } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Calendar as CalendarIcon, MapPin, Phone, User, Clock, ChevronLeft, ChevronRight, X, Hammer, Wrench, CheckCircle2, ClipboardList, Loader2, Navigation, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay, addMonths, subMonths, isToday, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { doc, setDoc, deleteDoc, updateDoc, arrayUnion, arrayRemove, onSnapshot, getDoc, db, handleFirestoreError, OperationType, collection, getDocs, query, where } from '@/src/lib/firebase';
import { uploadToImgBB } from '@/src/services/uploadService';
import { z } from 'zod';
import { InstallationScheduleSchema } from '@/src/schemas';
import { ScrollArea } from '@/components/ui/scroll-area';
import { sendSystemNotification } from '@/src/services/botNotificationService';
import { cn, getCurrentVNDate, optimizeRoute } from '@/src/lib/utils';
import { notifyManagers } from '@/src/services/notificationService';

interface InstallationPageProps {
  schedules: InstallationSchedule[];
  members: Member[];
  customers: Customer[];
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  user: any;
  currentUser: Member | null;
}

export function InstallationPage({ schedules, members, customers, tasks, setTasks, user, currentUser }: InstallationPageProps) {
  const queryClient = useQueryClient();
  const isManager = !!currentUser?.role?.toLowerCase()?.includes('quản lý') || !!currentUser?.permissions?.menuInstallations;

  const isInstaller = !!currentUser?.role?.toLowerCase()?.includes('thi công') || 
                      !!currentUser?.role?.toLowerCase()?.includes('lắp đặt') || 
                      !!currentUser?.role?.toLowerCase()?.includes('sản xuất') ||
                      !!currentUser?.role?.toLowerCase()?.includes('kỹ thuật');
  
  const canViewAll = isManager || !isInstaller;

  const filteredSchedules = canViewAll 
    ? schedules 
    : schedules.filter(s => 
        s.assigneeId === currentUser?.id || 
        (s.assigneeIds && currentUser?.id && s.assigneeIds.includes(currentUser.id))
      );

  const installerMembers = members.filter(m => 
    !!m.role?.toLowerCase()?.includes('thi công') || 
    !!m.role?.toLowerCase()?.includes('lắp đặt') || 
    !!m.role?.toLowerCase()?.includes('sản xuất') ||
    !!m.role?.toLowerCase()?.includes('kỹ thuật')
  );

  const [currentMonth, setCurrentMonth] = useState(() => getCurrentVNDate());
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [optimizedRoute, setOptimizedRoute] = useState<any>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const [formData, setFormData] = useState<Partial<InstallationSchedule>>({
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

  // Filter tasks waiting for installation that don't have an active installation schedule
  const unscheduledTasksList = tasks.filter(t => 
    t.status === 'waiting_install' && 
    !schedules.some(s => {
      if (s.status === 'cancelled') return false;
      if (s.taskId === t.id) return true;
      if (s.customerId && t.customerId && s.customerId === t.customerId) return true;
      if (s.customerName && (t.customerName || t.title) && s.customerName.toLowerCase() === (t.customerName || t.title).replace(/^sản xuất:\s*/i, '').trim().toLowerCase()) return true;
      return false;
    })
  ).map(t => ({
    id: t.id,
    type: 'task',
    name: t.customerName || t.title,
    workshop: t.workshop,
    address: t.address,
    phone: t.phone,
    rawTask: t,
    rawCustomer: undefined
  }));

  const unscheduledCustomersList = customers.filter(c => 
    (['contracted', 'production'].includes(c.stage)) && 
    !schedules.some(s => {
      if (s.status === 'cancelled') return false;
      if (s.customerId === c.id) return true;
      if (s.customerName && s.customerName.toLowerCase() === c.name.toLowerCase()) return true;
      return false;
    }) &&
    !unscheduledTasksList.some(t => t.rawTask?.customerId === c.id || (t.rawTask?.customerName && t.rawTask.customerName.toLowerCase() === c.name.toLowerCase())) // Avoid duplicates
  ).map(c => ({
    id: c.id,
    type: 'customer',
    name: c.name,
    workshop: undefined,
    address: c.address,
    phone: c.phone,
    rawTask: undefined,
    rawCustomer: c
  }));

  const unscheduledTasks = [...unscheduledTasksList, ...unscheduledCustomersList];

  const handleTaskSelect = (taskId: string) => {
    if (taskId === 'manual') {
      setFormData(prev => ({ 
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

      setFormData(prev => ({
        ...prev,
        taskId: task.id,
        customerId: customer?.id || task.customerId || '',
        customerName: customer?.name || task.customerName || task.title.replace(/sản xuất:\s*/i, '').trim(),
        phone: customer?.phone || task.phone || '',
        address: customer?.address || task.address || ''
      }));
    }
  };

  const handleInstallerToggle = (assigneeId: string, type: 'create' | 'edit') => {
    if (type === 'create') {
      const current = formData.assigneeIds || [];
      const newIds = current.includes(assigneeId) ? current.filter(id => id !== assigneeId) : [...current, assigneeId];
      setFormData(prev => ({ ...prev, assigneeIds: newIds, assigneeId: newIds[0] || '' }));
    } else {
      const current = editFormData.assigneeIds || [];
      const newIds = current.includes(assigneeId) ? current.filter(id => id !== assigneeId) : [...current, assigneeId];
      setEditFormData(prev => ({ ...prev, assigneeIds: newIds, assigneeId: newIds[0] || '' }));
    }
  };

  const taskOptions = [
    { label: '-- Nhập tay / Không liên kết thẻ --', value: 'manual' },
    ...unscheduledTasks.map(t => ({
      label: `${t.name} (${t.address || 'Không có địa chỉ'})`,
      value: t.id
    }))
  ];

  if (formData.taskId && formData.taskId !== 'manual' && !taskOptions.find(o => o.value === formData.taskId)) {
    const t = tasks.find(x => x.id === formData.taskId);
    taskOptions.push({
      label: t ? `${t.customerName || t.title} (${t.address || 'Không có địa chỉ'})` : formData.customerName || formData.taskId,
      value: formData.taskId
    });
  }

  const installerOptions = installerMembers.map(m => ({ label: `${m.name} (${m.role})`, value: m.id }));
  // Fallback to all members if list is empty
  const displayInstallerOptions = installerOptions.length > 0 
    ? installerOptions 
    : members.map(m => ({ label: `${m.name} (${m.role})`, value: m.id }));

  if (formData.assigneeId && !displayInstallerOptions.find(o => o.value === formData.assigneeId)) {
    const m = members.find(x => x.id === formData.assigneeId);
    displayInstallerOptions.push({
      label: m ? `${m.name} (${m.role})` : formData.assigneeId,
      value: formData.assigneeId
    });
  }

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const today = () => setCurrentMonth(getCurrentVNDate());

  const handleSave = async () => {
    if (!user) {
      toast.error('Vui lòng đăng nhập để lưu');
      return;
    }
    try {
      const id = Date.now().toString();
      const schedule: InstallationSchedule = {
        id,
        date: new Date(formData.date!).toISOString(),
        taskId: formData.taskId || '',
        customerId: formData.customerId || '',
        customerName: formData.customerName || '',
        phone: formData.phone || '',
        address: formData.address || '',
        status: formData.status as 'pending' | 'completed' | 'cancelled',
        assigneeId: formData.assigneeId || '',
        assigneeIds: formData.assigneeIds || [],
        notes: formData.notes,
        createdAt: new Date().toISOString()
      };

      InstallationScheduleSchema.parse(schedule);
      
      await setDoc(doc(db, 'installation_schedules', id), schedule);

      // Trigger notification to managers and assigned staff
      const assignee = members.find(m => m.id === schedule.assigneeId);
      notifyManagers(
        'Lịch lắp đặt mới',
        `Thợ ${assignee?.name || 'nào đó'} vừa được xếp lịch lắp đặt cho khách ${schedule.customerName} lúc ${format(new Date(schedule.date), 'HH:mm dd/MM')}`,
        { taskId: schedule.id, type: 'installation' },
        schedule.assigneeId
      );

      // Send to external bot platforms (Zalo/Telegram)
      sendSystemNotification(`🔧 Lịch lắp đặt mới!\n\n👤 Khách hàng: ${schedule.customerName}\n📞 SĐT: ${schedule.phone}\n📍 Địa chỉ: ${schedule.address}\n⏰ Thời gian: ${format(new Date(schedule.date), 'HH:mm dd/MM/yyyy')}\n📝 Ghi chú: ${schedule.notes || 'Không có'}\n\nĐược tạo bởi: ${currentUser?.name || 'Hệ thống'}`, 'production', schedule.workshop);

      // If completing directly, update linked task status and order status
      if (schedule.status === 'completed') {
        if (schedule.taskId) {
          const taskRef = doc(db, 'tasks', schedule.taskId);
          await updateDoc(taskRef, {
            status: 'done',
            completedAt: new Date().toISOString()
          });
          toast.info('Đã tự động chuyển trạng thái thẻ công việc sang: Hoàn thành');
        }

        // Complete the customer stage
        if (schedule.customerId) {
          await updateDoc(doc(db, 'customers', schedule.customerId), { 
            stage: 'completed'
          });
          queryClient.invalidateQueries({ queryKey: ['customers'] });
          toast.success(`Đã tự động hoàn tất dự án cho: ${schedule.customerName}`);
        }
      }

      toast.success('Đã xếp lịch lắp đặt thành công');
      setIsOpen(false);
      setFormData({
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
    } catch (error) {
      console.error("Lỗi khi xếp lịch lắp đặt:", error);
      if (error instanceof z.ZodError) {
        const errorMsg = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        toast.error('Lỗi định dạng dữ liệu: ' + errorMsg);
      } else {
        handleFirestoreError(error, OperationType.CREATE, 'installation_schedules');
        toast.error('Có lỗi xảy ra: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  };

  const [isUploading, setIsUploading] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<InstallationSchedule>>({});

  const handleEditClick = (schedule: InstallationSchedule) => {
    setEditingId(schedule.id);
    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    const localISOTime = (new Date(new Date(schedule.date).getTime() - tzOffset)).toISOString().slice(0, 16);
    setEditFormData({ ...schedule, date: localISOTime, assigneeIds: schedule.assigneeIds || (schedule.assigneeId ? [schedule.assigneeId] : []) });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditFormData({});
  };

  const handleSaveEdit = async (schedule: InstallationSchedule) => {
    if (!editFormData.customerName || editFormData.customerName.trim() === '') {
        toast.error('Vui lòng nhập tên khách hàng');
        return;
    }
    if (!editFormData.date || editFormData.date.trim() === '') {
        toast.error('Vui lòng nhập thời gian lắp');
        return;
    }
    if (!editFormData.phone || editFormData.phone.trim().length < 9) {
        toast.error('Vui lòng nhập số điện thoại hợp lệ');
        return;
    }

    setIsSaving(true);
    try {
        const scheduleRef = doc(db, 'installation_schedules', schedule.id);
        const updatedData = {
          ...editFormData,
          date: new Date(editFormData.date!).toISOString()
        };

        // If status changed to completed, update linked task status and customer stage
        if (updatedData.status === 'completed' && schedule.status !== 'completed') {
          if (updatedData.taskId) {
            const taskRef = doc(db, 'tasks', updatedData.taskId);
            await updateDoc(taskRef, {
              status: 'done',
              completedAt: new Date().toISOString()
            });
            toast.info('Đã tự động chuyển trạng thái thẻ công việc sang: Hoàn thành');
          }

          // Complete the customer stage
          if (updatedData.customerId) {
            await updateDoc(doc(db, 'customers', updatedData.customerId), { 
              stage: 'completed'
            });
            
            // Sync Quotation status
            try {
              const quotationQ = query(collection(db, 'quotations'), where('customerId', '==', updatedData.customerId));
              const quotationSnap = await getDocs(quotationQ);
              let hasUpdated = false;
              for (const qDoc of quotationSnap.docs) {
                const qData = qDoc.data();
                if (qData.status !== 'accepted' && qData.status !== 'rejected') {
                  await updateDoc(doc(db, 'quotations', qDoc.id), { status: 'accepted' });
                  hasUpdated = true;
                }
              }
              if (hasUpdated) {
                queryClient.invalidateQueries({ queryKey: ['quotations'] });
              }
            } catch (err) {
              console.error("Error syncing customer stage to quotations:", err);
            }

            queryClient.invalidateQueries({ queryKey: ['customers'] });
            toast.success(`Đã tự động hoàn tất dự án cho: ${updatedData.customerName}`);
          }
        }

        const { id, createdAt, ...dataToUpdate } = updatedData as any;
        await updateDoc(scheduleRef, dataToUpdate);

        // Send to external bot platforms (Zalo/Telegram)
        sendSystemNotification(`✏️ Cập nhật lịch lắp đặt!\n\n👤 Khách hàng: ${updatedData.customerName}\n📞 SĐT: ${updatedData.phone}\n📍 Địa chỉ: ${updatedData.address}\n⏰ Thời gian mới: ${format(new Date(updatedData.date), 'HH:mm dd/MM/yyyy')}\n📝 Ghi chú: ${updatedData.notes || 'Không có'}\n\nĐược cập nhật bởi: ${currentUser?.name || 'Hệ thống'}`, 'production', updatedData.workshop);

        toast.success('Đã cập nhật lịch lắp đặt');
        setEditingId(null);
        setEditFormData({});
        queryClient.invalidateQueries({ queryKey: ['installation_schedules'] });
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
    } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'installation_schedules');
        toast.error('Lỗi khi lưu thay đổi');
    } finally {
        setIsSaving(false);
    }
  };

  const handleFileUpload = async (schedule: InstallationSchedule, files: FileList) => {
    setIsUploading(schedule.id);
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
      setIsUploading(null);
    }
  };

  const handleUpdateStatus = async (item: InstallationSchedule, newStatus: 'pending' | 'completed' | 'cancelled') => {
    try {
      const scheduleRef = doc(db, 'installation_schedules', item.id);
      
      // Fetch fresh data for image validation
      const snap = await getDoc(scheduleRef);
      const freshItem = snap.exists() ? snap.data() as InstallationSchedule : item;

      if (newStatus === 'completed' && (!freshItem.imageUrls || freshItem.imageUrls.length === 0)) {
        toast.error('Vui lòng tải ảnh nghiệm thu lắp đặt lên trước khi hoàn tất!');
        return;
      }

      await updateDoc(scheduleRef, {
        status: newStatus
      });

      // Send to external bot platforms (Zalo/Telegram)
      let statusText = 'Chờ lắp đặt';
      if (newStatus === 'completed') statusText = 'Hoàn thành';
      else if (newStatus === 'cancelled') statusText = 'Đã hủy';
      sendSystemNotification(`📊 Cập nhật trạng thái lịch lắp đặt!\n\n👤 Khách hàng: ${freshItem.customerName}\n🏷 Trạng thái mới: ${statusText}\n\nĐược cập nhật bởi: ${currentUser?.name || 'Hệ thống'}`, 'production', freshItem.workshop);

      // Update linked task status if completed
      if (newStatus === 'completed') {
        if (freshItem.taskId) {
          const taskRef = doc(db, 'tasks', freshItem.taskId);
          await updateDoc(taskRef, {
            status: 'done',
            completedAt: new Date().toISOString()
          });
          toast.info('Đã tự động chuyển trạng thái thẻ công việc sang: Hoàn thành');
        }

        // Complete the customer stage
        if (freshItem.customerId) {
          await updateDoc(doc(db, 'customers', freshItem.customerId), { 
            stage: 'completed'
          });
          queryClient.invalidateQueries({ queryKey: ['customers'] });
          toast.success(`Đã tự động hoàn tất dự án cho: ${freshItem.customerName}`);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['installation_schedules'] });
      
      let message = 'Đã cập nhật trạng thái';
      if (newStatus === 'completed') message = 'Đã hoàn thành lắp đặt';
      else if (newStatus === 'cancelled') message = 'Đã hủy lịch lắp đặt';
      else if (newStatus === 'pending') message = 'Đã đưa về trạng thái chờ lắp';

      toast.success(message);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'installation_schedules');
      toast.error('Có lỗi xảy ra');
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa lịch lắp đặt này không?')) return;
    try {
      await deleteDoc(doc(db, 'installation_schedules', id));
      queryClient.invalidateQueries({ queryKey: ['installation_schedules'] });
      toast.success('Đã xóa lịch lắp đặt');
      setDetailsOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'installation_schedules');
      toast.error('Có lỗi xảy ra khi xóa');
    }
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const dateFormat = "d";
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

  const getSchedulesForDay = (day: Date) => {
    return filteredSchedules.filter(schedule => isSameDay(parseISO(schedule.date), day));
  };

  const currentMonthSchedules = filteredSchedules.filter(schedule => isSameMonth(parseISO(schedule.date), currentMonth));
  const stats = {
    total: currentMonthSchedules.length,
    completed: currentMonthSchedules.filter(s => s.status === 'completed').length,
    pending: currentMonthSchedules.filter(s => s.status === 'pending').length,
    cancelled: currentMonthSchedules.filter(s => s.status === 'cancelled').length,
  };

  const openDayDetails = (day: Date) => {
    setSelectedDate(day);
    setDetailsOpen(true);
    setOptimizedRoute(null);
  };

  const handleOptimizeRoute = async () => {
    if (!selectedDate) return;
    const daySchedules = getSchedulesForDay(selectedDate);
    if (daySchedules.length === 0) return;

    setIsOptimizing(true);
    try {
      let startPoint = {
        lat: 21.0278,
        lng: 105.8342,
        name: 'Vị trí mặc định',
        address: 'Hà Nội'
      };

      try {
        const settingsSnap = await getDoc(doc(db, 'settings', 'system'));
        if (settingsSnap.exists()) {
          const settings = settingsSnap.data();
          if (settings.factoryLocation) {
            startPoint = {
              lat: settings.factoryLocation.lat,
              lng: settings.factoryLocation.lng,
              name: 'Xưởng sản xuất',
              address: settings.factoryLocation.address || 'Địa chỉ xưởng'
            };
          }
        }
      } catch (err) {
        console.warn('Could not load workshop settings, using fallback.', err);
      }

      const points = daySchedules.map(s => {
        const cust = customers.find(c => c.id === s.customerId || c.name === s.customerName);
        return {
          id: s.id,
          name: s.customerName,
          address: s.address,
          latitude: cust?.location?.lat,
          longitude: cust?.location?.lng
        };
      });

      const optimized = await optimizeRoute(startPoint, points);
      setOptimizedRoute(optimized);
      toast.success('Đã tối ưu lộ trình di chuyển thành công!');
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi tối ưu lộ trình.');
    } finally {
      setIsOptimizing(false);
    }
  };

  const sortedSchedules = React.useMemo(() => {
    const daySchedules = getSchedulesForDay(selectedDate || new Date());
    if (!optimizedRoute || optimizedRoute.steps.length === 0) return daySchedules;
    
    return [...daySchedules].sort((a, b) => {
      const idxA = optimizedRoute.steps.findIndex((step: any) => step.point.id === a.id);
      const idxB = optimizedRoute.steps.findIndex((step: any) => step.point.id === b.id);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  }, [selectedDate, filteredSchedules, optimizedRoute]);

  const openAddForDate = (date: Date) => {
    const newDate = new Date(date);
    newDate.setHours(8, 0, 0, 0);
    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    const localISOTime = (new Date(newDate.getTime() - tzOffset)).toISOString().slice(0, 16);
    
    setFormData(prev => ({
      ...prev,
      date: localISOTime
    }));
    setIsOpen(true);
    setDetailsOpen(false);
  };

  const handleQuickSchedule = (task: Task) => {
    const customer = task.customerId 
      ? customers.find(c => c.id === task.customerId) 
      : customers.find(c => c.name.toLowerCase() === (task.customerName || '').toLowerCase());

    setFormData(prev => ({
      ...prev,
      taskId: task.id,
      customerId: customer?.id || task.customerId || '',
      customerName: customer?.name || task.customerName || task.title.replace(/sản xuất:\s*/i, '').trim(),
      phone: customer?.phone || task.phone || '',
      address: customer?.address || task.address || ''
    }));
    setIsOpen(true);
  };

  return (
    <div className="space-y-4 flex flex-col h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shrink-0">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Hammer className="h-5.5 w-5.5 text-primary" />
            Lịch Lắp Đặt
          </h2>
          <p className="text-[10px] md:text-xs text-muted-foreground font-medium">Điều phối, xếp lịch thi công & hoàn thiện tại công trình</p>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
           <div className="text-sm font-semibold w-[140px] text-center hidden sm:block relative">
             <input 
               type="month"
               value={format(currentMonth, 'yyyy-MM')}
               onChange={(e) => {
                 if (e.target.value) {
                   setCurrentMonth(parseISO(e.target.value + '-01'));
                 }
               }}
               className="bg-transparent border-none outline-none font-semibold text-center w-full cursor-pointer hover:bg-gray-100 rounded px-2 py-1"
             />
           </div>
           <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200 shadow-sm dark:bg-zinc-800">
            <Button variant="ghost" size="icon" onClick={prevMonth} className="h-7 w-7">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" className="h-7 px-2 text-xs font-medium" onClick={today}>
              Hôm nay
            </Button>
            <Button variant="ghost" size="icon" onClick={nextMonth} className="h-7 w-7">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => openAddForDate(new Date())} size="sm" className="gap-1 px-2.5 shrink-0 h-8 text-xs rounded-xl shadow-md">
            <Plus className="h-3.5 w-3.5" />
            <span>Xếp lịch</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
        {[
          { label: 'Tổng lịch', value: stats.total, color: '' },
          { label: 'Chờ lắp', value: stats.pending, color: 'text-blue-600' },
          { label: 'Hoàn thành', value: stats.completed, color: 'text-emerald-600' },
          { label: 'Hủy lịch', value: stats.cancelled, color: 'text-red-600' },
        ].map((s) => (
          <Card key={s.label} className="bg-card text-card-foreground border border-gray-200 relative group overflow-hidden shadow-sm dark:border-zinc-800 rounded-xl">
            <CardContent className="p-2 flex flex-col items-center justify-center relative">
              <span className="text-[8px] md:text-[10px] text-muted-foreground uppercase font-black tracking-wider truncate">{s.label}</span>
              <span className={cn("text-sm md:text-lg font-bold", s.color)}>{s.value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-4 min-h-0 flex-1">
        {/* Left Column: Calendar */}
        <Card className="flex-1 flex flex-col min-h-[400px] overflow-hidden shadow-sm border border-gray-200 dark:border-zinc-800 rounded-2xl">
          <div className="grid grid-cols-7 border-b bg-gray-50 dark:bg-zinc-900 shrink-0">
            {weekDays.map((day, idx) => (
              <div key={idx} className="py-2.5 text-center text-xs font-bold text-muted-foreground">
                {day}
              </div>
            ))}
          </div>
          <div className="flex-1 overflow-auto min-h-0 bg-card text-card-foreground">
            <div className="grid grid-cols-7 min-w-[700px] auto-rows-[minmax(80px,1fr)] sm:auto-rows-[minmax(100px,1fr)] md:auto-rows-[minmax(120px,1fr)] min-h-full">
              {days.map((day, dayIdx) => {
                const daySchedules = getSchedulesForDay(day);
                const isCurrentMonth = isSameMonth(day, monthStart);
                const isDayToday = isSameDay(day, getCurrentVNDate());

                return (
                  <div
                    key={day.toString()}
                    onClick={() => openDayDetails(day)}
                    className={cn(
                      "min-h-[70px] sm:min-h-[100px] md:min-h-[120px] p-1.5 border-b border-r transition-colors cursor-pointer hover:bg-secondary/40 group relative flex flex-col justify-between",
                      !isCurrentMonth ? "bg-gray-100/50 text-muted-foreground dark:bg-zinc-900/40" : "bg-card text-card-foreground",
                      dayIdx % 7 === 6 ? "border-r-0" : "border-r"
                    )}
                  >
                    <div className="flex justify-between items-start mb-1 shrink-0">
                      <span className={cn(
                        "inline-flex items-center justify-center w-5.5 h-5.5 sm:w-7 sm:h-7 rounded-full text-[10px] sm:text-xs font-bold",
                        isDayToday ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : ""
                      )}>
                        {format(day, dateFormat)}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-5 w-5 sm:h-6 sm:w-6 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex hover:bg-secondary rounded-lg"
                        onClick={(e) => {
                          e.stopPropagation();
                          openAddForDate(day);
                        }}
                      >
                        <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                    </div>
                    
                    <div className="flex-1 overflow-hidden flex flex-col space-y-1">
                      {daySchedules.slice(0, 3).map((schedule) => (
                        <div 
                          key={schedule.id}
                          className={cn(
                            "text-[9px] sm:text-xs px-2 py-1 rounded truncate border font-medium flex items-center gap-1 shadow-sm",
                            schedule.status === 'completed' ? 'text-emerald-700 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900' :
                            schedule.status === 'cancelled' ? 'text-red-700 border-red-200 bg-red-50 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900' :
                            'text-blue-700 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900'
                          )}
                          title={`${schedule.customerName} - ${schedule.address}`}
                        >
                          <span className="font-bold opacity-75">{format(parseISO(schedule.date), 'HH:mm')}</span>
                          <span className="truncate">{schedule.customerName}</span>
                        </div>
                      ))}
                      {daySchedules.length > 3 && (
                        <div className="text-[9px] sm:text-xs text-muted-foreground text-center font-semibold py-0.5">
                          + {daySchedules.length - 3} lịch lắp
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Right Column: Unscheduled tasks list */}
        <Card className="w-full lg:w-[350px] flex flex-col border border-gray-200 dark:border-zinc-800 rounded-2xl bg-card overflow-hidden shadow-sm shrink-0">
          <CardHeader className="p-4 border-b bg-gray-50 dark:bg-zinc-900 shrink-0">
            <CardTitle className="text-sm font-bold flex items-center gap-1.5">
              <ClipboardList className="h-4.5 w-4.5 text-primary" />
              Chờ xếp lịch lắp đặt
              {unscheduledTasks.length > 0 && (
                <Badge variant="destructive" className="ml-auto text-[10px] px-1.5 py-0">
                  {unscheduledTasks.length}
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-[10px]">
              Kéo sang cột chờ lắp để hiển thị tại đây
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 flex-1 overflow-y-auto">
            {unscheduledTasks.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                <Wrench className="h-10 w-10 text-muted-foreground/30 mb-2" />
                <p className="text-xs font-semibold">Tất cả việc đã xếp lịch</p>
                <p className="text-[10px] text-muted-foreground/75 max-w-[200px] mt-1">Không có dự án nào đang chờ xếp lịch lắp đặt.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {unscheduledTasks.map((item) => (
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

                              setFormData(prev => ({
                                ...prev,
                                taskId: task.id,
                                customerId: customer?.id || task.customerId || '',
                                customerName: customer?.name || task.customerName || task.title.replace(/sản xuất:\s*/i, '').trim(),
                                phone: customer?.phone || task.phone || '',
                                address: customer?.address || task.address || ''
                              }));
                            } else {
                              const customer = item.rawCustomer!;
                              setFormData(prev => ({
                                ...prev,
                                taskId: '',
                                customerId: customer.id,
                                customerName: customer.name,
                                phone: customer.phone || '',
                                address: customer.address || ''
                              }));
                            }
                            setIsOpen(true);
                          }}
                          size="sm" 
                          className="h-6 text-[10px] px-2 rounded-lg bg-primary hover:bg-primary/90 font-semibold"
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

      {/* Add/Schedule Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
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
                value={formData.taskId || 'manual'} 
                onValueChange={handleTaskSelect}
              >
              <SelectTrigger className="h-10 bg-gray-50 border-gray-200 rounded-xl dark:bg-zinc-800 dark:border-zinc-700 w-full">
                  <SelectValue placeholder="Chọn từ danh sách chờ lắp hoặc tự nhập">
                    {formData.taskId && formData.taskId !== 'manual' 
                      ? (taskOptions.find(o => o.value === formData.taskId)?.label || formData.taskId) 
                      : (formData.taskId === 'manual' ? '-- Nhập tay / Không liên kết thẻ --' : 'Chọn từ danh sách chờ lắp hoặc tự nhập')}
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
                  value={formData.customerName} 
                  onChange={e => setFormData({...formData, customerName: e.target.value})} 
                  placeholder="Họ và tên"
                  className="h-10 rounded-xl w-full border-gray-200 dark:border-zinc-700"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">Điện thoại khách *</Label>
                <Input 
                  value={formData.phone} 
                  onChange={e => setFormData({...formData, phone: e.target.value})} 
                  placeholder="090..."
                  className="h-10 rounded-xl w-full border-gray-200 dark:border-zinc-700"
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">Địa chỉ lắp đặt *</Label>
              <Input 
                 value={formData.address} 
                onChange={e => setFormData({...formData, address: e.target.value})} 
                placeholder="Địa chỉ công trình"
                className="h-10 rounded-xl border-gray-200 dark:border-zinc-700"
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">Thời gian lắp đặt *</Label>
                <Input 
                  type="datetime-local" 
                  value={formData.date} 
                  onChange={e => setFormData({...formData, date: e.target.value})}
                  className="h-10 rounded-xl bg-gray-50 border-gray-200 cursor-pointer w-full dark:bg-zinc-800 dark:border-zinc-700"
                />
              </div>
              <div className="space-y-1.5 flex flex-col">
                <Label className="text-xs font-bold text-muted-foreground">Nhân viên thi công *</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="h-10 rounded-xl border border-gray-200 bg-gray-50 w-full justify-start text-left font-normal px-4 py-2 text-sm flex items-center dark:bg-zinc-800 dark:border-zinc-700">
                      {(formData.assigneeIds && formData.assigneeIds.length > 0) 
                        ? `${formData.assigneeIds.length} nhân viên được chọn` 
                        : 'Chọn thợ lắp đặt (có thể chọn nhiều)'}
                    </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-[300px] max-h-[300px] overflow-y-auto bg-card z-50">
                    {displayInstallerOptions.map(m => (
                      <DropdownMenuCheckboxItem
                        key={m.value}
                        checked={(formData.assigneeIds || []).includes(m.value)}
                        onCheckedChange={() => handleInstallerToggle(m.value, 'create')}
                      >
                        {m.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                {(formData.assigneeIds && formData.assigneeIds.length > 0) && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {formData.assigneeIds.map(id => {
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
                value={formData.notes || ''} 
                onChange={e => setFormData({...formData, notes: e.target.value})} 
                placeholder="Lưu ý về sản phẩm, tiến độ lắp ráp..."
                className="h-10 rounded-xl border-gray-200 dark:border-zinc-700"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)} className="rounded-xl">Hủy</Button>
            <Button onClick={handleSave} className="rounded-xl">Lưu thông tin</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details/Edit Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden rounded-2xl">
          <div className="flex flex-col max-h-[90vh]">
            <DialogHeader className="shrink-0 border-b p-6 pb-3">
              <DialogTitle className="flex items-center gap-2 font-bold">
                 <CalendarIcon className="h-5 w-5 text-primary" />
                 Chi tiết ngày {selectedDate && format(selectedDate, 'dd/MM/yyyy')}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Danh sách các lịch lắp đặt và thi công hoàn thiện trong ngày.
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-4">
                {selectedDate && getSchedulesForDay(selectedDate).length > 1 && (
                  <div className="bg-slate-50/50 dark:bg-zinc-900/50 p-3.5 rounded-xl border border-border">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        Tối ưu hóa đường đi
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={handleOptimizeRoute}
                        disabled={isOptimizing}
                        className="h-8 text-[11px] font-bold border-primary/20 text-primary hover:bg-primary/5 flex items-center gap-1 cursor-pointer"
                      >
                        {isOptimizing ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Navigation className="h-3 w-3" />
                        )}
                        Lộ trình tối ưu
                      </Button>
                    </div>

                    {optimizedRoute && optimizedRoute.steps.length > 0 && (
                      <div className="mt-3.5 space-y-2 border-t pt-3 text-xs">
                        <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500 animate-pulse" />
                          Lộ trình đề xuất (Bắt đầu từ xưởng):
                        </div>
                        <div className="space-y-2.5 pl-2 border-l-2 border-primary/30 mt-2">
                          <div className="text-[10px] text-muted-foreground font-black uppercase">Điểm xuất phát: Xưởng sản xuất</div>
                          {optimizedRoute.steps.map((step: any, idx: number) => (
                            <div key={idx} className="flex flex-col gap-0.5">
                              <div className="font-semibold flex items-center gap-1.5">
                                <span className="w-4 h-4 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-[9px] font-black">{idx + 1}</span>
                                <span className="text-slate-950 dark:text-slate-50">{step.point.name}</span>
                              </div>
                              <div className="text-[10px] text-muted-foreground pl-5.5">
                                Quãng đường: <strong className="text-foreground">{step.distanceFromPrevKm} km</strong> | Thời gian: <strong className="text-foreground">~{step.durationFromPrevMin} phút</strong>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 bg-primary/5 border border-primary/10 rounded-lg p-2.5 flex justify-between text-[11px] font-bold text-primary">
                          <span>Tổng quãng đường: {optimizedRoute.totalDistanceKm} km</span>
                          <span>Tổng di chuyển: ~{optimizedRoute.totalDurationMin} phút</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {selectedDate && sortedSchedules.length > 0 ? (
                  sortedSchedules.map((schedule) => {
                    const assignee = members.find(m => m.id === schedule.assigneeId);
                    return (
                      <div key={schedule.id} className="p-4 rounded-xl border bg-card shadow-sm space-y-3 dark:border-zinc-800">
                        {editingId === schedule.id ? (
                          <div className="space-y-4 text-sm">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-muted-foreground">Ngày giờ lắp *</Label>
                                <Input 
                                  type="datetime-local"
                                  value={editFormData.date || ''}
                                  onChange={e => setEditFormData({...editFormData, date: e.target.value})}
                                  className="h-10 w-full rounded-xl border border-gray-200 dark:border-zinc-700"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-muted-foreground">Tên khách hàng *</Label>
                                <Input 
                                  value={editFormData.customerName || ''}
                                  onChange={e => setEditFormData({...editFormData, customerName: e.target.value})}
                                  className="h-10 w-full rounded-xl border border-gray-200 dark:border-zinc-700"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-muted-foreground">SĐT khách hàng *</Label>
                                <Input 
                                  type="tel"
                                  value={editFormData.phone || ''}
                                  onChange={e => setEditFormData({...editFormData, phone: e.target.value})}
                                  className="h-10 w-full rounded-xl border border-gray-200 dark:border-zinc-700"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-muted-foreground">Địa chỉ *</Label>
                                <Input 
                                  value={editFormData.address || ''}
                                  onChange={e => setEditFormData({...editFormData, address: e.target.value})}
                                  className="h-10 w-full rounded-xl border border-gray-200 dark:border-zinc-700"
                                />
                              </div>
                              <div className="space-y-1.5 flex flex-col">
                                <Label className="text-xs font-bold text-muted-foreground">Nhân viên thi công *</Label>
                                <DropdownMenu>
                                  <DropdownMenuTrigger className="h-10 rounded-xl border border-gray-200 bg-card w-full justify-start text-left font-normal px-4 py-2 text-sm flex items-center dark:border-zinc-700">
                                    {(editFormData.assigneeIds && editFormData.assigneeIds.length > 0) 
                                      ? `${editFormData.assigneeIds.length} nhân viên được chọn` 
                                      : 'Chọn nhân viên (có thể chọn nhiều)'}
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent className="w-[300px] max-h-[300px] overflow-y-auto bg-card z-50">
                                    {members.map(m => (
                                      <DropdownMenuCheckboxItem
                                        key={m.id}
                                        checked={(editFormData.assigneeIds || []).includes(m.id)}
                                        onCheckedChange={() => handleInstallerToggle(m.id, 'edit')}
                                      >
                                        {m.name || 'Không xác định'}
                                      </DropdownMenuCheckboxItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                {(editFormData.assigneeIds && editFormData.assigneeIds.length > 0) && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {editFormData.assigneeIds.map(id => {
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
                                  value={editFormData.status || ''} 
                                  onValueChange={(val: any) => setEditFormData({...editFormData, status: val})}
                                >
                                  <SelectTrigger className="h-10 w-full rounded-xl border border-gray-200 dark:border-zinc-700 bg-card">
                                    <SelectValue placeholder="Chọn trạng thái">
                                      {editFormData.status === 'completed' ? 'Đã hoàn thành' : 
                                       editFormData.status === 'cancelled' ? 'Đã hủy' : 
                                       editFormData.status === 'pending' ? 'Chờ lắp đặt' : 'Chọn trạng thái'}
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
                                  value={editFormData.notes || ''}
                                  onChange={e => setEditFormData({...editFormData, notes: e.target.value})}
                                  className="h-10 w-full rounded-xl border border-gray-200 dark:border-zinc-700"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                              <Button variant="outline" size="sm" onClick={handleCancelEdit} disabled={isSaving} className="rounded-xl">Hủy</Button>
                              <Button size="sm" onClick={() => handleSaveEdit(schedule)} disabled={isSaving} className="rounded-xl">{isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}</Button>
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
                                        disabled={isUploading === schedule.id}
                                        onChange={(e) => {
                                          if (e.target.files?.length) {
                                            handleFileUpload(schedule, e.target.files);
                                            e.target.value = '';
                                          }
                                        }}
                                        className="h-9 text-xs file:text-xs file:h-full rounded-xl cursor-pointer"
                                      />
                                      {isUploading === schedule.id && (
                                        <div className="text-[10px] text-blue-500 animate-pulse font-bold">Đang tải ảnh lên...</div>
                                      )}
                                    </div>
                                  )}
                                  <div className="flex gap-2 mt-2 flex-wrap min-h-[40px]">
                                    {(schedule.imageUrls || []).map((url, i) => (
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
                                      onClick={() => handleUpdateStatus(schedule, 'completed')}
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
                                      onClick={() => handleUpdateStatus(schedule, 'pending')}
                                    >
                                      Mở lại lịch
                                    </Button>
                                  )}
                                  {schedule.status === 'pending' && (
                                    <Button 
                                      size="sm" 
                                      variant="destructive"
                                      className="rounded-xl h-8 text-xs font-semibold"
                                      onClick={() => handleUpdateStatus(schedule, 'cancelled')}
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
                                    onClick={() => handleDeleteSchedule(schedule.id)}
                                  >
                                    Xóa lịch
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="rounded-xl h-8 text-xs font-semibold"
                                    onClick={() => handleEditClick(schedule)}
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
                  })
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CalendarIcon className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs font-semibold">Không có lịch lắp đặt nào</p>
                    <p className="text-[10px] text-muted-foreground/75 mt-0.5">Nhấp vào nút thêm ở góc để tạo lịch lắp đặt.</p>
                  </div>
                )}
              </div>
            </div>
            <div className="shrink-0 border-t p-4 flex justify-end bg-gray-50 dark:bg-zinc-900">
              <Button variant="outline" onClick={() => setDetailsOpen(false)} className="rounded-xl h-9 text-xs">Đóng</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
