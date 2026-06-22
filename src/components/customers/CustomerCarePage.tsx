import React, { useState, useMemo } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { Customer, Member } from '@/src/types';
import { db, doc, updateDoc } from '@/src/lib/firebase';
import { CustomerSchema } from '@/src/schemas';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  HeartHandshake, 
  Search, 
  Plus, 
  Phone, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  User, 
  Save, 
  Calendar,
  AlertCircle,
  FileText,
  MessageSquare
} from 'lucide-react';
import { format, parseISO, differenceInDays, addYears, isValid } from 'date-fns';
import { vi } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/src/lib/utils';

interface CustomerCarePageProps {
  customers: Customer[];
  members: Member[];
  currentUser: Member | null;
}

export function CustomerCarePage({ customers, members, currentUser }: CustomerCarePageProps) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expiring' | 'expired'>('all');
  
  // State for adding care log
  const [selectedCustomerForLog, setSelectedCustomerForLog] = useState<Customer | null>(null);
  const [logNote, setLogNote] = useState('');
  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false);

  // State for editing warranty
  const [selectedCustomerForWarranty, setSelectedCustomerForWarranty] = useState<Customer | null>(null);
  const [startDateStr, setStartDateStr] = useState('');
  const [endDateStr, setEndDateStr] = useState('');
  const [isWarrantyDialogOpen, setIsWarrantyDialogOpen] = useState(false);

  // Helpers for dates
  const getWarrantyInfo = (customer: Customer) => {
    // Determine start date
    let start = customer.warrantyStartDate;
    if (!start) {
      if (customer.consultedAt) {
        start = customer.consultedAt.slice(0, 10);
      } else if (customer.createdAt) {
        start = customer.createdAt.slice(0, 10);
      } else {
        start = format(new Date(), 'yyyy-MM-dd');
      }
    }

    // Determine end date (default to 1 year after start date)
    let end = customer.warrantyEndDate;
    if (!end) {
      try {
        const parsedStart = parseISO(start);
        if (isValid(parsedStart)) {
          end = format(addYears(parsedStart, 1), 'yyyy-MM-dd');
        } else {
          end = format(addYears(new Date(), 1), 'yyyy-MM-dd');
        }
      } catch {
        end = format(addYears(new Date(), 1), 'yyyy-MM-dd');
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let parsedEnd: Date;
    try {
      parsedEnd = parseISO(end);
      if (!isValid(parsedEnd)) parsedEnd = today;
    } catch {
      parsedEnd = today;
    }

    let parsedStart: Date;
    try {
      parsedStart = parseISO(start);
      if (!isValid(parsedStart)) parsedStart = today;
    } catch {
      parsedStart = today;
    }

    const totalDays = Math.max(1, differenceInDays(parsedEnd, parsedStart));
    const remainingDays = differenceInDays(parsedEnd, today);
    
    let status: 'active' | 'expiring' | 'expired' = 'active';
    if (remainingDays < 0) {
      status = 'expired';
    } else if (remainingDays <= 30) {
      status = 'expiring';
    }

    const percentRemaining = Math.max(0, Math.min(100, (remainingDays / totalDays) * 100));

    return {
      startDate: start,
      endDate: end,
      remainingDays,
      totalDays,
      percentRemaining,
      status
    };
  };

  // Only display completed customers (completed installation/delivered)
  const completedCustomers = useMemo(() => {
    return customers.filter(c => c.stage === 'completed');
  }, [customers]);

  // Apply search and filter
  const processedCustomers = useMemo(() => {
    return completedCustomers.map(c => {
      const warranty = getWarrantyInfo(c);
      return { ...c, warranty };
    }).filter(c => {
      // Search term
      const matchesSearch = 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone.includes(searchTerm) ||
        c.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.code && c.code.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      // Status filter
      if (statusFilter === 'all') return true;
      return c.warranty.status === statusFilter;
    });
  }, [completedCustomers, searchTerm, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    let active = 0;
    let expiring = 0;
    let expired = 0;

    completedCustomers.forEach(c => {
      const info = getWarrantyInfo(c);
      if (info.status === 'active') active++;
      else if (info.status === 'expiring') expiring++;
      else if (info.status === 'expired') expired++;
    });

    return {
      total: completedCustomers.length,
      active,
      expiring,
      expired
    };
  }, [completedCustomers]);

  // TanStack Query Mutation to Update Customer Care Log or Warranty info
  const updateCustomerMutation = useMutation({
    mutationFn: async (updatedCustomer: Customer) => {
      const customerDoc = doc(db, 'customers', updatedCustomer.id);
      
      // Strict Zod Validation under AGENTS.md rules
      const validated = CustomerSchema.parse(updatedCustomer);
      await updateDoc(customerDoc, validated);
      return validated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (error: any) => {
      toast.error('Lỗi lưu dữ liệu: ' + error.message);
    }
  });

  const handleAddCareLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerForLog) return;
    if (!logNote.trim()) {
      toast.error('Vui lòng nhập nội dung ghi chú.');
      return;
    }

    const newLog = {
      id: crypto.randomUUID(),
      date: format(new Date(), 'yyyy-MM-dd HH:mm'),
      note: logNote.trim(),
      createdBy: currentUser?.id || 'unknown',
      createdByName: currentUser?.name || 'Nhân viên'
    };

    const currentLogs = selectedCustomerForLog.careLogs || [];
    const updatedCustomer: Customer = {
      ...selectedCustomerForLog,
      careLogs: [newLog, ...currentLogs]
    };

    toast.promise(
      updateCustomerMutation.mutateAsync(updatedCustomer),
      {
        loading: 'Đang ghi nhận nhật ký...',
        success: () => {
          setLogNote('');
          setIsLogDialogOpen(false);
          return 'Đã lưu nhật ký chăm sóc khách hàng!';
        },
        error: 'Không thể lưu nhật ký.'
      }
    );
  };

  const handleUpdateWarrantySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerForWarranty) return;
    if (!startDateStr || !endDateStr) {
      toast.error('Vui lòng chọn đầy đủ ngày bắt đầu và kết thúc.');
      return;
    }

    if (new Date(startDateStr) > new Date(endDateStr)) {
      toast.error('Ngày bắt đầu không được lớn hơn ngày kết thúc.');
      return;
    }

    const updatedCustomer: Customer = {
      ...selectedCustomerForWarranty,
      warrantyStartDate: startDateStr,
      warrantyEndDate: endDateStr
    };

    toast.promise(
      updateCustomerMutation.mutateAsync(updatedCustomer),
      {
        loading: 'Đang cập nhật thời hạn bảo hành...',
        success: () => {
          setIsWarrantyDialogOpen(false);
          return 'Đã cập nhật thời hạn bảo hành thành công!';
        },
        error: 'Không thể cập nhật thời hạn bảo hành.'
      }
    );
  };

  const openLogDialog = (customer: Customer) => {
    setSelectedCustomerForLog(customer);
    setLogNote('');
    setIsLogDialogOpen(true);
  };

  const openWarrantyDialog = (customer: Customer) => {
    setSelectedCustomerForWarranty(customer);
    const info = getWarrantyInfo(customer);
    setStartDateStr(info.startDate);
    setEndDateStr(info.endDate);
    setIsWarrantyDialogOpen(true);
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-200">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <HeartHandshake className="h-8 w-8 text-primary" />
            Bảo hành & Chăm sóc Khách hàng
          </h1>
          <p className="text-muted-foreground mt-1">
            Quản lý bảo hành, theo dõi tiến độ hậu mãi và lịch sử liên hệ với khách hàng sau bàn giao.
          </p>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="relative overflow-hidden border-none shadow-md bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Đã bàn giao</p>
                <h3 className="text-3xl font-black mt-2 text-primary">{stats.total}</h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">Tổng số khách hàng đã hoàn thiện thi công</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-none shadow-md bg-gradient-to-br from-emerald-500/10 to-emerald-500/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-emerald-600 uppercase tracking-wider dark:text-emerald-400">Còn bảo hành</p>
                <h3 className="text-3xl font-black mt-2 text-emerald-600 dark:text-emerald-400">{stats.active}</h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                <ShieldAlert className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">Thiết bị/nội thất đang trong hạn bảo hành</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-none shadow-md bg-gradient-to-br from-amber-500/10 to-amber-500/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-amber-600 uppercase tracking-wider dark:text-amber-400">Sắp hết hạn</p>
                <h3 className="text-3xl font-black mt-2 text-amber-600 dark:text-amber-400">{stats.expiring}</h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-500">
                <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">Hết hạn trong vòng 30 ngày (Sale cần liên hệ)</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-none shadow-md bg-gradient-to-br from-rose-500/10 to-rose-500/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-rose-600 uppercase tracking-wider dark:text-rose-400">Đã hết hạn</p>
                <h3 className="text-3xl font-black mt-2 text-rose-600 dark:text-rose-400">{stats.expired}</h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 flex items-center justify-center text-rose-500">
                <AlertCircle className="h-6 w-6 text-rose-600 dark:text-rose-400" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">Khách hàng đã bàn giao trên 1 năm/hết hạn</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="border border-border shadow-sm">
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm theo tên, sđt, địa chỉ, mã khách hàng..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full bg-white"
            />
          </div>
          <div className="flex gap-2 bg-secondary/50 p-1.5 rounded-xl border border-secondary self-start md:self-auto overflow-x-auto max-w-full">
            <Button
              variant={statusFilter === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter('all')}
              className="rounded-lg text-xs"
            >
              Tất cả ({completedCustomers.length})
            </Button>
            <Button
              variant={statusFilter === 'active' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter('active')}
              className="rounded-lg text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
            >
              Còn bảo hành ({stats.active})
            </Button>
            <Button
              variant={statusFilter === 'expiring' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter('expiring')}
              className="rounded-lg text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
            >
              Sắp hết hạn ({stats.expiring})
            </Button>
            <Button
              variant={statusFilter === 'expired' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter('expired')}
              className="rounded-lg text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 dark:text-rose-400"
            >
              Đã hết hạn ({stats.expired})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Customer Grid */}
      {processedCustomers.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-card border border-dashed border-muted-foreground/20 rounded-2xl">
          <HeartHandshake className="h-16 w-16 text-muted-foreground/30 mb-4 animate-pulse" />
          <h3 className="text-lg font-bold">Không tìm thấy khách hàng nào</h3>
          <p className="text-muted-foreground text-sm mt-1 max-w-md">
            Không có khách hàng hoàn thành nào khớp với bộ lọc tìm kiếm hiện tại của bạn.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {processedCustomers.map((customer) => {
            const lastLog = customer.careLogs && customer.careLogs.length > 0 ? customer.careLogs[0] : null;
            return (
              <Card key={customer.id} className="group border border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 flex flex-col justify-between overflow-hidden">
                <div>
                  {/* Card Header Banner */}
                  <div className="p-5 border-b border-border bg-secondary/10 flex justify-between items-start gap-2">
                    <div>
                      <span className="text-[10px] font-extrabold tracking-widest text-primary uppercase bg-primary/10 px-2 py-0.5 rounded-md">
                        {customer.code || 'KHÁCH HÀNG'}
                      </span>
                      <h4 className="text-base font-bold text-foreground mt-1.5 group-hover:text-primary transition-colors line-clamp-1">
                        {customer.name}
                      </h4>
                    </div>
                    {customer.warranty.status === 'active' && (
                      <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 border border-emerald-500/20 font-semibold gap-1 py-1 px-2.5">
                        <CheckCircle2 className="h-3 w-3" /> Còn bảo hành
                      </Badge>
                    )}
                    {customer.warranty.status === 'expiring' && (
                      <Badge className="bg-amber-500/15 text-amber-600 hover:bg-amber-500/25 border border-amber-500/20 font-semibold gap-1 py-1 px-2.5 animate-pulse">
                        <Clock className="h-3 w-3" /> Sắp hết hạn
                      </Badge>
                    )}
                    {customer.warranty.status === 'expired' && (
                      <Badge className="bg-rose-500/15 text-rose-600 hover:bg-rose-500/25 border border-rose-500/20 font-semibold gap-1 py-1 px-2.5">
                        <AlertCircle className="h-3 w-3" /> Hết bảo hành
                      </Badge>
                    )}
                  </div>

                  {/* Card Body */}
                  <div className="p-5 space-y-4 flex-1">
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center text-muted-foreground gap-2">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span>{customer.phone}</span>
                      </div>
                      <div className="flex items-start text-muted-foreground gap-2 mt-1">
                        <User className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span className="line-clamp-1">{customer.address}</span>
                      </div>
                    </div>

                    {/* Warranty Progress */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          Hạn bảo hành
                        </span>
                        <span className={
                          customer.warranty.status === 'expired' ? 'text-rose-600 font-bold' :
                          customer.warranty.status === 'expiring' ? 'text-amber-600 font-bold' :
                          'text-emerald-600'
                        }>
                          {customer.warranty.status === 'expired' 
                            ? 'Trễ ' + Math.abs(customer.warranty.remainingDays) + ' ngày' 
                            : 'Còn ' + customer.warranty.remainingDays + ' ngày'}
                        </span>
                      </div>
                      
                      {/* Bar */}
                      <div className="w-full h-2.5 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full transition-all duration-300",
                            customer.warranty.status === 'active' ? 'bg-emerald-500' :
                            customer.warranty.status === 'expiring' ? 'bg-amber-500' : 'bg-rose-400'
                          )}
                          style={{ width: `${customer.warranty.percentRemaining}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-muted-foreground font-medium pt-0.5">
                        <span>Bắt đầu: {format(parseISO(customer.warranty.startDate), 'dd/MM/yyyy')}</span>
                        <span>Kết thúc: {format(parseISO(customer.warranty.endDate), 'dd/MM/yyyy')}</span>
                      </div>
                    </div>

                    {/* Last Care Note */}
                    <div className="border-t border-border/80 pt-3 mt-1">
                      <div className="text-xs font-bold text-muted-foreground flex items-center gap-1 mb-1.5">
                        <MessageSquare className="h-3.5 w-3.5 text-primary" />
                        Nhật ký gọi điện gần nhất:
                      </div>
                      {lastLog ? (
                        <div className="bg-secondary/40 rounded-lg p-2.5 space-y-1 text-xs">
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span className="font-semibold flex items-center gap-1">
                              <User className="h-3 w-3" /> {lastLog.createdByName || 'Nhân viên'}
                            </span>
                            <span>{lastLog.date}</span>
                          </div>
                          <p className="text-muted-foreground line-clamp-2 italic">"{lastLog.note}"</p>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground/60 italic">Chưa có lịch sử chăm sóc sau bàn giao.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="p-4 border-t border-border bg-secondary/10 flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => openWarrantyDialog(customer)}
                    className="flex-1 bg-white hover:bg-secondary text-xs h-9 rounded-lg"
                  >
                    <Calendar className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                    Cài đặt hạn
                  </Button>
                  <Button 
                    variant="default" 
                    size="sm" 
                    onClick={() => openLogDialog(customer)}
                    className="flex-1 text-xs h-9 rounded-lg shadow-sm"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Chăm sóc
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Log Dialog (Add Care Note and Timeline) */}
      <Dialog open={isLogDialogOpen} onOpenChange={setIsLogDialogOpen}>
        <DialogContent className="max-w-2xl bg-white max-h-[85vh] flex flex-col p-0 border border-border">
          <DialogHeader className="p-6 pb-2 border-b border-border">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <HeartHandshake className="h-5 w-5 text-primary" />
              Chăm sóc khách hàng: {selectedCustomerForLog?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Care logs timeline */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-foreground">Lịch sử chăm sóc ({selectedCustomerForLog?.careLogs?.length || 0})</h4>
              {selectedCustomerForLog?.careLogs && selectedCustomerForLog.careLogs.length > 0 ? (
                <div className="relative border-l border-border pl-4 ml-2 space-y-5">
                  {selectedCustomerForLog.careLogs.map((log) => (
                    <div key={log.id} className="relative">
                      {/* Timeline dot */}
                      <span className="absolute -left-[21px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white bg-primary shadow-sm" />
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-foreground flex items-center gap-1">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            {log.createdByName || 'Người tạo'}
                          </span>
                          <span className="text-muted-foreground">{log.date}</span>
                        </div>
                        <div className="bg-secondary/40 rounded-xl p-3 border border-secondary/20">
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{log.note}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 bg-secondary/10 rounded-xl text-center">
                  <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground italic">Chưa có nhật ký chăm sóc khách hàng.</p>
                </div>
              )}
            </div>

            {/* Add note form */}
            <form onSubmit={handleAddCareLogSubmit} className="space-y-3 pt-4 border-t border-border">
              <div className="space-y-1.5">
                <Label htmlFor="careNote" className="text-sm font-bold text-foreground">Thêm ghi chú chăm sóc mới</Label>
                <Textarea
                  id="careNote"
                  placeholder="Ghi chú nội dung cuộc gọi hỏi thăm (ví dụ: khách rất hài lòng với tủ bếp nhựa, bản lề dùng êm, chưa cần sửa chữa...)"
                  value={logNote}
                  onChange={(e) => setLogNote(e.target.value)}
                  className="min-h-[100px] resize-none bg-white border border-border"
                />
              </div>
              <DialogFooter className="pt-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsLogDialogOpen(false)} className="bg-white">
                  Đóng
                </Button>
                <Button type="submit" className="gap-1.5 bg-primary hover:bg-primary/95 text-white">
                  <Save className="h-4 w-4" />
                  Lưu Ghi Chú
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Warranty Dialog (Edit warranty period) */}
      <Dialog open={isWarrantyDialogOpen} onOpenChange={setIsWarrantyDialogOpen}>
        <DialogContent className="max-w-md bg-white p-6 border border-border">
          <DialogHeader className="pb-3 border-b border-border">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Thiết lập thời hạn bảo hành
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleUpdateWarrantySubmit} className="space-y-4 pt-4">
            <div className="space-y-1">
              <Label className="text-sm font-bold text-foreground">Khách hàng</Label>
              <Input value={selectedCustomerForWarranty?.name || ''} disabled className="bg-secondary/40 text-muted-foreground border-border" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-bold text-foreground">Ngày bắt đầu bảo hành</Label>
              <DatePicker
                value={startDateStr}
                onChange={setStartDateStr}
              />
              <p className="text-[10px] text-muted-foreground">Thường là ngày nghiệm thu công trình/bàn giao.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-bold text-foreground">Ngày kết thúc bảo hành</Label>
              <DatePicker
                value={endDateStr}
                onChange={setEndDateStr}
              />
              <p className="text-[10px] text-muted-foreground">Mặc định là 1 năm từ khi bắt đầu bảo hành.</p>
            </div>

            <DialogFooter className="pt-4 border-t border-border flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsWarrantyDialogOpen(false)} className="bg-white">
                Hủy
              </Button>
              <Button type="submit" className="gap-1.5 bg-primary hover:bg-primary/95 text-white">
                <Save className="h-4 w-4" />
                Cập Nhật
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
