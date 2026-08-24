export type Priority = 'low' | 'medium' | 'high';
export type Status = 'todo' | 'in-progress' | 'review' | 'done' | 'waiting_install' | 'archived';
export type CustomerStage = 'consulting' | 'surveying' | 'contracted' | 'production' | 'production_completed' | 'installation' | 'completed' | 'lost';


export interface MemberPermissions {
  viewPrice: boolean;
  viewRevenue: boolean;
  menuProduction: boolean;
  menuMeasurement: boolean;
  menuOrders: boolean;
  menuQuotations: boolean;
  menuSale: boolean;
  menuDesign: boolean;
  menuMarketing: boolean;
  menuReports: boolean;
  menuMedia: boolean;
  menuMembers: boolean;
  menuCustomers: boolean;
  menuInstallations: boolean;
  menuAi: boolean;
}

export interface Member {
  id: string;
  name: string;
  role: string;
  avatar: string;
  email: string;
  workshop?: string;
  permissions?: MemberPermissions;
  zaloUserId?: string;
}

export interface SalesRoute {
  id: string;
  memberId: string;
  memberName: string;
  zaloUserId?: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  note?: string;
  address?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
}

export interface CustomerNote {
  id: string;
  content: string;
  createdBy: string;
  createdAt: string;
}

export type CustomerType = 'retail' | 'agency' | 'project';

export interface Customer {
  id: string;
  code?: string;
  customerType?: CustomerType;
  name: string;
  phone: string;
  address: string;
  stage: CustomerStage;
  notes: string;
  assignedSaleId: string;
  orderValue?: number;
  createdAt: string;
  oneDriveLink?: string;
  furnitureCategory?: string;
  workshop?: string;
  consultedAt?: string;
  location?: { lat: number; lng: number };
  notesList?: CustomerNote[];
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  careLogs?: {
    id: string;
    date: string;
    note: string;
    createdBy: string;
    createdByName?: string;
  }[];
  nextContactDate?: string;
}

export interface InstallationProgressImage {
  id: string;
  url: string;
  stage: 'Phá dỡ' | 'Lên khung' | 'Vào cánh' | 'Nghiệm thu' | 'Khác';
  timestamp: string;
  uploaderName?: string;
}

export interface MarketingTaskItem {
  id: string;
  title: string;
  targetQuantity: number;
  completedQuantity: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assigneeId: string;
  dueDate: string;
  priority: Priority;
  status: Status;
  createdAt: string;
  completedAt?: string;
  waiting_install_at?: string;
  type?: 'production' | 'design' | 'sale' | 'marketing' | 'general';
  customerId?: string;
  customerName?: string;
  phone?: string;
  address?: string;
  workshop?: string;
  column?: string;
  scheduledDate?: string; // YYYY-MM-DD, dùng cho weekly planner
  files2D3D?: string[]; // URLs or storage references
  imageUrls?: string[]; // URLs from measurement stage
  checklists?: { id: string; title: string; completed: boolean }[];
  materialList?: { id: string; name: string; quantity: number; unit: string }[];
  materialRequisition?: {
    receiver?: string;
    department?: string;
    items?: any[];
  };
  productionChecklist?: {
    customerName?: string;
    customerId?: string;
    address?: string;
    productionLead?: string;
    projectName?: string;
    colorCode?: string;
    productionDate?: string;
    installationDate?: string;
    items?: {
      id: string;
      department: string;
      stt: number;
      description: string;
      roles?: string[]; // roles that are "Phụ Trách" for this task
      confirmedBy?: string;
      timestamp?: string;
      notes?: string;
    }[];
  };
  installationImages?: string[];
  installationProgressImages?: InstallationProgressImage[];
  installationIssues?: string;
  checkinLocation?: { lat: number; lng: number };
  checkinTime?: string;
  marketingTasks?: MarketingTaskItem[];
}

export const WORKSHOPS = [
  { id: 'all', name: 'Tất cả cơ sở' },
  { id: 'Hà Nội', name: 'Hà Nội' },
  { id: 'Cần Thơ', name: 'Cần Thơ' },
  { id: 'Đồng Nai', name: 'Đồng Nai' }
];

export const getNormalizedWorkshopId = (id?: string) => {
  if (!id || id === 'all') return 'all';
  const cleanId = id.trim();
  if (cleanId === 'CoSo1' || cleanId === 'XuongGo' || cleanId === 'Cơ Sở 1' || cleanId === 'Hà Nội') return 'Hà Nội';
  if (cleanId === 'CoSo2' || cleanId === 'XuongNhua' || cleanId === 'Cơ Sở 2' || cleanId === 'Cần Thơ') return 'Cần Thơ';
  if (cleanId === 'CoSo3' || cleanId === 'Cơ Sở 3' || cleanId === 'Đồng Nai') return 'Đồng Nai';
  return cleanId;
};

export const getWorkshopName = (id?: string) => {
  if (!id || id === 'all') return 'Tất cả cơ sở';
  const normalized = getNormalizedWorkshopId(id);
  const found = WORKSHOPS.find(w => w.id === normalized);
  if (found) return found.name;
  return id;
};

export const updateCodePrefix = (currentCode: string, newWorkshopId: string, customerName: string) => {
  const normWs = getNormalizedWorkshopId(newWorkshopId);
  let newPrefix = 'HN';
  if (normWs === 'Cần Thơ') newPrefix = 'CT';
  else if (normWs === 'Đồng Nai') newPrefix = 'ĐN';
  
  if (!currentCode) {
    return `${newPrefix}001_${customerName}`;
  }
  
  // Match prefix like KH, HN, CT, ĐN or any letters followed by digits
  const match = currentCode.match(/^([a-zA-ZÀ-Ỹà-ỹ\s]+)?(\d+)(.*)$/u);
  if (match) {
    const [, , digits, rest] = match;
    return `${newPrefix}${digits}${rest}`;
  }
  return `${newPrefix}${currentCode.replace(/^([a-zA-ZÀ-Ỹà-ỹ\s]+)?/u, '')}`;
};

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'update' | 'overdue' | 'mention';
  timestamp: string;
  read: boolean;
}

export interface MediaFolder {
  id: string;
  name: string;
  link: string;
  createdAt: string;
}

export interface QuotationItem {
  id: string;
  category: string;
  name: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  total: number;
  width?: number | string;
  height?: number | string;
  cornerL?: number | string;
  imageUrl?: string;
  materialCode?: string;
  materialName?: string;
  basePrice?: number;
}

export interface Quotation {
  id: string;
  quotationNumber: string;
  customerName: string;
  phone: string;
  address: string;
  constructionType: string;
  estimatedTime: string;
  date: string;
  items: QuotationItem[];
  subTotal: number;
  discount: number;
  totalAmount: number;
  paymentInfo: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    content: string;
  };
  createdBy: string;
  createdAt: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'deposit';
  depositAmount?: number;
  customerId?: string;
  imageUrls?: string[];
  consultedAt?: string;
  workshop?: string;
  hasVat?: boolean;
  vatRate?: number;
  vatAmount?: number;
  type?: 'custom' | 'ready-made';
}

export interface ProductLibraryItem {
  id: string;
  userId: string;
  productName: string;
  description: string;
  imageUrl: string;
  unit: string;
  unitPrice: number;
  workshopPrices?: Record<string, number>;
  createdAt: string;
  updatedAt: string;
  category?: string;
  isStandard?: boolean;
}

export interface MeasurementSchedule {
  id: string;
  date: string;
  customerId?: string;
  customerName: string;
  phone: string;
  address: string;
  status: 'pending' | 'completed' | 'cancelled';
  assigneeId: string;
    assigneeIds?: string[];
    notes?: string;
  createdAt: string;
  imageUrls?: string[];
  designAssigneeId?: string;
  isPushedToDesign?: boolean;
  workshop?: string;
}

export interface InstallationSchedule {
  id: string;
  date: string;
  taskId?: string;
  customerId?: string;
  customerName: string;
  phone: string;
  address: string;
  status: 'pending' | 'completed' | 'cancelled';
  assigneeId: string;
  assigneeIds?: string[];
  notes?: string;
  createdAt: string;
  imageUrls?: string[];
  workshop?: string;
}

export interface TrashItem {
  id: string;
  originalId: string;
  collection: string;
  title: string;
  data: any;
  deletedAt: string;
  deletedBy: string;
}

export interface MaterialConfig {
  id: string;
  category?: string;
  code: string;
  width?: string;
  thickness?: string;
  length?: string;
  itemsPerBox?: string;
  unit: string;
  preTaxMeterPrice?: number;
  preTaxBoxPrice?: number;
  listedMeterPrice?: number;
  listedBoxPrice?: number;
  
  // Keep legacy fields for backward compatibility during transition
  name?: string;
  unitPrice?: number;
  discountPercent?: number;
  finalPrice?: number;

  // Inventory fields
  stock?: number;
  minStock?: number;
}

export interface ProfitAnalysis {
  taskId: string;
  taskTitle: string;
  customerName?: string;
  quotationValue: number;
  materialCost: number;
  profit: number;
  completedAt: string;
}

export interface MaterialMultiplier {
  id: string;
  stt: number;
  code: string;
  material: string;
  description: string;
  globalBasePrice?: number;
  percentage: number;
}

export interface SystemSettings {
  id?: string;
  factoryLocation?: {
    lat: number;
    lng: number;
  };
  hiddenStandardProducts?: string[];
  updatedAt?: string;
}

export interface AccessoryConfig {
  id: string;
  name: string;
  code: string;
  option?: string;
  unit: string;
  preTaxPrice?: number;
  listedPrice?: number;
  finalPrice?: number;
  discountPercent?: number;
  createdAt?: string;
  updatedAt?: string;

  // Inventory fields
  stock?: number;
  minStock?: number;
}

export interface InventoryTransaction {
  id: string;
  itemId: string;
  itemType: 'material' | 'accessory';
  itemCode: string;
  itemName: string;
  type: 'import' | 'export';
  quantity: number;
  unit: string;
  note?: string;
  createdBy: string;
  createdAt: string;
}
