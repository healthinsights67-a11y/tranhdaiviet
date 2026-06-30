import * as React from 'react';
import { 
  Settings, 
  Loader2,
  Database,
  Globe,
  Shield,
  Save,
  Trash2,
  AlertCircle,
  BellRing
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter,
  DialogTrigger
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { db, doc, onSnapshot, setDoc, serverTimestamp, auth } from '@/src/lib/firebase';
import { clearAllAppData } from '@/src/services/dataService';
import { NotificationSettings } from '@/src/components/settings/NotificationSettings';

interface SettingsDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SettingsDialog({ trigger, open, onOpenChange }: SettingsDialogProps) {
  const [configs, setConfigs] = React.useState({
    imgbbKey: '',
    googleMapsKey: '',
    systemName: 'Tủ 3 Miền',
    systemDescription: 'Quản lý sản xuất & thiết kế chuyên nghiệp',
    contactSupport: '',
    enableAutoBackup: true
  });
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    let unsubSnapshot: (() => void) | undefined;
    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        unsubSnapshot = onSnapshot(doc(db, 'configs', 'storage'), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setConfigs({
              imgbbKey: data.imgbbKey || '',
              googleMapsKey: data.googleMapsKey || '',
              systemName: data.systemName || 'Tủ 3 Miền',
              systemDescription: data.systemDescription || 'Quản lý sản xuất & thiết kế chuyên nghiệp',
              contactSupport: data.contactSupport || '',
              enableAutoBackup: data.enableAutoBackup ?? true
            });
          }
        });
      } else {
        if (unsubSnapshot) unsubSnapshot();
      }
    });
    return () => {
      unsubAuth();
      if (unsubSnapshot) unsubSnapshot();
    };
  }, []);

  const handleSaveConfig = async () => {
    setIsLoading(true);
    try {
      await setDoc(doc(db, 'configs', 'storage'), {
        ...configs,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email
      }, { merge: true });
      toast.success("Đã cập nhật cấu hình hệ thống!");
      onOpenChange?.(false);
    } catch (error: any) {
      console.error("Save config error:", error);
      toast.error("Lỗi: " + (error.message || "Không có quyền thay đổi cấu hình."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger render={trigger as React.ReactElement} />}
      <DialogContent className="sm:max-w-[1000px] w-[95vw] max-h-[90vh] gap-0 p-0 overflow-hidden outline-none border border-gray-200 shadow-2xl flex flex-col">
        <DialogHeader className="p-8 pb-6 bg-gray-50 border-b shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-2xl shadow-sm">
              <Settings className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-2xl font-black tracking-tight text-foreground">Cấu hình hệ thống</DialogTitle>
              <DialogDescription className="text-sm font-medium text-muted-foreground">
                Quản trị và tùy chỉnh các thông số vận hành toàn cục của hệ thống Tủ 3 Miền.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="general" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-8 bg-background border-b shrink-0 overflow-x-auto">
            <TabsList className="bg-transparent h-auto p-0 gap-8 min-w-max">
              <TabsTrigger 
                value="general" 
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 py-4 text-sm font-bold transition-all flex items-center gap-2"
              >
                <Globe className="h-4 w-4" /> Tổng quan
              </TabsTrigger>
              <TabsTrigger 
                value="storage" 
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 py-4 text-sm font-bold transition-all flex items-center gap-2"
              >
                <Database className="h-4 w-4" /> Kho lưu trữ & Media
              </TabsTrigger>
              <TabsTrigger 
                value="security" 
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 py-4 text-sm font-bold transition-all flex items-center gap-2"
              >
                <Shield className="h-4 w-4" /> Bảo mật & Sao lưu
              </TabsTrigger>
              <TabsTrigger 
                value="notifications" 
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 py-4 text-sm font-bold transition-all flex items-center gap-2"
              >
                <BellRing className="h-4 w-4" /> Bot Thông Báo
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-10 flex-1 min-h-0 overflow-hidden">
              {/* Cột trái: Nội dung cấu hình (70%) */}
              <div className="md:col-span-7 overflow-y-auto min-h-0 h-full p-8 border-r bg-card text-card-foreground">
                <TabsContent value="general" className="mt-0 space-y-8 animate-in fade-in-50 duration-300">
                  <div className="space-y-1 mb-2">
                    <h3 className="text-lg font-bold text-foreground">Thông tin định danh</h3>
                    <p className="text-xs text-muted-foreground font-medium">Cấu hình các thông tin hiển thị cơ bản của ứng dụng.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-2.5">
                      <Label htmlFor="sys-name" className="text-[13px] font-bold text-foreground/80 ml-1">Tên hệ thống</Label>
                      <Input 
                        id="sys-name"
                        value={configs.systemName}
                        onChange={(e) => setConfigs(prev => ({ ...prev, systemName: e.target.value }))}
                        placeholder="Ví dụ: Tủ 3 Miền ERP"
                        className="h-11 text-sm bg-card text-card-foreground border border-gray-200 focus:border-blue-300 rounded-xl px-4"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <Label htmlFor="sys-desc" className="text-[13px] font-bold text-foreground/80 ml-1">Mô tả ngắn</Label>
                      <Input 
                        id="sys-desc"
                        value={configs.systemDescription}
                        onChange={(e) => setConfigs(prev => ({ ...prev, systemDescription: e.target.value }))}
                        placeholder="Hiển thị ở tiêu đề trang hoặc meta tag..."
                        className="h-11 text-sm bg-card text-card-foreground border border-gray-200 focus:border-blue-300 rounded-xl px-4"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <Label htmlFor="contact" className="text-[13px] font-bold text-foreground/80 ml-1">Email/SĐT hỗ trợ</Label>
                      <Input 
                        id="contact"
                        value={configs.contactSupport}
                        onChange={(e) => setConfigs(prev => ({ ...prev, contactSupport: e.target.value }))}
                        placeholder="Kỹ thuật hoặc Phản hồi khách hàng..."
                        className="h-11 text-sm bg-card text-card-foreground border border-gray-200 focus:border-blue-300 rounded-xl px-4"
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="storage" className="mt-0 space-y-8 animate-in fade-in-50 duration-300">
                  <div className="space-y-1 mb-2">
                    <h3 className="text-lg font-bold text-foreground">Cấu hình kho ảnh (ImgBB)</h3>
                    <p className="text-xs text-muted-foreground font-medium">Kết nối với bên thứ ba để tối ưu hóa chi phí lưu trữ hình ảnh.</p>
                  </div>

                  <div className="p-5 bg-blue-50 border-2 border-blue-100 rounded-2xl flex gap-4">
                    <div className="p-2 bg-blue-100 rounded-xl shrink-0 h-fit">
                      <AlertCircle className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-sm font-bold text-blue-900">Tại sao cần tích hợp ImgBB?</p>
                      <p className="text-[12px] text-blue-800/80 leading-relaxed font-medium">
                        Firebase Storage mặc định có giới hạn băng thông và dung lượng miễn phí rất thấp cho các tệp tin lớn. Tích hợp ImgBB cho phép hệ thống quản lý hàng chục ngàn bản vẽ PDF, ảnh công trình mà không làm tăng chi phí hạ tầng.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <Label htmlFor="imgbb-key" className="text-[13px] font-bold text-foreground/80 ml-1">ImgBB API Secret Key</Label>
                      {configs.imgbbKey && (
                        <div className="flex items-center gap-1.5 text-[11px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 shadow-sm">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          ĐANG HOẠT ĐỘNG
                        </div>
                      )}
                    </div>
                    <div className="relative group">
                      <Input 
                        id="imgbb-key"
                        type="password"
                        placeholder="Dán mã bí mật từ api.imgbb.com tại đây..."
                        value={configs.imgbbKey}
                        onChange={(e) => setConfigs(prev => ({ ...prev, imgbbKey: e.target.value }))}
                        className="pr-12 h-12 font-mono tracking-[0.2em] text-sm bg-card text-card-foreground border border-gray-200 focus:border-blue-400 rounded-xl px-5 transition-all"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <Database className="h-4 w-4 text-muted-foreground/40" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-1">
                      <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                      <p className="text-xs text-muted-foreground font-medium italic">
                        Truy cập <a href="https://api.imgbb.com/" target="_blank" rel="noopener noreferrer" className="text-primary font-bold hover:underline">trang quản trị API</a> để tạo hoặc lấy khóa mới.
                      </p>
                    </div>

                    <div className="mt-8 mb-4 border-t border-gray-100 pt-8" />
                    
                    <div className="space-y-1 mb-4">
                      <h3 className="text-lg font-bold text-foreground">Cấu hình Google Maps API</h3>
                      <p className="text-xs text-muted-foreground font-medium">Bật các tính năng bản đồ chỉ đường, định vị và tự động điền địa chỉ.</p>
                    </div>
                    
                    <div className="flex items-center justify-between mb-1">
                      <Label htmlFor="gmaps-key" className="text-[13px] font-bold text-foreground/80 ml-1">Google Maps API Key</Label>
                      {configs.googleMapsKey && (
                        <div className="flex items-center gap-1.5 text-[11px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 shadow-sm">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          ĐÃ LƯU
                        </div>
                      )}
                    </div>
                    <div className="relative group">
                      <Input 
                        id="gmaps-key"
                        type="password"
                        placeholder="AIzaSy... (Để trống sẽ dùng bản đồ Demo)"
                        value={configs.googleMapsKey}
                        onChange={(e) => setConfigs(prev => ({ ...prev, googleMapsKey: e.target.value }))}
                        className="pr-12 h-12 font-mono tracking-[0.2em] text-sm bg-card text-card-foreground border border-gray-200 focus:border-blue-400 rounded-xl px-5 transition-all"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <Globe className="h-4 w-4 text-muted-foreground/40" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-1">
                      <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                      <p className="text-xs text-muted-foreground font-medium italic">
                        Tạo khóa API tại <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary font-bold hover:underline">Google Cloud Console</a>.
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="security" className="mt-0 space-y-8 animate-in fade-in-50 duration-300">
                   <div className="space-y-1 mb-2">
                    <h3 className="text-lg font-bold text-foreground">Chính sách bảo mật</h3>
                    <p className="text-xs text-muted-foreground font-medium">Quản lý cách thức hệ thống bảo vệ và sao lưu dữ liệu.</p>
                  </div>

                  <div className="divide-y border border-gray-200 rounded-2xl overflow-hidden bg-card text-card-foreground shadow-sm">
                    <div className="flex items-center justify-between p-6 hover:bg-gray-50 transition-colors">
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-foreground">Sao lưu dữ liệu tự động</p>
                        <p className="text-[12px] text-muted-foreground font-medium leading-relaxed max-w-[400px]">
                          Tạo bản sao toàn bộ cơ sở dữ liệu hàng tuần và lưu trữ vào phân vùng bảo mật. Phục hồi nhanh chóng khi có sự cố.
                        </p>
                      </div>
                      <Button 
                        variant={configs.enableAutoBackup ? "default" : "outline"}
                        size="sm"
                        className={`h-9 px-6 rounded-xl text-xs font-black transition-all ${configs.enableAutoBackup ? 'bg-primary shadow-sm' : ''}`}
                        onClick={() => setConfigs(prev => ({ ...prev, enableAutoBackup: !prev.enableAutoBackup }))}
                      >
                        {configs.enableAutoBackup ? "ĐÃ KÍCH HOẠT" : "ĐANG TẮT"}
                      </Button>
                    </div>

                    <div className="flex items-center justify-between p-6 hover:bg-gray-50 transition-colors">
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-gray-400">Xác thực 2 yếu tố (2FA)</p>
                        <p className="text-[12px] text-gray-400 font-medium">Thêm lớp bảo mật thông qua mã xác nhận ứng dụng.</p>
                      </div>
                      <Button variant="outline" size="sm" disabled className="h-9 px-6 rounded-xl text-xs font-bold border-dashed">Sắp ra mắt</Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="notifications" className="mt-0 space-y-8 animate-in fade-in-50 duration-300">
                  <NotificationSettings />
                </TabsContent>
              </div>

              {/* Cột phải: Actions & Danger Zone (30%) */}
              <div className="md:col-span-3 bg-gray-50 p-8 space-y-8 overflow-y-auto">
                <div className="space-y-4">
                  <h4 className="text-[11px] font-black uppercase text-muted-foreground tracking-widest border-b pb-2">Hướng dẫn & Trợ giúp</h4>
                  <div className="space-y-3">
                    <div className="p-4 bg-card text-card-foreground rounded-xl border border-gray-200 shadow-sm">
                      <p className="text-[11px] font-bold text-foreground leading-relaxed">
                        Mọi thay đổi tại đây sẽ được áp dụng ngay lập tức cho toàn bộ người dùng trong hệ thống.
                      </p>
                    </div>
                    <div className="p-4 bg-card text-card-foreground rounded-xl border border-gray-200 shadow-sm">
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Nếu bạn thay đổi ImgBB Key, các ảnh cũ vẫn hiển thị bình thường nhưng ảnh mới sẽ được lưu vào tài khoản mới.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t-2 border-white">
                  <div className="flex items-center gap-2 text-destructive">
                    <Trash2 className="h-4 w-4" />
                    <h4 className="text-[11px] font-black uppercase tracking-widest">Khu vực nguy hiểm</h4>
                  </div>
                  
                  <div className="p-5 bg-red-50 border border-red-100 rounded-2xl space-y-4 shadow-sm">
                    <div className="space-y-1.5 text-center">
                      <p className="text-sm font-bold text-red-600">Xóa dữ liệu</p>
                      <p className="text-[11px] text-red-500 font-medium leading-[1.3]">Xóa toàn bộ dữ liệu test của hệ thống.</p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger className="w-full h-10 text-[11px] font-black uppercase tracking-wider rounded-xl shadow-sm hover:scale-[1.02] transition-transform bg-destructive text-destructive-foreground hover:bg-destructive/90 inline-flex items-center justify-center">
                        Bắt đầu xóa
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Xóa toàn bộ dữ liệu test?</AlertDialogTitle>
                          <AlertDialogDescription>Bạn có chắc chắn muốn xóa toàn bộ dữ liệu test? Hành động này không thể hoàn tác.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Hủy</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={async () => {
                              toast.info("Đang xóa dữ liệu...");
                              await clearAllAppData();
                              toast.success("Đã xóa dữ liệu thành công!");
                              window.location.reload();
                            }}
                          >Xóa</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Tabs>

        <DialogFooter className="p-8 pt-4 bg-card text-card-foreground border-t shrink-0 flex-row items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-[10px] text-muted-foreground font-bold tracking-tight">
              TRẠNG THÁI: <span className="text-primary">ĐANG ĐỒNG BỘ TRỰC TIẾP</span>
            </p>
            <p className="text-[9px] text-muted-foreground/60 font-medium italic">
              Lần cuối cập nhật: {new Date().toLocaleDateString('vi-VN')} {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange?.(false)} 
              disabled={isLoading}
              className="h-11 px-8 text-xs font-bold rounded-2xl border-2 hover:bg-gray-100 transition-all"
            >
              Hủy bỏ
            </Button>
            <Button 
              onClick={handleSaveConfig} 
              disabled={isLoading}
              className="h-11 px-10 text-xs font-black uppercase tracking-wider rounded-2xl shadow-xl shadow-primary/30 transition-all hover:scale-[1.02] active:scale-95 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" />
              ) : (
                <Save className="mr-2 h-4 w-4 text-white" />
              )}
              Lưu cấu hình
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

