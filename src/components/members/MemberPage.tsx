import * as React from 'react';
import { Member, Task, WORKSHOPS, MemberPermissions, getWorkshopName } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mail, Plus, Search, Trash2, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';

const DEFAULT_PERMISSIONS: MemberPermissions = {
  viewPrice: true,
  viewRevenue: true,
  menuProduction: true,
  menuMeasurement: true,
  menuOrders: true,
  menuQuotations: true,
  menuSale: true,
  menuDesign: true,
  menuMarketing: true,
  menuReports: true,
  menuMedia: true,
  menuMembers: true,
  menuCustomers: true,
  menuAi: true,
};

const ROLES = [
  'Giám đốc',
  'Trợ lý',
  'Kế Toán',
  'Tổng quản lý',
  'Thiết kế',
  'Sale',
  'Tổ trưởng sản xuất',
  'Thợ chính',
  'Thợ Phụ',
  'Tổ trưởng lắp đặt'
];

const PERMISSION_LABELS: { [K in keyof MemberPermissions]: string } = {
  viewPrice: "Xem giá tiền",
  viewRevenue: "Xem doanh thu",
  menuProduction: "Lịch Sản xuất",
  menuMeasurement: "Lịch Đo đạc",
  menuOrders: "Theo dõi đơn hàng",
  menuQuotations: "Báo giá",
  menuSale: "Công việc SALE",
  menuDesign: "Công việc Thiết kế",
  menuMarketing: "Công việc MKT",
  menuReports: "Báo cáo",
  menuMedia: "Thư viện ảnh",
  menuMembers: "Nhân viên",
  menuCustomers: "Khách hàng",
  menuAi: "Thiết kế AI",
};
import { useAuth } from '@/src/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { db, collection, addDoc, updateDoc, setDoc, deleteDoc, doc, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { compressImage } from '@/src/lib/imageUtils';
import { moveToTrash } from '@/src/services/trashService';

interface MemberPageProps {
  members: Member[];
  setMembers: React.Dispatch<React.SetStateAction<Member[]>>;
  tasks: Task[];
  user?: any;
  currentUser?: Member | null;
}

export function MemberPage({ members, setMembers, tasks, user, currentUser }: MemberPageProps) {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const canManage = isAdmin || 
                    currentUser?.role === 'Giám đốc' || 
                    currentUser?.role === 'Tổng quản lý' || 
                    currentUser?.role === 'Trợ lý';
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [newMember, setNewMember] = React.useState({
    name: '',
    email: '',
    role: 'Sale',
    avatar: '',
    workshop: 'all',
    permissions: { ...DEFAULT_PERMISSIONS }
  });
  const [editingMember, setEditingMember] = React.useState<Member | null>(null);
  const [showPermissions, setShowPermissions] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const editFileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean = false) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Ảnh quá lớn. Vui lòng chọn ảnh dưới 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const compressed = await compressImage(reader.result as string, 400, 400, 0.6);
          if (isEdit && editingMember) {
            setEditingMember({ ...editingMember, avatar: compressed });
          } else {
            setNewMember({ ...newMember, avatar: compressed });
          }
        } catch (err) {
          console.error("Compression failed:", err);
          toast.error("Lỗi khi xử lý ảnh");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const [isUpdating, setIsUpdating] = React.useState(false);

  const handleUpdateMember = async () => {
    if (!editingMember || isUpdating) return;
    if (!canManage) {
      toast.error("Bạn không có quyền thực hiện thao tác này.");
      return;
    }
    setIsUpdating(true);
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Thao tác quá thời gian (15s).")), 15000)
    );

    try {
      if (user) {
        if (editingMember.avatar && editingMember.avatar.length > 800000) {
          toast.error("Ảnh đại diện quá lớn.");
          setIsUpdating(false);
          return;
        }

        const updatePromise = setDoc(doc(db, 'members', editingMember.id), {
          name: editingMember.name,
          email: editingMember.email?.trim(),
          role: editingMember.role,
          avatar: editingMember.avatar,
          workshop: editingMember.workshop || 'all',
          permissions: editingMember.permissions || DEFAULT_PERMISSIONS
        }, { merge: true });

        await Promise.race([updatePromise, timeoutPromise]);
        queryClient.invalidateQueries({ queryKey: ['members'] });
      } else {
        setMembers(members.map(m => m.id === editingMember.id ? editingMember : m));
      }
      setEditingMember(null);
      toast.success("Cập nhật thành công");
    } catch (error: any) {
      toast.error(error.message || "Lỗi cập nhật");
      if (user) handleFirestoreError(error, OperationType.UPDATE, `members/${editingMember.id}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const [isAdding, setIsAdding] = React.useState(false);

  const handleAddMember = async () => {
    if (!newMember.name || !newMember.email || isAdding) {
      toast.error("Vui lòng nhập tên và email");
      return;
    }
    if (!canManage) {
      toast.error("Bạn không có quyền thực hiện thao tác này.");
      return;
    }
    setIsAdding(true);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Quá thời gian.")), 15000));
    const memberData = {
      ...newMember,
      email: newMember.email.trim(),
      avatar: newMember.avatar || `https://i.pravatar.cc/150?u=${newMember.email.trim()}`,
    };
    try {
      if (user) {
        await Promise.race([addDoc(collection(db, 'members'), memberData), timeoutPromise]);
        queryClient.invalidateQueries({ queryKey: ['members'] });
      } else {
        const member: Member = { id: `m-${Date.now()}`, ...memberData };
        setMembers([...members, member]);
      }
      setIsAddDialogOpen(false);
      setNewMember({ name: '', email: '', role: 'Sale', avatar: '', workshop: 'all', permissions: { ...DEFAULT_PERMISSIONS } });
      toast.success("Đã thêm thành viên");
    } catch (error: any) {
      toast.error(error.message);
      if (user) handleFirestoreError(error, OperationType.CREATE, 'members');
    } finally {
      setIsAdding(false);
    }
  };

  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null);

  const handleDeleteMember = async (id: string) => {
    if (!canManage) {
      toast.error("Bạn không có quyền thực hiện thao tác này.");
      return;
    }
    try {
      if (user) {
        const memberToDelete = members.find(m => m.id === id);
        const title = memberToDelete ? `Nhân sự: ${memberToDelete.name}` : id;
        await moveToTrash('members', id, title, user.email || '');
        queryClient.invalidateQueries({ queryKey: ['members'] });
      } else {
        setMembers(members.filter(m => m.id !== id));
      }
      toast.success("Đã xóa");
      setDeleteConfirmId(null);
    } catch (error: any) {
      toast.error("Lỗi khi xóa");
      handleFirestoreError(error, OperationType.DELETE, `members/${id}`);
    }
  };

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Thành viên</h1>
          <p className="text-[10px] md:text-xs text-muted-foreground font-medium">Quản lý nhóm và theo dõi khối lượng công việc.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-56 shrink-0">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input 
              placeholder="Tìm kiếm..." 
              className="pl-8 h-8 text-xs bg-card text-card-foreground border border-border shadow-sm rounded-lg" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {canManage && (
            <Dialog open={isAddDialogOpen} onOpenChange={(open) => !isAdding && setIsAddDialogOpen(open)}>
              <DialogTrigger 
                render={
                  <Button className="h-8 gap-1.5 px-3 rounded-lg text-xs">
                    <Plus className="h-3.5 w-3.5" />
                    Thêm
                  </Button>
                }
              />
              <DialogContent className="sm:max-w-[400px] p-4">
                <DialogHeader className="pb-2">
                  <DialogTitle className="text-lg">Thêm thành viên mới</DialogTitle>
                  <DialogDescription className="text-[10px]">Nhập thông tin nhân viên.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 py-2">
                  <div className="flex flex-col items-center gap-2 pb-2">
                    <div className="relative group">
                      <Avatar className="h-20 w-20 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <AvatarImage src={newMember.avatar || (newMember.email ? `https://i.pravatar.cc/150?u=${newMember.email}` : '')} />
                        <AvatarFallback className="text-xl">{newMember.name?.charAt(0) || '?'}</AvatarFallback>
                      </Avatar>
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageChange} />
                    </div>
                    <p className="text-[9px] text-muted-foreground">Click để tải ảnh</p>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Họ và tên</Label>
                    <Input value={newMember.name} className="h-9 text-xs" onChange={(e) => setNewMember({ ...newMember, name: e.target.value })} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Email</Label>
                    <Input value={newMember.email} className="h-9 text-xs" onChange={(e) => setNewMember({ ...newMember, email: e.target.value })} />
                  </div>
                  <div className="grid gap-2 grid-cols-2">
                    <div className="grid gap-1.5">
                      <Select value={newMember.role || 'Sale'} onValueChange={(v) => setNewMember({ ...newMember, role: v })}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLES.map(role => (
                            <SelectItem key={role} value={role} className="text-xs">{role}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Cơ sở</Label>
                      <Select 
                        value={((newMember.workshop === 'CoSo1' || newMember.workshop === 'XuongGo') ? 'Cơ Sở 1' : 
                               (newMember.workshop === 'CoSo2' || newMember.workshop === 'XuongNhua') ? 'Cơ Sở 2' : 
                               newMember.workshop) || 'all'} 
                        onValueChange={(v) => setNewMember({ ...newMember, workshop: v })}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder="Chọn cơ sở" />
                        </SelectTrigger>
                        <SelectContent>
                          {WORKSHOPS.map(w => <SelectItem key={w.id} value={w.id} className="text-xs">{w.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="border rounded-lg p-2 mt-1">
                    <button 
                      type="button"
                      onClick={() => setShowPermissions(!showPermissions)}
                      className="flex items-center justify-between w-full text-xs font-bold px-1"
                    >
                      <div className="flex items-center gap-1.5 text-primary">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Phân quyền truy cập
                      </div>
                      {showPermissions ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                    
                    <AnimatePresence>
                      {showPermissions && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-3 px-1 pb-1">
                            {(Object.keys(DEFAULT_PERMISSIONS) as Array<keyof MemberPermissions>).map((key) => (
                              <div key={key} className="flex items-center gap-2">
                                <input 
                                  type="checkbox" 
                                  id={`new-${key}`}
                                  checked={newMember.permissions[key]} 
                                  onChange={(e) => setNewMember({
                                    ...newMember, 
                                    permissions: { ...newMember.permissions, [key]: e.target.checked }
                                  })}
                                  className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <Label htmlFor={`new-${key}`} className="text-[10px] cursor-pointer leading-none">
                                  {PERMISSION_LABELS[key]}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                <DialogFooter className="pt-2">
                  <Button variant="outline" className="h-8 text-xs" onClick={() => setIsAddDialogOpen(false)} disabled={isAdding}>Hủy</Button>
                  <Button onClick={handleAddMember} className="h-8 text-xs" disabled={isAdding}>{isAdding ? "Đang lưu..." : "Lưu"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:gap-4 lg:gap-5 grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {filteredMembers.map((member, i) => {
          const memberTasks = tasks.filter(t => t.assigneeId === member.id);
          const completedTasks = memberTasks.filter(t => t.status === 'done').length;
          return (
            <motion.div key={member.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="overflow-hidden border border-border shadow-sm bg-card text-card-foreground hover:border-primary/40 transition-all group flex flex-col h-full shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                <CardHeader className="p-3 pb-2 space-y-0 relative">
                  <div className="flex justify-between items-start">
                    <Avatar className="h-10 w-10 md:h-12 md:w-12 border shadow-sm">
                      <AvatarImage src={member.avatar} />
                      <AvatarFallback className="text-[10px]">{member.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    {canManage && (
                      deleteConfirmId === member.id ? (
                        <div className="flex gap-1 items-center bg-red-50 p-0.5 rounded scale-90 border border-red-200">
                          <Button variant="destructive" size="sm" className="h-5 text-[8px] px-1" onClick={() => handleDeleteMember(member.id)}>Xóa</Button>
                          <Button variant="outline" size="sm" className="h-5 text-[8px] px-1" onClick={() => setDeleteConfirmId(null)}>Hủy</Button>
                        </div>
                      ) : (
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/40" onClick={() => setDeleteConfirmId(member.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )
                    )}
                  </div>
                  <div className="pt-1.5 flex flex-col gap-0.5">
                    <CardTitle className="text-xs md:text-sm font-bold truncate leading-tight">{member.name}</CardTitle>
                    <CardDescription className="text-[9px] md:text-[10px] leading-tight truncate">{member.role}</CardDescription>
                    {member.workshop && member.workshop !== 'all' && (
                      <Badge variant="secondary" className="w-fit text-[8px] h-4 mt-0.5 px-1 py-0 bg-blue-50 text-primary border border-blue-100">
                        {getWorkshopName(member.workshop)}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="flex items-center gap-1.5 text-[9px] md:text-[10px] text-muted-foreground truncate">
                    <Mail className="h-3 w-3" />
                    <span className="truncate">{member.email}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t">
                    <div>
                      <p className="text-[7px] text-muted-foreground uppercase font-black">Làm</p>
                      <p className="text-xs md:text-sm font-bold text-amber-600">{memberTasks.length - completedTasks}</p>
                    </div>
                    <div>
                      <p className="text-[7px] text-muted-foreground uppercase font-black">Xong</p>
                      <p className="text-xs md:text-sm font-bold text-emerald-600">{completedTasks}</p>
                    </div>
                  </div>
                  {canManage && (
                    <Button variant="outline" className="w-full h-7 text-[9px] font-bold uppercase" onClick={() => setEditingMember(member)}>Cập nhật</Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <Dialog open={!!editingMember} onOpenChange={(open) => !isUpdating && !open && setEditingMember(null)}>
        <DialogContent className="sm:max-w-[400px] p-4">
          <DialogHeader><DialogTitle className="text-lg">Chỉnh sửa thông tin</DialogTitle></DialogHeader>
          {editingMember && (
            <div className="grid gap-3 py-2">
              <div className="flex flex-col items-center gap-2 pb-2">
                <Avatar className="h-20 w-20 cursor-pointer" onClick={() => editFileInputRef.current?.click()}>
                  <AvatarImage src={editingMember.avatar} />
                  <AvatarFallback className="text-xl">{editingMember.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <input type="file" ref={editFileInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageChange(e, true)} />
                <p className="text-[9px] text-muted-foreground">Click để thay đổi ảnh</p>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Họ và tên</Label>
                <Input value={editingMember.name} className="h-9 text-xs" onChange={(e) => setEditingMember({ ...editingMember, name: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Email</Label>
                <Input value={editingMember.email} className="h-9 text-xs" onChange={(e) => setEditingMember({ ...editingMember, email: e.target.value })} />
              </div>
              <div className="grid gap-2 grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className="text-xs">Chức vụ</Label>
                  <Select value={editingMember.role || ''} onValueChange={(v) => setEditingMember({ ...editingMember, role: v })}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map(role => (
                        <SelectItem key={role} value={role} className="text-xs">{role}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Cơ sở</Label>
                  <Select 
                    value={((editingMember.workshop === 'CoSo1' || editingMember.workshop === 'XuongGo') ? 'Cơ Sở 1' : 
                           (editingMember.workshop === 'CoSo2' || editingMember.workshop === 'XuongNhua') ? 'Cơ Sở 2' : 
                           (editingMember.workshop || 'all')) || 'all'} 
                    onValueChange={(v) => setEditingMember({ ...editingMember, workshop: v })}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Chọn cơ sở" />
                    </SelectTrigger>
                    <SelectContent>
                      {WORKSHOPS.map(w => <SelectItem key={w.id} value={w.id} className="text-xs">{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border rounded-lg p-2 mt-1">
                <button 
                  type="button"
                  onClick={() => setShowPermissions(!showPermissions)}
                  className="flex items-center justify-between w-full text-xs font-bold px-1"
                >
                  <div className="flex items-center gap-1.5 text-primary">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Phân quyền truy cập
                  </div>
                  {showPermissions ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                
                <AnimatePresence>
                  {showPermissions && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-3 px-1 pb-1">
                        {(Object.keys(DEFAULT_PERMISSIONS) as Array<keyof MemberPermissions>).map((key) => (
                          <div key={key} className="flex items-center gap-2">
                            <input 
                              type="checkbox" 
                              id={`edit-${key}`}
                              checked={editingMember.permissions?.[key] ?? DEFAULT_PERMISSIONS[key]} 
                              onChange={(e) => setEditingMember({
                                ...editingMember, 
                                permissions: { 
                                  ...DEFAULT_PERMISSIONS, 
                                  ...editingMember.permissions, 
                                  [key]: e.target.checked 
                                }
                              })}
                              className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <Label htmlFor={`edit-${key}`} className="text-[10px] cursor-pointer leading-none">
                              {PERMISSION_LABELS[key]}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
          <DialogFooter className="pt-2">
            <Button variant="outline" className="h-8 text-xs" onClick={() => setEditingMember(null)} disabled={isUpdating}>Hủy</Button>
            <Button onClick={handleUpdateMember} className="h-8 text-xs" disabled={isUpdating}>{isUpdating ? "Đang lưu..." : "Cập nhật"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
