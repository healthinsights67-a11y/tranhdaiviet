import { db, doc, getDoc } from '../lib/firebase';
import { toast } from 'sonner';

export const uploadToImgBB = async (file: File, customName?: string): Promise<string | null> => {
  try {
    // 1. Try to get from Firestore
    let activeKey: string | null = null;
    try {
      const docSnap = await getDoc(doc(db, 'configs', 'storage'));
      activeKey = docSnap.exists() ? docSnap.data().imgbbKey : null;
    } catch (e) {
      console.warn("Could not fetch ImgBB key from Firestore, trying env fallback", e);
    }

    // 2. Fallback to ENV if Firestore is empty
    if (!activeKey) {
      activeKey = (import.meta.env.VITE_IMGBB_API_KEY as string) || (process.env.VITE_IMGBB_API_KEY as string) || null;
    }

    if (!activeKey) {
      toast.error("Chưa cấu hình ImgBB API Key. Vui lòng vào Cài đặt hệ thống để thiết lập.");
      return null;
    }

    const formData = new FormData();
    formData.append('image', file);
    
    // Use a clean filename
    const baseName = customName || file.name.split('.')[0];
    const cleanName = baseName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_-]/gi, '_').toUpperCase();
    formData.append('name', cleanName);
    
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${activeKey}`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const msg = errorData.error?.message || response.statusText || "Lỗi không xác định";
      toast.error("ImgBB API Error: " + msg);
      return null;
    }
    
    const data = await response.json();
    if (data.success) {
      return data.data.url;
    } else {
      toast.error("Lỗi upload ảnh: " + (data.error?.message || "Không rõ nguyên nhân"));
      return null;
    }
  } catch (error) {
    console.error("Upload error details:", error);
    toast.error("Không thể kết nối đến máy chủ upload ảnh.");
    return null;
  }
};
