import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MeasurementSchedule, Member, Customer } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Calendar as CalendarIcon, MapPin, Phone, User, Clock, ChevronLeft, ChevronRight, X, Trash2, ClipboardList } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay, addMonths, subMonths, isToday, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { doc, setDoc, deleteDoc, updateDoc, arrayUnion, arrayRemove, onSnapshot, getDoc, db, handleFirestoreError, OperationType, collection, query, where, getDocs, addDoc } from '@/src/lib/firebase';
import { uploadToImgBB } from '@/src/services/uploadService';
import { z } from 'zod';
import { MeasurementScheduleSchema } from '@/src/schemas';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn, getCurrentVNDate, getVNTimestamp } from '@/src/lib/utils';
import { notifyManagers } from '@/src/services/notificationService';
import { moveToTrash } from '@/src/services/trashService';

interface MeasurementPageProps {
  schedules: MeasurementSchedule[];
  members: Member[];
  customers: Customer[];
  user: any;
  currentUser: Member | null;
}

export function MeasurementPage({ schedules, members, customers, user, currentUser }: MeasurementPageProps) {
  const queryClient = useQueryClient();
  const isManager = !!currentUser?.role?.toLowerCase()?.includes('quản lý') || (user && ['nhoanhkoem01@gmail.com', 'haanhtran.cv02@gmail.com'].includes(user.email));

  const filteredSchedules = isManager 
    ? schedules 
    : schedules.filter(s => s.assigneeId === currentUser?.id);

  const syncMeasurementToDesignTask = async (schedule: MeasurementSchedule, customImageUrls?: string[]) => {
    try {
      const q = query(collection(db, 'tasks'), where('type', '==', 'design'));
      const querySnapshot = await getDocs(q);
      
      const urlsToSync = customImageUrls || schedule.imageUrls || [];
      const cleanPhone = schedule.phone?.trim()?.replace(/\D/g, '');
      const cleanName = schedule.customerName?.toLowerCase()?.trim()?.replace('thiết kế:', '')?.trim();
      
      let matchedDocs = querySnapshot.docs.filter(doc => {
        const taskData = doc.data();
        if (schedule.customerId && taskData.customerId === schedule.customerId) return true;
        
        const taskPhone = taskData.phone?.trim()?.replace(/\D/g, '') || 
                          taskData.description?.replace(/\D/g, '').slice(-10);
        if (cleanPhone && taskPhone && (cleanPhone.includes(taskPhone) || taskPhone.includes(cleanPhone))) return true;
        
        const taskTitle = taskData.title?.toLowerCase()?.replace('thiết kế:', '')?.trim();
        if (cleanName && taskTitle && (taskTitle.includes(cleanName) || cleanName.includes(taskTitle))) return true;
        
        return false;
      });
      
      if (matchedDocs.length > 0) {
        for (const taskDoc of matchedDocs) {
          const taskData = taskDoc.data();
          const updateData: any = {
            imageUrls: urlsToSync
          };
          
          if (schedule.customerId && !taskData.customerId) updateData.customerId = schedule.customerId;
          if (schedule.phone && !taskData.phone) updateData.phone = schedule.phone;
          if (schedule.address && !taskData.address) updateData.address = schedule.address;
          if (schedule.customerName && !taskData.customerName) updateData.customerName = schedule.customerName;
          
          if (schedule.designAssigneeId && taskData.assigneeId !== schedule.designAssigneeId) {
            updateData.assigneeId = schedule.designAssigneeId;
          }
          
          await updateDoc(doc(db, 'tasks', taskDoc.id), updateData);
        }
        if (!schedule.isPushedToDesign) {
          await updateDoc(doc(db, 'measurement_schedules', schedule.id), {
            isPushedToDesign: true
          });
        }
      } else if (schedule.designAssigneeId) {
        let workshop = '';
        if (schedule.customerId) {
          const customerRef = doc(db, 'customers', schedule.customerId);
          const customerSnap = await getDoc(customerRef);
          if (customerSnap.exists()) {
            workshop = (customerSnap.data() as Customer).workshop || '';
          }
        }

        await addDoc(collection(db, 'tasks'), {
          title: `Thiết kế: ${schedule.customerName}`,
          description: schedule.notes || `Tiếp nhận thông tin đo đạc của khách hàng ${schedule.customerName}`,
          status: 'todo',
          type: 'design',
          priority: 'medium',
          assigneeId: schedule.designAssigneeId,
          customerId: schedule.customerId || '',
          phone: schedule.phone || '',
          address: schedule.address || '',
          customerName: schedule.customerName || '',
          workshop: workshop,
          createdAt: new Date().toISOString(),
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          files2D3D: [],
          imageUrls: urlsToSync,
          checklists: [],
          materialList: [],
        });
        await updateDoc(doc(db, 'measurement_schedules', schedule.id), {
          isPushedToDesign: true
        });
      }
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['measurement_schedules'] });
    } catch (error) {
      console.error("Error syncing to design task:", error);
    }
  };

  const autoSyncToSaleWeeklyPlan = async (scheduleItem: any) => {
    try {
      const nowStr = new Date().toISOString();
      const scheduledDate = nowStr.split('T')[0];
      const newSaleTask = {
        title: `Tư vấn & Báo giá: ${scheduleItem.customerName}`,
        description: `Đã hoàn tất đo đạc. Cần lên báo giá/thiết kế cho khách hàng ${scheduleItem.customerName}. SĐT: ${scheduleItem.phone}. Địa chỉ: ${scheduleItem.address}.`,
        status: 'in-progress',
        type: 'sale',
        priority: 'high',
        assigneeId: scheduleItem.assigneeId || currentUser?.id || '',
        customerId: scheduleItem.customerId || '',
        createdAt: nowStr,
        scheduledDate: scheduledDate,
        dueDate: scheduledDate,
      };
      await addDoc(collection(db, 'tasks'), newSaleTask);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    } catch (err) {
      console.error('Error auto-syncing to weekly plan:', err);
    }
  };

  const saleMembers = members.filter(m => !!m.role?.toLowerCase()?.includes('sale'));
  const designMembers = members.filter(m => !!m.role?.toLowerCase()?.includes('design') || !!m.role?.toLowerCase()?.includes('thiết kế'));

  const [currentMonth, setCurrentMonth] = useState(() => getCurrentVNDate());
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [formData, setFormData] = useState<Partial<MeasurementSchedule>>({
    customerId: '',
    customerName: '',
    phone: '',
    address: '',
    date: new Date().toISOString().slice(0, 16),
    assigneeId: currentUser?.id || '',
    notes: '',
    status: 'pending'
  });

  const consultingCustomers = customers;
  const unscheduledMeasurements = customers.filter(c => 
    (c.stage === 'consulting' || c.stage === 'contracted') && 
    !schedules.some(s => {
      if (s.status === 'cancelled') return false;
      if (s.customerId === c.id) return true;
      if (s.customerName && s.customerName.toLowerCase() === c.name.toLowerCase()) return true;
      return false;
    })
  );

  const handleCustomerSelect = (customerId: string) => {
    if (customerId === 'manual') {
      setFormData(prev => ({ 
        ...prev, 
        customerId: '', 
        customerName: '', 
        phone: '', 
        address: '' 
      }));
      return;
    }

    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      setFormData(prev => ({
        ...prev,
        customerId: customer.id,
        customerName: customer.name || '',
        phone: customer.phone || '',
        address: customer.address || ''
      }));
    }
  };

  const handleSaleSelect = (assigneeId: string) => {
    setFormData(prev => ({ ...prev, assigneeId }));
  };

  const customerOptions = [
    { label: '-- Nhập tay mới --', value: 'manual' },
    ...consultingCustomers.map(c => ({
      label: `${c.code || 'KH...'} - ${c.name || 'Khách chưa có tên'}`,
      value: c.id
    }))
  ];

  if (formData.customerId && formData.customerId !== 'manual' && !customerOptions.find(o => o.value === formData.customerId)) {
    const c = customers.find(x => x.id === formData.customerId);
    customerOptions.push({
      label: c ? `${c.code || 'KH...'} - ${c.name || 'Khách chưa có tên'}` : formData.customerName || formData.customerId,
      value: formData.customerId
    });
  }

  const saleOptions = saleMembers.map(m => ({ label: m.name || m.email || 'Sale (chưa có tên)', value: m.id }));
  if (formData.assigneeId && !saleOptions.find(o => o.value === formData.assigneeId)) {
    const m = members.find(x => x.id === formData.assigneeId);
    saleOptions.push({
      label: m ? (m.name || m.email || 'Sale (chưa có tên)') : formData.assigneeId,
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
      const schedule: MeasurementSchedule = {
        id,
        date: new Date(formData.date!).toISOString(),
        customerId: formData.customerId || '',
        customerName: formData.customerName || '',
        phone: formData.phone || '',
        address: formData.address || '',
        status: formData.status as 'pending' | 'completed' | 'cancelled',
        assigneeId: formData.assigneeId || currentUser?.id || '',
        notes: formData.notes,
        createdAt: new Date().toISOString()
      };

      MeasurementScheduleSchema.parse(schedule);
      
      await setDoc(doc(db, 'measurement_schedules', id), schedule);

      // Trigger notification to managers and the assignee
      const assignee = members.find(m => m.id === schedule.assigneeId);
      notifyManagers(
        'Lịch đo đạc mới',
        `Sale ${assignee?.name || 'nào đó'} vừa tạo lịch đo cho khách ${schedule.customerName} lúc ${format(new Date(schedule.date), 'HH:mm dd/MM')}`,
        { taskId: schedule.id, type: 'measurement' },
        schedule.assigneeId
      );

      // Automatically update customer stage to 'surveying' if created as completed
      if (schedule.status === 'completed' && schedule.customerId) {
        const customerRef = doc(db, 'customers', schedule.customerId);
        const customerSnap = await getDoc(customerRef);
        if (customerSnap.exists()) {
          const customerData = customerSnap.data() as Customer;
          if (customerData.stage === 'consulting') {
            await updateDoc(customerRef, {
              stage: 'surveying'
            });
            toast.info('Đã cập nhật trạng thái khách hàng sang: Đã Đo Đạc');
          }
        }
      }

      if (schedule.status === 'completed') {
        await autoSyncToSaleWeeklyPlan(schedule);
      }

      toast.success('Đã xếp lịch thành công');
      setIsOpen(false);
      setFormData({
        customerId: '',
        customerName: '',
        phone: '',
        address: '',
        date: new Date().toISOString().slice(0, 16),
        assigneeId: currentUser?.id || '',
        status: 'pending',
        notes: ''
      });
      queryClient.invalidateQueries({ queryKey: ['measurement_schedules'] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error('Vui lòng điền đầy đủ và đúng định dạng');
      } else {
        handleFirestoreError(error, OperationType.CREATE, 'measurement_schedules');
        toast.error('Có lỗi xảy ra');
      }
    }
  };

  const [isUploading, setIsUploading] = useState<string | null>(null);
  const [storedImgbbKey, setStoredImgbbKey] = useState('');

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'configs', 'storage'), (docSnap) => {
      if (docSnap.exists()) {
        setStoredImgbbKey(docSnap.data().imgbbKey || '');
      }
    });
    return () => unsub();
  }, [user]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<MeasurementSchedule>>({});

  const handleEditClick = (schedule: MeasurementSchedule) => {
    setEditingId(schedule.id);
    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    const localISOTime = (new Date(new Date(schedule.date).getTime() - tzOffset)).toISOString().slice(0, 16);
    setEditFormData({ ...schedule, date: localISOTime });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditFormData({});
  };

  const handleSaveEdit = async (schedule: MeasurementSchedule) => {
    if (!editFormData.customerName || editFormData.customerName.trim() === '') {
        toast.error('Vui lòng nhập tên khách hàng');
        return;
    }
    if (!editFormData.date || editFormData.date.trim() === '') {
        toast.error('Vui lòng nhập thời gian đo');
        return;
    }
    if (!editFormData.phone || editFormData.phone.trim().length < 9) {
        toast.error('Vui lòng nhập số điện thoại hợp lệ');
        return;
    }

    setIsSaving(true);
    try {
        const scheduleRef = doc(db, 'measurement_schedules', schedule.id);
        const updatedData = {
          ...editFormData,
          date: new Date(editFormData.date!).toISOString()
        };

        // Automatically update customer stage to 'surveying' if status is changed to completed
        if (updatedData.status === 'completed' && schedule.status !== 'completed' && updatedData.customerId) {
          const customerRef = doc(db, 'customers', updatedData.customerId);
          const customerSnap = await getDoc(customerRef);
          if (customerSnap.exists()) {
            const customerData = customerSnap.data() as Customer;
            if (customerData.stage === 'consulting') {
              await updateDoc(customerRef, {
                stage: 'surveying'
              });
              toast.info('Đã cập nhật trạng thái khách hàng sang: Đã Đo Đạc');
            }
          }
        }

        if (updatedData.status === 'completed' && schedule.status !== 'completed') {
          await autoSyncToSaleWeeklyPlan(updatedData);
        }

        // Remove id or createdAt if necessary
        const { id, createdAt, ...dataToUpdate } = updatedData as any;
        await updateDoc(scheduleRef, dataToUpdate);
        toast.success('Đã cập nhật lịch đo');
        setEditingId(null);
        setEditFormData({});
        queryClient.invalidateQueries({ queryKey: ['measurement_schedules'] });
    } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'measurement_schedules');
        toast.error('Lỗi khi lưu thay đổi');
    } finally {
        setIsSaving(false);
    }
  };

  const handleFileUpload = async (schedule: MeasurementSchedule, files: FileList) => {
    setIsUploading(schedule.id);
    const toastId = toast.loading(`Đang tải lên ${files.length} ảnh...`);

    try {
      let successCount = 0;
      const uploadedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const newUrl = await uploadToImgBB(file);
        if (newUrl) {
          uploadedUrls.push(newUrl);
          successCount++;
        }
      }

      if (uploadedUrls.length > 0) {
        const docRef = doc(db, 'measurement_schedules', schedule.id);
        await updateDoc(docRef, {
          imageUrls: arrayUnion(...uploadedUrls)
        });

        const freshSnap = await getDoc(docRef);
        const freshSchedule = freshSnap.exists() ? { ...schedule, ...freshSnap.data() } as MeasurementSchedule : schedule;
        await syncMeasurementToDesignTask(freshSchedule);
      }

      queryClient.invalidateQueries({ queryKey: [ 'measurement_schedules' ] });
      if (successCount > 0) {
        toast.success(`Đã tải lên ${successCount}/${files.length} ảnh thành công!`, { id: toastId });
      } else {
        toast.error('Không tải được ảnh nào', { id: toastId });
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Lỗi khi tải ảnh: ' + (error instanceof Error ? error.message : 'Unknown'), { id: toastId });
    } finally {
      setIsUploading(null);
    }
  };

  const handleUpdateStatus = async (item: MeasurementSchedule, newStatus: 'pending' | 'completed' | 'cancelled') => {
    try {
      const scheduleRef = doc(db, 'measurement_schedules', item.id);
      
      // Fetch fresh data to ensure we have the latest imageUrls
      const snap = await getDoc(scheduleRef);
      const freshItem = snap.exists() ? snap.data() as MeasurementSchedule : item;

      if (newStatus === 'completed' && (!freshItem.imageUrls || freshItem.imageUrls.length === 0)) {
        toast.error('Vui lòng tải ảnh đo đạc lên trước khi hoàn tất!');
        return;
      }
      
      if (newStatus === 'completed') {
        // Automatically update customer stage to 'surveying'
        if (freshItem.customerId) {
          const customerRef = doc(db, 'customers', freshItem.customerId);
          const customerSnap = await getDoc(customerRef);
          if (customerSnap.exists()) {
            const customerData = customerSnap.data() as Customer;
            // Only update if current stage is lead or consulting to avoid moving back from contracted
            if (customerData.stage === 'consulting') {
              await updateDoc(customerRef, {
                stage: 'surveying'
              });
              toast.info('Đã cập nhật trạng thái khách hàng sang: Đã Đo Đạc');
            }
          }
        }
        
        await autoSyncToSaleWeeklyPlan(freshItem);
      }

      await updateDoc(scheduleRef, {
        status: newStatus
      });

      queryClient.invalidateQueries({ queryKey: ['measurement_schedules'] });
      
      let message = 'Đã cập nhật trạng thái';
      if (newStatus === 'completed') message = 'Đã hoàn tất đo đạc';
      else if (newStatus === 'cancelled') message = 'Đã hủy lịch';
      else if (newStatus === 'pending') message = 'Đã khôi phục lịch về trạng thái chờ';

      toast.success(message);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'measurement_schedules');
      toast.error('Có lỗi xảy ra');
    }
  };

  const handleDelete = async (schedule: MeasurementSchedule) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa lịch đo đạc của khách hàng "${schedule.customerName}"?`)) {
      return;
    }

    try {
      await moveToTrash(
        'measurement_schedules',
        schedule.id,
        `Lịch đo đạc: ${schedule.customerName}`,
        user?.email || 'Unknown'
      );
      toast.success('Đã chuyển lịch vào thùng rác');
      queryClient.invalidateQueries({ queryKey: ['measurement_schedules'] });
      setDetailsOpen(false);
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast.error('Có lỗi xảy ra khi xóa lịch');
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
  };

  const openAddForDate = (date: Date) => {
    // Set the time part to 08:00 default
    const newDate = new Date(date);
    newDate.setHours(8, 0, 0, 0);
    // Correctly format to slice(0, 16) for datetime-local (e.g., 2024-05-10T08:00)
    // using local time string extraction is safer or manipulating it:
    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    const localISOTime = (new Date(newDate.getTime() - tzOffset)).toISOString().slice(0, 16);
    
    setFormData(prev => ({
      ...prev,
      date: localISOTime
    }));
    setIsOpen(true);
    setDetailsOpen(false);
  };

  return (
    <div className="space-y-3 sm:space-y-4 flex flex-col h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shrink-0">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">Lịch Đo Đạc</h2>
          <p className="text-[10px] md:text-xs text-muted-foreground">Quản lý lịch hẹn khảo sát, đo đạc</p>
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
           <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200 shadow-sm">
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
          <Button onClick={() => openAddForDate(new Date())} size="sm" className="gap-1 px-2 shrink-0 h-8 text-xs">
            <Plus className="h-3.5 w-3.5" />
            <span>Thêm</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
        {[
          { label: 'Tổng', value: stats.total, color: '' },
          { label: 'Chờ', value: stats.pending, color: 'text-blue-600' },
          { label: 'Xong', value: stats.completed, color: 'text-emerald-600' },
          { label: 'Hủy', value: stats.cancelled, color: 'text-red-600' },
        ].map((s) => (
          <Card key={s.label} className="bg-card text-card-foreground border border-gray-200 relative group overflow-hidden shadow-sm">
            <CardContent className="p-2 flex flex-col items-center justify-center relative">
              <span className="text-[8px] md:text-[10px] text-muted-foreground uppercase font-black truncate">{s.label}</span>
              <span className={cn("text-sm md:text-lg font-bold", s.color)}>{s.value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Thêm Lịch Khảo Sát/Đo Đạc</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Chọn từ Khách hàng tư vấn / Tiềm năng</Label>
              <Select 
                value={formData.customerId || 'manual'} 
                onValueChange={handleCustomerSelect}
              >
              <SelectTrigger className="h-10 bg-gray-50 border-gray-200 rounded-xl">
                  <SelectValue placeholder="Chọn khách hàng hoặc nhập tay">
                    {customerOptions.find(o => o.value === (formData.customerId || 'manual'))?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {customerOptions.map(o => (
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
            
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label>Họ tên khách hàng *</Label>
                <Input 
                  value={formData.customerName} 
                  onChange={e => setFormData({...formData, customerName: e.target.value})} 
                  placeholder="Họ tên"
                  className="h-10 rounded-xl w-full"
                />
              </div>
              <div className="space-y-2">
                <Label>Điện thoại *</Label>
                <Input 
                  value={formData.phone} 
                  onChange={e => setFormData({...formData, phone: e.target.value})} 
                  placeholder="090..."
                  className="h-10 rounded-xl w-full"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Địa chỉ đo đạc *</Label>
              <Input 
                 value={formData.address} 
                onChange={e => setFormData({...formData, address: e.target.value})} 
                placeholder="Địa chỉ chi tiết"
                className="h-10 rounded-xl"
              />
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label>Thời gian hẹn *</Label>
                <Input 
                  type="datetime-local" 
                  value={formData.date} 
                  onChange={e => setFormData({...formData, date: e.target.value})}
                  className="h-10 rounded-xl bg-gray-50 border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary transition-all cursor-pointer w-full"
                />
              </div>
              {isManager && (
                <div className="space-y-2">
                  <Label>Phân công Sale *</Label>
                  <Select value={formData.assigneeId || undefined} onValueChange={handleSaleSelect}>
                    <SelectTrigger className="h-10 rounded-xl border-gray-200 bg-gray-50 w-full">
                      <SelectValue placeholder="Chọn Sale">
                        {saleOptions.find(o => o.value === formData.assigneeId)?.label}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {saleOptions.map(m => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Ghi chú</Label>
              <Input 
                value={formData.notes || ''} 
                onChange={e => setFormData({...formData, notes: e.target.value})} 
                placeholder="Yêu cầu đặc biệt nếu có..."
                className="h-10 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Hủy</Button>
            <Button onClick={handleSave}>Lưu thông tin</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col lg:flex-row gap-4 min-h-0 flex-1">
        {/* Left Column: Calendar */}
        <Card className="flex-1 flex flex-col min-h-[400px] overflow-hidden shadow-sm border border-gray-200 dark:border-zinc-800 rounded-2xl bg-card text-card-foreground">
          <div className="grid grid-cols-7 border-b bg-gray-50 dark:bg-zinc-900 shrink-0">
            {weekDays.map((day, idx) => (
              <div key={idx} className="py-2 sm:py-3 text-center text-xs sm:text-sm font-medium text-muted-foreground">
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
                    className={`
                      min-h-[70px] sm:min-h-[100px] md:min-h-[120px] p-1 sm:p-2 border-b border-r transition-colors cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-850 group relative
                      ${!isCurrentMonth ? "bg-gray-100/50 text-muted-foreground dark:bg-zinc-900/40" : "bg-card text-card-foreground"}
                      ${dayIdx % 7 === 6 ? "border-r-0" : ""}
                    `}
                  >
                    <div className="flex justify-between items-start mb-1 sm:mb-2">
                      <span className={`inline-flex items-center justify-center w-5 h-5 sm:w-7 sm:h-7 rounded-full text-[10px] sm:text-sm font-medium
                        ${isDayToday ? "bg-primary text-primary-foreground shadow-sm" : ""}
                      `}>
                        {format(day, dateFormat)}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-5 w-5 sm:h-6 sm:w-6 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex"
                        onClick={(e) => {
                          e.stopPropagation();
                          openAddForDate(day);
                        }}
                      >
                        <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                    </div>
                    
                    <div className="flex-1 overflow-hidden flex flex-col space-y-0.5 sm:space-y-1">
                      {daySchedules.slice(0, 3).map((schedule) => (
                        <div 
                          key={schedule.id}
                          className={`text-[9px] sm:text-xs px-1 sm:px-2 py-0.5 rounded truncate border !bg-card text-card-foreground ${
                            schedule.status === 'completed' ? 'text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300' :
                            schedule.status === 'cancelled' ? 'text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300' :
                            'text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300'
                          }`}
                          title={schedule.customerName}
                        >
                          <span className="font-medium mr-1 hidden sm:inline">{format(parseISO(schedule.date), 'HH:mm')}</span>
                          {schedule.customerName}
                        </div>
                      ))}
                      {daySchedules.length > 3 && (
                        <div className="text-[9px] sm:text-xs text-muted-foreground text-center font-medium py-0.5 sm:py-1">
                          + {daySchedules.length - 3} lịch
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Right Column: Unscheduled measurements list */}
        <Card className="w-full lg:w-[350px] flex flex-col border border-gray-200 dark:border-zinc-800 rounded-2xl bg-card overflow-hidden shadow-sm shrink-0 lg:self-start lg:sticky lg:top-4 lg:max-h-[calc(100vh-220px)]">
          <CardHeader className="p-4 border-b bg-gray-50 dark:bg-zinc-900 shrink-0">
            <CardTitle className="text-sm font-bold flex items-center gap-1.5">
              <ClipboardList className="h-4.5 w-4.5 text-primary" />
              Chờ xếp lịch đo đạc
              {unscheduledMeasurements.length > 0 && (
                <Badge variant="destructive" className="ml-auto text-[10px] px-1.5 py-0">
                  {unscheduledMeasurements.length}
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-[10px]">
              Danh sách khách hàng đang tư vấn chưa có lịch đo đạc
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 flex-1 overflow-y-auto">
            {unscheduledMeasurements.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                <CalendarIcon className="h-10 w-10 text-muted-foreground/30 mb-2" />
                <p className="text-xs font-semibold">Tất cả khách hàng đã xếp lịch</p>
                <p className="text-[10px] text-muted-foreground/75 max-w-[200px] mt-1">Không có dự án nào đang chờ xếp lịch đo đạc.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {unscheduledMeasurements.map((item) => (
                  <Card key={item.id} className="p-3 bg-secondary/20 hover:bg-secondary/40 border transition-all duration-200 rounded-xl relative group">
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold text-primary truncate max-w-[150px]">
                          {item.name}
                        </span>
                        <Badge className="text-[8px] scale-90 px-1 py-0 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shadow-none">
                          Tư vấn
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
                            setFormData(prev => ({
                              ...prev,
                              customerId: item.id,
                              customerName: item.name,
                              phone: item.phone || '',
                              address: item.address || '',
                              date: new Date().toISOString().slice(0, 16)
                            }));
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

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden">
          <div className="flex flex-col max-h-[90vh]">
            <DialogHeader className="shrink-0 border-b p-6 pb-2">
              <DialogTitle className="flex items-center gap-2">
                 <CalendarIcon className="h-5 w-5 text-primary" />
                 Lịch Đo Đạc ngày {selectedDate && format(selectedDate, 'dd/MM/yyyy')}
              </DialogTitle>
              <DialogDescription>
                Tất cả các công việc đo đạc, khảo sát công trình trong ngày.
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-4">
                {selectedDate && getSchedulesForDay(selectedDate).length > 0 ? (
                  getSchedulesForDay(selectedDate).map((schedule) => {
                    const assignee = members.find(m => m.id === schedule.assigneeId);
                    return (
                      <div key={schedule.id} className="p-4 rounded-lg border bg-card shadow-sm space-y-3">
                        {editingId === schedule.id ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-xs">Ngày đo đạc *</Label>
                                <Input 
                                  type="datetime-local"
                                  value={editFormData.date || ''}
                                  onChange={e => setEditFormData({...editFormData, date: e.target.value})}
                                  className="h-11 w-full rounded-xl border border-gray-200 bg-card text-card-foreground px-4 text-sm focus:ring-2 focus:ring-black/10 outline-none"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">Tên khách hàng *</Label>
                                <Input 
                                  value={editFormData.customerName || ''}
                                  onChange={e => setEditFormData({...editFormData, customerName: e.target.value})}
                                  className="h-11 w-full rounded-xl border border-gray-200 bg-card text-card-foreground px-4 text-sm focus:ring-2 focus:ring-black/10 outline-none"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">Số điện thoại *</Label>
                                <Input 
                                  type="tel"
                                  value={editFormData.phone || ''}
                                  onChange={e => setEditFormData({...editFormData, phone: e.target.value})}
                                  className="h-11 w-full rounded-xl border border-gray-200 bg-card text-card-foreground px-4 text-sm focus:ring-2 focus:ring-black/10 outline-none"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">Địa chỉ *</Label>
                                <Input 
                                  value={editFormData.address || ''}
                                  onChange={e => setEditFormData({...editFormData, address: e.target.value})}
                                  className="h-11 w-full rounded-xl border border-gray-200 bg-card text-card-foreground px-4 text-sm focus:ring-2 focus:ring-black/10 outline-none"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">Nhân viên đo *</Label>
                                <Select 
                                  value={editFormData.assigneeId || ''} 
                                  onValueChange={(val) => setEditFormData({...editFormData, assigneeId: val})}
                                >
                                  <SelectTrigger className="h-11 w-full rounded-xl border border-gray-200 bg-card text-card-foreground px-4 text-sm focus:ring-2 focus:ring-black/10 outline-none">
                                    <SelectValue placeholder="Chọn nhân viên" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-card text-card-foreground z-50">
                                    {members.map(m => (
                                      <SelectItem key={m.id} value={m.id}>{m.name || 'Không xác định'}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">Trạng thái</Label>
                                <Select 
                                  value={editFormData.status || ''} 
                                  onValueChange={(val: any) => setEditFormData({...editFormData, status: val})}
                                >
                                  <SelectTrigger className="h-11 w-full rounded-xl border border-gray-200 bg-card text-card-foreground px-4 text-sm focus:ring-2 focus:ring-black/10 outline-none">
                                    <SelectValue placeholder="Chọn trạng thái" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-card text-card-foreground z-50">
                                    <SelectItem value="pending">Chưa lấy số đo</SelectItem>
                                    <SelectItem value="completed">Hoàn thành</SelectItem>
                                    <SelectItem value="cancelled">Đã hủy</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs">Ghi chú</Label>
                                <Input 
                                  value={editFormData.notes || ''}
                                  onChange={e => setEditFormData({...editFormData, notes: e.target.value})}
                                  className="h-11 w-full rounded-xl border border-gray-200 bg-card text-card-foreground px-4 text-sm focus:ring-2 focus:ring-black/10 outline-none"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                              <Button variant="outline" size="sm" onClick={handleCancelEdit} disabled={isSaving}>Hủy</Button>
                              <Button size="sm" onClick={() => handleSaveEdit(schedule as any)} disabled={isSaving}>{isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}</Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-semibold text-lg">{schedule.customerName}</h4>
                                <div className="flex items-center text-muted-foreground text-sm mt-1 gap-4">
                                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                                    <Clock className="w-4 h-4 text-primary" /> 
                {format(parseISO(schedule.date), 'HH:mm')}
                                  </span>
                                  <span className="flex items-center gap-1.5">
                                    <User className="w-4 h-4" /> 
                {assignee?.name || 'Không rõ'}
                                  </span>
                                </div>
                              </div>
                              <Badge variant={
                                schedule.status === 'completed' ? 'default' : 
                                schedule.status === 'pending' ? 'secondary' : 'destructive'
                              }>
                                {schedule.status === 'completed' ? 'Hoàn thành' : 
                                 schedule.status === 'pending' ? 'Chưa lấy số đo' : 'Đã hủy'}
                              </Badge>
                            </div>

                            <div className="grid gap-2 text-sm">
                              <div className="flex items-start gap-2">
                                <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                                <span>{schedule.address}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                                <span>{schedule.phone}</span>
                              </div>
                              {schedule.notes && (
                                 <div className="mt-2 text-sm p-3 bg-gray-50 rounded-md border border-gray-200 text-muted-foreground italic">
                                   {schedule.notes}
                                 </div>
                              )}
                            </div>

                            <div className="pt-2 border-t mt-4 space-y-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <Label className="text-xs">Ảnh đo đạc</Label>
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
                                        className="h-8 text-[10px] file:text-[10px] file:h-full"
                                      />
                                      {isUploading === schedule.id && (
                                        <div className="text-[10px] text-blue-500 animate-pulse font-medium">Đang tải...</div>
                                      )}
                                    </div>
                                  )}
                                  <div className="flex gap-2 mt-2 flex-wrap min-h-[40px]">
                                    {(schedule.imageUrls || []).map((url, i) => (
                                      <div key={i} className="relative group/img">
                                        <img src={url} alt="Measurement" className="w-20 h-20 object-cover rounded shadow-sm border" />
                                        {(currentUser?.id === schedule.assigneeId || isManager) && (
                                          <button 
                                            onClick={async () => {
                                              if (!window.confirm('Xóa ảnh này?')) return;
                                              const docRef = doc(db, 'measurement_schedules', schedule.id);
                                              await updateDoc(docRef, {
                                                imageUrls: arrayRemove(url)
                                              });

                                              const freshSnap = await getDoc(docRef);
                                              if (freshSnap.exists()) {
                                                const freshSchedule = { ...schedule, ...freshSnap.data() } as MeasurementSchedule;
                                                await syncMeasurementToDesignTask(freshSchedule);
                                              }

                                              queryClient.invalidateQueries({ queryKey: ['measurement_schedules'] });
                                              toast.success('Đã xóa ảnh');
                                            }}
                                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover/img:opacity-100 transition-opacity"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                    {(!schedule.imageUrls || schedule.imageUrls.length === 0) && !isUploading && (
                                      <p className="text-[10px] text-muted-foreground italic">Chưa có ảnh</p>
                                    )}
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <Label className="text-xs">Đẩy sang thiết kế</Label>
                                  <Select 
                                    value={schedule.designAssigneeId || ""} 
                                    onValueChange={async (v) => {
                                      const updatedSchedule = {
                                        ...schedule,
                                        designAssigneeId: v
                                      };
                                      await setDoc(doc(db, 'measurement_schedules', schedule.id), updatedSchedule);
                                      await syncMeasurementToDesignTask(updatedSchedule);
                                      toast.success('Đã chọn người thiết kế');
                                    }}
                                    disabled={schedule.isPushedToDesign}
                                  >
                                    <SelectTrigger className="h-9 text-xs">
                                      <SelectValue placeholder="Chọn Thiết kế" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {designMembers.map(m => (
                                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {schedule.isPushedToDesign && (
                                    <p className="text-[10px] text-green-600 font-medium">Đã đẩy việc sang thiết kế</p>
                                  )}
                                </div>
                              </div>
                            
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => handleEditClick(schedule)}>Sửa</Button>
                              {(schedule.status === 'pending' || schedule.status === 'completed') && (currentUser?.id === schedule.assigneeId || isManager) && (
                                <Button size="sm" onClick={() => handleUpdateStatus(schedule, 'completed')}>
                                  {schedule.status === 'pending' ? 'Hoàn tất đo đạc' : 'Cập nhật ảnh'}
                                </Button>
                              )}
                              {(schedule.status === 'pending' || schedule.status === 'completed') && isManager && (
                                <Button variant="outline" size="sm" onClick={() => handleUpdateStatus(schedule, 'cancelled')} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                                  Hủy lịch
                                </Button>
                              )}
                              {schedule.status === 'cancelled' && isManager && (
                                <Button variant="outline" size="sm" onClick={() => handleUpdateStatus(schedule, 'pending')} className="text-blue-500 hover:text-blue-600 hover:bg-blue-50">
                                  Khôi phục lịch
                                </Button>
                              )}
                              {isManager && (
                                <Button variant="outline" size="sm" onClick={() => handleDelete(schedule)} className="text-red-500 hover:text-red-600 hover:bg-red-50" title="Xóa lịch">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                      </>
                    )}
                  </div>

                    );
                  })
                ) : (
                  <div className="py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                    Không có lịch đo đạc nào trong ngày này.
                  </div>
                )}
              </div>
            </div>
            
            <DialogFooter className="shrink-0 pt-4 border-t px-6 pb-6">
                <Button variant="outline" onClick={() => setDetailsOpen(false)}>Đóng</Button>
                <Button onClick={() => { if(selectedDate) openAddForDate(selectedDate); }}>
                  <Plus className="w-4 h-4 mr-2"/> Thêm lịch ngày này
                </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

