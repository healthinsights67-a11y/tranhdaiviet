import * as React from 'react';
import { Member, Task, WORKSHOPS, MemberPermissions, getWorkshopName, getNormalizedWorkshopId } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mail, Plus, Search, Trash2, ShieldCheck, ChevronDown, ChevronUp, KeyRound, Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
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
import { compressImage } from '@/src/lib/imageUtils';
import { memberService } from '@/src/services/memberService';

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
  menuInstallations: true,
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
  menuInstallations: "Lịch lắp đặt",
  menuAi: "Thiết kế AI",
};

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
  
  // Add Member State
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [newMember, setNewMember] = React.useState({
    name: '',
    email: '',
    role: 'Sale',
    avatar: '',
    workshop: 'all',
    permissions: { ...DEFAULT_PERMISSIONS },
    zaloUserId: '',
    password: ''
  });
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [isAdding, setIsAdding] = React.useState(false);

  // Edit Member State
  const [editingMember, setEditingMember] = React.useState<Member | null>(null);
  const [isUpdating, setIsUpdating] = React.useState(false);

  // Delete Member State
  const [memberToDelete, setMemberToDelete] = React.useState<Member | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Password Management State
  const [passwordMember, setPasswordMember] = React.useState<Member | null>(null);
  const [directPassword, setDirectPassword] = React.useState('');
  const [showDirectPassword, setShowDirectPassword] = React.useState(false);
  const [isSendingReset, setIsSendingReset] = React.useState(false);
  const [isDirectSetting, setIsDirectSetting] = React.useState(false);

  // Permissions collapse
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

  // 1. THÊM NHÂN SỰ
  const handleAddMember = async () => {
    if (!canManage) {
      toast.error("Bạn không có quyền thực hiện thao tác này.");
      return;
    }
    setIsAdding(true);

    try {
      if (user) {
        const { accountCreated } = await memberService.addMember(
          newMember,
          members,
          user.email || ''
        );
        queryClient.invalidateQueries({ queryKey: ['members'] });
        queryClient.invalidateQueries({ queryKey: ['users'] });
        toast.success(
          accountCreated
            ? "Đã thêm nhân sự và khởi tạo tài khoản đăng nhập thành công!"
            : "Đã thêm nhân sự thành công!"
        );
      } else {
        const member: Member = { 
          id: `m-${Date.now()}`, 
          name: newMember.name.trim(),
          email: newMember.email.trim().toLowerCase(),
          role: newMember.role,
          avatar: newMember.avatar || `https://i.pravatar.cc/150?u=${newMember.email.trim()}`,
          workshop: newMember.workshop,
          permissions: newMember.permissions,
          zaloUserId: newMember.zaloUserId
        };
        setMembers([...members, member]);
        toast.success("Đã thêm thành viên (chế độ demo)");
      }

      setIsAddDialogOpen(false);
      setNewMember({
        name: '',
        email: '',
        role: 'Sale',
        avatar: '',
        workshop: 'all',
        permissions: { ...DEFAULT_PERMISSIONS },
        zaloUserId: '',
        password: ''
      });
      setShowNewPassword(false);
    } catch (error: any) {
      toast.error(error.message || "Lỗi khi thêm nhân sự");
    } finally {
      setIsAdding(false);
    }
  };

  // 2. CẬP NHẬT NHÂN SỰ
  const handleUpdateMember = async () => {
    if (!editingMember || isUpdating) return;
    if (!canManage) {
      toast.error("Bạn không có quyền thực hiện thao tác này.");
      return;
    }
    setIsUpdating(true);

    try {
      if (user) {
        if (editingMember.avatar && editingMember.avatar.length > 800000) {
          toast.error("Ảnh đại diện quá lớn.");
          setIsUpdating(false);
          return;
        }

        await memberService.updateMember(editingMember.id, {
          name: editingMember.name,
          email: editingMember.email,
          role: editingMember.role,
          workshop: editingMember.workshop || 'all',
          avatar: editingMember.avatar || '',
          zaloUserId: editingMember.zaloUserId || '',
          permissions: editingMember.permissions || DEFAULT_PERMISSIONS
        });

        queryClient.invalidateQueries({ queryKey: ['members'] });
        queryClient.invalidateQueries({ queryKey: ['users'] });
      } else {
        setMembers(members.map(m => m.id === editingMember.id ? editingMember : m));
      }
      setEditingMember(null);
      toast.success("Cập nhật thông tin nhân sự thành công!");
    } catch (error: any) {
      toast.error(error.message || "Lỗi cập nhật nhân sự");
    } finally {
      setIsUpdating(false);
    }
  };

  // 3. XÓA NHÂN SỰ (Chuyển thùng rác + vô hiệu hóa tài khoản)
  const handleConfirmDelete = async () => {
    if (!memberToDelete || isDeleting) return;
    if (!canManage) {
      toast.error("Bạn không có quyền thực hiện thao tác này.");
      return;
    }
    setIsDeleting(true);

    try {
      if (user) {
        await memberService.deleteMember(memberToDelete, user.email || '');
        queryClient.invalidateQueries({ queryKey: ['members'] });
        queryClient.invalidateQueries({ queryKey: ['users'] });
        toast.success(`Đã xóa nhân sự "${memberToDelete.name}" và vô hiệu hóa tài khoản đăng nhập.`);
      } else {
        setMembers(members.filter(m => m.id !== memberToDelete.id));
        toast.success("Đã xóa nhân sự (chế độ demo)");
      }
      setMemberToDelete(null);
    } catch (error: any) {
      toast.error(error.message || "Lỗi khi xóa nhân sự");
    } finally {
      setIsDeleting(false);
    }
  };

  // 4. ĐỔI / CẤP MẬT KHẨU
  const handleSendPasswordReset = async () => {
    if (!passwordMember?.email || isSendingReset) return;
    setIsSendingReset(true);
    try {
      await memberService.sendPasswordResetLink(passwordMember.email);
      toast.success(`Đã gửi email đặt lại mật khẩu tới "${passwordMember.email}". Vui lòng kiểm tra hộp thư (inbox/spam)!`);
    } catch (error: any) {
      toast.error(error.message || "Không thể gửi email đặt lại mật khẩu.");
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleDirectSetPassword = async () => {
    if (!passwordMember || isDirectSetting) return;
    if (!directPassword || directPassword.trim().length < 6) {
      toast.error("Mật khẩu phải có tối thiểu 6 ký tự.");
      return;
    }
    setIsDirectSetting(true);
    try {
      await memberService.createAccountForMember(passwordMember, directPassword);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(`Đã cấp tài khoản đăng nhập thành công cho "${passwordMember.name}"!`);
      setDirectPassword('');
      setPasswordMember(null);
    } catch (error: any) {
      toast.error(error.message || "Lỗi khi cấp tài khoản");
    } finally {
      setIsDirectSetting(false);
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
          <p className="text-[10px] md:text-xs text-muted-foreground font-medium">Quản lý đội ngũ nhân sự, phân quyền và tài khoản truy cập hệ thống.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-56 shrink-0">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input 
              placeholder="Tìm kiếm theo tên, email..." 
              className="pl-8 h-8 text-xs bg-card text-card-foreground border border-border shadow-sm rounded-lg" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {canManage && (
            <Dialog open={isAddDialogOpen} onOpenChange={(open) => !isAdding && setIsAddDialogOpen(open)}>
              <DialogTrigger 
                render={
                  <Button className="h-8 gap-1.5 px-3 rounded-lg text-xs font-semibold">
                    <Plus className="h-3.5 w-3.5" />
                    Thêm nhân sự
                  </Button>
                }
              />
              <DialogContent className="sm:max-w-[440px] p-5 max-h-[90vh] overflow-y-auto">
                <DialogHeader className="pb-2">
                  <DialogTitle className="text-lg">Thêm nhân sự mới</DialogTitle>
                  <DialogDescription className="text-xs">
                    Nhập thông tin nhân viên và thiết lập tài khoản đăng nhập.
                  </DialogDescription>
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
                    <p className="text-[9px] text-muted-foreground">Click để tải ảnh đại diện</p>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-medium">Họ và tên <span className="text-destructive">*</span></Label>
                    <Input 
                      placeholder="Nguyễn Văn A" 
                      value={newMember.name} 
                      className="h-9 text-xs" 
                      onChange={(e) => setNewMember({ ...newMember, name: e.target.value })} 
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-medium">Email đăng nhập <span className="text-destructive">*</span></Label>
                    <Input 
                      type="email"
                      placeholder="nhanvien@congty.com" 
                      value={newMember.email} 
                      className="h-9 text-xs" 
                      onChange={(e) => setNewMember({ ...newMember, email: e.target.value })} 
                    />
                  </div>

                  {/* Initial Login Password Field */}
                  <div className="grid gap-1.5 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium flex items-center gap-1.5">
                        <Lock className="h-3.5 w-3.5 text-primary" />
                        Mật khẩu khởi tạo đăng nhập
                      </Label>
                      <span className="text-[10px] text-muted-foreground">Tùy chọn</span>
                    </div>
                    <div className="relative">
                      <Input 
                        type={showNewPassword ? "text" : "password"} 
                        value={newMember.password} 
                        placeholder="Nhập ít nhất 6 ký tự để cấp tài khoản ngay" 
                        className="h-8 text-xs pr-8 bg-white dark:bg-slate-800" 
                        onChange={(e) => setNewMember({ ...newMember, password: e.target.value })} 
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showNewPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Nếu nhập mật khẩu, hệ thống sẽ tự động kích hoạt tài khoản Firebase Auth để nhân viên có thể đăng nhập ngay.
                    </p>
                  </div>

                  <div className="grid gap-1.5">
                    <Label className="text-xs">Zalo User ID (Tùy chọn)</Label>
                    <Input placeholder="Dùng để Bot nhận diện hành trình" value={newMember.zaloUserId || ''} className="h-9 text-xs" onChange={(e) => setNewMember({ ...newMember, zaloUserId: e.target.value })} />
                  </div>
                  <div className="grid gap-2 grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label className="text-xs font-medium">Chức vụ</Label>
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
                      <Label className="text-xs font-medium">Cơ sở xưởng</Label>
                      <Select 
                        value={getNormalizedWorkshopId(newMember.workshop)} 
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
                  
                  <div className="border rounded-lg p-2.5 mt-1">
                    <button 
                      type="button"
                      onClick={() => setShowPermissions(!showPermissions)}
                      className="flex items-center justify-between w-full text-xs font-semibold px-1"
                    >
                      <div className="flex items-center gap-1.5 text-primary">
                        <ShieldCheck className="h-4 w-4" />
                        Phân quyền truy cập hệ thống
                      </div>
                      {showPermissions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
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
                  <Button onClick={handleAddMember} className="h-8 text-xs font-semibold" disabled={isAdding}>
                    {isAdding ? "Đang lưu..." : "Lưu nhân sự"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Staff Cards Grid */}
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
                      <AvatarFallback className="text-[10px] font-bold">{member.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    {canManage && (
                      <div className="flex items-center gap-0.5">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" 
                          title="Đổi mật khẩu / Quản lý tài khoản"
                          onClick={() => {
                            setPasswordMember(member);
                            setDirectPassword('');
                          }}
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-destructive/50 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors" 
                          title="Xóa nhân sự"
                          onClick={() => setMemberToDelete(member)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
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
                    <Mail className="h-3 w-3 shrink-0" />
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
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <Button 
                        variant="outline" 
                        className="w-full h-7 text-[9px] font-bold uppercase rounded-md" 
                        onClick={() => setEditingMember(member)}
                      >
                        Sửa
                      </Button>
                      <Button 
                        variant="secondary" 
                        className="w-full h-7 text-[9px] font-bold uppercase gap-1 rounded-md text-primary hover:bg-primary hover:text-white transition-colors" 
                        onClick={() => {
                          setPasswordMember(member);
                          setDirectPassword('');
                        }}
                      >
                        <KeyRound className="h-3 w-3" />
                        Mật khẩu
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* DIALOG CHỈNH SỬA NHÂN SỰ */}
      <Dialog open={!!editingMember} onOpenChange={(open) => !isUpdating && !open && setEditingMember(null)}>
        <DialogContent className="sm:max-w-[440px] p-5 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">Chỉnh sửa thông tin nhân sự</DialogTitle>
          </DialogHeader>
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
                <Label className="text-xs font-medium">Họ và tên</Label>
                <Input value={editingMember.name} className="h-9 text-xs" onChange={(e) => setEditingMember({ ...editingMember, name: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium">Email</Label>
                <Input value={editingMember.email} className="h-9 text-xs" onChange={(e) => setEditingMember({ ...editingMember, email: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Zalo User ID (Tùy chọn)</Label>
                <Input placeholder="Dùng để Bot nhận diện hành trình" value={editingMember.zaloUserId || ''} className="h-9 text-xs" onChange={(e) => setEditingMember({ ...editingMember, zaloUserId: e.target.value })} />
              </div>
              <div className="grid gap-2 grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium">Chức vụ</Label>
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
                  <Label className="text-xs font-medium">Cơ sở xưởng</Label>
                  <Select 
                    value={getNormalizedWorkshopId(editingMember.workshop)} 
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

              <div className="border rounded-lg p-2.5 mt-1">
                <button 
                  type="button"
                  onClick={() => setShowPermissions(!showPermissions)}
                  className="flex items-center justify-between w-full text-xs font-semibold px-1"
                >
                  <div className="flex items-center gap-1.5 text-primary">
                    <ShieldCheck className="h-4 w-4" />
                    Phân quyền truy cập hệ thống
                  </div>
                  {showPermissions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
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
            <Button onClick={handleUpdateMember} className="h-8 text-xs font-semibold" disabled={isUpdating}>{isUpdating ? "Đang lưu..." : "Cập nhật"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG XÁC NHẬN XÓA NHÂN SỰ */}
      <Dialog open={!!memberToDelete} onOpenChange={(open) => !open && !isDeleting && setMemberToDelete(null)}>
        <DialogContent className="sm:max-w-[420px] p-5">
          <DialogHeader>
            <DialogTitle className="text-base text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Xác nhận xóa nhân sự
            </DialogTitle>
            <DialogDescription className="text-xs pt-1">
              Bạn có chắc chắn muốn xóa nhân sự <strong>{memberToDelete?.name}</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="text-xs text-muted-foreground bg-destructive/5 p-3 rounded-lg border border-destructive/10 space-y-1.5">
            <p>• Dữ liệu nhân sự sẽ được chuyển vào <strong>Thùng rác</strong> (có thể khôi phục lại khi cần).</p>
            <p>• Tài khoản đăng nhập (<strong>{memberToDelete?.email}</strong>) sẽ bị <strong>vô hiệu hóa quyền truy cập</strong> hệ thống ngay lập tức.</p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" className="h-8 text-xs" onClick={() => setMemberToDelete(null)} disabled={isDeleting}>Hủy</Button>
            <Button variant="destructive" className="h-8 text-xs font-semibold" onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting ? "Đang xóa..." : "Xác nhận xóa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG ĐỔI MẬT KHẨU / QUẢN LÝ TÀI KHOẢN */}
      <Dialog open={!!passwordMember} onOpenChange={(open) => !open && setPasswordMember(null)}>
        <DialogContent className="sm:max-w-[430px] p-5">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              Quản lý mật khẩu & Tài khoản
            </DialogTitle>
            <DialogDescription className="text-xs">
              Thiết lập đăng nhập cho <strong>{passwordMember?.name}</strong> ({passwordMember?.email})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            {/* Cách 1: Gửi email reset password */}
            <div className="p-3.5 border rounded-xl bg-slate-50 dark:bg-slate-900/50 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <Mail className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Gửi liên kết đặt lại mật khẩu qua Email</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Firebase sẽ gửi thư tới <strong>{passwordMember?.email}</strong> để nhân viên tự đặt mật khẩu mới an toàn.
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={isSendingReset}
                className="w-full text-xs h-8 border-blue-200 text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950 font-medium"
                onClick={handleSendPasswordReset}
              >
                {isSendingReset ? "Đang gửi email..." : "Gửi email đặt lại mật khẩu"}
              </Button>
            </div>

            {/* Cách 2: Quản trị viên cấp tài khoản / Đặt mật khẩu khởi tạo trực tiếp */}
            <div className="p-3.5 border rounded-xl bg-slate-50 dark:bg-slate-900/50 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <Lock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Cấp tài khoản mới / Đặt lại mật khẩu</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Khởi tạo tài khoản Firebase Auth và duyệt ngay quyền truy cập cho nhân sự này.
                  </p>
                </div>
              </div>
              <div className="space-y-2 pt-1">
                <div className="relative">
                  <Input 
                    type={showDirectPassword ? "text" : "password"}
                    placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                    value={directPassword}
                    onChange={(e) => setDirectPassword(e.target.value)}
                    className="h-8 text-xs pr-8 bg-white dark:bg-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDirectPassword(!showDirectPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showDirectPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <Button 
                  size="sm" 
                  disabled={isDirectSetting || !directPassword || directPassword.length < 6}
                  className="w-full text-xs h-8 font-medium bg-primary"
                  onClick={handleDirectSetPassword}
                >
                  {isDirectSetting ? "Đang xử lý..." : "Cấp tài khoản / Đặt mật khẩu này"}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="h-8 text-xs" onClick={() => setPasswordMember(null)}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
