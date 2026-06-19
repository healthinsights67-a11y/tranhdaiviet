import * as React from 'react';
import { SalesRoute, Member } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Search, Navigation } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { db, collection, query, where, getDocs, orderBy } from '@/src/lib/firebase';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

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

export function SalesRoutePage() {
  const [date, setDate] = React.useState<string>(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = React.useState('');

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
      // Find the real member based on zaloUserId
      const realMember = members.find(m => m.zaloUserId === route.zaloUserId);
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

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-6 h-full flex flex-col min-h-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Lịch trình Sale</h1>
          <p className="text-[10px] md:text-xs text-muted-foreground font-medium">Theo dõi lịch trình và quãng đường di chuyển của nhân viên Sale qua Zalo.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-56 shrink-0">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input 
              placeholder="Tìm nhân viên..." 
              className="pl-8 h-8 text-xs bg-card text-card-foreground border border-border shadow-sm rounded-lg" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative w-40 shrink-0">
            <Input 
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-8 text-xs bg-card"
            />
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
                      <CardDescription className="text-xs">
                        {memberRoutes.length} điểm check-in
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-primary">{totalDistance.toFixed(1)} km</div>
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
                                  Cách điểm trước: {distanceFromPrev.toFixed(1)} km
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 font-medium">
                              Tọa độ: {route.latitude.toFixed(5)}, {route.longitude.toFixed(5)}
                            </div>
                            {route.note && (
                              <div className="mt-1 text-xs text-slate-700 bg-slate-100 p-2 rounded inline-block">
                                {route.note}
                              </div>
                            )}
                          </div>
                          <div className="shrink-0">
                            <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => window.open(`https://www.google.com/maps?q=${route.latitude},${route.longitude}`, '_blank')}>
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
    </div>
  );
}
