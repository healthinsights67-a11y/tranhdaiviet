import * as React from 'react';
import { 
  Plus, 
  Search, 
  FileText, 
  MoreVertical, 
  Download, 
  Mail, 
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  Filter,
  Copy,
  ChevronRight,
  ChevronLeft,
  TrendingDown,
  Phone,
  Package,
  XCircle,
  X,
  Calendar,
  Building
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQueryClient } from '@tanstack/react-query';
import { Quotation, Customer, Member, WORKSHOPS, getWorkshopName } from '@/src/types';
import { format } from 'date-fns';
import { QuotationForm } from './QuotationForm';
import { QuotationPreview } from './QuotationPreview';
import { ProductLibrary } from './ProductLibrary';
import { QuotationTemplateConfig } from './QuotationTemplateConfig';
import { db, collection, addDoc, updateDoc, deleteDoc, doc, getDoc, getDocs, query, where, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useNotificationStore } from '@/src/store/useNotificationStore';
import { sendSystemNotification } from '@/src/services/botNotificationService';
import { saveProductTemplate } from '@/src/services/productService';
import { notifyManagers } from '@/src/services/notificationService';
import { moveToTrash } from '@/src/services/trashService';
import { toast } from 'sonner';
import { cn, getCurrentVNMonth, getCurrentVNYear, getVNMonth, formatCurrency } from '@/src/lib/utils';

interface QuotationPageProps {
  quotations: Quotation[];
  user: any;
  customers: Customer[];
  members: Member[];
  products?: any[];
}

type FilterStatus = Quotation['status'] | 'all';
type ViewMode = 'list' | 'library';

export function QuotationPage({ quotations, user, customers, members, products = [] }: QuotationPageProps) {
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = React.useState<ViewMode>('list');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<FilterStatus>('all');
  const [workshopFilter, setWorkshopFilter] = React.useState<string>('all');
  const [selectedMonth, setSelectedMonth] = React.useState<string>('');
  const [pickerYear, setPickerYear] = React.useState<number>(getCurrentVNYear());
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
  const [selectedQuotation, setSelectedQuotation] = React.useState<Quotation | null>(null);
  const [pendingDesignTask, setPendingDesignTask] = React.useState<{ quotationId: string; customerId: string; customerName: string; } | null>(null);
  const [targetDesignerId, setTargetDesignerId] = React.useState<string>('');
  const [depositDialog, setDepositDialog] = React.useState<{isOpen: boolean, quotationId: string, amount: string}>({isOpen: false, quotationId: '', amount: ''});

  const filteredQuotations = quotations.filter(q => {
    const matchesSearch = q.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         q.quotationNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
    
    const matchesTime = (() => {
      if (!selectedMonth || selectedMonth === 'all') return true;
      if (!q.createdAt) return false;
      const date = new Date(q.createdAt);
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
      return getVNMonth(q.createdAt) === selectedMonth;
    })();

    const customer = customers.find(c => c.id === q.customerId);
    const quoteWorkshop = q.workshop || customer?.workshop;
    const matchesWorkshop = workshopFilter === 'all' || getWorkshopName(quoteWorkshop) === getWorkshopName(workshopFilter);

    return matchesSearch && matchesStatus && matchesTime && matchesWorkshop;
  });

  const [activeQuotationIds, setActiveQuotationIds] = React.useState<Record<string, string>>({});

  // Group quotations by phone (or customer name if phone is not present)
  const groupedQuotations = React.useMemo(() => {
    const groups: Record<string, Quotation[]> = {};
    filteredQuotations.forEach(q => {
      const key = q.phone || q.customerName || 'unknown';
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(q);
    });

    // Map to array and sort chronologically (Lần 1, Lần 2, ...)
    const mappedGroups = Object.values(groups).map(groupQuotes => {
      const sorted = [...groupQuotes].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      return {
        phone: sorted[0].phone,
        customerName: sorted[0].customerName,
        quotations: sorted,
        latestDate: new Date(sorted[sorted.length - 1].createdAt).getTime()
      };
    });

    // Sort groups from newest to oldest based on their latest quotation
    return mappedGroups.sort((a, b) => b.latestDate - a.latestDate);
  }, [filteredQuotations]);

  const getActiveQuotation = (group: { phone: string; customerName: string; quotations: Quotation[] }) => {
    const selectedId = activeQuotationIds[group.phone];
    if (selectedId) {
      const found = group.quotations.find(q => q.id === selectedId);
      if (found) return found;
    }
    // Default to the latest quotation in the group (the last one in the sorted list)
    return group.quotations[group.quotations.length - 1];
  };

  const handleCreateNewVersion = (quotation: Quotation) => {
    const nowStr = new Date().toISOString();
    const customer = customers.find(c => c.id === quotation.customerId);
    const customerCode = customer?.code;
    
    let cleanNumber = '';
    if (customerCode) {
      const baseCode = customerCode.split('-')[0].trim();
      let finalCode = baseCode;
      if (baseCode.startsWith('K') && !baseCode.startsWith('KH')) {
        finalCode = baseCode.replace(/^K/, 'KH');
      } else if (!baseCode.startsWith('KH')) {
        finalCode = `KH${baseCode}`;
      }
      cleanNumber = `BG-${finalCode}`;
    } else {
      cleanNumber = `BG-${getCurrentVNYear()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    }

    const newVersionData: Quotation = {
      ...quotation,
      id: Math.random().toString(36).substr(2, 9),
      quotationNumber: cleanNumber,
      createdAt: nowStr,
      consultedAt: nowStr,
      status: 'draft'
    };
    setSelectedQuotation(newVersionData);
    setIsFormOpen(true);
  };

  const handleDuplicateQuotation = (quotation: Quotation) => {
    const nowStr = new Date().toISOString();
    
    // Generate a temporary new quotation number
    const cleanNumber = `BG-${getCurrentVNYear()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

    const newDuplicateData: Quotation = {
      ...quotation,
      id: Math.random().toString(36).substr(2, 9),
      quotationNumber: cleanNumber,
      createdAt: nowStr,
      consultedAt: nowStr,
      status: 'draft',
      // Clear customer specific info to allow assigning to a new customer
      customerId: '',
      customerName: '',
      phone: '',
      address: '',
    };
    setSelectedQuotation(newDuplicateData);
    setIsFormOpen(true);
  };

  const handleCreateQuotation = async (data: Omit<Quotation, 'id'>) => {
    try {
      if (user) {
        const isEditingExisting = selectedQuotation && quotations.some(q => q.id === selectedQuotation.id);
        if (isEditingExisting && isFormOpen) {
          // Update existing
          await updateDoc(doc(db, 'quotations', (selectedQuotation as any).id), {
            ...data,
            updatedAt: new Date().toISOString()
          });

          // Send to external bot platforms (Zalo/Telegram)
          sendSystemNotification(`✏️ Cập nhật báo giá!\n\n👤 Khách hàng: ${data.customerName}\n💰 Tổng tiền mới: ${formatCurrency(data.totalAmount || 0)}\n\nĐược cập nhật bởi: ${user?.displayName || 'Hệ thống'}`);

          // Automatically update customer order value
          if (data.customerId) {
            await updateDoc(doc(db, 'customers', data.customerId), {
              orderValue: data.totalAmount
            });
          }

          toast.success("Đã cập nhật báo giá");
        } else {
          // Add new
          const nowStr = new Date().toISOString();
          await addDoc(collection(db, 'quotations'), {
            ...data,
            createdAt: nowStr,
            updatedAt: nowStr
          });

          // Send to external bot platforms (Zalo/Telegram)
          sendSystemNotification(`📄 Báo giá mới!\n\n👤 Khách hàng: ${data.customerName}\n💰 Tổng tiền: ${formatCurrency(data.totalAmount || 0)}\n📝 Trạng thái: Bản nháp\n\nĐược tạo bởi: ${user?.displayName || 'Hệ thống'}`);

          // Automatically update customer order value
          if (data.customerId) {
            await updateDoc(doc(db, 'customers', data.customerId), {
              orderValue: data.totalAmount
            });
          }

          // Notify managers about the new quotation
          notifyManagers(
            'Báo giá mới',
            `Khách hàng ${data.customerName} vừa nhận báo giá mới: ${data.quotationNumber} trị giá ${(data.totalAmount / 1000000).toFixed(1)}M`
          );

          toast.success("Đã lưu báo giá thành công");
        }
        queryClient.invalidateQueries({ queryKey: ['quotations'] });
        queryClient.invalidateQueries({ queryKey: ['customers'] });
      } else {
        toast.warning("Bạn đang ở chế độ xem trước. Báo giá này sẽ không được lưu vào máy chủ. Hãy đăng nhập để lưu dữ liệu lâu dài.", {
          duration: 6000,
        });
      }
      setIsFormOpen(false);
      setSelectedQuotation(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'quotations');
    }
  };

  const handleDuplicate = (quotation: Quotation) => {
    const nowStr = new Date().toISOString();
    const duplicateData: Quotation = {
      ...quotation,
      id: Math.random().toString(36).substr(2, 9),
      quotationNumber: `${quotation.quotationNumber}-COPY`,
      createdAt: nowStr,
      consultedAt: nowStr,
      status: 'draft'
    };
    setSelectedQuotation(duplicateData);
    setIsFormOpen(true);
  };

  const handleDeleteQuotation = async (id: string) => {
    if (!confirm("Xác nhận xóa báo giá này khỏi hệ thống?")) return;
    try {
      if (user) {
        const quote = quotations.find(q => q.id === id);
        const title = quote ? `Báo giá: ${quote.quotationNumber} - ${quote.customerName}` : id;
        await moveToTrash('quotations', id, title, user.email || '');
      }
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      toast.success("Đã xóa báo giá");

      // Auto switch or close preview if the deleted quotation is currently selected
      if (selectedQuotation && selectedQuotation.id === id) {
        const siblings = quotations.filter(q => {
          if (selectedQuotation.phone && q.phone) {
            return q.phone === selectedQuotation.phone;
          }
          return q.customerName === selectedQuotation.customerName;
        });
        const remaining = siblings.filter(q => q.id !== id);
        if (remaining.length > 0) {
          // Switch to the latest remaining version
          const sorted = [...remaining].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          setSelectedQuotation(sorted[sorted.length - 1]);
        } else {
          setIsPreviewOpen(false);
          setSelectedQuotation(null);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `quotations/${id}`);
    }
  };

  const handleCreateDesignTask = async () => {
    if (!pendingDesignTask || !targetDesignerId) return;
    const { quotationId, customerId, customerName } = pendingDesignTask;

    const customer = customers.find(c => c.id === customerId);
    const address = customer?.address || '';
    const category = customer?.furnitureCategory || 'Nội thất';
    const phone = customer?.phone || '';
    const workshop = customer?.workshop || '';

    let measurementImages: string[] = [];
    if (customerId) {
      try {
        const q = query(
          collection(db, 'measurement_schedules'),
          where('customerId', '==', customerId)
        );
        const snap = await getDocs(q);
        snap.forEach(doc => {
          const data = doc.data();
          if (data.imageUrls && Array.isArray(data.imageUrls)) {
            measurementImages = [...measurementImages, ...data.imageUrls];
          }
        });
      } catch (error) {
        console.error("Error fetching measurement images:", error);
      }
    }

    const newTaskData = {
      title: `Thiết kế: ${customerName}`,
      description: `Tiếp nhận thông tin từ báo giá chốt của khách hàng ${customerName}. Hạng mục: ${category}. Địa chỉ: ${address}. SĐT: ${phone}`,
      status: 'todo' as const,
      type: 'design' as const,
      priority: 'medium' as const,
      assigneeId: targetDesignerId,
      customerId: customerId,
      imageUrls: measurementImages,
      createdAt: new Date().toISOString(),
      workshop: workshop,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    };

    try {
      if (user) {
        await addDoc(collection(db, 'tasks'), newTaskData);
      }
      
      const designerName = members.find(m => m.id === targetDesignerId)?.name || 'Nhân viên';
      toast.success(`Báo giá Hoàn Thành! Đã giao việc thiết kế cho ${designerName}`);
      setPendingDesignTask(null);
      setTargetDesignerId('');
    } catch (error: any) {
      console.error("Error creating design task:", error);
      toast.error("Lỗi khi tạo nhiệm vụ thiết kế");
    }
  };

  const handleUpdateStatus = async (id: string, status: Quotation['status'], depositAmount?: number) => {
    try {
      const quotationRef = doc(db, 'quotations', id);
      const updateData: any = {
        status,
        updatedAt: new Date().toISOString()
      };
      if (depositAmount !== undefined) {
        updateData.depositAmount = depositAmount;
      }
      
      // Fetch previous state before updating
      const prevSnap = await getDoc(quotationRef);
      const prevData = prevSnap.exists() ? prevSnap.data() as Quotation : null;
      const prevStatus = prevData?.status;

      // If transitioning to accepted or deposit from a non-final status, push quotation to current month
      if ((status === 'accepted' || status === 'deposit') && prevStatus !== 'accepted' && prevStatus !== 'deposit') {
        const nowStr = new Date().toISOString();
        updateData.consultedAt = prevData?.consultedAt || prevData?.createdAt || nowStr;
        updateData.createdAt = nowStr;
      }

      await updateDoc(quotationRef, updateData);

      // Send to external bot platforms (Zalo/Telegram)
      let statusText = 'Bản nháp';
      if (status === 'sent') statusText = 'Đã gửi khách';
      else if (status === 'accepted') statusText = 'Khách chốt';
      else if (status === 'rejected') statusText = 'Từ chối';
      else if (status === 'deposit') statusText = 'Đã đặt cọc';
      
      if (prevData && prevData.status !== status) {
        sendSystemNotification(`📊 Cập nhật trạng thái báo giá!\n\n👤 Khách hàng: ${prevData.customerName}\n💰 Tổng tiền: ${formatCurrency(prevData.totalAmount || 0)}\n🏷 Trạng thái mới: ${statusText}\n\nĐược cập nhật bởi: ${user?.displayName || 'Hệ thống'}`);
      }

      // Automatically update customer stage and order value if quotation is accepted or deposited
      if (status === 'accepted' || status === 'deposit') {
        if (prevData) {
          if (prevData.customerId) {
            const customerRef = doc(db, 'customers', prevData.customerId);
            const customerSnap = await getDoc(customerRef);
            const customerData = customerSnap.exists() ? customerSnap.data() : null;
            const customerStage = customerData?.stage;

            const customerUpdate: any = {
              stage: 'contracted',
              orderValue: prevData.totalAmount
            };

            // Push customer to current month if transitioning from a non-final stage to contracted/completed
            if (customerStage !== 'contracted' && customerStage !== 'completed') {
              const nowStr = new Date().toISOString();
              customerUpdate.consultedAt = customerData?.consultedAt || customerData?.createdAt || nowStr;
              customerUpdate.createdAt = nowStr;
            }

            await updateDoc(customerRef, customerUpdate);

            // Push tasks to current month (closing/accepted date)
            if (customerStage !== 'contracted' && customerStage !== 'completed') {
              try {
                const nowStr = new Date().toISOString();
                const taskQ = query(collection(db, 'tasks'));
                const taskSnap = await getDocs(taskQ);
                const cleanPhone = prevData.phone?.trim()?.replace(/\D/g, '');
                
                for (const taskDoc of taskSnap.docs) {
                  const tData = taskDoc.data();
                  if (tData.status === 'done' || tData.status === 'archived') continue;
                  
                  let matches = false;
                  if (prevData.customerId && tData.customerId === prevData.customerId) {
                    matches = true;
                  } else if (cleanPhone) {
                    const tPhone = tData.phone?.trim()?.replace(/\D/g, '') || 
                                   tData.description?.replace(/\D/g, '').slice(-10);
                    if (tPhone && (cleanPhone.includes(tPhone) || tPhone.includes(cleanPhone))) {
                      matches = true;
                    }
                  }
                  
                  if (matches) {
                    const taskUpdate: any = {
                      createdAt: nowStr,
                      ...(tData.customerId ? {} : { customerId: prevData.customerId })
                    };
                    
                    if (status === 'accepted') {
                      taskUpdate.status = 'done';
                      taskUpdate.completedAt = nowStr;
                    }
                    
                    await updateDoc(doc(db, 'tasks', taskDoc.id), taskUpdate);
                  }
                }
                queryClient.invalidateQueries({ queryKey: ['tasks'] });
              } catch (err) {
                console.error("Error updating tasks createdAt for customer from quotation:", err);
              }
            }

            toast.info(`Đã cập nhật trạng thái khách hàng sang: ${status === 'accepted' ? 'Hoàn thành' : 'Đã ký hợp đồng'} & Cập nhật giá trị đơn hàng.`);
            queryClient.invalidateQueries({ queryKey: ['customers'] });

            if (status === 'accepted') {
              toast.success(`Đã tự động hoàn tất dự án cho: ${prevData.customerName}`);
            }
          }
          
          // Only show the assignment dialog if we are moving to deposit, 
          // or moving to accepted from a state other than deposit
          if ((status === 'deposit' && prevStatus !== 'deposit') || (status === 'accepted' && prevStatus !== 'deposit')) {
            setPendingDesignTask({
              quotationId: id,
              customerId: prevData.customerId || '',
              customerName: prevData.customerName || 'Khách lẻ'
            });
            setIsPreviewOpen(false); // Close preview to prevent dialog overlap
          }
        }
      }

      // Automatically update customer stage to 'lost' and reset order value if quotation is rejected
      if (status === 'rejected') {
        const snap = await getDoc(quotationRef);
        if (snap.exists()) {
          const qData = snap.data() as Quotation;
          if (qData.customerId) {
            await updateDoc(doc(db, 'customers', qData.customerId), {
              stage: 'lost',
              orderValue: 0
            });
            toast.info('Đã cập nhật trạng thái khách hàng sang: Thất bại (Từ chối) & Đặt giá trị đơn hàng về 0.');
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      if (status === 'deposit' && prevStatus === 'deposit') {
        toast.success("Đã cập nhật số tiền cọc");
      } else {
        toast.success(`Đã chuyển trạng thái sang: ${status === 'accepted' ? 'Hoàn Thành' : status === 'deposit' ? 'Đã cọc' : status === 'sent' ? 'Đã gửi' : 'Từ chối'}`);
      }
      
      // Update selected quotation if it's currently being previewed
      if (selectedQuotation && selectedQuotation.id === id) {
        setSelectedQuotation(prev => prev ? { ...prev, status } : null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `quotations/${id}`);
    }
  };

  const handleSaveProduct = async (product: any) => {
    try {
      await saveProductTemplate(product);
      toast.success(product.id && !product.id.startsWith('temp-') ? "Đã cập nhật sản phẩm" : "Đã thêm sản phẩm mới vào kho");
      queryClient.invalidateQueries({ queryKey: ['product_library'] });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'product_library');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Xác nhận xóa sản phẩm này khỏi kho mẫu?")) return;
    try {
      if (user) {
        const product = products.find(p => p.id === id);
        const title = product ? `Sản phẩm mẫu: ${product.name}` : id;
        await moveToTrash('product_library', id, title, user.email || '');
      }
      queryClient.invalidateQueries({ queryKey: ['product_library'] });
      toast.success("Đã xóa sản phẩm");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `product_library/${id}`);
    }
  };

  const getStatusBadge = (status: Quotation['status']) => {
    switch (status) {
      case 'draft': return <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200 px-2.5 py-0.5">Bản nháp</Badge>;
      case 'sent': return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 px-2.5 py-0.5">Đã gửi</Badge>;
      case 'accepted': return <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 px-2.5 py-0.5 font-bold">Chốt Báo Giá</Badge>;
      case 'deposit': return <Badge variant="outline" className="bg-purple-50 text-purple-600 border-purple-200 px-2.5 py-0.5 font-bold">Đã cọc</Badge>;
      case 'rejected': return <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 px-2.5 py-0.5">Từ chối</Badge>;
    }
  };

  const getCardStyle = (status: Quotation['status']) => {
    switch (status) {
      case 'accepted':
        return 'border-l-4 border-l-emerald-500 bg-white hover:border-emerald-300 shadow-sm hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-300 border border-slate-100';
      case 'deposit':
        return 'border-l-4 border-l-purple-500 bg-white hover:border-purple-300 shadow-sm hover:shadow-xl hover:shadow-purple-500/5 transition-all duration-300 border border-slate-100';
      case 'sent':
        return 'border-l-4 border-l-blue-500 bg-white hover:border-blue-300 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 border border-slate-100';
      case 'rejected':
        return 'border-l-4 border-l-red-500 bg-white hover:border-red-300 shadow-sm hover:shadow-xl hover:shadow-red-500/5 transition-all duration-300 border border-slate-100';
      default: // draft
        return 'border-l-4 border-l-slate-400 bg-white hover:border-slate-300 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100';
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4 md:gap-6">
          <div className="hidden sm:flex flex-col items-center justify-center p-2 md:p-3 bg-card text-card-foreground border-2 border-blue-100 rounded-2xl shadow-sm shrink-0">
             <div className="flex items-baseline leading-none">
                <span className="text-xl md:text-2xl font-black tracking-tighter" style={{ color: '#BE1E2D' }}>tủ</span>
                <span className="text-2xl md:text-3xl font-black mx-0.5" style={{ color: '#FBB03B' }}>3</span>
                <span className="text-xl md:text-2xl font-black tracking-tighter" style={{ color: '#BE1E2D' }}>miền</span>
             </div>
             <div className="text-[5px] md:text-[6px] font-black uppercase tracking-[0.2em] text-black whitespace-nowrap">
                tủ cho người Việt
             </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl md:text-4xl font-black tracking-tight flex items-center gap-3">
               Báo Giá
            </h1>
            <p className="text-muted-foreground text-[10px] md:text-sm font-medium">Quản lý hồ sơ báo giá khách hàng.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-2xl border border-gray-200">
          <Button 
            variant={activeView === 'list' ? 'default' : 'ghost'} 
            onClick={() => setActiveView('list')}
            className={cn("h-10 rounded-xl font-bold gap-2 text-xs", activeView === 'list' ? "shadow-sm" : "")}
          >
            <FileText className="h-4 w-4" />
            Báo Giá
          </Button>
          <Button 
            variant={activeView === 'library' ? 'default' : 'ghost'} 
            onClick={() => setActiveView('library')}
            className={cn("h-10 rounded-xl font-bold gap-2 text-xs", activeView === 'library' ? "shadow-sm" : "")}
          >
            <Package className="h-4 w-4" />
            Kho Sản Phẩm
          </Button>
        </div>

        <div className="hidden lg:flex items-center gap-3">
          <QuotationTemplateConfig />
          <Button onClick={() => {
            setSelectedQuotation(null);
            setIsFormOpen(true);
          }} className="h-10 md:h-12 px-6 md:px-8 rounded-xl font-bold gap-2 md:gap-3 shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform active:scale-[0.98] text-xs md:text-sm">
            <Plus className="h-4 w-4 md:h-5 md:w-5" />
            Tạo báo giá mới
          </Button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeView === 'list' ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-6"
          >
            <div className="lg:hidden flex items-center gap-2">
              <QuotationTemplateConfig />
              <Button onClick={() => {
                setSelectedQuotation(null);
                setIsFormOpen(true);
              }} className="flex-1 h-12 rounded-xl font-bold gap-3 shadow-xl shadow-primary/20">
                <Plus className="h-5 w-5" />
                Tạo báo giá mới
              </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
              {[
                { label: 'Tổng báo giá', value: quotations.length, icon: FileText, color: 'bg-primary' },
                { label: 'Chốt Báo Giá', value: quotations.filter(q => q.status === 'accepted').length, icon: CheckCircle2, color: 'bg-emerald-500' },
                { label: 'Đã cọc', value: quotations.filter(q => q.status === 'deposit').length, icon: Clock, color: 'bg-purple-500' },
                { label: 'Doanh thu', value: `${(quotations.filter(q => q.status === 'accepted' || q.status === 'deposit').reduce((acc, q) => acc + q.totalAmount, 0) / 1000000).toFixed(1)}M`, icon: TrendingDown, color: 'bg-amber-500' },
              ].map((stat, i) => (
                <Card key={stat.label} className="border border-border bg-card text-card-foreground shadow-sm relative overflow-hidden group">
                   <div className={cn("absolute top-0 right-0 p-1.5 md:p-2 opacity-10 transition-opacity", stat.color)}>
                      <stat.icon className="h-8 w-8 md:h-12 md:w-12" />
                   </div>
                   <CardContent className="p-2 md:p-4 flex items-center gap-2 md:gap-3">
                      <div className={cn("h-7 w-7 md:h-10 md:w-10 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm", stat.color)}>
                         <stat.icon className="h-3.5 w-3.5 md:h-5 md:w-5" />
                      </div>
                      <div className="min-w-0">
                         <p className="text-[8px] md:text-[9px] uppercase font-black tracking-widest text-muted-foreground truncate">{stat.label}</p>
                         <h3 className="text-sm md:text-xl font-black">{stat.value}</h3>
                      </div>
                   </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border border-border shadow-sm bg-card text-card-foreground rounded-2xl md:rounded-3xl overflow-hidden">
              <CardHeader className="px-4 md:px-8 py-4 md:py-6 border-b border-border bg-gray-50 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <CardTitle className="text-lg md:text-xl font-bold flex items-center gap-2">
                      Hồ sơ lưu trữ
                      <Badge variant="secondary" className="rounded-full h-5 text-[10px] px-2 bg-blue-50 text-primary border border-blue-100 shrink-0">
                         {groupedQuotations.length} tệp khách hàng
                      </Badge>
                  </CardTitle>

                  <div className="flex flex-col md:flex-row items-center gap-3 w-full lg:w-auto">
                    <div className="relative group w-full lg:w-80">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input 
                        placeholder="Tìm khách, số báo giá..." 
                        className="pl-10 w-full bg-card text-card-foreground border-border h-10 md:h-11 rounded-xl focus:ring-primary focus:border-primary transition-all shadow-sm text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto scrollbar-none pb-1 md:pb-0">
                      <Select value={workshopFilter} onValueChange={setWorkshopFilter}>
                        <SelectTrigger className="h-10 md:h-11 min-w-[120px] rounded-xl bg-card text-card-foreground border-border gap-2 text-xs">
                           <Building className="h-4 w-4 text-muted-foreground" />
                           <SelectValue placeholder="Cơ sở" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-white/10">
                          {WORKSHOPS.map(w => (
                            <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as FilterStatus)}>
                        <SelectTrigger className="h-10 md:h-11 min-w-[120px] rounded-xl bg-card text-card-foreground border-border gap-2 text-xs">
                           <Filter className="h-4 w-4 text-muted-foreground" />
                           <SelectValue placeholder="Trạng thái" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-white/10">
                          <SelectItem value="all">Tất cả trạng thái</SelectItem>
                          <SelectItem value="draft">Bản nháp</SelectItem>
                          <SelectItem value="sent">Đã gửi</SelectItem>
                          <SelectItem value="accepted">Chốt Báo Giá</SelectItem>
                          <SelectItem value="deposit">Đã cọc</SelectItem>
                          <SelectItem value="rejected">Từ chối</SelectItem>
                        </SelectContent>
                      </Select>

                      <Popover>
                        <PopoverTrigger className="inline-flex items-center justify-between min-w-[120px] h-10 md:h-11 text-xs font-medium border border-border bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground px-3 py-2 rounded-xl ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                           <div className="flex items-center gap-2">
                             <Calendar className="h-4 w-4 text-muted-foreground" />
                             {selectedMonth === 'today' ? "Hôm nay" : selectedMonth === 'week' ? "Tuần này" : selectedMonth ? `Tháng ${selectedMonth.split('-')[1]}/${selectedMonth.split('-')[0]}` : "Thời gian"}
                           </div>
                        </PopoverTrigger>
                        <PopoverContent className="w-[280px] p-2" align="start">
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
                </div>
                
                {/* Fast Filters - Scrollable on mobile */}
                <div className="overflow-x-auto pb-1 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none">
                  <div className="flex items-center gap-1.5 p-1 bg-secondary/20 rounded-xl w-max">
                     {(['all', 'draft', 'sent', 'accepted', 'deposit', 'rejected'] as FilterStatus[]).map((status) => (
                        <button
                         key={status}
                         type="button"
                         onClick={() => setStatusFilter(status)}
                         className={cn(
                            "px-3 md:px-5 py-1.5 md:py-2 text-[10px] md:text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap",
                            statusFilter === status 
                             ? "bg-card text-card-foreground text-primary shadow-sm" 
                             : "text-muted-foreground hover:text-foreground hover:bg-card text-card-foreground"
                         )}
                        >
                         {status === 'all' ? 'Tất cả hồ sơ' : 
                          status === 'draft' ? 'Bản nháp' :
                          status === 'sent' ? 'Đã gửi khách' :
                          status === 'accepted' ? 'Chốt Báo Giá' : 
                          status === 'deposit' ? 'Đã cọc' : 'Từ chối'}
                        </button>
                     ))}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupedQuotations.map((group) => {
                    const activeQuotation = getActiveQuotation(group);
                    return (
                      <Card 
                        key={group.phone || group.customerName} 
                        className={cn("rounded-2xl transition-all cursor-pointer hover:scale-[1.01]", getCardStyle(activeQuotation.status))}
                        onClick={() => {
                          setSelectedQuotation(activeQuotation);
                          setIsPreviewOpen(true);
                        }}
                      >
                        <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between space-y-0">
                           <span className="font-mono font-black text-primary bg-primary/5 px-2 py-0.5 rounded-md text-[10px]">{activeQuotation.quotationNumber}</span>
                           {getStatusBadge(activeQuotation.status)}
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                             <div className="flex items-center gap-3 min-w-0 flex-1">
                               <div className={cn(
                                 "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-sm border border-slate-100",
                                 activeQuotation.status === 'accepted' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100/30' :
                                 activeQuotation.status === 'deposit' ? 'bg-purple-50 text-purple-600 border border-purple-100/30' :
                                 activeQuotation.status === 'sent' ? 'bg-blue-50 text-blue-600 border border-blue-100/30' :
                                 activeQuotation.status === 'rejected' ? 'bg-rose-50 text-rose-600 border border-rose-100/30' :
                                 'bg-slate-50 text-slate-600 border border-slate-200/30'
                               )}>
                                 {activeQuotation.customerName ? activeQuotation.customerName.charAt(0).toUpperCase() : 'K'}
                               </div>
                               <div className="min-w-0 flex-1">
                                 <h4 className="font-bold text-base text-slate-850 truncate">{activeQuotation.customerName || 'Khách hàng'}</h4>
                                 <div className="flex items-center gap-2 text-muted-foreground mt-1 text-[10px]">
                                   <span className="flex items-center gap-0.5 font-medium shrink-0">
                                      <Phone className="h-3 w-3" /> {activeQuotation.phone}
                                   </span>
                                   <span>•</span>
                                   <span className="font-medium truncate">
                                      {format(new Date(activeQuotation.createdAt), 'dd/MM/yy')}
                                   </span>
                                 </div>
                               </div>
                             </div>
                             
                             <div className="text-right shrink-0">
                               <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Tổng cộng</p>
                               <p className="font-black text-base md:text-lg tabular-nums text-slate-800">
                                 {(activeQuotation.totalAmount / 1000000).toFixed(1)}M
                               </p>
                               {activeQuotation.status === 'deposit' && activeQuotation.depositAmount && (
                                 <p className="text-[9px] text-purple-600 font-bold mt-0.5">
                                   Cọc: {(activeQuotation.depositAmount / 1000000).toFixed(1)}M
                                 </p>
                               )}
                             </div>
                          </div>

                          {/* Version switcher */}
                          {group.quotations.length > 1 && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100/60 mt-1">
                              <span className="text-[9px] text-muted-foreground font-bold mr-1 uppercase">Bản:</span>
                              {group.quotations.map((q, idx) => {
                                const isActive = q.id === activeQuotation.id;
                                return (
                                  <div 
                                    key={q.id} 
                                    className="inline-flex items-stretch rounded-md overflow-hidden border border-slate-200 shadow-sm"
                                  >
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveQuotationIds(prev => ({ ...prev, [group.phone]: q.id }));
                                      }}
                                      className={cn(
                                        "px-2 py-0.5 text-[9px] font-black cursor-pointer transition-all border-none rounded-none flex items-center",
                                        isActive 
                                          ? "bg-primary text-primary-foreground" 
                                          : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                                      )}
                                    >
                                      Lần {idx + 1}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteQuotation(q.id);
                                      }}
                                      className={cn(
                                        "px-1.5 py-0.5 text-[9px] font-bold cursor-pointer transition-all border-none rounded-none border-l flex items-center justify-center",
                                        isActive 
                                          ? "bg-primary text-primary-foreground/80 hover:bg-red-600 hover:text-white border-primary-foreground/20" 
                                          : "bg-slate-50 text-slate-400 border-slate-200 hover:bg-red-50 hover:text-red-600"
                                      )}
                                      title={`Xóa Lần ${idx + 1}`}
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </CardContent>
                        <div className="p-4 pt-0 flex items-center justify-between border-t border-white/5 pt-3">
                           <div className="flex items-center gap-1">
                             <Button 
                               variant="ghost" 
                               size="sm" 
                               className="h-8 px-2 text-[10px] font-bold text-muted-foreground" 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 handleDuplicate(activeQuotation);
                               }}
                             >
                               <Copy className="h-3.5 w-3.5 mr-1" />
                               Sao chép
                             </Button>
                             <Button 
                               variant="ghost" 
                               size="sm" 
                               className="h-8 px-2 text-[10px] font-bold text-blue-600 hover:bg-blue-50" 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 handleCreateNewVersion(activeQuotation);
                               }}
                             >
                               <Plus className="h-3.5 w-3.5 mr-1" />
                               Bản mới
                             </Button>
                           </div>
                           <div className='flex items-center gap-2'>
                                 <Button 
                                   variant="secondary" 
                                   size="sm" 
                                   className="h-8 px-3 gap-1.5 font-bold text-[10px] rounded-lg"
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     setSelectedQuotation(activeQuotation);
                                     setIsPreviewOpen(true);
                                   }}
                                 >
                                   <Eye className="h-3.5 w-3.5" />
                                   Xem
                                 </Button>
                                 <DropdownMenu>
                                   <DropdownMenuTrigger 
                                     className="h-8 w-8 rounded-lg hover:bg-secondary/50 flex items-center justify-center"
                                     onClick={(e) => e.stopPropagation()}
                                   >
                                       <MoreVertical className="h-4 w-4" />
                                   </DropdownMenuTrigger>
                                   <DropdownMenuContent align="end" className="w-56 p-2 rounded-xl shadow-2xl border-white/10" onClick={(e) => e.stopPropagation()}>
                                     {activeQuotation.status !== 'accepted' && (
                                       <DropdownMenuItem className="py-2.5 rounded-lg gap-3" onClick={() => handleUpdateStatus(activeQuotation.id, 'accepted')}>
                                         <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                         Chốt báo giá
                                       </DropdownMenuItem>
                                     )}
                                     {activeQuotation.status !== 'deposit' && activeQuotation.status !== 'accepted' && (
                                       <DropdownMenuItem className="py-2.5 rounded-lg gap-3" onClick={() => setDepositDialog({ isOpen: true, quotationId: activeQuotation.id, amount: '' })}>
                                         <FileText className="h-4 w-4 text-purple-500" />
                                         Chốt cọc (Một phần)
                                       </DropdownMenuItem>
                                     )}
                                     {activeQuotation.status === 'deposit' && (
                                       <DropdownMenuItem className="py-2.5 rounded-lg gap-3" onClick={() => setDepositDialog({ isOpen: true, quotationId: activeQuotation.id, amount: String(activeQuotation.depositAmount || '') })}>
                                          <FileText className="h-4 w-4 text-purple-500" />
                                          Sửa tiền cọc
                                       </DropdownMenuItem>
                                     )}
                                     {(activeQuotation.status === 'deposit' || activeQuotation.status === 'accepted') && (
                                        <DropdownMenuItem 
                                          className="py-2.5 rounded-lg gap-3 text-blue-600 focus:text-blue-700" 
                                          onClick={() => setPendingDesignTask({
                                            quotationId: activeQuotation.id,
                                            customerId: activeQuotation.customerId || '',
                                            customerName: activeQuotation.customerName || 'Khách lẻ'
                                          })}
                                        >
                                          <Plus className="h-4 w-4 text-blue-500" />
                                          Bàn giao thiết kế
                                        </DropdownMenuItem>
                                      )}
                                      {activeQuotation.status !== 'rejected' && (
                                       <DropdownMenuItem className="py-2.5 rounded-lg gap-3 text-amber-600 focus:text-amber-700" onClick={() => handleUpdateStatus(activeQuotation.id, 'rejected')}>
                                         <XCircle className="h-4 w-4 text-amber-500" />
                                         Từ chối báo giá (Hủy)
                                       </DropdownMenuItem>
                                     )}
                                     {activeQuotation.status === 'draft' && (
                                       <DropdownMenuItem className="py-2.5 rounded-lg gap-3 text-blue-600 focus:text-blue-700" onClick={() => handleUpdateStatus(activeQuotation.id, 'sent')}>
                                         <Clock className="h-4 w-4 text-blue-500" />
                                         Đã gửi khách hàng
                                       </DropdownMenuItem>
                                     )}
                                     {(activeQuotation.status === 'sent' || activeQuotation.status === 'rejected') && (
                                       <DropdownMenuItem className="py-2.5 rounded-lg gap-3 text-gray-600" onClick={() => handleUpdateStatus(activeQuotation.id, 'draft')}>
                                         <Clock className="h-4 w-4 text-gray-500" />
                                         Chuyển thành bản nháp
                                       </DropdownMenuItem>
                                     )}
                                     <DropdownMenuSeparator className="bg-card text-card-foreground/5 my-1" />
                                     <DropdownMenuItem className="py-2.5 rounded-lg gap-3" onClick={() => {
                                       setSelectedQuotation(activeQuotation);
                                       setIsFormOpen(true);
                                     }}>
                                       <FileText className="h-4 w-4 text-blue-500" />
                                       Sửa chi tiết
                                     </DropdownMenuItem>
                                     <DropdownMenuItem className="py-2.5 rounded-lg gap-3" onClick={() => handleDuplicateQuotation(activeQuotation)}>
                                       <Copy className="h-4 w-4 text-emerald-500" />
                                       Nhân bản cho khách mới
                                     </DropdownMenuItem>
                                     <DropdownMenuItem className="py-2.5 rounded-lg gap-3 font-bold text-destructive" onClick={() => handleDeleteQuotation(activeQuotation.id)}>
                                       <Trash2 className="h-4 w-4" />
                                       Xóa hồ sơ
                                     </DropdownMenuItem>
                                   </DropdownMenuContent>
                                 </DropdownMenu>

                           </div>
                        </div>
                      </Card>
                    );
                  })}
                  {groupedQuotations.length === 0 && (
                    <div className="col-span-full h-80 flex flex-col items-center justify-center gap-4 opacity-50 px-8 text-center">
                       <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center">
                          <Search className="h-10 w-10" />
                       </div>
                       <div className="space-y-1">
                         <p className="text-lg font-bold">Không tìm thấy kết quả</p>
                         <p className="text-sm font-medium text-muted-foreground">Thử thay đổi từ khóa hoặc bộ lọc trạng thái</p>
                       </div>
                       <Button variant="outline" size="sm" className="rounded-xl px-6 font-bold" onClick={() => {setSearchTerm(''); setStatusFilter('all')}}>Xóa bộ lọc</Button>
                    </div>
                  )}
              </CardContent>
            </Card>

            {/* Footer Support */}
            <div className="flex items-center justify-center py-6 gap-8 text-center px-4">
               <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-tighter">
                  <Badge variant="outline" className="h-5 rounded-full border-primary/20">TIP</Badge>
                  Sử dụng tính năng "Sao chép" để tạo báo giá cho các căn hộ tương đồng nhanh hơn.
               </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="library"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
          >
            <ProductLibrary 
              products={products} 
              user={user} 
              onSave={handleSaveProduct}
              onDelete={handleDeleteProduct}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isFormOpen && (
          <QuotationForm 
            isOpen={isFormOpen} 
            onClose={() => {
               setIsFormOpen(false);
               setSelectedQuotation(null);
            }} 
            onSubmit={handleCreateQuotation}
            customers={customers}
            initialData={selectedQuotation}
            products={products}
          />
        )}

        {isPreviewOpen && selectedQuotation && (
          <QuotationPreview
            isOpen={isPreviewOpen}
            onClose={() => setIsPreviewOpen(false)}
            quotation={selectedQuotation}
            siblingQuotations={quotations
              .filter(q => {
                if (selectedQuotation.phone && q.phone) {
                  return q.phone === selectedQuotation.phone;
                }
                return q.customerName === selectedQuotation.customerName;
              })
              .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())}
            onSwitchQuotation={(q) => setSelectedQuotation(q)}
            onCreateNewVersion={handleCreateNewVersion}
            member={members.find(m => m.id === selectedQuotation.createdBy)}
            user={user}
            onUpdateStatus={(status) => handleUpdateStatus(selectedQuotation.id, status)}
            onEdit={() => {
              setIsPreviewOpen(false);
              setIsFormOpen(true);
            }}
            onDeleteQuotation={handleDeleteQuotation}
          />
        )}
      </AnimatePresence>

      <Dialog open={!!pendingDesignTask} onOpenChange={(open) => !open && setPendingDesignTask(null)}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Bàn giao thiết kế</DialogTitle>
            <DialogDescription>
              Báo giá đã được chuyển sang trạng thái bắt đầu làm việc. Vui lòng chọn nhân sự thiết kế để tiếp tục quy trình.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Người thiết kế</label>
              <Select value={targetDesignerId} onValueChange={setTargetDesignerId}>
                <SelectTrigger className="w-full h-11 rounded-xl">
                  <SelectValue placeholder="Chọn nhân viên thiết kế..." />
                </SelectTrigger>
                <SelectContent>
                  {members.filter(m => !!(m.role?.toLowerCase()?.includes('thiết kế') || m.role?.toLowerCase()?.includes('design'))).map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name || m.email || 'Nhân viên (Chưa cập nhật tên)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDesignTask(null)}>Bỏ qua</Button>
            <Button onClick={handleCreateDesignTask} disabled={!targetDesignerId}>Giao việc</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={depositDialog.isOpen} onOpenChange={(open) => !open && setDepositDialog({isOpen: false, quotationId: '', amount: ''})}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>{depositDialog.quotationId && quotations.find(q => q.id === depositDialog.quotationId)?.status === 'deposit' ? "Sửa số tiền cọc" : "Nhập số tiền cọc"}</DialogTitle>
            <DialogDescription>
              {depositDialog.quotationId && quotations.find(q => q.id === depositDialog.quotationId)?.status === 'deposit' 
                ? "Nhập số tiền cọc mới cho báo giá này." 
                : "Báo giá sẽ được chuyển sang trạng thái \"Đã cọc\" và nhiệm vụ thiết kế sẽ được khởi tạo."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Số tiền cọc (VNĐ)</label>
              <Input 
                type="number" 
                placeholder="Ví dụ: 10000000"
                value={depositDialog.amount}
                onChange={(e) => setDepositDialog(prev => ({ ...prev, amount: e.target.value }))}
                className="h-11 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDepositDialog({isOpen: false, quotationId: '', amount: ''})}>Hủy</Button>
            <Button onClick={() => {
              if (depositDialog.amount) {
                handleUpdateStatus(depositDialog.quotationId, 'deposit', Number(depositDialog.amount));
                setDepositDialog({isOpen: false, quotationId: '', amount: ''});
              } else {
                toast.error("Vui lòng nhập số tiền cọc");
              }
            }}>{depositDialog.quotationId && quotations.find(q => q.id === depositDialog.quotationId)?.status === 'deposit' ? "Cập nhật" : "Chốt cọc"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
