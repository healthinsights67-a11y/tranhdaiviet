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
}

interface NavbarProps {
  onMenuClick?: () => void;
  user?: any;
  onLogin?: () => void;
  onLogout?: () => void;
  currentUser?: any;
}

export function Navbar({ onMenuClick, user, onLogin, onLogout, currentUser }: NavbarProps) {
  const [notifications, setNotifications] = React.useState<NotificationType[]>([]);
  const currentUserId = currentUser?.id || user?.uid || user?.email;

  React.useEffect(() => {
    if (!currentUserId) return;

    // We fetch ALL notifications globally to simplify, since it's an internal app
    // In production we would filter by userId or isGlobal
    const q = query(
      collection(db, 'notifications'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs: NotificationType[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.isGlobal || data.userId === currentUserId) {
          notifs.push({
            id: doc.id,
            ...data
          } as NotificationType);
        }
      });
      setNotifications(notifs);
    });

    return () => unsubscribe();
  }, [currentUserId]);

  const unreadCount = notifications.filter(n => !(n.readBy || []).includes(currentUserId)).length;

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
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <ScrollArea className="h-80">
                    {notifications.length > 0 ? (
                      notifications.map((n) => (
                        <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-1 p-4 cursor-default focus:bg-secondary/50">
                          <div className="flex items-center justify-between w-full">
                            <span className="font-semibold text-sm">{n.title}</span>
                            <span className="text-[10px] text-muted-foreground">{getRelativeTime(n.createdAt)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                            {n.message}
                          </p>
                          {!(n.readBy || []).includes(currentUserId) && <div className="w-2 h-2 rounded-full bg-primary mt-1" />}
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <div className="p-8 text-center text-muted-foreground text-sm">
                        Không có thông báo mới
                      </div>
                    )}
                  </ScrollArea>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost" }), "relative h-9 w-9 rounded-full p-0 overflow-hidden")}>
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={currentUser?.avatar || user.photoURL || "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"} />
                    <AvatarFallback>{currentUser?.name?.charAt(0) || user.displayName?.charAt(0) || 'U'}</AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user?.displayName || 'User'}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user?.email || 'No email'}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => console.log('Profile clicked')}>Hồ sơ</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => console.log('Settings clicked')}>Cài đặt</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={() => { console.log('Logout clicked'); onLogout?.(); }}>Đăng xuất</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button size="sm" onClick={onLogin}>Đăng nhập</Button>
          )}
        </div>
      </div>
    </header>
  );
}
