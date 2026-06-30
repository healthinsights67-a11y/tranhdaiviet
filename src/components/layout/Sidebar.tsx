import * as React from 'react';
import { 
  LayoutDashboard,
  CalendarDays,
  Repeat,
  BadgeDollarSign,
  Briefcase,
  Megaphone,
  BarChart3,
  Users,
  Contact,
  Settings,
  Sun, 
  Moon,
  LogOut,
  Menu,
  X,
  Image,
  Sparkles,
  ExternalLink,
  FileText,
  Package,
  ShieldAlert,
  ChevronDown,
  Trash2,
  Folder,
  BookOpen,
  Calculator,
  HelpCircle,
  MapPin,
  HeartHandshake,
  Wrench
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/src/contexts/AuthContext';

import { Member, MemberPermissions } from '@/src/types';
import { SettingsDialog } from './SettingsDialog';
import { authService } from '@/src/services/authService';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  currentUser: Member | null;
  permissions?: Record<string, boolean>;
}

const navGroups = [
  {
    title: 'Chung',
    items: [
      { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
      { id: 'reports', label: 'Báo cáo', icon: BarChart3, permission: 'menuReports' },
    ]
  },
  {
    title: 'Đơn hàng & Khách',
    items: [
      { id: 'sale', label: 'SALE', icon: BadgeDollarSign, permission: 'menuSale' },
      { id: 'sales-routes', label: 'Lịch trình Sale', icon: MapPin, permission: 'menuMembers' },
      { id: 'customers', label: 'Khách hàng', icon: Contact, permission: 'menuCustomers' },
      { id: 'quotations', label: 'Báo Giá', icon: FileText, permission: 'menuQuotations' },
      { id: 'customer-care', label: 'Bảo hành & CSKH', icon: HeartHandshake, permission: 'menuCustomers' },
    ]
  },
  {
    title: 'Sản xuất & Thi công',
    items: [
      { id: 'measurements', label: 'Lịch Đo Đạc', icon: CalendarDays, permission: 'menuMeasurement' },
      { id: 'production', label: 'Lịch Sản Xuất', icon: CalendarDays, permission: 'menuProduction' },
      { id: 'installations', label: 'Báo cáo Thi công', icon: Wrench, permission: 'menuInstallations' },
    ]
  },
  {
    title: 'Phòng ban',
    items: [
      { id: 'design', label: 'Thiết kế', icon: Briefcase, permission: 'menuDesign' },
      { id: 'marketing', label: 'Marketing', icon: Megaphone, permission: 'menuMarketing' },
      { id: 'ai-render', label: 'Thiết kế AI', icon: Sparkles, permission: 'menuAi' },
      { id: 'ecoplast-learning', label: 'Học tập Ecoplast', icon: BookOpen, permission: 'menuSale' },
    ]
  },
  {
    title: 'Hệ thống',
    items: [
      { id: 'materials', label: 'Bảng giá vật tư', icon: Package, permission: 'viewPrice' },
      { id: 'media', label: 'Thư viện ảnh', icon: Image, permission: 'menuMedia' },
        { id: 'documents', label: 'Tài liệu Sản Phẩm', icon: Folder, permission: 'menuMedia' },
      { id: 'employees', label: 'Nhân sự', icon: Users, permission: 'menuMembers' },
      { id: 'users', label: 'Phân quyền', icon: ShieldAlert, isAdminOnly: true },
      { id: 'workflow-guide', label: 'Hướng dẫn', icon: HelpCircle },
      { id: 'trash', label: 'Thùng rác', icon: Trash2 },
    ]
  }
];

export function Sidebar({ activeTab, setActiveTab, isDarkMode, toggleDarkMode, isOpen, onClose, currentUser, permissions }: SidebarProps) {
  const { isAdmin } = useAuth();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);

  const [expandedGroups, setExpandedGroups] = React.useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {
      'Chung': false,
      'Đơn hàng & Khách': true,
      'Sản xuất & Thi công': true,
      'Phòng ban': false,
      'Hệ thống': false,
    };
    navGroups.forEach(group => {
      if (group.items.some(item => item.id === activeTab)) {
        initial[group.title] = true;
      }
    });
    return initial;
  });

  React.useEffect(() => {
    navGroups.forEach(group => {
      if (group.items.some(item => item.id === activeTab)) {
        setExpandedGroups(prev => ({ ...prev, [group.title]: true }));
      }
    });
  }, [activeTab]);

  const toggleGroup = (title: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [title]: !prev[title]
    }));
  };

  const filterItem = (item: any) => {
    // Admin only items
    if (item.isAdminOnly) return isAdmin;
    // If no permission key defined, it's always visible (like dashboard)
    if (!item.permission) return true;
    // Use the passed permissions object if available
    if (permissions) {
      return permissions[item.permission] !== false;
    }
    // Fallback: check on currentUser.permissions directly
    const isManager = isAdmin || !!currentUser?.role?.toLowerCase()?.includes('quản lý');
    if (isManager) return true;
    if (currentUser?.permissions) {
      return (currentUser.permissions as any)[item.permission] !== false;
    }
    return true;
  };

  return (
    <>
      {/* ... existing mobile overlay ... */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-[999] md:hidden"
          />
        )}
      </AnimatePresence>

      <div className={cn(
        "h-screen border-r border-border bg-card transition-all duration-300 ease-in-out flex flex-col fixed md:relative z-[1000]",
        isCollapsed ? "w-[80px]" : "w-[280px]",
        !isOpen && "translate-x-[-100%] md:translate-x-0",
        isOpen && "translate-x-0"
      )}>
        {/* ... existing header ... */}
        <div className="p-4 md:p-6 mb-2 flex items-center justify-between">
          {(!isCollapsed || isOpen) && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2.5 font-bold text-lg tracking-tight text-primary"
            >
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-md shadow-primary/20">
                <Briefcase className="h-4 w-4" />
              </div>
              <span className="text-primary">TỦ 3 MIỀN</span>
            </motion.div>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => isOpen ? onClose?.() : setIsCollapsed(!isCollapsed)}
            className={cn(
              "h-8 w-8 rounded-lg hover:bg-secondary transition-all",
              isCollapsed && !isOpen ? "mx-auto" : "ml-auto"
            )}
          >
            {isCollapsed && !isOpen ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
          </Button>
        </div>

        <ScrollArea className="flex-1 px-3">
          <nav className="space-y-3 py-2">
            {navGroups.map((group, idx) => {
              const groupItems = group.items.filter(filterItem);
              if (groupItems.length === 0) return null;

              const isExpanded = isCollapsed && !isOpen ? true : !!expandedGroups[group.title];

              return (
                <div key={idx} className="space-y-1">
                  {(!isCollapsed || isOpen) && (
                    <button
                      onClick={() => toggleGroup(group.title)}
                      className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-secondary/40 rounded-xl text-left transition-colors group/header"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 group-hover/header:text-foreground transition-colors">
                        {group.title}
                      </span>
                      <ChevronDown className={cn(
                        "h-3.5 w-3.5 text-muted-foreground/50 group-hover/header:text-foreground transition-transform duration-200",
                        isExpanded ? "transform rotate-180" : ""
                      )} />
                    </button>
                  )}
                  <div className={cn(
                    "space-y-0.5 overflow-hidden transition-all duration-200",
                    isExpanded ? "max-h-[500px] opacity-100 mt-1" : "max-h-0 opacity-0 pointer-events-none"
                  )}>
                    {groupItems.map((item) => (
                      <Button
                        key={item.id}
                        variant="ghost"
                        className={cn(
                          "w-full justify-start gap-3 h-10 rounded-xl transition-all duration-200 group",
                          activeTab === item.id 
                            ? "bg-primary/10 text-primary font-semibold shadow-sm shadow-primary/5" 
                            : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
                          isCollapsed && !isOpen && "justify-center px-0"
                        )}
                        onClick={() => {
                          setActiveTab(item.id);
                          if (isOpen) {
                            onClose?.();
                          }
                        }}
                      >
                        <item.icon className={cn(
                          "h-4.5 w-4.5 shrink-0 transition-transform group-hover:scale-110",
                          activeTab === item.id ? "text-primary" : "text-muted-foreground/70"
                        )} />
                        {(!isCollapsed || isOpen) && <span className="text-sm tracking-tight">{item.label}</span>}
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>
        </ScrollArea>

      <div className="p-4 mt-auto border-t border-border bg-secondary/30 space-y-1">
        {isAdmin && (
          <>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start gap-3 h-10 rounded-xl text-muted-foreground hover:bg-secondary",
                isCollapsed && "justify-center px-0"
              )}
              onClick={() => setIsSettingsOpen(true)}
            >
              <Settings className="h-4.5 w-4.5" />
              {!isCollapsed && <span className="text-sm">Cấu hình API</span>}
            </Button>
            <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
          </>
        )}
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-3 h-10 rounded-xl text-muted-foreground hover:bg-secondary",
            isCollapsed && "justify-center px-0"
          )}
          onClick={toggleDarkMode}
        >
          {isDarkMode ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
          {!isCollapsed && <span className="text-sm">{isDarkMode ? 'Giao diện Sáng' : 'Giao diện Tối'}</span>}
        </Button>
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-3 h-10 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10",
            isCollapsed && "justify-center px-0"
          )}
          onClick={authService.logout}
        >
          <LogOut className="h-4.5 w-4.5" />
          {!isCollapsed && <span className="text-sm">Đăng xuất</span>}
        </Button>
      </div>
    </div>
    </>
  );
}
