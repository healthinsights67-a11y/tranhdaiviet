import { useState } from 'react';
import { 
  ClipboardList, 
  Palette, 
  Factory, 
  UserCheck, 
  Clock, 
  ChevronDown, 
  ChevronUp,
  Image as ImageIcon,
  CheckCircle2,
  Box,
  Package,
  Download,
  Link as LinkIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export interface HistoryEvent {
  id?: string;
  type: 'sale' | 'design' | 'production' | 'other';
  action: string;
  timestamp: string | Date;
  note?: string;
  updatedBy: string;
  files2D3D?: string[]; 
  checklists?: { id: string; title: string; completed: boolean }[];
  materialList?: { id: string; name: string; quantity: number; unit: string }[];
  quotationItems?: { id: string; name: string; quantity: number; unit: string; total: number }[];
  orderValue?: number;
  quotationId?: string;
}

const getActivityStyle = (type: string) => {
  switch (type) {
    case 'sale': return { icon: <UserCheck className="w-4 h-4"/>, color: 'bg-blue-500', text: 'text-blue-600', bg: 'bg-blue-50' };
    case 'design': return { icon: <Palette className="w-4 h-4"/>, color: 'bg-indigo-500', text: 'text-indigo-600', bg: 'bg-indigo-50' };
    case 'production': return { icon: <Factory className="w-4 h-4"/>, color: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50' };
    default: return { icon: <Clock className="w-4 h-4"/>, color: 'bg-slate-400', text: 'text-slate-600', bg: 'bg-slate-50' };
  }
};

const HistoryItem = ({ item, isLatest = false }: { item: HistoryEvent; isLatest?: boolean }) => {
  const [isOpen, setIsOpen] = useState(isLatest);
  const style = getActivityStyle(item.type);

  const getFileNameFromUrl = (url: string) => {
    try {
      const parts = url.split('/');
      const lastPart = parts[parts.length - 1];
      return lastPart.split('?')[0] || 'Tài_liệu_đính_kèm';
    } catch {
      return 'Tài_liệu_đính_kèm';
    }
  };

  return (
    <div className="relative pl-5 sm:pl-7 pb-4 last:pb-0 group">
      <div className={`absolute -left-[14px] sm:-left-[17px] top-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full border-4 border-white flex items-center justify-center text-white shadow-sm z-10 transition-transform group-hover:scale-110 ${style.color}`}>
        <div className="scale-75 sm:scale-100">
          {style.icon}
        </div>
      </div>

      <div className={`bg-card text-card-foreground border transition-all cursor-pointer rounded-xl shadow-sm hover:shadow-md hover:border-slate-300 overflow-hidden ${isOpen ? 'border-slate-300' : 'border-slate-100'}`}>
        <div className="p-2 sm:p-3 flex items-center justify-between gap-2" onClick={() => setIsOpen(!isOpen)}>
          <div className="flex items-center gap-1.5 sm:gap-3 overflow-hidden flex-1 min-w-0">
            <span className={`text-[8px] sm:text-[9px] font-black px-1.5 sm:px-2 py-0.5 rounded-sm uppercase shrink-0 ${style.bg} ${style.text}`}>
              {item.type === 'sale' ? 'KD' : item.type === 'design' ? 'TK' : item.type === 'production' ? 'SX' : 'KHÁC'}
            </span>
            <p className="text-[11px] sm:text-sm font-bold text-slate-800 truncate leading-tight">{item.action}</p>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <span className="text-[8px] sm:text-[10px] text-slate-400 font-bold tabular-nums">
              {new Date(item.timestamp).toLocaleDateString('vi-VN')}
            </span>
            {isOpen ? <ChevronUp className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400"/> : <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400"/>}
          </div>
        </div>

        {isOpen && (
          <div className="border-t border-slate-100 p-2.5 sm:p-4 bg-slate-50/50 space-y-3 sm:space-y-4 cursor-default w-full overflow-x-hidden" onClick={(e) => e.stopPropagation()}>
            {item.note && (
              <div className="bg-card text-card-foreground/80 p-2 sm:p-2.5 rounded-lg border border-slate-100 shadow-sm">
                <p className="text-[10px] sm:text-[11px] text-slate-600 italic font-medium leading-relaxed break-words whitespace-pre-wrap">"{item.note}"</p>
              </div>
            )}

            <div className="space-y-3 sm:space-y-4">
              {item.files2D3D && item.files2D3D.length > 0 && (
                <div className="space-y-1.5 sm:space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide px-1">
                    <ImageIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5"/>
                    <span>File thiết kế / Ảnh</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2">
                    {item.files2D3D.map((url, idx) => {
                      const isImage = url.match(/\.(jpeg|jpg|gif|png|webp)$|images\.unsplash\.com|fbcdn\.net|googleusercontent\.com/i);
                      return (
                        <div key={idx} className="space-y-1">
                          {isImage ? (
                            <div className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shadow-sm">
                              <img src={url} alt={`File ${idx}`} className="h-full w-full object-cover transition-transform group-hover:scale-105" referrerPolicy="no-referrer" />
                              <a href={url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-all">
                                <Download className="w-5 h-5 text-white opacity-0 group-hover:opacity-100" />
                              </a>
                            </div>
                          ) : (
                            <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between bg-card text-card-foreground border border-slate-200 p-2 rounded-lg hover:border-indigo-300 hover:shadow-sm transition-all group overflow-hidden w-full">
                              <div className="flex items-center gap-2 overflow-hidden min-w-0">
                                <LinkIcon className="w-3 h-3 text-slate-400 flex-shrink-0"/>
                                <span className="text-[10px] text-slate-600 truncate break-all" title={url}>{getFileNameFromUrl(url)}</span>
                              </div>
                              <Download className="w-3 h-3 text-slate-300 group-hover:text-indigo-600 flex-shrink-0"/>
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {item.checklists && item.checklists.length > 0 && (
                <div className="space-y-1.5 sm:space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide px-1">
                    <ClipboardList className="w-3 h-3 sm:w-3.5 sm:h-3.5"/>
                    <span>Checklist tiến độ</span>
                  </div>
                    <div className="bg-card text-card-foreground border border-slate-200 rounded-xl p-2 sm:p-2.5 space-y-1 sm:space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar shadow-sm">
                    {item.checklists.map((task) => (
                      <div key={task.id} className="flex items-start gap-2 text-[10px] sm:text-xs py-1 px-1 hover:bg-slate-50 rounded-md transition-colors">
                        <CheckCircle2 className={`w-3 h-3 sm:w-4 sm:h-4 mt-0.5 flex-shrink-0 ${task.completed ? 'text-emerald-500' : 'text-slate-300'}`} />
                        <span className={cn("leading-relaxed", task.completed ? 'text-slate-700 font-medium' : 'text-slate-500')}>{task.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {((item.type === 'production') || (item.materialList && item.materialList.length > 0)) && (
                <div className="space-y-2 font-sans">
                  <div className="flex items-center gap-2 text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-wider px-1">
                    <div className="h-5 w-5 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-xs">
                      <Box className="w-3 h-3"/>
                    </div>
                    <span>Phiếu lĩnh vật tư (NVL)</span>
                  </div>
                  {item.materialList && item.materialList.length > 0 ? (
                    <div className="bg-card text-card-foreground border border-slate-200 rounded-xl overflow-hidden shadow-xs divide-y divide-slate-50/80">
                      {item.materialList.map((mat) => (
                        <div key={mat.id} className="flex items-center justify-between p-2.5 sm:p-3 hover:bg-slate-50/50 transition-colors">
                          <span className="text-[10px] sm:text-xs text-slate-700 font-bold leading-tight">{mat.name}</span>
                          <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md shrink-0 ml-3 ring-1 ring-inset ring-slate-200/50">
                            <span className="text-[10px] sm:text-xs font-black text-slate-900 tabular-nums">{mat.quantity}</span>
                            <span className="text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase">{mat.unit}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-slate-100/30 border-2 border-dashed border-slate-200/50 rounded-xl p-6 text-center group">
                      <Package className="h-5 w-5 text-slate-300 mx-auto mb-2 group-hover:text-slate-400 transition-colors" />
                      <p className="text-[10px] sm:text-xs text-slate-400 italic font-medium">Chưa có danh sách vật tư chi tiết</p>
                    </div>
                  )}
                </div>
              )}

              {item.quotationItems && item.quotationItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex flex-col gap-2 p-2.5 sm:p-3 bg-amber-50 rounded-xl border border-amber-200/50 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-amber-800">
                        <Box className="h-3.5 w-3.5 shrink-0" />
                        <div className="flex flex-col">
                          <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-wider">Mã BÁO GIÁ</span>
                          <span className="text-xs font-black text-amber-900 leading-none">{item.quotationId || 'BG-X'}</span>
                        </div>
                      </div>
                      {item.orderValue && (
                        <div className="flex flex-col items-end">
                          <span className="text-[8px] sm:text-[9px] font-bold text-amber-700 uppercase tracking-tight">Tổng cộng</span>
                          <span className="text-xs sm:text-sm font-black text-amber-900 leading-none">
                            {item.orderValue.toLocaleString('vi-VN')} đ
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-amber-900 uppercase tracking-wide px-1">
                    <ClipboardList className="w-3 h-3 sm:w-3.5 sm:h-3.5"/>
                    <span>Danh sách hạng mục</span>
                  </div>
                  <div className="bg-card text-card-foreground border border-amber-100 rounded-xl overflow-hidden shadow-sm">
                    <div className="grid grid-cols-12 gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-amber-50/50 text-[8px] sm:text-[10px] font-black text-amber-800 uppercase tracking-tighter border-b border-amber-100">
                      <div className="col-span-12 sm:col-span-6 mb-1 sm:mb-0">Tên hạng mục</div>
                      <div className="hidden sm:block sm:col-span-2 text-center">SL</div>
                      <div className="hidden sm:block sm:col-span-4 text-right">Thành tiền</div>
                    </div>
                    <div className="divide-y divide-amber-50 max-h-60 overflow-y-auto custom-scrollbar">
                      {item.quotationItems.map((qItem) => (
                        <div key={qItem.id} className="p-2 sm:p-2.5 space-y-1 sm:space-y-0 sm:grid sm:grid-cols-12 sm:gap-1 text-[10px] sm:text-xs bg-card text-card-foreground hover:bg-amber-50/20 transition-colors">
                          <div className="sm:col-span-6 font-bold text-slate-800 leading-tight">{qItem.name}</div>
                          <div className="flex items-center justify-between sm:col-span-6">
                             <div className="sm:hidden text-[8px] text-slate-400 font-bold uppercase">Số lượng: {qItem.quantity} {qItem.unit}</div>
                             <div className="flex items-center justify-between sm:contents w-full">
                               <div className="hidden sm:block sm:col-span-2 text-slate-500 font-medium text-center">{qItem.quantity} {qItem.unit}</div>
                               <div className="sm:col-span-4 text-right font-black text-amber-700">{qItem.total.toLocaleString('vi-VN')} đ</div>
                             </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2 sm:pt-3 border-t border-slate-100 mt-1">
              <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-black text-slate-500">
                {item.updatedBy.charAt(0).toUpperCase()}
              </div>
              <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold">Người thực hiện: {item.updatedBy}</span>
            </div>
          </div>
        )}
      </div>
    </div>

  );
};

export function CustomerWorkflowHistory({ history }: { history: HistoryEvent[] }) {
  if (!history || history.length === 0) {
    return (
      <div className="text-center py-6 text-slate-400 text-sm border-2 border-dashed border-slate-100 rounded-xl">
        Chưa có lịch sử công việc nào được ghi nhận.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
        <h3 className="text-xs sm:text-sm font-black uppercase tracking-[0.1em] text-slate-800 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Lịch sử công việc 360°
        </h3>
        <Badge variant="outline" className="text-[9px] bg-indigo-50 text-indigo-600 border-indigo-100 px-2 py-0.5 hover:bg-indigo-100 transition-colors whitespace-nowrap self-start sm:self-center">
          Dữ liệu đồng bộ
        </Badge>
      </div>
      <div className="relative ml-3.5 sm:ml-6 border-l-2 border-slate-200/60 pl-0 space-y-6 pb-4">
        {history.map((item, index) => (
          <HistoryItem key={item.id || index} item={item} isLatest={index === 0} />
        ))}
      </div>
    </div>

  );
}
