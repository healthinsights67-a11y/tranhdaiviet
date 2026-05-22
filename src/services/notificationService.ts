import { db, collection, getDocs, doc, getDoc, query, where, auth, updateDoc, setDoc, addDoc, arrayUnion, messaging, getToken } from '@/src/lib/firebase';
import { toast } from 'sonner';

export async function handleRequestNotification() {
  if (!('Notification' in window)) {
    toast.error('Trình duyệt của bạn không hỗ trợ thông báo (Web Push Notification).');
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    
    if (permission === 'denied') {
      toast.error('Bạn đã từ chối nhận thông báo. Hãy bật lại trong cài đặt trình duyệt của bạn (ổ khoá góc thanh địa chỉ).');
      return;
    }

    if (permission === 'granted') {
      toast.success('Đã cấp quyền thông báo thành công! Đang thiết lập kết nối...');
      
      if (!messaging) {
        toast.error('Firebase Cloud Messaging chưa được hỗ trợ trên trình duyệt này.');
        return;
      }
      
      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      if (!vapidKey || vapidKey === 'YOUR_FCM_VAPID_KEY') {
        toast.error('Thiếu cấu hình VAPID Key. Vui lòng thiết lập VITE_FIREBASE_VAPID_KEY vào môi trường.');
        return;
      }

      // Check registration
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.ready;
      }

      const token = await getToken(messaging, { vapidKey });
      
      if (token && auth.currentUser) {
        // 1: Members fallback check
        const membersRef = collection(db, 'members');
        const q = query(membersRef, where('email', '==', auth.currentUser.email));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const memberDoc = querySnapshot.docs[0];
          await updateDoc(doc(db, 'members', memberDoc.id), {
            fcmTokens: arrayUnion(token),
            lastUpdated: new Date().toISOString()
          });
          toast.success('Thiết bị (Nhân viên) đã kết nối thông báo thành công!');
        } else {
          // 2: Users collection
          const userRef = doc(db, 'users', auth.currentUser.uid);
          await setDoc(userRef, { 
            email: auth.currentUser.email,
            fcmTokens: arrayUnion(token),
            lastUpdated: new Date().toISOString()
          }, { merge: true });
          toast.success('Thiết bị đã kết nối thông báo thành công!');
        }
      } else {
         toast.error('Chưa có user hoặc không thể lấy định danh. Vui lòng đăng nhập.');
      }
    }
  } catch (error) {
    console.error('Lỗi khi xin quyền Web Push:', error);
    toast.error('Lỗi khi xin quyền Thông báo: ' + (error instanceof Error ? error.message : String(error)));
  }
}

export async function notifyCurrentUser(title: string, body: string) {
  try {
    if (!auth.currentUser) return;
    
    // Get tokens for current user
    const usersRef = doc(db, 'users', auth.currentUser.uid);
    const userSnap = await getDoc(usersRef);
    let tokens: string[] = [];
    
    if (userSnap.exists()) {
      tokens = userSnap.data().fcmTokens || [];
    }
    
    // Also check members collection
    const membersRef = collection(db, 'members');
    const q = query(membersRef, where('email', '==', auth.currentUser.email));
    const memberSnap = await getDocs(q);
    if (!memberSnap.empty) {
      const memberTokens = memberSnap.docs[0].data().fcmTokens || [];
      tokens = [...new Set([...tokens, ...memberTokens])];
    }

    if (tokens.length === 0) {
      toast.error('Máy bạn chưa đăng ký nhận thông báo. Hãy F5 và Cho phép quyền.');
      return;
    }

    const response = await fetch('/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokens, title, body })
    });

    if (!response.ok) throw new Error('Lỗi gửi từ Server');
    toast.success('Đã gửi thông báo thử! Đợi 1-2 giây...');
  } catch (error) {
    console.error('Test notification failed:', error);
    toast.error('Lỗi khi gửi thử: ' + (error instanceof Error ? error.message : 'Unknown'));
  }
}

export async function notifyManagers(
  title: string,
  body: string,
  data?: any,
  assigneeId?: string,
  targetRoles?: string[]
) {
  try {
    console.log('Searching for managers & targets to notify...');
    const tokens: string[] = [];
    const managerEmails = ['nhoanhkoem01@gmail.com', 'haanhtran.cv02@gmail.com'];
    
    // Normalize targetRoles to lowercase
    const normalizedTargetRoles = targetRoles?.map(r => r.toLowerCase()) || [];

    // 1. Get tokens from members collection
    const membersSnap = await getDocs(collection(db, 'members'));
    membersSnap.forEach(doc => {
      const member = doc.data();
      const memberId = doc.id;
      const role = member.role?.toLowerCase() || '';
      
      let shouldNotify = false;

      // Rule A: Managers always get notified
      if (role.includes('quản lý') || managerEmails.includes(member.email)) {
        shouldNotify = true;
      }
      
      // Rule B: Assigned person gets notified
      if (assigneeId && memberId === assigneeId) {
        shouldNotify = true;
      }

      // Rule C: Specific target roles get notified (e.g. 'sản xuất', 'lắp đặt')
      if (normalizedTargetRoles.length > 0) {
        const matchesTargetRole = normalizedTargetRoles.some(targetRole => role.includes(targetRole));
        if (matchesTargetRole) {
          shouldNotify = true;
        }
      }

      if (shouldNotify && member.fcmTokens && Array.isArray(member.fcmTokens)) {
        tokens.push(...member.fcmTokens);
      }
    });

    // 2. Fallback: Get tokens from users collection
    const usersSnap = await getDocs(collection(db, 'users'));
    usersSnap.forEach(doc => {
      const user = doc.data();
      const userId = doc.id;
      
      let shouldNotify = false;

      // Rule A: Managers
      if (managerEmails.includes(user.email)) {
        shouldNotify = true;
      }

      // Rule B: Assignee
      if (assigneeId && userId === assigneeId) {
        shouldNotify = true;
      }

      if (shouldNotify && user.fcmTokens && Array.isArray(user.fcmTokens)) {
        tokens.push(...user.fcmTokens);
      }
    });

    const uniqueTokens = [...new Set(tokens)].filter(t => !!t);

    if (uniqueTokens.length === 0) {
      console.warn('No tokens found for managers or target roles.');
      return;
    }

    console.log(`Sending notification to ${uniqueTokens.length} devices...`);

    // 3. Call backend API
    const response = await fetch('/api/send-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tokens: uniqueTokens,
        title,
        body,
        data,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to send notification');
    }

    const result = await response.json();
    console.log('Notification sent successfully:', result);
    return result;
  } catch (error) {
    console.error('Error in notifyManagers:', error);
    toast.error('Gửi thông báo thất bại: ' + (error instanceof Error ? error.message : String(error)));
  }
}

export type TargetGroup = 'all' | 'managers' | 'designers' | 'installers' | 'sales';

export async function notifyCustomMembers(title: string, body: string, targetGroup: TargetGroup = 'all', data?: any) {
  try {
    const tokens: string[] = [];
    
    const matchRole = (role?: string) => {
      if (!role) return false;
      const r = role.toLowerCase();
      switch (targetGroup) {
        case 'managers': return r.includes('quản lý') || r.includes('giám đốc') || r.includes('trợ lý');
        case 'designers': return r.includes('thiết kế');
        case 'installers': return r.includes('thi công') || r.includes('lắp đặt') || r.includes('kỹ thuật');
        case 'sales': return r.includes('kinh doanh') || r.includes('khảo sát');
        default: return true;
      }
    };

    // Get tokens from all members
    const membersSnap = await getDocs(collection(db, 'members'));
    membersSnap.forEach(doc => {
      const member = doc.data();
      if ((targetGroup === 'all' || matchRole(member.role)) && member.fcmTokens && Array.isArray(member.fcmTokens)) {
        tokens.push(...member.fcmTokens);
      }
    });

    // Get tokens from all users (fallback for admin/managers if their role is in users or we just broadcast)
    const usersSnap = await getDocs(collection(db, 'users'));
    usersSnap.forEach(doc => {
      const user = doc.data();
      if ((targetGroup === 'all' || matchRole(user.role)) && user.fcmTokens && Array.isArray(user.fcmTokens)) {
        tokens.push(...user.fcmTokens);
      }
    });

    const uniqueTokens = [...new Set(tokens)].filter(t => !!t);

    // Save notification to Firestore for UI display
    try {
      const notifRef = collection(db, 'notifications');
      await addDoc(notifRef, {
        title,
        message: body,
        type: 'announcement',
        readBy: [], // Array of user IDs or emails who have read it
        isGlobal: targetGroup === 'all', 
        targetGroup, // Save the target group to filter in Navbar

        createdAt: new Date().toISOString(),
        data: data || null
      });
    } catch (dbErr) {
      console.error("Failed to save global notification to DB", dbErr);
    }

    if (uniqueTokens.length === 0) {
      console.warn('No tokens found to send announcement.');
      return;
    }

    const response = await fetch('/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokens: uniqueTokens,
        title,
        body,
        data,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to send announcement notification');
    }
    return await response.json();
  } catch (error) {
    console.error('Error in notifyAllMembers:', error);
    throw error;
  }
}
