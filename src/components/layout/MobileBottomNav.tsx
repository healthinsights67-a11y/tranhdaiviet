import * as React from 'react';
import { cn } from '@/src/lib/utils';
import { LayoutDashboard, CalendarDays, Repeat, Menu, Contact } from 'lucide-react';

import { Member } from '@/src/types';

interface MobileBottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onMenuClick: () => void;
  currentUser: Member | null;
  permissions?: Record<string, boolean>;
}

export function MobileBottomNav({ activeTab, setActiveTab, onMenuClick, currentUser, permissions }: MobileBottomNavProps) {
  const tabs = [
    { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'customers', label: 'Khách hàng', icon: Contact, permission: 'menuCustomers' },
    { id: 'production', label: 'Sản xuất', icon: CalendarDays, permission: 'menuProduction' },
  ];

  const filteredTabs = tabs.filter(tab => {
    if (!tab.permission) return true;
    if (permissions) return permissions[tab.permission] !== false;
    const isManager = currentUser?.role?.toLowerCase().includes('quản lý');
    if (isManager) return true;
    if (currentUser?.permissions) {
      return (currentUser.permissions as any)[tab.permission] !== false;
    }
    return true;
  });

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background/85 backdrop-blur-xl border-t border-border z-50 flex items-center justify-around px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.2)]">
      {filteredTabs.map(tab => (
        <button
          key={tab.id}
          className={cn(
            "flex flex-col items-center justify-center w-full h-12 space-y-1 text-[10px]",
            activeTab === tab.id ? "text-primary" : "text-muted-foreground"
          )}
          onClick={() => setActiveTab(tab.id)}
        >
          <tab.icon className={cn("h-5 w-5 transition-all", activeTab === tab.id ? "text-primary scale-110" : "text-muted-foreground/70")} />
          <span className={cn("font-medium tracking-tight", activeTab === tab.id ? "font-bold" : "")}>{tab.label}</span>
        </button>
      ))}
      <button
        className="flex flex-col items-center justify-center w-full h-12 space-y-1 text-[10px] text-muted-foreground"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5 text-muted-foreground/70" />
        <span className="font-medium tracking-tight">Menu</span>
      </button>
    </div>
  );
}
