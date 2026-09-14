import * as React from 'react';
import * as XLSX from 'xlsx';
import { 
  FinancialTransaction, 
  FinancialTransactionType, 
  Customer, 
  Member, 
  WORKSHOPS, 
  getWorkshopName 
} from '@/src/types';
import { 
  subscribeFinancialTransactions, 
  addFinancialTransaction, 
  updateFinancialTransaction, 
  deleteFinancialTransaction 
} from '@/src/services/financialService';
import { uploadToImgBB } from '@/src/services/uploadService';
import { formatCurrency } from '@/src/lib/utils';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  PlusCircle,
  Search,
  Filter,
  Download,
  Camera,
  Upload,
  X,
  Edit2,
  Trash2,
  Eye,
  Calendar,
  Building2,
  CreditCard,
  UserCheck,
  CheckCircle2,
  Loader2,
  Image as ImageIcon,
  ArrowUpRight,
  ArrowDownLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORY_OPTIONS = [
  'Thanh toán hợp đồng',
  'Tạm ứng',
  'Mua vật tư & phụ kiện',
  'Chi phí xưởng & sản xuất',
  'Lương & Thưởng',
  'Chi phí thi công - vận chuyển',
  'Điện nước & Mặt bằng',
  'Tiếp khách & Văn phòng',
  'Marketing & Quảng cáo',
  'Khác'
];

interface FinancialPageProps {
  customers?: Customer[];
  members?: Member[];
  currentUser?: Member | null;
}

export function FinancialPage({ customers = [], members = [], currentUser }: FinancialPageProps) {
  const [transactions, setTransactions] = React.useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState<'all' | 'income' | 'expense'>('all');
  const [categoryFilter, setCategoryFilter] = React.useState<string>('all');
  const [workshopFilter, setWorkshopFilter] = React.useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = React.useState<'all' | 'today' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [customStartDate, setCustomStartDate] = React.useState('');
  const [customEndDate, setCustomEndDate] = React.useState('');

  // Modal Form state
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingTransaction, setEditingTransaction] = React.useState<FinancialTransaction | null>(null);

  // Form Fields
  const [formType, setFormType] = React.useState<FinancialTransactionType>('expense');
  const [formTitle, setFormTitle] = React.useState('');
  const [formAmount, setFormAmount] = React.useState<string>('');
  const [formDate, setFormDate] = React.useState<string>(() => new Date().toISOString().split('T')[0]);
  const [formCategory, setFormCategory] = React.useState('Khác');
  const [customCategoryInput, setCustomCategoryInput] = React.useState('');
  const [formPaymentMethod, setFormPaymentMethod] = React.useState<'cash' | 'transfer' | 'other'>('transfer');
  const [formPayerPayee, setFormPayerPayee] = React.useState('');
  const [formCustomerId, setFormCustomerId] = React.useState<string>('none');
  const [formWorkshop, setFormWorkshop] = React.useState<string>('Hà Nội');
  const [formImageUrls, setFormImageUrls] = React.useState<string[]>([]);
  const [formNotes, setFormNotes] = React.useState('');
  const [isUploading, setIsUploading] = React.useState(false);

  // Detail & Preview Image Modal
  const [previewImage, setPreviewImage] = React.useState<string | null>(null);
  const [detailTransaction, setDetailTransaction] = React.useState<FinancialTransaction | null>(null);

  // Subscribe realtime data
  React.useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeFinancialTransactions((data) => {
      setTransactions(data);
      setLoading(false);
    }, (err) => {
      console.error("Firestore subscription error:", err);
      toast.error("Lỗi tải dữ liệu thu chi từ máy chủ");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filter transactions
  const filteredTransactions = React.useMemo(() => {
    return transactions.filter(t => {
      // Type filter
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;

      // Category filter
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;

      // Workshop filter
      if (workshopFilter !== 'all' && t.workshop !== workshopFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = t.title?.toLowerCase().includes(q);
        const matchesCategory = t.category?.toLowerCase().includes(q);
        const matchesPayer = t.payerPayee?.toLowerCase().includes(q);
        const matchesCustomer = t.customerName?.toLowerCase().includes(q);
        const matchesNote = t.notes?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesCategory && !matchesPayer && !matchesCustomer && !matchesNote) {
          return false;
        }
      }

      // Date Range Filter
      if (t.date) {
        const tDate = new Date(t.date);
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        if (dateRangeFilter === 'today') {
          if (t.date !== todayStr) return false;
        } else if (dateRangeFilter === 'week') {
          const firstDayOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)));
          firstDayOfWeek.setHours(0, 0, 0, 0);
          if (tDate < firstDayOfWeek) return false;
        } else if (dateRangeFilter === 'month') {
          const currentYear = new Date().getFullYear();
          const currentMonth = new Date().getMonth();
          if (tDate.getFullYear() !== currentYear || tDate.getMonth() !== currentMonth) return false;
        } else if (dateRangeFilter === 'year') {
          const currentYear = new Date().getFullYear();
          if (tDate.getFullYear() !== currentYear) return false;
        } else if (dateRangeFilter === 'custom') {
          if (customStartDate && t.date < customStartDate) return false;
          if (customEndDate && t.date > customEndDate) return false;
        }
      }

      return true;
    });
  }, [transactions, typeFilter, categoryFilter, workshopFilter, searchQuery, dateRangeFilter, customStartDate, customEndDate]);

  // Statistics calculation
  const totalIncome = React.useMemo(() => {
    return filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  }, [filteredTransactions]);

  const totalExpense = React.useMemo(() => {
    return filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  }, [filteredTransactions]);

  const netBalance = totalIncome - totalExpense;

  // Open modal for Create
  const handleOpenCreateModal = (type: FinancialTransactionType = 'expense') => {
    setEditingTransaction(null);
    setFormType(type);
    setFormTitle('');
    setFormAmount('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormCategory(type === 'income' ? 'Thanh toán hợp đồng' : 'Mua vật tư & phụ kiện');
    setCustomCategoryInput('');
    setFormPaymentMethod('transfer');
    setFormPayerPayee('');
    setFormCustomerId('none');
    setFormWorkshop(currentUser?.workshop || 'Hà Nội');
    setFormImageUrls([]);
    setFormNotes('');
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEditModal = (t: FinancialTransaction) => {
    setEditingTransaction(t);
    setFormType(t.type);
    setFormTitle(t.title || '');
    setFormAmount(t.amount ? String(t.amount) : '');
    setFormDate(t.date || new Date().toISOString().split('T')[0]);
    setFormCategory(CATEGORY_OPTIONS.includes(t.category) ? t.category : 'Khác');
    if (!CATEGORY_OPTIONS.includes(t.category) && t.category !== 'Khác') {
      setCustomCategoryInput(t.category);
    } else {
      setCustomCategoryInput('');
    }
    setFormPaymentMethod(t.paymentMethod || 'transfer');
    setFormPayerPayee(t.payerPayee || '');
    setFormCustomerId(t.customerId || 'none');
    setFormWorkshop(t.workshop || 'Hà Nội');

    // Combine imageUrl and imageUrls
    const images: string[] = [];
    if (t.imageUrl) images.push(t.imageUrl);
    if (t.imageUrls && Array.isArray(t.imageUrls)) {
      t.imageUrls.forEach(url => {
        if (url && !images.includes(url)) images.push(url);
      });
    }
    setFormImageUrls(images);
    setFormNotes(t.notes || '');
    setIsModalOpen(true);
  };

  // Handle image upload from camera or file picker
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    const toastId = toast.loading("Đang nén và tải ảnh phiếu chi lên máy chủ...");

    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const url = await uploadToImgBB(file, `PHIEU_${formType.toUpperCase()}_${Date.now()}`);
        if (url) {
          uploadedUrls.push(url);
        }
      }

      if (uploadedUrls.length > 0) {
        setFormImageUrls(prev => [...prev, ...uploadedUrls]);
        toast.success(`Đã tải lên ${uploadedUrls.length} ảnh chứng từ thành công!`, { id: toastId });
      } else {
        toast.error("Không thể tải ảnh lên. Vui lòng kiểm tra cấu hình ImgBB.", { id: toastId });
      }
    } catch (err) {
      console.error("Error uploading photo:", err);
      toast.error("Xảy ra lỗi trong quá trình tải ảnh.", { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  // Remove photo from form
  const handleRemovePhoto = (indexToRemove: number) => {
    setFormImageUrls(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Submit Save Transaction
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.error("Vui lòng nhập tên khoản thu chi / nội dung phiếu");
      return;
    }

    const numAmount = parseFloat(formAmount.replace(/[^0-9.]/g, ''));
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Vui lòng nhập số tiền hợp lệ lớn hơn 0");
      return;
    }

    const finalCategory = formCategory === 'Khác' && customCategoryInput.trim() 
      ? customCategoryInput.trim() 
      : formCategory;

    const selectedCust = customers.find(c => c.id === formCustomerId);

    const payload: Omit<FinancialTransaction, 'id'> = {
      type: formType,
      title: formTitle.trim(),
      amount: numAmount,
      date: formDate,
      category: finalCategory,
      paymentMethod: formPaymentMethod,
      payerPayee: formPayerPayee.trim(),
      customerId: formCustomerId !== 'none' ? formCustomerId : undefined,
      customerName: selectedCust ? selectedCust.name : undefined,
      workshop: formWorkshop,
      imageUrl: formImageUrls.length > 0 ? formImageUrls[0] : '',
      imageUrls: formImageUrls,
      notes: formNotes.trim(),
      createdBy: currentUser?.name || 'Hệ thống',
      createdById: currentUser?.id,
      createdAt: editingTransaction?.createdAt || new Date().toISOString()
    };

    try {
      if (editingTransaction) {
        await updateFinancialTransaction(editingTransaction.id, payload);
        toast.success("Cập nhật phiếu thành công!");
      } else {
        await addFinancialTransaction(payload);
        toast.success(`Tạo phiếu ${formType === 'income' ? 'Thu' : 'Chi'} thành công!`);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error saving transaction:", error);
      toast.error("Lỗi khi lưu phiếu thu chi!");
    }
  };

  // Delete transaction
  const handleDeleteTransaction = async (t: FinancialTransaction) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa phiếu "${t.title}" số tiền ${formatCurrency(t.amount)}?`)) {
      try {
        await deleteFinancialTransaction(t.id, t.title, currentUser?.name);
        toast.success("Đã xóa phiếu thu chi (đã chuyển vào Thùng rác)");
      } catch (error) {
        console.error("Error deleting transaction:", error);
        toast.error("Không thể xóa phiếu");
      }
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredTransactions.length === 0) {
      toast.error("Không có dữ liệu để xuất Excel");
      return;
    }

    const dataToExport = filteredTransactions.map((t, idx) => ({
      'STT': idx + 1,
      'Ngày chứng từ': t.date,
      'Loại phiếu': t.type === 'income' ? 'THU' : 'CHI',
      'Tên khoản / Nội dung': t.title,
      'Số tiền (VNĐ)': t.amount,
      'Hạng mục': t.category,
      'Hình thức TT': t.paymentMethod === 'cash' ? 'Tiền mặt' : t.paymentMethod === 'transfer' ? 'Chuyển khoản' : 'Khác',
      'Người nộp / nhận': t.payerPayee || '',
      'Khách hàng': t.customerName || '',
      'Cơ sở': t.workshop || '',
      'Link ảnh chứng từ': t.imageUrl || (t.imageUrls && t.imageUrls.length > 0 ? t.imageUrls[0] : ''),
      'Ghi chú': t.notes || '',
      'Người lập': t.createdBy || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "So_Thu_Chi");

    // Format header column widths
    const colWidths = [
      { wch: 6 },
      { wch: 14 },
      { wch: 10 },
      { wch: 30 },
      { wch: 18 },
      { wch: 22 },
      { wch: 16 },
      { wch: 22 },
      { wch: 22 },
      { wch: 14 },
      { wch: 35 },
      { wch: 25 },
      { wch: 18 }
    ];
    worksheet['!cols'] = colWidths;

    const fileName = `So_Thu_Chi_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast.success(`Đã xuất báo cáo ${fileName}`);
  };

  return (
    <div className="space-y-6 pb-20 p-2 md:p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-primary/10 via-background to-background p-4 md:p-6 rounded-2xl border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Receipt className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Sổ Quỹ Thu Chi</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Quản lý dòng tiền thu chi, hóa đơn chứng từ, nộp/nhận tiền mặt và chuyển khoản
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button 
            onClick={() => handleOpenCreateModal('income')} 
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Tạo phiếu Thu</span>
          </Button>

          <Button 
            onClick={() => handleOpenCreateModal('expense')} 
            variant="destructive"
            className="shadow-sm flex items-center gap-1.5"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Tạo phiếu Chi</span>
          </Button>

          <Button 
            variant="outline" 
            onClick={handleExportExcel}
            className="flex items-center gap-1.5"
          >
            <Download className="h-4 w-4 text-primary" />
            <span>Xuất Excel</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Income */}
        <Card className="border border-emerald-500/20 bg-emerald-500/5 shadow-xs relative overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Tổng Thu
              </span>
              <div className="p-2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <ArrowDownLeft className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
                {formatCurrency(totalIncome)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Thu trong kỳ (đã lọc)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Total Expense */}
        <Card className="border border-rose-500/20 bg-rose-500/5 shadow-xs relative overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                Tổng Chi
              </span>
              <div className="p-2 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <ArrowUpRight className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-black text-rose-700 dark:text-rose-400">
                {formatCurrency(totalExpense)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Chi trong kỳ (đã lọc)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Net Balance */}
        <Card className={`border shadow-xs relative overflow-hidden ${
          netBalance >= 0 
            ? 'border-blue-500/20 bg-blue-500/5' 
            : 'border-amber-500/20 bg-amber-500/5'
        }`}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                Tồn Quỹ / Số Dư
              </span>
              <div className="p-2 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Wallet className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-2">
              <div className={`text-2xl font-black ${
                netBalance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'
              }`}>
                {formatCurrency(netBalance)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Hiệu số = Thu - Chi
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Total Records */}
        <Card className="border border-purple-500/20 bg-purple-500/5 shadow-xs relative overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-400">
                Chứng Từ Thu Chi
              </span>
              <div className="p-2 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Receipt className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-black text-purple-700 dark:text-purple-400">
                {filteredTransactions.length} <span className="text-sm font-normal text-muted-foreground">phiếu</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Đã ghi nhận trong kỳ
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar & Filters */}
      <Card className="shadow-xs border-border">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {/* Search */}
            <div className="sm:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm tên, người nộp/nhận, ghi chú..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            {/* Type filter */}
            <div>
              <Select value={typeFilter} onValueChange={(val: any) => setTypeFilter(val)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Loại phiếu" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả loại (Thu & Chi)</SelectItem>
                  <SelectItem value="income">🟢 Phiếu Thu</SelectItem>
                  <SelectItem value="expense">🔴 Phiếu Chi</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Time filter */}
            <div>
              <Select value={dateRangeFilter} onValueChange={(val: any) => setDateRangeFilter(val)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Thời gian" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Tháng này</SelectItem>
                  <SelectItem value="today">Hôm nay</SelectItem>
                  <SelectItem value="week">Tuần này</SelectItem>
                  <SelectItem value="year">Năm nay</SelectItem>
                  <SelectItem value="all">Tất cả thời gian</SelectItem>
                  <SelectItem value="custom">Tùy chọn ngày</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Category filter */}
            <div>
              <Select value={categoryFilter} onValueChange={(val: any) => setCategoryFilter(val)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Hạng mục" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả hạng mục</SelectItem>
                  {CATEGORY_OPTIONS.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Workshop filter */}
            <div>
              <Select value={workshopFilter} onValueChange={(val: any) => setWorkshopFilter(val)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Cơ sở / Xưởng" />
                </SelectTrigger>
                <SelectContent>
                  {WORKSHOPS.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Custom Date Range Picker */}
          {dateRangeFilter === 'custom' && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/50 text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Từ ngày:</span>
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="h-8 w-auto"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Đến ngày:</span>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="h-8 w-auto"
                />
              </div>
              {(customStartDate || customEndDate) && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => { setCustomStartDate(''); setCustomEndDate(''); }}
                  className="h-8 text-xs"
                >
                  Xóa bộ lọc ngày
                </Button>
              )}
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Main Transactions List / Table */}
      <Card className="shadow-xs border-border overflow-hidden">
        <CardHeader className="py-4 px-6 border-b border-border flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Danh Sách Phiếu Thu Chi</CardTitle>
            <CardDescription className="text-xs">
              Hiển thị {filteredTransactions.length} chứng từ phù hợp
            </CardDescription>
          </div>
        </CardHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Đang tải dữ liệu thu chi...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-16 px-4">
            <Receipt className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-base font-medium text-foreground">Chưa có phiếu thu chi nào</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Không tìm thấy chứng từ thu chi phù hợp với bộ lọc. Hãy bấm nút "Tạo phiếu Thu" hoặc "Tạo phiếu Chi" để ghi nhận.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-muted/50 text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-3 font-semibold">Loại</th>
                  <th className="px-4 py-3 font-semibold">Tên khoản / Nội dung</th>
                  <th className="px-4 py-3 font-semibold text-right">Số tiền (VNĐ)</th>
                  <th className="px-4 py-3 font-semibold">Ngày C.Từ</th>
                  <th className="px-4 py-3 font-semibold">Hạng mục</th>
                  <th className="px-4 py-3 font-semibold">Hình thức</th>
                  <th className="px-4 py-3 font-semibold">Người nộp/nhận</th>
                  <th className="px-4 py-3 font-semibold text-center">Ảnh chứng từ</th>
                  <th className="px-4 py-3 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTransactions.map((t) => {
                  const images = t.imageUrls && t.imageUrls.length > 0 
                    ? t.imageUrls 
                    : (t.imageUrl ? [t.imageUrl] : []);

                  return (
                    <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                      {/* Type Badge */}
                      <td className="px-4 py-3">
                        {t.type === 'income' ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 font-medium">
                            🟢 THU
                          </Badge>
                        ) : (
                          <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 hover:bg-rose-500/20 font-medium">
                            🔴 CHI
                          </Badge>
                        )}
                      </td>

                      {/* Title & Notes */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground">{t.title}</div>
                        {t.customerName && (
                          <span className="text-xs text-primary block mt-0.5">
                            Khách: {t.customerName}
                          </span>
                        )}
                        {t.notes && (
                          <p className="text-xs text-muted-foreground line-clamp-1 italic mt-0.5">
                            {t.notes}
                          </p>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3 text-right font-black">
                        <span className={t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                          {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground font-medium">
                        {t.date}
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs font-normal bg-background">
                          {t.category}
                        </Badge>
                      </td>

                      {/* Payment Method */}
                      <td className="px-4 py-3 whitespace-nowrap text-xs">
                        {t.paymentMethod === 'cash' ? (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                            💵 Tiền mặt
                          </span>
                        ) : t.paymentMethod === 'transfer' ? (
                          <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                            🏦 C.Khoản
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Khác</span>
                        )}
                      </td>

                      {/* Payer / Payee */}
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {t.payerPayee || '—'}
                      </td>

                      {/* Receipt Image Thumbnail */}
                      <td className="px-4 py-3 text-center">
                        {images.length > 0 ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setPreviewImage(images[0])}
                              className="relative group w-10 h-10 rounded-lg overflow-hidden border border-border shadow-2xs hover:ring-2 hover:ring-primary transition-all"
                            >
                              <img 
                                src={images[0]} 
                                alt="Chứng từ" 
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform" 
                              />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                                <Eye className="h-3.5 w-3.5" />
                              </div>
                            </button>
                            {images.length > 1 && (
                              <span className="text-[10px] font-bold bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                                +{images.length - 1}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/50 font-normal">Chưa có</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Xem chi tiết"
                            onClick={() => setDetailTransaction(t)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                            title="Sửa phiếu"
                            onClick={() => handleOpenEditModal(t)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Xóa phiếu"
                            onClick={() => handleDeleteTransaction(t)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* CREATE / EDIT TRANSACTION MODAL */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              <span>{editingTransaction ? 'Chỉnh Sửa Phiếu Thu Chi' : 'Tạo Phiếu Thu Chi Mới'}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Nhập thông tin chứng từ, số tiền, hạng mục và tải/chụp ảnh phiếu thu chi
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitForm} className="space-y-4 mt-2">
            {/* Type selector tabs */}
            <div className="grid grid-cols-2 gap-3 p-1 bg-muted rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setFormType('income');
                  if (formCategory === 'Mua vật tư & phụ kiện' || formCategory === 'Chi phí xưởng & sản xuất') {
                    setFormCategory('Thanh toán hợp đồng');
                  }
                }}
                className={`py-2.5 px-4 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                  formType === 'income' 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ArrowDownLeft className="h-4 w-4" />
                <span>PHIẾU THU TIỀN</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFormType('expense');
                  if (formCategory === 'Thanh toán hợp đồng') {
                    setFormCategory('Mua vật tư & phụ kiện');
                  }
                }}
                className={`py-2.5 px-4 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                  formType === 'expense' 
                    ? 'bg-rose-600 text-white shadow-md' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ArrowUpRight className="h-4 w-4" />
                <span>PHIẾU CHI TIỀN</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Title / Content */}
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="font-semibold text-xs">
                  Tên khoản / Nội dung thu chi <span className="text-destructive">*</span>
                </Label>
                <Input
                  required
                  placeholder={formType === 'income' ? 'Ví dụ: Thu tiền cọc đơn hàng tủ bếp KH Anh Nam' : 'Ví dụ: Chi mua bản lề Hafele xưởng 1'}
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>

              {/* Amount */}
              <div className="space-y-1.5">
                <Label className="font-semibold text-xs">
                  Số tiền (VNĐ) <span className="text-destructive">*</span>
                </Label>
                <Input
                  required
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="0"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="font-bold text-base"
                />
                {formAmount && !isNaN(parseFloat(formAmount)) && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                    = {formatCurrency(parseFloat(formAmount))}
                  </p>
                )}
              </div>

              {/* Date */}
              <div className="space-y-1.5">
                <Label className="font-semibold text-xs">Ngày phát sinh chứng từ</Label>
                <Input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                />
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <Label className="font-semibold text-xs">Hạng mục</Label>
                <Select value={formCategory} onValueChange={(val) => setFormCategory(val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn hạng mục" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formCategory === 'Khác' && (
                  <Input
                    placeholder="Nhập tên hạng mục khác..."
                    value={customCategoryInput}
                    onChange={(e) => setCustomCategoryInput(e.target.value)}
                    className="mt-1"
                  />
                )}
              </div>

              {/* Payment Method */}
              <div className="space-y-1.5">
                <Label className="font-semibold text-xs">Hình thức thanh toán</Label>
                <Select 
                  value={formPaymentMethod} 
                  onValueChange={(val: any) => setFormPaymentMethod(val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transfer">🏦 Chuyển khoản ngân hàng</SelectItem>
                    <SelectItem value="cash">💵 Tiền mặt</SelectItem>
                    <SelectItem value="other">Ví điện tử / Khác</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Payer / Payee */}
              <div className="space-y-1.5">
                <Label className="font-semibold text-xs">
                  {formType === 'income' ? 'Người nộp tiền' : 'Người nhận tiền / Đơn vị bán'}
                </Label>
                <Input
                  placeholder={formType === 'income' ? 'Tên người nộp' : 'Tên người nhận tiền'}
                  value={formPayerPayee}
                  onChange={(e) => setFormPayerPayee(e.target.value)}
                />
              </div>

              {/* Customer Association */}
              <div className="space-y-1.5">
                <Label className="font-semibold text-xs">Khách hàng liên quan (nếu có)</Label>
                <Select value={formCustomerId} onValueChange={(val) => setFormCustomerId(val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn khách hàng" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Không chọn --</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Workshop */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="font-semibold text-xs">Cơ sở / Xưởng thực hiện</Label>
                <Select value={formWorkshop} onValueChange={(val) => setFormWorkshop(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WORKSHOPS.filter(w => w.id !== 'all').map((w) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* IMAGE / CAMERA UPLOAD SECTION */}
              <div className="sm:col-span-2 space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold text-xs flex items-center gap-1.5">
                    <Camera className="h-4 w-4 text-primary" />
                    <span>Ảnh Phiếu Chi / Chứng Từ Hóa Đơn</span>
                  </Label>
                  <span className="text-[11px] text-muted-foreground">Tự động nén & lưu ảnh</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Camera capture input button */}
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      disabled={isUploading}
                      onChange={(e) => handleFileUpload(e.target.files)}
                      className="hidden"
                    />
                    <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-medium text-xs border border-primary/20 transition-colors">
                      <Camera className="h-4 w-4" />
                      <span>Chụp ảnh phiếu</span>
                    </div>
                  </label>

                  {/* Device upload button */}
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={isUploading}
                      onChange={(e) => handleFileUpload(e.target.files)}
                      className="hidden"
                    />
                    <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground font-medium text-xs border border-border transition-colors">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                      <span>Chọn ảnh từ máy</span>
                    </div>
                  </label>

                  {isUploading && (
                    <div className="flex items-center gap-2 text-xs text-primary font-medium">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Đang nén & tải ảnh...</span>
                    </div>
                  )}
                </div>

                {/* Uploaded Photos Thumbnails Preview */}
                {formImageUrls.length > 0 && (
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    {formImageUrls.map((url, idx) => (
                      <div key={idx} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-border shadow-xs">
                        <img 
                          src={url} 
                          alt={`Ảnh chứng từ ${idx + 1}`} 
                          className="w-full h-full object-cover" 
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity">
                          <button
                            type="button"
                            onClick={() => setPreviewImage(url)}
                            className="p-1 rounded-full bg-white/80 text-black hover:bg-white"
                            title="Phóng to"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(idx)}
                            className="p-1 rounded-full bg-destructive/80 text-white hover:bg-destructive"
                            title="Xóa ảnh"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="font-semibold text-xs">Ghi chú chi tiết</Label>
                <Textarea
                  rows={2}
                  placeholder="Ghi chú diễn giải thêm về khoản thu chi này..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-border flex items-center justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsModalOpen(false)}
              >
                Hủy bỏ
              </Button>

              <Button 
                type="submit" 
                disabled={isUploading}
                className={formType === 'income' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'}
              >
                {editingTransaction ? 'Cập nhật phiếu' : (formType === 'income' ? 'Lưu phiếu Thu' : 'Lưu phiếu Chi')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DETAIL TRANSACTION DIALOG */}
      {detailTransaction && (
        <Dialog open={!!detailTransaction} onOpenChange={() => setDetailTransaction(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {detailTransaction.type === 'income' ? (
                  <Badge className="bg-emerald-500/10 text-emerald-600">🟢 PHIẾU THU</Badge>
                ) : (
                  <Badge className="bg-rose-500/10 text-rose-600">🔴 PHIẾU CHI</Badge>
                )}
                <span>Chi tiết chứng từ</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 text-sm mt-2">
              <div>
                <span className="text-xs text-muted-foreground block">Tên khoản / Nội dung:</span>
                <span className="font-bold text-foreground text-base">{detailTransaction.title}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
                <span className="text-xs text-muted-foreground">Số tiền:</span>
                <span className={`text-xl font-black ${
                  detailTransaction.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {formatCurrency(detailTransaction.amount)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground block">Ngày phát sinh:</span>
                  <span className="font-semibold">{detailTransaction.date}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Hạng mục:</span>
                  <span className="font-semibold">{detailTransaction.category}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Hình thức TT:</span>
                  <span className="font-semibold">
                    {detailTransaction.paymentMethod === 'cash' ? 'Tiền mặt' : detailTransaction.paymentMethod === 'transfer' ? 'Chuyển khoản' : 'Khác'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Cơ sở:</span>
                  <span className="font-semibold">{detailTransaction.workshop || 'Hà Nội'}</span>
                </div>
              </div>

              {detailTransaction.payerPayee && (
                <div className="text-xs">
                  <span className="text-muted-foreground block">Người nộp/nhận:</span>
                  <span className="font-semibold">{detailTransaction.payerPayee}</span>
                </div>
              )}

              {detailTransaction.customerName && (
                <div className="text-xs">
                  <span className="text-muted-foreground block">Khách hàng liên quan:</span>
                  <span className="font-semibold text-primary">{detailTransaction.customerName}</span>
                </div>
              )}

              {detailTransaction.notes && (
                <div className="text-xs">
                  <span className="text-muted-foreground block">Ghi chú:</span>
                  <p className="p-2 rounded bg-muted/40 text-foreground italic">{detailTransaction.notes}</p>
                </div>
              )}

              {/* Photos */}
              {((detailTransaction.imageUrls && detailTransaction.imageUrls.length > 0) || detailTransaction.imageUrl) && (
                <div className="space-y-1 pt-2">
                  <span className="text-xs text-muted-foreground block font-semibold">Ảnh chứng từ phiếu:</span>
                  <div className="flex flex-wrap gap-2">
                    {(detailTransaction.imageUrls || [detailTransaction.imageUrl]).map((url, idx) => (
                      url ? (
                        <img
                          key={idx}
                          src={url}
                          alt="Ảnh phiếu chi"
                          onClick={() => setPreviewImage(url)}
                          className="w-20 h-20 object-cover rounded-lg border border-border cursor-pointer hover:opacity-80 transition-opacity"
                        />
                      ) : null
                    ))}
                  </div>
                </div>
              )}

              <div className="text-[11px] text-muted-foreground pt-2 border-t border-border flex justify-between">
                <span>Người lập: {detailTransaction.createdBy || 'Hệ thống'}</span>
                <span>Tạo lúc: {detailTransaction.createdAt ? new Date(detailTransaction.createdAt).toLocaleDateString('vi-VN') : '—'}</span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* FULLSIZE IMAGE PREVIEW MODAL */}
      {previewImage && (
        <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
          <DialogContent className="max-w-4xl p-2 bg-black/90 border-none text-white flex flex-col items-center justify-center">
            <div className="relative w-full max-h-[85vh] flex items-center justify-center">
              <img
                src={previewImage}
                alt="Xem đầy đủ ảnh phiếu chi chứng từ"
                className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
