import * as React from 'react';
import { Component } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { auth, db, onSnapshot, query, collection, orderBy, handleFirestoreError, OperationType, where } from './lib/firebase';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LoginForm } from './components/auth/LoginForm';
import { fetchTasks, fetchCustomers, fetchMembers, fetchFolders, fetchQuotations, fetchMeasurementSchedules, fetchProductLibrary, fetchInstallationSchedules } from './services/dataService';
import { Sidebar } from './components/layout/Sidebar';
import { Navbar } from './components/layout/Navbar';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
const Dashboard = React.lazy(() => import('./components/dashboard/Dashboard').then(module => ({ default: module.Dashboard })));
const KanbanBoard = React.lazy(() => import('./components/kanban/KanbanBoard').then(module => ({ default: module.KanbanBoard })));
const MemberPage = React.lazy(() => import('./components/members/MemberPage').then(module => ({ default: module.MemberPage })));
const CustomerPage = React.lazy(() => import('./components/customers/CustomerPage').then(module => ({ default: module.CustomerPage })));
const AIRenderPage = React.lazy(() => import('./components/ai-render/AIRenderPage'));
const ProductionCalendar = React.lazy(() => import('./components/production/ProductionCalendar').then(module => ({ default: module.ProductionCalendar })));
const MediaLibrary = React.lazy(() => import('./components/media/MediaLibrary').then(module => ({ default: module.MediaLibrary })));
const ProductDocuments = React.lazy(() => import('./components/documents/ProductDocuments').then(module => ({ default: module.ProductDocuments })));
const QuotationPage = React.lazy(() => import('./components/quotations/QuotationPage').then(module => ({ default: module.QuotationPage })));
const MeasurementPage = React.lazy(() => import('./components/measurements/MeasurementPage').then(module => ({ default: module.MeasurementPage })));
const InstallationPage = React.lazy(() => import('./components/installations/InstallationPage').then(module => ({ default: module.InstallationPage })));
const ReportPage = React.lazy(() => import('./components/reports/ReportPage').then(module => ({ default: module.ReportPage })));
const UserManagement = React.lazy(() => import('./components/admin/UserManagement').then(module => ({ default: module.UserManagement })));
const TrashPage = React.lazy(() => import('./components/trash/TrashPage'));
const MaterialConfigPage = React.lazy(() => import('./components/materials/MaterialConfigPage').then(module => ({ default: module.MaterialConfigPage })));
import { MOCK_TASKS, MOCK_MEMBERS, MOCK_CUSTOMERS, MOCK_QUOTATIONS } from './lib/mockData';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { NotificationManager } from './components/notifications/NotificationManager';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, Clock, UserCircle, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Task, Customer, Member, InstallationSchedule } from './types';

function ErrorFallback({ error, resetErrorBoundary }: { error: any, resetErrorBoundary: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-screen p-6 text-center space-y-4 bg-background">
      <div className="p-4 bg-destructive/10 rounded-full">
        <AlertTriangle className="h-10 w-10 text-destructive" />
      </div>
      <h2 className="text-xl font-bold">Không thể kết nối hệ thống</h2>
      <p className="text-muted-foreground max-w-xs text-sm">
        Có vẻ như đã xảy ra sự cố kết nối hoặc phiên đăng nhập của bạn đã hết hạn.
      </p>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <Button onClick={resetErrorBoundary} className="w-full">
          Thử kết nối lại
        </Button>
        <Button 
          variant="outline" 
          onClick={() => window.location.href = window.location.origin} 
          className="w-full"
        >
          Trang chủ
        </Button>
      </div>
      {process.env.NODE_ENV !== 'production' && (
        <pre className="mt-8 p-4 bg-muted rounded-lg text-[10px] overflow-auto max-w-full text-left opacity-50">
          {error?.message || String(error)}
        </pre>
      )}
    </div>
  );
}


function AppContent() {
  const { user, userProfile, loading, signOut, isLoginDialogOpen, setLoginDialogOpen, isApproved, isAdmin } = useAuth();
  
  const [activeTab, setActiveTab] = React.useState('dashboard');
  const [isDarkMode, setIsDarkMode] = React.useState(() => {
    // Check if user has previously saved a theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    // Default to system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  const [tasksState, setTasks] = React.useState<Task[]>(MOCK_TASKS);
  const [customersState, setCustomers] = React.useState<Customer[]>(MOCK_CUSTOMERS);
  const [membersState, setMembers] = React.useState<Member[]>(MOCK_MEMBERS);

  const [localFolders, setFolders] = React.useState<any[]>([]);

  // Real-time synchronization
  const queryClient = useQueryClient();
  React.useEffect(() => {
    if (!user) return;

    const customersQuery = query(collection(db, 'customers'), orderBy('createdAt', 'desc'));
    const unsubscribeCustomers = onSnapshot(customersQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Customer[];
      queryClient.setQueryData(['customers'], data);
    }, (error) => {
      // Chỉ log lỗi, không handleFirestoreError để tránh reload loop do ErrorBoundary
      console.warn('Real-time sync (customers) limited or delayed:', error.message);
    });

    const tasksQuery = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Task[];
      queryClient.setQueryData(['tasks'], data);
    }, (error) => {
      console.warn('Real-time sync (tasks) limited or delayed:', error.message);
    });

    const membersQuery = query(collection(db, 'members'), orderBy('name', 'asc'));
    const unsubscribeMembers = onSnapshot(membersQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Member[];
      queryClient.setQueryData(['members'], data);
    }, (error) => {
      console.warn('Real-time sync (members) limited or delayed:', error.message);
    });

    const foldersQuery = query(collection(db, 'media_folders'), orderBy('createdAt', 'desc'));
    const unsubscribeFolders = onSnapshot(foldersQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      queryClient.setQueryData(['folders'], data);
    }, (error) => {
      console.warn('Real-time sync (folders) limited or delayed:', error.message);
    });

    const quotationsQuery = query(collection(db, 'quotations'), orderBy('createdAt', 'desc'));
    const unsubscribeQuotations = onSnapshot(quotationsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      queryClient.setQueryData(['quotations'], data);
    }, (error) => {
      console.warn('Real-time sync (quotations) limited or delayed:', error.message);
    });

    const schedulesQuery = query(collection(db, 'measurement_schedules'), orderBy('createdAt', 'desc'));
    const unsubscribeSchedules = onSnapshot(schedulesQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      queryClient.setQueryData(['measurement_schedules'], data);
    }, (error) => {
      console.warn('Real-time sync (schedules) limited or delayed:', error.message);
    });

    const installationsQuery = query(collection(db, 'installation_schedules'), orderBy('createdAt', 'desc'));
    const unsubscribeInstallations = onSnapshot(installationsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      queryClient.setQueryData(['installation_schedules'], data);
    }, (error) => {
      console.warn('Real-time sync (installations) limited or delayed:', error.message);
    });

    const productLibraryQuery = query(collection(db, 'product_library'), orderBy('createdAt', 'desc'));
    const unsubscribeProductLibrary = onSnapshot(productLibraryQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      queryClient.setQueryData(['product_library'], data);
    }, (error) => {
      console.warn('Real-time sync (library) limited or delayed:', error.message);
    });

    return () => {
      unsubscribeCustomers();
      unsubscribeTasks();
      unsubscribeMembers();
      unsubscribeFolders();
      unsubscribeQuotations();
      unsubscribeSchedules();
      unsubscribeInstallations();
      unsubscribeProductLibrary();
    };
  }, [user, queryClient]);

  // TanStack Query
  const { data: tasksData, isLoading: isTasksLoading } = useQuery({ 
    queryKey: ['tasks'], 
    queryFn: fetchTasks, 
    enabled: !!user,
    staleTime: Infinity 
  });
  const { data: customersData, isLoading: isCustomersLoading } = useQuery({ 
    queryKey: ['customers'], 
    queryFn: fetchCustomers, 
    enabled: !!user,
    staleTime: Infinity 
  });
  const { data: membersData, isLoading: isMembersLoading } = useQuery({ 
    queryKey: ['members'], 
    queryFn: fetchMembers, 
    enabled: !!user,
    staleTime: Infinity 
  });
  const { data: foldersData = [], isLoading: isFoldersLoading } = useQuery({ 
    queryKey: ['folders'], 
    queryFn: fetchFolders, 
    enabled: !!user,
    staleTime: Infinity 
  });
  const { data: quotationsData, isLoading: isQuotationsLoading } = useQuery({ 
    queryKey: ['quotations'], 
    queryFn: fetchQuotations, 
    enabled: !!user,
    staleTime: Infinity 
  });
  const { data: schedulesData = [], isLoading: isSchedulesLoading } = useQuery({ 
    queryKey: ['measurement_schedules'], 
    queryFn: fetchMeasurementSchedules, 
    enabled: !!user,
    staleTime: Infinity 
  });
  const { data: installationsData = [], isLoading: isInstallationsLoading } = useQuery({ 
    queryKey: ['installation_schedules'], 
    queryFn: fetchInstallationSchedules, 
    enabled: !!user,
    staleTime: Infinity 
  });
  const { data: productLibraryData = [], isLoading: isProductLibraryLoading } = useQuery({ 
    queryKey: ['product_library'], 
    queryFn: fetchProductLibrary, 
    enabled: !!user,
    staleTime: Infinity 
  });

  const tasks = user ? (tasksData || []) : MOCK_TASKS;
  const customers = user ? (customersData || []) : MOCK_CUSTOMERS;
  const members = user ? (membersData || []) : MOCK_MEMBERS;
  const quotations = user ? (quotationsData || []) : MOCK_QUOTATIONS;
  const folders = foldersData;
  const installations = user ? (installationsData || []) : [];
  
  const handleLogout = signOut;

  // Find current member profile based on logged in user's email
  const currentMember = user ? (
    members.find(m => m.email?.trim().toLowerCase() === user.email?.trim().toLowerCase()) || 
    MOCK_MEMBERS.find(m => m.email?.trim().toLowerCase() === user.email?.trim().toLowerCase())
  ) : null;

  const isManager = isAdmin || (currentMember?.role?.toLowerCase().includes('quản lý'));

  // Determine if we should show all data (Manager or missing profile for now)
  const showAllData = !user || isManager || !currentMember;

  // Permissions helper: managers/admins bypass all; others follow their member.permissions
  const DEFAULT_PERMS = {
    viewPrice: true, viewRevenue: true,
    menuProduction: true, menuMeasurement: true, menuOrders: true,
    menuQuotations: true, menuSale: true, menuDesign: true,
    menuMarketing: true, menuReports: true, menuMedia: true,
    menuMembers: true, menuCustomers: true, menuAi: true,
  };
  const perms = isManager || !currentMember
    ? DEFAULT_PERMS
    : { ...DEFAULT_PERMS, ...(currentMember.permissions || {}) };

  // Filtered data based on role and workshop
  const isWorkshopRestricted = !!(currentMember && currentMember.workshop && currentMember.workshop !== 'all');
  const userWorkshop = currentMember?.workshop;

  // Filtered members list
  const activeMembers = React.useMemo(() => {
    const raw = user ? members : MOCK_MEMBERS;
    if (isWorkshopRestricted) {
      return raw.filter(m => m.workshop === userWorkshop || m.workshop === 'all' || !m.workshop);
    }
    return raw;
  }, [user, members, isWorkshopRestricted, userWorkshop]);

  const filteredCustomers = React.useMemo(() => {
    if (!user) return MOCK_CUSTOMERS;
    return customers.filter(c => {
      if (isWorkshopRestricted && c.workshop !== userWorkshop) {
        return false;
      }
      if (!isManager && !isWorkshopRestricted) {
        return c.assignedSaleId === currentMember?.id;
      }
      return true;
    });
  }, [user, customers, isWorkshopRestricted, userWorkshop, isManager, currentMember]);

  const filteredTasks = React.useMemo(() => {
    if (!user) return MOCK_TASKS;
    return tasks.filter(t => {
      if (isWorkshopRestricted) {
        if (t.workshop && t.workshop !== userWorkshop) return false;
        if (!t.workshop && t.customerId) {
          const cust = customers.find(c => c.id === t.customerId);
          if (cust && cust.workshop !== userWorkshop) return false;
        }
      }
      if (!isManager && !isWorkshopRestricted) {
        return t.assigneeId === currentMember?.id;
      }
      return true;
    });
  }, [user, tasks, customers, isWorkshopRestricted, userWorkshop, isManager, currentMember]);

  const filteredQuotations = React.useMemo(() => {
    if (!user) return MOCK_QUOTATIONS;
    return quotations.filter(q => {
      if (isWorkshopRestricted) {
        if (q.workshop && q.workshop !== userWorkshop) return false;
        if (!q.workshop && q.customerId) {
          const cust = customers.find(c => c.id === q.customerId);
          if (cust && cust.workshop !== userWorkshop) return false;
        }
      }
      return true;
    });
  }, [user, quotations, customers, isWorkshopRestricted, userWorkshop]);

  const filteredSchedulesData = React.useMemo(() => {
    if (!user) return [];
    return schedulesData.filter(s => {
      if (isWorkshopRestricted) {
        if (s.customerId) {
          const cust = customers.find(c => c.id === s.customerId);
          if (cust && cust.workshop !== userWorkshop) return false;
        }
      }
      return true;
    });
  }, [user, schedulesData, customers, isWorkshopRestricted, userWorkshop]);

  const filteredInstallations = React.useMemo(() => {
    if (!user) return [];
    return installations.filter(s => {
      if (isWorkshopRestricted) {
        if (s.customerId) {
          const cust = customers.find(c => c.id === s.customerId);
          if (cust && cust.workshop !== userWorkshop) return false;
        }
      }
      return true;
    });
  }, [user, installations, customers, isWorkshopRestricted, userWorkshop]);

  React.useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const renderContent = () => {
    // Guard: redirect unauthorized tabs back to dashboard
    const redirect = (allowed: boolean) => !allowed;

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard tasks={filteredTasks} members={activeMembers}  customers={filteredCustomers} quotations={filteredQuotations} currentUser={currentMember} />;
      case 'reports':
        return redirect(perms.menuReports)
          ? <Dashboard tasks={filteredTasks} members={activeMembers}  customers={filteredCustomers} quotations={filteredQuotations} currentUser={currentMember} />
          : <ReportPage tasks={filteredTasks} members={activeMembers}  customers={filteredCustomers} quotations={filteredQuotations} />;
      case 'production':
        return redirect(perms.menuProduction)
          ? <Dashboard tasks={filteredTasks} members={activeMembers} customers={filteredCustomers} quotations={filteredQuotations} currentUser={currentMember} />
          : <ProductionCalendar tasks={filteredTasks} setTasks={setTasks} members={activeMembers} user={user} customers={filteredCustomers} currentUser={currentMember} />;
      case 'sale':
        return redirect(perms.menuSale)
          ? <Dashboard tasks={filteredTasks} members={activeMembers} customers={filteredCustomers} quotations={filteredQuotations} currentUser={currentMember} />
          : <KanbanBoard tasks={filteredTasks.filter(t => t.type === 'sale')} setTasks={setTasks} members={activeMembers} type="sale" user={user} customers={filteredCustomers} currentUser={currentMember} />;
      case 'marketing':
        return redirect(perms.menuMarketing)
          ? <Dashboard tasks={filteredTasks} members={activeMembers} customers={filteredCustomers} quotations={filteredQuotations} currentUser={currentMember} />
          : <KanbanBoard tasks={filteredTasks.filter(t => t.type === 'marketing')} setTasks={setTasks} members={activeMembers} type="marketing" user={user} customers={filteredCustomers} currentUser={currentMember} />;
      case 'design':
        return redirect(perms.menuDesign)
          ? <Dashboard tasks={filteredTasks} members={activeMembers} customers={filteredCustomers} quotations={filteredQuotations} currentUser={currentMember} />
          : <KanbanBoard tasks={filteredTasks.filter(t => t.type === 'design')} setTasks={setTasks} members={activeMembers} type="design" user={user} customers={filteredCustomers} currentUser={currentMember} />;
      case 'employees':
        return redirect(perms.menuMembers)
          ? <Dashboard tasks={filteredTasks} members={activeMembers} customers={filteredCustomers} quotations={filteredQuotations} currentUser={currentMember} />
          : <MemberPage members={activeMembers} setMembers={setMembers} tasks={filteredTasks} user={user} currentUser={currentMember} />;
      case 'media':
        return redirect(perms.menuMedia)
          ? <Dashboard tasks={filteredTasks} members={activeMembers} customers={filteredCustomers} quotations={filteredQuotations} currentUser={currentMember} />
          : <MediaLibrary folders={folders} user={user} />;
      case 'documents':
        return redirect(perms.menuMedia)
          ? <Dashboard tasks={filteredTasks} members={activeMembers} customers={filteredCustomers} quotations={filteredQuotations} currentUser={currentMember} />
          : <ProductDocuments />;
      case 'quotations':
        return redirect(perms.menuQuotations)
          ? <Dashboard tasks={filteredTasks} members={activeMembers} customers={filteredCustomers} quotations={filteredQuotations} currentUser={currentMember} />
          : <QuotationPage quotations={filteredQuotations} user={user} customers={filteredCustomers} members={activeMembers} products={productLibraryData} />;
      case 'measurements':
        return redirect(perms.menuMeasurement)
          ? <Dashboard tasks={filteredTasks} members={activeMembers} customers={filteredCustomers} quotations={filteredQuotations} currentUser={currentMember} />
          : <MeasurementPage schedules={filteredSchedulesData} members={activeMembers} customers={filteredCustomers} user={user} currentUser={currentMember} />;
      case 'installations':
        return redirect(perms.menuOrders)
          ? <Dashboard tasks={filteredTasks} members={activeMembers} customers={filteredCustomers} quotations={filteredQuotations} currentUser={currentMember} />
          : <InstallationPage schedules={filteredInstallations} members={activeMembers} customers={filteredCustomers} tasks={filteredTasks} setTasks={setTasks} user={user} currentUser={currentMember} />;
      case 'customers':
        return redirect(perms.menuCustomers)
          ? <Dashboard tasks={filteredTasks} members={activeMembers} customers={filteredCustomers} quotations={filteredQuotations} currentUser={currentMember} />
          : <CustomerPage customers={filteredCustomers} setCustomers={setCustomers} tasks={filteredTasks} setTasks={setTasks} members={activeMembers} quotations={filteredQuotations} schedules={filteredSchedulesData} user={user} currentUser={currentMember} />;
      case 'ai-render':
        return redirect(perms.menuAi)
          ? <Dashboard tasks={filteredTasks} members={activeMembers} customers={filteredCustomers} quotations={filteredQuotations} currentUser={currentMember} />
          : <AIRenderPage />;
      case 'users':
        return isAdmin ? <UserManagement /> : <Dashboard tasks={filteredTasks} members={activeMembers} customers={filteredCustomers} quotations={filteredQuotations} currentUser={currentMember} />;
      case 'materials':
        return <MaterialConfigPage tasks={filteredTasks} quotations={filteredQuotations} />;
      case 'trash':
        return <TrashPage currentUser={currentMember} />;
      default:
        return (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Trang đang được phát triển
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-sm font-medium animate-pulse">Khởi tạo hệ thống...</p>
      </div>
    );
  }

  // Handle data loading separately - show a more integrated loading state inside the App
  // or just let the components handle their own MOCK/Empty states while loading.
  // We avoid the full-screen blanker once auth is resolved.


  if (user && !isApproved && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-6 text-center space-y-6 bg-slate-50">
        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 shadow-sm animate-bounce">
          <Clock className="h-10 w-10" />
        </div>
        <div className="space-y-2 max-w-sm">
          <h2 className="text-2xl font-bold text-slate-900">Tài khoản chờ duyệt</h2>
          <p className="text-slate-500 text-sm">
            Chào <strong>{user.email}</strong>, tài khoản của bạn đã được đăng ký thành công và đang chờ Quản trị viên phê duyệt.
          </p>
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-blue-700 text-[11px] mt-4">
             Vui lòng quay lại sau khi nhận được xác nhận từ Admin.
          </div>
        </div>
        <Button variant="outline" onClick={() => signOut()} className="gap-2">
           Đăng xuất
        </Button>
      </div>
    );
  }

  return (
    <ErrorBoundary 
      FallbackComponent={ErrorFallback}
      onReset={() => {
        // Reset query client or states here if needed
        queryClient.invalidateQueries();
      }}
    >
      <div className="flex h-dvh bg-background text-foreground overflow-hidden relative">
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={(tab) => {
            setActiveTab(tab);
            setIsSidebarOpen(false);
          }} 
          isDarkMode={isDarkMode} 
          toggleDarkMode={() => setIsDarkMode(!isDarkMode)} 
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          currentUser={currentMember}
          permissions={perms}
        />
        
        <div className="flex-1 flex flex-col min-w-0">
          {!user && (
            <div className="flex items-center justify-between px-4 md:px-6 py-2 bg-secondary border-b border-border">
              <div className="flex items-center gap-2 text-[10px] md:text-xs font-medium text-muted-foreground">
                <UserCircle className="h-3.5 w-3.5 md:h-4 w-4" />
                <span className="hidden xs:inline">Chế độ xem trước (Dữ liệu mẫu). Đăng nhập để đồng bộ dữ liệu thực tế.</span>
              </div>
              <Dialog open={isLoginDialogOpen} onOpenChange={setLoginDialogOpen}>
                <DialogTrigger 
                  render={(
                    <Button variant="outline" size="sm" className="h-7 text-[10px] md:text-xs">
                       Đăng nhập
                    </Button>
                  ) as React.ReactElement}
                />
                <DialogContent className="max-w-[calc(100vw-2rem)] md:max-w-md rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
                    <LoginForm />
                </DialogContent>
              </Dialog>
            </div>
          )}
          <Navbar 
            onMenuClick={() => setIsSidebarOpen(true)} 
            user={user} 
            onLogin={() => setLoginDialogOpen(true)} 
            onLogout={handleLogout} 
            currentUser={currentMember}
          />
          <main className="flex-1 overflow-y-auto px-3 md:px-10 py-4 md:py-8 pb-28 md:pb-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="min-h-full"
              >
                <React.Suspense fallback={
                  <div className="flex h-[50vh] items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                }>
                  {renderContent()}
                </React.Suspense>
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
        <MobileBottomNav 
          activeTab={activeTab} 
          setActiveTab={(tab) => {
            setActiveTab(tab);
            setIsSidebarOpen(false);
          }} 
          onMenuClick={() => setIsSidebarOpen(true)}
          currentUser={currentMember}
          permissions={perms}
        />
        <Toaster position="top-center" />
        <NotificationManager />
      </div>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function MyTasks({ tasks }: { tasks: typeof MOCK_TASKS }) {
  // Mock current user ID as '1' (Alex Rivera)
  const myTasks = tasks.filter(t => t.assigneeId === '1');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Nhiệm vụ của tôi</h1>
        <p className="text-muted-foreground">Tập trung vào những gì quan trọng. Đây là các nhiệm vụ được giao cho bạn.</p>
      </div>

      <div className="grid gap-4">
        {myTasks.map((task, i) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="hover:bg-gray-50 transition-colors cursor-pointer border border-gray-200 shadow-sm">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex-shrink-0">
                  {task.status === 'done' ? (
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  ) : (
                    <Circle className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold">{task.title}</h3>
                  <p className="text-xs text-muted-foreground">{task.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="hidden sm:flex capitalize">
                    {task.status === 'todo' ? 'Cần làm' : 
                     task.status === 'in-progress' ? 'Đang làm' : 
                     task.status === 'review' ? 'Đánh giá' : 'Hoàn thành'}
                  </Badge>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                    <Clock className="h-3.5 w-3.5" />
                    {task.dueDate}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
        {myTasks.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            Chưa có nhiệm vụ nào được giao cho bạn.
          </div>
        )}
      </div>
    </div>
  );
}
