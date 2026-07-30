import * as React from 'react';
import { SalesRoute, Member } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Search, Navigation } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { db, collection, query, where, getDocs, orderBy, addDoc } from '@/src/lib/firebase';
import { fetchMembers, fetchCustomers } from '@/src/services/dataService';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/src/contexts/AuthContext';
import { toast } from 'sonner';
import { useOfflineSync } from '@/src/hooks/useOfflineSync';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet marker icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Haversine formula to calculate distance between two coordinates in km
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;  // deg2rad below
  const dLon = (lon2 - lon1) * Math.PI / 180; 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // Distance in km
  return d;
}

function formatDistance(km: number): string {
  if (km === 0) return '0 m';
  if (km < 0.1) {
    const meters = Math.round(km * 1000);
    return `${meters} m`;
  }
  if (km < 1.0) {
    const meters = Math.round(km * 1000);
    return `${Math.round(meters / 10) * 10} m`;
  }
  return `${km.toFixed(1)} km`;
}

const openMapLink = (url: string) => {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobile) {
    window.location.href = url;
  } else {
    window.open(url, '_blank');
  }
};

const openFullRouteOnGoogleMaps = (routes: SalesRoute[]) => {
  if (routes.length === 0) return;

  if (routes.length === 1) {
    openMapLink(`https://www.google.com/maps/search/?api=1&query=${routes[0].latitude},${routes[0].longitude}`);
    return;
  }

  const origin = `${routes[0].latitude},${routes[0].longitude}`;
  const destination = `${routes[routes.length - 1].latitude},${routes[routes.length - 1].longitude}`;

  if (routes.length === 2) {
    openMapLink(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`);
    return;
  }

  // 3 or more points: construct waypoints parameter
  const waypoints = routes
    .slice(1, -1)
    .map(r => `${r.latitude},${r.longitude}`)
    .join('|');

  openMapLink(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}`);
};

export function SalesRoutePage() {
  const [date, setDate] = React.useState<string>(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isCheckingIn, setIsCheckingIn] = React.useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = React.useState(false);
  const [noteInput, setNoteInput] = React.useState('');
  const [customerInput, setCustomerInput] = React.useState('');
  const [phoneInput, setPhoneInput] = React.useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = React.useState(false);
  const [tempCoords, setTempCoords] = React.useState<{ lat: number; lng: number } | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'list' | 'map'>('list');

  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isOnline, pendingCount, addOfflineCheckin } = useOfflineSync();

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: fetchMembers
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: fetchCustomers
  });

  const filteredCustomersForDropdown = React.useMemo(() => {
    if (!customerInput) return customers;
    const lower = customerInput.toLowerCase();
    return customers.filter(c => 
      c.name.toLowerCase().includes(lower) || 
      (c.phone && c.phone.includes(lower))
    );
  }, [customers, customerInput]);

  // Helper to fetch address from OpenStreetMap Nominatim with a timeout fallback
  const fetchAddressWithTimeout = async (lat: number, lng: number): Promise<string> => {
    const fetchPromise = fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=vi`, {
      headers: {
        'User-Agent': 'i-noi-that-v2-sales-tracking'
      }
    }).then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        return data.display_name || '';
      }
      return '';
    }).catch(() => '');

    // Timeout after 2.5 seconds to avoid locking user flow if OSM is slow
    const timeoutPromise = new Promise<string>((resolve) => setTimeout(() => resolve(''), 2500));

    return Promise.race([fetchPromise, timeoutPromise]);
  };

  const handleCheckIn = () => {
    if (!navigator.geolocation) {
      toast.error("Trình duyệt của bạn không hỗ trợ định vị GPS.");
      return;
    }

    setIsCheckingIn(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setTempCoords({ lat, lng });
        setIsCheckingIn(false);
        setIsNoteModalOpen(true);
      },
      (error) => {
        setIsCheckingIn(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error("Vui lòng cấp quyền truy cập GPS cho trang web để check-in.");
            break;
          case error.POSITION_UNAVAILABLE:
            toast.error("Không thể xác định vị trí GPS hiện tại.");
            break;
          case error.TIMEOUT:
            toast.error("Yêu cầu lấy vị trí hết thời gian chờ.");
            break;
          default:
            toast.error("Lỗi xác định vị trí.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const confirmCheckIn = async () => {
    if (!tempCoords) return;

    setIsSaving(true);
    try {
      const { lat, lng } = tempCoords;
      const now = new Date().toISOString();

      // Get address asynchronously
      const address = await fetchAddressWithTimeout(lat, lng);

      // Find matching member
      const currentMember = members.find(m => m.email?.toLowerCase() === user?.email?.toLowerCase());
      
      // Attempt to match customer
      const selectedCustomer = customers.find(c => 
        c.id === customerInput || 
        customerInput === `${c.name} - ${c.phone}` ||
        customerInput === c.name
      );

      // Determine final customer name string
      let finalCustomerName = '';
      let finalCustomerId = '';
      let finalCustomerPhone = '';
      
      let isNewCustomer = false;
      let customerPayload: any = null;

      if (selectedCustomer) {
        finalCustomerName = selectedCustomer.name;
        finalCustomerId = selectedCustomer.id;
        finalCustomerPhone = selectedCustomer.phone || '';
      } else if (customerInput.trim() && customerInput !== 'none') {
        finalCustomerName = customerInput.trim();
        finalCustomerPhone = phoneInput.trim() || 'Chưa có SĐT';
        
        // Only save new customer if they have a phone number (SĐT)
        const hasPhone = !!phoneInput.trim();
        if (hasPhone) {
          const newId = Math.random().toString(36).substr(2, 9);
          const newCode = `KH${new Date().getFullYear()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
          
          const customerWorkshop = currentMember?.workshop && currentMember.workshop !== 'all' 
            ? currentMember.workshop 
            : 'Hà Nội';

          customerPayload = {
            id: newId,
            code: newCode,
            name: finalCustomerName,
            phone: finalCustomerPhone,
            address: address || '',
            stage: 'consulting',
            notes: noteInput.trim() || 'Khách hàng tự động tạo từ Check-in',
            assignedSaleId: currentMember ? currentMember.id : '',
            createdAt: now,
            consultedAt: now,
            orderValue: 0,
            workshop: customerWorkshop
          };
          
          finalCustomerId = newId;
          isNewCustomer = true;
        } else {
          finalCustomerId = '';
          isNewCustomer = false;
        }
      }

      const routeData = {
        memberId: currentMember ? currentMember.id : (user?.uid || 'unknown'),
        memberName: currentMember ? currentMember.name : (user?.displayName || user?.email || 'Người dùng Web'),
        zaloUserId: currentMember?.zaloUserId || '',
        latitude: lat,
        longitude: lng,
        timestamp: now,
        note: noteInput.trim() || 'Check-in trực tiếp trên Web',
        address: address || '',
        customerId: finalCustomerId,
        customerName: finalCustomerName,
        customerPhone: finalCustomerPhone
      };

      const messageText = 
        `📍 Check-in Lịch trình Sale!\n` +
        `👤 Nhân viên: ${routeData.memberName}\n` +
        `🏠 Địa điểm: ${routeData.address || 'Không rõ địa chỉ'}\n` +
        `👥 Khách hàng: ${routeData.customerName || 'Không chọn'}` + (routeData.customerPhone ? ` - SĐT: ${routeData.customerPhone}\n` : `\n`) +
        `📝 Ghi chú: ${routeData.note}`;

      if (isOnline) {
        if (isNewCustomer && customerPayload) {
          await addDoc(collection(db, 'customers'), customerPayload);
        }
        await addDoc(collection(db, 'sales_routes'), routeData);
        toast.success("Đã ghi nhận vị trí check-in thành công!");
      } else {
        addOfflineCheckin({
          isNewCustomer,
          newCustomerPayload: customerPayload,
          routePayload: routeData,
          messageText
        });
      }

      // Reset states
      setNoteInput('');
      setCustomerInput('');
      setPhoneInput('');
      setTempCoords(null);
      setIsNoteModalOpen(false);

      // Refetch today's routes
      queryClient.invalidateQueries({ queryKey: ['sales_routes', date] });
    } catch (error) {
      console.error("Lỗi lưu vị trí:", error);
      toast.error("Không thể lưu vị trí check-in.");
    } finally {
      setIsSaving(false);
    }
  };

  const { data: routes = [], isLoading } = useQuery({
    queryKey: ['sales_routes', date],
    queryFn: async () => {
      try {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const q = query(
          collection(db, 'sales_routes'),
          where('timestamp', '>=', startOfDay.toISOString()),
          where('timestamp', '<=', endOfDay.toISOString()),
          orderBy('timestamp', 'asc')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SalesRoute));
      } catch (error) {
        console.error("Lỗi lấy lịch trình sale:", error);
        toast.error("Không thể tải lịch trình");
        return [];
      }
    }
  });

  // Group routes by actual member matched via zaloUserId
  const routesByMember = React.useMemo(() => {
    const grouped: Record<string, SalesRoute[]> = {};
    routes.forEach(route => {
      // Find the real member based on zaloUserId, only if it exists
      const realMember = route.zaloUserId ? members.find(m => m.zaloUserId === route.zaloUserId) : undefined;
      const targetMemberId = realMember ? realMember.id : route.memberId;
      const targetMemberName = realMember ? realMember.name : route.memberName;
      
      const enrichedRoute = {
        ...route,
        memberId: targetMemberId,
        memberName: targetMemberName
      };

      if (!grouped[targetMemberId]) {
        grouped[targetMemberId] = [];
      }
      grouped[targetMemberId].push(enrichedRoute);
    });
    return grouped;
  }, [routes, members]);

  const filteredMembers = Object.keys(routesByMember).filter(memberId => {
    const name = routesByMember[memberId][0]?.memberName || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const selectedCustomerMatch = customers.find(c => 
    c.id === customerInput || 
    customerInput === `${c.name} - ${c.phone}` ||
    customerInput === c.name
  );

  return (
    <div className="space-y-4 md:space-y-6 h-full flex flex-col min-h-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Lịch trình Sale</h1>
          <p className="text-[10px] md:text-xs text-muted-foreground font-medium">Theo dõi lịch trình và quãng đường di chuyển của nhân viên Sale qua Zalo.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {!isOnline && (
            <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1.5 rounded border border-amber-200">
              Offline Mode ({pendingCount} pending)
            </span>
          )}
          <Button 
            onClick={handleCheckIn} 
            disabled={isCheckingIn}
            className="flex-1 md:flex-initial h-9 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {isCheckingIn ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            ) : (
              <MapPin className="h-3.5 w-3.5" />
            )}
            {isCheckingIn ? "Đang định vị..." : "Check-in Vị Trí"}
          </Button>
          <div className="relative flex-1 md:w-40 min-w-[120px]">
            <DatePicker 
              value={date}
              onChange={setDate}
              className="h-9 text-xs bg-card w-full"
            />
          </div>
          <div className="relative w-full md:w-56 mt-1 md:mt-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input 
              placeholder="Tìm nhân viên..." 
              className="pl-8.5 h-9 text-xs bg-card text-card-foreground border border-border shadow-sm rounded-lg w-full" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex border border-border rounded-lg overflow-hidden shrink-0 mt-1 md:mt-0">
            <button 
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-xs font-semibold ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-slate-50'}`}
            >
              Danh sách
            </button>
            <button 
              onClick={() => setViewMode('map')}
              className={`px-3 py-1.5 text-xs font-semibold ${viewMode === 'map' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-slate-50'}`}
            >
              Bản đồ
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pb-10">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-muted-foreground">Đang tải dữ liệu...</p>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 border border-dashed rounded-xl bg-slate-50">
            <MapPin className="h-8 w-8 text-slate-300 mb-2" />
            <p className="text-sm text-muted-foreground font-medium">Không có dữ liệu lịch trình trong ngày này</p>
          </div>
        ) : viewMode === 'map' ? (
          <div className="h-[600px] w-full rounded-xl overflow-hidden border shadow-sm relative z-0">
            <MapContainer 
              center={
                filteredMembers.length > 0 && routesByMember[filteredMembers[0]].length > 0 
                  ? [routesByMember[filteredMembers[0]][0].latitude, routesByMember[filteredMembers[0]][0].longitude] 
                  : [21.028511, 105.804817]
              } 
              zoom={12} 
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {filteredMembers.map((memberId, memberIndex) => {
                const memberRoutes = routesByMember[memberId];
                if (memberRoutes.length === 0) return null;
                
                // Color palette for different members
                const colors = ['#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
                const color = colors[memberIndex % colors.length];

                return (
                  <React.Fragment key={memberId}>
                    {memberRoutes.map((route, idx) => (
                      <Marker key={route.id || idx} position={[route.latitude, route.longitude]}>
                        <Popup>
                          <div className="text-sm">
                            <p className="font-bold">{route.memberName}</p>
                            <p className="text-xs text-muted-foreground">{new Date(route.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p>
                            {route.customerName && <p className="text-primary font-semibold mt-1">{route.customerName}</p>}
                            {route.customerPhone && <p className="text-xs">{route.customerPhone}</p>}
                            <p className="text-xs mt-1">{route.address}</p>
                            <p className="text-xs italic mt-1">{route.note}</p>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                    {memberRoutes.length > 1 && (
                      <Polyline 
                        positions={memberRoutes.map(r => [r.latitude, r.longitude])} 
                        color={color}
                        weight={3}
                        opacity={0.7}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </MapContainer>
          </div>
        ) : (
          filteredMembers.map(memberId => {
            const memberRoutes = routesByMember[memberId];
            const memberName = memberRoutes[0].memberName;
            
            let totalDistance = 0;
            for (let i = 1; i < memberRoutes.length; i++) {
              totalDistance += calculateDistance(
                memberRoutes[i-1].latitude, memberRoutes[i-1].longitude,
                memberRoutes[i].latitude, memberRoutes[i].longitude
              );
            }

            return (
              <Card key={memberId} className="shadow-sm">
                <CardHeader className="py-4 border-b bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-bold text-slate-800">{memberName}</CardTitle>
                      <CardDescription className="text-xs flex items-center gap-2 mt-1">
                        <span>{memberRoutes.length} điểm check-in</span>
                        {memberRoutes.length > 1 && (
                          <Button 
                            variant="link" 
                            className="h-auto p-0 text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                            onClick={() => openFullRouteOnGoogleMaps(memberRoutes)}
                          >
                            <Navigation className="h-3 w-3" />
                            Xem lộ trình đi
                          </Button>
                        )}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-primary">{formatDistance(totalDistance)}</div>
                      <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Tổng quãng đường</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {memberRoutes.map((route, index) => {
                      const time = new Date(route.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                      
                      let distanceFromPrev = 0;
                      if (index > 0) {
                        distanceFromPrev = calculateDistance(
                          memberRoutes[index-1].latitude, memberRoutes[index-1].longitude,
                          route.latitude, route.longitude
                        );
                      }

                      return (
                        <div key={route.id} className="p-4 hover:bg-slate-50 flex items-start gap-4 transition-colors">
                          <div className="shrink-0 pt-1">
                            <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">
                              {index + 1}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-slate-900">{time}</span>
                              {index > 0 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-bold flex items-center gap-1">
                                  <Navigation className="h-3 w-3" />
                                  Cách điểm trước: {formatDistance(distanceFromPrev)}
                                </span>
                              )}
                            </div>
                            {route.address && (
                              <div className="text-xs text-slate-800 font-semibold mb-1.5 flex items-start gap-1">
                                <MapPin className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5 animate-bounce" />
                                <span className="leading-relaxed">{route.address}</span>
                              </div>
                            )}
                            {route.customerName && (
                              <div className="text-xs text-primary font-bold mb-1.5 flex flex-wrap items-center gap-1.5">
                                <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-md inline-block border border-primary/20">
                                  Khách hàng: {route.customerName}
                                </span>
                                {route.customerPhone && (
                                  <span className="px-2 py-0.5 bg-green-500/10 text-green-700 rounded-md inline-block border border-green-500/20">
                                    SĐT: {route.customerPhone}
                                  </span>
                                )}
                              </div>
                            )}
                            <div className="text-[10px] text-slate-400 font-medium">
                              Tọa độ: {route.latitude.toFixed(5)}, {route.longitude.toFixed(5)}
                            </div>
                            {route.note && (
                              <div className="mt-2 text-xs text-slate-700 bg-blue-50/65 border border-blue-100/60 px-2.5 py-1.5 rounded-lg inline-block font-medium">
                                <span className="font-bold text-blue-800 mr-1">Ghi chú:</span>
                                {route.note}
                              </div>
                            )}
                          </div>
                          <div className="shrink-0">
                            <Button variant="outline" size="sm" className="h-7 text-[10px] cursor-pointer" onClick={() => openMapLink(`https://www.google.com/maps?q=${route.latitude},${route.longitude}`)}>
                              Xem Bản đồ
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Note Input Modal */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-border/80">
              <h3 className="font-bold text-base text-card-foreground flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Xác nhận Check-in
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Tọa độ GPS đã xác định thành công. Vui lòng nhập ghi chú hoặc mục đích check-in của bạn tại đây (tùy chọn).
              </p>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1.5 relative">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Khách hàng (Chọn hoặc Nhập mới)</label>
                <Input
                  placeholder="Nhập tên KH mới hoặc chọn..."
                  value={customerInput}
                  onChange={(e) => {
                    setCustomerInput(e.target.value);
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                  className="h-10 text-xs rounded-xl w-full"
                  autoComplete="off"
                />
                {showCustomerDropdown && filteredCustomersForDropdown.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-xl z-[100] max-h-48 overflow-y-auto">
                    {filteredCustomersForDropdown.map(c => (
                      <div 
                        key={c.id} 
                        className="px-3 py-2 text-xs border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer flex justify-between items-center"
                        onClick={() => {
                          setCustomerInput(`${c.name} - ${c.phone}`);
                          setShowCustomerDropdown(false);
                        }}
                      >
                        <span className="font-semibold text-slate-800">{c.name}</span>
                        <span className="text-muted-foreground">{c.phone}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {!selectedCustomerMatch && customerInput.trim() !== '' && (
                <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Số điện thoại KH (để lưu mới)</label>
                  <Input
                    placeholder="Nhập SĐT..."
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    className="h-10 text-xs rounded-xl"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mục đích / Ghi chú</label>
                <Input
                  placeholder="Ví dụ: Đo đạc công trình..."
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 bg-slate-50 border-t border-border/60">
              <Button
                variant="ghost"
                size="sm"
                disabled={isSaving}
                onClick={() => {
                  setIsNoteModalOpen(false);
                  setNoteInput('');
                  setCustomerInput('');
                  setPhoneInput('');
                  setTempCoords(null);
                }}
                className="h-9 text-xs rounded-xl font-medium cursor-pointer"
              >
                Hủy bỏ
              </Button>
              <Button
                size="sm"
                disabled={isSaving}
                onClick={confirmCheckIn}
                className="h-9 text-xs rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-1 cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent mr-1" />
                    Đang lưu...
                  </>
                ) : (
                  "Đồng ý & Lưu"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
