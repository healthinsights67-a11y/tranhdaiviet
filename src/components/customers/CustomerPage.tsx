import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Task, Customer, CustomerStage, Member, WORKSHOPS, getWorkshopName, Quotation, MeasurementSchedule } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Search, 
  Phone, 
  MapPin, 
  MessageSquare, CheckCircle2, TrendingUp, CreditCard, 
  UserPlus,
  Filter,
  MoreHorizontal,
  ArrowRight,
  User,
  Clock,
  DollarSign,
  ExternalLink,
  Layout,
  X,
  ChevronLeft,
  ChevronRight,
  Calendar,
  ClipboardList, 
  Palette, 
  Factory, Package, 
  Factory, Package, 
  UserCheck, Users, Target, Map, LayoutGrid
} from 'lucide-react';
import { CustomerWorkflowHistory } from './CustomerWorkflowHistory';
import { LocationPickerDialog } from '../maps/LocationPickerDialog';
import { MapComponent, CustomMarker } from '../maps/MapComponent';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { cn, getCurrentVNMonth, getCurrentVNYear, formatVNTime, getVNMonth } from '@/src/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { db, collection, addDoc, updateDoc, deleteDoc, doc, handleFirestoreError, OperationType, getDocs, query, where } from '@/src/lib/firebase';
import { notifyManagers } from '@/src/services/notificationService';
import { moveToTrash } from '@/src/services/trashService';


interface CustomerPageProps {
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  members: Member[];
  quotations: Quotation[];
  schedules: MeasurementSchedule[];
  user?: any;
  currentUser: any;
}

const STAGE_CONFIG: Record<CustomerStage, { label: string; color: string; icon: any }> = {
  consulting: { label: 'Đã tư vấn', color: 'bg-yellow-50 text-yellow-600 border-yellow-200', icon: MessageSquare },
  surveying: { label: 'Đã đo đạc', color: 'bg-purple-50 text-purple-600 border-purple-200', icon: MapPin },
  contracted: { label: 'Đã chốt', color: 'bg-emerald-50 text-emerald-600 border-emerald-200', icon: ArrowRight },
  production: { label: 'Sản xuất', color: 'bg-blue-50 text-blue-600 border-blue-200', icon: Factory },
  installation: { label: 'Lắp đặt', color: 'bg-orange-50 text-orange-600 border-orange-200', icon: Package },
  completed: { label: 'Hoàn thành', color: 'bg-green-50 text-green-600 border-green-200', icon: CheckCircle2 },
  lost: { label: 'Tạm dừng', color: 'bg-red-50 text-red-600 border-red-200', icon: X },
};

export function CustomerPage({ customers, setCustomers, tasks, setTasks, members, quotations, schedules, user, currentUser }: CustomerPageProps) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedWorkshop, setSelectedWorkshop] = React.useState(
    currentUser?.workshop && currentUser?.workshop !== 'all' ? currentUser.workshop : 'all'
  );
  const [selectedMonth, setSelectedMonth] = React.useState<string>(() => getCurrentVNMonth()); // YYYY-MM
  const [pickerYear, setPickerYear] = React.useState<number>(getCurrentVNYear());
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = React.useState(false);
  const [selectedCustomer, setSelectedCustomer] = React.useState<Customer | null>(null);
  const [pendingContract, setPendingContract] = React.useState<{
    customer: Customer;
    isNew: boolean;
  } | null>(null);
  const [targetDesignerId, setTargetDesignerId] = React.useState<string>('');
  const [locationPickerFor, setLocationPickerFor] = React.useState<'add' | 'edit' | null>(null);
  const [viewMode, setViewMode] = React.useState<'grid' | 'map'>('grid');
  
  const [newCustomer, setNewCustomer] = React.useState({
    name: '',
    phone: '',
    address: '',
    notes: '',
    assignedSaleId: currentUser?.id || '',
    stage: 'consulting' as CustomerStage,
    orderValue: 0,
    oneDriveLink: '',
    furnitureCategory: '',
    workshop: currentUser?.workshop && currentUser?.workshop !== 'all' ? currentUser.workshop : WORKSHOPS[1].id,
    location: undefined as { lat: number, lng: number } | undefined,
  });

  // Update default assignedSaleId when currentUser changes
  React.useEffect(() => {
    if (currentUser && !newCustomer.assignedSaleId) {
      setNewCustomer(prev => ({ ...prev, assignedSaleId: currentUser.id }));
    }
  }, [currentUser]);

  const formatCurrency = (value?: number) => {
    const isManager = !!currentUser?.role?.toLowerCase()?.includes('quản lý');
    if (currentUser?.permissions?.viewPrice === false && !isManager) return '*** ₫';
    if (value === undefined) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  };

  const handleAddCustomer = async () => {
    if (!newCustomer.name || !newCustomer.phone) {
      toast.error("Vui lòng nhập tên và số điện thoại");
      return;
    }

    const codeIndex = String(customers.length + 1).padStart(3, '0');
    const customerCode = `KH${codeIndex}_${newCustomer.name}`;

    const nowStr = new Date().toISOString();
    const customerData = {
      ...newCustomer,
      code: customerCode,
      createdAt: nowStr,
      consultedAt: nowStr,
    };

    try {
      let createdCustomerId = '';
      if (user) {
        const docRef = await addDoc(collection(db, 'customers'), customerData);
        createdCustomerId = docRef.id;
        
        // Notify managers about the new customer
        notifyManagers(
          'Khách hàng mới',
          `Sale ${currentUser?.name || 'nào đó'} vừa tạo khách hàng mới: ${customerData.name} (${customerData.phone})`
        );

        // Auto-sync to Sale Weekly Plan
        const newSaleTask = {
          title: `Tiếp nhận Lead: ${customerData.name}`,
          description: `Khách hàng mới. SĐT: ${customerData.phone}. Địa chỉ: ${customerData.address}.`,
          status: 'todo' as const,
          type: 'sale' as const,
          priority: 'medium' as const,
          assigneeId: customerData.assignedSaleId || currentUser?.id || '',
          customerId: createdCustomerId,
          createdAt: nowStr,
          scheduledDate: nowStr.split('T')[0],
          dueDate: nowStr.split('T')[0],
        };
        await addDoc(collection(db, 'tasks'), newSaleTask);
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      } else {
        const customer: Customer = {
          id: `c-${Date.now()}`,
          ...customerData,
        };
        setCustomers([customer, ...customers]);
        createdCustomerId = customer.id;

        // Auto-sync local
        const newSaleTask: Task = {
          id: `t-sale-${Date.now()}`,
          title: `Tiếp nhận Lead: ${customerData.name}`,
          description: `Khách hàng mới. SĐT: ${customerData.phone}. Địa chỉ: ${customerData.address}.`,
          status: 'todo',
          type: 'sale',
          priority: 'medium',
          assigneeId: customerData.assignedSaleId || currentUser?.id || '',
          customerId: createdCustomerId,
          createdAt: nowStr,
          scheduledDate: nowStr.split('T')[0],
          dueDate: nowStr.split('T')[0],
        };
        setTasks((prev) => [newSaleTask, ...prev]);
      }
      
      setIsAddDialogOpen(false);
      const addedCustomer = { id: createdCustomerId, ...customerData };
      
      setNewCustomer({
        name: '',
        phone: '',
        address: '',
        notes: '',
        assignedSaleId: currentUser?.id || '',
        stage: 'consulting',
        orderValue: 0,
        oneDriveLink: '',
        furnitureCategory: '',
        workshop: currentUser?.workshop && currentUser?.workshop !== 'all' ? currentUser.workshop : WORKSHOPS[1].id,
        location: undefined,
      });
      toast.success("Khách hàng đã được thêm thành công");

      // Automated Workflow for new customer: Contracted -> Show Assignment Dialog
      if (newCustomer.stage === 'contracted') {
        setPendingContract({
          customer: addedCustomer as Customer,
          isNew: true
        });
      }
    } catch (error: any) {
      console.error("Error adding customer:", error);
      toast.error("Lỗi khi thêm khách hàng: " + (error.message || "Vui lòng thử lại"));
      // Still call handleFirestoreError for logging/system purposes
      try {
        handleFirestoreError(error, OperationType.CREATE, 'customers');
      } catch (e) {
        // Ignore the re-thrown error from handleFirestoreError
      }
    }
  };

  const handleUpdateCustomer = async () => {
    if (!selectedCustomer) return;
    if (!selectedCustomer.name || !selectedCustomer.phone) {
      toast.error("Vui lòng nhập tên và số điện thoại");
      return;
    }

    try {
      if (user) {
        const { id, ...data } = selectedCustomer;
        const existingCustomer = customers.find(c => c.id === id);
        const existingStage = existingCustomer?.stage;

        const updateData: any = { ...data };
        if ((selectedCustomer.stage === 'contracted' || selectedCustomer.stage === 'completed') && 
            existingStage !== 'contracted' && existingStage !== 'completed') {
          const nowStr = new Date().toISOString();
          updateData.consultedAt = existingCustomer?.consultedAt || existingCustomer?.createdAt || nowStr;
          updateData.createdAt = nowStr;
          
          selectedCustomer.consultedAt = updateData.consultedAt;
          selectedCustomer.createdAt = updateData.createdAt;
        }

        await updateDoc(doc(db, 'customers', id), updateData);

        // Push customer's tasks to current month (closing/accepted date)
        if ((selectedCustomer.stage === 'contracted' || selectedCustomer.stage === 'completed') && 
            existingStage !== 'contracted' && existingStage !== 'completed') {
          try {
            const nowStr = new Date().toISOString();
            const taskQ = query(collection(db, 'tasks'));
            const taskSnap = await getDocs(taskQ);
            const cleanPhone = selectedCustomer.phone?.trim()?.replace(/\D/g, '');
            
            for (const taskDoc of taskSnap.docs) {
              const tData = taskDoc.data();
              if (tData.status === 'done' || tData.status === 'archived') continue;
              
              let matches = false;
              if (tData.customerId === id) {
                matches = true;
              } else if (cleanPhone) {
                const tPhone = tData.phone?.trim()?.replace(/\D/g, '') || 
                               tData.description?.replace(/\D/g, '').slice(-10);
                if (tPhone && (cleanPhone.includes(tPhone) || tPhone.includes(cleanPhone))) {
                  matches = true;
                }
              }
              
              if (matches) {
                await updateDoc(doc(db, 'tasks', taskDoc.id), {
                  createdAt: nowStr,
                  ...(tData.customerId ? {} : { customerId: id })
                });
              }
            }
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
          } catch (err) {
            console.error("Error updating tasks createdAt for customer:", err);
          }
        }

        // Automated Workflow: Contracted -> Show Assignment Dialog
        if (selectedCustomer.stage === 'contracted' && existingStage !== 'contracted') {
          setPendingContract({
            customer: selectedCustomer,
            isNew: false
          });
        }
      } else {
        const existingCustomer = customers.find(c => c.id === selectedCustomer.id);
        const existingStage = existingCustomer?.stage;

        if ((selectedCustomer.stage === 'contracted' || selectedCustomer.stage === 'completed') && 
            existingStage !== 'contracted' && existingStage !== 'completed') {
          const nowStr = new Date().toISOString();
          selectedCustomer.consultedAt = existingCustomer?.consultedAt || existingCustomer?.createdAt || nowStr;
          selectedCustomer.createdAt = nowStr;
        }

        setCustomers(customers.map(c => c.id === selectedCustomer.id ? selectedCustomer : c));

        if (selectedCustomer.stage === 'contracted' && existingStage !== 'contracted') {
          setPendingContract({
            customer: selectedCustomer,
            isNew: false
          });
        }
      }
      setIsEditDialogOpen(false);
      setSelectedCustomer(null);
      toast.success("Cập nhật thông tin khách hàng thành công");
    } catch (error: any) {
      console.error("Error updating customer:", error);
      toast.error("Lỗi khi cập nhật: " + (error.message || "Vui lòng thử lại"));
      try {
        handleFirestoreError(error, OperationType.UPDATE, `customers/${selectedCustomer.id}`);
      } catch (e) {}
    }
  };

  const handleCreateDesignTask = async () => {
    if (!pendingContract || !targetDesignerId) return;
    const { customer } = pendingContract;

    const newTaskData = {
      title: `Thiết kế: ${customer.name}`,
      description: `Tiếp nhận thông tin từ hợp đồng khách hàng ${customer.name}. Hạng mục: ${customer.furnitureCategory || 'Nội thất'}. Địa chỉ: ${customer.address}. SĐT: ${customer.phone}`,
      status: 'todo' as const,
      type: 'design' as const,
      priority: 'medium' as const,
      assigneeId: targetDesignerId,
      customerId: customer.id,
      createdAt: new Date().toISOString(),
      workshop: customer.workshop || '',
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    };

    try {
      if (user) {
        await addDoc(collection(db, 'tasks'), newTaskData);
      } else {
        const newTask: Task = {
          id: `t-design-${Date.now()}`,
          ...newTaskData,
        };
        setTasks((prev) => [newTask, ...prev]);
      }
      
      const designerName = members.find(m => m.id === targetDesignerId)?.name || 'Nhân viên';
      toast.success(`Hợp đồng đã ký! Đã giao việc thiết kế cho ${designerName}`);
      setPendingContract(null);
      setTargetDesignerId('');
    } catch (error: any) {
      console.error("Error creating design task:", error);
      toast.error("Lỗi khi tạo nhiệm vụ thiết kế");
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    try {
      if (user) {
        const customerToDelete = customers.find(c => c.id === id);
        const title = customerToDelete ? `${customerToDelete.code || 'KH'} - ${customerToDelete.name}` : id;
        await moveToTrash('customers', id, title, user.email || '');

        if (customerToDelete) {
          const deleterEmail = user.email || 'Unknown';
          
          // 1. Delete Measurement Schedules
          try {
            const mQuery = query(collection(db, 'measurement_schedules'), where('customerName', '==', customerToDelete.name));
            const mSnapshot = await getDocs(mQuery);
            for (const docSnap of mSnapshot.docs) {
               await moveToTrash('measurement_schedules', docSnap.id, `Lịch đo đạc: ${customerToDelete.name}`, deleterEmail);
            }
          } catch (e) { console.error('Error cascade deleting measurement schedules:', e); }

          // 2. Delete Installation Schedules
          try {
            const iQuery = query(collection(db, 'installation_schedules'), where('customerName', '==', customerToDelete.name));
            const iSnapshot = await getDocs(iQuery);
            for (const docSnap of iSnapshot.docs) {
               await moveToTrash('installation_schedules', docSnap.id, `Lịch lắp đặt: ${customerToDelete.name}`, deleterEmail);
            }
          } catch (e) { console.error('Error cascade deleting installation schedules:', e); }

          // 3. Delete Quotations
          try {
            const qQuery = query(collection(db, 'quotations'), where('customerName', '==', customerToDelete.name));
            const qSnapshot = await getDocs(qQuery);
            for (const docSnap of qSnapshot.docs) {
               await moveToTrash('quotations', docSnap.id, `Báo giá: ${docSnap.data().quotationNumber} - ${customerToDelete.name}`, deleterEmail);
            }
          } catch (e) { console.error('Error cascade deleting quotations:', e); }

          // 4. Delete Tasks (Design, Production...)
          try {
            const tSnapshot = await getDocs(collection(db, 'tasks'));
            for (const docSnap of tSnapshot.docs) {
              const tData = docSnap.data();
              if (tData.title && tData.title.includes(customerToDelete.name)) {
                 await moveToTrash('tasks', docSnap.id, `Công việc: ${tData.title}`, deleterEmail);
              }
            }
          } catch (e) { console.error('Error cascade deleting tasks:', e); }

          // Refresh React Query caches
          queryClient.invalidateQueries({ queryKey: ['measurement_schedules'] });
          queryClient.invalidateQueries({ queryKey: ['installation_schedules'] });
          queryClient.invalidateQueries({ queryKey: ['quotations'] });
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
        }
      } else {
        setCustomers(customers.filter(c => c.id !== id));
      }
      toast.success("Đã xóa khách hàng và các dữ liệu liên quan");
    } catch (error: any) {
      console.error("Error deleting customer:", error);
      toast.error("Lỗi khi xóa: " + (error.message || "Vui lòng thử lại"));
      try {
        handleFirestoreError(error, OperationType.DELETE, `customers/${id}`);
      } catch (e) {}
    }
  };

  const openEditDialog = (customer: Customer) => {
    setSelectedCustomer({ ...customer });
    setIsEditDialogOpen(true);
  };

  const openViewDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsViewDialogOpen(true);
  };

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

  const filteredCustomers = customers.filter(c => 
    (selectedWorkshop === 'all' || c.workshop === selectedWorkshop) &&
    (!selectedMonth || (c.createdAt && matchesTime(c.createdAt)) || (!c.createdAt)) &&
    (c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm) ||
    (c.code && c.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.furnitureCategory && c.furnitureCategory.toLowerCase().includes(searchTerm.toLowerCase())))
  ).sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });

  const isManager = !!currentUser?.role?.toLowerCase()?.includes('quản lý') || currentUser?.role === 'Giám đốc' || currentUser?.role === 'Trợ lý';
  const canViewRevenue = isManager || currentUser?.permissions?.viewRevenue !== false;

  const actualRevenue = filteredCustomers.reduce((sum, c) => {
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

  const expectedRevenue = filteredCustomers.reduce((sum, c) => {
    if (['contracted', 'production', 'installation', 'completed'].includes(c.stage)) {
      return sum + (c.orderValue || 0);
    }
    return sum;
  }, 0);

  const totalCustomers = filteredCustomers.length;
  const wonCustomers = filteredCustomers.filter(c => ['contracted', 'production', 'installation', 'completed'].includes(c.stage)).length;
  const winRate = totalCustomers > 0 ? Math.round((wonCustomers / totalCustomers) * 100) : 0;

  return (
    <div className="space-y-3 md:space-y-8 max-w-[1600px] mx-auto pb-10 px-0.5">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
        <div className="space-y-0 text-center md:text-left flex items-center gap-4">
          <div>
            <h1 className="text-lg md:text-3xl lg:text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/60 leading-tight">
              Khách hàng
            </h1>
            <p className="text-muted-foreground text-[8px] md:text-sm font-medium">Hành trình khách hàng.</p>
          </div>
          <Popover>
            <PopoverTrigger className="hidden lg:inline-flex items-center justify-between w-auto min-w-[180px] whitespace-nowrap h-9 text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground px-4 py-2 rounded-md ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              {selectedMonth === 'today' ? 'Hôm nay' : selectedMonth === 'week' ? 'Tuần này' : selectedMonth ? `Tháng ${selectedMonth.split('-')[1]} năm ${selectedMonth.split('-')[0]}` : "Chọn thời gian"}
              <Calendar className="ml-2 h-4 w-4 opacity-50" />
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-2 bg-card text-card-foreground" align="start">
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
              <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-border">
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
        <div className="flex flex-wrap items-center justify-center md:justify-end gap-1.5 w-full lg:w-auto">
          <Popover>
            <PopoverTrigger className="inline-flex items-center justify-between w-[140px] h-8 md:h-11 text-[10px] md:text-xs font-medium border border-border bg-card text-card-foreground hover:bg-muted px-4 py-2 rounded-xl transition-colors lg:hidden shadow-sm">
              {selectedMonth === 'today' ? 'Hôm nay' : selectedMonth === 'week' ? 'Tuần này' : selectedMonth ? `Thg ${selectedMonth.split('-')[1]}, ${selectedMonth.split('-')[0]}` : "Chọn thời gian"}
              <Calendar className="mr-2 h-3.5 w-3.5 opacity-50" />
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-2 bg-card text-card-foreground" align="start">
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
              <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-border">
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
          <Select 
            value={((selectedWorkshop === 'CoSo1' || selectedWorkshop === 'XuongGo') ? 'Cơ Sở 1' : 
                   (selectedWorkshop === 'CoSo2' || selectedWorkshop === 'XuongNhua') ? 'Cơ Sở 2' : 
                   selectedWorkshop) || 'all'} 
            onValueChange={setSelectedWorkshop}
            disabled={currentUser?.workshop && currentUser?.workshop !== 'all'}
          >
            <SelectTrigger className="h-8 md:h-11 flex-1 md:flex-none md:w-[140px] rounded-xl border border-border bg-card text-card-foreground text-[10px] md:text-xs shadow-sm">
              <SelectValue placeholder="Cơ sở" />
            </SelectTrigger>
            <SelectContent>
              {WORKSHOPS.map(w => (
                <SelectItem key={w.id} value={w.id} className="text-xs">{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-[160px] md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input 
              placeholder="Tìm tên hoặc SĐT..." 
              className="pl-9 h-8 md:h-11 rounded-xl bg-card text-card-foreground border border-border text-[10px] md:text-xs shadow-sm" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger 
              render={
                <Button className="h-8 md:h-11 rounded-xl gap-1 px-3 md:px-5 shadow-sm text-[10px] md:text-xs flex-1 md:flex-none">
                  <Plus className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Thêm</span>
                </Button>
              }
            />
            <DialogContent className="sm:max-w-[800px] rounded-2xl">
              <DialogHeader>
                <DialogTitle>Thêm khách hàng mới</DialogTitle>
                <DialogDescription>
                  Nhập thông tin khách hàng tiềm năng để bắt đầu quy trình tư vấn.
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[70vh] overflow-y-auto w-full px-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                  <div className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Tên khách hàng</Label>
                      <Input
                        id="name"
                        value={newCustomer.name}
                        onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                        placeholder="VD: Anh Hùng"
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="phone">Số điện thoại</Label>
                      <Input
                        id="phone"
                        value={newCustomer.phone}
                        onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                        placeholder="090..."
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="grid gap-2 relative">
                      <Label htmlFor="address" className="flex items-center justify-between">
                        <span>Địa chỉ / Công trình</span>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className={cn("h-6 px-2 text-[10px]", newCustomer.location ? "text-green-600 bg-green-50" : "text-blue-600")}
                          onClick={() => setLocationPickerFor('add')}
                        >
                          <MapPin className="h-3 w-3 mr-1" />
                          {newCustomer.location ? "Đã ghim vị trí" : "Ghim bản đồ"}
                        </Button>
                      </Label>
                      <Input
                        id="address"
                        value={newCustomer.address}
                        onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                        placeholder="Địa chỉ lắp đặt"
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="furnitureCategory">Hạng mục nội thất</Label>
                      <Input
                        id="furnitureCategory"
                        value={newCustomer.furnitureCategory}
                        onChange={(e) => setNewCustomer({ ...newCustomer, furnitureCategory: e.target.value })}
                        placeholder="VD: Tủ bếp, Sofa, Giường..."
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Cơ sở phụ trách</Label>
                      <Select 
                        value={((newCustomer.workshop === 'CoSo1' || newCustomer.workshop === 'XuongGo') ? 'Cơ Sở 1' : 
                               (newCustomer.workshop === 'CoSo2' || newCustomer.workshop === 'XuongNhua') ? 'Cơ Sở 2' : 
                               newCustomer.workshop) || 'all'} 
                        onValueChange={(v) => setNewCustomer({ ...newCustomer, workshop: v })}
                        disabled={currentUser?.workshop && currentUser?.workshop !== 'all'}
                      >
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue placeholder="Chọn cơ sở" />
                        </SelectTrigger>
                        <SelectContent>
                          {WORKSHOPS.filter(w => w.id !== 'all').map(w => (
                            <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Giai đoạn</Label>
                      <Select 
                        value={newCustomer.stage || 'consulting'} 
                        onValueChange={(v: CustomerStage) => setNewCustomer({ ...newCustomer, stage: v })}
                      >
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue placeholder="Chọn giai đoạn">
                            {newCustomer.stage ? STAGE_CONFIG[newCustomer.stage as keyof typeof STAGE_CONFIG]?.label : "Chọn giai đoạn"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STAGE_CONFIG).map(([key, config]) => (
                            <SelectItem key={key} value={key}>{config.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid gap-2">
                      <Label>Sale phụ trách</Label>
                      <Select 
                        value={newCustomer.assignedSaleId || ''} 
                        onValueChange={(v) => setNewCustomer({ ...newCustomer, assignedSaleId: v })}
                      >
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue placeholder="Chọn nhân viên">
                            {newCustomer.assignedSaleId 
                              ? members.find(m => m.id === newCustomer.assignedSaleId)?.name 
                              : "Chọn nhân viên"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent alignItemWithTrigger={false} className="w-[var(--radix-select-trigger-width)] min-w-[300px]">
                          {members.filter(m => !!m.role?.toLowerCase()?.includes('sale')).map(m => (
                            <SelectItem key={m.id} value={m.id}>
                              <div className="flex flex-col gap-0.5 text-left">
                                <span className="font-bold text-sm">{m.name}</span>
                                <span className="text-[10px] text-muted-foreground">{m.role}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {(!!currentUser?.role?.toLowerCase()?.includes('quản lý') || currentUser?.permissions?.viewPrice !== false) && (
                      <div className="grid gap-2">
                        <Label htmlFor="orderValue">Giá trị đơn hàng (VNĐ)</Label>
                        <Input
                          id="orderValue"
                          type="text"
                          value={newCustomer.orderValue === 0 ? "" : new Intl.NumberFormat('vi-VN').format(newCustomer.orderValue)}
                          onChange={(e) => {
                            const rawValue = e.target.value.replace(/\D/g, '');
                            setNewCustomer({ ...newCustomer, orderValue: rawValue === '' ? 0 : parseInt(rawValue, 10) });
                          }}
                          placeholder="VD: 1.000.000"
                          className="h-11 rounded-xl"
                        />
                      </div>
                    )}
                    <div className="grid gap-2">
                      <Label htmlFor="oneDriveLink">Liên kết OneDrive / Folder ảnh</Label>
                      <Input
                        id="oneDriveLink"
                        value={newCustomer.oneDriveLink}
                        onChange={(e) => setNewCustomer({ ...newCustomer, oneDriveLink: e.target.value })}
                        placeholder="https://onedrive.live.com/..."
                        className="h-11 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2 grid gap-2">
                    <Label htmlFor="notes">Ghi chú</Label>
                    <Textarea
                      id="notes"
                      value={newCustomer.notes}
                      onChange={(e) => setNewCustomer({ ...newCustomer, notes: e.target.value })}
                      placeholder="Yêu cầu chi tiết của khách..."
                      className="h-24 rounded-xl"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Hủy</Button>
                <Button onClick={handleAddCustomer}>Lưu khách hàng</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {/* Revenue Cards */}
        {canViewRevenue && (
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg relative overflow-hidden group border-0">
               <div className="absolute top-0 right-0 p-3 opacity-20">
                  <DollarSign className="h-16 w-16 md:h-20 md:w-20" />
               </div>
               <CardContent className="p-3 md:p-5 flex flex-col justify-center min-h-[70px] md:min-h-[90px] relative z-10">
                  <p className="text-[10px] md:text-[12px] uppercase font-black tracking-widest text-emerald-100 mb-1 drop-shadow-sm">Doanh thu thực tế</p>
                  <h3 className="text-xl md:text-3xl font-black tabular-nums drop-shadow-md">
                    {formatCurrency(actualRevenue)}
                  </h3>
               </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg relative overflow-hidden group border-0">
               <div className="absolute top-0 right-0 p-3 opacity-20">
                  <TrendingUp className="h-16 w-16 md:h-20 md:w-20" />
               </div>
               <CardContent className="p-3 md:p-5 flex flex-col justify-center min-h-[70px] md:min-h-[90px] relative z-10">
                  <p className="text-[10px] md:text-[12px] uppercase font-black tracking-widest text-amber-100 mb-1 drop-shadow-sm">Doanh thu dự kiến</p>
                  <h3 className="text-xl md:text-3xl font-black tabular-nums drop-shadow-md">
                    {formatCurrency(expectedRevenue)}
                  </h3>
               </CardContent>
            </Card>
          </div>
        )}
        
        {/* Stages Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-1.5 md:gap-3">
          <Card className="border border-border bg-card text-card-foreground shadow-sm relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-1 text-primary">
                <Users className="h-6 w-6 md:h-10 md:w-10 opacity-10 text-gray-200" />
             </div>
             <CardContent className="p-1.5 md:p-2 flex flex-col items-center text-center justify-center min-h-[50px] md:min-h-[60px]">
                <p className="text-[7px] md:text-[9px] uppercase font-black tracking-widest text-muted-foreground mb-0.5">Tổng KH</p>
                <h3 className="text-base md:text-xl font-black tabular-nums text-primary">{totalCustomers}</h3>
             </CardContent>
          </Card>
          
          {Object.entries(STAGE_CONFIG).map(([key, config]) => {
            const count = customers.filter(c => c.stage === key && (selectedWorkshop === 'all' || c.workshop === selectedWorkshop)).length;
            return (
              <Card key={key} className="border border-border bg-card text-card-foreground shadow-sm relative overflow-hidden group">
                 <div className={cn("absolute top-0 right-0 p-1", config.color.split(' ')[1])}>
                    <config.icon className="h-6 w-6 md:h-10 md:w-10 opacity-10 text-gray-200" />
                 </div>
                 <CardContent className="p-1.5 md:p-2 flex flex-col items-center text-center justify-center min-h-[50px] md:min-h-[60px]">
                    <p className="text-[7px] md:text-[9px] uppercase font-black tracking-widest text-muted-foreground mb-0.5">{config.label}</p>
                    <h3 className="text-base md:text-xl font-black tabular-nums">{count}</h3>
                 </CardContent>
              </Card>
            );
          })}

          <Card className="border border-border bg-card text-card-foreground shadow-sm relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-1 text-pink-500">
                <Target className="h-6 w-6 md:h-10 md:w-10 opacity-10 text-gray-200" />
             </div>
             <CardContent className="p-1.5 md:p-2 flex flex-col items-center text-center justify-center min-h-[50px] md:min-h-[60px]">
                <p className="text-[7px] md:text-[9px] uppercase font-black tracking-widest text-muted-foreground mb-0.5">Tỉ lệ chốt</p>
                <h3 className="text-base md:text-xl font-black tabular-nums text-pink-500">{winRate}%</h3>
             </CardContent>
          </Card>
        </div>
      </div>

      {/* View Mode Toggle & Customers Grid */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 md:mb-4 gap-2">
        <h3 className="font-bold text-sm md:text-lg text-foreground/80">Danh sách & Bản đồ</h3>
        <div className="bg-muted p-1 rounded-lg flex items-center shadow-inner border border-border/50 self-start sm:self-auto">
          <Button 
            variant={viewMode === 'grid' ? "default" : "ghost"} 
            size="sm" 
            className={cn("h-7 md:h-8 text-[10px] md:text-xs rounded-md px-3 font-medium", viewMode === 'grid' && "shadow-sm")}
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="w-3.5 h-3.5 mr-1.5" /> Dạng Lưới
          </Button>
          <Button 
            variant={viewMode === 'map' ? "default" : "ghost"} 
            size="sm" 
            className={cn("h-7 md:h-8 text-[10px] md:text-xs rounded-md px-3 font-medium", viewMode === 'map' && "shadow-sm")}
            onClick={() => setViewMode('map')}
          >
            <Map className="w-3.5 h-3.5 mr-1.5" /> Bản đồ
          </Button>
        </div>
      </div>

      {viewMode === 'map' ? (
        <Card className="h-[600px] border border-border shadow-sm rounded-xl overflow-hidden relative z-0">
          <MapComponent interactive={true}>
            {filteredCustomers.filter(c => c.location).map(customer => {
              const stage = STAGE_CONFIG[customer.stage];
              return (
                <CustomMarker 
                  key={customer.id} 
                  latitude={customer.location!.lat} 
                  longitude={customer.location!.lng}
                  color={stage.color.split(' ')[0]}
                  onClick={() => openViewDialog(customer)}
                >
                  <div className="bg-card text-card-foreground p-2 rounded-xl shadow-xl border border-border w-48 text-left cursor-pointer">
                    <p className="font-bold text-xs truncate">{customer.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate" title={customer.address}>{customer.address || "Chưa có địa chỉ"}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <Badge variant="outline" className={cn("text-[8px] py-0 font-bold", stage.color)}>
                        {stage.label}
                      </Badge>
                      {customer.orderValue !== undefined && customer.orderValue > 0 && (!!currentUser?.role?.toLowerCase()?.includes('quản lý') || currentUser?.permissions?.viewPrice !== false) && (
                        <span className="text-[10px] font-bold text-primary">{formatCurrency(customer.orderValue)}</span>
                      )}
                    </div>
                  </div>
                </CustomMarker>
              );
            })}
          </MapComponent>
          {filteredCustomers.filter(c => c.location).length === 0 && (
             <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm pointer-events-none">
                <div className="bg-card p-4 rounded-xl shadow-lg border text-center max-w-sm">
                   <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                   <p className="text-sm font-semibold">Chưa có khách hàng nào được ghim trên bản đồ.</p>
                   <p className="text-xs text-muted-foreground mt-1">Hãy mở thông tin khách hàng và chọn "Ghim bản đồ".</p>
                </div>
             </div>
          )}
        </Card>
      ) : (
      <div className="grid gap-2.5 md:gap-6 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredCustomers.map((customer, i) => {
          const stage = STAGE_CONFIG[customer.stage];
          const sale = members.find(m => m.id === customer.assignedSaleId);
          
          return (
            <motion.div
              key={customer.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card className="group h-full flex flex-col justify-between transition-all duration-300 border border-border shadow-sm bg-card text-card-foreground hover:shadow-md">
                <CardHeader className="p-2.5 md:p-5 pb-1.5 md:pb-3 space-y-1.5 md:space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-0.5 md:gap-1">
                      <Badge variant="outline" className={cn(
                        "text-[7px] md:text-[10px] uppercase font-black px-1 md:px-2 py-0 md:py-1 rounded-sm md:rounded-lg border-none scale-90 md:scale-100 -ml-1 md:ml-0",
                        stage.color
                      )}>
                        <stage.icon className="h-2.5 w-2.5 md:h-3 md:w-3 mr-1 inline" />
                        {stage.label}
                      </Badge>
                      <div className="flex flex-col gap-0.5 text-[7px] md:text-[9px] text-muted-foreground/60 font-semibold pl-0.5">
                        <div className="flex items-center gap-1">
                          <Clock className="h-2 w-2 md:h-2.5 md:w-2.5 opacity-60" />
                          <span>Chốt/Cọc: {formatVNTime(customer.createdAt)}</span>
                        </div>
                        {customer.consultedAt && customer.consultedAt !== customer.createdAt && (
                          <div className="flex items-center gap-1 text-[7px] md:text-[8px] text-amber-600 font-semibold">
                            <Clock className="h-2 w-2 opacity-60" />
                            <span>Tư vấn: {formatVNTime(customer.consultedAt)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={
                        <Button variant="ghost" size="icon" className="h-6 w-6 md:h-8 md:w-8 rounded-lg">
                          <MoreHorizontal className="h-3 w-3 md:h-4 md:w-4" />
                        </Button>
                      } />
                      <DropdownMenuContent align="end" className="rounded-xl">
                        <DropdownMenuItem onSelect={() => openEditDialog(customer)} className="text-xs">Sửa</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => openViewDialog(customer)} className="text-xs">Chi tiết</DropdownMenuItem>
                        {['contracted', 'production', 'completed'].includes(customer.stage) && (
                          <DropdownMenuItem 
                            onClick={() => setPendingContract({
                              customer,
                              isNew: false
                            })} 
                            className="text-xs text-blue-600 font-medium"
                          >
                            Giao việc thiết kế
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="text-destructive text-xs" onSelect={() => handleDeleteCustomer(customer.id)}>Xóa</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  <div className="space-y-1">
                    <CardTitle className="text-[11px] md:text-lg font-bold tracking-tight leading-tight">
                      {customer.code && (
                        <span className="block text-[7px] md:text-[10px] text-primary/80 mb-0 font-mono">{customer.code}</span>
                      )}
                      <span className="block">{customer.name}</span>
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-0.5 md:gap-1 mt-0">
                      {customer.furnitureCategory && (
                        <div className="inline-flex items-center gap-0.5 px-1 py-0 rounded-xs bg-blue-50 text-primary text-[7px] md:text-[10px] font-bold uppercase tracking-wider ring-1 ring-blue-100">
                          <Layout className="h-2 w-2 md:h-2.5 md:w-2.5" />
                          <span>{customer.furnitureCategory}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[8px] md:text-xs font-medium text-muted-foreground pt-0.5 border-t border-dashed border-border/60">
                    <span className="flex items-center gap-1"><Phone className="h-2.5 w-2.5 opacity-50" /> {customer.phone}</span>
                    <div className="flex flex-col items-end justify-center">
                      {customer.orderValue !== undefined && customer.orderValue > 0 && (!!currentUser?.role?.toLowerCase()?.includes('quản lý') || currentUser?.permissions?.viewPrice !== false) && (
                        <span className="font-black text-primary/80">
                          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(customer.orderValue)}
                        </span>
                      )}
                      {(() => {
                        const customerQuotation = quotations.find(q => q.customerId === customer.id || (q.customerName === customer.name && q.phone === customer.phone));
                        const depositAmount = (customerQuotation?.status === 'deposit' || customerQuotation?.depositAmount) ? customerQuotation.depositAmount : undefined;
                        if (depositAmount !== undefined && depositAmount > 0 && (!!currentUser?.role?.toLowerCase()?.includes('quản lý') || currentUser?.permissions?.viewPrice !== false)) {
                          return (
                            <span className="text-[7px] md:text-[10px] text-purple-600 font-bold mt-0.5">
                              Cọc: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(depositAmount)}
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-2.5 md:p-5 pt-0 md:pt-0 flex-1 flex flex-col justify-between gap-3">
                  <div className="flex items-start gap-1.5 text-[8px] md:text-[11px] text-muted-foreground/70 leading-tight bg-muted border border-border p-1.5 md:p-3 rounded-lg md:rounded-xl">
                    <MapPin className="h-2.5 w-2.5 md:h-3.5 md:w-3.5 shrink-0 mt-0" />
                    <span>{customer.address || '—'}</span>
                  </div>
                  
                  <div className="flex items-center justify-between pt-1.5 border-t border-border mt-auto">
                    <div className="flex items-center gap-1.5">
                      <Avatar className="h-4 w-4 md:h-6 md:w-6 border border-border shadow-xs">
                        <AvatarImage src={sale?.avatar} />
                        <AvatarFallback className="text-[6px] md:text-[8px] bg-gray-50 text-primary">{sale?.name?.charAt(0) || '?'}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-[9px] md:text-[11px] font-bold opacity-80">{sale?.name?.split(' ').pop() || 'Chưa gán'}</span>
                        <span className="text-[7px] md:text-[9px] opacity-50 font-medium">{getWorkshopName(customer.workshop)}</span>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 md:h-8 text-[8px] md:text-[11px] font-bold rounded-md md:rounded-lg px-2"
                      onClick={() => openViewDialog(customer)}
                    >
                      Chi tiết
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
      )}

      {/* Edit Customer Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[800px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa khách hàng</DialogTitle>
            <DialogDescription>
              Cập nhật thông tin khách hàng và giai đoạn tư vấn.
            </DialogDescription>
          </DialogHeader>
          {selectedCustomer && (
              <div className="max-h-[70vh] overflow-y-auto w-full px-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                  <div className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-name">Tên khách hàng</Label>
                      <Input
                        id="edit-name"
                        value={selectedCustomer.name}
                        onChange={(e) => setSelectedCustomer({ ...selectedCustomer, name: e.target.value })}
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-phone">Số điện thoại</Label>
                      <Input
                        id="edit-phone"
                        value={selectedCustomer.phone}
                        onChange={(e) => setSelectedCustomer({ ...selectedCustomer, phone: e.target.value })}
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="grid gap-2 relative">
                      <Label htmlFor="edit-address" className="flex items-center justify-between">
                        <span>Địa chỉ / Công trình</span>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className={cn("h-6 px-2 text-[10px]", selectedCustomer.location ? "text-green-600 bg-green-50" : "text-blue-600")}
                          onClick={() => setLocationPickerFor('edit')}
                        >
                          <MapPin className="h-3 w-3 mr-1" />
                          {selectedCustomer.location ? "Đã ghim vị trí" : "Ghim bản đồ"}
                        </Button>
                      </Label>
                      <Input
                        id="edit-address"
                        value={selectedCustomer.address}
                        onChange={(e) => setSelectedCustomer({ ...selectedCustomer, address: e.target.value })}
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-furnitureCategory">Hạng mục nội thất</Label>
                      <Input
                        id="edit-furnitureCategory"
                        value={selectedCustomer.furnitureCategory || ''}
                        onChange={(e) => setSelectedCustomer({ ...selectedCustomer, furnitureCategory: e.target.value })}
                        placeholder="VD: Tủ bếp, Sofa, Giường..."
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Cơ sở phụ trách</Label>
                      <Select 
                        value={((selectedCustomer.workshop === 'CoSo1' || selectedCustomer.workshop === 'XuongGo') ? 'Cơ Sở 1' : 
                               (selectedCustomer.workshop === 'CoSo2' || selectedCustomer.workshop === 'XuongNhua') ? 'Cơ Sở 2' : 
                               (selectedCustomer.workshop || WORKSHOPS[1].id)) || 'all'} 
                        onValueChange={(v) => setSelectedCustomer({ ...selectedCustomer, workshop: v })}
                        disabled={currentUser?.workshop && currentUser?.workshop !== 'all'}
                      >
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue placeholder="Chọn cơ sở" />
                        </SelectTrigger>
                        <SelectContent>
                          {WORKSHOPS.filter(w => w.id !== 'all').map(w => (
                            <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Giai đoạn</Label>
                      <Select 
                        value={selectedCustomer.stage || 'consulting'} 
                        onValueChange={(v: CustomerStage) => setSelectedCustomer({ ...selectedCustomer, stage: v })}
                      >
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue placeholder="Chọn giai đoạn">
                            {selectedCustomer.stage ? STAGE_CONFIG[selectedCustomer.stage as keyof typeof STAGE_CONFIG]?.label : "Chọn giai đoạn"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STAGE_CONFIG).map(([key, config]) => (
                            <SelectItem key={key} value={key}>{config.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid gap-2">
                      <Label>Sale phụ trách</Label>
                      <Select 
                        value={selectedCustomer.assignedSaleId || ''} 
                        onValueChange={(v) => setSelectedCustomer({ ...selectedCustomer, assignedSaleId: v })}
                      >
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue placeholder="Chọn nhân viên">
                            {selectedCustomer.assignedSaleId 
                              ? members.find(m => m.id === selectedCustomer.assignedSaleId)?.name 
                              : "Chọn nhân viên"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent alignItemWithTrigger={false} className="w-[var(--radix-select-trigger-width)] min-w-[300px]">
                          {members.filter(m => !!m.role?.toLowerCase()?.includes('sale')).map(m => (
                            <SelectItem key={m.id} value={m.id}>
                              <div className="flex flex-col gap-0.5 text-left">
                                <span className="font-bold text-sm">{m.name}</span>
                                <span className="text-[10px] text-muted-foreground">{m.role}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {(!!currentUser?.role?.toLowerCase()?.includes('quản lý') || currentUser?.permissions?.viewPrice !== false) && (
                      <div className="grid gap-2">
                        <Label htmlFor="edit-orderValue">Giá trị đơn hàng (VNĐ)</Label>
                        <Input
                          id="edit-orderValue"
                          type="text"
                          value={selectedCustomer.orderValue === 0 ? "" : new Intl.NumberFormat('vi-VN').format(selectedCustomer.orderValue || 0)}
                          onChange={(e) => {
                            const rawValue = e.target.value.replace(/\D/g, '');
                            setSelectedCustomer({ ...selectedCustomer, orderValue: rawValue === '' ? 0 : parseInt(rawValue, 10) });
                          }}
                          className="h-11 rounded-xl"
                        />
                      </div>
                    )}
                    <div className="grid gap-2">
                      <Label htmlFor="edit-oneDriveLink">Liên kết OneDrive / Folder ảnh</Label>
                      <Input
                        id="edit-oneDriveLink"
                        value={selectedCustomer.oneDriveLink || ''}
                        onChange={(e) => setSelectedCustomer({ ...selectedCustomer, oneDriveLink: e.target.value })}
                        placeholder="https://onedrive.live.com/..."
                        className="h-11 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2 grid gap-2">
                    <Label htmlFor="edit-notes">Ghi chú</Label>
                    <Textarea
                      id="edit-notes"
                      value={selectedCustomer.notes}
                      onChange={(e) => setSelectedCustomer({ ...selectedCustomer, notes: e.target.value })}
                      className="h-24 rounded-xl"
                    />
                  </div>
                </div>
              </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Hủy</Button>
            <Button onClick={handleUpdateCustomer}>Cập nhật</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Detail Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="w-[96vw] sm:max-w-[700px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl max-h-[95vh] flex flex-col">
          {selectedCustomer && (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="bg-primary px-4 sm:px-8 py-4 sm:py-6 text-primary-foreground relative overflow-hidden shrink-0">
                <div className="absolute top-0 right-0 w-32 h-32 bg-card text-card-foreground/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                <div className="relative z-10 flex justify-between items-start">
                  <div>
                    <Badge className="mb-2 bg-card text-card-foreground/20 hover:bg-card text-card-foreground/30 border-none text-white font-bold px-2 py-0.5 rounded-full text-[9px] sm:text-[10px]">
                      {STAGE_CONFIG[selectedCustomer.stage].label}
                    </Badge>
                    {selectedCustomer.code && (
                      <p className="text-[9px] sm:text-[10px] text-white/60 mb-0.5 font-mono uppercase tracking-wider">{selectedCustomer.code}</p>
                    )}
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-1">{selectedCustomer.name}</h2>
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-primary-foreground/80 text-[10px] sm:text-xs">
                      <span className="flex items-center gap-1.5"><Phone className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> {selectedCustomer.phone}</span>
                      <span className="flex items-center gap-1.5"><Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Chốt/Cọc: {formatVNTime(selectedCustomer.createdAt)}</span>
                      {selectedCustomer.consultedAt && selectedCustomer.consultedAt !== selectedCustomer.createdAt && (
                        <span className="flex items-center gap-1.5 text-amber-200 font-bold">
                          <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Tư vấn: {formatVNTime(selectedCustomer.consultedAt)}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 font-bold text-white"><DollarSign className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> {formatCurrency(selectedCustomer.orderValue)}</span>
                      {(() => {
                        const customerQuotation = quotations.find(q => q.customerId === selectedCustomer.id || (q.customerName === selectedCustomer.name && q.phone === selectedCustomer.phone));
                        const depositAmount = (customerQuotation?.status === 'deposit' || customerQuotation?.depositAmount) ? customerQuotation.depositAmount : undefined;
                        if (depositAmount !== undefined && depositAmount > 0) {
                          return (
                            <span className="flex items-center gap-1.5 font-bold text-purple-200">
                              <CreditCard className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Cọc: {formatCurrency(depositAmount)}
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-white/60 hover:text-white hover:bg-card text-card-foreground/10 -mr-2 -mt-1 sm:-mr-4 sm:-mt-2" 
                    onClick={() => setIsViewDialogOpen(false)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>
              
              <div className="overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-5 sm:space-y-6 bg-card flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1">
                    <Label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 ml-1">Địa chỉ công trình</Label>
                    <div className="flex items-start gap-2.5 p-2.5 sm:p-3 rounded-xl bg-secondary/30 ring-1 ring-border/50">
                      <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary shrink-0 mt-0.5" />
                      <p className="text-[11px] sm:text-xs font-medium leading-relaxed">{selectedCustomer.address}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 ml-1">Hạng mục nội thất</Label>
                    <div className="flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl bg-secondary/30 ring-1 ring-border/50">
                      <Layout className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary shrink-0" />
                      <p className="text-[11px] sm:text-xs font-bold">{selectedCustomer.furnitureCategory || 'Chưa cập nhật'}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 ml-1">Người phụ trách</Label>
                    <div className="flex items-center gap-2.5 p-2 rounded-xl bg-secondary/30 ring-1 ring-border/50">
                      <Avatar className="h-7 w-7 sm:h-8 sm:w-8 border border-primary/10">
                        <AvatarImage src={members.find(m => m.id === selectedCustomer.assignedSaleId)?.avatar} className="object-cover" />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-[10px] sm:text-xs">
                          {members.find(m => m.id === selectedCustomer.assignedSaleId)?.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-[11px] sm:text-xs font-bold leading-none">{members.find(m => m.id === selectedCustomer.assignedSaleId)?.name}</p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">{members.find(m => m.id === selectedCustomer.assignedSaleId)?.role}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 ml-1">OneDrive</Label>
                    <div className="p-1 px-2 h-[38px] sm:h-[44px] rounded-xl bg-secondary/30 ring-1 ring-border/50 flex items-center justify-between">
                      <p className="text-[10px] sm:text-[11px] truncate flex-1 px-1">{selectedCustomer.oneDriveLink || 'Chưa có liên kết'}</p>
                      {selectedCustomer.oneDriveLink && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg text-primary" onClick={() => window.open(selectedCustomer.oneDriveLink, '_blank')}>
                          <ExternalLink className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 ml-1">Ghi chú</Label>
                  <div className="p-3 rounded-xl bg-secondary/20 border border-dashed border-border/50 min-h-[60px]">
                    <p className="text-xs text-muted-foreground italic leading-relaxed">
                      "{selectedCustomer.notes || 'Không có ghi chú nào'}"
                    </p>
                  </div>
                </div>

            <div className="bg-slate-50/50 rounded-2xl p-3 sm:p-4 ring-1 ring-slate-100 min-h-[300px]">
                    <CustomerWorkflowHistory 
                      history={[
                      ...tasks.filter(t => t.customerId === selectedCustomer.id).map(t => ({
                        id: t.id,
                        type: (t.type === 'design' ? 'design' : t.type === 'production' ? 'production' : 'sale') as 'design' | 'production' | 'sale' | 'other',
                        timestamp: t.createdAt,
                        action: `Task: ${t.title}`,
                        note: t.description || 'Chưa có mô tả',
                        updatedBy: members.find(m => m.id === t.assigneeId)?.name || 'Hệ thống',
                        files2D3D: t.files2D3D,
                        checklists: t.checklists,
                        materialList: t.materialList
                      })),
                      ...quotations.filter(q => q.customerName === selectedCustomer.name).map(q => ({
                        id: q.id,
                        type: 'sale' as const,
                        timestamp: q.consultedAt || q.createdAt || q.date,
                        action: `Báo giá: ${q.quotationNumber}`,
                        note: `Tổng tiền: ${q.totalAmount.toLocaleString('vi-VN')} đ${q.depositAmount ? ` (Cọc: ${q.depositAmount.toLocaleString('vi-VN')} đ)` : ''}`,
                        updatedBy: q.createdBy || 'Hệ thống',
                        files2D3D: q.imageUrls,
                        quotationItems: q.items.map(item => ({
                          id: item.id,
                          name: item.name,
                          quantity: item.quantity,
                          unit: item.unit,
                          total: item.total
                        }))
                      })),
                      ...schedules.filter(s => s.customerName === selectedCustomer.name).map(s => ({
                        id: s.id,
                        type: 'design' as const,
                        timestamp: s.date,
                        action: `Đo đạc: ${s.date}`,
                        note: s.notes || 'Không có ghi chú',
                        updatedBy: members.find(m => m.id === s.assigneeId)?.name || 'Hệ thống',
                        files2D3D: s.imageUrls 
                      }))
                    ].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())}
                  />
                  </div>
              </div>

              <div className="p-4 border-t bg-slate-50/80 flex justify-end gap-3 shrink-0">
                <Button variant="outline" className="rounded-xl px-6 h-10 text-xs font-semibold" onClick={() => setIsViewDialogOpen(false)}>Đóng</Button>
                <Button className="rounded-xl px-6 h-10 text-xs font-bold" onClick={() => {
                  setIsViewDialogOpen(false);
                  openEditDialog(selectedCustomer);
                }}>Chỉnh sửa hồ sơ</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {filteredCustomers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-card/30 rounded-3xl border border-dashed border-border/50">
          <Search className="h-12 w-12 mb-4 opacity-20" />
          <p className="text-lg font-medium">Không tìm thấy khách hàng nào</p>
          <p className="text-sm">Thử thay đổi từ khóa tìm kiếm của bạn.</p>
        </div>
      )}
      {/* Assignment Dialog for Contracted Stage */}
      <Dialog open={!!pendingContract} onOpenChange={(open) => !open && setPendingContract(null)}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Giao việc thiết kế</DialogTitle>
            <DialogDescription>
              Khách hàng đã ký hợp đồng. Vui lòng chọn người thực hiện bản vẽ thiết kế.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10">
              <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">Khách hàng:</p>
              <p className="text-sm font-bold">{pendingContract?.customer.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{pendingContract?.customer.furnitureCategory}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Người nhận việc thiết kế</Label>
              <Select 
                value={targetDesignerId || ''} 
                onValueChange={setTargetDesignerId}
              >
                <SelectTrigger className="h-12 rounded-xl w-full">
                  <SelectValue placeholder="Chọn kiến trúc sư / Designer">
                    {targetDesignerId ? members.find(m => m.id === targetDesignerId)?.name : "Chọn kiến trúc sư / Designer"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false} className="w-auto min-w-[320px]">
                  {members.filter(m => !!m.role?.toLowerCase()?.includes('thiết kế') || !!m.role?.toLowerCase()?.includes('kỹ thuật')).map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      <div className="flex items-center gap-3 py-1">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={m.avatar} />
                          <AvatarFallback>{m.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col text-left">
                          <span className="font-bold text-sm">{m.name}</span>
                          <span className="text-[10px] text-muted-foreground">{m.role}</span>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                  <div className="border-t my-1 h-px bg-border" />
                  <p className="text-[9px] px-2 py-1 text-muted-foreground italic">Hiển thị nhân viên bộ phận Thiết kế/Kỹ thuật</p>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl font-bold" onClick={() => setPendingContract(null)}>Để sau</Button>
            <Button 
              disabled={!targetDesignerId}
              className="rounded-xl font-bold px-8"
              onClick={handleCreateDesignTask}
            >
              Xác nhận & Giao việc
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LocationPickerDialog 
        isOpen={locationPickerFor !== null}
        onClose={() => setLocationPickerFor(null)}
        initialLocation={locationPickerFor === 'add' ? newCustomer.location : selectedCustomer?.location}
        onSave={(loc) => {
          if (locationPickerFor === 'add') {
            setNewCustomer(prev => ({ ...prev, location: loc }));
          } else if (locationPickerFor === 'edit' && selectedCustomer) {
            setSelectedCustomer({ ...selectedCustomer, location: loc });
          }
        }}
      />
    </div>
  );
}
