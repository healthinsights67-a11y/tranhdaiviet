import { db, doc, getDoc } from '../lib/firebase';
import { toast } from 'sonner';

interface DropboxCredentials {
  appKey: string;
  appSecret: string;
  refreshToken: string;
}

// Lấy thông tin cấu hình từ Firestore hoặc Env
const getCredentials = async (): Promise<DropboxCredentials> => {
  try {
    const docSnap = await getDoc(doc(db, 'configs', 'dropbox'));
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.appKey && data.appSecret && data.refreshToken) {
        return {
          appKey: data.appKey,
          appSecret: data.appSecret,
          refreshToken: data.refreshToken
        };
      }
    }
  } catch (e) {
    console.warn("Could not fetch Dropbox config from Firestore, using env variables", e);
  }

  // Fallback về env
  return {
    appKey: (import.meta.env.VITE_DROPBOX_APP_KEY as string) || '',
    appSecret: (import.meta.env.VITE_DROPBOX_APP_SECRET as string) || '',
    refreshToken: (import.meta.env.VITE_DROPBOX_REFRESH_TOKEN as string) || ''
  };
};

// Đổi Refresh Token lấy Access Token mới
const getAccessToken = async (creds: DropboxCredentials): Promise<string> => {
  if (!creds.appKey || !creds.appSecret || !creds.refreshToken) {
    throw new Error("Chưa cấu hình thông tin kết nối Dropbox (App Key, App Secret, Refresh Token)");
  }

  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('refresh_token', creds.refreshToken);
  params.append('client_id', creds.appKey);
  params.append('client_secret', creds.appSecret);

  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error_description || "Không thể làm mới token truy cập Dropbox");
  }

  const data = await res.json();
  return data.access_token;
};

/**
 * Tải file lên Dropbox và trả về link chia sẻ công khai
 */
export const uploadToDropbox = async (file: File, customName?: string): Promise<string | null> => {
  try {
    const creds = await getCredentials();
    const accessToken = await getAccessToken(creds);

    // Chuẩn hóa tên file
    const baseName = customName || file.name.split('.')[0];
    const extension = file.name.split('.').pop() || '';
    const cleanBaseName = baseName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .toUpperCase();
    const fileName = `${Date.now()}_${cleanBaseName}.${extension}`;
    const dropboxPath = `/tasks/${fileName}`;

    // 1. Thực hiện tải file lên Dropbox
    const uploadRes = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Dropbox-API-Arg': JSON.stringify({
          path: dropboxPath,
          mode: 'add',
          autorename: true,
          mute: false,
          strict_conflict: false
        }),
        'Content-Type': 'application/octet-stream'
      },
      body: file
    });

    if (!uploadRes.ok) {
      const errorData = await uploadRes.json().catch(() => ({}));
      throw new Error(errorData.error_summary || "Lỗi tải file lên Dropbox");
    }

    const uploadData = await uploadRes.json();
    const actualPath = uploadData.path_display || dropboxPath;

    // 2. Tạo link chia sẻ công khai cho file vừa tải lên
    const shareRes = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: actualPath,
        settings: {
          requested_visibility: 'public',
          audience: 'public',
          access: 'viewer'
        }
      })
    });

    let sharedUrl = "";

    if (shareRes.ok) {
      const shareData = await shareRes.json();
      sharedUrl = shareData.url;
    } else {
      // Nếu link đã tồn tại, lấy danh sách link chia sẻ của file đó
      const errorData = await shareRes.json().catch(() => ({}));
      if (errorData.error?.['.tag'] === 'shared_link_already_exists') {
        const listRes = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            path: actualPath,
            direct_only: true
          })
        });
        
        if (listRes.ok) {
          const listData = await listRes.json();
          if (listData.links && listData.links.length > 0) {
            sharedUrl = listData.links[0].url;
          }
        }
      }
    }

    if (!sharedUrl) {
      throw new Error("Không thể tạo link chia sẻ từ Dropbox");
    }

    // Chuyển link dropbox ?dl=0 thành ?raw=1 để hiển thị trực tiếp được PDF/Ảnh trên trình duyệt web
    return sharedUrl.replace(/\?dl=0$/, '?raw=1');

  } catch (error: any) {
    console.error("Dropbox upload error:", error);
    toast.error("Lỗi tải lên Dropbox: " + (error.message || "Vui lòng kiểm tra cấu hình"));
    return null;
  }
};
