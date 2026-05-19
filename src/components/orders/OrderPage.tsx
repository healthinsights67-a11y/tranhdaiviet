import * as React from 'react';
import { Order, OrderStatus, Customer, WORKSHOPS, Task } from '@/src/types';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Search, 
  Filter, 
  Package, 
  CheckCircle2, 
  TrendingUp,
  DollarSign,
  Calendar,
  User,
  Edit2,
  Trash2,
  ChevronLeft, 
  ChevronRight
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { cn } from '@/src/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { db, updateDoc, doc, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { toast } from 'sonner';
import { ORDER_STATUS_CONFIG } from '@/src/lib/badgeMappings';
import { useQueryClient } from '@tanstack/react-query';

interface OrderPageProps {
  orders: Order[];
  customers: Customer[];
  user?: any;
  currentUser?: any;
}

export function OrderPage({ orders, customers, user, currentUser }: OrderPageProps) {
  const queryClient = useQueryClient();
  const [selectedPeriod, setSelectedPeriod] = React.useState('all');
  const [selectedMonth, setSelectedMonth] = React.useState(`${new Date().getMonth() + 1}-${new Date().getFullYear()}`);
  const [currentYear, setCurrentYear] = React.useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = React.useState('');
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null);
  const [selectedWorkshop, setSelectedWorkshop] = React.useState(
    currentUser?.workshop && currentUser?.workshop !== 'all' ? currentUser.workshop : 'all'
  );

  const getFilteredOrders = () => {
    let baseOrders = orders.filter(o => {
      const customer = customers.find(c => c.name === o.customerName);
      
      const orderWorkshop = o.workshop || customer?.workshop;
      const matchesWorkshop = selectedWorkshop === 'all' || orderWorkshop === selectedWorkshop;

      const matchesSearch = (customer !== undefined) && (
        o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (customer?.code && customer.code.toLowerCase().includes(searchTerm.toLowerCase()))
      );

      // Period filtering
      const dateParts = o.orderDate.split('-').map(Number);
      const orderDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
      const now = new Date();
      let matchesPeriod = true;

      if (selectedPeriod === 'today') {
        matchesPeriod = orderDate.toDateString() === now.toDateString();
      } else if (selectedPeriod === 'week') {
        const firstDayOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 1));
        firstDayOfWeek.setHours(0,0,0,0);
        matchesPeriod = orderDate >= firstDayOfWeek;
      } else if (selectedPeriod === 'month') {
        matchesPeriod = orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
      } else if (selectedPeriod === 'quarter') {
        const quarter = Math.floor(now.getMonth() / 3);
        matchesPeriod = Math.floor(orderDate.getMonth() / 3) === quarter && orderDate.getFullYear() === now.getFullYear();
      } else if (selectedPeriod === 'specific_month') {
        const [m, y] = selectedMonth.split('-').map(Number);
        matchesPeriod = orderDate.getMonth() === m - 1 && orderDate.getFullYear() === y;
      }

      return matchesWorkshop && matchesSearch && matchesPeriod;
    });
    return baseOrders;
  };

  const filteredOrders = getFilteredOrders();

  const ordersByCustomer = filteredOrders.reduce((acc, order) => {
    if (!acc[order.customerName]) acc[order.customerName] = [];
    acc[order.customerName].push(order);
    return acc;
  }, {} as Record<string, Order[]>);

  const isTopManager = (user && (user.email === 'nhoanhkoem01@gmail.com' || user.email === 'haanhtran.cv02@gmail.com')) || 
    (currentUser?.role?.toLowerCase().includes('giám đốc')) || 
    (currentUser?.role?.toLowerCase().includes('quản lý tổng')) ||
    (currentUser?.role?.toLowerCase().includes('quản lý')) ||
    (currentUser?.permissions?.viewRevenue === true);

  const canViewPrice = isTopManager || currentUser?.permissions?.viewPrice !== false;
  const canViewRevenue = isTopManager;

  const formatCurrency = (value: number) => {
    if (!canViewPrice && !isTopManager) return '*** ₫';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  };

  const totalRevenue = filteredOrders.reduce((sum, o) => {
    const customer = customers.find(c => c.name === o.customerName);
    return sum + (o.totalValue || customer?.orderValue || 0);
  }, 0);

  const processingOrders = filteredOrders.filter(o => o.status === 'processing').length;
  const shippingOrders = filteredOrders.filter(o => o.status === 'shipping').length;

  return (
    <div className="space-y-6 mt-4 max-w-6xl mx-auto pb-10 px-2 lg:px-4">
      <div className="grid gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
        <div className="flex flex-col lg:flex-row justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Đơn hàng</h1>
            <p className="text-xs text-muted-foreground">Tổng quan và quản lý tiến độ đơn hàng</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select 
              value={((selectedWorkshop === 'CoSo1' || selectedWorkshop === 'XuongGo') ? 'Cơ Sở 1' : 
                    (selectedWorkshop === 'CoSo2' || selectedWorkshop === 'XuongNhua') ? 'Cơ Sở 2' : 
                    selectedWorkshop) || 'all'} 
              onValueChange={setSelectedWorkshop}
              disabled={currentUser?.workshop && currentUser?.workshop !== 'all'}
            >
              <SelectTrigger className="h-9 w-[130px] rounded-lg border-gray-200 bg-card text-card-foreground text-xs font-semibold">
                <SelectValue placeholder="Cơ sở" />
              </SelectTrigger>
              <SelectContent>
                {WORKSHOPS.map(w => (
                  <SelectItem key={w.id} value={w.id} className="text-xs">{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative w-full lg:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input 
                placeholder="Tìm đơn hàng..." 
                className="pl-8 h-9 rounded-lg bg-card text-card-foreground border-gray-200 focus:ring-primary/20 text-xs shadow-none" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
        
        {/* Time Filter */}
        <div className="flex flex-wrap gap-1.5 items-center">
          {['all', 'today', 'week', 'month', 'quarter'].map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200",
                selectedPeriod === period
                  ? "bg-black text-white"
                  : "bg-card text-card-foreground hover:bg-gray-100 text-gray-600 border border-gray-200"
              )}
            >
              {period === 'all' ? 'Tất cả' : 
              period === 'today' ? 'Hôm nay' : 
              period === 'week' ? 'Tuần' : 
              period === 'month' ? 'Tháng' : 'Quý'}
            </button>
          ))}
          <Popover>
            <PopoverTrigger className="h-8 rounded-lg border border-gray-200 bg-card text-card-foreground px-3 text-xs font-semibold shadow-sm hover:border-gray-300 transition-all flex items-center gap-1.5 ml-2">
              <Calendar className="h-3 w-3" />
              Tháng {selectedMonth.split('-')[0]}/{selectedMonth.split('-')[1]}
            </PopoverTrigger>
            {/* PopoverContent remains the same */}
            <PopoverContent className="w-80 p-0 bg-card text-card-foreground border border-gray-200 shadow-xl rounded-2xl z-50">
                <div className="flex items-center justify-between p-4 border-b">
                <Button variant="ghost" size="icon" onClick={() => setCurrentYear(y => y - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="font-bold">{currentYear}</span>
                <Button variant="ghost" size="icon" onClick={() => setCurrentYear(y => y + 1)}><ChevronRight className="h-4 w-4" /></Button>
                </div>
                <div className="grid grid-cols-4 gap-2 p-4">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                    const value = `${m}-${currentYear}`;
                    const isActive = selectedMonth === value;
                    return (
                    <div
                        key={m}
                        onClick={() => {
                            setSelectedMonth(value);
                            setSelectedPeriod('specific_month');
                        }}
                        className={cn(
                        "h-12 rounded-xl flex items-center justify-center text-xs font-semibold transition-all duration-200 cursor-pointer",
                        isActive ? "bg-black text-white" : "hover:bg-gray-100"
                        )}
                    >
                        Th{m}
                    </div>
                    );
                })}
                </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      
      {canViewRevenue && (
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-card text-card-foreground rounded-2xl border-none p-4 shadow-sm hover:shadow-md transition-all flex flex-col gap-2">
            <div className="flex items-center gap-2 text-muted-foreground">
                <Package className="h-4 w-4" />
                <p className="text-xs font-semibold">TỔNG ĐƠN</p>
            </div>
            <h2 className="text-2xl font-bold">{filteredOrders.length}</h2>
          </Card>
          <Card className="bg-card text-card-foreground rounded-2xl border-none p-4 shadow-sm hover:shadow-md transition-all flex flex-col gap-2">
            <div className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="h-4 w-4" />
                <p className="text-xs font-semibold">SẢN XUẤT</p>
            </div>
            <h2 className="text-2xl font-bold">{processingOrders}</h2>
          </Card>
          <Card className="bg-card text-card-foreground rounded-2xl border-none p-4 shadow-sm hover:shadow-md transition-all flex flex-col gap-2">
            <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <p className="text-xs font-semibold">ĐANG GIAO</p>
            </div>
            <h2 className="text-2xl font-bold">{shippingOrders}</h2>
          </Card>
          <Card className="bg-card text-card-foreground rounded-2xl border-none p-4 shadow-sm hover:shadow-md transition-all flex flex-col gap-2">
            <div className="flex items-center gap-2 text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                <p className="text-xs font-semibold">DOANH THU</p>
            </div>
            <h2 className="text-lg font-bold tabular-nums truncate">{formatCurrency(totalRevenue)}</h2>
          </Card>
        </div>
      )}

      <div className="space-y-4">
        {filteredOrders.sort((a,b) => b.orderDate.localeCompare(a.orderDate)).map((order, i) => {
          const customer = customers.find(c => c.name === order.customerName);
          const status = ORDER_STATUS_CONFIG[order.status as OrderStatus];
          
          return (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-xl border border-border bg-card text-card-foreground p-4 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground/60 uppercase">
                      {customer?.code || order.id.slice(0,8)}
                    </span>
                    <Badge variant="outline" className={cn("text-[8px] uppercase font-bold px-1.5 py-0.5 rounded-full border-none", status?.color)}>
                      {status?.label}
                    </Badge>
                  </div>
                  
                  <div className="text-sm text-muted-foreground line-clamp-1">
                    <span>Hạng mục: {customer?.furnitureCategory || '---'}</span>
                    <span> • </span>
                    <span>Địa chỉ: {customer?.address || '---'}</span>
                    <span> • </span>
                    <span>SĐT: {customer?.phone || '---'}</span>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {order.customerName} • {order.orderDate.split('-').slice(1).join('/')}
                  </div>
                </div>
                
                {canViewPrice && (
                  <div className="text-sm font-semibold text-primary tabular-nums shrink-0">
                    {formatCurrency(order.totalValue || customer?.orderValue || 0)}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
