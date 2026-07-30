import { z } from 'zod';

const timestampSchema = z.any().transform((val) => {
  if (!val) return new Date().toISOString(); // Default to now if null (e.g. pending server timestamp)
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    if (typeof val.toDate === 'function') {
      try {
        return val.toDate().toISOString();
      } catch (e) {
        return new Date().toISOString();
      }
    }
    if ('seconds' in val && 'nanoseconds' in val) {
       return new Date(val.seconds * 1000).toISOString();
    }
  }
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch {}
  return new Date().toISOString();
}).optional().nullable();

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
  menuInstallations: z.boolean().optional().catch(true),
  menuAi: z.boolean().optional().catch(true),
});

export const MemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  avatar: z.string().optional().or(z.literal('')).catch(''),
  email: z.string().optional().or(z.literal('')).catch(''),
  workshop: z.string().optional(),
  permissions: MemberPermissionsSchema.optional(),
  zaloUserId: z.string().optional(),
});

export const SalesRouteSchema = z.object({
  id: z.string(),
  memberId: z.string(),
  memberName: z.string(),
  zaloUserId: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
  timestamp: timestampSchema,
  note: z.string().optional(),
  address: z.string().optional(),
});

export const CustomerSchema = z.object({
  id: z.string(),
  code: z.string().optional(),
  name: z.string().catch('Khách hàng không tên').default('Khách hàng không tên'),
  phone: z.string().catch('').default(''),
  address: z.string().catch('').default(''),
  stage: CustomerStageSchema.catch('consulting').default('consulting'),
  notes: z.string().catch('').default(''),
  assignedSaleId: z.string().catch('').default(''),
  orderValue: z.number().optional(),
  createdAt: timestampSchema,
  oneDriveLink: z.string().optional(),
  furnitureCategory: z.string().optional(),
  workshop: z.string().optional(),
  consultedAt: timestampSchema,
  location: z.object({
    lat: z.number(),
    lng: z.number()
  }).optional().nullable(),
  warrantyStartDate: z.string().optional(),
  warrantyEndDate: z.string().optional(),
  careLogs: z.array(z.object({
    id: z.string(),
    date: z.string(),
    note: z.string(),
    createdBy: z.string(),
    createdByName: z.string().optional(),
  })).optional(),
  nextContactDate: z.string().optional(),
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
  scheduledDate: z.string().optional(),
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
  }).optional().nullable(),
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
  }).optional().nullable(),
  installationImages: z.array(z.string()).optional(),
  installationProgressImages: z.array(z.object({
    id: z.string(),
    url: z.string(),
    stage: z.enum(['Phá dỡ', 'Lên khung', 'Vào cánh', 'Nghiệm thu', 'Khác']),
    timestamp: z.string(),
    uploaderName: z.string().optional()
  })).optional(),
  installationIssues: z.string().optional(),
  checkinLocation: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional().nullable(),
  checkinTime: z.string().optional(),
});

export const MediaFolderSchema = z.object({
  id: z.string(),
  name: z.string(),
  link: z.string(),
  createdAt: timestampSchema,
});

export const ProductLibraryItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  productName: z.string(),
  description: z.string().optional().catch(''),
  imageUrl: z.string().optional().catch(''),
  unit: z.string(),
  unitPrice: z.number(),
  workshopPrices: z.record(z.string(), z.number()).optional().catch(() => ({})),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  category: z.string().optional(),
  isStandard: z.boolean().optional(),
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
  width: z.union([z.number(), z.string()]).optional(),
  height: z.union([z.number(), z.string()]).optional(),
  cornerL: z.union([z.number(), z.string()]).optional(),
  imageUrl: z.string().optional(),
  basePrice: z.number().optional(),
  materialCode: z.string().optional(),
  materialName: z.string().optional(),
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
  consultedAt: timestampSchema,
  workshop: z.string().optional(),
  hasVat: z.boolean().optional(),
  vatRate: z.number().optional(),
  vatAmount: z.number().optional(),
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
  assigneeIds: z.array(z.string()).optional(),
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

export const SystemSettingsSchema = z.object({
  id: z.string().optional(),
  factoryLocation: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(),
  hiddenStandardProducts: z.array(z.string()).optional().catch(() => []),
  updatedAt: z.string().optional(),
});

export const BotNotificationConfigSchema = z.object({
  telegram: z.object({
    botToken: z.string().optional(),
    chatId: z.string().optional(),
    isActive: z.boolean().optional(),
    groups: z.object({
      customers: z.string().optional(),
      measurements: z.string().optional(),
      production: z.string().optional(),
      design: z.string().optional(),
    }).optional(),
    workshopGroups: z.record(
      z.string(),
      z.object({
        customers: z.string().optional(),
        measurements: z.string().optional(),
        production: z.string().optional(),
        design: z.string().optional(),
      })
    ).optional().catch(() => ({})),
  }).optional(),
  zalo: z.object({
    botToken: z.string().optional(),
    chatId: z.string().optional(),
    isActive: z.boolean().optional(),
    groups: z.object({
      customers: z.string().optional(),
      measurements: z.string().optional(),
      production: z.string().optional(),
      design: z.string().optional(),
    }).optional(),
    workshopGroups: z.record(
      z.string(),
      z.object({
        customers: z.string().optional(),
        measurements: z.string().optional(),
        production: z.string().optional(),
        design: z.string().optional(),
      })
    ).optional().catch(() => ({})),
  }).optional(),
  updatedAt: timestampSchema,
  updatedBy: z.string().optional(),
});

export const MaterialConfigSchema = z.object({
  id: z.string(),
  category: z.string().optional(),
  code: z.string().min(1, "Mã hàng hoá không được để trống"),
  width: z.string().optional(),
  thickness: z.string().optional(),
  length: z.string().optional(),
  itemsPerBox: z.string().optional(),
  unit: z.string().min(1, "Đơn vị tính không được để trống"),
  preTaxMeterPrice: z.number().optional(),
  preTaxBoxPrice: z.number().optional(),
  listedMeterPrice: z.number().optional(),
  listedBoxPrice: z.number().optional(),
  finalPrice: z.number().optional(),
  discountPercent: z.number().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const AccessoryConfigSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Tên phụ kiện không được để trống"),
  code: z.string().min(1, "Mã hàng hoá không được để trống"),
  option: z.string().optional(),
  unit: z.string().min(1, "Đơn vị tính không được để trống"),
  preTaxPrice: z.number().optional(),
  listedPrice: z.number().optional(),
  finalPrice: z.number().optional(),
  discountPercent: z.number().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

