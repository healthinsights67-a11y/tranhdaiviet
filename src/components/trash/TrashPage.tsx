import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/query';
import { 
  Trash2, 
  RotateCcw, 
  Search, 
  Filter, 
  Info,
  Calendar,
  User,
  AlertTriangle,
  FolderOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { toast } from 'react-hot-toast';
import { fetchTrash } from '@/src/services/dataService';
import { restoreFromTrash, deletePermanently } from '@/src/services/trashService';
import { TrashItem, Member } from '@/src/types';
import { db, collection, getDocs, deleteDoc } from '@/src/lib/firebase';
import { cn } from '@/src/lib/utils';

interface TrashPageProps {
  currentUser: Member | null;
}

const COLLECTION_MAP: Record<string, { label: string; color: string }> = {
  customers: { label: 'Khách hàng', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  quotations: { label: 'Báo giá', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  orders: { label: 'Đơn hàng', color: 'bg-green-500/10 text-green-500 border-green-500/20' },
  tasks: { label: 'Công việc', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  members: { label: 'Nhân sự', color: 'bg-pink-500/10 text-pink-500 border-pink-500/20' },
  product_library: { label: 'Thư viện sản phẩm', color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' },
  media_folders: { label: 'Thư mục ảnh', color: 'bg-teal-500/10 text-teal-500 border-teal-500/20' },
  media_library: { label: 'Ảnh thư viện', color: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' },
};

export default function TrashPage({ currentUser }: TrashPageProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedFilter, setSelectedFilter] = React.useState('all');

  const { data: trashItems = [], isLoading, refetch } = useQuery<TrashItem[]>({
    queryKey: ['trash'],
    queryFn: fetchTrash,
    refetchOnWindowFocus: false,
  });

  // Kiểm tra quyền quản lý hoặc admin
  const isManager = React.useMemo(() => {
    if (!currentUser) return false;
    const roleLower = currentUser.role?.toLowerCase() || '';
    return roleLower.includes('quản lý') || 
           roleLower.includes('giám đốc') || 
           roleLower === 'admin' || 
           roleLower === 'chủ sở hữu';
  }, [currentUser]);

  const handleRestore = async (item: TrashItem) => {
    try {
      await restoreFromTrash(item);
      toast.success(`Đã khôi phục thành công: ${item.title}`);
      queryClient.invalidateQueries({ queryKey: ['trash'] });
      // Invalidate the restored collection to refresh UI
      queryClient.invalidateQueries({ queryKey: [item.collection] });
      if (item.collection === 'tasks') {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      }
    } catch (error) {
      toast.error('Lỗi khi khôi phục tài liệu');
    }
  };

  const handleDeletePermanently = async (item: TrashItem) => {
    if (!isManager) {
      toast.error('Chỉ Quản lý hoặc Giám đốc mới được quyền xóa vĩnh viễn!');
      return;
    }

    if (!confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn "${item.title}"? Thao tác này không thể khôi phục!`)) {
      return;
    }

    try {
      await deletePermanently(item.id);
      toast.success(`Đã xóa vĩnh viễn: ${item.title}`);
      queryClient.invalidateQueries({ queryKey: ['trash'] });
    } catch (error) {
      toast.error('Lỗi khi xóa tài liệu');
    }
  };

  const handleEmptyTrash = async () => {
    if (!isManager) {
      toast.error('Chỉ Quản lý hoặc Giám đốc mới có quyền dọn sạch thùng rác!');
      return;
    }

    if (trashItems.length === 0) {
      toast.error('Thùng rác hiện đang trống!');
      return;
    }

    if (!confirm(`CẢNH BÁO: Bạn đang thực hiện dọn sạch thùng rác (${trashItems.length} mục). Tất cả sẽ bị XÓA VĨNH VIỄN và KHÔNG thể khôi phục! Bạn vẫn muốn tiếp tục?`)) {
      return;
    }

    try {
      const snapshot = await getDocs(collection(db, 'trash'));
      const promises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(promises);
      toast.success('Đã dọn sạch thùng rác thành công!');
      queryClient.invalidateQueries({ queryKey: ['trash'] });
    } catch (error) {
      toast.error('Lỗi khi dọn sạch thùng rác');
    }
  };

  const filteredTrash = React.useMemo(() => {
    return trashItems.filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (item.deletedBy && item.deletedBy.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesFilter = selectedFilter === 'all' || item.collection === selectedFilter;
      return matchesSearch && matchesFilter;
    }).sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
  }, [trashItems, searchQuery, selectedFilter]);

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Thùng rác gần đây</h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Danh sách các tài liệu đã bị xóa. Chỉ có Quản lý hoặc Giám đốc mới có quyền xóa vĩnh viễn hoặc dọn dẹp.
          </p>
        </div>
        {isManager && trashItems.length > 0 && (
          <Button 
            variant="destructive" 
            onClick={handleEmptyTrash} 
            className="rounded-xl h-10 px-4 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md shadow-red-500/10"
          >
            <Trash2 className="h-4 w-4" />
            <span>Dọn sạch thùng rác</span>
          </Button>
        )}
      </div>

      <Card className="border border-border shadow-sm">
        <CardHeader className="p-4 md:p-6 pb-2">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Tìm theo tên tài liệu hoặc người xóa..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 rounded-xl"
              />
            </div>
            <div className="flex gap-2">
              <Select value={selectedFilter} onValueChange={setSelectedFilter}>
                <SelectTrigger className="w-[160px] h-10 rounded-xl">
                  <SelectValue placeholder="Phân loại" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả phân loại</SelectItem>
                  {Object.entries(COLLECTION_MAP).map(([key, value]) => (
                    <SelectItem key={key} value={key}>{value.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredTrash.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center text-muted-foreground mb-4">
                <FolderOpen className="h-8 w-8" />
              </div>
              <h3 className="font-semibold text-base mb-1">Thùng rác trống</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Không tìm thấy bất kỳ tài liệu nào đã xóa phù hợp với bộ lọc hiện tại.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <th className="p-4 pl-6">Tài liệu đã xóa</th>
                      <th className="p-4">Phân loại</th>
                      <th className="p-4">Người xóa</th>
                      <th className="p-4">Thời gian</th>
                      <th className="p-4 text-right pr-6">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrash.map((item) => {
                      const typeInfo = COLLECTION_MAP[item.collection] || { label: item.collection, color: 'bg-gray-500/10 text-gray-500 border-gray-500/20' };
                      return (
                        <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="p-4 pl-6">
                            <div className="font-bold text-sm text-foreground line-clamp-1">{item.title}</div>
                            <div className="text-[10px] font-mono text-muted-foreground mt-0.5">ID: {item.originalId}</div>
                          </td>
                          <td className="p-4">
                            <Badge variant="outline" className={cn("text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border", typeInfo.color)}>
                              {typeInfo.label}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1.5 text-xs font-medium">
                              <User className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="truncate max-w-[150px]">{item.deletedBy}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground font-mono">
                              <Calendar className="h-3.5 w-3.5" />
                              <span>{new Date(item.deletedAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </td>
                          <td className="p-4 text-right pr-6">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRestore(item)}
                                className="h-8 px-2.5 rounded-lg border-green-500/30 text-green-600 hover:bg-green-500/5 flex items-center gap-1.5"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                <span className="text-xs">Khôi phục</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!isManager}
                                onClick={() => handleDeletePermanently(item)}
                                className={cn(
                                  "h-8 px-2.5 rounded-lg flex items-center gap-1.5 border-red-500/30 text-red-600 hover:bg-red-500/5",
                                  !isManager && "opacity-40 cursor-not-allowed"
                                )}
                                title={!isManager ? "Chỉ Quản lý mới được quyền xóa vĩnh viễn" : "Xóa vĩnh viễn"}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span className="text-xs">Xóa vĩnh viễn</span>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="block md:hidden divide-y divide-border">
                {filteredTrash.map((item) => {
                  const typeInfo = COLLECTION_MAP[item.collection] || { label: item.collection, color: 'bg-gray-500/10 text-gray-500 border-gray-500/20' };
                  return (
                    <div key={item.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <h4 className="text-sm font-bold text-foreground line-clamp-2">{item.title}</h4>
                          <span className="text-[9px] font-mono text-muted-foreground block">ID: {item.originalId}</span>
                        </div>
                        <Badge variant="outline" className={cn("text-[9px] uppercase font-mono px-1.5 py-0.5 rounded-full shrink-0 border", typeInfo.color)}>
                          {typeInfo.label}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 bg-muted/40 p-2.5 rounded-xl text-[10px] text-muted-foreground">
                        <div className="space-y-0.5">
                          <span className="text-[9px] uppercase font-bold text-muted-foreground/70">Người xóa</span>
                          <div className="font-semibold text-foreground truncate">{item.deletedBy}</div>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[9px] uppercase font-bold text-muted-foreground/70">Thời gian</span>
                          <div className="font-semibold text-foreground">
                            {new Date(item.deletedAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRestore(item)}
                          className="flex-1 h-9 rounded-xl border-green-500/30 text-green-600 hover:bg-green-500/5 flex items-center justify-center gap-1.5"
                        >
                          <RotateCcw className="h-4 w-4" />
                          <span>Khôi phục</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!isManager}
                          onClick={() => handleDeletePermanently(item)}
                          className={cn(
                            "flex-1 h-9 rounded-xl flex items-center justify-center gap-1.5 border-red-500/30 text-red-600 hover:bg-red-500/5",
                            !isManager && "opacity-40 cursor-not-allowed"
                          )}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>Xóa vĩnh viễn</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
