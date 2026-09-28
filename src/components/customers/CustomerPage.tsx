import * as React from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { Task, Customer, CustomerStage, CustomerType, Member, WORKSHOPS, getWorkshopName, getNormalizedWorkshopId, updateCodePrefix, Quotation, MeasurementSchedule } from '@/src/types';
import { sendSystemNotification, getBotNotificationConfig, sendZaloTestMessage } from '@/src/services/botNotificationService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  FileText,
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
  Palette, 
  Factory, Package, AlertTriangle,
  UserCheck, Users, Target, Map, LayoutGrid, Upload, Download, RefreshCw,
  Pencil, ChevronDown, ChevronUp, Building2, Cog, Home, ShoppingBag
} from 'lucide-react';
import { CustomerWorkflowHistory } from './CustomerWorkflowHistory';
import { LocationPickerDialog } from '../maps/LocationPickerDialog';
import { MapComponent, CustomMarker } from '../maps/MapComponent';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { cn, getCurrentVNMonth, getCurrentVNYear, formatVNTime, getVNMonth, calculateDistance, geocodeAddressOSM } from '@/src/lib/utils';
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
import { writeBatch } from 'firebase/firestore';
import { notifyManagers } from '@/src/services/notificationService';
import { moveToTrash } from '@/src/services/trashService';
import { fetchSystemSettings, updateSystemSettings } from '@/src/services/dataService';


const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | undefined> => {
  return await geocodeAddressOSM(address);
};

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
  onCreateQuotation?: (customerId: string) => void;
  onViewQuotation?: (quotationId: string, customerName: string) => void;
}

const STAGE_CONFIG: Record<CustomerStage, { label: string; color: string; icon: any }> = {
  consulting: { label: 'Đã tư vấn', color: 'bg-yellow-50 text-yellow-600 border-yellow-200', icon: MessageSquare },
  surveying: { label: 'Đã đo đạc', color: 'bg-purple-50 text-purple-600 border-purple-200', icon: MapPin },
  contracted: { label: 'Chốt Cọc', color: 'bg-emerald-50 text-emerald-600 border-emerald-200', icon: ArrowRight },
  production: { label: 'Sản xuất', color: 'bg-blue-50 text-blue-600 border-blue-200', icon: Factory },
  production_completed: { label: 'Hoàn tất sản xuất', color: 'bg-indigo-50 text-indigo-600 border-indigo-200', icon: CheckCircle2 },
  installation: { label: 'Lắp đặt', color: 'bg-orange-50 text-orange-600 border-orange-200', icon: Package },
  completed: { label: 'Hoàn thành', color: 'bg-green-50 text-green-600 border-green-200', icon: CheckCircle2 },
  lost: { label: 'Tạm dừng', color: 'bg-red-50 text-red-600 border-red-200', icon: X },
};

const STAGE_MARKER_COLORS: Record<CustomerStage, string> = {
  consulting: 'bg-amber-500',
  surveying: 'bg-purple-600',
  contracted: 'bg-emerald-600',
  production: 'bg-blue-600',
  production_completed: 'bg-indigo-600',
  installation: 'bg-orange-500',
  completed: 'bg-green-600',
  lost: 'bg-rose-600',
};

export function CustomerPage({ 
  customers, 
  setCustomers, 
  tasks, 
  setTasks, 
  members, 
  quotations, 
  schedules, 
  user, 
  currentUser,
  onCreateQuotation,
  onViewQuotation
}: CustomerPageProps) {
  const queryClient = useQueryClient();

  const getTargetModule = (stage: string) => {
    if (stage === 'surveying') return 'measurements';
    if (stage === 'contracted') return 'design';
    if (stage === 'production' || stage === 'production_completed' || stage === 'installation') return 'production';
    return 'customers';
  };

  const { data: systemSettings } = useQuery({
    queryKey: ['systemSettings'],
    queryFn: fetchSystemSettings,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: updateSystemSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systemSettings'] });
      toast.success("Đã cập nhật vị trí xưởng!");
    },
    onError: () => {
      toast.error("Lỗi khi cập nhật cấu hình hệ thống");
    }
  });

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const bstr = evt.target?.result;
        if (typeof bstr !== 'string') return;
        
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        if (data.length === 0) {
          toast.error("File Excel trống");
          return;
        }

        let importedCount = 0;
        const nowStr = new Date().toISOString();

        for (const row of data as any[]) {
          // Map columns (Tên, SĐT, Địa chỉ, Nhu cầu)
          const name = row['Tên'] || row['Name'] || row['Khách hàng'] || '';
          const phone = row['SĐT'] || row['Phone'] || row['Số điện thoại'] || '';
          const address = row['Địa chỉ'] || row['Address'] || '';
          const notes = row['Ghi chú'] || row['Nhu cầu'] || '';
          const stageStr = row['Trạng thái'] || row['Stage'] || '';
          
          if (!name || !phone) continue; // Skip rows without name or phone

          let stage: CustomerStage = 'consulting';
          if (stageStr.toLowerCase().includes('khảo sát')) stage = 'surveying';
          else if (stageStr.toLowerCase().includes('chốt cọc')) stage = 'contracted';
          else if (stageStr.toLowerCase().includes('hoàn tất sản xuất')) stage = 'production_completed';
          else if (stageStr.toLowerCase().includes('sản xuất')) stage = 'production';
          else if (stageStr.toLowerCase().includes('lắp đặt')) stage = 'installation';
          else if (stageStr.toLowerCase().includes('hoàn thành')) stage = 'completed';
          else if (stageStr.toLowerCase().includes('tạm dừng')) stage = 'lost';

          const newId = Math.random().toString(36).substr(2, 9);
          const rowWorkshop = row['Cơ sở'] || row['Workshop'] || row['Xưởng'] || '';
          const finalWs = rowWorkshop ? getNormalizedWorkshopId(rowWorkshop) : (currentUser?.workshop && currentUser?.workshop !== 'all' ? getNormalizedWorkshopId(currentUser.workshop) : 'Hà Nội');
          
          let prefix = 'HN';
          if (finalWs === 'Cần Thơ') prefix = 'CT';
          else if (finalWs === 'Đồng Nai') prefix = 'ĐN';

           const newCode = `${prefix}${getCurrentVNYear()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
           const needsStageUpdateAfterCreate = ['production', 'production_completed', 'installation', 'completed'].includes(stage);
           const initialStage = needsStageUpdateAfterCreate ? 'consulting' : stage;

           const docRef = await addDoc(collection(db, 'customers'), {
             id: newId,
             code: newCode,
             name,
             phone: String(phone),
             address,
             stage: initialStage,
             notes,
             assignedSaleId: currentUser?.id || '',
             workshop: finalWs,
             createdAt: nowStr,
             orderValue: 0
           });

          if (needsStageUpdateAfterCreate) {
            await updateDoc(doc(db, 'customers', docRef.id), { stage });
          }
          importedCount++;
        }

        // Notify managers about bulk import
        if (importedCount > 0) {
          sendSystemNotification(`🌟 Khách hàng mới (Import từ Excel)!\n\nSale ${currentUser?.name || 'Hệ thống'} vừa import thành công ${importedCount} khách hàng mới vào hệ thống.`, 'customers');
        }

        toast.success(`Đã nhập thành công ${importedCount} khách hàng`);
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsBinaryString(file);
    } catch (error) {
      console.error("Lỗi khi đọc file Excel:", error);
      toast.error("Lỗi khi đọc file. Vui lòng kiểm tra lại định dạng.");
    }
  };

  const handleExportExcel = async () => {
    try {
      if (filteredCustomers.length === 0) {
        toast.error("Không có dữ liệu khách hàng để xuất");
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Danh Sách Khách Hàng', {
        pageSetup: { paperSize: 9, orientation: 'landscape' }
      });

      // Set columns
      sheet.columns = [
        { width: 8 },   // STT
        { width: 15 },  // Mã KH
        { width: 25 },  // Họ và Tên
        { width: 15 },  // Số điện thoại
        { width: 40 },  // Địa chỉ
        { width: 25 },  // Hạng mục
        { width: 18 },  // Trạng thái
        { width: 20 },  // Trị giá đơn (VNĐ)
        { width: 22 },  // Sale phụ trách
        { width: 15 },  // Ngày tạo
        { width: 45 },  // Ghi chú
      ];

      // Helper function to add merged headers
      const addTitleHeader = (text: string, bold: boolean, size: number, colorHex: string, italic = false) => {
        const row = sheet.addRow([text]);
        sheet.mergeCells(row.number, 1, row.number, 11);
        const cell = row.getCell(1);
        cell.font = { name: 'Times New Roman', bold, size, italic, color: { argb: colorHex } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        row.height = size * 1.8;
        return row;
      };

      // Header Brand Info
      addTitleHeader('CÔNG TY CỔ PHẦN QUỐC TẾ I NỘI THẤT', true, 13, 'FF1E3A8A');
      addTitleHeader('Địa chỉ: Số 12, Đường 3, KCN Bắc Thăng Long, Đông Anh, Hà Nội', false, 10, 'FF4B5563');
      addTitleHeader('Điện thoại: 0976.191.583 - 0983.487.411 | Website: i-noi-that.vercel.app', false, 10, 'FF4B5563');
      
      const spaceRow = sheet.addRow([]);
      spaceRow.height = 10;

      let docTitle = 'DANH SÁCH TOÀN BỘ KHÁCH HÀNG';
      if (selectedMonth === 'today') {
        docTitle = 'DANH SÁCH KHÁCH HÀNG - HÔM NAY';
      } else if (selectedMonth === 'week') {
        docTitle = 'DANH SÁCH KHÁCH HÀNG - TUẦN NÀY';
      } else if (selectedMonth === 'last-week') {
        docTitle = 'DANH SÁCH KHÁCH HÀNG - TUẦN TRƯỚC';
      } else if (selectedMonth) {
        const [year, month] = selectedMonth.split('-');
        docTitle = `DANH SÁCH KHÁCH HÀNG THÁNG ${month}/${year}`;
      }
      addTitleHeader(docTitle, true, 16, 'FF1E3A8A');
      
      const today = new Date();
      const dateString = `Ngày xuất file: ${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
      addTitleHeader(dateString, false, 11, 'FF374151', true);

      const spaceRow2 = sheet.addRow([]);
      spaceRow2.height = 15;

      // Table Header Row
      const headerRow = sheet.addRow([
        'STT', 
        'MÃ KH', 
        'HỌ VÀ TÊN', 
        'SỐ ĐIỆN THOẠI', 
        'ĐỊA CHỈ', 
        'HẠNG MỤC',
        'TRẠNG THÁI',
        'GIÁ TRỊ ĐƠN (VNĐ)',
        'SALE PHỤ TRÁCH',
        'NGÀY TẠO',
        'GHI CHÚ'
      ]);
      headerRow.height = 28;

      // Style Table Headers
      for (let i = 1; i <= 11; i++) {
        const cell = headerRow.getCell(i);
        cell.font = { name: 'Times New Roman', bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1E3A8A' } // Brand dark blue
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF94A3B8' } },
          left: { style: 'thin', color: { argb: 'FF94A3B8' } },
          bottom: { style: 'medium', color: { argb: 'FF1E3A8A' } },
          right: { style: 'thin', color: { argb: 'FF94A3B8' } }
        };
      }

      const stageNames: Record<string, string> = {
        'consulting': 'Đã tư vấn',
        'surveying': 'Đã đo đạc',
        'contracted': 'Chốt cọc',
        'production': 'Sản xuất',
        'installation': 'Lắp đặt',
        'completed': 'Hoàn thành',
        'lost': 'Tạm dừng',
        'lead': 'Tiềm năng',
      };

      // Add Data Rows
      filteredCustomers.forEach((c, idx) => {
        const saleName = members.find(m => m.id === c.assignedSaleId)?.name || 'Chưa gán';
        const stageName = stageNames[c.stage] || c.stage;
        const createdDate = c.createdAt ? new Date(c.createdAt).toLocaleDateString('vi-VN') : '—';

        // Calculate actual order value matching card/KPI display (quotations if any, else orderValue)
        const customerQuotations = quotations.filter(q => q.customerId === c.id || (q.customerName === c.name && q.phone === c.phone));
        const validQuotations = customerQuotations.filter(q => q.status === 'accepted' || q.status === 'deposit');
        const finalOrderValue = validQuotations.length > 0
          ? validQuotations.reduce((sum, q) => sum + (q.totalAmount || 0), 0)
          : (c.orderValue || 0);

        const dataRow = sheet.addRow([
          idx + 1,
          c.code || `KH${String(idx + 1).padStart(3, '0')}`,
          c.name || '',
          c.phone || '',
          c.address || '—',
          c.furnitureCategory || '—',
          stageName || '—',
          finalOrderValue,
          saleName,
          createdDate,
          c.notes || ''
        ]);
        dataRow.height = 24;

        // Apply styles to data row cells
        for (let i = 1; i <= 11; i++) {
          const cell = dataRow.getCell(i);
          cell.font = { name: 'Times New Roman', size: 11 };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };

          // Alternating backgrounds (zebra styling)
          if (idx % 2 === 1) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF8FAFC' }
            };
          }

          // Alignment
          if (i === 1 || i === 2 || i === 4 || i === 7 || i === 10) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else if (i === 8) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = '#,##0" ₫"';
          } else {
            cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
          }
        }
      });

      // Total summary row
      const totalRowNumber = sheet.lastRow!.number + 1;
      const totalRow = sheet.addRow([]);
      totalRow.height = 26;

      sheet.mergeCells(totalRowNumber, 1, totalRowNumber, 7);
      const labelCell = totalRow.getCell(1);
      labelCell.value = 'TỔNG CỘNG';
      labelCell.font = { name: 'Times New Roman', bold: true, size: 11 };
      labelCell.alignment = { horizontal: 'right', vertical: 'middle' };

      const totalValCell = totalRow.getCell(8);
      // sum order value formula starting from row 9
      const lastDataRowStr = totalRowNumber - 1;
      totalValCell.value = {
        formula: `SUM(H9:H${lastDataRowStr})`,
        result: filteredCustomers.reduce((sum, c) => {
          const customerQuotations = quotations.filter(q => q.customerId === c.id || (q.customerName === c.name && q.phone === c.phone));
          const validQuotations = customerQuotations.filter(q => q.status === 'accepted' || q.status === 'deposit');
          const finalVal = validQuotations.length > 0
            ? validQuotations.reduce((s, q) => s + (q.totalAmount || 0), 0)
            : (c.orderValue || 0);
          return sum + finalVal;
        }, 0)
      };
      totalValCell.font = { name: 'Times New Roman', bold: true, size: 11 };
      totalValCell.alignment = { horizontal: 'right', vertical: 'middle' };
      totalValCell.numFmt = '#,##0" ₫"';

      // border and fill for summary row
      for (let i = 1; i <= 11; i++) {
        const cell = totalRow.getCell(i);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF1F5F9' }
        };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF1E3A8A' } },
          bottom: { style: 'double', color: { argb: 'FF1E3A8A' } },
          left: { style: 'thin', color: { argb: 'FF94A3B8' } },
          right: { style: 'thin', color: { argb: 'FF94A3B8' } }
        };
      }

      // spacing
      const signSpace = sheet.addRow([]);
      signSpace.height = 20;

      // Add signature row
      const signRow = sheet.addRow([]);
      signRow.height = 20;
      sheet.mergeCells(signRow.number, 8, signRow.number, 11);
      const signTitleCell = signRow.getCell(8);
      signTitleCell.value = 'Người Lập Biểu';
      signTitleCell.font = { name: 'Times New Roman', bold: true, size: 11 };
      signTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

      const signSubRow = sheet.addRow([]);
      signSubRow.height = 15;
      sheet.mergeCells(signSubRow.number, 8, signSubRow.number, 11);
      const signSubCell = signSubRow.getCell(8);
      signSubCell.value = '(Ký, ghi rõ họ tên)';
      signSubCell.font = { name: 'Times New Roman', italic: true, size: 10, color: { argb: 'FF6B7280' } };
      signSubCell.alignment = { horizontal: 'center', vertical: 'middle' };

      // Write and save file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      let filename = 'Danh_Sach_Khach_Hang';
      if (selectedMonth && selectedMonth !== 'today' && selectedMonth !== 'week') {
        filename += `_Thang_${selectedMonth.replace('-', '_')}`;
      } else if (selectedMonth) {
        filename += `_${selectedMonth}`;
      }
      
      saveAs(blob, `${filename}.xlsx`);
      toast.success("Xuất file Excel khách hàng thành công!");

    } catch (err: any) {
      console.error("Export Excel error:", err);
      toast.error("Lỗi khi xuất file Excel: " + (err.message || 'Thử lại sau'));
    }
  };

  const [isSettingFactory, setIsSettingFactory] = React.useState(false);
  const [isFactoryAddressDialogOpen, setIsFactoryAddressDialogOpen] = React.useState(false);
  const [factoryAddressInput, setFactoryAddressInput] = React.useState('');
  const [isGeocodingFactory, setIsGeocodingFactory] = React.useState(false);

  const handleMapClick = (e: { lngLat: { lng: number; lat: number } }) => {
    if (isSettingFactory) {
      updateSettingsMutation.mutate({ factoryLocation: e.lngLat });
      setIsSettingFactory(false);
    }
  };

  const handleSetFactoryByAddress = async () => {
    if (!factoryAddressInput.trim()) return;
    setIsGeocodingFactory(true);
    try {
      const coords = await geocodeAddress(factoryAddressInput);
      if (coords) {
        updateSettingsMutation.mutate({ factoryLocation: coords });
        setIsFactoryAddressDialogOpen(false);
        setFactoryAddressInput('');
      } else {
        toast.error("Không tìm thấy tọa độ cho địa chỉ này, vui lòng nhập chi tiết hơn.");
      }
    } catch (err) {
      toast.error("Lỗi khi tìm kiếm địa chỉ.");
    } finally {
      setIsGeocodingFactory(false);
    }
  };
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedStage, setSelectedStage] = React.useState<CustomerStage | 'all' | 'quoted' | 'unquoted' | 'contracted_last_month'>('all');
  const [selectedGroup, setSelectedGroup] = React.useState<'all' | 'project' | 'processing' | 'residential'>('all');
  const [groupMode, setGroupMode] = React.useState<'by_order' | 'by_customer'>('by_customer');
  const [isKpiCollapsed, setIsKpiCollapsed] = React.useState(false);
  const [activeCustomerType, setActiveCustomerType] = React.useState<CustomerType>('retail');
  const [selectedWorkshop, setSelectedWorkshop] = React.useState(
    currentUser?.workshop && currentUser?.workshop !== 'all' ? currentUser.workshop : 'all'
  );
  const [selectedMonth, setSelectedMonth] = React.useState<string>(() => getCurrentVNMonth()); // YYYY-MM
  const [selectedSaleId, setSelectedSaleId] = React.useState<string>('all');
  const [pickerYear, setPickerYear] = React.useState<number>(getCurrentVNYear());
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = React.useState(false);
  const [selectedCustomer, setSelectedCustomer] = React.useState<Customer | null>(null);
  const [newNoteContent, setNewNoteContent] = React.useState('');
  const [pendingContract, setPendingContract] = React.useState<{
    customer: Customer;
    isNew: boolean;
  } | null>(null);
  const [targetDesignerId, setTargetDesignerId] = React.useState<string>('');
  const [locationPickerFor, setLocationPickerFor] = React.useState<'add' | 'edit' | null>(null);
  const [viewMode, setViewMode] = React.useState<'grid' | 'map'>('grid');
  
  const [isSaving, setIsSaving] = React.useState(false);
  const isSavingRef = React.useRef(false);
  const [geocodingProgress, setGeocodingProgress] = React.useState<{ current: number; total: number } | null>(null);
  const isGeocodingRef = React.useRef(false);
  const failedGeocodesRef = React.useRef<Set<string>>(new Set());
  
  const [newCustomer, setNewCustomer] = React.useState({
    name: '',
    phone: '',
    address: '',
    notes: '',
    assignedSaleId: currentUser?.id || '',
    stage: 'consulting' as CustomerStage,
    customerType: 'retail' as CustomerType,
    orderValue: 0,
    oneDriveLink: '',
    furnitureCategory: '',
    workshop: currentUser?.workshop && currentUser?.workshop !== 'all' ? currentUser.workshop : WORKSHOPS[1].id,
    location: undefined as { lat: number, lng: number } | undefined,
    nextContactDate: '',
  });

  // Update default assignedSaleId when currentUser changes
  React.useEffect(() => {
    if (currentUser && !newCustomer.assignedSaleId) {
      setNewCustomer(prev => ({ ...prev, assignedSaleId: currentUser.id }));
    }
  }, [currentUser]);

  // Background geocoding for existing customers without location
  React.useEffect(() => {
    if (isGeocodingRef.current) return;

    // Filter customers who have address but no location and haven't failed previously
    const pendingCustomers = customers.filter(
      c => c.address && c.address.trim().length > 3 && !c.location && !failedGeocodesRef.current.has(c.id)
    );

    if (pendingCustomers.length === 0) {
      setGeocodingProgress(null);
      return;
    }

    const runBackgroundGeocoding = async () => {
      isGeocodingRef.current = true;
      setGeocodingProgress({ current: 0, total: pendingCustomers.length });

      for (let i = 0; i < pendingCustomers.length; i++) {
        const customer = pendingCustomers[i];
        
        // Skip if location was added in the meantime
        if (customer.location) continue;

        try {
          const loc = await geocodeAddress(customer.address);
          if (loc) {
            if (user) {
              await updateDoc(doc(db, 'customers', customer.id), { location: loc });
            } else {
              setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, location: loc } : c));
            }
          } else {
            // Mark as failed to avoid infinite loop attempts
            failedGeocodesRef.current.add(customer.id);
          }
        } catch (error) {
          console.error(`Error background geocoding customer ${customer.name}:`, error);
          failedGeocodesRef.current.add(customer.id);
        }

        setGeocodingProgress({ current: i + 1, total: pendingCustomers.length });
        
        // Wait 1.2s to satisfy Nominatim rate limits
        await new Promise(resolve => setTimeout(resolve, 1200));
      }

      isGeocodingRef.current = false;
      setGeocodingProgress(null);
    };

    runBackgroundGeocoding();
  }, [customers, user, setCustomers]);

  const formatCurrency = (value?: number) => {
    const isManager = !!(currentUser?.role && ['quản lý', 'giám đốc', 'trợ lý', 'kế toán', 'chủ sở hữu', 'admin'].some(r => currentUser.role.toLowerCase().includes(r)));
    if (currentUser?.permissions?.viewPrice === false && !isManager) return '*** ₫';
    if (value === undefined) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  };

  const runMigration = async () => {
    const canMigrate = !!(currentUser?.role && ['giám đốc', 'tổng quản lý', 'chủ sở hữu', 'admin'].some(r => currentUser.role.toLowerCase().includes(r)));
    if (!canMigrate) {
      toast.error("Chỉ quản trị viên hoặc ban giám đốc mới có quyền thực hiện đồng bộ dữ liệu.");
      return;
    }

    const toastId = toast.loading("Đang chuẩn hoá mã khách hàng & cơ sở...");
    try {
      const batch = writeBatch(db);
      let count = 0;
      
      for (const customer of customers) {
        let changed = false;
        const updatePayload: any = {};
        
        // 1. Normalize workshop
        let newWorkshop = customer.workshop;
        if (customer.workshop) {
          const cleanWs = customer.workshop.trim();
          if (cleanWs === 'CoSo1' || cleanWs === 'XuongGo' || cleanWs === 'Cơ Sở 1') {
            newWorkshop = 'Hà Nội';
          } else if (cleanWs === 'CoSo2' || cleanWs === 'XuongNhua' || cleanWs === 'Cơ Sở 2') {
            newWorkshop = 'Cần Thơ';
          } else if (cleanWs === 'CoSo3' || cleanWs === 'Cơ Sở 3') {
            newWorkshop = 'Đồng Nai';
          }
        } else {
          newWorkshop = 'Hà Nội';
        }
        
        if (newWorkshop !== customer.workshop) {
          updatePayload.workshop = newWorkshop;
          changed = true;
        }
        
        // 2. Normalize customer code prefix
        const code = customer.code;
        if (code) {
          let newPrefix = 'HN';
          if (newWorkshop === 'Cần Thơ') newPrefix = 'CT';
          else if (newWorkshop === 'Đồng Nai') newPrefix = 'ĐN';
          
          if (code.startsWith('KH')) {
            updatePayload.code = code.replace(/^KH/, newPrefix);
            changed = true;
          } else if (!code.startsWith('HN') && !code.startsWith('CT') && !code.startsWith('ĐN')) {
            const cleanCode = code.replace(/^([a-zA-ZÀ-Ỹà-ỹ\s]+)?/u, '');
            updatePayload.code = `${newPrefix}${cleanCode}`;
            changed = true;
          }
        } else {
          let newPrefix = 'HN';
          if (newWorkshop === 'Cần Thơ') newPrefix = 'CT';
          else if (newWorkshop === 'Đồng Nai') newPrefix = 'ĐN';
          const indexStr = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
          updatePayload.code = `${newPrefix}${indexStr}_${customer.name || 'UnNamed'}`;
          changed = true;
        }
        
        if (changed) {
          const docRef = doc(db, 'customers', customer.id);
          batch.update(docRef, updatePayload);
          count++;
        }
      }
      
      // Also migrate members workshop names
      for (const member of members) {
        if (member.workshop) {
          const cleanWs = member.workshop.trim();
          let newWorkshop = member.workshop;
          if (cleanWs === 'CoSo1' || cleanWs === 'XuongGo' || cleanWs === 'Cơ Sở 1') {
            newWorkshop = 'Hà Nội';
          } else if (cleanWs === 'CoSo2' || cleanWs === 'XuongNhua' || cleanWs === 'Cơ Sở 2') {
            newWorkshop = 'Cần Thơ';
          } else if (cleanWs === 'CoSo3' || cleanWs === 'Cơ Sở 3') {
            newWorkshop = 'Đồng Nai';
          }
          
          if (newWorkshop !== member.workshop) {
            const docRef = doc(db, 'members', member.id);
            batch.update(docRef, { workshop: newWorkshop });
            count++;
          }
        }
      }
      
      if (count > 0) {
        await batch.commit();
        toast.success(`Đã chuẩn hoá đồng bộ thành công ${count} bản ghi!`, { id: toastId });
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        toast.info("Tất cả mã khách hàng & cơ sở đã được chuẩn hoá trước đó.", { id: toastId });
      }
    } catch (err) {
      console.error(err);
      toast.error("Lỗi đồng bộ dữ liệu: " + (err instanceof Error ? err.message : String(err)), { id: toastId });
    }
  };

  const handleAddCustomer = async () => {
    if (isSavingRef.current) return;
    if (!newCustomer.name || !newCustomer.phone) {
      toast.error("Vui lòng nhập tên và số điện thoại");
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    try {

    const normalizedWs = getNormalizedWorkshopId(newCustomer.workshop);
    const wsCustomers = customers.filter(c => getNormalizedWorkshopId(c.workshop) === normalizedWs);
    const codeIndex = String(wsCustomers.length + 1).padStart(3, '0');
    
    let prefix = 'HN';
    if (normalizedWs === 'Cần Thơ') prefix = 'CT';
    else if (normalizedWs === 'Đồng Nai') prefix = 'ĐN';
    
    const customerCode = `${prefix}${codeIndex}_${newCustomer.name}`;

    const nowStr = new Date().toISOString();
    let finalLocation = newCustomer.location;
    if (!finalLocation && newCustomer.address && newCustomer.address.trim().length > 3) {
      const toastId = toast.loading("Đang tự động định vị địa chỉ khách hàng...");
      const loc = await geocodeAddress(newCustomer.address);
      toast.dismiss(toastId);
      if (loc) {
        finalLocation = loc;
        toast.success("Đã tự động định vị thành công!");
      }
    }

    // Ensure location object is either fully valid coordinates or null
    const validLocation = (finalLocation && typeof finalLocation.lat === 'number' && !isNaN(finalLocation.lat) && typeof finalLocation.lng === 'number' && !isNaN(finalLocation.lng))
      ? { lat: finalLocation.lat, lng: finalLocation.lng }
      : null;

    // Automatically set up callback to next day if stage is 'consulting' (Đã tư vấn)
    let finalNextContactDate = newCustomer.nextContactDate;
    if (newCustomer.stage === 'consulting') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      finalNextContactDate = tomorrow.toISOString().split('T')[0];
    }

    const needsStageUpdateAfterCreate = ['production', 'production_completed', 'installation', 'completed'].includes(newCustomer.stage);
    const initialStage = needsStageUpdateAfterCreate ? 'consulting' : newCustomer.stage;

    const customerData = {
      ...newCustomer,
      stage: initialStage,
      location: validLocation,
      code: customerCode,
      createdAt: nowStr,
      consultedAt: nowStr,
      nextContactDate: finalNextContactDate,
    };

    // Clean undefined values for Firestore compatibility
    Object.keys(customerData).forEach(key => {
      if ((customerData as any)[key] === undefined) {
        delete (customerData as any)[key];
      }
    });

    let createdCustomerId = '';
      
      const taskScheduledDate = newCustomer.stage === 'consulting' ? finalNextContactDate : nowStr.split('T')[0];
      const taskTitle = newCustomer.stage === 'consulting' 
        ? `Gọi lại tư vấn: ${customerData.name}` 
        : `Tiếp nhận Lead: ${customerData.name}`;
      const taskDescription = newCustomer.stage === 'consulting' 
        ? `Lịch hẹn gọi lại lúc 8h sáng ngày ${finalNextContactDate.split('-').reverse().join('/')}. SĐT: ${customerData.phone}. Địa chỉ: ${customerData.address || 'Chưa cập nhật'}. Ghi chú: ${customerData.notes || 'Không có'}`
        : `Khách hàng mới. SĐT: ${customerData.phone}. Địa chỉ: ${customerData.address}.`;

      if (user) {
        const docRef = await addDoc(collection(db, 'customers'), customerData);
        createdCustomerId = docRef.id;

        if (needsStageUpdateAfterCreate) {
          await updateDoc(doc(db, 'customers', createdCustomerId), { stage: newCustomer.stage });
        }
        
        // Notify managers about the new customer
        notifyManagers(
          'Khách hàng mới',
          `Sale ${currentUser?.name || 'nào đó'} vừa tạo khách hàng mới: ${customerData.name} (${customerData.phone})`
        );

        // Send to external bot platforms (Zalo/Telegram)
        sendSystemNotification(`🌟 Khách hàng mới!\n\n👤 Tên: ${customerData.name}\n📞 SĐT: ${customerData.phone}\n📍 Địa chỉ: ${customerData.address || 'Chưa cập nhật'}\n📝 Hạng mục: ${customerData.furnitureCategory || 'Không có'}\n\nĐược tạo bởi: ${currentUser?.name || 'Hệ thống'}`, 'customers', customerData.workshop);

        // Auto-sync to Sale Weekly Plan
        const newSaleTask = {
          title: taskTitle,
          description: taskDescription,
          status: 'todo' as const,
          type: 'sale' as const,
          priority: 'medium' as const,
          assigneeId: customerData.assignedSaleId || currentUser?.id || '',
          customerId: createdCustomerId,
          createdAt: nowStr,
          scheduledDate: taskScheduledDate,
          dueDate: taskScheduledDate,
          workshop: customerData.workshop || (currentUser?.workshop && currentUser.workshop !== 'all' ? currentUser.workshop : 'all'),
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
          title: taskTitle,
          description: taskDescription,
          status: 'todo',
          type: 'sale',
          priority: 'medium',
          assigneeId: customerData.assignedSaleId || currentUser?.id || '',
          customerId: createdCustomerId,
          createdAt: nowStr,
          scheduledDate: taskScheduledDate,
          dueDate: taskScheduledDate,
          workshop: customerData.workshop || (currentUser?.workshop && currentUser.workshop !== 'all' ? currentUser.workshop : 'all'),
        };
        setTasks((prev) => [newSaleTask, ...prev]);
      }
      
      // Notify the directly assigned sale member via Zalo
      const saleMember = members.find(m => m.id === customerData.assignedSaleId);
      if (saleMember && saleMember.zaloUserId) {
        try {
          const botConfig = await getBotNotificationConfig();
          if (botConfig && botConfig.zalo?.isActive !== false && botConfig.zalo.botToken) {
            const formattedDate = finalNextContactDate.split('-').reverse().join('/');
            const directMessage = `🔔 THÔNG BÁO GIAO VIỆC (SALE)\n\n👤 Khách hàng: ${customerData.name}\n📞 Số điện thoại: ${customerData.phone}\n📍 Địa chỉ: ${customerData.address || 'Chưa cập nhật'}\n📅 Lịch gọi lại: Ngày mai lúc 08:00 sáng (${formattedDate})\n📝 Ghi chú: ${customerData.notes || 'Không có'}\n\nBạn được phân công trực tiếp phụ trách chăm sóc khách hàng này. Hãy gọi lại tư vấn đúng hẹn nhé!`;
            await sendZaloTestMessage(botConfig.zalo.botToken, saleMember.zaloUserId, directMessage);
            console.log(`Direct Zalo message sent to Sale ${saleMember.name} successfully`);
          }
        } catch (zaloErr) {
          console.error("Failed to send direct Zalo message to Sale:", zaloErr);
        }
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
        customerType: 'retail' as CustomerType,
        orderValue: 0,
        oneDriveLink: '',
        furnitureCategory: '',
        workshop: currentUser?.workshop && currentUser?.workshop !== 'all' ? currentUser.workshop : WORKSHOPS[1].id,
        location: undefined,
        nextContactDate: '',
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
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleCancelDeposit = async (customerId: string) => {
    try {
      const existingCustomer = customers.find(c => c.id === customerId);
      if (!existingCustomer) return;

      if (!window.confirm(`Bạn có chắc chắn muốn hủy cọc cho khách hàng ${existingCustomer.name}? Tiến độ sẽ chuyển về "Đã tư vấn" và tiền cọc sẽ bị xóa.`)) {
        return;
      }

      const updateData: any = {
        stage: 'consulting',
        orderValue: existingCustomer.orderValue || 0
      };

      await updateDoc(doc(db, 'customers', customerId), updateData);

      // Find all quotations for this customer and revert status
      try {
        const quotationQ = query(collection(db, 'quotations'), where('customerId', '==', customerId));
        const quotationSnap = await getDocs(quotationQ);
        for (const qDoc of quotationSnap.docs) {
          const qData = qDoc.data();
          if (qData.status === 'deposit' || qData.status === 'accepted') {
            await updateDoc(doc(db, 'quotations', qDoc.id), {
              status: 'sent',
              depositAmount: 0
            });
          }
        }
        queryClient.invalidateQueries({ queryKey: ['quotations'] });
      } catch (err) {
        console.error("Error updating quotations on cancel deposit:", err);
      }

      // Send System Notification for Stage Change / Cancel Deposit
      sendSystemNotification(
        `🔴 Hủy cọc đơn hàng!\n\n` +
        `👤 Khách hàng: ${existingCustomer.name}\n` +
        `🏷 Tiến độ: Chốt cọc ➡️ Đã tư vấn\n` +
        `Được thực hiện bởi: ${currentUser?.name || 'Hệ thống'}`,
        'customers',
        existingCustomer.workshop
      );

      toast.success('Đã hủy cọc và đưa khách hàng về trạng thái tư vấn');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    } catch (error: any) {
      toast.error('Lỗi khi hủy cọc: ' + error.message);
    }
  };

  const handleQuickCompleteCustomer = async (customerId: string) => {
    try {
      const existingCustomer = customers.find(c => c.id === customerId);
      if (!existingCustomer || existingCustomer.stage === 'completed') return;
      
      const nowStr = new Date().toISOString();
      const todayYMD = nowStr.slice(0, 10);
      const nextYearDate = new Date();
      nextYearDate.setFullYear(nextYearDate.getFullYear() + 1);
      const nextYearYMD = nextYearDate.toISOString().slice(0, 10);

      const updateData: any = { 
        stage: 'completed',
        warrantyStartDate: existingCustomer.warrantyStartDate || todayYMD,
        warrantyEndDate: existingCustomer.warrantyEndDate || nextYearYMD
      };
      
      if (existingCustomer.stage !== 'contracted') {
        updateData.consultedAt = existingCustomer.consultedAt || existingCustomer.createdAt || nowStr;
        updateData.createdAt = nowStr;
      }
      
      await updateDoc(doc(db, 'customers', customerId), updateData);
      
      // Send System Notification for Stage Change
      const stageNames: Record<string, string> = {
        'consulting': 'Đã tư vấn',
        'surveying': 'Đã đo đạc',
        'contracted': 'Chốt cọc',
        'production': 'Sản xuất',
        'installation': 'Lắp đặt',
        'completed': 'Hoàn thành',
        'lost': 'Tạm dừng',
      };
      const oldStageName = stageNames[existingCustomer.stage] || existingCustomer.stage;
      const newStageName = stageNames[updateData.stage] || updateData.stage;
      const codeText = existingCustomer.code ? `\n🔢 Mã đơn: ${existingCustomer.code}` : '';
      const priceText = existingCustomer.orderValue ? `\n💰 Giá trị: ${formatCurrency(existingCustomer.orderValue)}` : '';
      
      sendSystemNotification(
        `🔄 Cập nhật trạng thái đơn hàng!\n\n` +
        `👤 Khách hàng: ${existingCustomer.name}${codeText}${priceText}\n` +
        `🏷 Tiến độ: ${oldStageName} ➡️ ${newStageName}\n` +
        `Được cập nhật bởi: ${currentUser?.name || 'Hệ thống'}`,
        getTargetModule(updateData.stage),
        existingCustomer.workshop
      );
      
      // Update tasks
      try {
        const taskQ = query(collection(db, 'tasks'));
        const taskSnap = await getDocs(taskQ);
        const cleanPhone = existingCustomer.phone?.trim()?.replace(/\D/g, '');
        
        for (const taskDoc of taskSnap.docs) {
          const tData = taskDoc.data();
          if (tData.status === 'done' || tData.status === 'archived') continue;
          
          let matches = false;
          if (tData.customerId === customerId) {
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
              ...(tData.customerId ? {} : { customerId }),
              status: 'done',
              completedAt: nowStr
            });
          }
        }
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      } catch (err) {
        console.error("Error updating tasks on quick complete:", err);
      }
      
      // Update quotations
      try {
        const quotationQ = query(collection(db, 'quotations'), where('customerId', '==', customerId));
        const quotationSnap = await getDocs(quotationQ);
        for (const qDoc of quotationSnap.docs) {
          const qData = qDoc.data();
          if (qData.status !== 'accepted' && qData.status !== 'rejected') {
            await updateDoc(doc(db, 'quotations', qDoc.id), { status: 'accepted' });
          }
        }
        queryClient.invalidateQueries({ queryKey: ['quotations'] });
      } catch (err) {
        console.error("Error syncing customer stage to quotations:", err);
      }
      
      toast.success("Đã hoàn thành bàn giao dự án!");
    } catch (err) {
      toast.error("Có lỗi xảy ra khi hoàn thành dự án");
    }
  };

  const handleQuickStageUpdate = async (customerId: string, newStage: CustomerStage) => {
    try {
      const existingCustomer = customers.find(c => c.id === customerId);
      if (!existingCustomer || existingCustomer.stage === newStage) return;

      const oldStage = existingCustomer.stage;
      const nowStr = new Date().toISOString();
      const todayYMD = nowStr.slice(0, 10);
      const nextYearDate = new Date();
      nextYearDate.setFullYear(nextYearDate.getFullYear() + 1);
      const nextYearYMD = nextYearDate.toISOString().slice(0, 10);

      const updateData: any = { stage: newStage };

      // Date adjustments (similar to dialog logic)
      if ((newStage === 'contracted' || newStage === 'completed') && 
          oldStage !== 'contracted' && oldStage !== 'completed') {
        updateData.consultedAt = existingCustomer.consultedAt || existingCustomer.createdAt || nowStr;
        updateData.createdAt = nowStr;
      }

      if (newStage === 'completed' && oldStage !== 'completed') {
        updateData.warrantyStartDate = existingCustomer.warrantyStartDate || todayYMD;
        updateData.warrantyEndDate = existingCustomer.warrantyEndDate || nextYearYMD;
      }

      await updateDoc(doc(db, 'customers', customerId), updateData);
      queryClient.invalidateQueries({ queryKey: ['customers'] });

      // Stage name mapping for notification
      const stageNames: Record<string, string> = {
        'consulting': 'Đã tư vấn',
        'surveying': 'Đã đo đạc',
        'contracted': 'Chốt cọc',
        'production': 'Sản xuất',
        'production_completed': 'Hoàn tất sản xuất',
        'installation': 'Lắp đặt',
        'completed': 'Hoàn thành',
        'lost': 'Tạm dừng',
      };

      const oldStageName = stageNames[oldStage] || oldStage;
      const newStageName = stageNames[newStage] || newStage;
      const codeText = existingCustomer.code ? `\n🔢 Mã đơn: ${existingCustomer.code}` : '';
      const priceText = existingCustomer.orderValue ? `\n💰 Giá trị: ${formatCurrency(existingCustomer.orderValue)}` : '';

      sendSystemNotification(
        `🔄 Cập nhật tiến độ đơn hàng!\n\n` +
        `👤 Khách hàng: ${existingCustomer.name}${codeText}${priceText}\n` +
        `🏷 Tiến độ: ${oldStageName} ➡️ ${newStageName}\n` +
        `Được cập nhật bởi: ${currentUser?.name || 'Hệ thống'}`,
        getTargetModule(newStage),
        existingCustomer.workshop
      );

      // Automated Workflow: Quotation Sync
      if (['contracted', 'completed', 'lost'].includes(newStage)) {
        try {
          const quotationQ = query(collection(db, 'quotations'), where('customerId', '==', customerId));
          const quotationSnap = await getDocs(quotationQ);
          
          let newQuotationStatus = '';
          if (newStage === 'contracted') newQuotationStatus = 'deposit';
          else if (newStage === 'completed') newQuotationStatus = 'accepted';
          else if (newStage === 'lost') newQuotationStatus = 'rejected';

          if (newQuotationStatus) {
            for (const qDoc of quotationSnap.docs) {
              const qData = qDoc.data();
              if (qData.status !== 'accepted' && qData.status !== 'rejected' && qData.status !== newQuotationStatus) {
                await updateDoc(doc(db, 'quotations', qDoc.id), { status: newQuotationStatus });
              }
            }
            queryClient.invalidateQueries({ queryKey: ['quotations'] });
          }
        } catch (err) {
          console.error("Error syncing customer stage to quotations:", err);
        }
      }

      toast.success(`Đã cập nhật trạng thái đơn hàng sang "${newStageName}"`);
    } catch (err) {
      console.error("Error in quick stage update:", err);
      toast.error("Không thể cập nhật trạng thái đơn hàng");
    }
  };

  const handleUpdateCustomer = async () => {
    if (isSavingRef.current) return;
    if (!selectedCustomer) return;
    if (!selectedCustomer.name || !selectedCustomer.phone) {
      toast.error("Vui lòng nhập tên và số điện thoại");
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    try {
      const existingCustomer = customers.find(c => c.id === selectedCustomer.id);
      
      // If address changed or location is missing, and has an address, geocode it
      if (selectedCustomer.address && 
          (!existingCustomer || existingCustomer.address !== selectedCustomer.address || !selectedCustomer.location)) {
        const toastId = toast.loading("Đang tự động xác định vị trí của khách hàng...");
        const loc = await geocodeAddress(selectedCustomer.address);
        toast.dismiss(toastId);
        if (loc) {
          selectedCustomer.location = loc;
          toast.success("Đã tự động xác định vị trí mới!");
        }
      }

      if (user) {
        const { id, ...data } = selectedCustomer;
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

        if (selectedCustomer.stage === 'completed' && existingStage !== 'completed') {
          const todayYMD = new Date().toISOString().slice(0, 10);
          const nextYearDate = new Date();
          nextYearDate.setFullYear(nextYearDate.getFullYear() + 1);
          const nextYearYMD = nextYearDate.toISOString().slice(0, 10);

          updateData.warrantyStartDate = selectedCustomer.warrantyStartDate || existingCustomer?.warrantyStartDate || todayYMD;
          updateData.warrantyEndDate = selectedCustomer.warrantyEndDate || existingCustomer?.warrantyEndDate || nextYearYMD;
          selectedCustomer.warrantyStartDate = updateData.warrantyStartDate;
          selectedCustomer.warrantyEndDate = updateData.warrantyEndDate;
        }

        // Ensure location object is either fully valid coordinates or null (no undefined/NaN sub-properties)
        if (updateData.location !== undefined) {
          const loc = updateData.location;
          updateData.location = (loc && typeof loc.lat === 'number' && !isNaN(loc.lat) && typeof loc.lng === 'number' && !isNaN(loc.lng))
            ? { lat: loc.lat, lng: loc.lng }
            : null;
        }

        // Clean undefined values for Firestore compatibility
        Object.keys(updateData).forEach(key => {
          if (updateData[key] === undefined) {
            delete updateData[key];
          }
        });

        await updateDoc(doc(db, 'customers', id), updateData);

        // Notify the newly assigned sale member via Zalo if reassigned
        const isSaleAssignedChanged = existingCustomer && existingCustomer.assignedSaleId !== selectedCustomer.assignedSaleId;
        if (isSaleAssignedChanged && selectedCustomer.assignedSaleId) {
          const saleMember = members.find(m => m.id === selectedCustomer.assignedSaleId);
          if (saleMember && saleMember.zaloUserId) {
            try {
              const botConfig = await getBotNotificationConfig();
              if (botConfig && botConfig.zalo?.botToken && botConfig.zalo?.isActive !== false) {
                const directMessage = `🔔 THÔNG BÁO BÀN GIAO KHÁCH HÀNG (SALE)\n\n👤 Khách hàng: ${selectedCustomer.name}\n📞 Số điện thoại: ${selectedCustomer.phone}\n📍 Địa chỉ: ${selectedCustomer.address || 'Chưa cập nhật'}\n📝 Trạng thái: ${selectedCustomer.stage}\n📝 Ghi chú: ${selectedCustomer.notes || 'Không có'}\n\nBạn được phân công phụ trách chăm sóc khách hàng này. Hãy liên hệ và chăm sóc khách hàng nhé!`;
                await sendZaloTestMessage(botConfig.zalo.botToken, saleMember.zaloUserId, directMessage);
                console.log(`Direct Zalo message sent to Sale ${saleMember.name} successfully on update`);
              }
            } catch (zaloErr) {
              console.error("Failed to send direct Zalo message to Sale on update:", zaloErr);
            }
          }
        }

        // Check if details of an active order changed
        const orderStages = ['contracted', 'production', 'installation', 'completed'];
        const isOrderStage = orderStages.includes(selectedCustomer.stage);
        if (isOrderStage && existingCustomer) {
          const changedFields: string[] = [];
          
          if (existingCustomer.orderValue !== selectedCustomer.orderValue) {
            const oldVal = formatCurrency(existingCustomer.orderValue || 0);
            const newVal = formatCurrency(selectedCustomer.orderValue || 0);
            changedFields.push(`💰 Giá trị: ${oldVal} ➡️ ${newVal}`);
          }
          if (existingCustomer.code !== selectedCustomer.code) {
            changedFields.push(`🔢 Mã đơn: ${existingCustomer.code || 'Chưa có'} ➡️ ${selectedCustomer.code || 'Chưa có'}`);
          }
          if (existingCustomer.name !== selectedCustomer.name) {
            changedFields.push(`👤 Khách hàng: ${existingCustomer.name} ➡️ ${selectedCustomer.name}`);
          }
          if (existingCustomer.address !== selectedCustomer.address) {
            changedFields.push(`📍 Địa chỉ: ${existingCustomer.address || 'Chưa có'} ➡️ ${selectedCustomer.address || 'Chưa có'}`);
          }
          if (existingCustomer.furnitureCategory !== selectedCustomer.furnitureCategory) {
            changedFields.push(`📦 Hạng mục: ${existingCustomer.furnitureCategory || 'Chưa có'} ➡️ ${selectedCustomer.furnitureCategory || 'Chưa có'}`);
          }
          
          // Only send if fields actually changed and stage didn't change (to avoid duplicate notifications with stage change)
          if (changedFields.length > 0 && existingStage === selectedCustomer.stage) {
            const codeText = selectedCustomer.code ? ` [${selectedCustomer.code}]` : '';
            sendSystemNotification(
              `✏️ Cập nhật thông tin đơn hàng!\n\n` +
              `👤 Đơn hàng: ${selectedCustomer.name}${codeText}\n` +
              `🛠 Thay đổi:\n` + changedFields.map(f => `- ${f}`).join('\n') + `\n\n` +
              `Được cập nhật bởi: ${currentUser?.name || 'Hệ thống'}`,
              getTargetModule(selectedCustomer.stage),
              selectedCustomer.workshop
            );
          }
        }

        // Send System Notification for Stage Change
        if (existingStage && existingStage !== selectedCustomer.stage) {
          const stageNames: Record<string, string> = {
            'consulting': 'Đã tư vấn',
            'surveying': 'Đã đo đạc',
            'contracted': 'Chốt cọc',
            'production': 'Sản xuất',
            'installation': 'Lắp đặt',
            'completed': 'Hoàn thành',
            'lost': 'Tạm dừng',
          };
          const oldStageName = stageNames[existingStage] || existingStage;
          const newStageName = stageNames[selectedCustomer.stage] || selectedCustomer.stage;
          
          const isOrder = orderStages.includes(selectedCustomer.stage) || orderStages.includes(existingStage);
          if (isOrder) {
            const codeText = selectedCustomer.code ? `\n🔢 Mã đơn: ${selectedCustomer.code}` : '';
            const priceText = selectedCustomer.orderValue ? `\n💰 Giá trị: ${formatCurrency(selectedCustomer.orderValue)}` : '';
            sendSystemNotification(
              `🔄 Cập nhật trạng thái đơn hàng!\n\n` +
              `👤 Khách hàng: ${selectedCustomer.name}${codeText}${priceText}\n` +
              `🏷 Tiến độ: ${oldStageName} ➡️ ${newStageName}\n` +
              `Được cập nhật bởi: ${currentUser?.name || 'Hệ thống'}`,
              getTargetModule(selectedCustomer.stage),
              selectedCustomer.workshop
            );
          } else {
            sendSystemNotification(
              `🔄 Cập nhật trạng thái khách hàng\n\n👤 Tên: ${selectedCustomer.name}\n📞 SĐT: ${selectedCustomer.phone}\n🏷 Trạng thái: ${oldStageName} ➡️ ${newStageName}\nĐược cập nhật bởi: ${currentUser?.name || 'Hệ thống'}`,
              getTargetModule(selectedCustomer.stage),
              selectedCustomer.workshop
            );
          }
        }

        // Automated Workflow: Customer Stage -> Quotation Status Sync
        if (existingStage !== selectedCustomer.stage && 
            ['contracted', 'completed', 'lost'].includes(selectedCustomer.stage)) {
          try {
            const quotationQ = query(collection(db, 'quotations'), where('customerId', '==', id));
            const quotationSnap = await getDocs(quotationQ);
            
            let newQuotationStatus = '';
            if (selectedCustomer.stage === 'contracted') newQuotationStatus = 'deposit';
            else if (selectedCustomer.stage === 'completed') newQuotationStatus = 'accepted';
            else if (selectedCustomer.stage === 'lost') newQuotationStatus = 'rejected';

            if (newQuotationStatus) {
              for (const qDoc of quotationSnap.docs) {
                const qData = qDoc.data();
                if (qData.status !== 'accepted' && qData.status !== 'rejected' && qData.status !== newQuotationStatus) {
                  await updateDoc(doc(db, 'quotations', qDoc.id), { status: newQuotationStatus });
                }
              }
              queryClient.invalidateQueries({ queryKey: ['quotations'] });
            }
          } catch (err) {
            console.error("Error syncing customer stage to quotations:", err);
          }
        }

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
                const taskUpdate: any = {
                  createdAt: nowStr,
                  ...(tData.customerId ? {} : { customerId: id })
                };
                
                // If customer is completed, auto-complete their tasks
                if (selectedCustomer.stage === 'completed') {
                  taskUpdate.status = 'done';
                  taskUpdate.completedAt = nowStr;
                }
                
                await updateDoc(doc(db, 'tasks', taskDoc.id), taskUpdate);
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
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
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

  const handleAddNote = async () => {
    if (!selectedCustomer || !newNoteContent.trim()) return;
    try {
      const newNote = {
        id: Math.random().toString(36).substr(2, 9),
        content: newNoteContent.trim(),
        createdBy: currentUser?.name || 'Hệ thống',
        createdAt: new Date().toISOString()
      };
      const customerRef = doc(db, 'customers', selectedCustomer.id);
      
      const updatedNotesList = [...(selectedCustomer.notesList || []), newNote];
      
      await updateDoc(customerRef, {
        notesList: updatedNotesList
      });
      
      setSelectedCustomer({
        ...selectedCustomer,
        notesList: updatedNotesList
      });
      
      // Update local state to avoid waiting for snapshot if needed
      setCustomers(customers.map(c => c.id === selectedCustomer.id ? { ...c, notesList: updatedNotesList } : c));
      
      toast.success('Đã thêm ghi chú');
      setNewNoteContent('');
    } catch (err) {
      toast.error('Lỗi khi thêm ghi chú');
    }
  };

  const matchesTime = React.useCallback((dateStr?: string) => {
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
    } else if (selectedMonth === 'last-week') {
      const day = now.getDay() || 7; 
      const firstDayThisWeek = new Date(now);
      firstDayThisWeek.setHours(0, 0, 0, 0);
      firstDayThisWeek.setDate(now.getDate() - day + 1);
      
      const firstDayLastWeek = new Date(firstDayThisWeek);
      firstDayLastWeek.setDate(firstDayThisWeek.getDate() - 7);
      
      const lastDayLastWeek = new Date(firstDayLastWeek);
      lastDayLastWeek.setDate(firstDayLastWeek.getDate() + 6);
      lastDayLastWeek.setHours(23, 59, 59, 999);
      return date >= firstDayLastWeek && date <= lastDayLastWeek;
    }
    return getVNMonth(dateStr) === selectedMonth;
  }, [selectedMonth]);

  const prevMonthStr = React.useMemo(() => {
    if (!selectedMonth || selectedMonth === 'all' || selectedMonth === 'today' || selectedMonth === 'week' || selectedMonth === 'last-week') {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    const [year, month] = selectedMonth.split('-').map(Number);
    const d = new Date(year, month - 1, 1);
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, [selectedMonth]);

  const matchesGroup = React.useCallback((c: Customer) => {
    if (selectedGroup === 'all') return true;
    const cat = (c.furnitureCategory || '').toLowerCase();
    const name = (c.name || '').toLowerCase();
    const notes = (c.notes || '').toLowerCase();
    
    if (selectedGroup === 'project') {
      return c.customerType === 'project' || cat.includes('dự án') || name.includes('dự án') || notes.includes('dự án');
    }
    if (selectedGroup === 'processing') {
      return c.customerType === 'agency' || cat.includes('gia công') || name.includes('gia công') || name.includes('tổng kho') || notes.includes('gia công');
    }
    if (selectedGroup === 'residential') {
      const isProj = c.customerType === 'project' || cat.includes('dự án') || name.includes('dự án');
      const isProc = c.customerType === 'agency' || cat.includes('gia công') || name.includes('gia công') || name.includes('tổng kho');
      return !isProj && !isProc;
    }
    return true;
  }, [selectedGroup]);

  const filteredCustomersForKPIs = React.useMemo(() => {
    return customers.filter(c => {
      const matchWorkshop = selectedWorkshop === 'all' || (c.workshop || 'Hà Nội') === selectedWorkshop;
      const matchSale = selectedSaleId === 'all' || c.assignedSaleId === selectedSaleId;
      
      const search = searchTerm.trim().toLowerCase();
      const matchSearch = search === '' || 
        c.name.toLowerCase().includes(search) ||
        c.phone.includes(search) ||
        (c.code && c.code.toLowerCase().includes(search)) ||
        (c.furnitureCategory && c.furnitureCategory.toLowerCase().includes(search));

      // Bỏ qua lọc theo tháng nếu người dùng đang gõ tìm kiếm (tìm trên toàn hệ thống)
      const matchTime = search !== '' || !selectedMonth || !c.createdAt || matchesTime(c.createdAt);
      const matchGroup = matchesGroup(c);

      return matchWorkshop && matchSale && matchTime && matchSearch && matchGroup;
    });
  }, [customers, selectedWorkshop, selectedSaleId, selectedMonth, searchTerm, matchesTime, matchesGroup]);

  const contractedLastMonthCount = React.useMemo(() => {
    return customers.filter(c => {
      const matchWorkshop = selectedWorkshop === 'all' || (c.workshop || 'Hà Nội') === selectedWorkshop;
      const matchSale = selectedSaleId === 'all' || c.assignedSaleId === selectedSaleId;
      if (!matchWorkshop || !matchSale) return false;
      if (!matchesGroup(c)) return false;

      if (c.stage === 'contracted' && c.createdAt && getVNMonth(c.createdAt) === prevMonthStr) {
        return true;
      }
      const cQuotes = quotations.filter(q => q.customerId === c.id || (q.customerName === c.name && q.phone === c.phone));
      return cQuotes.some(q => (q.status === 'deposit' || (q.depositAmount && q.depositAmount > 0)) && getVNMonth(q.createdAt || q.date) === prevMonthStr);
    }).length;
  }, [customers, selectedWorkshop, selectedSaleId, matchesGroup, prevMonthStr, quotations]);

  const filteredCustomers = React.useMemo(() => {
    return filteredCustomersForKPIs.filter(c => {
      const hasQuotes = quotations.some(q => q.customerId === c.id || (q.customerName === c.name && q.phone === c.phone));
      if (selectedStage === 'all') return true;
      if (selectedStage === 'quoted') return hasQuotes;
      if (selectedStage === 'unquoted') return !hasQuotes;
      if (selectedStage === 'contracted_last_month') {
        if (c.stage === 'contracted' && c.createdAt && getVNMonth(c.createdAt) === prevMonthStr) return true;
        const cQuotes = quotations.filter(q => q.customerId === c.id || (q.customerName === c.name && q.phone === c.phone));
        return cQuotes.some(q => (q.status === 'deposit' || (q.depositAmount && q.depositAmount > 0)) && getVNMonth(q.createdAt || q.date) === prevMonthStr);
      }
      return c.stage === selectedStage;
    }).sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [filteredCustomersForKPIs, selectedStage, quotations, prevMonthStr]);

  const displayItems = React.useMemo(() => {
    if (groupMode === 'by_customer') {
      return filteredCustomers.map(c => ({
        type: 'customer' as const,
        customer: c,
        quotation: undefined as Quotation | undefined,
        key: c.id
      }));
    }
    const items: Array<{
      type: 'order' | 'customer';
      customer: Customer;
      quotation?: Quotation;
      key: string;
    }> = [];

    filteredCustomers.forEach(customer => {
      const cQuotes = quotations.filter(q => q.customerId === customer.id || (q.customerName === customer.name && q.phone === customer.phone));
      if (cQuotes.length > 0) {
        cQuotes.forEach((q, idx) => {
          items.push({
            type: 'order',
            customer,
            quotation: q,
            key: `${customer.id}_order_${q.id || idx}`
          });
        });
      } else {
        items.push({
          type: 'customer',
          customer,
          quotation: undefined,
          key: `${customer.id}_inquiry`
        });
      }
    });

    return items;
  }, [filteredCustomers, quotations, groupMode]);

  const isManager = !!(currentUser?.role && ['quản lý', 'giám đốc', 'trợ lý', 'kế toán', 'chủ sở hữu', 'admin'].some(r => currentUser.role.toLowerCase().includes(r)));
  const canViewRevenue = isManager || currentUser?.permissions?.viewRevenue !== false;

  const { receivedMoney, actualRevenue, expectedRevenue, winRate } = React.useMemo(() => {
    const received = filteredCustomersForKPIs.reduce((sum, c) => {
      const cQuotes = quotations.filter(q => q.customerId === c.id || (q.customerName === c.name && q.phone === c.phone));
      const pQuotes = cQuotes.filter(q => q.status === 'accepted' || q.status === 'deposit');

      if (c.stage === 'completed') {
        const qSum = pQuotes.reduce((s, q) => s + (q.totalAmount || 0), 0);
        return sum + (qSum > 0 ? qSum : (c.orderValue || 0));
      }
      if (['contracted', 'production', 'production_completed', 'installation'].includes(c.stage)) {
        const depositSum = pQuotes.reduce((s, q) => s + (q.depositAmount || 0), 0);
        if (depositSum === 0) {
          const firstQ = cQuotes.find(q => q.status === 'deposit' || q.depositAmount);
          const deposit = (firstQ?.status === 'deposit' || firstQ?.depositAmount) ? (firstQ.depositAmount || 0) : 0;
          return sum + (deposit || 0);
        }
        return sum + depositSum;
      }
      return sum;
    }, 0);

    const actual = filteredCustomersForKPIs.reduce((sum, c) => {
      if (c.stage === 'installation' || c.stage === 'completed') {
        const cQuotes = quotations.filter(q => q.customerId === c.id || (q.customerName === c.name && q.phone === c.phone));
        const pQuotes = cQuotes.filter(q => q.status === 'accepted' || q.status === 'deposit');
        const qSum = pQuotes.reduce((s, q) => s + (q.totalAmount || 0), 0);
        return sum + (qSum > 0 ? qSum : (c.orderValue || 0));
      }
      return sum;
    }, 0);

    const expected = filteredCustomersForKPIs.reduce((sum, c) => {
      if (['contracted', 'production', 'production_completed', 'installation', 'completed'].includes(c.stage)) {
        const cQuotes = quotations.filter(q => q.customerId === c.id || (q.customerName === c.name && q.phone === c.phone));
        const pQuotes = cQuotes.filter(q => q.status === 'accepted' || q.status === 'deposit');
        const qSum = pQuotes.reduce((s, q) => s + (q.totalAmount || 0), 0);
        return sum + (qSum > 0 ? qSum : (c.orderValue || 0));
      }
      return sum;
    }, 0);

    const total = filteredCustomersForKPIs.length;
    const won = filteredCustomersForKPIs.filter(c => ['contracted', 'production', 'installation', 'completed'].includes(c.stage)).length;
    const rate = total > 0 ? Math.round((won / total) * 100) : 0;

    return { receivedMoney: received, actualRevenue: actual, expectedRevenue: expected, winRate: rate };
  }, [filteredCustomersForKPIs, quotations]);

  const cardData = React.useMemo(() => {
    const total = filteredCustomersForKPIs.length;
    const consulting = filteredCustomersForKPIs.filter(c => c.stage === 'consulting').length;
    const surveying = filteredCustomersForKPIs.filter(c => c.stage === 'surveying').length;
    
    // Quoted / Unquoted calculations
    const quoted = filteredCustomersForKPIs.filter(c => 
      quotations.some(q => q.customerId === c.id || (q.customerName === c.name && q.phone === c.phone))
    ).length;
    const unquoted = total - quoted;
    
    const contracted = filteredCustomersForKPIs.filter(c => c.stage === 'contracted').length;
    const production = filteredCustomersForKPIs.filter(c => c.stage === 'production').length;
    const productionCompleted = filteredCustomersForKPIs.filter(c => c.stage === 'production_completed').length;
    const installation = filteredCustomersForKPIs.filter(c => c.stage === 'installation').length;
    const completed = filteredCustomersForKPIs.filter(c => c.stage === 'completed').length;

    return [
      { id: 'all', label: 'TỔNG KH', value: total, color: 'text-blue-600', clickable: true },
      { id: 'consulting', label: 'ĐÃ TƯ VẤN', value: consulting, color: 'text-amber-500', clickable: true },
      { id: 'surveying', label: 'ĐÃ ĐO ĐẠC', value: surveying, color: 'text-purple-600', clickable: true },
      { id: 'quoted', label: 'ĐÃ BÁO GIÁ', value: quoted, color: 'text-blue-600', clickable: true },
      { id: 'unquoted', label: 'CHƯA BÁO GIÁ', value: unquoted, color: 'text-slate-600', clickable: true },
      { id: 'contracted', label: 'CHỐT CỌC', value: contracted, color: 'text-emerald-600', clickable: true },
      { id: 'contracted_last_month', label: 'CHỐT CỌC THÁNG TRƯỚC', value: contractedLastMonthCount, color: 'text-fuchsia-600', clickable: true },
      { id: 'production', label: 'SẢN XUẤT', value: production, color: 'text-blue-600', clickable: true },
      { id: 'production_completed', label: 'HOÀN TẤT SẢN XUẤT', value: productionCompleted, color: 'text-teal-600', clickable: true },
      { id: 'installation', label: 'LẮP ĐẶT', value: installation, color: 'text-orange-600', clickable: true },
      { id: 'completed', label: 'HOÀN THÀNH', value: completed, color: 'text-emerald-600', clickable: true },
      { id: 'win_rate', label: 'TỈ LỆ CHỐT', value: `${winRate}%`, color: 'text-pink-600', clickable: false },
    ];
  }, [filteredCustomersForKPIs, quotations, contractedLastMonthCount, winRate]);

  return (
    <div className="space-y-3 md:space-y-8 max-w-[1600px] mx-auto pb-10 px-0.5">
      {/* Header Section */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800/80">
        <div className="space-y-0.5 text-left shrink-0">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-50 leading-tight">
            Khách<br className="hidden md:inline" /> hàng
          </h1>
          <p className="text-muted-foreground text-[10px] md:text-xs font-medium">Hành trình khách hàng.</p>
        </div>

        {/* Toolbar: Time, Workshop, Sale, Search, Group toggle, Actions */}
        <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
          {/* Date Selector Popover */}
          <Popover>
            <PopoverTrigger className="inline-flex items-center justify-between whitespace-nowrap h-9 text-xs font-bold border border-input bg-card hover:bg-accent px-3 py-1.5 rounded-xl shadow-xs cursor-pointer text-card-foreground">
              <span>{selectedMonth === 'today' ? 'Hôm nay' : selectedMonth === 'week' ? 'Tuần này' : selectedMonth === 'last-week' ? 'Tuần trước' : selectedMonth ? `Tháng ${selectedMonth.split('-')[1]} năm ${selectedMonth.split('-')[0]}` : "Chọn thời gian"}</span>
              <Calendar className="ml-2 h-3.5 w-3.5 opacity-50" />
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-2 bg-card text-card-foreground z-[60] rounded-2xl border shadow-xl" align="start">
              <div className="flex items-center justify-between bg-gray-100 rounded-md p-1 mb-2 dark:bg-zinc-800">
                <Button variant="ghost" size="icon" className="h-6 w-6 cursor-pointer" onClick={() => setPickerYear(y => y - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-semibold">{pickerYear}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 cursor-pointer" onClick={() => setPickerYear(y => y + 1)}>
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
                      className={cn("h-9 w-full text-xs cursor-pointer", isSelected && "bg-blue-600 hover:bg-blue-700 text-white")}
                      onClick={() => setSelectedMonth(val)}
                    >
                      Thg{i + 1}
                    </Button>
                  );
                })}
              </div>
              <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-border">
                <div className="grid grid-cols-2 gap-2">
                  <Button variant={selectedMonth === 'today' ? 'default' : 'outline'} size="sm" className="text-[10px] h-7 font-bold cursor-pointer" onClick={() => setSelectedMonth('today')}>Hôm nay</Button>
                  <Button variant={selectedMonth === 'week' ? 'default' : 'outline'} size="sm" className="text-[10px] h-7 font-bold cursor-pointer" onClick={() => setSelectedMonth('week')}>Tuần này</Button>
                </div>
                <div className="flex gap-2">
                  <Button variant={selectedMonth === 'last-week' ? 'default' : 'outline'} size="sm" className="text-[10px] h-7 flex-1 font-bold cursor-pointer" onClick={() => setSelectedMonth('last-week')}>Tuần trước</Button>
                  <Button variant={selectedMonth === '' ? 'default' : 'outline'} size="sm" className="text-[10px] h-7 flex-1 font-bold cursor-pointer" onClick={() => setSelectedMonth('')}>Tất cả</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Workshop Select */}
          <Select 
            value={getNormalizedWorkshopId(selectedWorkshop)} 
            onValueChange={setSelectedWorkshop}
            disabled={currentUser?.workshop && currentUser?.workshop !== 'all'}
          >
            <SelectTrigger className="h-9 min-w-[115px] rounded-xl border border-border bg-card text-card-foreground text-xs shadow-xs cursor-pointer">
              <SelectValue>
                {WORKSHOPS.find(w => w.id === getNormalizedWorkshopId(selectedWorkshop))?.name || 'Tất cả cơ sở'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-card text-card-foreground border shadow-xl rounded-xl">
              {WORKSHOPS.map(w => (
                <SelectItem key={w.id} value={w.id} className="text-xs cursor-pointer">{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sale Select */}
          <Select 
            value={selectedSaleId} 
            onValueChange={setSelectedSaleId}
          >
            <SelectTrigger className="h-9 min-w-[110px] rounded-xl border border-border bg-card text-card-foreground text-xs shadow-xs cursor-pointer">
              <SelectValue>
                {selectedSaleId === 'all' ? 'Tất cả Sale' : (members.find(m => m.id === selectedSaleId)?.name || selectedSaleId)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-card text-card-foreground border shadow-xl rounded-xl">
              <SelectItem value="all" className="text-xs font-bold text-primary cursor-pointer">Tất cả Sale</SelectItem>
              {members.map(m => (
                <SelectItem key={m.id} value={m.id} className="text-xs cursor-pointer">{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Search input */}
          <div className="relative min-w-[150px] max-w-[190px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input 
              placeholder="Tìm tên hoặc SĐT..." 
              className="pl-8.5 h-9 rounded-xl bg-card text-card-foreground border border-border text-xs shadow-xs w-full" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Segmented View Mode Toggle */}
          <div className="flex border border-border bg-card p-0.5 rounded-xl gap-0.5 shadow-xs text-xs">
            <button
              type="button"
              className={cn(
                "px-2.5 py-1.5 font-bold rounded-lg transition-all text-center cursor-pointer text-[11px] flex items-center gap-1",
                groupMode === 'by_order'
                  ? "bg-slate-100 text-slate-800 shadow-2xs dark:bg-zinc-800 dark:text-zinc-200"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              onClick={() => setGroupMode('by_order')}
            >
              <FileText className="h-3 w-3" />
              <span>Theo Đơn hàng</span>
            </button>
            <button
              type="button"
              className={cn(
                "px-2.5 py-1.5 font-bold rounded-lg transition-all text-center cursor-pointer text-[11px] flex items-center gap-1",
                groupMode === 'by_customer'
                  ? "bg-blue-50 text-blue-600 border border-blue-200/60 shadow-2xs dark:bg-blue-950/50 dark:text-blue-400"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              onClick={() => setGroupMode('by_customer')}
            >
              <Users className="h-3 w-3 text-blue-600 dark:text-blue-400" />
              <span>Gom theo Khách</span>
            </button>
          </div>

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImportExcel} 
            accept=".xlsx, .xls, .csv" 
            className="hidden" 
          />

          <Button 
            variant="outline"
            className="h-9 rounded-xl gap-1 px-3 shadow-xs text-xs border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-bold cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Nhập Excel</span>
          </Button>

          <Button 
            variant="outline"
            className="h-9 rounded-xl gap-1 px-3 shadow-xs text-xs border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 font-bold cursor-pointer"
            onClick={handleExportExcel}
          >
            <Download className="h-3.5 w-3.5" />
            <span>Xuất Excel</span>
          </Button>

          {!!(currentUser?.role && ['giám đốc', 'tổng quản lý', 'chủ sở hữu', 'admin'].some(r => currentUser.role.toLowerCase().includes(r))) && (
            <Button 
              variant="outline"
              className="h-9 rounded-xl gap-1 px-2.5 shadow-xs text-xs border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100 font-bold cursor-pointer"
              onClick={runMigration}
              title="Đồng bộ"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}

          <Button 
            className="h-9 rounded-xl gap-1 px-4 shadow-xs text-xs text-white bg-blue-600 hover:bg-blue-700 font-bold cursor-pointer"
            onClick={() => setIsAddDialogOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Thêm</span>
          </Button>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
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
                      {(() => {
                        const cleanVal = newCustomer.phone.trim().replace(/\D/g, '');
                        if (cleanVal.length >= 8) {
                          const dup = customers.find(c => c.phone.trim().replace(/\D/g, '') === cleanVal);
                          if (dup) {
                            return (
                              <p className="text-[10px] text-amber-600 font-bold bg-amber-50 p-1.5 rounded-md border border-amber-200 leading-normal">
                                ⚠️ SĐT đã tồn tại trên hệ thống (Khách: {dup.name} - {dup.code}). Bạn nên tìm và tạo báo giá mới cho khách cũ này thay vì tạo trùng lặp.
                              </p>
                            );
                          }
                        }
                        return null;
                      })()}
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
                        value={getNormalizedWorkshopId(newCustomer.workshop)} 
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
                    <div className="grid gap-2">
                      <Label>Loại khách hàng</Label>
                      <Select 
                        value={newCustomer.customerType || 'retail'} 
                        onValueChange={(v: CustomerType) => setNewCustomer({ ...newCustomer, customerType: v })}
                      >
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue placeholder="Chọn loại khách hàng" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="retail">Khách lẻ</SelectItem>
                          <SelectItem value="agency">Đại lý</SelectItem>
                          <SelectItem value="project">Dự án</SelectItem>
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
                      <Label htmlFor="nextContactDate">Nhắc nhở gọi lại</Label>
                      <Input
                        id="nextContactDate"
                        type="date"
                        value={newCustomer.nextContactDate}
                        onChange={(e) => setNewCustomer({ ...newCustomer, nextContactDate: e.target.value })}
                        className="h-11 rounded-xl"
                      />
                    </div>
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
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isSaving}>Hủy</Button>
                <Button onClick={handleAddCustomer} disabled={isSaving}>
                  {isSaving ? "Đang lưu..." : "Lưu khách hàng"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Customer Category Filter Pills */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          className={cn(
            "px-4 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer border",
            selectedGroup === 'all'
              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
              : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"
          )}
          onClick={() => {
            setSelectedGroup('all');
            setSelectedStage('all');
          }}
        >
          Tất cả nhóm
        </button>
        <button
          type="button"
          className={cn(
            "px-4 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer border flex items-center gap-1.5",
            selectedGroup === 'project'
              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
              : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"
          )}
          onClick={() => {
            setSelectedGroup('project');
            setSelectedStage('all');
          }}
        >
          <Building2 className="h-3.5 w-3.5" />
          <span>Dự án</span>
        </button>
        <button
          type="button"
          className={cn(
            "px-4 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer border flex items-center gap-1.5",
            selectedGroup === 'processing'
              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
              : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"
          )}
          onClick={() => {
            setSelectedGroup('processing');
            setSelectedStage('all');
          }}
        >
          <Cog className="h-3.5 w-3.5" />
          <span>Gia công</span>
        </button>
        <button
          type="button"
          className={cn(
            "px-4 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer border flex items-center gap-1.5",
            selectedGroup === 'residential'
              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
              : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"
          )}
          onClick={() => {
            setSelectedGroup('residential');
            setSelectedStage('all');
          }}
        >
          <Home className="h-3.5 w-3.5" />
          <span>Công trình nhà dân</span>
        </button>
      </div>

      {/* 3 Metric Financial Cards */}
      {canViewRevenue && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          {/* Card 1: Tiền thực nhận */}
          <Card className="bg-[#046c4e] text-white shadow-lg relative overflow-hidden group border-0 rounded-2xl">
            <div className="absolute top-2 right-2 p-2 opacity-20">
              <CreditCard className="h-16 w-16 md:h-20 md:w-20" />
            </div>
            <CardContent className="p-4 md:p-5 flex flex-col justify-between min-h-[95px] relative z-10">
              <div className="flex items-center justify-between">
                <p className="text-[11px] md:text-xs uppercase font-extrabold tracking-wider text-emerald-100 drop-shadow-sm">
                  1. TIỀN THỰC NHẬN
                </p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-xs">
                  Đã thu
                </span>
              </div>
              <h3 className="text-2xl md:text-3xl font-black tabular-nums drop-shadow-md mt-2">
                {formatCurrency(receivedMoney)}
              </h3>
            </CardContent>
          </Card>

          {/* Card 2: Doanh thu thực tế */}
          <Card className="bg-[#2563eb] text-white shadow-lg relative overflow-hidden group border-0 rounded-2xl">
            <div className="absolute top-2 right-2 p-2 opacity-20">
              <DollarSign className="h-16 w-16 md:h-20 md:w-20" />
            </div>
            <CardContent className="p-4 md:p-5 flex flex-col justify-between min-h-[95px] relative z-10">
              <div className="flex items-center justify-between">
                <p className="text-[11px] md:text-xs uppercase font-extrabold tracking-wider text-blue-100 drop-shadow-sm">
                  2. DOANH THU THỰC TẾ
                </p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-xs">
                  Lắp đặt / Hoàn thành
                </span>
              </div>
              <h3 className="text-2xl md:text-3xl font-black tabular-nums drop-shadow-md mt-2">
                {formatCurrency(actualRevenue)}
              </h3>
            </CardContent>
          </Card>

          {/* Card 3: Doanh thu dự kiến */}
          <Card className="bg-[#ea580c] text-white shadow-lg relative overflow-hidden group border-0 rounded-2xl">
            <div className="absolute top-2 right-2 p-2 opacity-20">
              <TrendingUp className="h-16 w-16 md:h-20 md:w-20" />
            </div>
            <CardContent className="p-4 md:p-5 flex flex-col justify-between min-h-[95px] relative z-10">
              <div className="flex items-center justify-between">
                <p className="text-[11px] md:text-xs uppercase font-extrabold tracking-wider text-orange-100 drop-shadow-sm">
                  3. DOANH THU DỰ KIẾN
                </p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-xs">
                  Từ Chốt Cọc
                </span>
              </div>
              <h3 className="text-2xl md:text-3xl font-black tabular-nums drop-shadow-md mt-2">
                {formatCurrency(expectedRevenue)}
              </h3>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Status Indicators Section */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xs md:text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-zinc-200">
              Chỉ số trạng thái
            </h3>
            <span className="text-[11px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-full border border-blue-200/60">
              {filteredCustomersForKPIs.length} Khách hàng
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsKpiCollapsed(!isKpiCollapsed)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium transition-colors cursor-pointer"
          >
            <span>{isKpiCollapsed ? 'Mở rộng chỉ số' : 'Thu gọn chỉ số'}</span>
            {isKpiCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>
        </div>

        {!isKpiCollapsed && (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
            {cardData.map((card) => {
              const isSelected = selectedStage === card.id;
              return (
                <div
                  key={card.id}
                  className={cn(
                    "bg-card text-card-foreground p-2 rounded-2xl border transition-all text-center flex flex-col justify-center items-center min-h-[64px]",
                    card.clickable && "cursor-pointer hover:border-slate-300 hover:shadow-xs",
                    isSelected 
                      ? "border-2 border-blue-500 shadow-xs ring-1 ring-blue-500/20" 
                      : "border-slate-200/80 dark:border-zinc-800"
                  )}
                  onClick={() => {
                    if (card.clickable) {
                      setSelectedStage(card.id as any);
                    }
                  }}
                >
                  <p className="text-[8px] md:text-[9px] uppercase font-bold tracking-wider text-slate-500 line-clamp-1 mb-1">
                    {card.label}
                  </p>
                  <h4 className={cn("text-base md:text-lg font-black tabular-nums leading-tight", card.color)}>
                    {card.value}
                  </h4>
                </div>
              );
            })}
          </div>
        )}
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
        {viewMode === 'map' && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Dialog open={isFactoryAddressDialogOpen} onOpenChange={setIsFactoryAddressDialogOpen}>
            <DialogTrigger render={(
              <Button variant="outline" size="sm" className="h-7 md:h-8 text-[10px] md:text-xs rounded-md px-3 font-medium">
                <Search className="w-3.5 h-3.5 mr-1.5" />
                Nhập địa chỉ xưởng
              </Button>
            ) as React.ReactElement} />
              <DialogContent className="sm:max-w-[425px] rounded-xl">
                <DialogHeader>
                  <DialogTitle>Tìm vị trí xưởng theo địa chỉ</DialogTitle>
                  <DialogDescription>
                    Nhập địa chỉ xưởng sản xuất để hệ thống tự động tìm và cắm mốc trên bản đồ.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="factory-address">Địa chỉ chi tiết</Label>
                    <Input
                      id="factory-address"
                      placeholder="VD: 123 Lê Lợi, Quận 1, TP.HCM"
                      value={factoryAddressInput}
                      onChange={(e) => setFactoryAddressInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSetFactoryByAddress();
                        }
                      }}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsFactoryAddressDialogOpen(false)}>Hủy</Button>
                  <Button onClick={handleSetFactoryByAddress} disabled={isGeocodingFactory || !factoryAddressInput.trim()}>
                    {isGeocodingFactory ? "Đang tìm..." : "Lưu vị trí"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button
              variant={isSettingFactory ? "default" : "outline"}
              size="sm"
              className={cn("h-7 md:h-8 text-[10px] md:text-xs rounded-md px-3 font-medium", isSettingFactory && "bg-amber-600 hover:bg-amber-700 text-white")}
              onClick={() => setIsSettingFactory(!isSettingFactory)}
            >
              <Factory className="w-3.5 h-3.5 mr-1.5" />
              {isSettingFactory ? "Click lên bản đồ để cắm xưởng" : "Cắm xưởng trên bản đồ"}
            </Button>
          </div>
        )}
      </div>

      {viewMode === 'map' ? (
        <Card className={cn("h-[600px] border border-border shadow-sm rounded-xl overflow-hidden relative z-0", isSettingFactory && "ring-2 ring-amber-500 ring-offset-2")}>
          <MapComponent interactive={true} onClick={handleMapClick}>
            {systemSettings?.factoryLocation && (
              <CustomMarker
                latitude={systemSettings.factoryLocation.lat}
                longitude={systemSettings.factoryLocation.lng}
                color="bg-amber-600"
                labelText="Xưởng sản xuất"
              >
                <div className="bg-amber-600 text-white p-2 rounded-xl shadow-xl border border-amber-700 w-40 text-center">
                  <Factory className="h-5 w-5 mx-auto mb-1" />
                  <p className="font-bold text-xs">Vị trí xưởng</p>
                </div>
              </CustomMarker>
            )}
            
            {filteredCustomers.filter(c => c.location).map(customer => {
              const stage = STAGE_CONFIG[customer.stage];
              let distanceStr = null;
              if (systemSettings?.factoryLocation && customer.location) {
                const dist = calculateDistance(
                  systemSettings.factoryLocation.lat,
                  systemSettings.factoryLocation.lng,
                  customer.location.lat,
                  customer.location.lng
                );
                distanceStr = `${dist} km`;
              }
              
              return (
                <CustomMarker 
                  key={customer.id} 
                  latitude={customer.location!.lat} 
                  longitude={customer.location!.lng}
                  color={STAGE_MARKER_COLORS[customer.stage] || "bg-primary"}
                  labelText={customer.name}
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
                    {distanceStr && (
                      <div className="mt-1.5 pt-1.5 border-t border-border flex items-center justify-between text-[9px] text-muted-foreground font-medium">
                        <span className="flex items-center"><Factory className="h-2.5 w-2.5 mr-1" /> Cách xưởng:</span>
                        <span className="font-bold text-amber-600">{distanceStr}</span>
                      </div>
                    )}
                  </div>
                </CustomMarker>
              );
            })}
          </MapComponent>
          
          {geocodingProgress && (
            <div className="absolute bottom-4 left-4 z-10 bg-background/95 backdrop-blur shadow-lg border rounded-xl p-3 flex items-center gap-2.5 max-w-sm pointer-events-auto">
              <div className="h-4 w-4 border-2 border-primary border-t-transparent animate-spin rounded-full shrink-0" />
              <span className="text-xs font-semibold text-foreground">
                Đang tìm tọa độ địa chỉ... ({geocodingProgress.current}/{geocodingProgress.total})
              </span>
            </div>
          )}

          {filteredCustomers.filter(c => c.location).length === 0 && (
             <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm pointer-events-none">
                <div className="bg-card p-4 rounded-xl shadow-lg border text-center max-w-sm">
                   <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                   <p className="text-sm font-semibold">Chưa có khách hàng nào được ghim trên bản đồ.</p>
                   <p className="text-xs text-muted-foreground mt-1">Hãy mở thông tin khách hàng và chọn "Ghim bản đồ" hoặc nhập địa chỉ.</p>
                </div>
             </div>
          )}
        </Card>
      ) : (
      <div className="grid gap-3 md:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {displayItems.map((item, i) => {
          const customer = item.customer;
          const currentQuotation = item.quotation;
          const stage = STAGE_CONFIG[customer.stage];
          const sale = members.find(m => m.id === customer.assignedSaleId);
          
          const customerQuotations = quotations.filter(q => q.customerId === customer.id || (q.customerName === customer.name && q.phone === customer.phone));
          let purchaseCount = customerQuotations.filter(q => q.status === 'accepted' || q.status === 'deposit').length;
          if (purchaseCount === 0 && ['contracted', 'production', 'installation', 'completed'].includes(customer.stage)) {
            purchaseCount = 1;
          }
          
          const isCompleted = customer.stage === 'completed';

          let totalDebt = 0;
          if (!isCompleted && customer.stage !== 'lost') {
            totalDebt = customerQuotations
              .filter(q => q.status === 'accepted' || q.status === 'deposit')
              .reduce((sum, q) => sum + Math.max(0, (q.totalAmount || 0) - (q.depositAmount || 0)), 0);
            
            if (totalDebt === 0 && purchaseCount > 0 && customer.orderValue && ['contracted', 'production', 'production_completed', 'installation'].includes(customer.stage)) {
              totalDebt = customer.orderValue;
            }
          }
          
          return (
            <motion.div
              key={item.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card className="group h-full flex flex-col justify-between transition-all duration-300 border border-slate-200/80 dark:border-zinc-800 shadow-xs bg-card text-card-foreground hover:shadow-md rounded-2xl overflow-hidden">
                <CardHeader className="p-3.5 md:p-4 pb-2 space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger render={
                          <button className={cn(
                            "text-[10px] md:text-xs font-bold px-2.5 py-1 rounded-lg cursor-pointer flex items-center gap-1 select-none hover:opacity-85 transition-opacity border",
                            customer.stage === 'contracted' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            customer.stage === 'consulting' ? "bg-amber-50 text-amber-700 border-amber-200" :
                            customer.stage === 'surveying' ? "bg-purple-50 text-purple-700 border-purple-200" :
                            customer.stage === 'production' ? "bg-blue-50 text-blue-700 border-blue-200" :
                            customer.stage === 'production_completed' ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
                            customer.stage === 'installation' ? "bg-orange-50 text-orange-700 border-orange-200" :
                            customer.stage === 'completed' ? "bg-green-50 text-green-700 border-green-200" :
                            "bg-rose-50 text-rose-700 border-rose-200"
                          )}>
                            <span className={cn(
                              "w-2 h-2 rounded-full mr-0.5",
                              customer.stage === 'contracted' ? "bg-emerald-500" :
                              customer.stage === 'consulting' ? "bg-amber-500" :
                              customer.stage === 'surveying' ? "bg-purple-500" :
                              customer.stage === 'production' ? "bg-blue-500" :
                              customer.stage === 'production_completed' ? "bg-indigo-500" :
                              customer.stage === 'installation' ? "bg-orange-500" :
                              customer.stage === 'completed' ? "bg-green-500" :
                              "bg-rose-500"
                            )} />
                            <span>{stage.label.toUpperCase()}</span>
                            <span className="text-[8px] ml-0.5 opacity-70">⌵</span>
                          </button>
                        } />
                        <DropdownMenuContent align="start" className="rounded-xl p-1 min-w-[160px]">
                          {Object.entries(STAGE_CONFIG).map(([key, config]) => {
                            const ItemIcon = config.icon;
                            const isCurrent = customer.stage === key;
                            return (
                              <DropdownMenuItem
                                key={key}
                                onClick={() => handleQuickStageUpdate(customer.id, key as CustomerStage)}
                                className={cn(
                                  "text-[10px] md:text-xs flex items-center justify-between font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors",
                                  isCurrent ? "bg-accent/40 text-primary" : "hover:bg-muted"
                                )}
                              >
                                <span className="flex items-center gap-2">
                                  <ItemIcon className="h-3.5 w-3.5" />
                                  {config.label}
                                </span>
                                {isCurrent && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <div className="flex flex-col gap-0.5 text-[9px] md:text-[10px] pl-0.5 font-medium">
                        {['contracted', 'production', 'production_completed', 'installation', 'completed'].includes(customer.stage) && customer.createdAt && (
                          <div className="flex items-center gap-1 text-emerald-600 font-semibold">
                            <Clock className="h-2.5 w-2.5 opacity-70" />
                            <span>Chốt/Cọc: {formatVNTime(customer.createdAt)}</span>
                          </div>
                        )}
                        {customer.consultedAt ? (
                          <div className="flex items-center gap-1 text-amber-600 font-semibold">
                            <Clock className="h-2.5 w-2.5 opacity-70" />
                            <span>Tư vấn: {formatVNTime(customer.consultedAt)}</span>
                          </div>
                        ) : (
                          customer.stage === 'consulting' && customer.createdAt && (
                            <div className="flex items-center gap-1 text-amber-600 font-semibold">
                              <Clock className="h-2.5 w-2.5 opacity-70" />
                              <span>Tư vấn: {formatVNTime(customer.createdAt)}</span>
                            </div>
                          )
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 md:gap-1.5 shrink-0">
                      {customer.workshop && (
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-[8px] md:text-[9px] font-bold px-2 py-0.5 rounded-md border select-none uppercase tracking-wider leading-none shrink-0 shadow-2xs",
                            (() => {
                              const norm = getNormalizedWorkshopId(customer.workshop);
                              if (norm === 'Hà Nội') return 'bg-rose-50 text-rose-600 border-rose-200';
                              if (norm === 'Cần Thơ') return 'bg-sky-50 text-sky-600 border-sky-200';
                              if (norm === 'Đồng Nai') return 'bg-indigo-50 text-indigo-600 border-indigo-200';
                              return 'bg-slate-50 text-slate-700 border-slate-200';
                            })()
                          )}
                        >
                          {getWorkshopName(customer.workshop)}
                        </Badge>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger render={
                          <Button variant="ghost" size="icon" className="h-6 w-6 md:h-7 md:w-7 rounded-lg text-slate-500">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        } />
                      <DropdownMenuContent align="end" className="rounded-xl">
                        {onViewQuotation && quotations.some(q => q.customerId === customer.id || (q.customerName === customer.name && q.phone === customer.phone)) && (
                          <DropdownMenuItem 
                            onClick={() => {
                              const customerQuotes = quotations.filter(q => q.customerId === customer.id || (q.customerName === customer.name && q.phone === customer.phone));
                              const sortedQuotes = [...customerQuotes].sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
                              const latestQuote = sortedQuotes[0];
                              if (latestQuote) {
                                onViewQuotation(latestQuote.id, latestQuote.customerName);
                              }
                            }}
                            className="text-xs text-emerald-600 font-bold gap-1"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Xem báo giá
                          </DropdownMenuItem>
                        )}
                        {onCreateQuotation && (
                          <DropdownMenuItem 
                            onClick={() => onCreateQuotation(customer.id)} 
                            className="text-xs text-primary font-bold gap-1"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Tạo báo giá
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => openEditDialog(customer)} className="text-xs">Sửa</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openViewDialog(customer)} className="text-xs">Chi tiết</DropdownMenuItem>
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
                        {customer.stage === 'contracted' && (
                          <DropdownMenuItem 
                            onClick={() => handleCancelDeposit(customer.id)} 
                            className="text-xs text-rose-600 font-medium"
                          >
                            Hủy cọc
                          </DropdownMenuItem>
                        )}
                        {customer.stage !== 'completed' && customer.stage !== 'lost' && (
                          <DropdownMenuItem 
                            onClick={() => handleQuickCompleteCustomer(customer.id)} 
                            className="text-xs text-emerald-600 font-medium"
                          >
                            Hoàn thành đơn hàng
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="text-destructive text-xs" onClick={() => handleDeleteCustomer(customer.id)}>Xóa</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <CardTitle className="text-xs md:text-sm font-bold tracking-tight leading-tight text-slate-900 dark:text-zinc-100 flex flex-wrap items-center gap-1.5">
                      <span>
                        {customer.code 
                          ? (customer.code.toLowerCase().includes(customer.name.toLowerCase()) 
                              ? customer.code 
                              : `${customer.code}_${customer.name}`)
                          : customer.name}
                      </span>
                      {customer.furnitureCategory && (
                        <>
                          <span className="text-slate-300 font-normal">|</span>
                          <span className="text-blue-600 font-semibold">{customer.furnitureCategory}</span>
                        </>
                      )}
                    </CardTitle>
                    {purchaseCount > 0 && (
                      <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs bg-emerald-50 text-emerald-700 text-[8px] md:text-[9px] font-bold uppercase tracking-wider border border-emerald-200/60">
                        <ShoppingBag className="h-2.5 w-2.5" />
                        <span>MUA {purchaseCount} LẦN</span>
                      </div>
                    )}
                    {isCompleted ? (
                      <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs bg-emerald-50 text-emerald-700 text-[8px] md:text-[9px] font-bold uppercase tracking-wider border border-emerald-200/60 ml-1.5">
                        <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />
                        <span>ĐÃ TẤT TOÁN</span>
                      </div>
                    ) : totalDebt > 0 ? (
                      <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs bg-amber-50 text-amber-700 text-[8px] md:text-[9px] font-bold uppercase tracking-wider border border-amber-200/60 ml-1.5">
                        <AlertTriangle className="h-2.5 w-2.5 text-amber-500" />
                        <span>CÒN LẠI: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(totalDebt)}</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="pt-2 border-t border-dashed border-slate-100 dark:border-zinc-800 space-y-1.5">
                    {/* Dòng 1: Số điện thoại */}
                    <div className="flex items-center text-[10px] md:text-xs text-muted-foreground font-semibold">
                      <Phone className="h-3 w-3 mr-1.5 opacity-60 text-primary" />
                      <a href={`tel:${customer.phone}`} className="hover:underline text-slate-700 dark:text-zinc-300">
                        {customer.phone}
                      </a>
                    </div>

                    {/* Dòng 2: Chi tiết đơn hàng */}
                    {(() => {
                      const showPrice = !!currentUser?.role?.toLowerCase()?.includes('quản lý') || currentUser?.permissions?.viewPrice !== false;
                      if (!showPrice) return null;

                      if (currentQuotation) {
                        const totalOrdersSum = currentQuotation.totalAmount || 0;
                        const totalDepositSum = currentQuotation.depositAmount || 0;
                        const remaining = Math.max(0, totalOrdersSum - totalDepositSum);
                        return (
                          <div className="flex justify-between items-start text-xs pt-0.5">
                            <span className="text-slate-500 font-semibold text-[11px] md:text-xs">
                              {currentQuotation.quotationNumber ? `Đơn #${currentQuotation.quotationNumber}:` : 'Giá trị:'}
                            </span>
                            <div className="flex flex-col items-end">
                              {totalOrdersSum > 0 ? (
                                <span className="font-bold text-blue-600 text-xs md:text-sm">
                                  {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(totalOrdersSum)}
                                </span>
                              ) : null}
                              {totalDepositSum > 0 && (
                                <span className="text-[10px] md:text-xs text-purple-600 font-bold mt-0.5">
                                  Cọc: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(totalDepositSum)}
                                </span>
                              )}
                              {isCompleted ? (
                                <span className="text-[8px] md:text-[10px] text-emerald-700 font-bold mt-0.5 bg-emerald-50 border border-emerald-200/50 px-1 rounded-sm">
                                  Đã tất toán
                                </span>
                              ) : remaining > 0 ? (
                                <span className="text-[8px] md:text-[10px] text-amber-700 font-extrabold mt-0.5 bg-amber-50 border border-amber-200/50 px-1 rounded-sm">
                                  Còn lại: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(remaining)}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        );
                      }

                      const validQuotations = customerQuotations.filter(q => q.status === 'accepted' || q.status === 'deposit');
                      const sortedPurchases = [...validQuotations].sort((a, b) => new Date(a.createdAt || a.date).getTime() - new Date(b.createdAt || b.date).getTime());
                      
                      const latestQuotationVal = customerQuotations.length > 0
                        ? [...customerQuotations].sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime())[0].totalAmount
                        : 0;

                      const totalOrdersSum = validQuotations.length > 0 
                        ? validQuotations.reduce((sum, q) => sum + (q.totalAmount || 0), 0)
                        : (customer.orderValue || latestQuotationVal || 0);

                      const totalDepositSum = validQuotations.length > 0
                        ? validQuotations.reduce((sum, q) => sum + (q.depositAmount || 0), 0)
                        : 0;

                      if (sortedPurchases.length > 1) {
                        return (
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100/80 space-y-1.5 text-[8px] md:text-[10px]">
                            <div className="font-extrabold text-slate-500 uppercase tracking-wider text-[7px] md:text-[8px] pb-1 border-b border-slate-200/50 flex justify-between">
                              <span>Chi tiết đơn hàng</span>
                              <span>{sortedPurchases.length} đơn</span>
                            </div>
                            <div className="space-y-1 max-h-[85px] overflow-y-auto custom-scrollbar">
                              {sortedPurchases.map((q, idx) => {
                                const qDeposit = q.depositAmount || 0;
                                return (
                                  <div key={q.id} className="flex justify-between items-center text-slate-600">
                                    <span className="font-medium text-slate-500">Đơn {idx + 1}:</span>
                                    <span className="font-semibold text-slate-900">
                                      {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(q.totalAmount || 0)}
                                      {qDeposit > 0 && (
                                        <span className="text-[7px] md:text-[9px] text-purple-600 font-bold ml-1">
                                          (Cọc: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(qDeposit)})
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="flex justify-between items-center pt-1.5 border-t border-dashed border-slate-200 mt-1 font-bold text-primary">
                              <span>Tổng cộng:</span>
                              <span className="font-black">
                                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(totalOrdersSum)}
                              </span>
                            </div>
                            {isCompleted ? (
                              <div className="flex justify-between items-center text-emerald-700 font-extrabold text-[8px] md:text-[10px] mt-1 pt-1 border-t border-dotted border-emerald-200">
                                <span>Thanh toán:</span>
                                <span>Đã tất toán</span>
                              </div>
                            ) : totalDebt > 0 ? (
                              <div className="flex justify-between items-center text-amber-700 font-extrabold text-[8px] md:text-[10px] mt-1 pt-1 border-t border-dotted border-amber-200">
                                <span>Còn lại:</span>
                                <span>
                                  {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(totalDebt)}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        );
                      }

                      return (
                        <div className="flex justify-between items-start text-xs pt-0.5">
                          <span className="text-slate-500 font-semibold text-[11px] md:text-xs">Giá trị:</span>
                          <div className="flex flex-col items-end">
                            {totalOrdersSum > 0 ? (
                              <span className="font-bold text-blue-600 text-xs md:text-sm">
                                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(totalOrdersSum)}
                              </span>
                            ) : null}
                            {totalDepositSum > 0 && (
                              <span className="text-[10px] md:text-xs text-purple-600 font-bold mt-0.5">
                                Cọc: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(totalDepositSum)}
                              </span>
                            )}
                            {isCompleted ? (
                              <span className="text-[8px] md:text-[10px] text-emerald-700 font-bold mt-0.5 bg-emerald-50 border border-emerald-200/50 px-1 rounded-sm">
                                Đã tất toán
                              </span>
                            ) : totalDebt > 0 ? (
                              <span className="text-[8px] md:text-[10px] text-amber-700 font-extrabold mt-0.5 bg-amber-50 border border-amber-200/50 px-1 rounded-sm">
                                Còn lại: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(totalDebt)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </CardHeader>
                <CardContent className="p-3.5 md:p-4 pt-0 md:pt-0 flex-1 flex flex-col justify-between gap-2.5">
                  <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-slate-500 dark:text-zinc-400 bg-slate-100/70 dark:bg-zinc-800/60 border border-slate-200/50 dark:border-zinc-700/50 px-3 py-2 rounded-xl">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{customer.address || '—'}</span>
                  </div>
                  
                  <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800 mt-auto">
                    {/* Hàng 1: Thông tin Sale và Cơ sở */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Avatar className="h-6 w-6 border border-border shadow-2xs">
                          <AvatarImage src={sale?.avatar} />
                          <AvatarFallback className="text-[8px] bg-slate-100 text-primary font-bold">{sale?.name?.charAt(0) || '?'}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col text-left">
                          <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 leading-none">{sale?.name || 'Chưa gán'}</span>
                          <span className="text-[10px] text-slate-400 font-medium mt-0.5">{getWorkshopName(customer.workshop)}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Hàng 2: Các nút hành động - Luôn thành 1 hàng cân đối trên cả Mobile và Desktop */}
                    <div className="flex items-center gap-1 pt-2 border-t border-dashed border-slate-100 dark:border-zinc-800 w-full">
                      {onViewQuotation && (currentQuotation || quotations.some(q => q.customerId === customer.id || (q.customerName === customer.name && q.phone === customer.phone))) && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 min-w-0 h-7 md:h-7.5 border-emerald-300 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-100/70 flex items-center justify-center gap-1 text-[9px] sm:text-[10px] md:text-[11px] font-bold rounded-lg px-1 sm:px-1.5 cursor-pointer shadow-2xs transition-colors"
                          onClick={() => {
                            if (currentQuotation) {
                              onViewQuotation(currentQuotation.id, currentQuotation.customerName);
                              return;
                            }
                            const customerQuotes = quotations.filter(q => q.customerId === customer.id || (q.customerName === customer.name && q.phone === customer.phone));
                            const sortedQuotes = [...customerQuotes].sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
                            const latestQuote = sortedQuotes[0];
                            if (latestQuote) {
                              onViewQuotation(latestQuote.id, latestQuote.customerName);
                            }
                          }}
                          title="Xem báo giá"
                        >
                          <FileText className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            <span className="hidden sm:inline">Xem </span>Báo giá
                          </span>
                        </Button>
                      )}
                      {onCreateQuotation && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 min-w-0 h-7 md:h-7.5 border-blue-300 text-blue-600 bg-blue-50/40 hover:bg-blue-100/60 flex items-center justify-center gap-1 text-[9px] sm:text-[10px] md:text-[11px] font-bold rounded-lg px-1 sm:px-1.5 cursor-pointer shadow-2xs transition-colors"
                          onClick={() => onCreateQuotation(customer.id)}
                          title="Tạo báo giá"
                        >
                          <Plus className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            <span className="hidden sm:inline">Tạo </span>Báo giá
                          </span>
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1 min-w-0 h-7 md:h-7.5 border-amber-300 text-amber-700 bg-amber-50/40 hover:bg-amber-100/60 flex items-center justify-center gap-1 text-[9px] sm:text-[10px] md:text-[11px] font-bold rounded-lg px-1 sm:px-1.5 cursor-pointer shadow-2xs transition-colors"
                        onClick={() => openEditDialog(customer)}
                        title="Sửa"
                      >
                        <Pencil className="h-3 w-3 shrink-0" />
                        <span className="truncate">Sửa</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1 min-w-0 h-7 md:h-7.5 border-slate-200 text-slate-700 dark:text-zinc-300 bg-slate-50/50 hover:bg-slate-100/70 flex items-center justify-center gap-1 text-[9px] sm:text-[10px] md:text-[11px] font-bold rounded-lg px-1 sm:px-1.5 cursor-pointer shadow-2xs transition-colors"
                        onClick={() => openViewDialog(customer)}
                        title="Chi tiết"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="truncate">Chi tiết</span>
                      </Button>
                    </div>
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
                      <Label htmlFor="edit-code">Mã khách hàng</Label>
                      <Input
                        id="edit-code"
                        value={selectedCustomer.code || ''}
                        onChange={(e) => setSelectedCustomer({ ...selectedCustomer, code: e.target.value })}
                        className="h-11 rounded-xl font-mono"
                        placeholder="Vd: KH060"
                      />
                    </div>
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
                        value={getNormalizedWorkshopId(selectedCustomer.workshop)} 
                        onValueChange={(v) => {
                          const updatedCode = updateCodePrefix(selectedCustomer.code || '', v, selectedCustomer.name);
                          setSelectedCustomer({ ...selectedCustomer, workshop: v, code: updatedCode });
                        }}
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
                    <div className="grid gap-2">
                      <Label>Loại khách hàng</Label>
                      <Select 
                        value={selectedCustomer.customerType || 'retail'} 
                        onValueChange={(v: CustomerType) => setSelectedCustomer({ ...selectedCustomer, customerType: v })}
                      >
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue placeholder="Chọn loại khách hàng" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="retail">Khách lẻ</SelectItem>
                          <SelectItem value="agency">Đại lý</SelectItem>
                          <SelectItem value="project">Dự án</SelectItem>
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
                      <Label htmlFor="edit-nextContactDate">Nhắc nhở gọi lại</Label>
                      <Input
                        id="edit-nextContactDate"
                        type="date"
                        value={selectedCustomer.nextContactDate || ''}
                        onChange={(e) => setSelectedCustomer({ ...selectedCustomer, nextContactDate: e.target.value })}
                        className="h-11 rounded-xl"
                      />
                    </div>
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
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSaving}>Hủy</Button>
            <Button onClick={handleUpdateCustomer} disabled={isSaving}>
              {isSaving ? "Đang lưu..." : "Cập nhật"}
            </Button>
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
                      <span className="inline-block bg-white/20 text-white border border-white/30 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-black font-mono tracking-wider uppercase mb-1.5">
                        {selectedCustomer.code}
                      </span>
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
                      {(() => {
                        const customerQuotations = quotations.filter(q => q.customerId === selectedCustomer.id || (q.customerName === selectedCustomer.name && q.phone === selectedCustomer.phone));
                        let purchaseCount = customerQuotations.filter(q => q.status === 'accepted' || q.status === 'deposit').length;
                        if (purchaseCount === 0 && ['contracted', 'production', 'production_completed', 'installation', 'completed'].includes(selectedCustomer.stage)) {
                          purchaseCount = 1;
                        }
                        if (purchaseCount > 0) {
                          return (
                            <span className="flex items-center gap-1.5 font-bold text-emerald-200">
                              <Package className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Mua {purchaseCount} lần
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
                
                {/* Lịch sử mua hàng / Đơn hàng */}
                {(() => {
                  const customerQuotations = quotations.filter(q => q.customerId === selectedCustomer.id || (q.customerName === selectedCustomer.name && q.phone === selectedCustomer.phone));
                  const validPurchases = customerQuotations.filter(q => q.status === 'accepted' || q.status === 'deposit');
                  
                  const sortedPurchases = [...validPurchases].sort((a, b) => new Date(a.createdAt || a.date).getTime() - new Date(b.createdAt || b.date).getTime());
                  
                  const totalSum = sortedPurchases.reduce((sum, q) => sum + (q.totalAmount || 0), 0);
                  const showPrice = !!currentUser?.role?.toLowerCase()?.includes('quản lý') || currentUser?.permissions?.viewPrice !== false;
                  
                  if (!showPrice) return null;

                  if (sortedPurchases.length === 0) {
                    if (['contracted', 'production', 'production_completed', 'installation', 'completed'].includes(selectedCustomer.stage)) {
                      const orderVal = selectedCustomer.orderValue || 0;
                      return (
                        <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100 space-y-2.5">
                          <Label className="text-[9px] font-extrabold uppercase tracking-widest text-slate-500 flex items-center gap-1">
                            <Package className="h-3 w-3 text-primary" /> Lịch sử mua hàng
                          </Label>
                          <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                              <span className="font-semibold text-slate-600">Lần 1:</span>
                              <span className="font-bold text-slate-900">{formatCurrency(orderVal)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-1.5 font-extrabold text-xs text-primary border-t border-slate-200">
                              <span>Tổng giá trị đơn hàng:</span>
                              <span>{formatCurrency(orderVal)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }

                  return (
                    <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100 space-y-2.5">
                      <Label className="text-[9px] font-extrabold uppercase tracking-widest text-slate-500 flex items-center gap-1">
                        <Package className="h-3 w-3 text-primary" /> Lịch sử mua hàng ({sortedPurchases.length} đơn)
                      </Label>
                      <div className="space-y-1.5 text-xs">
                        {sortedPurchases.map((q, idx) => (
                          <div key={q.id} className="flex justify-between items-center py-1 border-b border-dashed border-slate-200/60 last:border-0">
                            <span className="font-medium text-slate-600 flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-full bg-slate-200 text-[10px] text-slate-700 flex items-center justify-center font-bold font-mono">
                                {idx + 1}
                              </span>
                              <span>Đơn #{q.quotationNumber} ({formatVNTime(q.createdAt || q.date).split(' ')[0]}):</span>
                            </span>
                            <span className="font-bold text-slate-900">{formatCurrency(q.totalAmount || 0)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between items-center pt-2 font-black text-xs text-primary border-t border-slate-200/80">
                          <span>TỔNG GIÁ TRỊ CÁC ĐƠN HÀNG:</span>
                          <span>{formatCurrency(totalSum)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="space-y-1.5">
                  <Label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 ml-1">Nhật ký & Ghi chú</Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Thêm ghi chú chăm sóc khách hàng mới..." 
                      className="text-xs h-9 bg-secondary/20"
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddNote();
                      }}
                    />
                    <Button onClick={handleAddNote} size="sm" className="h-9 px-4 text-xs font-bold shrink-0">
                      Thêm
                    </Button>
                  </div>
                  {selectedCustomer.notes && (!selectedCustomer.notesList || selectedCustomer.notesList.length === 0) && (
                    <div className="p-3 rounded-xl bg-secondary/20 border border-dashed border-border/50 min-h-[60px] mt-2">
                      <p className="text-xs text-muted-foreground italic leading-relaxed">
                        "{selectedCustomer.notes}"
                      </p>
                    </div>
                  )}
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
                      })),
                      ...(selectedCustomer.notesList || []).map(n => ({
                        id: n.id,
                        type: 'other' as const,
                        timestamp: n.createdAt,
                        action: `Nhật ký ghi chú`,
                        note: n.content,
                        updatedBy: n.createdBy
                      }))
                    ].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())}
                  />
                  </div>
              </div>

              <div className="p-4 border-t bg-slate-50/80 flex justify-end gap-3 shrink-0">
                <Button variant="outline" className="rounded-xl px-6 h-10 text-xs font-semibold" onClick={() => setIsViewDialogOpen(false)}>Đóng</Button>
                {selectedCustomer.stage === 'contracted' && (
                  <Button 
                    variant="destructive"
                    className="rounded-xl px-6 h-10 text-xs font-bold"
                    onClick={() => {
                      setIsViewDialogOpen(false);
                      handleCancelDeposit(selectedCustomer.id);
                    }}
                  >
                    Hủy cọc
                  </Button>
                )}
                {onCreateQuotation && (
                  <Button 
                    variant="outline" 
                    className="rounded-xl px-6 h-10 text-xs font-bold border-primary/20 text-primary hover:bg-primary/5"
                    onClick={() => {
                      setIsViewDialogOpen(false);
                      onCreateQuotation(selectedCustomer.id);
                    }}
                  >
                    Tạo báo giá
                  </Button>
                )}
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
        addressQuery={locationPickerFor === 'add' ? newCustomer.address : selectedCustomer?.address}
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
