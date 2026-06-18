import * as React from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { useQueryClient } from '@tanstack/react-query';
import { Task, Status, Member, Customer, WORKSHOPS, getWorkshopName } from '@/src/types';
import { KanbanColumn } from './KanbanColumn';
import { TaskCard } from './TaskCard';
import { createPortal } from 'react-dom';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Plus, Filter, Search, Calendar, ChevronLeft, ChevronRight, Upload, Loader2, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Settings } from 'lucide-react';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from "sonner";
import { db, collection, addDoc, updateDoc, doc, handleFirestoreError, OperationType, query, where, getDocs, storage, ref, uploadBytes, getDownloadURL, setDoc, serverTimestamp, auth } from '@/src/lib/firebase';
import { uploadToImgBB } from '@/src/services/uploadService';
import { ImagePreviewDialog } from '@/src/components/ui/ImagePreviewDialog';
import { writeBatch } from 'firebase/firestore';
import { notifyManagers } from '@/src/services/notificationService';

import { getCurrentVNMonth, getCurrentVNDateString, getVNMonth, getVNTimestamp } from '@/src/lib/utils';
interface KanbanBoardProps {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  members: Member[];
  customers?: Customer[];
  type?: 'production' | 'design' | 'sale' | 'marketing' | 'general';
  hideChecklist?: boolean;
  user?: any;
  currentUser?: any;
}

const DEFAULT_COLUMNS: { id: Status; title: string }[] = [
  { id: 'todo', title: 'Chờ xử lý' },
  { id: 'in-progress', title: 'Đang sản xuất' },
  { id: 'waiting_install', title: 'Chờ Lắp Đặt' },
];

const DESIGN_COLUMNS: { id: Status; title: string }[] = [
  { id: 'todo', title: 'Tiếp nhận thông tin' },
  { id: 'in-progress', title: 'Lên bản vẽ 3D/2D' },
  { id: 'review', title: 'Chờ duyệt thiết kế' },
  { id: 'done', title: 'Hoàn tất thiết kế' },
];

const SALE_COLUMNS: { id: Status; title: string }[] = [
  { id: 'todo', title: 'Tiếp nhận Lead' },
  { id: 'in-progress', title: 'Tư vấn & Báo giá' },
  { id: 'review', title: 'Chốt đơn & Cọc' },
  { id: 'done', title: 'Bàn giao Kỹ thuật' },
];

const MARKETING_COLUMNS: { id: Status; title: string }[] = [
  { id: 'todo', title: 'Lên ý tưởng' },
  { id: 'in-progress', title: 'Sản xuất nội dung' },
  { id: 'review', title: 'Triển khai/Chạy Ads' },
  { id: 'done', title: 'Đo lường & Tối ưu' },
];

export function KanbanBoard({ tasks, setTasks, members, customers, type = 'production', hideChecklist = false, user, currentUser, ...props }: KanbanBoardProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [previewImage, setPreviewImage] = React.useState<string | null>(null);
  const [currentImageIdx, setCurrentImageIdx] = React.useState(0);
  
  // Remove storedImgbbKey logic as we use the service now

  const getColumns = () => {
    switch (type) {
      case 'design': return DESIGN_COLUMNS;
      case 'sale': return SALE_COLUMNS;
      case 'marketing': return MARKETING_COLUMNS;
      default: return DEFAULT_COLUMNS;
    }
  };

  const columns = getColumns();
  const [selectedMonth, setSelectedMonth] = React.useState<string>(() => getCurrentVNMonth());
  const [selectedWorkshop, setSelectedWorkshop] = React.useState(
    currentUser?.workshop && currentUser?.workshop !== 'all' ? currentUser.workshop : 'all'
  );
  const [activeTask, setActiveTask] = React.useState<Task | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [showMonthPicker, setShowMonthPicker] = React.useState(false); // State for picker
  const pickerRef = React.useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowMonthPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Archive old completed tasks
  React.useEffect(() => {
    const archiveOldCompletedTasks = async () => {
      if (!user) return; // Only archive in Firebase
      
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      
      const tasksToArchive = tasks.filter(t => 
        t.status === 'done' && 
        t.completedAt && 
        new Date(t.completedAt) < tenDaysAgo
      );

      if (tasksToArchive.length > 0) {
        for (const task of tasksToArchive) {
          try {
            await updateDoc(doc(db, 'tasks', task.id), { status: 'archived' });
          } catch (err) {
            console.error('Error archiving task:', task.id, err);
          }
        }
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      }
    };
    
    archiveOldCompletedTasks();
  }, [tasks, user]);

  const [newTask, setNewTask] = React.useState({
    title: '',
    description: '',
    assigneeId: members[0]?.id || '',
    priority: 'medium' as const,
    status: 'todo' as const,
    workshop: currentUser?.workshop && currentUser?.workshop !== 'all' ? currentUser.workshop : WORKSHOPS[1].id,
  });

  const [pendingTransition, setPendingTransition] = React.useState<{
    taskId: string;
    newStatus: Status;
    workflowType: 'sale-to-design' | 'design-to-production';
    targetAssigneeId: string;
    fileLinks?: string[];
  } | null>(null);

  const transitionImageFiles = pendingTransition?.fileLinks?.filter(f => f.match(/\.(jpeg|jpg|gif|png|webp)$/i) || f.includes('i.ibb.co')) || [];

  const handleOpenPreview = (url: string) => {
    const idx = transitionImageFiles.indexOf(url);
    setCurrentImageIdx(idx !== -1 ? idx : 0);
    setPreviewImage(url);
  };

  const [newFileLink, setNewFileLink] = React.useState('');
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const isUploadingRef = React.useRef(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Giới hạn 10MB
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`File ${file.name} quá lớn (tối đa 10MB)`);
        return;
      }
    }

    setIsUploading(true);
    isUploadingRef.current = true;
    const toastId = toast.loading(`Đang tải lên ${files.length} file...`);
    
    const timeoutId = setTimeout(() => {
      if (isUploadingRef.current) {
        setIsUploading(false);
        isUploadingRef.current = false;
        toast.error("Tải lên quá lâu. Vui lòng kiểm tra kết nối mạng.", { id: toastId });
      }
    }, 60000); 

    try {
      let customName = undefined;
        
      if (pendingTransition?.taskId) {
         const t = tasks.find(x => x.id === pendingTransition.taskId);
         const c = customers?.find(x => x.id === t?.customerId);
         if (t && c) {
           const code = c.code || c.id.slice(0,6);
           const cleanTitle = t.title.replace(/^(Sale|Thiết kế|Sản xuất):\s*/i, '');
           customName = `${code}_${c.name}_${cleanTitle}`;
         }
      }

      const newUrls: string[] = [];
      let successCount = 0;

      for (let i = 0; i < files.length; i++) {
        if (!isUploadingRef.current) break;
        const file = files[i];
        const isImage = file.type.startsWith('image/');
        let downloadURL = "";
        
        const fileName = files.length > 1 && customName ? `${customName}_${i+1}` : customName;

        if (isImage) {
          const url = await uploadToImgBB(file, fileName);
          if (url) {
            downloadURL = url;
            successCount++;
          }
        } else {
          const storageRef = ref(storage, `tasks/${Date.now()}_${file.name}`);
          const uploadTask = await uploadBytes(storageRef, file);
          downloadURL = await getDownloadURL(uploadTask.ref);
          if (downloadURL) successCount++;
        }
        
        if (downloadURL) {
          newUrls.push(downloadURL);
        }
      }
      
      if (!isUploadingRef.current) return;

      if (newUrls.length > 0) {
        setPendingTransition(prev => prev ? ({ 
          ...prev, 
          fileLinks: [...(prev.fileLinks || []), ...newUrls] 
        }) : null);
        toast.success(`Tải lên thành công ${successCount}/${files.length} file!`, { id: toastId });
      } else {
        toast.error("Không thể tải lên file nào.", { id: toastId });
      }
      
      clearTimeout(timeoutId);
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (!isUploadingRef.current) return;
      console.error("Upload error:", error);
      toast.error(error.message || "Không thể tải lên file.", { id: toastId });
    } finally {
      setIsUploading(false);
      isUploadingRef.current = false;
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateTask = async () => {
    if (!newTask.title) {
      toast.error("Vui lòng nhập tiêu đề nhiệm vụ");
      return;
    }

    const taskData = {
      ...newTask,
      type, // Assign current board type
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      files2D3D: [],
      checklists: [],
      materialList: [],
    };

    try {
      if (user) {
        await addDoc(collection(db, 'tasks'), taskData);
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      } else {
        const task: Task = {
          id: `task-${Date.now()}`,
          ...taskData,
        };
        // Update query cache instead of setTasks prop
        queryClient.setQueryData(['tasks'], (prev: Task[] = []) => [...prev, task]);
      }
      
      setIsCreateDialogOpen(false);
      setNewTask({
        title: '',
        description: '',
        assigneeId: members[0]?.id || '',
        priority: 'medium',
        status: 'todo',
        workshop: currentUser?.workshop && currentUser?.workshop !== 'all' ? currentUser.workshop : WORKSHOPS[1].id,
      });
      toast.success("Nhiệm vụ đã được tạo thành công");
    } catch (error: any) {
      console.error("Error creating task:", error);
      toast.error("Lỗi khi tạo nhiệm vụ: " + (error.message || "Vui lòng thử lại"));
      try {
        handleFirestoreError(error, OperationType.CREATE, 'tasks');
      } catch (e) {}
    }
  };

  const changeMonth = (delta: number) => {
    setSelectedMonth(prev => {
      const [year, month] = prev.split('-').map(Number);
      const date = new Date(year, month - 1 + delta, 1);
      return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    });
  };

  const filteredTasksByMonth = React.useMemo(() => {
    const filtered = tasks.filter(t => {
      // Workshop filter with normalization and customer fallback
      let taskWorkshop = t.workshop;
      if (!taskWorkshop && t.customerId) {
        const cust = customers.find(c => c.id === t.customerId);
        if (cust) {
          taskWorkshop = cust.workshop;
        }
      }

      const taskWorkshopName = getWorkshopName(taskWorkshop);
      const selectedWorkshopName = getWorkshopName(selectedWorkshop);
      
      const matchesWorkshop = selectedWorkshop === 'all' || taskWorkshopName === selectedWorkshopName;
      if (!matchesWorkshop) return false;

      // Show tasks created in this month OR tasks completed/waiting_install in this month
      const createdMonth = getVNMonth(t.createdAt) || t.createdAt.substring(0, 7);
      const completedMonth = t.completedAt ? getVNMonth(t.completedAt) : null;
      const waitingMonth = t.waiting_install_at ? getVNMonth(t.waiting_install_at) : null;
      
      return createdMonth === selectedMonth || 
             ((t.status === 'done' || t.status === 'waiting_install') && (completedMonth === selectedMonth || waitingMonth === selectedMonth));
    });

    // Sort by createdAt descending, new tasks at the top
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [tasks, selectedMonth, selectedWorkshop, customers]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleStatusChange = async (taskId: string, newStatus: Status, preSelectedAssigneeId?: string, fileLinks?: string[]) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Check if we need to show assignment dialog
    if (newStatus === 'done' && task.status !== 'done' && !preSelectedAssigneeId) {
      if (type === 'design') {
        const existingFiles = task.files2D3D || [];
        setPendingTransition({
          taskId,
          newStatus,
          workflowType: 'design-to-production',
          targetAssigneeId: '',
          fileLinks: existingFiles
        });
        return;
      }
      if (type === 'sale') {
        const existingFiles = task.files2D3D || [];
        setPendingTransition({
          taskId,
          newStatus,
          workflowType: 'sale-to-design',
          targetAssigneeId: '',
          fileLinks: existingFiles
        });
        return;
      }
    }

    // Find linked customer for automation data
    const linkedCustomer = customers?.find(c => c.id === task.customerId);
    const targetMember = members.find(m => m.id === (preSelectedAssigneeId || task.assigneeId || ''));
    const assigneeName = targetMember ? targetMember.name : 'Chưa gán';

    try {
      // Use provided fileLinks if available (from transition dialog), otherwise fallback to task's existing files
      // If fileLinks is an array (even empty), it means the user explicitly managed files in the dialog
      const finalFileLinks = Array.isArray(fileLinks) ? fileLinks : (task.files2D3D || []);
      
      if (user) {
        // Optimistic UI update via query cache
        queryClient.setQueryData(['tasks'], (prevTasks: Task[] = []) =>
          prevTasks.map((t) => {
            if (t.id === taskId) {
               const update: any = { status: newStatus, files2D3D: finalFileLinks };
               if (newStatus === 'waiting_install') update.column = 'cho_lap_dat';
               return { ...t, ...update };
            }
            return t;
          })
        );

        if (taskId.startsWith('virtual-')) {
          // Convert virtual order task to a real Firestore task
          const { id, ...taskData } = task;
          const newTaskData: any = {
            ...taskData,
            status: newStatus,
            files2D3D: finalFileLinks,
            checklists: task.checklists || [],
            materialList: task.materialList || [],
            materialRequisition: task.materialRequisition || null,
            productionChecklist: task.productionChecklist || null,
            title: `Sản xuất: ${task.title}` // Prefix for clarity
          };
          if (newStatus === 'waiting_install') newTaskData.column = 'cho_lap_dat';
          await addDoc(collection(db, 'tasks'), newTaskData);
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          toast.success(`Đã khởi tạo tiến độ sản xuất cho: ${task.title}`);
        } else {
          const updateData: any = { status: newStatus };
          
          // Carry over or update files
          updateData.files2D3D = finalFileLinks;
          
          if (newStatus === 'waiting_install') {
            updateData.column = 'cho_lap_dat';
          }
          if (newStatus === 'done' && task.status !== 'done') {
            updateData.completedAt = new Date().toISOString();
          }
          if (newStatus === 'waiting_install' && task.status !== 'waiting_install') {
            updateData.waiting_install_at = new Date().toISOString();
          }
          await updateDoc(doc(db, 'tasks', taskId), updateData);
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
        }

        // Trigger notifications for design/production status transitions
        if (type === 'design') {
          if (newStatus === 'in-progress' && task.status !== 'in-progress') {
            notifyManagers('Thiết kế: Lên bản vẽ 2D/3D', `Dự án "${task.title}" bắt đầu lên bản vẽ 2D/3D. Phụ trách: ${assigneeName}`, null, targetMember?.id);
          } else if (newStatus === 'review' && task.status !== 'review') {
            notifyManagers('Thiết kế: Chờ duyệt thiết kế', `Dự án "${task.title}" đang chờ duyệt thiết kế. Phụ trách: ${assigneeName}`, null, targetMember?.id);
          } else if (newStatus === 'done' && task.status !== 'done') {
            // Notify managers, the designer, AND all production members
            notifyManagers('Thiết kế: Hoàn tất', `Dự án "${task.title}" đã hoàn tất bản vẽ. Sẵn sàng chuyển giao sản xuất.`, null, targetMember?.id, ['sản xuất']);
          }
        } else if (type === 'production') {
          const projectTitle = task.title.replace('Sản xuất: ', '');
          if (newStatus === 'in-progress' && task.status !== 'in-progress') {
            notifyManagers('Sản xuất: Bắt đầu', `Dự án "${projectTitle}" bắt đầu được đưa vào sản xuất tại xưởng. Phụ trách: ${assigneeName}`, null, targetMember?.id);
          } else if (newStatus === 'waiting_install' && task.status !== 'waiting_install') {
            // Notify managers, the worker, AND all installers
            notifyManagers('Sản xuất: Chờ lắp đặt', `Dự án "${projectTitle}" đã hoàn thành sản xuất, chuyển sang trạng thái chờ lắp đặt.`, null, targetMember?.id, ['lắp đặt']);
          } else if (newStatus === 'done' && task.status !== 'done') {
            notifyManagers('Sản xuất: Hoàn thành', `Dự án "${projectTitle}" đã lắp đặt hoàn tất và bàn giao khách hàng.`, null, targetMember?.id);
          }
        }
        
        // Automated Workflow: Production Review -> Installation Stage
        if (type === 'production' && newStatus === 'waiting_install' && task.status !== 'waiting_install') {
          if (task.customerId) {
            await updateDoc(doc(db, 'customers', task.customerId), { stage: 'installation' });
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            toast.success(`Dự án ${task.title.replace('Sản xuất: ', '')} chuyển sang Chờ Lắp Đặt!`);
          }
        }
        
        // Automated Workflow: Production Done -> Completed Stage
        if (type === 'production' && newStatus === 'done' && task.status !== 'done') {
          if (task.customerId) {
            await updateDoc(doc(db, 'customers', task.customerId), { stage: 'completed' });
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            toast.success(`Dự án ${task.title.replace('Sản xuất: ', '')} đã hoàn thành!`);
          }
        }
        
        // Automated Workflow: Design Done -> Production Stage & Task
        if (type === 'design' && newStatus === 'done' && task.status !== 'done') {
          const projectTitle = task.title.replace('Thiết kế: ', '');
          
          if (task.customerId) {
            await updateDoc(doc(db, 'customers', task.customerId), { stage: 'production' });
            queryClient.invalidateQueries({ queryKey: ['customers'] });
          }

          const allTasks = queryClient.getQueryData<Task[]>(['tasks']) || [];
          const existingProdTask = allTasks.find(t => t.type === 'production' && t.customerId === task.customerId && t.customerId);
          
          if (!existingProdTask) {
            await addDoc(collection(db, 'tasks'), {
              title: `Sản xuất: ${projectTitle}`,
              description: task.description,
              status: 'todo',
              type: 'production',
              priority: task.priority,
              assigneeId: preSelectedAssigneeId || '',
              customerId: task.customerId || '',
              workshop: task.workshop || linkedCustomer?.workshop || '',
              createdAt: new Date().toISOString(),
              dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              files2D3D: finalFileLinks,
              checklists: task.checklists || [],
              materialList: task.materialList || [],
              materialRequisition: task.materialRequisition || null,
            });
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            toast.success(`Thiết kế hoàn tất! Đã chuyển sản xuất cho: ${assigneeName}`);
          }
        }

        // Automated Workflow: Sale Done -> Design Task
        if (type === 'sale' && newStatus === 'done' && task.status !== 'done') {
          const customerName = task.title.replace('Sale: ', '');
          
          const allTasks = queryClient.getQueryData<Task[]>(['tasks']) || [];
          const existingDesignTask = allTasks.find(t => t.type === 'design' && t.customerId === task.customerId && t.customerId);
          
          if (!existingDesignTask) {
            await addDoc(collection(db, 'tasks'), {
              title: `Thiết kế: ${customerName}`,
              description: task.description,
              status: 'todo',
              type: 'design',
              priority: 'medium',
              assigneeId: preSelectedAssigneeId || '',
              customerId: task.customerId || '',
              workshop: task.workshop || '',
              createdAt: new Date().toISOString(),
              dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              files2D3D: finalFileLinks,
              checklists: task.checklists || [],
              materialList: task.materialList || [],
              materialRequisition: task.materialRequisition || null,
            });
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            toast.success(`Sale hoàn tất! Đã chuyển thiết kế cho: ${assigneeName}`);
          }
        }
      } else {
        queryClient.setQueryData(['tasks'], (prevTasks: Task[] = []) => {
          const activeIndex = prevTasks.findIndex((t) => t.id === taskId);
          const updated = [...prevTasks];
          const updateData: any = { status: newStatus };
          if (newStatus === 'waiting_install') updateData.column = 'cho_lap_dat';
          if (newStatus === 'done' && updated[activeIndex].status !== 'done') {
            updateData.completedAt = new Date().toISOString();
          }
          updated[activeIndex] = { ...updated[activeIndex], ...updateData, files2D3D: finalFileLinks };
          
          // Local state mock for Design -> Production
          if (type === 'design' && newStatus === 'done' && task.status !== 'done') {
            const projectTitle = task.title.replace('Thiết kế: ', '');
            const newTask: Task = {
              id: `t-prod-${Date.now()}`,
              title: `Sản xuất: ${projectTitle}`,
              description: task.description,
              status: 'todo',
              type: 'production',
              priority: task.priority,
              assigneeId: preSelectedAssigneeId || '',
              customerId: task.customerId || '',
              createdAt: new Date().toISOString(),
              dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              files2D3D: finalFileLinks,
            };
            setTimeout(() => queryClient.setQueryData(['tasks'], (prev: Task[] = []) => [...prev, newTask]), 0);
            toast.success(`Thiết kế hoàn tất! Đã chuyển sản xuất cho: ${assigneeName}`);
          }

          // Local state mock for Sale -> Design
          if (type === 'sale' && newStatus === 'done' && task.status !== 'done') {
            const customerName = task.title.replace('Sale: ', '');
            const newTask: Task = {
              id: `t-design-${Date.now()}`,
              title: `Thiết kế: ${customerName}`,
              description: task.description,
              status: 'todo',
              type: 'design',
              priority: 'medium',
              assigneeId: preSelectedAssigneeId || '',
              customerId: task.customerId || '',
              createdAt: new Date().toISOString(),
              dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              files2D3D: finalFileLinks,
            };
            setTimeout(() => queryClient.setQueryData(['tasks'], (prev: Task[] = []) => [...prev, newTask]), 0);
            toast.success(`Sale hoàn tất! Đã chuyển thiết kế cho: ${assigneeName}`);
          }
          
          return updated;
        });
      }
      setPendingTransition(null);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  function onDragStart(event: DragStartEvent) {
    if (event.active.data.current?.type === 'Task') {
      setActiveTask(event.active.data.current.task);
    }
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveATask = active.data.current?.type === 'Task';
    const isOverATask = over.data.current?.type === 'Task';

    if (!isActiveATask) return;

    // Dropping a Task over another Task
    if (isActiveATask && isOverATask) {
      const activeIndex = tasks.findIndex((t) => t.id === activeId);
      const overIndex = tasks.findIndex((t) => t.id === overId);
      
      if (activeIndex === -1 || overIndex === -1) return;
      
      const newStatus = tasks[overIndex].status;

      // Special check: Don't update status optimistically if we need a transition dialog
      const requiresDialog = (type === 'design' || type === 'sale') && newStatus === 'done' && tasks[activeIndex]?.status !== 'done';

      if (tasks[activeIndex]?.status !== newStatus && !requiresDialog) {
        queryClient.setQueryData(['tasks'], (prevTasks: Task[] = []) => 
          prevTasks.map((t) => (t.id === activeId ? { ...t, status: newStatus } : t))
        );
      } else if (tasks[activeIndex]?.status === newStatus) {
        queryClient.setQueryData(['tasks'], (prevTasks: Task[] = []) => arrayMove(prevTasks, activeIndex, overIndex));
      }
    }
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveATask = active.data.current?.type === 'Task';
    const isOverAColumn = columns.some((col) => col.id === overId);
    const isOverATask = over.data.current?.type === 'Task';

    if (isActiveATask) {
      const task = tasks.find((t) => t.id === activeId);
      let newStatus: Status | null = null;
      
      if (isOverAColumn) {
        newStatus = overId as Status;
      } else if (isOverATask) {
        const overTask = tasks.find(t => t.id === overId);
        if (overTask) newStatus = overTask.status;
      }

      if (task && newStatus && task.status !== newStatus) {
        handleStatusChange(activeId as string, newStatus);
      }
    }
  }

  return (
    <div className="h-full flex flex-col space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        <div className="space-y-0 text-center md:text-left">
          <h1 className="text-lg md:text-2xl font-bold tracking-tight">Công việc</h1>
          <p className="text-muted-foreground text-[8px] md:text-sm">Theo dõi tiến độ.</p>
        </div>
        <div className="flex flex-wrap items-center justify-center md:justify-end gap-1.5 w-full md:w-auto">
          <Select 
            value={((selectedWorkshop === 'CoSo1' || selectedWorkshop === 'XuongGo') ? 'Cơ Sở 1' : 
                   (selectedWorkshop === 'CoSo2' || selectedWorkshop === 'XuongNhua') ? 'Cơ Sở 2' : 
                   selectedWorkshop) || 'all'} 
            onValueChange={setSelectedWorkshop}
            disabled={currentUser?.workshop && currentUser?.workshop !== 'all'}
          >
            <SelectTrigger className="h-8 w-[100px] md:w-[140px] rounded-lg border-border bg-card text-card-foreground text-[10px] md:text-[11px] shrink-0">
              <SelectValue placeholder="Cơ sở" />
            </SelectTrigger>
            <SelectContent>
              {WORKSHOPS.map(w => (
                <SelectItem key={w.id} value={w.id} className="text-xs">{w.name || 'Không xác định'}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-[130px] md:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input 
              placeholder="Tìm nhiệm vụ..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8 md:h-10 text-[10px] md:text-sm" 
            />
          </div>
          
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl px-1 py-0.5 border border-border shrink-0">
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.preventDefault(); changeMonth(-1); }}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <button
              onClick={() => setShowMonthPicker(!showMonthPicker)}
              className="text-[9px] md:text-xs font-bold tabular-nums cursor-pointer hover:text-primary transition-colors px-0.5 whitespace-nowrap"
            >
              {(() => {
                const [year, month] = selectedMonth.split('-');
                return `Thg ${month}, ${year}`;
              })()}
            </button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.preventDefault(); changeMonth(1); }}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger 
              render={
                <Button className="shrink-0 h-8 w-8 md:h-10 md:w-auto md:px-4 p-0 rounded-lg">
                  <Plus className="h-4 w-4" />
                  <span className="hidden md:block">Thêm</span>
                </Button>
              }
            />
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Tạo nhiệm vụ</DialogTitle>
                <DialogDescription>
                  Thêm một nhiệm vụ mới vào bảng nhóm của bạn.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Tiêu đề</Label>
                  <Input
                    id="title"
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    placeholder="Tiêu đề nhiệm vụ"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Mô tả</Label>
                  <Input
                    id="description"
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    placeholder="Mô tả ngắn gọn"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div className="grid gap-2">
                    <Label>Cơ sở</Label>
                    <Select 
                      value={newTask.workshop || 'all'} 
                      onValueChange={(v: any) => setNewTask({ ...newTask, workshop: v })}
                      disabled={currentUser?.workshop && currentUser?.workshop !== 'all'}
                    >
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WORKSHOPS.filter(w => w.id !== 'all').map(w => (
                          <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Ưu tiên</Label>
                    <Select 
                      value={newTask.priority || 'medium'} 
                      onValueChange={(v: any) => setNewTask({ ...newTask, priority: v })}
                    >
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Thấp</SelectItem>
                        <SelectItem value="medium">Trung bình</SelectItem>
                        <SelectItem value="high">Cao</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Người thực hiện</Label>
                    <Select 
                      value={newTask.assigneeId || ''} 
                      onValueChange={(v) => setNewTask({ ...newTask, assigneeId: v })}
                    >
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false} className="w-auto min-w-[250px]">
                        {members.map(m => (
                          <SelectItem key={m.id} value={m.id}>
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-sm">{m.name}</span>
                              <span className="text-[10px] text-muted-foreground">{m.role}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Hủy</Button>
                <Button onClick={handleCreateTask}>Tạo nhiệm vụ</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={!!pendingTransition} onOpenChange={(open) => !open && setPendingTransition(null)}>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>Phân công công việc</DialogTitle>
                <DialogDescription>
                  Bạn đang chuyển tiếp công việc sang giai đoạn mới. Vui lòng chọn người nhận việc.
                </DialogDescription>
              </DialogHeader>
              <div className="py-6 space-y-4">
                <div className="bg-primary/5 p-3 rounded-xl border border-primary/10">
                  <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">Công việc sắp tạo:</p>
                  <p className="text-sm font-medium">
                    {pendingTransition?.workflowType === 'sale-to-design' ? 'Thiết kế: ' : 'Sản xuất: '}
                    {tasks.find(t => t.id === pendingTransition?.taskId)?.title?.replace(/^(Sale|Thiết kế): /, '') || ''}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Người nhận việc</Label>
                  <Select 
                    value={pendingTransition?.targetAssigneeId || ''} 
                    onValueChange={(v) => setPendingTransition(prev => prev ? ({ ...prev, targetAssigneeId: v }) : null)}
                  >
                    <SelectTrigger className="h-12 rounded-xl">
                      <SelectValue placeholder="Chọn người nhận việc" />
                    </SelectTrigger>
                    <SelectContent align="center" className="w-auto min-w-[300px]">
                      {members.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          <div className="flex items-center gap-3 py-1">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={m.avatar} />
                              <AvatarFallback>{m.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col text-left">
                              <span className="font-bold text-sm">{m.name}</span>
                              <span className="text-[10px] text-muted-foreground">{m.role}</span>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {(pendingTransition?.workflowType === 'design-to-production' || pendingTransition?.workflowType === 'sale-to-design') && (
                  <div className="space-y-3 pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs uppercase font-bold text-muted-foreground tracking-wider">File 2D/3D kèm theo</Label>
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
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Dán link file (Drive, Dropbox...)" 
                        className="h-9 text-xs rounded-lg" 
                        value={newFileLink}
                        onChange={(e) => setNewFileLink(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (newFileLink) {
                               setPendingTransition(prev => prev ? ({ ...prev, fileLinks: [...(prev.fileLinks || []), newFileLink] }) : null);
                               setNewFileLink('');
                            }
                          }
                        }}
                      />
                      <Button size="sm" variant="secondary" className="h-9 px-3 rounded-lg" onClick={() => {
                        if (newFileLink) {
                          setPendingTransition(prev => prev ? ({ ...prev, fileLinks: [...(prev.fileLinks || []), newFileLink] }) : null);
                          setNewFileLink('');
                        }
                      }}>+ Thêm</Button>
                    </div>
                    {pendingTransition?.fileLinks && pendingTransition.fileLinks.length > 0 && (
                      <ul className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                        {pendingTransition.fileLinks.map((link, idx) => {
                          const isImg = link.match(/\.(jpeg|jpg|gif|png|webp)$/i) || link.includes('i.ibb.co');
                          return (
                            <li key={idx} className="flex items-center justify-between bg-card p-1.5 rounded-lg border border-border/50 group shadow-sm">
                              <div 
                                className="flex items-center gap-2 flex-1 min-w-0 pr-2 cursor-pointer group/item"
                                onClick={() => isImg && handleOpenPreview(link)}
                              >
                                {isImg ? (
                                  <div className="h-9 w-9 rounded-md border overflow-hidden shrink-0 bg-secondary/20 group-hover/item:ring-2 ring-primary/30 transition-all">
                                    <img src={link} alt="preview" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                                  </div>
                                ) : (
                                  <div className="h-9 w-9 rounded-md border flex items-center justify-center shrink-0 bg-secondary/10">
                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                )}
                                <span 
                                  className="text-[10px] text-primary group-hover/item:underline font-medium truncate flex-1"
                                  title={link}
                                >
                                  {link.split('/').pop() || 'File kèm theo'}
                                </span>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 text-destructive hover:bg-destructive/10 rounded-md shrink-0"
                                onClick={() => setPendingTransition(prev => prev ? ({ ...prev, fileLinks: prev.fileLinks?.filter((_, i) => i !== idx) }) : null)}
                              >
                                ×
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" className="rounded-lg h-10" onClick={() => setPendingTransition(null)}>Hủy</Button>
                <Button 
                  disabled={!pendingTransition?.targetAssigneeId}
                  className="rounded-lg h-10 shadow-lg shadow-primary/10"
                  onClick={() => {
                    if (pendingTransition) {
                      handleStatusChange(pendingTransition.taskId, pendingTransition.newStatus, pendingTransition.targetAssigneeId, pendingTransition.fileLinks);
                    }
                  }}
                >
                  Xác nhận & Chuyển tiếp
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <ScrollArea className="w-full h-full max-h-[calc(100vh-280px)] overflow-hidden pb-4">
          <div className="flex gap-3 min-h-[400px] w-full">
            {columns.map((col) => (
              <KanbanColumn
                key={col.id}
                status={col.id}
                title={col.title}
                tasks={filteredTasksByMonth.filter((t) => t.status === col.id)}
                members={members}
                customers={customers}
                type={type}
                columns={columns}
                onMoveTask={handleStatusChange}
                hideChecklist={hideChecklist}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {createPortal(
          <DragOverlay dropAnimation={{
            sideEffects: defaultDropAnimationSideEffects({
              styles: {
                active: {
                  opacity: '0.5',
                },
              },
            }),
          }}>
            {activeTask ? (
              <TaskCard 
                task={activeTask} 
                assignee={members.find(m => m.id === activeTask.assigneeId)}
                members={members}
                hideChecklist={hideChecklist}
              />
            ) : null}
          </DragOverlay>,
          document.body
        )}
      </DndContext>

      <ImagePreviewDialog 
        isOpen={!!previewImage}
        onClose={() => setPreviewImage(null)}
        imageUrl={previewImage}
        allImages={transitionImageFiles}
        currentIdx={currentImageIdx}
        onNavigate={(idx) => {
          setCurrentImageIdx(idx);
          setPreviewImage(transitionImageFiles[idx]);
        }}
      />
    </div>
  );
}
