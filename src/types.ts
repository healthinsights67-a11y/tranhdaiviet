export type Priority = 'low' | 'medium' | 'high';
export type Status = 'todo' | 'in-progress' | 'review' | 'done' | 'waiting_install' | 'archived';
export type CustomerStage = 'consulting' | 'surveying' | 'contracted' | 'lost';
export type OrderStatus = 'pending' | 'processing' | 'shipping' | 'completed' | 'cancelled';

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
}

export interface Customer {
  id: string;
  code?: string;
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
}

export interface Order {
  id: string;
  customerName: string;
  totalValue: number;
  status: OrderStatus;
  orderDate: string;
  deliveryDate?: string;
  completedAt?: string;
  items: string;
  workshop?: string;
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
}

export const WORKSHOPS = [
  { id: 'all', name: 'Tất cả cơ sở' },
  { id: 'Cơ Sở 1', name: 'Cơ Sở 1' },
  { id: 'Cơ Sở 2', name: 'Cơ Sở 2' }
];

export const getWorkshopName = (id?: string) => {
  if (!id || id === 'all') return 'Tất cả cơ sở';
  const found = WORKSHOPS.find(w => w.id === id);
  if (found) return found.name;
  // Fallback for legacy IDs
  if (id === 'CoSo1' || id === 'XuongGo') return 'Cơ Sở 1';
  if (id === 'CoSo2' || id === 'XuongNhua') return 'Cơ Sở 2';
  return id;
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
  width?: number;
  height?: number;
  imageUrl?: string;
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
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  customerId?: string;
  imageUrls?: string[];
}

export interface ProductLibraryItem {
  id: string;
  userId: string;
  productName: string;
  description: string;
  imageUrl: string;
  unit: string;
  unitPrice: number;
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
  notes?: string;
  createdAt: string;
  imageUrls?: string[];
  designAssigneeId?: string;
  isPushedToDesign?: boolean;
}
