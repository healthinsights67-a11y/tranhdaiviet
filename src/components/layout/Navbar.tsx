import * as React from 'react';
import { Bell, Search, User, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/src/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { db, collection, query, orderBy, onSnapshot, updateDoc, doc, arrayUnion } from '@/src/lib/firebase';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';

interface NotificationType {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
  readBy: string[];
  isGlobal: boolean;
  userId?: string;
  targetGroup?: string;
}

interface NavbarProps {
  onMenuClick?: () => void;
  user?: any;
  onLogin?: () => void;
  onLogout?: () => void;
  currentUser?: any;
  setActiveTab?: (tab: string) => void;
}

const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // First high note (A5)
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880.00, audioContext.currentTime);
    gain1.gain.setValueAtTime(0, audioContext.currentTime);
    gain1.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
    osc1.connect(gain1);
    gain1.connect(audioContext.destination);
    osc1.start();
    osc1.stop(audioContext.currentTime + 0.3);

    // Second higher note (E6)
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1318.51, audioContext.currentTime + 0.1);
    gain2.gain.setValueAtTime(0, audioContext.currentTime + 0.1);
    gain2.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
    osc2.connect(gain2);
    gain2.connect(audioContext.destination);
    osc2.start(audioContext.currentTime + 0.1);
    osc2.stop(audioContext.currentTime + 0.5);
  } catch (err) {
    console.warn("Could not play notification sound", err);
  }
};

export function Navbar({ onMenuClick, user, onLogin, onLogout, currentUser, setActiveTab }: NavbarProps) {
  const [notifications, setNotifications] = React.useState<NotificationType[]>([]);
  const [showPopup, setShowPopup] = React.useState(false);
  const currentUserId = currentUser?.id || user?.uid || user?.email;
  const isInitialLoad = React.useRef(true);

  const handleNotificationClick = async (notif: NotificationType) => {
    if (currentUserId) {
      if (!(notif.readBy || []).includes(currentUserId)) {
        setNotifications(notifications.map(n => n.id === notif.id ? { ...n, readBy: [...(n.readBy || []), currentUserId] } : n));
        await updateDoc(doc(db, 'notifications', notif.id), { readBy: arrayUnion(currentUserId) });
      }
    }
    
    const title = notif.title.toLowerCase();
    const msg = notif.message.toLowerCase();
    
    if (title.includes('đo đạc') || msg.includes('đo đạc') || title.includes('khảo sát') || msg.includes('khảo sát')) {
      setActiveTab?.('measurements');
    } else if (title.includes('lắp đặt') || msg.includes('lắp đặt') || title.includes('thi công') || msg.includes('thi công')) {
      setActiveTab?.('installations');
    } else if (title.includes('sản xuất') || msg.includes('sản xuất')) {
      setActiveTab?.('production');
    } else if (title.includes('thiết kế') || msg.includes('thiết kế')) {
      setActiveTab?.('design');
    } else if (title.includes('bảo hành') || msg.includes('bảo hành') || title.includes('cskh') || msg.includes('cskh')) {
      setActiveTab?.('customer-care');
    } else if (title.includes('báo giá') || msg.includes('báo giá')) {
      setActiveTab?.('quotations');
    } else if (title.includes('khách hàng') || msg.includes('khách hàng')) {
      setActiveTab?.('customers');
    } else {
      if (notif.targetGroup === 'sales') {
        setActiveTab?.('sale');
      } else if (notif.targetGroup === 'designers') {
        setActiveTab?.('design');
      } else if (notif.targetGroup === 'installers') {
        setActiveTab?.('installations');
      }
    }
    setShowPopup(false);
  };

  React.useEffect(() => {
    if (!currentUserId) return;

    // We fetch ALL notifications globally to simplify, since it's an internal app
    // In production we would filter by userId or isGlobal
    const q = query(
      collection(db, 'notifications'),
      orderBy('createdAt', 'desc')
    );

    const checkIsTargetedToMe = (data: any) => {
      if (data.isGlobal) return true;
      if (data.userId === currentUserId) return true;
      if (data.targetGroup && currentUser?.role) {
        const r = currentUser.role.toLowerCase();
        switch (data.targetGroup) {
          case 'managers': return r.includes('quản lý') || r.includes('giám đốc') || r.includes('trợ lý');
          case 'designers': return r.includes('thiết kế');
          case 'installers': return r.includes('thi công') || r.includes('lắp đặt') || r.includes('kỹ thuật');
          case 'sales': return r.includes('kinh doanh') || r.includes('khảo sát');
          default: return false;
        }
      }
      return false;
    };

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs: NotificationType[] = [];
      let shouldPlaySound = false;

      snapshot.forEach(doc => {
        const data = doc.data();
        if (checkIsTargetedToMe(data)) {
          notifs.push({
            id: doc.id,
            ...data
          } as NotificationType);
        }
      });

      if (!isInitialLoad.current) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            const isUnread = !(data.readBy || []).includes(currentUserId);
            if (isUnread && checkIsTargetedToMe(data)) {
              shouldPlaySound = true;
            }
          }
        });
        
        if (shouldPlaySound) {
          playNotificationSound();
        }
      }

      setNotifications(notifs);
      isInitialLoad.current = false;
    });

    return () => unsubscribe();
  }, [currentUserId]);

  const unreadCount = notifications.filter(n => !(n.readBy || []).includes(currentUserId)).length;
  const prevUnreadCount = React.useRef(unreadCount);

  React.useEffect(() => {
    // Only show popup when unreadCount INCREASES (e.g. new notification arrived or initial load)
    // This prevents the popup from reopening when marking as read (which decreases the count)
    if (unreadCount > prevUnreadCount.current && unreadCount > 0) {
      setShowPopup(true);
    }
    prevUnreadCount.current = unreadCount;
  }, [unreadCount]);

  const handleDismissPopup = () => {
    setShowPopup(false);
  };

  const markAllAsRead = async () => {
    if (!currentUserId) return;
    
    // Optimistically update UI
    const unreadNotifs = notifications.filter(n => !(n.readBy || []).includes(currentUserId));
    setNotifications(notifications.map(n => ({
      ...n,
      readBy: [...(n.readBy || []), currentUserId]
    })));

    // Update in DB
    for (const notif of unreadNotifs) {
      const notifRef = doc(db, 'notifications', notif.id);
      await updateDoc(notifRef, {
        readBy: arrayUnion(currentUserId)
      });
    }
  };

  const getRelativeTime = (isoString: string) => {
    if (!isoString) return '';
    try {
      return formatDistanceToNow(parseISO(isoString), { addSuffix: true, locale: vi });
    } catch {
      return isoString;
    }
  };

  return (
    <header className="h-12 md:h-16 border-b border-border bg-card sticky top-0 z-30 w-full shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="h-full px-2.5 md:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex-1 max-w-md hidden md:block">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="search"
                placeholder="Tìm kiếm mọi thứ..."
                className="w-full bg-secondary border-none rounded-full pl-9 h-9 text-sm focus:ring-1 focus:ring-primary transition-all text-foreground"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative")}>
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-primary text-[10px]">
                      {unreadCount}
                    </Badge>
                  )}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="flex items-center justify-between">
                      <span>Thông báo</span>
                      <Button variant="ghost" size="sm" className="text-xs h-auto p-0" onClick={markAllAsRead}>
                        Đánh dấu tất cả là đã đọc
                      </Button>
                    </DropdownMenuLabel>
                    <ScrollArea className="h-[400px]">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          Không có thông báo nào.
                        </div>
                      ) : (
                        notifications.map((n) => {
                          const isUnread = !(n.readBy || []).includes(currentUserId);
                          return (
                            <DropdownMenuItem 
                              key={n.id} 
                              className={cn(
                                "flex flex-col items-start gap-1 p-3 cursor-pointer hover:bg-slate-50 border-b border-slate-50 last:border-b-0 transition-colors", 
                                isUnread ? "bg-blue-50/40 hover:bg-blue-50/60" : ""
                              )}
                              onClick={() => handleNotificationClick(n)}
                            >
                              <div className="flex items-start justify-between w-full gap-2">
                                <span className={cn("text-xs md:text-sm", isUnread ? "font-bold text-blue-900" : "font-semibold text-foreground")}>{n.title}</span>
                                <span className="text-[9px] text-muted-foreground shrink-0 mt-0.5">{getRelativeTime(n.createdAt)}</span>
                              </div>
                              <p className={cn("text-[11px] md:text-xs leading-relaxed whitespace-pre-wrap line-clamp-2", isUnread ? "text-blue-800/90" : "text-muted-foreground")}>
                                {n.message}
                              </p>
                              {isUnread && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-6 text-[10px] px-2 mt-1 -ml-2 text-blue-600 hover:text-blue-700 hover:bg-blue-100/60"
                                  onClick={async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (currentUserId) {
                                      // Optimistically update
                                      setNotifications(notifications.map(notif => notif.id === n.id ? { ...notif, readBy: [...(notif.readBy || []), currentUserId] } : notif));
                                      await updateDoc(doc(db, 'notifications', n.id), { readBy: arrayUnion(currentUserId) });
                                    }
                                  }}
                                >
                                  Đánh dấu đã đọc
                                </Button>
                              )}
                            </DropdownMenuItem>
                          );
                        })
                      )}
                    </ScrollArea>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={onLogin} className="hidden sm:inline-flex">Đăng nhập</Button>
            </div>
          )}
        </div>
      </div>
      
      <Dialog open={showPopup} onOpenChange={setShowPopup}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Bạn có {unreadCount} thông báo mới!
            </DialogTitle>
            <DialogDescription>
              Hãy cập nhật các thông báo quan trọng dưới đây.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
             {notifications.filter(n => !(n.readBy || []).includes(currentUserId)).map((n) => (
                <div 
                  key={n.id} 
                  className="flex flex-col items-start gap-1 p-4 rounded-xl bg-secondary/30 hover:bg-secondary/60 border cursor-pointer transition-all duration-200 text-left w-full"
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-sm text-foreground">{n.title}</span>
                    <span className="text-[10px] text-muted-foreground">{getRelativeTime(n.createdAt)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed whitespace-pre-wrap">
                    {n.message}
                  </p>
                </div>
              ))}
          </div>
          <DialogFooter className="flex gap-2 sm:gap-0">
             <Button variant="outline" onClick={handleDismissPopup}>Đóng</Button>
             <Button onClick={() => {
               markAllAsRead();
               handleDismissPopup();
             }}>Đã xem tất cả</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
