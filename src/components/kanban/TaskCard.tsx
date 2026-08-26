import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task, Member, WORKSHOPS, Status, getWorkshopName, Customer, MarketingTaskItem } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SDK_VERSION } from 'firebase/app';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, MoreHorizontal, GripVertical, Clock, Package, Eye, CheckCircle2, FileText, User, Trash2, ChevronLeft, ChevronRight, Upload, Loader2, Save, Plus, Image, Wrench, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, getVNTimestamp } from '@/src/lib/utils';
import { format } from 'date-fns';
import { TASK_PRIORITY_CONFIG, TASK_STATUS_CONFIG } from '@/src/lib/badgeMappings';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ImagePreviewDialog } from '@/src/components/ui/ImagePreviewDialog';
import { MaterialRequisitionForm } from './MaterialRequisitionForm';
import { ProductionChecklistForm } from './ProductionChecklistForm';
import { db, auth, doc, deleteDoc, updateDoc, handleFirestoreError, OperationType, storage, ref, uploadBytes, getDownloadURL, addDoc, collection } from '@/src/lib/firebase';
import { moveToTrash } from '@/src/services/trashService';
import { uploadToImgBB } from '@/src/services/uploadService';
import { uploadToDropbox } from '@/src/services/dropboxService';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TaskCardProps {
  task: Task;
  assignee?: Member;
  members?: Member[];
  customers?: Customer[];
  columns?: { id: Status; title: string }[];
  onMoveTask?: (taskId: string, newStatus: Status, preSelectedAssigneeId?: string, fileLinks?: string[]) => void;
  hideChecklist?: boolean;
  renderAsTextOnly?: boolean;
  dialogOnly?: boolean;
  onCloseDialog?: () => void;
  key?: React.Key;
}

const STATUS_ICONS = {
  'todo': Clock,
  'in-progress': Package,
  'review': Eye,
  'done': CheckCircle2,
};

const PRIORITY_ACCENTS = {
  'high': 'before:bg-red-500',
  'medium': 'before:bg-yellow-500',
  'low': 'before:bg-blue-500',
};

export const TaskCard = React.memo(({ task, assignee, members = [], customers = [], columns = [], onMoveTask, hideChecklist = false, renderAsTextOnly = false, dialogOnly = false, onCloseDialog }: TaskCardProps) => {
  const queryClient = useQueryClient();
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = React.useState(false);
  const [isUpdatingAssignee, setIsUpdatingAssignee] = React.useState(false);
  const [newFileLinkDetail, setNewFileLinkDetail] = React.useState('');
  const [isUploading, setIsUploading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [editableDescription, setEditableDescription] = React.useState(task.description || '');
  const [editableTitle, setEditableTitle] = React.useState(task.title || '');
  const [editableMarketingTasks, setEditableMarketingTasks] = React.useState<MarketingTaskItem[]>(task.marketingTasks || []);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const isUploadingRef = React.useRef(false);
  // Remove storedImgbbKey state and useEffect as we use the service now
  const [isMaterialFormOpen, setIsMaterialFormOpen] = React.useState(false);
  const [isProductionChecklistOpen, setIsProductionChecklistOpen] = React.useState(false);

  React.useEffect(() => {
    if (dialogOnly) {
      setIsDetailOpen(true);
    }
  }, [dialogOnly]);

  React.useEffect(() => {
    if (dialogOnly && !isDetailOpen) {
      onCloseDialog?.();
    }
  }, [isDetailOpen, dialogOnly, onCloseDialog]);

  // Compute installation date
  const actualId = task.id.startsWith('virtual-') ? task.id.replace('virtual-', '') : task.id;
  const installationSchedules = queryClient.getQueryData<any[]>(['installation_schedules']) || [];
  const schedule = React.useMemo(() => {
    return installationSchedules.find(s => 
      s.taskId === actualId || 
      s.customerId === actualId || 
      (task.customerId && s.customerId === task.customerId)
    );
  }, [installationSchedules, actualId, task.customerId]);
  
  const installDate = task.waiting_install_at || task.productionChecklist?.installationDate || schedule?.date;

  const measurementSchedules = queryClient.getQueryData<any[]>(['measurement_schedules']) || [];
  const linkedMeasurement = React.useMemo(() => {
    const cleanPhone = task.phone?.trim()?.replace(/\D/g, '') || 
                       task.description?.replace(/\D/g, '').slice(-10);
    const cleanTitle = task.title?.toLowerCase()?.replace('thiết kế:', '')?.trim();
    
    return measurementSchedules.find(s => {
      if (task.customerId && s.customerId === task.customerId) return true;
      
      const sPhone = s.phone?.trim()?.replace(/\D/g, '');
      if (cleanPhone && sPhone && (cleanPhone.includes(sPhone) || sPhone.includes(cleanPhone))) return true;
      
      if (cleanTitle && s.customerName?.toLowerCase()?.trim()?.includes(cleanTitle)) return true;
      
      return false;
    });
  }, [task.customerId, task.phone, task.description, task.title, measurementSchedules]);

  const allMeasurementImages = React.useMemo(() => {
    const urls = new Set([...(task.imageUrls || []), ...(linkedMeasurement?.imageUrls || [])]);
    return Array.from(urls);
  }, [task.imageUrls, linkedMeasurement?.imageUrls]);

  // Update editable fields when task changes or modal opens
  React.useEffect(() => {
    if (isDetailOpen) {
      setEditableDescription(task.description || '');
      setEditableTitle(task.title || '');
      setEditableMarketingTasks(task.marketingTasks || []);
    }
  }, [isDetailOpen, task.description, task.title, task.marketingTasks]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Check size limit for each file
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`File ${file.name} quá lớn (tối đa 10MB)`);
        return;
      }
    }

    setIsUploading(true);
    isUploadingRef.current = true;
    const toastId = toast.loading(`Đang tải lên ${files.length} file...`);

    // Tăng timeout động theo số lượng file để tránh bị ngắt giữa chừng
    const timeoutDuration = Math.max(30000, files.length * 15000); 
    const timeoutId = setTimeout(() => {
      if (isUploadingRef.current) {
        setIsUploading(false);
        isUploadingRef.current = false;
        toast.error("Tải lên quá lâu. Vui lòng kiểm tra kết nối mạng hoặc cấu hình lưu trữ.", { id: toastId });
      }
    }, timeoutDuration); 

    try {
      let customName = undefined;
      const c = customers.find(x => x.id === task.customerId);
      if (c) {
        const codePart = c.code ? c.code.split('_')[0] : c.id.slice(0,6);
        const cleanTitle = task.title.replace(/^(Sale|Thiết kế|Sản xuất):\s*/i, '').trim();
        if (cleanTitle.toLowerCase() === c.name.toLowerCase()) {
          customName = `${codePart}_${c.name}`;
        } else {
          customName = `${codePart}_${c.name}_${cleanTitle}`;
        }
      }

      // Tải lên song song tất cả các file để tối ưu tốc độ
      const uploadPromises = files.map(async (file, i) => {
        if (!isUploadingRef.current) return null;
        const isImage = file.type.startsWith('image/');
        const fileName = files.length > 1 && customName ? `${customName}_${i+1}` : customName;
        
        try {
          if (isImage) {
            return await uploadToImgBB(file, fileName);
          } else {
            return await uploadToDropbox(file, fileName);
          }
        } catch (err) {
          console.error("Single file upload error:", err);
          return null;
        }
      });

      const results = await Promise.all(uploadPromises);
      const newUrls = results.filter((url): url is string => !!url);
      const successCount = newUrls.length;
      
      if (!isUploadingRef.current) return;

      if (newUrls.length > 0) {
        const newFiles = [...(task.files2D3D || []), ...newUrls];
        
        if (task.id.startsWith('virtual-')) {
          // Activate virtual task
          const { id, ...taskData } = task;
          await addDoc(collection(db, 'tasks'), {
            ...taskData,
            files2D3D: newFiles,
            title: task.title.startsWith('Sản xuất:') ? task.title : `Sản xuất: ${task.title}`
          });
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          toast.success("Đã kích hoạt nhiệm vụ và lưu file", { id: toastId });
        } else {
          await updateDoc(doc(db, 'tasks', task.id), { files2D3D: newFiles });
          toast.success(`Tải lên thành công ${successCount}/${files.length} file`, { id: toastId });
        }
      } else {
        toast.error("Không tải được file nào", { id: toastId });
      }
      
      clearTimeout(timeoutId);
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (!isUploadingRef.current) return;
      console.error("Upload error:", error);
      
      let errMsg = "Không thể tải lên file.";
      if (error.code === 'storage/unauthorized') {
        errMsg = "Lỗi bảo mật: Tài khoản của bạn không có quyền ghi vào Firebase Storage. Vui lòng kiểm tra lại Rules của Storage.";
      } else if (error.code === 'storage/retry-limit-exceeded' || error.message?.includes('retry') || error.message?.includes('FirebaseStorage')) {
        errMsg = "Không thể kết nối đến Firebase Storage. Vui lòng kiểm tra xem bạn đã kích hoạt dịch vụ Storage trên Firebase Console chưa.";
      } else if (error.message) {
        errMsg = `Lỗi tải file: ${error.message}`;
      }
      toast.error(errMsg, { id: toastId });
      try { handleFirestoreError(error, OperationType.UPDATE, `tasks/${task.id}`); } catch(e) {}
    } finally {
      setIsUploading(false);
      isUploadingRef.current = false;
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // reset confirm state when dialog closes
  React.useEffect(() => {
    if (!isDetailOpen) {
      setIsConfirmingDelete(false);
    }
  }, [isDetailOpen]);

  const [previewImage, setPreviewImage] = React.useState<string | null>(null);
  const [currentImageIdx, setCurrentImageIdx] = React.useState(0);
  const imageFiles = [
    ...(task.imageUrls || []),
    ...(task.files2D3D || [])
  ].filter(f => f.match(/\.(jpeg|jpg|gif|png|webp)$/i) || f.includes('i.ibb.co'));

  const handleOpenPreview = (url: string) => {
    const idx = imageFiles.indexOf(url);
    setCurrentImageIdx(idx !== -1 ? idx : 0);
    setPreviewImage(url);
  };

  const handleSaveDetail = async () => {
    if (!editableTitle.trim()) {
      toast.error("Tên công việc không được để trống");
      return;
    }
    
    setIsSaving(true);
    try {
      const commonData = {
        description: editableDescription,
        title: editableTitle,
        files2D3D: task.files2D3D || [],
        checklists: task.checklists || [],
        materialList: task.materialList || [],
        materialRequisition: task.materialRequisition || null,
        productionChecklist: task.productionChecklist || null,
        marketingTasks: editableMarketingTasks,
        updatedAt: new Date().toISOString()
      };

      if (task.id.startsWith('virtual-')) {
        const { id, ...taskData } = task;
        await addDoc(collection(db, 'tasks'), {
          ...taskData,
          ...commonData
        });
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        toast.success("Đã kích hoạt và cập nhật nhiệm vụ");
      } else {
        await updateDoc(doc(db, 'tasks', task.id), commonData);
        toast.success("Đã cập nhật nhiệm vụ");
      }
    } catch (error) {
      console.error("Save detail error:", error);
      toast.error("Không thể lưu thay đổi. Vui lòng thử lại.");
      try { handleFirestoreError(error, OperationType.UPDATE, `tasks/${task.id}`); } catch(e) {}
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveMaterial = async (formData: any) => {
    try {
      const materialList = (formData.items || [])
        .filter((item: any) => item.quantity && Number(item.quantity) > 0)
        .map((item: any) => ({
          id: String(item.id),
          name: item.name + (item.selectedOption ? ` (${item.selectedOption})` : ''),
          quantity: Number(item.quantity),
          unit: item.unit
        }));

      const hasItems = (formData.items || []).some((item: any) => item.quantity && Number(item.quantity) > 0);
      const reqStatus = hasItems ? (task.materialRequisition?.status || 'pending') : null;
      const finalRequisition = { ...formData, status: reqStatus };

      if (task.id.startsWith('virtual-')) {
        const { id, ...taskData } = task;
        await addDoc(collection(db, 'tasks'), {
          ...taskData,
          materialRequisition: finalRequisition,
          materialList: materialList
        });
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      } else {
        await updateDoc(doc(db, 'tasks', task.id), {
          materialRequisition: finalRequisition,
          materialList: materialList
        });
      }
      toast.success("Đã cập nhật phiếu lĩnh vật tư");
      setIsMaterialFormOpen(false);
    } catch (error) {
      console.error("Save material error:", error);
      toast.error("Không thể lưu phiếu vật tư");
    }
  };

  const handleSaveProductionChecklist = async (formData: any) => {
    try {
      const checklists = (formData.items || []).map((item: any) => ({
        id: item.id,
        title: item.description,
        completed: !!item.confirmedBy
      }));

      if (task.id.startsWith('virtual-')) {
        const { id, ...taskData } = task;
        await addDoc(collection(db, 'tasks'), {
          ...taskData,
          productionChecklist: formData,
          checklists: checklists,
          updatedAt: new Date().toISOString()
        });
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      } else {
        await updateDoc(doc(db, 'tasks', task.id), {
          productionChecklist: formData,
          checklists: checklists,
          updatedAt: new Date().toISOString()
        });
      }
      toast.success("Đã cập nhật tiến độ sản xuất");
      setIsProductionChecklistOpen(false);
    } catch (error) {
      console.error("Save checklist error:", error);
      try {
        handleFirestoreError(error, OperationType.WRITE, `tasks/${task.id}`);
      } catch (err) {
        // Error already logged by handleFirestoreError
      }
      toast.error("Không thể lưu tiến độ");
    }
  };

  const currentColumnIndex = columns?.findIndex(c => c.id === task.status) ?? -1;
  const canMoveLeft = currentColumnIndex > 0;
  const canMoveRight = currentColumnIndex !== -1 && currentColumnIndex < (columns?.length || 0) - 1;

  const handleMoveLeft = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canMoveLeft && onMoveTask && columns) {
      onMoveTask(task.id, columns[currentColumnIndex - 1].id as Status);
    }
  };

  const handleMoveRight = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canMoveRight && onMoveTask && columns) {
      onMoveTask(task.id, columns[currentColumnIndex + 1].id as Status);
    }
  };

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: task.id,
    data: {
      type: 'Task',
      task,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="opacity-40 border-2 border-primary rounded-xl h-[160px] bg-gray-100"
      />
    );
  }

  const priorityConfig = TASK_PRIORITY_CONFIG[task.priority];
  const StatusIcon = STATUS_ICONS[task.status as keyof typeof STATUS_ICONS] || Clock;
  const accentClass = PRIORITY_ACCENTS[task.priority as keyof typeof PRIORITY_ACCENTS] || 'before:bg-slate-300';

  const handleUpdateAssignee = async (newAssigneeId: string) => {
    setIsUpdatingAssignee(true);
    const finalAssigneeId = newAssigneeId === 'unassigned' ? '' : newAssigneeId;
    
    // Optimistic update
    queryClient.setQueryData(['tasks'], (prevTasks: Task[] = []) => 
      prevTasks.map(t => t.id === task.id ? { ...t, assigneeId: finalAssigneeId } : t)
    );

    try {
      if (!task.id.startsWith('virtual-')) {
        await updateDoc(doc(db, 'tasks', task.id), {
          assigneeId: finalAssigneeId
        });
      }
      toast.success("Đã cập nhật người thực hiện");
    } catch (error) {
      console.error("Lỗi khi cập nhật người thực hiện:", error);
      toast.error("Không thể cập nhật người thực hiện. Vui lòng thử lại.");
    } finally {
      setIsUpdatingAssignee(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const isVirtual = task.id.startsWith('virtual-');
    const actualId = isVirtual ? task.id.replace('virtual-', '') : task.id;

    // Optimistically update the UI caches
    if (isVirtual) {
      queryClient.setQueryData(['orders'], (prevOrders: any[] = []) => prevOrders.filter((o) => o.id !== actualId));
    } else {
      queryClient.setQueryData(['tasks'], (prevTasks: Task[] = []) => prevTasks.filter((t) => t.id !== task.id));
    }
    
    setIsDetailOpen(false);
    toast.success("Đã xóa nhiệm vụ");

    try {
      if (isVirtual) {
        // Delete the source order for virtual tasks
        const orderTitle = task.customerName ? `Đơn hàng: ${task.customerName}` : task.title;
        await moveToTrash('orders', actualId, orderTitle, auth.currentUser?.email || 'Người dùng');
      } else {
        // Delete the real task
        await moveToTrash('tasks', actualId, task.title, auth.currentUser?.email || 'Người dùng');
      }
    } catch (error) {
      console.error("Lỗi khi xóa ở server:", error);
      toast.error("Không thể xóa nhiệm vụ từ máy chủ. Vui lòng kiểm tra quyền hạn.");
      try {
        handleFirestoreError(error, OperationType.DELETE, isVirtual ? `orders/${actualId}` : `tasks/${actualId}`);
      } catch (e) {}
    }
  };

  return (
    <>
      {dialogOnly ? null : renderAsTextOnly ? (
        <span 
          onClick={() => setIsDetailOpen(true)}
          className="cursor-pointer hover:underline text-primary font-medium"
        >
          {task.title}
        </span>
      ) : (
      <Card
        ref={setNodeRef}
        style={style}
        className={cn(
          "group shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer bg-card text-card-foreground border border-slate-200 rounded-xl active:scale-[0.98] min-h-[140px] relative overflow-hidden mx-0.5 my-0.5",
          "before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[4px] before:rounded-l-xl",
          accentClass
        )}
        onClick={() => setIsDetailOpen(true)}
      >
        <CardHeader className="p-3 pb-1 space-y-0 flex flex-row items-start justify-between">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className={cn(
                "text-[7px] md:text-[9px] uppercase font-bold px-1.5 py-0 rounded-sm border-none shrink-0", 
                priorityConfig.color
              )}>
                {priorityConfig.label}
              </Badge>
              {task.workshop && (
                <Badge variant="secondary" className="text-[7px] md:text-[9px] uppercase font-bold px-1.5 py-0 rounded-sm border-none bg-slate-100 text-slate-500 shrink-0">
                  {getWorkshopName(task.workshop)}
                </Badge>
              )}
            </div>
            <CardTitle className="text-[11px] md:text-[12px] font-bold leading-tight group-hover:text-primary transition-colors tracking-tight flex items-start gap-1.5 mt-1">
              <StatusIcon className="h-3 w-3 shrink-0 text-primary/60 mt-0.5" />
              <span className="line-clamp-1">{task.title}</span>
            </CardTitle>
          </div>
          <div 
            {...attributes} 
            {...listeners} 
            className="cursor-grab active:cursor-grabbing p-1.5 text-muted-foreground/30 hover:text-primary shrink-0 transition-colors -mr-1"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-1 space-y-2">
          {imageFiles.length > 0 && (
            <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-slate-100 mb-2 group/thumb">
              <img 
                src={imageFiles[0]} 
                alt="thumbnail" 
                className="w-full h-full object-cover transition-transform duration-500 group-hover/thumb:scale-110" 
                referrerPolicy="no-referrer"
              />
              {imageFiles.length > 1 && (
                <div className="absolute bottom-1 right-1 bg-black/50 text-white text-[8px] px-1 rounded backdrop-blur-sm">
                  +{imageFiles.length - 1}
                </div>
              )}
            </div>
          )}
          
          {task.description && (
            <div className="bg-slate-50/50 p-2 rounded-lg border border-slate-100/50">
              <p className="text-[9px] md:text-[10px] text-slate-500 leading-relaxed line-clamp-2 italic">
                {task.description?.replace(/^Tiếp nhận thông tin từ hợp đồng (mới của )?khách hàng [^.]*\.\s*/i, '')?.trim()}
              </p>
            </div>
          )}

          {task.type === 'marketing' && task.marketingTasks && task.marketingTasks.length > 0 && (() => {
            const totalTarget = task.marketingTasks.reduce((sum, item) => sum + (item.targetQuantity || 0), 0);
            const totalCompleted = task.marketingTasks.reduce((sum, item) => sum + (item.completedQuantity || 0), 0);
            const progressPercent = totalTarget > 0 ? Math.round((totalCompleted / totalTarget) * 100) : 0;
            return (
              <div className="space-y-1.5 bg-slate-50 p-2 rounded-lg border border-slate-100/70 mt-1">
                <div className="flex items-center justify-between text-[9px] font-bold text-slate-600">
                  <span className="truncate">Tiến độ MKT</span>
                  <span className="font-mono text-primary font-bold">{totalCompleted}/{totalTarget} ({progressPercent}%)</span>
                </div>
                <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                </div>
                <div className="flex flex-wrap gap-1 max-h-[36px] overflow-hidden">
                  {task.marketingTasks.map((item, idx) => (
                    <Badge key={idx} variant="outline" className="text-[8px] px-1.5 py-0 bg-white text-slate-500 border-slate-200 truncate max-w-[80px]">
                      {item.title}: {item.completedQuantity}/{item.targetQuantity}
                    </Badge>
                  ))}
                </div>
              </div>
            );
          })()}
          
          <div className="flex items-center justify-between pt-1">
            <div className="flex gap-1 flex-wrap">
              <div className="flex items-center gap-1.5 text-slate-500 bg-card text-card-foreground px-2 py-0.5 rounded-full border border-slate-200 shadow-sm shrink-0" title="Ngày dự kiến">
                <Calendar className="h-2.5 w-2.5 text-primary/60" />
                <span className="text-[8px] md:text-[9px] font-bold font-mono">
                  {format(new Date(task.dueDate), 'dd/MM/yy')}
                </span>
              </div>
              
              {installDate && (
                <div className="flex items-center gap-1.5 text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200 shadow-sm shrink-0" title="Ngày lắp đặt">
                  <Wrench className="h-2.5 w-2.5" />
                  <span className="text-[8px] md:text-[9px] font-bold font-mono">
                    {format(new Date(installDate), 'dd/MM/yy')}
                  </span>
                </div>
              )}
            </div>
            
            <div className="flex items-center -space-x-1.5 shrink-0">
              {task.files2D3D && task.files2D3D.length > 0 && (
                <div className="h-5 w-5 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-primary relative z-10 shadow-sm" title="Bản vẽ">
                  <FileText className="h-2.5 w-2.5" />
                </div>
              )}
              {task.imageUrls && task.imageUrls.length > 0 && (
                <div className="h-5 w-5 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 relative z-20 shadow-sm" title="Ảnh hiện trạng">
                  <Image className="h-2.5 w-2.5" />
                </div>
              )}
              {assignee && (
                <Avatar className="h-6 w-6 border-2 border-white shadow-sm shrink-0 bg-slate-200 relative z-30">
                  <AvatarImage src={assignee.avatar} />
                  <AvatarFallback className="text-[8px] font-bold">{assignee.name.charAt(0)}</AvatarFallback>
                </Avatar>
              )}
            </div>
          </div>

          {/* Tối ưu Chuyển bước - Subtle Navigation */}
          <div className="flex items-center justify-between gap-1 pt-2 md:pt-1 border-t border-slate-100 mt-1 bg-slate-50/30 -mx-3 -mb-3 px-3 py-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 rounded-full hover:bg-card text-card-foreground hover:shadow-sm hover:text-primary transition-all active:scale-95 disabled:opacity-10"
              onClick={handleMoveLeft}
              disabled={!canMoveLeft}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex items-center gap-1.5 px-3 py-1 bg-card text-card-foreground/80 backdrop-blur-sm rounded-full border border-slate-200/50 shadow-xs">
               <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                Bước
              </span>
              <div className="flex gap-1">
                {columns.map((col, idx) => (
                  <div 
                    key={col.id} 
                    className={cn(
                      "h-1 w-1 rounded-full",
                      col.id === task.status ? "bg-primary scale-150 shadow-[0_0_8px_rgba(var(--primary),0.4)]" : "bg-slate-200"
                    )} 
                  />
                ))}
              </div>
            </div>

            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 rounded-full hover:bg-card text-card-foreground hover:shadow-sm hover:text-primary transition-all active:scale-95 disabled:opacity-10"
              onClick={handleMoveRight}
              disabled={!canMoveRight}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
      )}

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-[500px] gap-0 p-0 overflow-hidden outline-none border-none shadow-2xl">
          <DialogHeader className="p-6 pb-4 bg-gray-50 border-b">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn(
                    "text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border-none", 
                    priorityConfig.color
                  )}>
                    {priorityConfig.label}
                  </Badge>
                  {task.workshop && (
                    <Badge variant="secondary" className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border-none ring-1 ring-border/50 bg-gray-100">
                      {getWorkshopName(task.workshop) || 'Chưa gán cơ sở'}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {isConfirmingDelete ? (
                    <div className="flex gap-1 items-center bg-destructive/10 p-1 rounded-md shrink-0">
                      <Button variant="destructive" size="sm" className="h-7 text-[10px] px-2" onClick={handleDelete}>Xóa</Button>
                      <Button variant="outline" size="sm" className="h-7 text-[10px] px-2 bg-background" onClick={() => setIsConfirmingDelete(false)}>Hủy</Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0" onClick={() => setIsConfirmingDelete(true)} title="Xóa nhiệm vụ">
                       <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground/60">
                  <StatusIcon className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-medium uppercase tracking-wider">
                    {task.status === 'waiting_install' ? 'Chờ Lắp Đặt' : (TASK_STATUS_CONFIG[task.status as keyof typeof TASK_STATUS_CONFIG]?.label || task.status)}
                  </span>
                </div>
                <Input 
                  value={editableTitle}
                  onChange={(e) => setEditableTitle(e.target.value)}
                  placeholder="Tiêu đề công việc..."
                  className="text-xl font-bold border-none bg-transparent p-0 h-auto focus-visible:ring-1 focus-visible:ring-primary/20 rounded-md px-1 -ml-1 transition-all"
                />
              </div>
            </div>
          </DialogHeader>
          
          <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6 scrollbar-hide">
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <FileText className="h-3.5 w-3.5" />
                Mô tả công việc
              </h4>
              <Textarea 
                value={editableDescription}
                onChange={(e) => setEditableDescription(e.target.value)}
                placeholder="Nhập mô tả chi tiết cho công việc này..."
                className="text-sm min-h-[120px] bg-gray-50 border-none focus-visible:ring-1 focus-visible:ring-primary/30 resize-none rounded-xl p-3 leading-relaxed"
              />
            </div>

            {((allMeasurementImages && allMeasurementImages.length > 0) || linkedMeasurement?.notes) && (
              <div className="border-t pt-4 space-y-3">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                  Thông tin đo đạc (từ Sale)
                </label>
                {linkedMeasurement?.notes && (
                  <div className="text-sm bg-blue-50/50 p-3 rounded-lg border border-blue-100 italic text-muted-foreground whitespace-pre-wrap">
                    {linkedMeasurement.notes}
                  </div>
                )}
                {allMeasurementImages.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {allMeasurementImages.map((url, i) => (
                      <div 
                        key={i} 
                        className="aspect-square relative cursor-pointer group/sale-img"
                        onClick={() => handleOpenPreview(url)}
                      >
                      <img 
                        src={url} 
                        alt={`Sale file ${i}`} 
                        className="w-full h-full object-cover rounded-lg border shadow-sm group-hover/sale-img:scale-[1.02] transition-transform duration-200" 
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ))}
                </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 border-t pt-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ngày hết hạn</label>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Calendar className="h-4 w-4 text-primary" />
                  {format(new Date(task.dueDate), 'dd/MM/yyyy')}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mức độ ưu tiên</label>
                <Select
                  value={task.priority}
                  onValueChange={async (newPriority: 'low'|'medium'|'high') => {
                    try {
                      if (task.id.startsWith('virtual-')) {
                        const { id, ...taskData } = task;
                        await addDoc(collection(db, 'tasks'), {
                          ...taskData,
                          priority: newPriority,
                          title: task.title.startsWith('Sản xuất:') ? task.title : `Sản xuất: ${task.title}`
                        });
                        queryClient.invalidateQueries({ queryKey: ['tasks'] });
                        toast.success("Đã kích hoạt và cập nhật mức độ ưu tiên");
                      } else {
                        queryClient.setQueryData(['tasks'], (prevTasks: Task[] = []) => 
                          prevTasks.map(t => t.id === task.id ? { ...t, priority: newPriority } : t)
                        );
                        await updateDoc(doc(db, 'tasks', task.id), { priority: newPriority });
                        toast.success("Đã cập nhật mức độ ưu tiên");
                      }
                    } catch (err) {
                      toast.error("Lỗi khi cập nhật mức độ ưu tiên");
                    }
                  }}
                >
                  <SelectTrigger className="h-9 w-full bg-background">
                    <SelectValue>
                      {task.priority === 'high' ? 'CAO (GẤP)' : task.priority === 'low' ? 'THẤP' : 'TRUNG BÌNH'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">THẤP</SelectItem>
                    <SelectItem value="medium">TRUNG BÌNH</SelectItem>
                    <SelectItem value="high">CAO (GẤP)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {members.length > 0 && (
              <div className="border-t pt-4 space-y-3">
                 <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Người thực hiện</label>
                 <Select 
                   value={task.assigneeId || 'unassigned'} 
                   onValueChange={handleUpdateAssignee}
                   disabled={isUpdatingAssignee}
                 >
                   <SelectTrigger className="h-12 rounded-xl ring-offset-background focus:ring-1 focus:ring-primary">
                     <div className="flex items-center gap-2 overflow-hidden overflow-ellipsis">
                       {task.assigneeId && task.assigneeId !== 'unassigned' && members.find(m => m.id === task.assigneeId) ? (
                         <>
                           <Avatar className="h-6 w-6 shrink-0">
                             <AvatarImage src={members.find(m => m.id === task.assigneeId)?.avatar} />
                             <AvatarFallback>{members.find(m => m.id === task.assigneeId)?.name.charAt(0)}</AvatarFallback>
                           </Avatar>
                           <span className="truncate font-medium">{members.find(m => m.id === task.assigneeId)?.name}</span>
                         </>
                       ) : (
                         <span className="text-muted-foreground">Chọn người thực hiện</span>
                       )}
                     </div>
                   </SelectTrigger>
                   <SelectContent align="end" className="w-[280px]">
                     <SelectItem value="unassigned" className="text-muted-foreground italic">Chưa gán</SelectItem>
                     {members.map(m => (
                       <SelectItem key={m.id} value={m.id}>
                         <div className="flex items-center gap-3 py-1">
                           <Avatar className="h-7 w-7">
                             <AvatarImage src={m.avatar} />
                             <AvatarFallback className="text-[10px]">{m.name.charAt(0)}</AvatarFallback>
                           </Avatar>
                           <div className="flex flex-col text-left">
                             <span className="text-sm font-bold leading-tight">{m.name}</span>
                             <span className="text-[10px] text-muted-foreground">{m.role}</span>
                           </div>
                         </div>
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
              </div>
            )}

            {task.type !== 'marketing' && (
              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">File 2D-3D</label>
                  <div className="flex gap-2">
                     <input 
                       type="file" 
                       multiple
                       ref={fileInputRef} 
                       className="hidden" 
                       onChange={handleFileUpload}
                       accept="image/*,application/pdf"
                     />
                     <Button 
                       size="sm" 
                       variant="outline" 
                       className="h-7 text-[10px] gap-1"
                       disabled={isUploading}
                       onClick={() => fileInputRef.current?.click()}
                     >
                       {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                       Tải lên Ảnh/PDF
                     </Button>
                  </div>
                </div>
                {task.files2D3D && task.files2D3D.length > 0 ? (
                  <ul className="space-y-2">
                    {task.files2D3D.map((f, i) => {
                      const isImg = f.match(/\.(jpeg|jpg|gif|png|webp)$/i) || f.includes('i.ibb.co');
                      return (
                        <li key={i} className="flex items-center justify-between bg-card p-2 rounded-xl border border-border shadow-sm group">
                          <div 
                            className="flex items-center gap-3 flex-1 min-w-0 pr-2 cursor-pointer group/item"
                            onClick={() => isImg ? handleOpenPreview(f) : window.open(f, '_blank')}
                          >
                            {isImg ? (
                              <div className="h-10 w-10 rounded-lg border overflow-hidden shrink-0 bg-gray-100 group-hover/item:ring-2 ring-primary/30 transition-all">
                                <img src={f} alt="preview" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                              </div>
                            ) : (
                              <div className="h-10 w-10 rounded-lg border flex items-center justify-center shrink-0 bg-gray-100">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex flex-col min-w-0">
                              <span 
                                className="text-xs font-bold text-primary group-hover/item:underline truncate"
                                title={f}
                              >
                                {f.split('/').pop() || `File ${i+1}`}
                              </span>
                              <span className="text-[9px] text-muted-foreground truncate uppercase tracking-tighter">
                                {isImg ? 'Bấm để xem ảnh' : 'Tài liệu / Link'}
                              </span>
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-destructive rounded-full hover:bg-destructive/10 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" 
                            onClick={async () => {
                              const newFiles = task.files2D3D?.filter((_, idx) => idx !== i) || [];
                              try {
                                await updateDoc(doc(db, 'tasks', task.id), { files2D3D: newFiles });
                                toast.success("Đã xóa file");
                              } catch (e) {
                                toast.error("Không thể xóa file");
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                ) : <p className="text-sm text-muted-foreground italic pl-1">Chưa có file kèm theo</p>}
                
                <div className="flex gap-2">
                  <Input 
                    placeholder="Dán link file..." 
                    className="h-9 text-xs rounded-lg" 
                    value={newFileLinkDetail} 
                    onChange={(e) => setNewFileLinkDetail(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newFileLinkDetail) {
                          const newFiles = [...(task.files2D3D || []), newFileLinkDetail];
                          try {
                            if (task.id.startsWith('virtual-')) {
                               const { id, ...taskData } = task;
                               await addDoc(collection(db, 'tasks'), { 
                                 ...taskData, 
                                 files2D3D: newFiles,
                                 title: task.title.startsWith('Sản xuất:') ? task.title : `Sản xuất: ${task.title}`
                               });
                               queryClient.invalidateQueries({ queryKey: ['tasks'] });
                               toast.success("Đã kích hoạt và thêm file");
                            } else {
                              await updateDoc(doc(db, 'tasks', task.id), { files2D3D: newFiles });
                              toast.success("Đã thêm file");
                            }
                            setNewFileLinkDetail('');
                          } catch (err) {
                            toast.error("Không thể thêm file");
                          }
                        }
                      }
                    }}
                  />
                  <Button size="sm" variant="outline" className="h-9 shrink-0" onClick={async () => {
                     if (newFileLinkDetail) {
                      const newFiles = [...(task.files2D3D || []), newFileLinkDetail];
                      try {
                        if (task.id.startsWith('virtual-')) {
                          const { id, ...taskData } = task;
                          await addDoc(collection(db, 'tasks'), { 
                            ...taskData, 
                            files2D3D: newFiles,
                            title: task.title.startsWith('Sản xuất:') ? task.title : `Sản xuất: ${task.title}`
                          });
                          queryClient.invalidateQueries({ queryKey: ['tasks'] });
                          toast.success("Đã kích hoạt và thêm file");
                        } else {
                          await updateDoc(doc(db, 'tasks', task.id), { files2D3D: newFiles });
                          toast.success("Đã thêm file");
                        }
                        setNewFileLinkDetail('');
                      } catch (err) {
                        toast.error("Không thể thêm file");
                      }
                    }
                  }}>Thêm</Button>
                </div>
              </div>
            )}



            {task.type !== 'marketing' && (
              <div className="border-t pt-4 space-y-3">
                 <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tiến độ sản xuất chi tiết</label>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 text-[10px] gap-1.5 font-bold"
                      onClick={() => setIsProductionChecklistOpen(true)}
                    >
                      <Plus className="h-3 w-3" />
                      Bản khai tiến độ
                    </Button>
                 </div>
                 {task.productionChecklist ? (
                    <div 
                      className="bg-primary/5 p-3 rounded-xl border border-primary/20 flex items-center justify-between cursor-pointer hover:bg-primary/10 transition-all shadow-sm"
                      onClick={() => setIsProductionChecklistOpen(true)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground truncate max-w-[200px]">
                            {task.productionChecklist.projectName || task.title}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
                            Đã khởi tạo bản khai tiến độ
                          </p>
                        </div>
                      </div>
                      <Button variant="link" className="h-auto p-0 text-[10px] text-primary font-bold">XỬ LÝ</Button>
                    </div>
                 ) : (
                  <div 
                    className="flex flex-col items-center justify-center py-6 bg-secondary/5 border border-dashed rounded-xl cursor-pointer hover:bg-secondary/10 transition-colors group"
                    onClick={() => setIsProductionChecklistOpen(true)}
                  >
                     <CheckCircle2 className="h-6 w-6 text-muted-foreground/30 mb-1 group-hover:text-primary/40 transition-colors" />
                     <p className="text-[10px] text-muted-foreground italic font-medium">Chưa có checklist tiến độ chi tiết</p>
                  </div>
                 )}
              </div>
            )}

            {task.type === 'marketing' && (
              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Megaphone className="h-3.5 w-3.5 text-primary animate-pulse" />
                    Hạng mục Marketing chi tiết
                  </h4>
                  <div className="flex gap-1.5">
                    <Button
                      variant="outline"
                      type="button"
                      size="sm"
                      className="h-6 text-[9px] px-2 bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary font-bold"
                      onClick={() => {
                        const defaultItems = ["Tạo ảnh", "Đăng bài website", "Chụp ảnh"];
                        const currentTitles = editableMarketingTasks.map(x => x.title.toLowerCase());
                        const newTasks = [...editableMarketingTasks];
                        defaultItems.forEach(title => {
                          if (!currentTitles.includes(title.toLowerCase())) {
                            newTasks.push({
                              id: Date.now().toString() + '_' + Math.random().toString(36).substring(2, 5),
                              title: title,
                              targetQuantity: 10,
                              completedQuantity: 0
                            });
                          }
                        });
                        setEditableMarketingTasks(newTasks);
                        toast.success("Đã thêm nhanh các hạng mục cơ bản");
                      }}
                    >
                      Khởi tạo nhanh
                    </Button>
                    <Button 
                      variant="outline" 
                      type="button"
                      size="sm" 
                      className="h-6 text-[9px] px-2 gap-1"
                      onClick={() => {
                        setEditableMarketingTasks(prev => [
                          ...prev,
                          {
                            id: Date.now().toString() + '_' + Math.random().toString(36).substring(2, 5),
                            title: 'Nhiệm vụ mới',
                            targetQuantity: 5,
                            completedQuantity: 0
                          }
                        ]);
                      }}
                    >
                      <Plus className="h-2.5 w-2.5" />
                      Thêm thủ công
                    </Button>
                  </div>
                </div>

                {editableMarketingTasks.length > 0 ? (() => {
                  const totalTarget = editableMarketingTasks.reduce((sum, item) => sum + (item.targetQuantity || 0), 0);
                  const totalCompleted = editableMarketingTasks.reduce((sum, item) => sum + (item.completedQuantity || 0), 0);
                  const progressPercent = totalTarget > 0 ? Math.round((totalCompleted / totalTarget) * 100) : 0;
                  return (
                    <div className="space-y-3 bg-slate-50/50 p-3 rounded-xl border border-border">
                      <div className="space-y-1 bg-white p-2.5 rounded-lg border border-border/60">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                          <span>Tổng tiến độ Marketing</span>
                          <span className="text-primary font-mono font-bold">{totalCompleted}/{totalTarget} ({progressPercent}%)</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                        </div>
                      </div>

                      <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                        {editableMarketingTasks.map((item, index) => {
                          const itemProgress = item.targetQuantity > 0 ? Math.round((item.completedQuantity / item.targetQuantity) * 100) : 0;
                          return (
                            <div key={item.id} className="bg-white p-2.5 rounded-lg border border-border/50 space-y-2 group/mkt-item relative">
                              <div className="flex items-center gap-2">
                                <Input 
                                  value={item.title}
                                  onChange={(e) => {
                                    const newTasks = [...editableMarketingTasks];
                                    newTasks[index].title = e.target.value;
                                    setEditableMarketingTasks(newTasks);
                                  }}
                                  placeholder="Tên nhiệm vụ..."
                                  className="h-8 text-xs font-bold flex-1 border-none bg-slate-50/30 focus-visible:ring-1 focus-visible:ring-primary/20 px-2 py-1 rounded"
                                />
                                <Button
                                  variant="ghost"
                                  type="button"
                                  size="icon"
                                  className="h-7 w-7 text-destructive rounded-full hover:bg-destructive/10 shrink-0 opacity-0 group-hover/mkt-item:opacity-100 transition-opacity"
                                  onClick={() => {
                                    setEditableMarketingTasks(prev => prev.filter(x => x.id !== item.id));
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                              <div className="flex items-center justify-between gap-4 text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground text-[10px] uppercase font-bold shrink-0">Đã làm:</span>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={item.completedQuantity}
                                    onChange={(e) => {
                                      const newTasks = [...editableMarketingTasks];
                                      newTasks[index].completedQuantity = Math.max(0, parseInt(e.target.value) || 0);
                                      setEditableMarketingTasks(newTasks);
                                    }}
                                    className="w-16 h-7 text-xs font-bold text-center border-slate-200 focus-visible:ring-1"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground text-[10px] uppercase font-bold shrink-0">Mục tiêu:</span>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={item.targetQuantity}
                                    onChange={(e) => {
                                      const newTasks = [...editableMarketingTasks];
                                      newTasks[index].targetQuantity = Math.max(1, parseInt(e.target.value) || 1);
                                      setEditableMarketingTasks(newTasks);
                                    }}
                                    className="w-16 h-7 text-xs font-bold text-center border-slate-200 focus-visible:ring-1"
                                  />
                                </div>
                                <Badge variant="secondary" className="font-mono text-[10px] py-0.5 px-2 bg-emerald-50 text-emerald-700 border-none">
                                  {itemProgress}%
                                </Badge>
                              </div>
                              <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-400 rounded-full transition-all duration-300" style={{ width: `${itemProgress}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })() : (
                  <div className="flex flex-col items-center justify-center py-6 bg-secondary/5 border border-dashed rounded-xl">
                    <Megaphone className="h-5 w-5 text-muted-foreground/30 mb-1" />
                    <p className="text-[10px] text-muted-foreground italic font-medium">Chưa khởi tạo nhiệm vụ marketing nào</p>
                  </div>
                )}
              </div>
            )}

            <div className="border-t pt-4 space-y-3">
               <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Phiếu lĩnh NVL - CCDC</label>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-7 text-[10px] gap-1.5 font-bold"
                    onClick={() => setIsMaterialFormOpen(true)}
                  >
                    <Plus className="h-3 w-3" />
                    Lập phiếu vật tư
                  </Button>
               </div>
               {task.materialRequisition && task.materialRequisition.items && task.materialRequisition.items.filter((m: any) => m.quantity).length > 0 ? (
                 <div className="bg-secondary/20 p-3 rounded-xl border border-border/50">
                    <ul className="space-y-1.5 text-[11px]">
                      {task.materialRequisition.items.filter((m: any) => m.quantity).map((m: any) => (
                        <li key={m.id} className="flex justify-between items-center border-b border-white/10 pb-1 last:border-0 last:pb-0">
                          <span className="font-medium text-muted-foreground">{m.name} {m.selectedOption ? `(${m.selectedOption})` : ''}</span>
                          <span className="font-bold text-primary">{m.quantity} {m.unit}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 pt-2 border-t border-white/20 flex justify-between items-center font-bold text-[10px] uppercase text-muted-foreground">
                      <span>Người nhận: {task.materialRequisition.receiver || '...'}</span>
                      <Button variant="link" className="h-auto p-0 text-[10px] text-primary" onClick={() => setIsMaterialFormOpen(true)}>Xem chi tiết</Button>
                    </div>
                 </div>
               ) : (
                 <div 
                   className="flex flex-col items-center justify-center py-6 bg-secondary/5 border border-dashed rounded-xl cursor-pointer hover:bg-secondary/10 transition-colors"
                   onClick={() => setIsMaterialFormOpen(true)}
                 >
                    <Package className="h-5 w-5 text-muted-foreground/30 mb-1" />
                    <p className="text-[10px] text-muted-foreground italic font-medium">Chưa có phiếu lĩnh vật tư</p>
                 </div>
               )}
            </div>

            {!members.length && assignee && (
              <div className="border-t pt-4 space-y-2">
                 <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Người thực hiện</label>
                 <div className="flex items-center gap-3 bg-secondary/30 p-2 rounded-xl">
                    <Avatar className="h-8 w-8">
                       <AvatarImage src={assignee.avatar} />
                       <AvatarFallback>{assignee.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium leading-none">{assignee.name}</span>
                      <span className="text-xs text-muted-foreground mt-1">{assignee.role}</span>
                    </div>
                 </div>
              </div>
            )}

          </div>

          <DialogFooter className="p-6 bg-secondary/10 border-t flex flex-row items-center justify-between gap-3 sm:justify-between">
            <p className="text-[10px] text-muted-foreground italic font-medium">
              Cập nhật: {new Date().toLocaleDateString('vi-VN')}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsDetailOpen(false)} disabled={isSaving} className="h-9 px-6 rounded-xl text-xs font-bold border-2">Thoát</Button>
              <Button 
                onClick={handleSaveDetail} 
                disabled={isSaving}
                className="h-9 px-8 rounded-xl text-xs font-bold shadow-xl shadow-primary/30 bg-primary hover:bg-primary/90 text-primary-foreground transition-all active:scale-95 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
                Lưu thay đổi
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isMaterialFormOpen} onOpenChange={setIsMaterialFormOpen}>
        <DialogContent className="max-w-[95vw] lg:max-w-6xl h-[85vh] overflow-hidden flex flex-col p-0 rounded-2xl border-none shadow-2xl">
          <div className="flex-1 overflow-hidden h-full">
            <MaterialRequisitionForm 
              projectTitle={task.title}
              data={task.materialRequisition}
              customerInfo={customers.find(c => c.id === task.customerId)}
              members={members}
              onSave={handleSaveMaterial}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isProductionChecklistOpen} onOpenChange={setIsProductionChecklistOpen}>
        <DialogContent className="max-w-[95vw] lg:max-w-6xl h-[90vh] overflow-hidden flex flex-col p-0 rounded-2xl border-none shadow-2xl">
          <div className="flex-1 overflow-hidden h-full">
            <ProductionChecklistForm 
              taskTitle={task.title}
              data={task.productionChecklist}
              customerInfo={customers.find(c => c.id === task.customerId)}
              onSave={handleSaveProductionChecklist}
            />
          </div>
        </DialogContent>
      </Dialog>

      <ImagePreviewDialog 
        isOpen={!!previewImage}
        onClose={() => setPreviewImage(null)}
        imageUrl={previewImage}
        allImages={imageFiles}
        currentIdx={currentImageIdx}
        onNavigate={(idx) => {
          setCurrentImageIdx(idx);
          setPreviewImage(imageFiles[idx]);
        }}
      />
    </>
  );
});
