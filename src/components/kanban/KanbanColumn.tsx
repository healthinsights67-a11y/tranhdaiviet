import * as React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Task, Status, Member, Priority, Customer } from '@/src/types';
import { TaskCard } from './TaskCard';
import { Button } from '@/components/ui/button';
import { Plus, MoreHorizontal, Calendar, ChevronLeft, ChevronRight, Archive } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Badge } from '@/components/ui/badge';

interface KanbanColumnProps {
  status: Status;
  title: string;
  tasks: Task[];
  members: Member[];
  customers?: Customer[];
  type?: 'production' | 'design' | 'sale' | 'marketing' | 'general';
  columns?: { id: Status; title: string }[];
  onMoveTask?: (taskId: string, newStatus: Status, preSelectedAssigneeId?: string, fileLinks?: string[]) => void;
  hideChecklist?: boolean;
  key?: React.Key;
}

export const KanbanColumn = React.memo(({ status, title, tasks, members, customers = [], type, columns = [], onMoveTask, hideChecklist }: KanbanColumnProps) => {
  const { setNodeRef } = useDroppable({
    id: status,
  });

  const taskIds = React.useMemo(() => tasks.map((t) => t.id), [tasks]);

  return (
    <div className={cn(
      "flex flex-col flex-1 min-w-[200px] md:min-w-[240px] max-w-[400px] shrink-0 bg-[#eff2f6] rounded-xl p-1.5 md:p-2 border border-border transition-all"
    )}>
      <div className="flex flex-col mb-1.5 px-1 gap-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <h3 className="font-bold text-[10px] md:text-xs tracking-tight truncate max-w-[120px] md:max-w-[150px] uppercase opacity-80 decoration-primary/30 underline-offset-4 underline">{title}</h3>
            <Badge variant="secondary" className="text-[8px] h-3.5 px-1 font-black bg-gray-200">
              {tasks.length}
            </Badge>
          </div>
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md hover:bg-background shadow-sm border border-transparent hover:border-border/20">
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      <div ref={setNodeRef} className="flex-1 space-y-1.5 md:space-y-2 min-h-[150px] overflow-y-auto max-h-[calc(100vh-350px)]">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard 
              key={task.id} 
              task={task} 
              assignee={members.find(m => m.id === task.assigneeId)}
              members={members}
              customers={customers}
              columns={columns}
              onMoveTask={onMoveTask}
              hideChecklist={hideChecklist}
            />
          ))}
        </SortableContext>
        
        {tasks.length === 0 && (
          <div className="h-32 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-muted-foreground gap-2 animate-pulse">
            <Archive className="h-5 w-5 opacity-40" />
            <span className="text-[10px] font-medium italic">Không có nhiệm vụ</span>
          </div>
        )}
      </div>
    </div>
  );
});
