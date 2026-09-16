import * as React from 'react';
import * as XLSX from 'xlsx';
import { 
  FinancialTransaction, 
  FinancialTransactionType, 
  FinancialOpeningBalance,
  Customer, 
  Member, 
  WORKSHOPS, 
  getWorkshopName,
  Supplier,
  SupplierTransaction
} from '@/src/types';
import { 
  subscribeFinancialTransactions, 
  addFinancialTransaction, 
  updateFinancialTransaction, 
  deleteFinancialTransaction,
  subscribeOpeningBalance,
  saveOpeningBalance
} from '@/src/services/financialService';
import {
  subscribeSuppliers,
  saveSupplier,
  deleteSupplier,
  subscribeSupplierTransactions,
  addSupplierPurchaseTransaction,
  addSupplierPaymentTransaction,
  deleteSupplierTransaction
} from '@/src/services/supplierDebtService';
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
  ArrowDownLeft,
  Building,
  FileText,
  HandCoins,
  History,
  UserPlus,
  ArrowRightLeft,
  ShieldCheck,
  PiggyBank
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const INCOME_CATEGORIES = [
  'Thanh toán hợp đồng khách hàng',
  'Tạm ứng hợp đồng',
  'Thu hồi tạm ứng nhân viên',
  'Thu hoàn tiền nhà cung cấp',
  'Bổ sung vốn / Vay ngân hàng',
  'Thu phế liệu / Thanh lý vật tư',
  'Khác'
];

const EXPENSE_CATEGORIES = [
  'Mua vật tư Ecoplast & phụ kiện',
  'Lương, Thưởng & Phụ cấp thợ xưởng',
  'Chi phí thi công & lắp đặt',
  'Chi phí vận chuyển & cước xe',
  'Mặt bằng xưởng, điện nước & mạng',
  'Chi mua sắm máy móc & công cụ',
  'Tiếp khách, văn phòng phẩm & xe cộ',
  'Marketing & Hoa hồng Sale',
  'Thanh toán công nợ Nhà cung cấp',
  'Khác'
];

const CATEGORY_OPTIONS = Array.from(new Set([...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES]));


interface FinancialPageProps {
  customers?: Customer[];
  members?: Member[];
  currentUser?: Member | null;
}

export function FinancialPage({ customers = [], members = [], currentUser }: FinancialPageProps) {
  const [transactions, setTransactions] = React.useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);

  // Opening Balance State
  const [openingBalance, setOpeningBalance] = React.useState<FinancialOpeningBalance | null>(null);
  const [isOBModalOpen, setIsOBModalOpen] = React.useState<boolean>(false);
  const [obCashBalance, setObCashBalance] = React.useState<string>('0');
  const [obBankBalance, setObBankBalance] = React.useState<string>('0');
  const [obStartDate, setObStartDate] = React.useState<string>(() => new Date().toISOString().split('T')[0]);
  const [obNotes, setObNotes] = React.useState<string>('');
  const [obSaving, setObSaving] = React.useState<boolean>(false);

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
  const [formHandlerId, setFormHandlerId] = React.useState<string>('none');
  const [formHandlerName, setFormHandlerName] = React.useState<string>('');
  const [formCustomerId, setFormCustomerId] = React.useState<string>('none');
  const [formWorkshop, setFormWorkshop] = React.useState<string>('Hà Nội');
  const [formImageUrls, setFormImageUrls] = React.useState<string[]>([]);
  const [formNotes, setFormNotes] = React.useState('');
  const [isUploading, setIsUploading] = React.useState(false);

  // Detail & Preview Image Modal
  const [previewImage, setPreviewImage] = React.useState<string | null>(null);
  const [detailTransaction, setDetailTransaction] = React.useState<FinancialTransaction | null>(null);

  // Page Active Tab
  const [activePageTab, setActivePageTab] = React.useState<'transactions' | 'suppliers'>('transactions');

  // Supplier Payables State
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);
  const [supplierTxs, setSupplierTxs] = React.useState<SupplierTransaction[]>([]);
  const [supplierLoading, setSupplierLoading] = React.useState<boolean>(true);
  const [supplierSearch, setSupplierSearch] = React.useState<string>('');
  const [selectedSupplierForHistory, setSelectedSupplierForHistory] = React.useState<Supplier | null>(null);

  // Supplier Modals
  const [isSupplierModalOpen, setIsSupplierModalOpen] = React.useState(false);
  const [editingSupplier, setEditingSupplier] = React.useState<Supplier | null>(null);
  const [supName, setSupName] = React.useState('');
  const [supPhone, setSupPhone] = React.useState('');
  const [supAddress, setSupAddress] = React.useState('');
  const [supCategory, setSupCategory] = React.useState('Vật tư');
  const [supNotes, setSupNotes] = React.useState('');

  // Purchase Order / Debt Form Modal
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = React.useState(false);
  const [purSupplierId, setPurSupplierId] = React.useState('');
  const [purAmount, setPurAmount] = React.useState('');
  const [purDate, setPurDate] = React.useState(() => new Date().toISOString().split('T')[0]);
  const [purInvoiceNo, setPurInvoiceNo] = React.useState('');
  const [purPaidImmediately, setPurPaidImmediately] = React.useState('');
  const [purPaymentMethod, setPurPaymentMethod] = React.useState<'cash' | 'transfer' | 'other'>('transfer');
  const [purNotes, setPurNotes] = React.useState('');
  const [purImageUrls, setPurImageUrls] = React.useState<string[]>([]);

  // Payment to Supplier Form Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = React.useState(false);
  const [paySupplierId, setPaySupplierId] = React.useState('');
  const [payAmount, setPayAmount] = React.useState('');
  const [payDate, setPayDate] = React.useState(() => new Date().toISOString().split('T')[0]);
  const [payPaymentMethod, setPayPaymentMethod] = React.useState<'cash' | 'transfer' | 'other'>('transfer');
  const [payHandlerName, setPayHandlerName] = React.useState('');
  const [payNotes, setPayNotes] = React.useState('');
  const [payImageUrls, setPayImageUrls] = React.useState<string[]>([]);

  // History Modal
  const [isHistoryModalOpen, setIsHistoryModalOpen] = React.useState(false);

  // Subscribe realtime data
  React.useEffect(() => {
    setLoading(true);
    const unsubscribeTxs = subscribeFinancialTransactions((data) => {
      setTransactions(data);
      setLoading(false);
    });

    const unsubscribeOB = subscribeOpeningBalance((data) => {
      setOpeningBalance(data);
    });

    const unsubscribeSuppliers = subscribeSuppliers((data) => {
      setSuppliers(data);
      setSupplierLoading(false);
    });

    const unsubscribeSupTxs = subscribeSupplierTransactions((data) => {
      setSupplierTxs(data);
    });

    return () => {
      unsubscribeTxs();
      unsubscribeOB();
      unsubscribeSuppliers();
      unsubscribeSupTxs();
    };
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

  // Opening Balance breakdown
  const obCash = openingBalance?.cashBalance || 0;
  const obBank = openingBalance?.bankBalance || 0;
  const obTotal = obCash + obBank;
  const obStartDateVal = openingBalance?.startDate || '';

  // All-time Cashbook Balance calculation (from Opening Balance start date onwards)
  const cashbookStats = React.useMemo(() => {
    let totalAllIncomeCash = 0;
    let totalAllIncomeBank = 0;
    let totalAllExpenseCash = 0;
    let totalAllExpenseBank = 0;

    transactions.forEach(t => {
      if (obStartDateVal && t.date && t.date < obStartDateVal) return;
      const isCash = t.paymentMethod === 'cash';
      if (t.type === 'income') {
        if (isCash) totalAllIncomeCash += t.amount || 0;
        else totalAllIncomeBank += t.amount || 0;
      } else if (t.type === 'expense') {
        if (isCash) totalAllExpenseCash += t.amount || 0;
        else totalAllExpenseBank += t.amount || 0;
      }
    });

    const currentCash = obCash + totalAllIncomeCash - totalAllExpenseCash;
    const currentBank = obBank + totalAllIncomeBank - totalAllExpenseBank;
    const currentTotalFund = currentCash + currentBank;

    return {
      currentCash,
      currentBank,
      currentTotalFund,
      totalAllIncomeCash,
      totalAllIncomeBank,
      totalAllExpenseCash,
      totalAllExpenseBank
    };
  }, [transactions, obCash, obBank, obStartDateVal]);

  // Statistics calculation for filtered period
  const periodStats = React.useMemo(() => {
    let incomeCash = 0;
    let incomeBank = 0;
    let expenseCash = 0;
    let expenseBank = 0;

    filteredTransactions.forEach(t => {
      const isCash = t.paymentMethod === 'cash';
      if (t.type === 'income') {
        if (isCash) incomeCash += t.amount || 0;
        else incomeBank += t.amount || 0;
      } else if (t.type === 'expense') {
        if (isCash) expenseCash += t.amount || 0;
        else expenseBank += t.amount || 0;
      }
    });

    const totalPeriodIncome = incomeCash + incomeBank;
    const totalPeriodExpense = expenseCash + expenseBank;
    const netPeriodCashflow = totalPeriodIncome - totalPeriodExpense;

    return {
      incomeCash,
      incomeBank,
      expenseCash,
      expenseBank,
      totalPeriodIncome,
      totalPeriodExpense,
      netPeriodCashflow
    };
  }, [filteredTransactions]);

  const totalIncome = periodStats.totalPeriodIncome;
  const totalExpense = periodStats.totalPeriodExpense;
  const netBalance = periodStats.netPeriodCashflow;

  // Opening Balance Modal Handlers
  const handleOpenOBModal = () => {
    if (openingBalance) {
      setObCashBalance(openingBalance.cashBalance.toString());
      setObBankBalance(openingBalance.bankBalance.toString());
      setObStartDate(openingBalance.startDate || new Date().toISOString().split('T')[0]);
      setObNotes(openingBalance.notes || '');
    } else {
      setObCashBalance('0');
      setObBankBalance('0');
      setObStartDate(new Date().toISOString().split('T')[0]);
      setObNotes('');
    }
    setIsOBModalOpen(true);
  };

  const handleSaveOpeningBalanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cash = parseFloat(obCashBalance.replace(/[^0-9.-]/g, '')) || 0;
    const bank = parseFloat(obBankBalance.replace(/[^0-9.-]/g, '')) || 0;

    setObSaving(true);
    try {
      await saveOpeningBalance({
        cashBalance: cash,
        bankBalance: bank,
        startDate: obStartDate,
        notes: obNotes.trim(),
        updatedBy: currentUser?.name || 'Kế toán trưởng',
        updatedAt: new Date().toISOString()
      });
      toast.success("Đã cập nhật Quỹ Ban Đầu / Số Dư Đầu Kỳ thành công!");
      setIsOBModalOpen(false);
    } catch (err: any) {
      toast.error("Lỗi khi lưu số dư đầu kỳ: " + (err?.message || 'Lỗi không xác định'));
    } finally {
      setObSaving(false);
    }
  };

  // Open modal for Create
  const handleOpenCreateModal = (type: FinancialTransactionType = 'expense') => {
    setEditingTransaction(null);
    setFormType(type);
    setFormTitle('');
    setFormAmount('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormCategory(type === 'income' ? 'Thanh toán hợp đồng khách hàng' : 'Mua vật tư Ecoplast & phụ kiện');
    setCustomCategoryInput('');
    setFormPaymentMethod('transfer');
    setFormPayerPayee('');
    setFormHandlerId(currentUser?.id || 'none');
    setFormHandlerName(currentUser?.name || '');
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
    setFormHandlerId(t.handlerId || 'none');
    setFormHandlerName(t.handlerName || '');
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

    const rawAmountStr = typeof formAmount === 'number' ? String(formAmount) : (formAmount || '0');
    const numAmount = parseFloat(rawAmountStr.replace(/[^0-9.]/g, ''));
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Vui lòng nhập số tiền hợp lệ lớn hơn 0");
      return;
    }

    const finalCategory = formCategory === 'Khác' && customCategoryInput.trim() 
      ? customCategoryInput.trim() 
      : formCategory;

    const selectedCust = customers.find(c => c.id === formCustomerId);
    const selectedHandler = members.find(m => m.id === formHandlerId);
    const finalHandlerName = formHandlerName.trim() || (selectedHandler ? selectedHandler.name : '');

    const payload: Omit<FinancialTransaction, 'id'> = {
      type: formType,
      title: formTitle.trim(),
      amount: numAmount,
      date: formDate,
      category: finalCategory,
      paymentMethod: formPaymentMethod,
      payerPayee: formPayerPayee.trim(),
      handlerId: formHandlerId !== 'none' ? formHandlerId : '',
      handlerName: finalHandlerName,
      customerId: formCustomerId !== 'none' ? formCustomerId : '',
      customerName: selectedCust ? selectedCust.name : '',
      workshop: formWorkshop,
      imageUrl: formImageUrls.length > 0 ? formImageUrls[0] : '',
      imageUrls: formImageUrls,
      notes: formNotes.trim(),
      createdBy: currentUser?.name || 'Hệ thống',
      createdById: currentUser?.id || '',
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
    } catch (error: any) {
      console.error("Error saving transaction:", error);
      toast.error("Lỗi khi lưu phiếu thu chi: " + (error?.message || "Lỗi không xác định"));
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

  // Export to Excel according to 10-year Chief Accountant Standards
  const handleExportExcel = () => {
    if (filteredTransactions.length === 0) {
      toast.error("Không có dữ liệu để xuất Excel");
      return;
    }

    // Sort transactions by date ascending for timeline continuity
    const sortedTxs = [...filteredTransactions].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    let runningCash = obCash;
    let runningBank = obBank;
    let runningTotal = obTotal;

    const rows: any[] = [];

    // Header Row 0: Opening Balance
    rows.push({
      'STT': 0,
      'Ngày chứng từ': obStartDateVal || 'Đầu kỳ',
      'Loại phiếu': 'ĐẦU KỲ',
      'Tên khoản / Diễn giải': `SỐ DƯ ĐẦU KỲ (TM: ${formatCurrency(obCash)} | CK: ${formatCurrency(obBank)})`,
      'Hạng mục kế toán': 'Số dư đầu kỳ',
      'Hình thức TT': 'Tổng hợp',
      'Thu (Phát sinh Nợ)': 0,
      'Chi (Phát sinh Có)': 0,
      'Tồn quỹ lũy kế (VNĐ)': runningTotal,
      'Người nộp / nhận': '',
      'Nhân viên thực hiện': openingBalance?.updatedBy || '',
      'Cơ sở / Xưởng': 'Toàn bộ',
      'Ghi chú': openingBalance?.notes || 'Số dư quỹ ban đầu'
    });

    sortedTxs.forEach((t, idx) => {
      const isIncome = t.type === 'income';
      const isCash = t.paymentMethod === 'cash';
      const incomeAmt = isIncome ? (t.amount || 0) : 0;
      const expenseAmt = !isIncome ? (t.amount || 0) : 0;

      if (isCash) {
        runningCash += incomeAmt - expenseAmt;
      } else {
        runningBank += incomeAmt - expenseAmt;
      }
      runningTotal = runningCash + runningBank;

      rows.push({
        'STT': idx + 1,
        'Ngày chứng từ': t.date || '',
        'Loại phiếu': isIncome ? 'THU' : 'CHI',
        'Tên khoản / Diễn giải': t.title || '',
        'Hạng mục kế toán': t.category || '',
        'Hình thức TT': isCash ? 'Tiền mặt' : t.paymentMethod === 'transfer' ? 'Chuyển khoản' : 'Khác',
        'Thu (Phát sinh Nợ)': incomeAmt,
        'Chi (Phát sinh Có)': expenseAmt,
        'Tồn quỹ lũy kế (VNĐ)': runningTotal,
        'Người nộp / nhận': t.payerPayee || t.customerName || '',
        'Nhân viên thực hiện': t.handlerName || t.createdBy || '',
        'Cơ sở / Xưởng': getWorkshopName(t.workshop),
        'Ghi chú': t.notes || ''
      });
    });

    // Summary Row
    rows.push({
      'STT': 'CỘNG',
      'Ngày chứng từ': 'TỔNG CỘNG',
      'Loại phiếu': '',
      'Tên khoản / Diễn giải': 'TỔNG PHÁT SINH TRONG KỲ VÀ SỐ DƯ CUỐI KỲ',
      'Hạng mục kế toán': '',
      'Hình thức TT': '',
      'Thu (Phát sinh Nợ)': periodStats.totalPeriodIncome,
      'Chi (Phát sinh Có)': periodStats.totalPeriodExpense,
      'Tồn quỹ lũy kế (VNĐ)': runningTotal,
      'Người nộp / nhận': '',
      'Nhân viên thực hiện': '',
      'Cơ sở / Xưởng': '',
      'Ghi chú': `Dòng tiền ròng trong kỳ: ${formatCurrency(periodStats.netPeriodCashflow)}`
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "So_Quy_Ke_Toan");

    const colWidths = [
      { wch: 6 },
      { wch: 14 },
      { wch: 10 },
      { wch: 32 },
      { wch: 24 },
      { wch: 14 },
      { wch: 18 },
      { wch: 18 },
      { wch: 20 },
      { wch: 22 },
      { wch: 20 },
      { wch: 14 },
      { wch: 25 }
    ];
    worksheet['!cols'] = colWidths;

    const fileName = `So_Quy_Ke_Toan_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast.success(`Đã xuất Sổ Quỹ Kế Toán chuẩn: ${fileName}`);
  };

  // --- SUPPLIER HANDLERS ---
  const filteredSuppliers = React.useMemo(() => {
    if (!supplierSearch.trim()) return suppliers;
    const q = supplierSearch.toLowerCase().trim();
    return suppliers.filter(s => 
      s.name.toLowerCase().includes(q) || 
      (s.phone && s.phone.toLowerCase().includes(q)) || 
      (s.category && s.category.toLowerCase().includes(q))
    );
  }, [suppliers, supplierSearch]);

  const supplierStats = React.useMemo(() => {
    const totalDebt = suppliers.reduce((sum, s) => sum + (s.remainingDebt || 0), 0);
    const suppliersWithDebt = suppliers.filter(s => (s.remainingDebt || 0) > 0).length;
    const totalPurchased = suppliers.reduce((sum, s) => sum + (s.totalPurchased || 0), 0);
    const totalPaid = suppliers.reduce((sum, s) => sum + (s.totalPaid || 0), 0);

    return { totalDebt, suppliersWithDebt, totalPurchased, totalPaid };
  }, [suppliers]);

  // Open Supplier Edit / Create Modal
  const handleOpenSupplierModal = (sup?: Supplier) => {
    if (sup) {
      setEditingSupplier(sup);
      setSupName(sup.name);
      setSupPhone(sup.phone || '');
      setSupAddress(sup.address || '');
      setSupCategory(sup.category || 'Vật tư');
      setSupNotes(sup.notes || '');
    } else {
      setEditingSupplier(null);
      setSupName('');
      setSupPhone('');
      setSupAddress('');
      setSupCategory('Vật tư');
      setSupNotes('');
    }
    setIsSupplierModalOpen(true);
  };

  const handleSaveSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim()) {
      toast.error("Vui lòng nhập tên nhà cung cấp");
      return;
    }

    try {
      await saveSupplier({
        id: editingSupplier?.id,
        name: supName.trim(),
        phone: supPhone.trim(),
        address: supAddress.trim(),
        category: supCategory,
        notes: supNotes.trim(),
        totalPurchased: editingSupplier?.totalPurchased || 0,
        totalPaid: editingSupplier?.totalPaid || 0,
        createdAt: editingSupplier?.createdAt
      });
      toast.success(editingSupplier ? "Đã cập nhật Nhà cung cấp" : "Đã thêm Nhà cung cấp mới!");
      setIsSupplierModalOpen(false);
    } catch (e: any) {
      toast.error("Lỗi khi lưu nhà cung cấp: " + (e?.message || 'Lỗi không xác định'));
    }
  };

  const handleDeleteSupplierClick = async (sup: Supplier) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa nhà cung cấp "${sup.name}"?`)) {
      try {
        await deleteSupplier(sup.id, sup.name);
        toast.success("Đã xóa nhà cung cấp");
      } catch (e) {
        toast.error("Không thể xóa nhà cung cấp");
      }
    }
  };

  // Open Purchase Order Modal
  const handleOpenPurchaseModal = (supId?: string) => {
    setPurSupplierId(supId || (suppliers[0]?.id || ''));
    setPurAmount('');
    setPurDate(new Date().toISOString().split('T')[0]);
    setPurInvoiceNo('');
    setPurPaidImmediately('');
    setPurPaymentMethod('transfer');
    setPurNotes('');
    setPurImageUrls([]);
    setIsPurchaseModalOpen(true);
  };

  const handleSavePurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purSupplierId) {
      toast.error("Vui lòng chọn nhà cung cấp");
      return;
    }
    const numAmount = parseFloat(purAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Vui lòng nhập số tiền mua hàng hợp lệ");
      return;
    }

    const targetSup = suppliers.find(s => s.id === purSupplierId);
    if (!targetSup) return;

    try {
      await addSupplierPurchaseTransaction({
        supplierId: targetSup.id,
        supplierName: targetSup.name,
        amount: numAmount,
        date: purDate,
        invoiceNo: purInvoiceNo.trim(),
        handlerName: currentUser?.name || 'Nhân viên',
        imageUrls: purImageUrls,
        notes: purNotes.trim(),
        createdBy: currentUser?.name || 'Hệ thống',
        paidAmountImmediately: purPaidImmediately ? parseFloat(purPaidImmediately) : 0,
        paymentMethod: purPaymentMethod
      });

      toast.success(`Đã ghi nhận đơn mua mới cho ${targetSup.name}`);
      setIsPurchaseModalOpen(false);
    } catch (e: any) {
      toast.error("Lỗi khi ghi nhận đơn mua: " + (e?.message || 'Lỗi'));
    }
  };

  // Open Payment to Supplier Modal
  const handleOpenPaymentModal = (supId?: string) => {
    const defaultSup = suppliers.find(s => s.id === supId) || suppliers[0];
    setPaySupplierId(defaultSup?.id || '');
    setPayAmount(defaultSup && defaultSup.remainingDebt > 0 ? defaultSup.remainingDebt.toString() : '');
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayPaymentMethod('transfer');
    setPayHandlerName(currentUser?.name || '');
    setPayNotes('');
    setPayImageUrls([]);
    setIsPaymentModalOpen(true);
  };

  const handleSavePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paySupplierId) {
      toast.error("Vui lòng chọn nhà cung cấp");
      return;
    }
    const numAmount = parseFloat(payAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Vui lòng nhập số tiền thanh toán hợp lệ");
      return;
    }

    const targetSup = suppliers.find(s => s.id === paySupplierId);
    if (!targetSup) return;

    try {
      await addSupplierPaymentTransaction({
        supplierId: targetSup.id,
        supplierName: targetSup.name,
        amount: numAmount,
        date: payDate,
        paymentMethod: payPaymentMethod,
        handlerName: payHandlerName || currentUser?.name || 'Nhân viên',
        imageUrls: payImageUrls,
        notes: payNotes.trim(),
        createdBy: currentUser?.name || 'Hệ thống'
      });

      toast.success(`Đã thanh toán ${formatCurrency(numAmount)} cho NCC ${targetSup.name} & tự động tạo Phiếu Chi trong Sổ Quỹ!`);
      setIsPaymentModalOpen(false);
    } catch (e: any) {
      toast.error("Lỗi khi ghi nhận thanh toán: " + (e?.message || 'Lỗi'));
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-20 p-2 sm:p-4 md:p-6 max-w-7xl mx-auto">
      {/* PAGE NAVIGATION TABS */}
      <div className="flex items-center gap-2 border-b border-border pb-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActivePageTab('transactions')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap ${
            activePageTab === 'transactions'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Receipt className="h-4 w-4" />
          <span>Sổ Quỹ Thu Chi</span>
        </button>

        <button
          type="button"
          onClick={() => setActivePageTab('suppliers')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap relative ${
            activePageTab === 'suppliers'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Building className="h-4 w-4" />
          <span>Công Nợ Nhà Cung Cấp</span>
          {supplierStats.suppliersWithDebt > 0 && (
            <span className="ml-1 px-1.5 py-0.2 text-[10px] font-black bg-rose-500 text-white rounded-full">
              {supplierStats.suppliersWithDebt}
            </span>
          )}
        </button>
      </div>

      {/* ================= TAB 1: SỔ QUỸ THU CHI ================= */}
      {activePageTab === 'transactions' && (
        <div className="space-y-4 sm:space-y-6">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-primary/10 via-background to-background p-4 sm:p-6 rounded-2xl border border-border shadow-xs">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary shadow-2xs">
                  <Receipt className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">Sổ Quỹ Thu Chi</h1>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    Quản lý dòng tiền thu chi, chứng từ, nộp/nhận tiền mặt & chuyển khoản
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
              <Button 
                onClick={handleOpenOBModal}
                variant="outline"
                className="bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-100 flex items-center justify-center gap-1.5 h-10 text-xs sm:text-sm font-semibold rounded-xl"
              >
                <PiggyBank className="h-4 w-4" />
                <span>Quỹ Ban Đầu ({obTotal > 0 ? formatCurrency(obTotal) : 'Khởi tạo'})</span>
              </Button>

              <Button 
                onClick={() => handleOpenCreateModal('income')} 
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center justify-center gap-1.5 h-10 text-xs sm:text-sm font-semibold rounded-xl"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Tạo phiếu Thu</span>
              </Button>

              <Button 
                onClick={() => handleOpenCreateModal('expense')} 
                variant="destructive"
                className="shadow-sm flex items-center justify-center gap-1.5 h-10 text-xs sm:text-sm font-semibold rounded-xl"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Tạo phiếu Chi</span>
              </Button>

              <Button 
                variant="outline" 
                onClick={handleExportExcel}
                className="flex items-center justify-center gap-1.5 h-10 text-xs sm:text-sm font-medium rounded-xl border-border hover:bg-muted"
              >
                <Download className="h-4 w-4 text-primary" />
                <span>Xuất Excel</span>
              </Button>
            </div>
          </div>

          {/* KPI Cards - Responsive Grid 2x2 on Mobile, 4x1 on Desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {/* Card 1: Total Current Fund (Quỹ Tồn Hiện Tại) */}
            <Card className="border border-purple-500/20 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent shadow-2xs relative overflow-hidden rounded-2xl">
              <CardContent className="p-3.5 sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">
                    Tổng Quỹ Tồn Hiện Tại
                  </span>
                  <button
                    onClick={handleOpenOBModal}
                    title="Cấu hình số dư quỹ ban đầu"
                    className="p-1.5 sm:p-2 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 hover:bg-purple-500/30 transition-colors"
                  >
                    <PiggyBank className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>
                </div>
                <div className="mt-2">
                  <div className="text-lg sm:text-2xl font-black text-purple-700 dark:text-purple-400 truncate">
                    {formatCurrency(cashbookStats.currentTotalFund)}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 font-semibold">
                      💵 TM: {formatCurrency(cashbookStats.currentCash)}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 font-semibold">
                      🏦 CK: {formatCurrency(cashbookStats.currentBank)}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Total Income in Period */}
            <Card className="border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent shadow-2xs relative overflow-hidden rounded-2xl">
              <CardContent className="p-3.5 sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Tổng Thu (Kỳ Lọc)
                  </span>
                  <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <ArrowDownLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-lg sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 truncate">
                    {formatCurrency(totalIncome)}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 font-semibold">
                      TM: {formatCurrency(periodStats.incomeCash)}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 font-semibold">
                      CK: {formatCurrency(periodStats.incomeBank)}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Total Expense in Period */}
            <Card className="border border-rose-500/20 bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent shadow-2xs relative overflow-hidden rounded-2xl">
              <CardContent className="p-3.5 sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                    Tổng Chi (Kỳ Lọc)
                  </span>
                  <div className="p-1.5 sm:p-2 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
                    <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-lg sm:text-2xl font-black text-rose-600 dark:text-rose-400 truncate">
                    {formatCurrency(totalExpense)}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <Badge variant="outline" className="text-[10px] bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 font-semibold">
                      TM: {formatCurrency(periodStats.expenseCash)}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 font-semibold">
                      CK: {formatCurrency(periodStats.expenseBank)}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 4: Net Balance in Period */}
            <Card className={`border shadow-2xs relative overflow-hidden rounded-2xl bg-gradient-to-br ${
              netBalance >= 0 
                ? 'border-blue-500/20 from-blue-500/10 via-blue-500/5 to-transparent' 
                : 'border-amber-500/20 from-amber-500/10 via-amber-500/5 to-transparent'
            }`}>
              <CardContent className="p-3.5 sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                    Dòng Tiền Ròng (Kỳ Lọc)
                  </span>
                  <div className="p-1.5 sm:p-2 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                    <Wallet className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className={`text-lg sm:text-2xl font-black truncate ${
                    netBalance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'
                  }`}>
                    {formatCurrency(netBalance)}
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-2 truncate">
                    Dòng tiền ròng = Thu - Chi trong kỳ
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Toolbar & Filters */}
          <Card className="shadow-2xs border-border rounded-2xl">
            <CardContent className="p-3.5 sm:p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                {/* Search */}
                <div className="sm:col-span-2 lg:col-span-2 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Tìm kiếm phiếu, người nộp/nhận, ghi chú..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-xs sm:text-sm rounded-xl"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Type filter */}
                <div>
                  <Select value={typeFilter} onValueChange={(val: any) => setTypeFilter(val)}>
                    <SelectTrigger className="h-9 text-xs sm:text-sm rounded-xl">
                      <SelectValue>
                        {typeFilter === 'all' ? 'Tất cả loại' : typeFilter === 'income' ? '🟢 Phiếu Thu' : '🔴 Phiếu Chi'}
                      </SelectValue>
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
                    <SelectTrigger className="h-9 text-xs sm:text-sm rounded-xl">
                      <SelectValue>
                        {dateRangeFilter === 'month' ? 'Tháng này' :
                         dateRangeFilter === 'today' ? 'Hôm nay' :
                         dateRangeFilter === 'week' ? 'Tuần này' :
                         dateRangeFilter === 'year' ? 'Năm nay' :
                         dateRangeFilter === 'all' ? 'Tất cả thời gian' : 'Tùy chọn ngày'}
                      </SelectValue>
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
                    <SelectTrigger className="h-9 text-xs sm:text-sm rounded-xl">
                      <SelectValue>
                        {categoryFilter === 'all' ? 'Tất cả hạng mục' : categoryFilter}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả hạng mục</SelectItem>
                      {CATEGORY_OPTIONS.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
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
                  className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/50 text-xs sm:text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Từ ngày:</span>
                    <Input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="h-8 w-auto text-xs rounded-lg"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Đến ngày:</span>
                    <Input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="h-8 w-auto text-xs rounded-lg"
                    />
                  </div>
                  {(customStartDate || customEndDate) && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => { setCustomStartDate(''); setCustomEndDate(''); }}
                      className="h-8 text-xs text-destructive hover:bg-destructive/10"
                    >
                      Xóa lọc ngày
                    </Button>
                  )}
                </motion.div>
              )}
            </CardContent>
          </Card>

          {/* Main Transactions List / Table Card */}
          <Card className="shadow-2xs border-border overflow-hidden rounded-2xl">
            <CardHeader className="py-3.5 px-4 sm:px-6 border-b border-border flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm sm:text-base font-bold">Danh Sách Phiếu Thu Chi</CardTitle>
                <CardDescription className="text-xs mt-0.5">
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
                <Receipt className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-base font-semibold text-foreground">Chưa có phiếu thu chi nào</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  Không tìm thấy chứng từ thu chi nào phù hợp với bộ lọc hiện tại. Bấm "Tạo phiếu Thu" hoặc "Tạo phiếu Chi" để bắt đầu ghi nhận.
                </p>
              </div>
            ) : (
              <div>
                {/* MOBILE CARDS VIEW (Displayed on mobile screens under md breakpoint) */}
                <div className="block md:hidden divide-y divide-border">
                  {filteredTransactions.map((t) => {
                    const images = t.imageUrls && t.imageUrls.length > 0 
                      ? t.imageUrls 
                      : (t.imageUrl ? [t.imageUrl] : []);

                    return (
                      <div key={t.id} className="p-3.5 space-y-2.5 hover:bg-muted/20 transition-colors">
                        {/* Header Row: Badge + Date + Quick Actions */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {t.type === 'income' ? (
                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[11px] font-bold px-2 py-0.5">
                                🟢 PHIẾU THU
                              </Badge>
                            ) : (
                              <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 text-[11px] font-bold px-2 py-0.5">
                                🔴 PHIẾU CHI
                              </Badge>
                            )}
                            <span className="text-[11px] text-muted-foreground font-medium">
                              {t.date}
                            </span>
                          </div>

                          {/* Action buttons for mobile */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setDetailTransaction(t)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                              title="Xem chi tiết"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(t)}
                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                              title="Sửa phiếu"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTransaction(t)}
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                              title="Xóa phiếu"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Content & Category */}
                        <div>
                          <h4 className="font-bold text-foreground text-sm leading-snug">{t.title}</h4>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <Badge variant="outline" className="text-[10px] font-normal bg-background px-1.5 py-0">
                              {t.category}
                            </Badge>
                            {t.customerName && (
                              <span className="text-[11px] text-primary font-medium">
                                Khách: {t.customerName}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Amount & Payment Info Row */}
                        <div className="flex items-end justify-between bg-muted/30 p-2.5 rounded-xl border border-border/60">
                          <div>
                            <div className="text-[11px] text-muted-foreground">
                              {t.paymentMethod === 'cash' ? '💵 Tiền mặt' : t.paymentMethod === 'transfer' ? '🏦 Chuyển khoản' : 'Ví/Khác'}
                              {t.payerPayee && ` • ${t.payerPayee}`}
                            </div>
                            {t.handlerName && (
                              <div className="text-[11px] text-foreground font-medium mt-0.5">
                                👤 Thu/Chi: {t.handlerName}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className={`text-base font-black ${
                              t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                            }`}>
                              {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                            </div>
                          </div>
                        </div>

                        {/* Proof Images Thumbnail row if present */}
                        {images.length > 0 && (
                          <div className="flex items-center gap-2 pt-1">
                            <span className="text-[11px] text-muted-foreground">Ảnh chứng từ:</span>
                            <div className="flex items-center gap-1.5">
                              {images.map((img, idx) => (
                                <img
                                  key={idx}
                                  src={img}
                                  alt="Ảnh phiếu"
                                  onClick={() => setPreviewImage(img)}
                                  className="w-8 h-8 rounded-lg object-cover border border-border cursor-pointer hover:opacity-80 transition-opacity"
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* DESKTOP TABLE VIEW (Displayed on md screens and above) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-muted/60 text-muted-foreground border-b border-border">
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
                                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-semibold text-xs">
                                  🟢 THU
                                </Badge>
                              ) : (
                                <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 font-semibold text-xs">
                                  🔴 CHI
                                </Badge>
                              )}
                            </td>

                            {/* Title & Notes */}
                            <td className="px-4 py-3">
                              <div className="font-semibold text-foreground">{t.title}</div>
                              {t.customerName && (
                                <span className="text-xs text-primary block mt-0.5 font-medium">
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
                            <td className="px-4 py-3 text-right font-black text-base">
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
                                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                                  💵 Tiền mặt
                                </span>
                              ) : t.paymentMethod === 'transfer' ? (
                                <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold">
                                  🏦 C.Khoản
                                </span>
                              ) : (
                                <span className="text-muted-foreground">Khác</span>
                              )}
                            </td>

                            {/* Payer / Payee & Handler */}
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              {t.handlerName && (
                                <div className="font-semibold text-foreground flex items-center gap-1">
                                  <span>👤 {t.handlerName}</span>
                                </div>
                              )}
                              {t.payerPayee && (
                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                  {t.type === 'income' ? 'Nộp: ' : 'Nhận: '}{t.payerPayee}
                                </div>
                              )}
                              {!t.handlerName && !t.payerPayee && '—'}
                            </td>

                            {/* Receipt Image Thumbnail */}
                            <td className="px-4 py-3 text-center">
                              {images.length > 0 ? (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setPreviewImage(images[0])}
                                    className="relative group w-9 h-9 rounded-lg overflow-hidden border border-border shadow-2xs hover:ring-2 hover:ring-primary transition-all"
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
                                <span className="text-xs text-muted-foreground/40 font-normal">—</span>
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
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ================= TAB 2: CÔNG NỢ NHÀ CUNG CẤP ================= */}
      {activePageTab === 'suppliers' && (
        <div className="space-y-4 sm:space-y-6">
          {/* Supplier Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-rose-500/10 via-background to-background p-4 sm:p-6 rounded-2xl border border-border shadow-xs">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 shadow-2xs">
                  <Building className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">Quản Lý Công Nợ Nhà Cung Cấp</h1>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    Theo dõi nợ mua gỗ, vật tư, phụ kiện, đợt thanh toán & tự động liên kết Sổ Quỹ
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <Button
                onClick={() => handleOpenSupplierModal()}
                variant="outline"
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 h-10 text-xs sm:text-sm font-semibold rounded-xl"
              >
                <UserPlus className="h-4 w-4 text-primary" />
                <span>+ Nhà Cung Cấp</span>
              </Button>

              <Button
                onClick={() => handleOpenPurchaseModal()}
                className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center justify-center gap-1.5 h-10 text-xs sm:text-sm font-semibold rounded-xl"
              >
                <PlusCircle className="h-4 w-4" />
                <span>+ Đơn Mua (Nợ Mới)</span>
              </Button>

              <Button
                onClick={() => handleOpenPaymentModal()}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center justify-center gap-1.5 h-10 text-xs sm:text-sm font-semibold rounded-xl"
              >
                <HandCoins className="h-4 w-4" />
                <span>Thanh Toán Công Nợ</span>
              </Button>
            </div>
          </div>

          {/* KPI Cards for Supplier Debt */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {/* Total Remaining Debt */}
            <Card className="border border-rose-500/30 bg-gradient-to-br from-rose-500/15 via-rose-500/5 to-transparent shadow-2xs relative overflow-hidden rounded-2xl">
              <CardContent className="p-3.5 sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                    TỔNG CÔNG NỢ PHẢI TRẢ
                  </span>
                  <div className="p-1.5 sm:p-2 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400">
                    <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-base sm:text-2xl font-black text-rose-600 dark:text-rose-400 truncate">
                    {formatCurrency(supplierStats.totalDebt)}
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
                    Dư nợ còn thiếu các nhà cung cấp
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Suppliers count with debt */}
            <Card className="border border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent shadow-2xs relative overflow-hidden rounded-2xl">
              <CardContent className="p-3.5 sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    NCC ĐANG CÓ NỢ
                  </span>
                  <div className="p-1.5 sm:p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                    <Building className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-base sm:text-2xl font-black text-amber-600 dark:text-amber-400 truncate">
                    {supplierStats.suppliersWithDebt} <span className="text-xs font-normal text-muted-foreground">đơn vị</span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
                    Trên tổng số {suppliers.length} nhà cung cấp
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Total Paid */}
            <Card className="border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent shadow-2xs relative overflow-hidden rounded-2xl">
              <CardContent className="p-3.5 sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    ĐÃ THANH TOÁN
                  </span>
                  <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-base sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 truncate">
                    {formatCurrency(supplierStats.totalPaid)}
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
                    Đã trả tiền từ trước đến nay
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Total Purchased */}
            <Card className="border border-blue-500/20 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent shadow-2xs relative overflow-hidden rounded-2xl">
              <CardContent className="p-3.5 sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                    TỔNG MUA TÍCH LŨY
                  </span>
                  <div className="p-1.5 sm:p-2 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                    <Receipt className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-base sm:text-2xl font-black text-blue-600 dark:text-blue-400 truncate">
                    {formatCurrency(supplierStats.totalPurchased)}
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
                    Tổng giá trị các hóa đơn mua
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Supplier Search & Filter */}
          <Card className="shadow-2xs border-border rounded-2xl">
            <CardContent className="p-3.5 sm:p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm tên nhà cung cấp, số điện thoại, loại vật tư cung cấp..."
                  value={supplierSearch}
                  onChange={(e) => setSupplierSearch(e.target.value)}
                  className="pl-9 h-9 text-xs sm:text-sm rounded-xl"
                />
                {supplierSearch && (
                  <button
                    onClick={() => setSupplierSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Suppliers Table & Mobile Cards */}
          <Card className="shadow-2xs border-border overflow-hidden rounded-2xl">
            <CardHeader className="py-3.5 px-4 sm:px-6 border-b border-border flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm sm:text-base font-bold">Danh Sách Công Nợ Nhà Cung Cấp</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Hiển thị {filteredSuppliers.length} nhà cung cấp
                </CardDescription>
              </div>
            </CardHeader>

            {supplierLoading ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Đang tải dữ liệu nhà cung cấp...</p>
              </div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="text-center py-16 px-4">
                <Building className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-base font-semibold text-foreground">Chưa có nhà cung cấp nào</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  Bấm nút "+ Nhà Cung Cấp" hoặc "+ Đơn Mua (Nợ Mới)" ở phía trên để thêm nhà cung cấp vật tư.
                </p>
              </div>
            ) : (
              <div>
                {/* Mobile View for Suppliers */}
                <div className="block md:hidden divide-y divide-border">
                  {filteredSuppliers.map((sup) => (
                    <div key={sup.id} className="p-3.5 space-y-2.5 hover:bg-muted/20 transition-colors">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-foreground text-sm">{sup.name}</h4>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0 bg-background">
                              {sup.category || 'Vật tư'}
                            </Badge>
                            {sup.phone && (
                              <span className="text-[11px] text-muted-foreground font-medium">
                                📞 {sup.phone}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => { setSelectedSupplierForHistory(sup); setIsHistoryModalOpen(true); }}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50"
                            title="Lịch sử nợ"
                          >
                            <History className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenSupplierModal(sup)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"
                            title="Sửa NCC"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSupplierClick(sup)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                            title="Xóa NCC"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Debt Status Card */}
                      <div className="bg-muted/30 p-2.5 rounded-xl border border-border/60 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Tổng phát sinh mua:</span>
                          <span className="font-semibold">{formatCurrency(sup.totalPurchased)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Đã thanh toán:</span>
                          <span className="font-semibold text-emerald-600">{formatCurrency(sup.totalPaid)}</span>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-border/50 text-sm">
                          <span className="font-bold text-foreground">CÔNG NỢ CÒN THIẾU:</span>
                          <span className={`font-black ${sup.remainingDebt > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'}`}>
                            {formatCurrency(sup.remainingDebt)}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenPurchaseModal(sup.id)}
                          className="h-8 text-xs font-semibold rounded-xl border-blue-200 text-blue-700 hover:bg-blue-50"
                        >
                          <PlusCircle className="h-3.5 w-3.5" />
                          <span>+ Đơn Mua</span>
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleOpenPaymentModal(sup.id)}
                          className="h-8 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <HandCoins className="h-3.5 w-3.5" />
                          <span>Trả Nợ</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop View Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-muted/60 text-muted-foreground border-b border-border">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Tên Nhà Cung Cấp</th>
                        <th className="px-4 py-3 font-semibold">Hạng mục</th>
                        <th className="px-4 py-3 font-semibold">Liên hệ</th>
                        <th className="px-4 py-3 font-semibold text-right">Tổng mua</th>
                        <th className="px-4 py-3 font-semibold text-right">Đã thanh toán</th>
                        <th className="px-4 py-3 font-semibold text-right">Công nợ còn lại</th>
                        <th className="px-4 py-3 font-semibold text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredSuppliers.map((sup) => (
                        <tr key={sup.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-bold text-foreground">{sup.name}</div>
                            {sup.address && (
                              <p className="text-xs text-muted-foreground line-clamp-1">{sup.address}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-xs font-normal bg-background">
                              {sup.category || 'Vật tư'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {sup.phone ? `📞 ${sup.phone}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">
                            {formatCurrency(sup.totalPurchased)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(sup.totalPaid)}
                          </td>
                          <td className="px-4 py-3 text-right font-black text-base">
                            <span className={sup.remainingDebt > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'}>
                              {formatCurrency(sup.remainingDebt)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                onClick={() => handleOpenPaymentModal(sup.id)}
                                className="h-8 px-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                                title="Trả nợ nhà cung cấp"
                              >
                                <HandCoins className="h-3.5 w-3.5 mr-1" />
                                Trả Nợ
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenPurchaseModal(sup.id)}
                                className="h-8 px-2 text-xs font-semibold text-blue-600 border-blue-200 hover:bg-blue-50 rounded-lg"
                                title="Ghi nhận đơn mua mới"
                              >
                                <PlusCircle className="h-3.5 w-3.5 mr-1" />
                                Đơn Mua
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => { setSelectedSupplierForHistory(sup); setIsHistoryModalOpen(true); }}
                                title="Lịch sử giao dịch"
                              >
                                <History className="h-4 w-4" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => handleOpenSupplierModal(sup)}
                                title="Sửa NCC"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteSupplierClick(sup)}
                                title="Xóa NCC"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ================= MODALS SECTION ================= */}

      {/* MODAL 1: ADD / EDIT SUPPLIER */}
      <Dialog open={isSupplierModalOpen} onOpenChange={setIsSupplierModalOpen}>
        <DialogContent className="max-w-md w-[94vw] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Building className="h-5 w-5 text-primary" />
              <span>{editingSupplier ? 'Chỉnh Sửa Nhà Cung Cấp' : 'Thêm Nhà Cung Cấp Mới'}</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveSupplierSubmit} className="space-y-3.5 mt-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Tên Nhà Cung Cấp / Nhà Xưởng <span className="text-destructive">*</span></Label>
              <Input
                required
                placeholder="Ví dụ: Gỗ Minh Long, Phụ kiện Hafele, Gỗ An Cường..."
                value={supName}
                onChange={(e) => setSupName(e.target.value)}
                className="rounded-xl text-xs sm:text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Số điện thoại</Label>
                <Input
                  placeholder="0988..."
                  value={supPhone}
                  onChange={(e) => setSupPhone(e.target.value)}
                  className="rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Loại vật tư cung cấp</Label>
                <Select value={supCategory} onValueChange={(val) => setSupCategory(val)}>
                  <SelectTrigger className="rounded-xl text-xs">
                    <SelectValue>{supCategory}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Gỗ Công Nghiệp">Gỗ Công Nghiệp</SelectItem>
                    <SelectItem value="Phụ Kiện Kim Khí">Phụ Kiện Kim Khí</SelectItem>
                    <SelectItem value="Sơn & Hóa Chất">Sơn & Hóa Chất</SelectItem>
                    <SelectItem value="Kính & Đá">Kính & Đá</SelectItem>
                    <SelectItem value="Mặt Bằng & Xưởng">Mặt Bằng & Xưởng</SelectItem>
                    <SelectItem value="Vật tư">Vật tư chung</SelectItem>
                    <SelectItem value="Khác">Khác</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Địa chỉ / Kho hàng</Label>
              <Input
                placeholder="Địa chỉ nhà cung cấp..."
                value={supAddress}
                onChange={(e) => setSupAddress(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Ghi chú</Label>
              <Textarea
                rows={2}
                placeholder="Ghi chú về tài khoản ngân hàng, liên hệ..."
                value={supNotes}
                onChange={(e) => setSupNotes(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>

            <DialogFooter className="pt-3 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setIsSupplierModalOpen(false)} className="rounded-xl">
                Hủy bỏ
              </Button>
              <Button type="submit" className="rounded-xl bg-primary text-primary-foreground">
                Lưu Nhà Cung Cấp
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: RECORD PURCHASE ORDER (NỢ MỚI) */}
      <Dialog open={isPurchaseModalOpen} onOpenChange={setIsPurchaseModalOpen}>
        <DialogContent className="max-w-lg w-[94vw] max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-blue-600">
              <PlusCircle className="h-5 w-5" />
              <span>Ghi Nhận Đơn Mua Hàng (Phát Sinh Nợ Mới)</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ghi nhận số tiền phát sinh mua vật tư/hàng hóa từ Nhà Cung Cấp
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSavePurchaseSubmit} className="space-y-3.5 mt-1">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Nhà Cung Cấp <span className="text-destructive">*</span></Label>
              <Select value={purSupplierId} onValueChange={(val) => setPurSupplierId(val)}>
                <SelectTrigger className="rounded-xl font-bold">
                  <SelectValue>{suppliers.find(s => s.id === purSupplierId)?.name || 'Chọn Nhà Cung Cấp'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      🏢 {s.name} (Nợ hiện tại: {formatCurrency(s.remainingDebt)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Tổng giá trị đơn mua (VNĐ) <span className="text-destructive">*</span></Label>
                <Input
                  required
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="0"
                  value={purAmount}
                  onChange={(e) => setPurAmount(e.target.value)}
                  className="font-bold text-base rounded-xl"
                />
                {purAmount && !isNaN(parseFloat(purAmount)) && (
                  <p className="text-[11px] text-blue-600 font-semibold">= {formatCurrency(parseFloat(purAmount))}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Ngày hóa đơn / Ngày mua</Label>
                <Input
                  type="date"
                  value={purDate}
                  onChange={(e) => setPurDate(e.target.value)}
                  className="rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Số hóa đơn / Mã đơn hàng</Label>
                <Input
                  placeholder="Ví dụ: HD-99201"
                  value={purInvoiceNo}
                  onChange={(e) => setPurInvoiceNo(e.target.value)}
                  className="rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Trả tiền ngay (nếu có)</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={purPaidImmediately}
                  onChange={(e) => setPurPaidImmediately(e.target.value)}
                  className="rounded-xl text-xs font-bold text-emerald-600"
                />
              </div>
            </div>

            {purPaidImmediately && parseFloat(purPaidImmediately) > 0 && (
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 text-xs space-y-1">
                <div className="flex justify-between font-medium text-emerald-700 dark:text-emerald-400">
                  <span>Tự động tạo Phiếu Chi trả ngay:</span>
                  <span className="font-bold">{formatCurrency(parseFloat(purPaidImmediately))}</span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-muted-foreground">Hình thức:</span>
                  <Select value={purPaymentMethod} onValueChange={(val: any) => setPurPaymentMethod(val)}>
                    <SelectTrigger className="h-7 text-xs rounded-lg bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transfer">🏦 Chuyển khoản</SelectItem>
                      <SelectItem value="cash">💵 Tiền mặt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Ghi chú đơn hàng</Label>
              <Textarea
                rows={2}
                placeholder="Nội dung vật tư, quy cách gỗ, phụ kiện mua..."
                value={purNotes}
                onChange={(e) => setPurNotes(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>

            <DialogFooter className="pt-3 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setIsPurchaseModalOpen(false)} className="rounded-xl">
                Hủy
              </Button>
              <Button type="submit" className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                Lưu Đơn Mua (Tăng Nợ)
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: PAY SUPPLIER (THANH TOÁN TRẢ NỢ NCC -> TỰ ĐỘNG TẠO PHIẾU CHI) */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="max-w-lg w-[94vw] max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-emerald-600">
              <HandCoins className="h-5 w-5" />
              <span>Thanh Toán Công Nợ Cho Nhà Cung Cấp</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Mỗi khoản trả tiền NCC sẽ tự động liên kết tạo 1 <strong>PHIẾU CHI</strong> trong Sổ Quỹ Thu Chi
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSavePaymentSubmit} className="space-y-3.5 mt-1">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Nhà Cung Cấp <span className="text-destructive">*</span></Label>
              <Select value={paySupplierId} onValueChange={(val) => {
                setPaySupplierId(val);
                const found = suppliers.find(s => s.id === val);
                if (found && found.remainingDebt > 0) {
                  setPayAmount(found.remainingDebt.toString());
                }
              }}>
                <SelectTrigger className="rounded-xl font-bold">
                  <SelectValue>{suppliers.find(s => s.id === paySupplierId)?.name || 'Chọn Nhà Cung Cấp'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      🏢 {s.name} (Nợ còn lại: {formatCurrency(s.remainingDebt)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Số tiền thanh toán (VNĐ) <span className="text-destructive">*</span></Label>
                <Input
                  required
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="0"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="font-bold text-base text-emerald-600 rounded-xl"
                />
                {payAmount && !isNaN(parseFloat(payAmount)) && (
                  <p className="text-[11px] text-emerald-600 font-semibold">= {formatCurrency(parseFloat(payAmount))}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Ngày thanh toán</Label>
                <Input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Hình thức thanh toán</Label>
                <Select value={payPaymentMethod} onValueChange={(val: any) => setPayPaymentMethod(val)}>
                  <SelectTrigger className="rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transfer">🏦 Chuyển khoản ngân hàng</SelectItem>
                    <SelectItem value="cash">💵 Tiền mặt</SelectItem>
                    <SelectItem value="other">Ví điện tử / Khác</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Người thực hiện chi (Nội bộ)</Label>
                <Input
                  placeholder="Tên nhân viên chi tiền"
                  value={payHandlerName}
                  onChange={(e) => setPayHandlerName(e.target.value)}
                  className="rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Ghi chú diễn giải</Label>
              <Textarea
                rows={2}
                placeholder="Nội dung diễn giải chi tiền..."
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>

            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Hệ thống tự động đồng bộ hạch toán 1 <strong>PHIẾU CHI</strong> thuộc hạng mục <i>Chi trả công nợ NCC</i> sang Sổ Quỹ Thu Chi.</span>
            </div>

            <DialogFooter className="pt-3 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setIsPaymentModalOpen(false)} className="rounded-xl">
                Hủy
              </Button>
              <Button type="submit" className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                Xác Nhận Thanh Toán (Giảm Nợ)
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: VIEW SUPPLIER DEBT HISTORY */}
      {selectedSupplierForHistory && (
        <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
          <DialogContent className="max-w-2xl w-[94vw] max-h-[90vh] overflow-y-auto rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  <span>Lịch Sử Nợ: {selectedSupplierForHistory.name}</span>
                </div>
              </DialogTitle>
              <DialogDescription className="text-xs">
                SĐT: {selectedSupplierForHistory.phone || 'Chưa có'} | Công nợ hiện tại: <strong className="text-rose-600 font-bold">{formatCurrency(selectedSupplierForHistory.remainingDebt)}</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 mt-2">
              <div className="grid grid-cols-3 gap-2 text-center p-3 rounded-xl bg-muted/40 border border-border text-xs">
                <div>
                  <span className="text-muted-foreground block">Tổng mua:</span>
                  <span className="font-bold text-foreground">{formatCurrency(selectedSupplierForHistory.totalPurchased)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Đã thanh toán:</span>
                  <span className="font-bold text-emerald-600">{formatCurrency(selectedSupplierForHistory.totalPaid)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Nợ còn thiếu:</span>
                  <span className="font-black text-rose-600">{formatCurrency(selectedSupplierForHistory.remainingDebt)}</span>
                </div>
              </div>

              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground pt-1">Nhật Ký Đơn Mua & Thanh Toán</h4>

              {supplierTxs.filter(t => t.supplierId === selectedSupplierForHistory.id).length === 0 ? (
                <p className="text-xs text-center text-muted-foreground py-8">Chưa có lịch sử giao dịch nào được ghi nhận cho nhà cung cấp này.</p>
              ) : (
                <div className="divide-y divide-border border border-border rounded-xl overflow-hidden text-xs">
                  {supplierTxs
                    .filter(t => t.supplierId === selectedSupplierForHistory.id)
                    .map(tx => (
                      <div key={tx.id} className="p-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                        <div>
                          <div className="flex items-center gap-2">
                            {tx.type === 'purchase' ? (
                              <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[10px] font-bold">
                                📦 ĐƠN MUA NỢ
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                                💵 THANH TOÁN
                              </Badge>
                            )}
                            <span className="font-semibold text-foreground">{tx.date}</span>
                            {tx.invoiceNo && <span className="text-muted-foreground font-mono">({tx.invoiceNo})</span>}
                          </div>
                          {tx.notes && <p className="text-[11px] text-muted-foreground italic mt-0.5">{tx.notes}</p>}
                        </div>

                        <div className="text-right">
                          <div className={`font-black text-sm ${tx.type === 'purchase' ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {tx.type === 'purchase' ? '+' : '-'}{formatCurrency(tx.amount)}
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              if (window.confirm("Bạn có chắc muốn xóa bản ghi nợ này?")) {
                                await deleteSupplierTransaction(tx);
                                toast.success("Đã xóa bản ghi giao dịch");
                              }
                            }}
                            className="text-[10px] text-destructive hover:underline mt-0.5"
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* CREATE / EDIT TRANSACTION MODAL (FOR SỔ QUỸ THU CHI) */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl w-[94vw] max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              <span>{editingTransaction ? 'Chỉnh Sửa Phiếu Thu Chi' : 'Tạo Phiếu Thu Chi Mới'}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Nhập thông tin chứng từ, số tiền, hạng mục và tải/chụp ảnh phiếu thu chi
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitForm} className="space-y-4 mt-2">
            {/* Type selector tabs */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setFormType('income');
                  if (formCategory === 'Mua vật tư & phụ kiện' || formCategory === 'Chi phí xưởng & sản xuất') {
                    setFormCategory('Thanh toán hợp đồng');
                  }
                }}
                className={`py-2.5 px-3 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all ${
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
                className={`py-2.5 px-3 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all ${
                  formType === 'expense' 
                    ? 'bg-rose-600 text-white shadow-md' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ArrowUpRight className="h-4 w-4" />
                <span>PHIẾU CHI TIỀN</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                  className="rounded-xl"
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
                  className="font-bold text-base rounded-xl"
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
                  className="rounded-xl"
                />
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <Label className="font-semibold text-xs">Hạng mục</Label>
                <Select value={formCategory} onValueChange={(val) => setFormCategory(val)}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue>
                      {formCategory || 'Chọn hạng mục'}
                    </SelectValue>
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
                    className="mt-1 rounded-xl"
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
                  <SelectTrigger className="rounded-xl">
                    <SelectValue>
                      {formPaymentMethod === 'transfer' ? '🏦 Chuyển khoản ngân hàng' :
                       formPaymentMethod === 'cash' ? '💵 Tiền mặt' : 'Ví điện tử / Khác'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transfer">🏦 Chuyển khoản ngân hàng</SelectItem>
                    <SelectItem value="cash">💵 Tiền mặt</SelectItem>
                    <SelectItem value="other">Ví điện tử / Khác</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Internal Employee Handler */}
              <div className="space-y-1.5">
                <Label className="font-semibold text-xs">
                  {formType === 'income' ? 'Người thu tiền (Nhân viên)' : 'Người chi tiền (Nhân viên)'}
                </Label>
                <Select 
                  value={formHandlerId} 
                  onValueChange={(val) => {
                    setFormHandlerId(val);
                    if (val === 'none') {
                      setFormHandlerName('');
                    } else {
                      const found = members.find(m => m.id === val);
                      if (found) setFormHandlerName(found.name);
                    }
                  }}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue>
                      {formHandlerId === 'none' 
                        ? '-- Chọn nhân viên --' 
                        : (formHandlerName || 'Nhân viên')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Chọn nhân viên --</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        👤 {m.name} {m.role ? `(${m.role})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Payer / Payee */}
              <div className="space-y-1.5">
                <Label className="font-semibold text-xs">
                  {formType === 'income' ? 'Người nộp tiền (Bên ngoài)' : 'Người nhận tiền / Đơn vị bán'}
                </Label>
                <Input
                  placeholder={formType === 'income' ? 'Tên người nộp' : 'Tên người nhận tiền / Nhà cung cấp'}
                  value={formPayerPayee}
                  onChange={(e) => setFormPayerPayee(e.target.value)}
                  className="rounded-xl"
                />
              </div>

              {/* Customer Association */}
              <div className="space-y-1.5">
                <Label className="font-semibold text-xs">Khách hàng liên quan (nếu có)</Label>
                <Select value={formCustomerId} onValueChange={(val) => setFormCustomerId(val)}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue>
                      {formCustomerId === 'none'
                        ? '-- Không chọn --'
                        : (customers.find(c => c.id === formCustomerId)?.name || 'Khách hàng')}
                    </SelectValue>
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
                  <SelectTrigger className="rounded-xl">
                    <SelectValue>
                      {getWorkshopName(formWorkshop)}
                    </SelectValue>
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
                  <span className="text-[11px] text-muted-foreground">Nén & tải tự động</span>
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
                    <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-xs border border-primary/20 transition-colors">
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
                    <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs border border-border transition-colors">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                      <span>Chọn ảnh từ máy</span>
                    </div>
                  </label>

                  {isUploading && (
                    <div className="flex items-center gap-2 text-xs text-primary font-medium">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Đang tải ảnh...</span>
                    </div>
                  )}
                </div>

                {/* Uploaded Photos Thumbnails Preview */}
                {formImageUrls.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2.5 pt-2">
                    {formImageUrls.map((url, idx) => (
                      <div key={idx} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-border shadow-2xs">
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
                  placeholder="Ghi chú diễn giải thêm..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="rounded-xl text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-border flex items-center justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl"
              >
                Hủy bỏ
              </Button>

              <Button 
                type="submit" 
                disabled={isUploading}
                className={`rounded-xl ${formType === 'income' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'}`}
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
          <DialogContent className="max-w-lg w-[94vw] max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-2xl">
            <DialogHeader>
              <div className="flex items-center gap-2 flex-wrap">
                {detailTransaction.type === 'income' ? (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs font-extrabold px-2.5 py-1">
                    🟢 PHIẾU THU TIỀN
                  </Badge>
                ) : (
                  <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 text-xs font-extrabold px-2.5 py-1">
                    🔴 PHIẾU CHI TIỀN
                  </Badge>
                )}
                <DialogTitle className="text-base sm:text-lg font-bold">Chi tiết chứng từ</DialogTitle>
              </div>
            </DialogHeader>

            <div className="space-y-3.5 text-sm mt-1">
              <div>
                <span className="text-[11px] text-muted-foreground block font-medium">Tên khoản / Nội dung:</span>
                <h3 className="font-bold text-foreground text-base sm:text-lg leading-snug mt-0.5">
                  {detailTransaction.title}
                </h3>
              </div>

              {/* High visibility Hero Amount Box */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-muted/80 to-muted/30 border border-border shadow-2xs">
                <span className="text-xs font-semibold text-muted-foreground">Số tiền chứng từ:</span>
                <span className={`text-xl sm:text-2xl font-black ${
                  detailTransaction.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}>
                  {detailTransaction.type === 'income' ? '+' : '-'}{formatCurrency(detailTransaction.amount)}
                </span>
              </div>

              {/* Grid Info Card */}
              <div className="grid grid-cols-2 gap-2.5 text-xs bg-muted/30 p-3.5 rounded-2xl border border-border">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Ngày phát sinh:</span>
                  <span className="font-bold text-foreground">{detailTransaction.date}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Hạng mục:</span>
                  <span className="font-bold text-foreground">{detailTransaction.category}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Hình thức TT:</span>
                  <span className="font-bold text-foreground">
                    {detailTransaction.paymentMethod === 'cash' ? '💵 Tiền mặt' : detailTransaction.paymentMethod === 'transfer' ? '🏦 Chuyển khoản' : 'Khác'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Cơ sở / Xưởng:</span>
                  <span className="font-bold text-foreground">{getWorkshopName(detailTransaction.workshop)}</span>
                </div>

                {detailTransaction.handlerName && (
                  <div className="col-span-2 pt-1 border-t border-border/50">
                    <span className="text-muted-foreground block text-[11px]">
                      {detailTransaction.type === 'income' ? 'Người thu tiền (Nội bộ):' : 'Người chi tiền (Nội bộ):'}
                    </span>
                    <span className="font-bold text-foreground">👤 {detailTransaction.handlerName}</span>
                  </div>
                )}

                {detailTransaction.payerPayee && (
                  <div className="col-span-2 pt-1 border-t border-border/50">
                    <span className="text-muted-foreground block text-[11px]">
                      {detailTransaction.type === 'income' ? 'Người nộp tiền (Bên ngoài):' : 'Người nhận tiền / Nhà cung cấp:'}
                    </span>
                    <span className="font-bold text-foreground">{detailTransaction.payerPayee}</span>
                  </div>
                )}

                {detailTransaction.customerName && (
                  <div className="col-span-2 pt-1 border-t border-border/50">
                    <span className="text-muted-foreground block text-[11px]">Khách hàng liên quan:</span>
                    <span className="font-bold text-primary">{detailTransaction.customerName}</span>
                  </div>
                )}
              </div>

              {detailTransaction.notes && (
                <div className="text-xs space-y-1">
                  <span className="text-muted-foreground font-semibold block text-[11px]">Ghi chú diễn giải:</span>
                  <p className="p-2.5 rounded-xl bg-muted/40 text-foreground italic border border-border/60">
                    {detailTransaction.notes}
                  </p>
                </div>
              )}

              {/* Photos Gallery */}
              {((detailTransaction.imageUrls && detailTransaction.imageUrls.length > 0) || detailTransaction.imageUrl) && (
                <div className="space-y-1.5 pt-2">
                  <span className="text-xs text-muted-foreground block font-semibold">Ảnh chứng từ phiếu chi:</span>
                  <div className="flex flex-wrap gap-2">
                    {(detailTransaction.imageUrls || [detailTransaction.imageUrl]).map((url, idx) => (
                      url ? (
                        <div key={idx} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-border shadow-2xs">
                          <img
                            src={url}
                            alt="Ảnh phiếu chi"
                            onClick={() => setPreviewImage(url)}
                            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white pointer-events-none transition-opacity">
                            <Eye className="h-4 w-4" />
                          </div>
                        </div>
                      ) : null
                    ))}
                  </div>
                </div>
              )}

              <div className="text-[11px] text-muted-foreground pt-3 border-t border-border flex items-center justify-between">
                <span>Người lập: <strong className="text-foreground">{detailTransaction.createdBy || 'Hệ thống'}</strong></span>
                <span>Tạo lúc: {detailTransaction.createdAt ? new Date(detailTransaction.createdAt).toLocaleDateString('vi-VN') : '—'}</span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* FULLSIZE IMAGE PREVIEW MODAL */}
      {previewImage && (
        <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
          <DialogContent className="max-w-4xl w-[95vw] p-2 bg-black/95 border-none text-white flex flex-col items-center justify-center rounded-2xl">
            <div className="relative w-full max-h-[85vh] flex items-center justify-center">
              <img
                src={previewImage}
                alt="Xem đầy đủ ảnh phiếu chi chứng từ"
                className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* OPENING BALANCE SETUP MODAL (QUỸ BAN ĐẦU / SỐ DƯ ĐẦU KỲ) */}
      <Dialog open={isOBModalOpen} onOpenChange={setIsOBModalOpen}>
        <DialogContent className="max-w-md w-[94vw] p-4 sm:p-6 rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
                <PiggyBank className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold">Cấu Hình Số Dư Đầu Kỳ (Quỹ Ban Đầu)</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Thiết lập số dư Tiền mặt & Chuyển khoản ban đầu làm mốc tính Sổ Quỹ Kế Toán
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSaveOpeningBalanceSubmit} className="space-y-4 mt-2">
            {/* Cash Balance Input */}
            <div className="space-y-1.5">
              <Label className="font-semibold text-xs flex items-center justify-between">
                <span>💵 Quỹ Tiền Mặt Đầu Kỳ (VNĐ)</span>
                <span className="text-[11px] text-muted-foreground font-normal">Tiền két / tại xưởng</span>
              </Label>
              <Input
                type="number"
                placeholder="Nhập số tiền mặt..."
                value={obCashBalance}
                onChange={(e) => setObCashBalance(e.target.value)}
                className="rounded-xl font-bold text-sm"
              />
            </div>

            {/* Bank Balance Input */}
            <div className="space-y-1.5">
              <Label className="font-semibold text-xs flex items-center justify-between">
                <span>🏦 Tiền Gửi Ngân Hàng Đầu Kỳ (VNĐ)</span>
                <span className="text-[11px] text-muted-foreground font-normal">Tài khoản công ty / chủ xưởng</span>
              </Label>
              <Input
                type="number"
                placeholder="Nhập số tiền chuyển khoản..."
                value={obBankBalance}
                onChange={(e) => setObBankBalance(e.target.value)}
                className="rounded-xl font-bold text-sm"
              />
            </div>

            {/* Total summary helper badge */}
            <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 flex items-center justify-between text-xs">
              <span className="font-medium text-purple-900 dark:text-purple-200">Tổng Quỹ Ban Đầu:</span>
              <span className="font-black text-purple-700 dark:text-purple-300 text-sm">
                {formatCurrency((parseFloat(obCashBalance) || 0) + (parseFloat(obBankBalance) || 0))}
              </span>
            </div>

            {/* Start Date Input */}
            <div className="space-y-1.5">
              <Label className="font-semibold text-xs">Ngày chốt sổ đầu kỳ</Label>
              <Input
                type="date"
                value={obStartDate}
                onChange={(e) => setObStartDate(e.target.value)}
                className="rounded-xl text-xs"
              />
              <p className="text-[10px] text-muted-foreground italic">
                Các phiếu thu chi phát sinh từ ngày này trở về sau sẽ được cộng/trừ trực tiếp vào quỹ ban đầu.
              </p>
            </div>

            {/* Accountant Notes */}
            <div className="space-y-1.5">
              <Label className="font-semibold text-xs">Ghi chú kế toán / Nguồn vốn</Label>
              <Textarea
                rows={2}
                placeholder="Ví dụ: Số dư chốt bàn giao tài chính xưởng..."
                value={obNotes}
                onChange={(e) => setObNotes(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>

            <DialogFooter className="pt-3 border-t border-border flex items-center justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsOBModalOpen(false)}
                className="rounded-xl text-xs"
              >
                Hủy bỏ
              </Button>

              <Button 
                type="submit" 
                disabled={obSaving}
                className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold"
              >
                {obSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ShieldCheck className="h-4 w-4 mr-1" />}
                Lưu Quỹ Ban Đầu
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
