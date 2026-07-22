import React, { useState, useMemo } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { Task, Member, Customer } from '@/src/types';
import { db, doc, updateDoc } from '@/src/lib/firebase';
import { TaskSchema } from '@/src/schemas';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Camera, 
  MapPin, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  User, 
  Phone, 
  ArrowLeft, 
  Navigation, 
  Image as ImageIcon, 
  Trash2,
  ListTodo,
  AlertCircle,
  Upload,
  CheckCircle
} from 'lucide-react';
import { uploadToImgBB } from '@/src/services/uploadService';
import { notifyManagers } from '@/src/services/notificationService';
import { toast } from 'sonner';
import { cn } from '@/src/lib/utils';

interface InstallerDashboardProps {
  tasks: Task[];
  customers?: Customer[];
  currentUser: Member | null;
}

export function InstallerDashboard({ tasks, customers = [], currentUser }: InstallerDashboardProps) {
  const queryClient = useQueryClient();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [issueText, setIssueText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isIssueDialogOpen, setIsIssueDialogOpen] = useState(false);

  // Hiển thị toàn bộ công trình sản xuất và thi công lắp ráp cho thợ
  const installerTasks = useMemo(() => {
    return tasks.filter(t => {
      if (t.status === 'archived') return false;
      
      // Không hiển thị các task sale, design, marketing cho thợ thi công
      if (t.type && ['design', 'sale', 'marketing'].includes(t.type)) return false;

      const isProduction = t.type === 'production';
      const isWaitingInstall = t.status === 'waiting_install';
      const hasCheckedIn = !!t.checkinTime;
      const hasWaitingInstallAt = !!t.waiting_install_at;

      // Kiểm tra trạng thái của khách hàng liên quan
      const customer = customers.find(c => c.id === t.customerId);
      const isCustomerActive = customer && (customer.stage === 'production' || customer.stage === 'installation');
      
      const isAssignedToMe = t.assigneeId === currentUser?.id;
      
      return isProduction || isWaitingInstall || hasCheckedIn || hasWaitingInstallAt || isCustomerActive || isAssignedToMe;
    });
  }, [tasks, customers, currentUser]);

  // Separate tasks into active and completed
  const { activeTasks, completedTasks } = useMemo(() => {
    const active = installerTasks.filter(t => t.status !== 'done');
    const completed = installerTasks.filter(t => t.status === 'done');
    return { activeTasks: active, completedTasks: completed };
  }, [installerTasks]);

  // Mutation to update Task
  const updateTaskMutation = useMutation({
    mutationFn: async (updatedTask: Task) => {
      const taskDoc = doc(db, 'tasks', updatedTask.id);
      
      // Strict Zod Validation under AGENTS.md rules
      const validated = TaskSchema.parse(updatedTask);
      await updateDoc(taskDoc, validated);
      return validated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error: any) => {
      toast.error('Lỗi cập nhật: ' + error.message);
    }
  });

  // GPS Check-in handler
  const handleCheckIn = async (task: Task) => {
    if (!navigator.geolocation) {
      toast.error('Trình duyệt hoặc thiết bị của bạn không hỗ trợ định vị GPS.');
      return;
    }

    setIsCheckingIn(true);
    toast.info('Đang lấy tọa độ GPS hiện tại...');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const checkinLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        const checkinTime = new Date().toISOString();

        const updatedTask: Task = {
          ...task,
          checkinLocation,
          checkinTime,
          status: task.status === 'todo' || task.status === 'waiting_install' ? 'in-progress' : task.status
        };

        try {
          await updateTaskMutation.mutateAsync(updatedTask);
          toast.success('Check-in thành công tại công trình!');
          
          // Notify managers about the check-in
          notifyManagers(
            `Thợ check-in: ${currentUser?.name || 'Nhân viên'}`,
            `Đã check-in tại công trình khách hàng ${task.customerName || 'Không rõ'} vào lúc ${new Date(checkinTime).toLocaleTimeString('vi-VN')}`,
            { taskId: task.id, type: 'checkin' }
          );
        } catch (err) {
          console.error(err);
        } finally {
          setIsCheckingIn(false);
          // If we are viewing details, update the active view
          if (selectedTask && selectedTask.id === task.id) {
            setSelectedTask(updatedTask);
          }
        }
      },
      (error) => {
        setIsCheckingIn(false);
        let errorMsg = 'Không thể lấy vị trí của bạn.';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = 'Bạn cần cấp quyền truy cập vị trí (GPS) để check-in.';
        }
        toast.error(errorMsg);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Image Upload handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, task: Task, stage: 'Phá dỡ' | 'Lên khung' | 'Vào cánh' | 'Nghiệm thu' | 'Khác') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const uploadedUrls: string[] = [];

    toast.info(`Bắt đầu tải lên ${files.length} ảnh ${stage}...`);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const url = await uploadToImgBB(file, `THICONG_${task.id}_${Date.now()}_${i}`);
        if (url) {
          uploadedUrls.push(url);
        }
      }

      if (uploadedUrls.length > 0) {
        const currentProgressImages = task.installationProgressImages || [];
        const newProgressImages = uploadedUrls.map(url => ({
          id: crypto.randomUUID(),
          url,
          stage,
          timestamp: new Date().toISOString(),
          uploaderName: currentUser?.name || 'Nhân viên'
        }));

        const updatedTask: Task = {
          ...task,
          installationProgressImages: [...currentProgressImages, ...newProgressImages]
        };

        await updateTaskMutation.mutateAsync(updatedTask);
        
        // Notify managers about progress
        notifyManagers(
          `Cập nhật tiến độ: ${stage}`,
          `Công trình ${task.customerName || task.title} vừa được tải lên ${uploadedUrls.length} ảnh mới lúc ${new Date().toLocaleTimeString('vi-VN')} bởi thợ ${currentUser?.name || 'Nhân viên'}.`,
          { taskId: task.id, type: 'progress' },
          undefined,
          ['quản lý', 'xưởng']
        );

        toast.success(`Đã tải lên thành công ${uploadedUrls.length} ảnh ${stage}!`);
        
        if (selectedTask && selectedTask.id === task.id) {
          setSelectedTask(updatedTask);
        }
      }
    } catch (err: any) {
      toast.error('Lỗi trong quá trình upload: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Image Delete handler
  const handleImageDelete = async (task: Task, imageUrl: string, imageId?: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa ảnh này?')) return;

    let newImages = task.installationImages || [];
    if (!imageId) {
      newImages = newImages.filter(url => url !== imageUrl);
    }

    let newProgressImages = task.installationProgressImages || [];
    if (imageId) {
      newProgressImages = newProgressImages.filter(img => img.id !== imageId);
    }

    const updatedTask: Task = {
      ...task,
      installationImages: newImages,
      installationProgressImages: newProgressImages
    };

    toast.promise(
      updateTaskMutation.mutateAsync(updatedTask),
      {
        loading: 'Đang xóa ảnh...',
        success: () => {
          if (selectedTask && selectedTask.id === task.id) {
            setSelectedTask(updatedTask);
          }
          return 'Đã xóa ảnh thành công!';
        },
        error: 'Lỗi xóa ảnh.'
      }
    );
  };

  // Issue Reporting handler
  const handleReportIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    if (!issueText.trim()) {
      toast.error('Vui lòng nhập nội dung báo lỗi.');
      return;
    }

    const updatedTask: Task = {
      ...selectedTask,
      installationIssues: issueText.trim()
    };

    toast.promise(
      updateTaskMutation.mutateAsync(updatedTask),
      {
        loading: 'Đang gửi báo lỗi...',
        success: () => {
          setIsIssueDialogOpen(false);
          setIssueText('');
          
          // Notify managers about the issue
          notifyManagers(
            `CẢNH BÁO SỰ CỐ: ${selectedTask.customerName || 'Công trình'}`,
            `Thợ ${currentUser?.name || 'Nhân viên'} báo lỗi: ${issueText.trim()}`,
            { taskId: selectedTask.id, type: 'issue' },
            undefined,
            ['quản lý', 'xưởng']
          );

          if (selectedTask && selectedTask.id === updatedTask.id) {
            setSelectedTask(updatedTask);
          }
          return 'Đã gửi báo lỗi tới bộ phận quản lý!';
        },
        error: 'Lỗi gửi báo cáo.'
      }
    );
  };

  // Mark task as completed
  const handleCompleteTask = async (task: Task) => {
    if (!task.checkinTime) {
      toast.error('Bạn cần check-in trước khi hoàn thành công trình.');
      return;
    }

    const updatedTask: Task = {
      ...task,
      status: 'done',
      completedAt: new Date().toISOString()
    };

    toast.promise(
      updateTaskMutation.mutateAsync(updatedTask),
      {
        loading: 'Đang ghi nhận hoàn thành...',
        success: () => {
          // Notify managers
          notifyManagers(
            `Hoàn thành thi công: ${task.customerName || 'Không rõ'}`,
            `Thợ ${currentUser?.name || 'Nhân viên'} đã báo cáo hoàn thành công trình lắp đặt.`,
            { taskId: task.id, type: 'completion' }
          );

          setSelectedTask(null);
          return 'Chúc mừng! Đã hoàn thành nghiệm thu công trình.';
        },
        error: 'Lỗi cập nhật trạng thái.'
      }
    );
  };

  // Helper to open Google Maps
  const openMap = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
  };

  // Detail view for a task
  if (selectedTask) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto pb-12 animate-in slide-in-from-right duration-200">
        
        {/* Back Button */}
        <Button 
          variant="ghost" 
          onClick={() => setSelectedTask(null)} 
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground pl-0"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại danh sách
        </Button>

        {/* Task Title / Customer details */}
        <div className="space-y-2">
          <Badge className="bg-primary/10 text-primary border border-primary/20">
            {selectedTask.status === 'todo' && 'Chưa bắt đầu'}
            {selectedTask.status === 'in-progress' && 'Đang lắp ráp'}
            {selectedTask.status === 'review' && 'Đang nghiệm thu'}
            {selectedTask.status === 'waiting_install' && 'Chờ thi công'}
            {selectedTask.status === 'done' && 'Đã xong'}
          </Badge>
          <h2 className="text-2xl font-black tracking-tight">{selectedTask.customerName || selectedTask.title}</h2>
          <p className="text-muted-foreground text-sm flex items-center gap-1">
            <MapPin className="h-4 w-4 text-primary shrink-0" />
            {selectedTask.address || 'Không có địa chỉ'}
          </p>
          {selectedTask.phone && (
            <p className="text-muted-foreground text-sm flex items-center gap-1 pt-1">
              <Phone className="h-4 w-4 text-emerald-500 shrink-0" />
              <a href={`tel:${selectedTask.phone}`} className="hover:underline text-emerald-600 dark:text-emerald-400 font-semibold">
                {selectedTask.phone}
              </a>
            </p>
          )}
        </div>

        {/* Action 1: GPS Check-in */}
        <Card className="border border-border shadow-sm overflow-hidden">
          <CardHeader className="bg-secondary/10 py-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Navigation className="h-4 w-4 text-primary" />
              1. Check-in vị trí
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {selectedTask.checkinTime ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20 text-xs font-semibold">
                  <CheckCircle2 className="h-4.5 w-4.5" />
                  Đã check-in lúc {new Date(selectedTask.checkinTime).toLocaleTimeString('vi-VN')} ngày {new Date(selectedTask.checkinTime).toLocaleDateString('vi-VN')}
                </div>
                {selectedTask.checkinLocation && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => openMap(selectedTask.checkinLocation!.lat, selectedTask.checkinLocation!.lng)}
                    className="w-full text-xs h-9 bg-white"
                  >
                    <MapPin className="h-3.5 w-3.5 mr-1 text-primary" />
                    Xem vị trí trên bản đồ
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Hãy bấm check-in khi bạn vừa đến công trình để hệ thống lưu tọa độ và bắt đầu tính thời gian thi công.
                </p>
                <Button 
                  onClick={() => handleCheckIn(selectedTask)}
                  disabled={isCheckingIn}
                  className="w-full h-11 bg-primary text-white hover:bg-primary/90 font-bold rounded-xl shadow-md"
                >
                  <MapPin className="h-5 w-5 mr-1.5 animate-bounce" />
                  {isCheckingIn ? 'Đang định vị...' : 'Bấm Check-in tại đây'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action 2: Image upload */}
        <Card className="border border-border shadow-sm overflow-hidden bg-secondary/5">
          <CardHeader className="bg-secondary/10 py-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Camera className="h-4 w-4 text-primary" />
              2. Ảnh nghiệm thu / Tiến độ ({(selectedTask.installationImages?.length || 0) + (selectedTask.installationProgressImages?.length || 0)})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <p className="text-xs text-muted-foreground">
              Tải lên ảnh theo từng giai đoạn thi công. Hệ thống sẽ lưu lại thời gian và báo cáo trực tiếp về Zalo.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {['Phá dỡ', 'Lên khung', 'Vào cánh', 'Nghiệm thu'].map(stage => {
                 const stageImages = (selectedTask.installationProgressImages || []).filter(img => img.stage === stage);
                 
                 return (
                   <div key={stage} className="border border-border rounded-xl p-3 bg-white space-y-3 shadow-sm hover:shadow-md transition-shadow">
                     <div className="flex items-center justify-between">
                       <h4 className="font-bold text-sm text-foreground">{stage} ({stageImages.length})</h4>
                       <div className="relative">
                         <input
                           type="file"
                           multiple
                           accept="image/*"
                           onChange={(e) => handleImageUpload(e, selectedTask, stage as any)}
                           id={`upload-${stage}`}
                           disabled={isUploading}
                           className="hidden"
                         />
                         <label
                           htmlFor={`upload-${stage}`}
                           className="inline-flex items-center justify-center h-8 px-3 text-[10px] font-bold text-primary bg-primary/10 rounded-lg hover:bg-primary/20 cursor-pointer transition-colors"
                         >
                           {isUploading ? 'Đang tải...' : 'Tải ảnh lên'}
                         </label>
                       </div>
                     </div>
                     
                     {/* Gallery for this stage */}
                     {stageImages.length > 0 ? (
                       <div className="grid grid-cols-3 gap-2">
                         {stageImages.map(img => (
                           <div key={img.id} className="relative group flex flex-col items-center">
                             <div className="w-full aspect-square rounded-lg overflow-hidden border border-border bg-secondary relative">
                               <img 
                                 src={img.url} 
                                 alt={img.stage} 
                                 className="w-full h-full object-cover"
                               />
                               {selectedTask.status !== 'done' && (
                                 <button 
                                   onClick={() => handleImageDelete(selectedTask, img.url, img.id)}
                                   className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-600/80 hover:bg-red-600 flex items-center justify-center text-white shadow-sm transition-colors opacity-0 group-hover:opacity-100"
                                 >
                                   <Trash2 className="h-3.5 w-3.5" />
                                 </button>
                               )}
                             </div>
                             <p className="text-[9px] text-center text-muted-foreground mt-1 truncate w-full">
                               {new Date(img.timestamp).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})} {new Date(img.timestamp).toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit'})}
                             </p>
                           </div>
                         ))}
                       </div>
                     ) : (
                       <div className="flex flex-col items-center justify-center py-6 bg-secondary/30 rounded-lg border border-dashed border-border">
                         <Camera className="h-6 w-6 text-muted-foreground/30 mb-1" />
                         <span className="text-[10px] text-muted-foreground/60">Chưa có ảnh</span>
                       </div>
                     )}
                   </div>
                 )
               })}
            </div>

            {/* Support legacy images */}
            {(selectedTask.installationImages?.length || 0) > 0 && (
               <div className="mt-4 border border-border rounded-xl p-3 bg-white space-y-3 shadow-sm">
                 <h4 className="font-bold text-sm text-foreground">Ảnh cũ ({selectedTask.installationImages!.length})</h4>
                 <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                   {selectedTask.installationImages!.map((url, idx) => (
                     <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-border group bg-secondary">
                       <img 
                         src={url} 
                         alt={`Nghiệm thu cũ ${idx + 1}`} 
                         className="w-full h-full object-cover"
                       />
                       {selectedTask.status !== 'done' && (
                         <button 
                           onClick={() => handleImageDelete(selectedTask, url)}
                           className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-600/80 hover:bg-red-600 flex items-center justify-center text-white shadow-sm transition-colors opacity-0 group-hover:opacity-100"
                         >
                           <Trash2 className="h-3.5 w-3.5" />
                         </button>
                       )}
                     </div>
                   ))}
                 </div>
               </div>
            )}
          </CardContent>
        </Card>

        {/* Action 3: Issue reporting */}
        <Card className="border border-border shadow-sm overflow-hidden">
          <CardHeader className="bg-secondary/10 py-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-4 w-4" />
              3. Báo lỗi phát sinh (nếu có)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {selectedTask.installationIssues ? (
              <div className="space-y-3">
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3.5 text-xs text-rose-700 dark:text-rose-400 font-medium">
                  <p className="font-bold flex items-center gap-1 mb-1">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Sự cố đã báo cáo:
                  </p>
                  <p className="italic">"{selectedTask.installationIssues}"</p>
                </div>
                {selectedTask.status !== 'done' && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setIssueText(selectedTask.installationIssues || '');
                      setIsIssueDialogOpen(true);
                    }}
                    className="w-full text-xs h-9 bg-white"
                  >
                    Chỉnh sửa báo cáo lỗi
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Nếu tủ bếp xước, thiếu bản lề, lỗi kích thước bản vẽ... hãy ghi chú ở đây để xưởng sản xuất chuẩn bị đồ đi khắc phục gấp.
                </p>
                {selectedTask.status !== 'done' && (
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIssueText('');
                      setIsIssueDialogOpen(true);
                    }}
                    className="w-full h-10 border-rose-200 text-rose-600 hover:bg-rose-500/5 hover:border-rose-300 dark:border-rose-900 font-semibold rounded-xl text-xs"
                  >
                    Báo lỗi công trình
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action 4: Completion */}
        {selectedTask.status !== 'done' && (
          <Button
            onClick={() => handleCompleteTask(selectedTask)}
            disabled={!selectedTask.checkinTime}
            className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-lg transition-all duration-150"
          >
            <CheckCircle className="h-5.5 w-5.5 mr-1.5" />
            Nghiệm thu & Hoàn thành
          </Button>
        )}
        {!selectedTask.checkinTime && selectedTask.status !== 'done' && (
          <p className="text-center text-[10px] text-muted-foreground italic">
            * Cần check-in tại công trình trước khi có thể bấm Báo cáo Hoàn thành.
          </p>
        )}

        {/* Issue dialog */}
        <Dialog open={isIssueDialogOpen} onOpenChange={setIsIssueDialogOpen}>
          <DialogContent className="max-w-xs bg-white rounded-xl p-5 border border-border">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold flex items-center gap-1.5 text-rose-600">
                <AlertTriangle className="h-4.5 w-4.5" />
                Báo cáo lỗi công trình
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleReportIssue} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="issue" className="text-xs font-bold">Nội dung lỗi</Label>
                <Textarea 
                  id="issue" 
                  value={issueText}
                  onChange={(e) => setIssueText(e.target.value)}
                  placeholder="Ví dụ: Thiếu 4 chiếc bản lề giảm chấn, mặt cánh ngăn kéo bị xước sơn góc trái cần sơn lại..."
                  className="min-h-[100px] text-xs bg-white border border-border"
                />
              </div>
              <DialogFooter className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsIssueDialogOpen(false)} className="bg-white text-xs h-8">
                  Hủy
                </Button>
                <Button type="submit" size="sm" className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-8">
                  Gửi Báo Lỗi
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

      </div>
    );
  }

  // List view
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
      
      {/* Title */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-1.5">
          <ListTodo className="h-7 w-7 text-primary" />
          Báo cáo thi công
        </h1>
        <p className="text-muted-foreground text-xs mt-1">
          Danh sách toàn bộ công trình cần thi công lắp đặt. Chọn công trình để báo cáo tiến độ.
        </p>
      </div>

      {/* Active Tasks Section */}
      <div className="space-y-3">
        <h3 className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <Clock className="h-4 w-4" />
          Công trình đang thi công ({activeTasks.length})
        </h3>
        
        {activeTasks.length === 0 ? (
          <Card className="border border-dashed border-muted-foreground/20 bg-secondary/10">
            <CardContent className="p-8 text-center text-muted-foreground text-xs italic">
              Không có công trình nào được giao cần thi công hiện tại.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeTasks.map((task) => (
              <Card 
                key={task.id} 
                onClick={() => setSelectedTask(task)}
                className="hover:border-primary/40 active:bg-secondary/40 cursor-pointer transition-all border border-border shadow-sm relative group overflow-hidden"
              >
                {/* Visual accent left line */}
                <span className={cn(
                  "absolute left-0 top-0 bottom-0 w-1",
                  task.status === 'in-progress' ? 'bg-amber-500' : 'bg-primary'
                )} />

                <CardContent className="p-4 pl-5 space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                      {task.customerName || task.title}
                    </h4>
                    <Badge className={cn(
                      "text-[10px] font-semibold py-0.5",
                      task.status === 'in-progress' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-primary/10 text-primary border-primary/20'
                    )}>
                      {task.status === 'in-progress' ? 'Đang lắp ráp' : 'Đang chờ'}
                    </Badge>
                  </div>
                  
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                    <span className="line-clamp-1">{task.address || 'Không rõ địa chỉ'}</span>
                  </p>

                  <div className="flex items-center justify-between pt-1.5 border-t border-secondary/50 text-[11px] text-muted-foreground font-medium">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground/70" />
                      Hạn: {task.dueDate ? new Date(task.dueDate).toLocaleDateString('vi-VN') : 'Không có'}
                    </span>
                    {task.checkinTime ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                        <CheckCircle2 className="h-3 w-3" /> Đã check-in
                      </span>
                    ) : (
                      <span className="text-rose-600 font-bold flex items-center gap-0.5">
                        Chưa check-in
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Completed Tasks Section */}
      <div className="space-y-3 pt-2">
        <h3 className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4" />
          Đã hoàn thành gần đây ({completedTasks.length})
        </h3>

        {completedTasks.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 italic pl-1">Chưa có công trình nào báo cáo hoàn thành.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {completedTasks.slice(0, 5).map((task) => (
              <Card 
                key={task.id} 
                onClick={() => setSelectedTask(task)}
                className="opacity-75 hover:opacity-100 hover:border-primary/20 active:bg-secondary/40 cursor-pointer transition-all border border-border shadow-sm relative group overflow-hidden"
              >
                <span className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />
                <CardContent className="p-4 pl-5 space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="text-sm font-bold text-foreground line-clamp-1">
                      {task.customerName || task.title}
                    </h4>
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-semibold py-0.5">
                      Hoàn thành
                    </Badge>
                  </div>
                  
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                    <span className="line-clamp-1">{task.address}</span>
                  </p>

                  {task.completedAt && (
                    <div className="pt-1.5 border-t border-secondary/50 text-[10px] text-muted-foreground flex justify-end">
                      Đã nghiệm thu ngày {new Date(task.completedAt).toLocaleDateString('vi-VN')}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
