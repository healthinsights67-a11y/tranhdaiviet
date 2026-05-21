import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MeasurementSchedule, Member, Customer } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Calendar as CalendarIcon, MapPin, Phone, User, Clock, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay, addMonths, subMonths, isToday, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { doc, setDoc, deleteDoc, updateDoc, arrayUnion, arrayRemove, onSnapshot, getDoc, db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { uploadToImgBB } from '@/src/services/uploadService';
import { z } from 'zod';
import { MeasurementScheduleSchema } from '@/src/schemas';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn, getCurrentVNDate, getVNTimestamp } from '@/src/lib/utils';
import { notifyManagers } from '@/src/services/notificationService';

interface MeasurementPageProps {
  schedules: MeasurementSchedule[];
  members: Member[];
  customers: Customer[];
  user: any;
  currentUser: Member | null;
}

export function MeasurementPage({ schedules, members, customers, user, currentUser }: MeasurementPageProps) {
  const queryClient = useQueryClient();
  const isManager = currentUser?.role?.toLowerCase().includes('quản lý') || (user && ['nhoanhkoem01@gmail.com', 'haanhtran.cv02@gmail.com'].includes(user.email));

  const filteredSchedules = isManager 
    ? schedules 
    : schedules.filter(s => s.assigneeId === currentUser?.id);

  const saleMembers = members.filter(m => m.role.toLowerCase().includes('sale'));
  const designMembers = members.filter(m => m.role.toLowerCase().includes('design') || m.role.toLowerCase().includes('thiết kế'));

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

  const handleFileUpload = async (schedule: MeasurementSchedule, file: File) => {
    setIsUploading(schedule.id);
    const toastId = toast.loading('Đang tải ảnh lên ImgBB...');

    try {
      const newUrl = await uploadToImgBB(file);
      if (!newUrl) {
        toast.dismiss(toastId);
        return;
      }
      
      await updateDoc(doc(db, 'measurement_schedules', schedule.id), {
        imageUrls: arrayUnion(newUrl)
      });

      queryClient.invalidateQueries({ queryKey: [ 'measurement_schedules' ] });
      toast.success('Đã tải ảnh lên thành công', { id: toastId });
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
           <div className="text-sm font-semibold w-[120px] text-center hidden sm:block">
             Tháng {format(currentMonth, 'MM/yyyy')}
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

      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden shadow-sm">
        <div className="grid grid-cols-7 border-b bg-gray-50 shrink-0">
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
                  min-h-[70px] sm:min-h-[100px] md:min-h-[120px] p-1 sm:p-2 border-b border-r transition-colors cursor-pointer hover:bg-gray-50 group relative
                  ${!isCurrentMonth ? "bg-gray-100 text-muted-foreground" : "bg-card text-card-foreground text-card-foreground"}
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
                                        disabled={isUploading === schedule.id}
                                        onChange={(e) => {
                                          if (e.target.files?.length) {
                                            handleFileUpload(schedule, e.target.files[0]);
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
                                              await updateDoc(doc(db, 'measurement_schedules', schedule.id), {
                                                imageUrls: arrayRemove(url)
                                              });
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
                                      await setDoc(doc(db, 'measurement_schedules', schedule.id), {
                                        ...schedule,
                                        designAssigneeId: v
                                      });
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

