import { Task, Member, Notification, Customer, Quotation } from '../types';

export const MOCK_QUOTATIONS: Quotation[] = [
  {
    id: 'q1',
    quotationNumber: 'BG-2026807',
    customerName: 'Anh Hùng - Vinhomes',
    phone: '0901234567',
    address: 'Vinhomes Grand Park, Q9',
    constructionType: 'Thi công nội thất trọn gói',
    estimatedTime: '20 ngày',
    date: '2024-04-20',
    items: [
      {
        id: 'item-1',
        name: 'Tủ Áo',
        category: 'Phòng ngủ',
        unit: 'm2',
        quantity: 3.5,
        unitPrice: 1942500,
        total: 6798750,
        description: 'Tủ áo sâu 55'
      }
    ],
    subTotal: 6798750,
    discount: 0,
    totalAmount: 6798750,
    paymentInfo: {
      bankName: 'MB Bank',
      accountNumber: '123456789',
      accountHolder: 'CTY PH HOME',
      content: 'Thanh toan BG-2026807'
    },
    status: 'draft',
    createdAt: '2024-04-20T10:00:00Z',
    createdBy: '1'
  },
  {
    id: 'q2',
    quotationNumber: 'BG-2026112',
    customerName: 'Chị Lan - Quận 7',
    phone: '0912345678',
    address: '123 Đường số 4, Q7',
    constructionType: 'Làm lẻ hạng mục',
    estimatedTime: '7 ngày',
    date: '2024-04-22',
    items: [
      {
        id: 'item-2',
        name: 'Tủ bếp',
        category: 'Phòng bếp',
        unit: 'md',
        quantity: 2.5,
        unitPrice: 4200000,
        total: 10500000,
        description: 'Tủ bếp trên + dưới'
      }
    ],
    subTotal: 10500000,
    discount: 0,
    totalAmount: 10500000,
    paymentInfo: {
      bankName: 'MB Bank',
      accountNumber: '123456789',
      accountHolder: 'CTY PH HOME',
      content: 'Thanh toan BG-2026112'
    },
    status: 'sent',
    createdAt: '2024-04-22T08:30:00Z',
    createdBy: '5'
  }
];

export const MOCK_MEMBERS: Member[] = [
  {
    id: '1',
    name: 'Nguyễn Văn An',
    role: 'Thiết kế',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=An',
    email: 'an.nguyen@plastihome.vn',
    workshop: 'Cơ Sở 1',
  },
  {
    id: '2',
    name: 'Trần Thị Bình',
    role: 'Tổng quản lý',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Binh',
    email: 'binh.tran@plastihome.vn',
    workshop: 'Cơ Sở 2',
  },
  {
    id: '3',
    name: 'Lê Văn Cường',
    role: 'Thợ chính',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Cuong',
    email: 'cuong.le@plastihome.vn',
    workshop: 'Cơ Sở 1',
  },
  {
    id: '4',
    name: 'Phạm Văn Dũng',
    role: 'Tổ trưởng lắp đặt',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dung',
    email: 'dung.pham@plastihome.vn',
    workshop: 'Cơ Sở 2',
  },
  {
    id: '5',
    name: 'Hoàng Thu Thủy',
    role: 'Sale',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Thuy',
    email: 'thuy.hoang@plastihome.vn',
    workshop: 'Cơ Sở 1',
  },
  {
    id: '6',
    name: 'Trần Quang Đạo',
    role: 'Giám đốc',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dao',
    email: 'dao.tran@plastihome.vn',
    workshop: 'all',
  },
];

export const MOCK_CUSTOMERS: Customer[] = [
  {
    id: 'c1',
    code: 'KH001_Anh Hùng - Vinhomes',
    name: 'Anh Hùng - Vinhomes',
    phone: '0901234567',
    address: 'Tòa S1.02, Vinhomes Grand Park, Q9',
    stage: 'consulting',
    notes: 'Quan tâm tủ bếp Ecoplast vân gỗ sồi.',
    assignedSaleId: '5',
    orderValue: 25000000,
    createdAt: '2024-04-10',
    furnitureCategory: 'Tủ bếp',
  },
  {
    id: 'c2',
    code: 'KH002_Chị Lan - Quận 7',
    name: 'Chị Lan - Quận 7',
    phone: '0912345678',
    address: '123 Đường số 4, P. Tân Phong, Q7',
    stage: 'consulting',
    notes: 'Cần làm tủ quần áo 4 cánh cho con gái.',
    assignedSaleId: '5',
    orderValue: 12000000,
    createdAt: '2024-04-11',
    furnitureCategory: 'Tủ quần áo',
  },
  {
    id: 'c3',
    code: 'KH003_Chú Sáu - Bình Chánh',
    name: 'Chú Sáu - Bình Chánh',
    phone: '0987654321',
    address: 'Ấp 3, Xã Vĩnh Lộc A, Bình Chánh',
    stage: 'surveying',
    notes: 'Đã hẹn lịch đo đạc vào sáng thứ 7.',
    assignedSaleId: '5',
    orderValue: 0,
    createdAt: '2024-04-08',
    furnitureCategory: 'Combo Nội thất',
  },
  {
    id: 'c4',
    code: 'KH004_Chị Mai - Thủ Đức',
    name: 'Chị Mai - Thủ Đức',
    phone: '0933445566',
    address: 'Khu dân cư Vạn Phúc, Thủ Đức',
    stage: 'contracted',
    notes: 'Đã ký hợp đồng trọn gói nội thất nhựa.',
    assignedSaleId: '5',
    orderValue: 45000000,
    createdAt: '2024-04-05',
  },
];

export const MOCK_TASKS: Task[] = [
  {
    id: 'task-1',
    title: 'Thiết kế 3D tủ bếp chung cư Vinhomes',
    description: 'Sử dụng nhựa Ecoplast vân gỗ, tối ưu không gian bếp chữ L.',
    assigneeId: '1',
    dueDate: '2024-04-20',
    priority: 'high',
    status: 'in-progress',
    createdAt: '2024-04-01',
  },
  {
    id: 'task-2',
    title: 'Cắt tấm nhựa cho đơn hàng tủ quần áo 4 cánh',
    description: 'Đơn hàng chị Lan - Quận 7. Nhựa Đài Loan Chinhuei.',
    assigneeId: '3',
    dueDate: '2024-04-15',
    priority: 'high',
    status: 'todo',
    createdAt: '2024-04-02',
    type: 'production',
    customerId: 'c2',
    materialList: [
      { id: 'm1', name: 'Tấm nhựa Chinhuei ghi bản 40', quantity: 18, unit: 'tấm' },
      { id: 'm2', name: 'Tấm nhựa nội thất 2.0', quantity: 5, unit: 'tấm' },
      { id: 'm3', name: 'Bản lề giảm chấn PH', quantity: 24, unit: 'cái' },
      { id: 'm4', name: 'Thanh treo quần áo nhôm', quantity: 2, unit: 'cây' },
    ]
  },
  {
    id: 'task-3',
    title: 'Kiểm tra chất lượng kệ tivi phòng khách',
    description: 'Kiểm tra các mối dán cạnh và bản lề trước khi bàn giao.',
    assigneeId: '2',
    dueDate: '2024-04-25',
    priority: 'medium',
    status: 'review',
    createdAt: '2024-04-05',
  },
  {
    id: 'task-4',
    title: 'Lắp đặt bàn học sinh tại nhà khách hàng',
    description: 'Hoàn thành lắp đặt 2 bàn học đơn tại Quận 2.',
    assigneeId: '4',
    dueDate: '2024-04-10',
    priority: 'low',
    status: 'done',
    createdAt: '2024-03-28',
  },
  {
    id: 'task-5',
    title: 'Đo đạc thực tế căn hộ anh Hùng',
    description: 'Khảo sát mặt bằng để lên phương án tủ âm tường.',
    assigneeId: '1',
    dueDate: '2024-04-12',
    priority: 'high',
    status: 'in-progress',
    createdAt: '2024-04-08',
  },
];

export const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    title: 'Đơn hàng gấp',
    message: 'Đơn hàng tủ bếp Vinhomes cần hoàn thành thiết kế trong hôm nay.',
    type: 'overdue',
    timestamp: '2 giờ trước',
    read: false,
  },
  {
    id: 'n2',
    title: 'Phản hồi khách hàng',
    message: 'Chị Lan đã duyệt mẫu nhựa vân gỗ sồi.',
    type: 'mention',
    timestamp: '5 giờ trước',
    read: true,
  },
];
