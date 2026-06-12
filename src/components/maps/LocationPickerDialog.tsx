import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MapComponent, CustomMarker } from './MapComponent';
import { MapPin, Search } from 'lucide-react';

interface LocationPickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialLocation?: { lat: number, lng: number };
  onSave: (location: { lat: number, lng: number }) => void;
}

export function LocationPickerDialog({ isOpen, onClose, initialLocation, onSave }: LocationPickerDialogProps) {
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number, lng: number } | null>(
    initialLocation || { lat: 21.0278, lng: 105.8342 }
  );

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
          <div className="absolute top-4 left-4 right-4 z-10 pointer-events-none">
             <div className="bg-white/90 backdrop-blur shadow-lg rounded-xl p-3 border border-primary/20 pointer-events-auto">
               <div className="flex items-center gap-2 text-sm text-gray-600">
                 <Search className="h-4 w-4" />
                 <span className="flex-1 truncate font-medium">Bạn có thể bấm biểu tượng Định vị ở góc dưới bên phải để tìm vị trí hiện tại.</span>
               </div>
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
