import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MapComponent, CustomMarker } from './MapComponent';
import { geocodeAddressOSM } from '@/src/lib/utils';
import { MapPin, Search, Loader2 } from 'lucide-react';

interface LocationPickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialLocation?: { lat: number, lng: number };
  addressQuery?: string;
  onSave: (location: { lat: number, lng: number }) => void;
}

export function LocationPickerDialog({ isOpen, onClose, initialLocation, addressQuery, onSave }: LocationPickerDialogProps) {
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number, lng: number } | null>(
    initialLocation || null
  );
  const [isSearching, setIsSearching] = useState(false);
  const [manualSearchQuery, setManualSearchQuery] = useState('');

  const handleManualSearch = async () => {
    if (!manualSearchQuery.trim()) return;
    setIsSearching(true);
    try {
      const coords = await geocodeAddressOSM(manualSearchQuery);
      if (coords) {
        setSelectedLocation(coords);
      }
    } catch (e) {
      console.error("Search failed", e);
    } finally {
      setIsSearching(false);
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      if (initialLocation) {
        setSelectedLocation(initialLocation);
      } else if (addressQuery && addressQuery.trim().length > 3) {
        const fetchLocation = async () => {
          setIsSearching(true);
          try {
            const coords = await geocodeAddressOSM(addressQuery);
            if (coords) {
              setSelectedLocation(coords);
            } else {
              setSelectedLocation({ lat: 21.0278, lng: 105.8342 }); // Fallback to Hanoi
            }
          } catch (e) {
            setSelectedLocation({ lat: 21.0278, lng: 105.8342 });
          } finally {
            setIsSearching(false);
          }
        };
        fetchLocation();
      } else {
        setSelectedLocation({ lat: 21.0278, lng: 105.8342 });
      }
    } else {
      setSelectedLocation(null);
    }
  }, [isOpen, initialLocation, addressQuery]);

  const handleMapClick = (e: { lngLat: { lng: number; lat: number } }) => {
    setSelectedLocation({
      lat: e.lngLat.lat,
      lng: e.lngLat.lng
    });
  };

  const handleSave = () => {
    if (selectedLocation) {
      onSave(selectedLocation);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] h-[80vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 md:p-6 border-b shrink-0 bg-card">
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Chọn vị trí trên bản đồ
            {isSearching && <span className="text-xs text-muted-foreground font-normal ml-2 animate-pulse">(Đang tìm tự động...)</span>}
          </DialogTitle>
          <DialogDescription>
            Di chuyển bản đồ và nhấn vào vị trí công trình để ghim tọa độ.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 relative bg-gray-100">
          <MapComponent
            initialViewState={selectedLocation ? {
              latitude: selectedLocation.lat,
              longitude: selectedLocation.lng,
              zoom: initialLocation ? 16 : 12
            } : undefined}
            onClick={handleMapClick}
          >
            {selectedLocation && (
              <CustomMarker 
                latitude={selectedLocation.lat} 
                longitude={selectedLocation.lng}
                color="bg-primary"
              >
                <div className="bg-black/80 text-white text-[10px] px-2 py-1 rounded shadow text-center">
                  Vị trí đã chọn<br/>
                  <span className="text-gray-300">{selectedLocation.lat.toFixed(5)}, {selectedLocation.lng.toFixed(5)}</span>
                </div>
              </CustomMarker>
            )}
          </MapComponent>
          
          {/* A floating crosshair in center (optional) but we use click instead */}
          <div className="absolute top-4 left-4 right-4 z-[1000] pointer-events-none">
             <div className="bg-white/90 backdrop-blur shadow-lg rounded-xl p-2 border border-primary/20 pointer-events-auto flex items-center gap-2">
               <input
                 type="text"
                 placeholder="Nhập địa chỉ để tìm kiếm nhanh..."
                 className="flex-1 bg-transparent border-none text-sm outline-none px-2 h-8 text-gray-800 placeholder:text-gray-400"
                 value={manualSearchQuery}
                 onChange={(e) => setManualSearchQuery(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
               />
               <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0 rounded-lg text-primary hover:bg-primary/10" onClick={handleManualSearch} disabled={isSearching}>
                 {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
               </Button>
             </div>
          </div>
        </div>

        <DialogFooter className="p-4 border-t bg-gray-50 shrink-0 sm:justify-between flex-row">
          <div className="text-xs text-muted-foreground hidden sm:block">
            {selectedLocation ? `Tọa độ: ${selectedLocation.lat.toFixed(5)}, ${selectedLocation.lng.toFixed(5)}` : 'Chưa chọn vị trí'}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none">Hủy</Button>
            <Button onClick={handleSave} disabled={!selectedLocation} className="flex-1 sm:flex-none">
              Lưu vị trí
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
