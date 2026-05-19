import { 
  Package, 
  Clock, 
  CheckCircle2, 
  Truck, 
  AlertCircle 
} from 'lucide-react';

export const ORDER_STATUS_CONFIG = {
  pending: { label: 'Chờ xử lý', color: 'bg-yellow-50 text-yellow-600 border-yellow-200', icon: Clock },
  processing: { label: 'Đang sản xuất', color: 'bg-blue-50 text-blue-600 border-blue-200', icon: Package },
  shipping: { label: 'Đang giao hàng', color: 'bg-purple-50 text-purple-600 border-purple-200', icon: Truck },
  completed: { label: 'Hoàn thành', color: 'bg-green-50 text-green-600 border-green-200', icon: CheckCircle2 },
  cancelled: { label: 'Đã hủy', color: 'bg-red-50 text-red-600 border-red-200', icon: AlertCircle },
};

export const TASK_PRIORITY_CONFIG = {
  low: { label: 'Thấp', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  medium: { label: 'Trung bình', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  high: { label: 'Cao', color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' },
};

export const TASK_STATUS_CONFIG = {
  'todo': { label: 'Chờ xử lý', color: 'bg-slate-100 text-slate-700' },
  'in-progress': { label: 'Đang làm', color: 'bg-blue-100 text-blue-700' },
  'review': { label: 'Kiểm tra', color: 'bg-purple-100 text-purple-700' },
  'done': { label: 'Hoàn thành', color: 'bg-emerald-100 text-emerald-700' },
};
