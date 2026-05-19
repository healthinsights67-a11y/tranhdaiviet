import * as React from 'react';
import { 
  Plus, 
  Search, 
  FileText, 
  MoreVertical, 
  Download, 
  Mail, 
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  Filter,
  Copy,
  ChevronRight,
  TrendingDown,
  Phone,
  Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQueryClient } from '@tanstack/react-query';
import { Quotation, Customer, Member } from '@/src/types';
import { format } from 'date-fns';
import { QuotationForm } from './QuotationForm';
import { QuotationPreview } from './QuotationPreview';
import { ProductLibrary } from './ProductLibrary';
import { QuotationTemplateConfig } from './QuotationTemplateConfig';
import { db, collection, addDoc, updateDoc, deleteDoc, doc, getDoc, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { saveProductTemplate } from '@/src/services/productService';
import { toast } from 'sonner';
import { cn } from '@/src/lib/utils';

interface QuotationPageProps {
  quotations: Quotation[];
  user: any;
  customers: Customer[];
  members: Member[];
  products?: any[];
}

type FilterStatus = Quotation['status'] | 'all';
type ViewMode = 'list' | 'library';

export function QuotationPage({ quotations, user, customers, members, products = [] }: QuotationPageProps) {
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = React.useState<ViewMode>('list');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<FilterStatus>('all');
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
  const [selectedQuotation, setSelectedQuotation] = React.useState<Quotation | null>(null);

  const filteredQuotations = quotations.filter(q => {
    const matchesSearch = q.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         q.quotationNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreateQuotation = async (data: Omit<Quotation, 'id'>) => {
    try {
      if (user) {
        if (selectedQuotation && isFormOpen && !data.quotationNumber.includes('COPY')) {
          // Update existing
          await updateDoc(doc(db, 'quotations', (selectedQuotation as any).id), {
            ...data,
            updatedAt: new Date().toISOString()
          });

          // Automatically update customer order value
          if (data.customerId) {
            await updateDoc(doc(db, 'customers', data.customerId), {
              orderValue: data.totalAmount
            });
          }

          toast.success("Đã cập nhật báo giá");
        } else {
          // Add new
          await addDoc(collection(db, 'quotations'), {
            ...data,
            createdAt: new Date().toISOString()
          });

          // Automatically update customer order value
          if (data.customerId) {
            await updateDoc(doc(db, 'customers', data.customerId), {
              orderValue: data.totalAmount
            });
          }

          toast.success("Đã lưu báo giá thành công");
        }
        queryClient.invalidateQueries({ queryKey: ['quotations'] });
        queryClient.invalidateQueries({ queryKey: ['customers'] });
      } else {
        toast.warning("Bạn đang ở chế độ xem trước. Báo giá này sẽ không được lưu vào máy chủ. Hãy đăng nhập để lưu dữ liệu lâu dài.", {
          duration: 6000,
        });
      }
      setIsFormOpen(false);
      setSelectedQuotation(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'quotations');
    }
  };

  const handleDuplicate = (quotation: Quotation) => {
    const duplicateData: Quotation = {
      ...quotation,
      id: Math.random().toString(36).substr(2, 9),
      quotationNumber: `${quotation.quotationNumber}-COPY`,
      createdAt: new Date().toISOString(),
      status: 'draft'
    };
    setSelectedQuotation(duplicateData);
    setIsFormOpen(true);
  };

  const handleDeleteQuotation = async (id: string) => {
    if (!confirm("Xác nhận xóa báo giá này khỏi hệ thống?")) return;
    try {
      await deleteDoc(doc(db, 'quotations', id));
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      toast.success("Đã xóa báo giá");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `quotations/${id}`);
    }
  };

  const handleUpdateStatus = async (id: string, status: Quotation['status']) => {
    try {
      const quotationRef = doc(db, 'quotations', id);
      await updateDoc(quotationRef, {
        status,
        updatedAt: new Date().toISOString()
      });

      // Automatically update customer stage to 'contracted' if quotation is accepted
      if (status === 'accepted') {
        const snap = await getDoc(quotationRef);
        if (snap.exists()) {
          const qData = snap.data() as Quotation;
          if (qData.customerId) {
            await updateDoc(doc(db, 'customers', qData.customerId), {
              stage: 'contracted'
            });
            toast.info('Đã cập nhật trạng thái khách hàng sang: Đã ký hợp đồng (Đã chốt)');
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      toast.success(`Đã chuyển trạng thái sang: ${status === 'accepted' ? 'Đã chốt' : status === 'sent' ? 'Đã gửi' : 'Từ chối'}`);
      
      // Update selected quotation if it's currently being previewed
      if (selectedQuotation && selectedQuotation.id === id) {
        setSelectedQuotation(prev => prev ? { ...prev, status } : null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `quotations/${id}`);
    }
  };

  const handleSaveProduct = async (product: any) => {
    try {
      await saveProductTemplate(product);
      toast.success(product.id && !product.id.startsWith('temp-') ? "Đã cập nhật sản phẩm" : "Đã thêm sản phẩm mới vào kho");
      queryClient.invalidateQueries({ queryKey: ['product_library'] });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'product_library');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Xác nhận xóa sản phẩm này khỏi kho mẫu?")) return;
    try {
      await deleteDoc(doc(db, 'product_library', id));
      queryClient.invalidateQueries({ queryKey: ['product_library'] });
      toast.success("Đã xóa sản phẩm");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `product_library/${id}`);
    }
  };

  const getStatusBadge = (status: Quotation['status']) => {
    switch (status) {
      case 'draft': return <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200 px-2.5 py-0.5">Bản nháp</Badge>;
      case 'sent': return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 px-2.5 py-0.5">Đã gửi</Badge>;
      case 'accepted': return <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 px-2.5 py-0.5 font-bold">Chấp nhận</Badge>;
      case 'rejected': return <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 px-2.5 py-0.5">Từ chối</Badge>;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4 md:gap-6">
          <div className="hidden sm:flex flex-col items-center justify-center p-2 md:p-3 bg-card text-card-foreground border-2 border-blue-100 rounded-2xl shadow-sm shrink-0">
             <div className="flex items-baseline leading-none">
                <span className="text-xl md:text-2xl font-black tracking-tighter" style={{ color: '#BE1E2D' }}>tủ</span>
                <span className="text-2xl md:text-3xl font-black mx-0.5" style={{ color: '#FBB03B' }}>3</span>
                <span className="text-xl md:text-2xl font-black tracking-tighter" style={{ color: '#BE1E2D' }}>miền</span>
             </div>
             <div className="text-[5px] md:text-[6px] font-black uppercase tracking-[0.2em] text-black whitespace-nowrap">
                tủ cho người Việt
             </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl md:text-4xl font-black tracking-tight flex items-center gap-3">
               Báo Giá
            </h1>
            <p className="text-muted-foreground text-[10px] md:text-sm font-medium">Quản lý hồ sơ báo giá khách hàng.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-2xl border border-gray-200">
          <Button 
            variant={activeView === 'list' ? 'default' : 'ghost'} 
            onClick={() => setActiveView('list')}
            className={cn("h-10 rounded-xl font-bold gap-2 text-xs", activeView === 'list' ? "shadow-sm" : "")}
          >
            <FileText className="h-4 w-4" />
            Báo Giá
          </Button>
          <Button 
            variant={activeView === 'library' ? 'default' : 'ghost'} 
            onClick={() => setActiveView('library')}
            className={cn("h-10 rounded-xl font-bold gap-2 text-xs", activeView === 'library' ? "shadow-sm" : "")}
          >
            <Package className="h-4 w-4" />
            Kho Sản Phẩm
          </Button>
        </div>

        <div className="hidden lg:flex items-center gap-3">
          <QuotationTemplateConfig />
          <Button onClick={() => {
            setSelectedQuotation(null);
            setIsFormOpen(true);
          }} className="h-10 md:h-12 px-6 md:px-8 rounded-xl font-bold gap-2 md:gap-3 shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform active:scale-[0.98] text-xs md:text-sm">
            <Plus className="h-4 w-4 md:h-5 md:w-5" />
            Tạo báo giá mới
          </Button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeView === 'list' ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-6"
          >
            <div className="lg:hidden flex items-center gap-2">
              <QuotationTemplateConfig />
              <Button onClick={() => {
                setSelectedQuotation(null);
                setIsFormOpen(true);
              }} className="flex-1 h-12 rounded-xl font-bold gap-3 shadow-xl shadow-primary/20">
                <Plus className="h-5 w-5" />
                Tạo báo giá mới
              </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
              {[
                { label: 'Tổng báo giá', value: quotations.length, icon: FileText, color: 'bg-primary' },
                { label: 'Đã chốt', value: quotations.filter(q => q.status === 'accepted').length, icon: CheckCircle2, color: 'bg-emerald-500' },
                { label: 'Đang gửi', value: quotations.filter(q => q.status === 'sent').length, icon: Clock, color: 'bg-blue-500' },
                { label: 'Doanh thu', value: `${(quotations.filter(q => q.status === 'accepted').reduce((acc, q) => acc + q.totalAmount, 0) / 1000000).toFixed(1)}M`, icon: TrendingDown, color: 'bg-amber-500' },
              ].map((stat, i) => (
                <Card key={stat.label} className="border border-border bg-card text-card-foreground shadow-sm relative overflow-hidden group">
                   <div className={cn("absolute top-0 right-0 p-1.5 md:p-2 opacity-10 transition-opacity", stat.color)}>
                      <stat.icon className="h-8 w-8 md:h-12 md:w-12" />
                   </div>
                   <CardContent className="p-2 md:p-4 flex items-center gap-2 md:gap-3">
                      <div className={cn("h-7 w-7 md:h-10 md:w-10 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm", stat.color)}>
                         <stat.icon className="h-3.5 w-3.5 md:h-5 md:w-5" />
                      </div>
                      <div className="min-w-0">
                         <p className="text-[8px] md:text-[9px] uppercase font-black tracking-widest text-muted-foreground truncate">{stat.label}</p>
                         <h3 className="text-sm md:text-xl font-black">{stat.value}</h3>
                      </div>
                   </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border border-border shadow-sm bg-card text-card-foreground rounded-2xl md:rounded-3xl overflow-hidden">
              <CardHeader className="px-4 md:px-8 py-4 md:py-6 border-b border-border bg-gray-50 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <CardTitle className="text-lg md:text-xl font-bold flex items-center gap-2">
                      Hồ sơ lưu trữ
                      <Badge variant="secondary" className="rounded-full h-5 text-[10px] px-2 bg-blue-50 text-primary border border-blue-100 shrink-0">
                         {filteredQuotations.length} {filteredQuotations.length > 1 ? 'kết quả' : 'hồ sơ'}
                      </Badge>
                  </CardTitle>

                  <div className="flex flex-col md:flex-row items-center gap-3 w-full lg:w-auto">
                    <div className="relative group w-full lg:w-80">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input 
                        placeholder="Tìm khách, số báo giá..." 
                        className="pl-10 w-full bg-card text-card-foreground border-border h-10 md:h-11 rounded-xl focus:ring-primary focus:border-primary transition-all shadow-sm text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as FilterStatus)}>
                        <SelectTrigger className="h-10 md:h-11 flex-1 md:w-[140px] rounded-xl bg-card text-card-foreground border-border gap-2 text-xs">
                           <Filter className="h-4 w-4 text-muted-foreground" />
                           <SelectValue placeholder="Trạng thái" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-white/10">
                          <SelectItem value="all">Tất cả</SelectItem>
                          <SelectItem value="draft">Bản nháp</SelectItem>
                          <SelectItem value="sent">Đã gửi</SelectItem>
                          <SelectItem value="accepted">Đã chốt</SelectItem>
                          <SelectItem value="rejected">Từ chối</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                
                {/* Fast Filters - Scrollable on mobile */}
                <div className="overflow-x-auto pb-1 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none">
                  <div className="flex items-center gap-1.5 p-1 bg-secondary/20 rounded-xl w-max">
                     {(['all', 'draft', 'sent', 'accepted', 'rejected'] as FilterStatus[]).map((status) => (
                        <button
                         key={status}
                         type="button"
                         onClick={() => setStatusFilter(status)}
                         className={cn(
                            "px-3 md:px-5 py-1.5 md:py-2 text-[10px] md:text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap",
                            statusFilter === status 
                             ? "bg-card text-card-foreground text-primary shadow-sm" 
                             : "text-muted-foreground hover:text-foreground hover:bg-card text-card-foreground"
                         )}
                        >
                         {status === 'all' ? 'Tất cả hồ sơ' : 
                          status === 'draft' ? 'Bản nháp' :
                          status === 'sent' ? 'Đã gửi khách' :
                          status === 'accepted' ? 'Đã chốt' : 'Từ chối'}
                        </button>
                     ))}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredQuotations.map((quotation) => (
                    <Card key={quotation.id} className="rounded-2xl border-none shadow-sm hover:shadow-md transition-all">
                      <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between space-y-0">
                         <span className="font-mono font-black text-primary bg-primary/5 px-2 py-0.5 rounded-md text-[10px]">{quotation.quotationNumber}</span>
                         {getStatusBadge(quotation.status)}
                      </CardHeader>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between gap-4">
                           <div className="min-w-0 flex-1">
                             <h4 className="font-bold text-base truncate">{quotation.customerName}</h4>
                             <div className="flex items-center gap-3 text-muted-foreground mt-1 text-[10px]">
                               <span className="flex items-center gap-1 font-medium shrink-0">
                                  <Phone className="h-3 w-3" /> {quotation.phone}
                               </span>
                               <span className="font-medium truncate">
                                  {format(new Date(quotation.createdAt), 'dd/MM/yy')}
                               </span>
                             </div>
                           </div>
                           
                           <div className="text-right">
                             <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Tổng cộng</p>
                             <p className="font-black text-lg tabular-nums text-foreground">
                               {(quotation.totalAmount / 1000000).toFixed(1)}M
                             </p>
                           </div>
                        </div>
                      </CardContent>
                      <div className="p-4 pt-0 flex items-center justify-between border-t border-white/5 pt-3">
                         <Button variant="ghost" size="sm" className="h-8 px-2 text-[10px] font-bold text-muted-foreground" onClick={(e) => {
                           e.stopPropagation();
                           handleDuplicate(quotation);
                         }}>
                           <Copy className="h-3.5 w-3.5 mr-1.5" />
                           Sao chép
                         </Button>
                         <div className='flex items-center gap-2'>
                              <Button 
                                variant="secondary" 
                                size="sm" 
                                className="h-8 px-3 gap-1.5 font-bold text-[10px] rounded-lg"
                                onClick={() => {
                                  setSelectedQuotation(quotation);
                                  setIsPreviewOpen(true);
                                }}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Xem
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger className="h-8 w-8 rounded-lg hover:bg-secondary/50 flex items-center justify-center">
                                    <MoreVertical className="h-4 w-4" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56 p-2 rounded-xl shadow-2xl border-white/10">
                                  <DropdownMenuItem className="py-2.5 rounded-lg gap-3" onClick={() => handleUpdateStatus(quotation.id, 'accepted')}>
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                    Chốt báo giá (Thành công)
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-card text-card-foreground/5 my-1" />
                                  <DropdownMenuItem className="py-2.5 rounded-lg gap-3" onClick={() => {
                                    setSelectedQuotation(quotation);
                                    setIsFormOpen(true);
                                  }}>
                                    <FileText className="h-4 w-4 text-blue-500" />
                                    Sửa chi tiết
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="py-2.5 rounded-lg gap-3 font-bold text-destructive" onClick={() => handleDeleteQuotation(quotation.id)}>
                                    <Trash2 className="h-4 w-4" />
                                    Xóa hồ sơ
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                         </div>
                      </div>
                    </Card>
                  ))}
                  {filteredQuotations.length === 0 && (
                    <div className="col-span-full h-80 flex flex-col items-center justify-center gap-4 opacity-50 px-8 text-center">
                       <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center">
                          <Search className="h-10 w-10" />
                       </div>
                       <div className="space-y-1">
                         <p className="text-lg font-bold">Không tìm thấy kết quả</p>
                         <p className="text-sm font-medium text-muted-foreground">Thử thay đổi từ khóa hoặc bộ lọc trạng thái</p>
                       </div>
                       <Button variant="outline" size="sm" className="rounded-xl px-6 font-bold" onClick={() => {setSearchTerm(''); setStatusFilter('all')}}>Xóa bộ lọc</Button>
                    </div>
                  )}
              </CardContent>
            </Card>

            {/* Footer Support */}
            <div className="flex items-center justify-center py-6 gap-8 text-center px-4">
               <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-tighter">
                  <Badge variant="outline" className="h-5 rounded-full border-primary/20">TIP</Badge>
                  Sử dụng tính năng "Sao chép" để tạo báo giá cho các căn hộ tương đồng nhanh hơn.
               </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="library"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
          >
            <ProductLibrary 
              products={products} 
              user={user} 
              onSave={handleSaveProduct}
              onDelete={handleDeleteProduct}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isFormOpen && (
          <QuotationForm 
            isOpen={isFormOpen} 
            onClose={() => {
               setIsFormOpen(false);
               setSelectedQuotation(null);
            }} 
            onSubmit={handleCreateQuotation}
            customers={customers}
            initialData={selectedQuotation}
            products={products}
          />
        )}

        {isPreviewOpen && selectedQuotation && (
          <QuotationPreview
            isOpen={isPreviewOpen}
            onClose={() => setIsPreviewOpen(false)}
            quotation={selectedQuotation}
            member={members.find(m => m.id === selectedQuotation.createdBy)}
            user={user}
            onUpdateStatus={(status) => handleUpdateStatus(selectedQuotation.id, status)}
            onEdit={() => {
              setIsPreviewOpen(false);
              setIsFormOpen(true);
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
