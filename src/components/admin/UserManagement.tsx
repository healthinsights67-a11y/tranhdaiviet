import * as React from 'react';
import { db, collection, getDocs, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot } from '@/src/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { UserCheck, UserX, Clock, Search, ShieldCheck, KeyRound, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { authService } from '@/src/services/authService';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function UserManagement() {
  const [users, setUsers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState('');
  const [userToDelete, setUserToDelete] = React.useState<any | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [sendingResetEmail, setSendingResetEmail] = React.useState<string | null>(null);

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

  const handleSendResetPassword = async (email: string) => {
    if (!email) return;
    setSendingResetEmail(email);
    try {
      await authService.sendPasswordReset(email);
      toast.success(`Đã gửi email đặt lại mật khẩu tới "${email}".`);
    } catch (error: any) {
      toast.error(error.message || 'Lỗi khi gửi email đổi mật khẩu');
    } finally {
      setSendingResetEmail(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'users', userToDelete.id));
      toast.success(`Đã xóa tài khoản "${userToDelete.email}"`);
      setUserToDelete(null);
    } catch (error) {
      toast.error('Lỗi khi xóa tài khoản');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(filter.toLowerCase()) || 
    u.displayName?.toLowerCase().includes(filter.toLowerCase())
  );

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Đang tải danh sách người dùng...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Quản lý người dùng</h2>
          <p className="text-muted-foreground text-sm">Phê duyệt, quản lý quyền và mật khẩu tài khoản truy cập hệ thống.</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Tìm theo email hoặc tên..." 
            className="pl-9 h-9 text-xs"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-3">
        {filteredUsers.map((u) => (
          <Card key={u.id} className="overflow-hidden border-slate-200 dark:border-slate-800">
            <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold shrink-0">
                  {u.displayName?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{u.displayName || 'Chưa đặt tên'}</span>
                    <Badge variant={u.status === 'approved' ? 'outline' : u.status === 'rejected' ? 'destructive' : 'secondary'} className={u.status === 'approved' ? "text-[10px] bg-green-50 text-green-700 border-green-200" : "text-[10px]"}>
                      {u.status === 'approved' ? 'Đã duyệt' : u.status === 'rejected' ? 'Từ chối / Khóa' : 'Chờ duyệt'}
                    </Badge>
                    {u.role === 'admin' && (
                      <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-600 border-blue-200">
                        Admin
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{u.email}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Ngày đăng ký: {u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : 'Không rõ'}</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {u.email && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={sendingResetEmail === u.email}
                    onClick={() => handleSendResetPassword(u.email)}
                    className="h-8 text-xs gap-1 border-blue-200 text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
                    title="Gửi email đặt lại mật khẩu"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    {sendingResetEmail === u.email ? "Đang gửi..." : "Gửi đổi MK"}
                  </Button>
                )}

                {u.status !== 'approved' && (
                  <Button 
                    size="sm" 
                    variant="default"
                    onClick={() => handleStatusUpdate(u.id, 'approved')}
                    className="h-8 text-xs bg-green-600 hover:bg-green-700"
                  >
                    <UserCheck className="w-3.5 h-3.5 mr-1" /> Duyệt
                  </Button>
                )}
                
                {u.status !== 'rejected' && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleStatusUpdate(u.id, 'rejected')}
                    className="h-8 text-xs text-amber-700 border-amber-200 hover:bg-amber-50"
                  >
                    <UserX className="w-3.5 h-3.5 mr-1" /> Khóa
                  </Button>
                )}

                {u.status === 'approved' && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleRoleUpdate(u.id, u.role === 'admin' ? 'user' : 'admin')}
                    className="h-8 text-xs"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 mr-1" /> {u.role === 'admin' ? 'Hạ quyền' : 'Lên Admin'}
                  </Button>
                )}

                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => setUserToDelete(u)}
                  className="h-8 text-xs text-destructive hover:bg-destructive/10"
                  title="Xóa tài khoản"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
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

      {/* Delete User Modal */}
      <Dialog open={!!userToDelete} onOpenChange={(open) => !open && !isDeleting && setUserToDelete(null)}>
        <DialogContent className="sm:max-w-[400px] p-5">
          <DialogHeader>
            <DialogTitle className="text-base text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Xóa tài khoản người dùng
            </DialogTitle>
            <DialogDescription className="text-xs pt-1">
              Bạn có chắc chắn muốn xóa bản ghi tài khoản <strong>{userToDelete?.email}</strong>?
            </DialogDescription>
          </DialogHeader>

          <p className="text-xs text-muted-foreground">
            Hành động này sẽ xóa dữ liệu người dùng khỏi danh sách phê duyệt của hệ thống.
          </p>

          <DialogFooter className="pt-2">
            <Button variant="outline" className="h-8 text-xs" onClick={() => setUserToDelete(null)} disabled={isDeleting}>Hủy</Button>
            <Button variant="destructive" className="h-8 text-xs" onClick={handleDeleteUser} disabled={isDeleting}>
              {isDeleting ? "Đang xóa..." : "Xác nhận xóa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
