import { z } from 'zod';

const timestampSchema = z.union([
  z.string(),
  z.object({
    toDate: z.function().returns(z.date()),
  }).transform((val) => val.toDate().toISOString()),
  z.any().transform((val) => {
    if (!val) return new Date().toISOString(); // Default to now if null (e.g. pending server timestamp)
    if (typeof val === 'object' && 'seconds' in val && 'nanoseconds' in val) {
       return new Date(val.seconds * 1000).toISOString();
    }
    try {
      return new Date(val).toISOString();
    } catch {
      return new Date().toISOString();
    }
  })
]).optional().nullable();

export const PrioritySchema = z.enum(['low', 'medium', 'high']);
export const StatusSchema = z.enum(['todo', 'in-progress', 'review', 'done', 'waiting_install', 'archived']);
export const CustomerStageSchema = z.enum(['consulting', 'surveying', 'contracted', 'production', 'installation', 'completed', 'lost']);

export const MemberPermissionsSchema = z.object({
  viewPrice: z.boolean().optional().catch(true),
  viewRevenue: z.boolean().optional().catch(true),
  menuProduction: z.boolean().optional().catch(true),
  menuMeasurement: z.boolean().optional().catch(true),
  menuOrders: z.boolean().optional().catch(true),
  menuQuotations: z.boolean().optional().catch(true),
  menuSale: z.boolean().optional().catch(true),
  menuDesign: z.boolean().optional().catch(true),
  menuMarketing: z.boolean().optional().catch(true),
  menuReports: z.boolean().optional().catch(true),
  menuMedia: z.boolean().optional().catch(true),
  menuMembers: z.boolean().optional().catch(true),
  menuCustomers: z.boolean().optional().catch(true),
  menuAi: z.boolean().optional().catch(true),
});

export const MemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  avatar: z.string(),
  email: z.string().optional().or(z.literal('')).catch(''),
  workshop: z.string().optional(),
  permissions: MemberPermissionsSchema.optional(),
});

export const CustomerSchema = z.object({
  id: z.string(),
  code: z.string().optional(),
  name: z.string(),
  phone: z.string(),
  address: z.string(),
  stage: CustomerStageSchema,
  notes: z.string(),
  assignedSaleId: z.string(),
  orderValue: z.number().optional(),
  createdAt: timestampSchema,
  oneDriveLink: z.string().optional(),
  furnitureCategory: z.string().optional(),
  workshop: z.string().optional(),
});

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  assigneeId: z.string(),
  dueDate: z.string(),
  priority: PrioritySchema,
  status: StatusSchema,
  createdAt: timestampSchema,
  completedAt: timestampSchema.optional(),
  waiting_install_at: timestampSchema.optional(),
  type: z.enum(['production', 'design', 'sale', 'marketing', 'general']).optional(),
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  workshop: z.string().optional(),
  column: z.string().optional(),
  files2D3D: z.array(z.string()).optional(),
  imageUrls: z.array(z.string()).optional(),
  checklists: z.array(z.object({
    id: z.string(),
    title: z.string(),
    completed: z.boolean(),
  })).optional(),
  materialList: z.array(z.object({
    id: z.string(),
    name: z.string(),
    quantity: z.number(),
    unit: z.string(),
  })).optional(),
  materialRequisition: z.object({
    receiver: z.string().optional(),
    department: z.string().optional(),
    items: z.array(z.any()).optional(),
  }).optional(),
  productionChecklist: z.object({
    customerName: z.string().optional(),
    customerId: z.string().optional(),
    address: z.string().optional(),
    productionLead: z.string().optional(),
    projectName: z.string().optional(),
    colorCode: z.string().optional(),
    productionDate: z.string().optional(),
    installationDate: z.string().optional(),
    items: z.array(z.object({
      id: z.string(),
      department: z.string(),
      stt: z.number(),
      description: z.string(),
      roles: z.array(z.string()).optional(),
      confirmedBy: z.string().optional(),
      timestamp: z.string().optional(),
      notes: z.string().optional(),
    })).optional(),
  }).optional(),
});

export const MediaFolderSchema = z.object({
  id: z.string(),
  name: z.string(),
  link: z.string(),
  createdAt: timestampSchema,
});

export const QuotationItemSchema = z.object({
  id: z.string(),
  category: z.string(),
  name: z.string(),
  description: z.string(),
  unit: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  total: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  imageUrl: z.string().optional(),
});

export const QuotationSchema = z.object({
  id: z.string(),
  quotationNumber: z.string(),
  customerName: z.string(),
  phone: z.string(),
  address: z.string(),
  constructionType: z.string(),
  estimatedTime: z.string(),
  date: z.string(),
  items: z.array(QuotationItemSchema),
  subTotal: z.number(),
  discount: z.number(),
  totalAmount: z.number(),
  paymentInfo: z.object({
    bankName: z.string(),
    accountNumber: z.string(),
    accountHolder: z.string(),
    content: z.string(),
  }),
  createdBy: z.string(),
  createdAt: timestampSchema,
  status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'deposit']),
  depositAmount: z.number().optional(),
  customerId: z.string().optional(),
});

export const ProductLibraryItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  productName: z.string(),
  description: z.string().optional().default(''),
  imageUrl: z.string().optional().or(z.literal('')).default(''),
  unit: z.string(),
  unitPrice: z.number(),
  createdAt: timestampSchema.optional(),
  updatedAt: timestampSchema.optional(),
});

export const MeasurementScheduleSchema = z.object({
  id: z.string(),
  date: z.string(),
  customerId: z.string().optional(),
  customerName: z.string(),
  phone: z.string(),
  address: z.string(),
  status: z.enum(['pending', 'completed', 'cancelled']),
  assigneeId: z.string(),
    assigneeIds: z.array(z.string()).optional(),
    notes: z.string().optional(),
  createdAt: timestampSchema,
  imageUrls: z.array(z.string()).optional(),
  designAssigneeId: z.string().optional(),
  isPushedToDesign: z.boolean().optional(),
});

export const InstallationScheduleSchema = z.object({
  id: z.string(),
  date: z.string(),
  taskId: z.string().optional(),
  customerId: z.string().optional(),
  customerName: z.string(),
  phone: z.string(),
  address: z.string(),
  status: z.enum(['pending', 'completed', 'cancelled']),
  assigneeId: z.string(),
  notes: z.string().optional(),
  createdAt: timestampSchema,
  imageUrls: z.array(z.string()).optional(),
});

export const TrashItemSchema = z.object({
  id: z.string(),
  originalId: z.string(),
  collection: z.string(),
  title: z.string(),
  data: z.any(),
  deletedAt: timestampSchema,
  deletedBy: z.string(),
});
