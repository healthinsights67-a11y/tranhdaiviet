import * as React from 'react';
import { db, collection, getDocs, updateDoc, doc, query, orderBy, onSnapshot } from '@/src/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { UserCheck, UserX, Clock, Search, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';

export function UserManagement() {
  const [users, setUsers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState('');

  React.useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(userData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleStatusUpdate = async (userId: string, status: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'users', userId), { status });
      toast.success(status === 'approved' ? 'Đã duyệt tài khoản' : 'Đã từ chối tài khoản');
    } catch (error) {
      toast.error('Lỗi khi cập nhật trạng thái');
    }
  };

  const handleRoleUpdate = async (userId: string, role: 'admin' | 'user') => {
    try {
      await updateDoc(doc(db, 'users', userId), { role });
      toast.success(`Đã cập nhật quyền thành ${role}`);
    } catch (error) {
      toast.error('Lỗi khi cập nhật quyền');
    }
  };

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(filter.toLowerCase()) || 
    u.displayName?.toLowerCase().includes(filter.toLowerCase())
  );

  if (loading) {
    return <div className="p-8 text-center">Đang tải danh sách người dùng...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Quản lý người dùng</h2>
          <p className="text-muted-foreground text-sm">Phê duyệt và quản lý quyền truy cập hệ thống.</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Tìm theo email hoặc tên..." 
            className="pl-9"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4">
        {filteredUsers.map((u) => (
          <Card key={u.id} className="overflow-hidden border-slate-200">
            <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">
                  {u.displayName?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{u.displayName || 'Người dùng mới'}</span>
                    <Badge variant={u.status === 'approved' ? 'outline' : u.status === 'rejected' ? 'destructive' : 'secondary'} className={u.status === 'approved' ? "text-[10px] bg-green-50 text-green-700 border-green-200" : "text-[10px]"}>
                      {u.status === 'approved' ? 'Đã duyệt' : u.status === 'rejected' ? 'Từ chối' : 'Chờ duyệt'}
                    </Badge>
                    {u.role === 'admin' && (
                      <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-600 border-blue-200">
                        Admin
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Ngày đăng ký: {new Date(u.createdAt).toLocaleDateString('vi-VN')}</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {u.status !== 'approved' && (
                  <Button 
                    size="sm" 
                    variant="default"
                    onClick={() => handleStatusUpdate(u.id, 'approved')}
                    className="h-8 bg-green-600 hover:bg-green-700"
                  >
                    <UserCheck className="w-3.5 h-3.5 mr-1.5" /> Duyệt
                  </Button>
                )}
                
                {u.status === 'pending' && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleStatusUpdate(u.id, 'rejected')}
                    className="h-8 text-destructive border-destructive/20 hover:bg-destructive/5"
                  >
                    <UserX className="w-3.5 h-3.5 mr-1.5" /> Từ chối
                  </Button>
                )}

                {u.status === 'approved' && (
                   <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleRoleUpdate(u.id, u.role === 'admin' ? 'user' : 'admin')}
                    className="h-8"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 mr-1.5" /> {u.role === 'admin' ? 'Hạ quyền' : 'Lên Admin'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredUsers.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed rounded-xl text-muted-foreground">
            Không tìm thấy người dùng nào.
          </div>
        )}
      </div>
    </div>
  );
}
