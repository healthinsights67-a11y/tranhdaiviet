import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { auth, signOut, onAuthStateChanged, setPersistence, indexedDBLocalPersistence, browserLocalPersistence, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, firebaseConfig, db, doc, setDoc, getDoc, updateDoc, deleteDoc, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, collection, getDocs, query, where } from '../lib/firebase';
import { User } from 'firebase/auth';
import { toast } from 'sonner';

const ADMIN_EMAILS = ['haanhtran.cv02@gmail.com', 'nhoanhkoem01@gmail.com'];

/**
 * Service to handle Firebase Authentication
 */
export const authService = {
  /**
   * Initialize custom persistence strategy for PWAs
   * Ensures the session survives even in iOS standalone mode
   */
  async initializeAuth() {
    try {
      console.log("AuthService: Checking environment...");
      const isStandalone = (window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches;
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      
      // Luôn sử dụng browserLocalPersistence vì nó ổn định nhất trên mọi thiết bị
      // đặc biệt là iOS PWA (Home Screen) hay bị mất IndexedDB.
      await setPersistence(auth, browserLocalPersistence);
      console.log("AuthService: Persistence configured -> browserLocalPersistence");
    } catch (e) {
      console.warn("AuthService: Persistence config failed, falling back", e);
      await setPersistence(auth, browserLocalPersistence).catch(() => {});
    }

    // Xử lý kết quả Redirect ngay khi khởi tạo
    try {
      const result = await getRedirectResult(auth);
      if (result?.user) {
        console.log("AuthService: Redirect result found user:", result.user.email);
        return result.user;
      }
    } catch (error: any) {
      if (error.code !== 'auth/missing-initial-state') {
        console.error("Firebase Redirect Error:", error.code, error.message);
        toast.error(`Đăng nhập thất bại: ${error.message}`);
      }
    }
    return null;
  },

  /**
   * Intelligent Google Sign-In: Redirect for mobile/standalone, Popup for desktop
   */
  async loginWithGoogle(): Promise<void> {
    try {
      const googleProvider = new GoogleAuthProvider();
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const isStandalone = (window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches;

      if (isIOS && isStandalone) {
        console.log("AuthService: iOS PWA detected, attempting Popup to avoid Safari break out");
        try {
          await signInWithPopup(auth, googleProvider);
        } catch (popupError: any) {
          console.warn("AuthService: Popup blocked or failed in iOS PWA", popupError.code);
          throw new Error("PWA_POPUP_BLOCKED");
        }
      } else if (isMobile) {
        console.log("AuthService: Mobile browser detected, using Redirect");
        await signInWithRedirect(auth, googleProvider);
      } else {
        try {
          console.log("AuthService: Desktop detected, attempting Popup");
          await signInWithPopup(auth, googleProvider);
        } catch (popupError: any) {
          console.warn("AuthService: Popup blocked or failed, falling back to Redirect", popupError.code);
          await signInWithRedirect(auth, googleProvider);
        }
      }
    } catch (error: any) {
      console.error("AuthService: Login initiation failed", error);
      throw error;
    }
  },

  /**
   * Login with Email and Password - Explicitly forces persistence for PWAs
   */
  async loginWithEmail(email: string, password: string): Promise<User> {
    try {
      console.log("AuthService: Email login attempt...");
      // Forcing persistence check again right before login to be 100% sure
      // Removed redundant setPersistence call that causes crashes on iOS PWA
      
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      console.log("AuthService: Email login success:", result.user.email);
      return result.user;
    } catch (error) {
      console.error("AuthService: Email login failed", error);
      throw error;
    }
  },

  /**
   * Helper to check environment capabilities
   */
  getDebugInfo() {
    return {
      userAgent: navigator.userAgent,
      standalone: (window.navigator as any).standalone,
      displayMode: window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser',
      localStorage: typeof localStorage !== 'undefined',
      indexedDB: !!window.indexedDB,
      domain: window.location.hostname,
      protocol: window.location.protocol
    };
  },

  /**
   * Register with Email and Password
   */
  async registerWithEmail(email: string, password: string, displayName: string = ''): Promise<User> {
    try {
      const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
      
      // Create profile in Firestore with "pending" status
      const userRef = doc(db, 'users', result.user.uid);
      const isAdmin = ADMIN_EMAILS.includes(email.toLowerCase());
      
      await setDoc(userRef, {
        uid: result.user.uid,
        email: result.user.email,
        displayName: displayName || email.split('@')[0],
        status: isAdmin ? 'approved' : 'pending', // Admins are auto-approved
        role: isAdmin ? 'admin' : 'user',
        createdAt: new Date().toISOString()
      });

      return result.user;
    } catch (error) {
      console.error("AuthService: Registration failed", error);
      throw error;
    }
  },

  /**
   * Get user profile from Firestore.
   * - Admin emails are always auto-approved.
   * - Users whose email is in the `members` collection are auto-approved.
   * - All others stay as 'pending' and must be manually approved.
   */
  async getUserProfile(uid: string) {
    try {
      const userRef = doc(db, 'users', uid);
      const snap = await getDoc(userRef);
      const user = auth.currentUser;
      
      const isWhitelistedAdmin = user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());

      // Check if this email exists in the members whitelist
      let isMemberWhitelisted = false;
      if (user?.email && !isWhitelistedAdmin) {
        try {
          const membersRef = collection(db, 'members');
          const q = query(membersRef, where('email', '==', user.email.toLowerCase()));
          const memberSnap = await getDocs(q);
          // Also check case-insensitive with trim
          const q2 = query(membersRef, where('email', '==', user.email));
          const memberSnap2 = await getDocs(q2);
          isMemberWhitelisted = !memberSnap.empty || !memberSnap2.empty;
        } catch (e) {
          console.warn("AuthService: Could not check members whitelist", e);
        }
      }

      const shouldAutoApprove = isWhitelistedAdmin || isMemberWhitelisted;

      if (snap.exists()) {
        const data = snap.data();
        
        // Auto-upgrade existing profile if email is now in whitelist or admin
        if (isWhitelistedAdmin && (data.role !== 'admin' || data.status !== 'approved')) {
          console.log("AuthService: Auto-upgrading whitelisted admin profile");
          const updatedData = { ...data, role: 'admin', status: 'approved' };
          await setDoc(userRef, updatedData, { merge: true });
          return updatedData;
        }

        // Auto-approve member-whitelisted users
        if (isMemberWhitelisted && data.status !== 'approved') {
          console.log("AuthService: Auto-approving member-whitelisted user");
          const updatedData = { ...data, status: 'approved' };
          await setDoc(userRef, updatedData, { merge: true });
          return updatedData;
        }
        
        return data;
      }
      
      // Create profile if it doesn't exist (e.g. first time Google login)
      if (user && isWhitelistedAdmin) {
        console.log("AuthService: Creating profile for whitelisted admin");
        const newProfile = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email?.split('@')[0],
          status: 'approved',
          role: 'admin',
          createdAt: new Date().toISOString()
        };
        await setDoc(userRef, newProfile);
        return newProfile;
      } else if (user && isMemberWhitelisted) {
        // Member whitelisted - auto-approve
        console.log("AuthService: Creating auto-approved profile for whitelisted member");
        const newProfile = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email?.split('@')[0],
          status: 'approved',
          role: 'user',
          createdAt: new Date().toISOString()
        };
        await setDoc(userRef, newProfile);
        return newProfile;
      } else if (user) {
        // Not in whitelist — create normal pending profile
        console.log("AuthService: Creating pending profile for unknown user");
        const newProfile = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email?.split('@')[0],
          status: 'pending',
          role: 'user',
          createdAt: new Date().toISOString()
        };
        await setDoc(userRef, newProfile);
        return newProfile;
      }

      return null;
    } catch (error) {
      console.error("AuthService: Failed to get or create profile", error);
      return null;
    }
  },

  /**
   * Signs out the current user
   */
  async logout(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("AuthService: Sign out failed", error);
      throw error;
    }
  },

  /**
   * Listens for authentication state changes
   */
  subscribeToAuthChanges(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, callback);
  },

  /**
   * Returns the current authenticated user
   */
  getCurrentUser(): User | null {
    return auth.currentUser;
  },

  /**
   * Send Password Reset Email via Firebase Auth
   */
  async sendPasswordReset(email: string): Promise<void> {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      throw new Error("Vui lòng cung cấp địa chỉ email hợp lệ.");
    }
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      console.log("AuthService: Password reset email sent to", cleanEmail);
    } catch (error: any) {
      console.error("AuthService: Failed to send password reset email", error);
      if (error.code === 'auth/user-not-found') {
        throw new Error("Không tìm thấy tài khoản với email này trên hệ thống.");
      } else if (error.code === 'auth/invalid-email') {
        throw new Error("Địa chỉ email không đúng định dạng.");
      }
      throw error;
    }
  },

  /**
   * Create staff account using a secondary Firebase App instance.
   * This guarantees the current admin user session is NOT signed out.
   */
  async createStaffAccount(email: string, password: string, displayName: string = '', role: string = 'user'): Promise<{ uid: string; email: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const secondaryAppName = `staff-create-${Date.now()}`;
    const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    try {
      const secondaryAuth = getAuth(secondaryApp);
      const userCred = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, password);
      const uid = userCred.user.uid;
      await signOut(secondaryAuth);

      // Create / update profile in users collection
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, {
        uid,
        email: cleanEmail,
        displayName: displayName || cleanEmail.split('@')[0],
        status: 'approved',
        role: (role === 'Giám đốc' || role === 'Tổng quản lý' || role === 'admin') ? 'admin' : 'user',
        createdAt: new Date().toISOString()
      }, { merge: true });

      return { uid, email: cleanEmail };
    } finally {
      await deleteApp(secondaryApp).catch(() => {});
    }
  },

  /**
   * Disables user in Firestore `users` collection when staff is deleted or deactivated.
   */
  async disableUserByEmail(email: string): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', cleanEmail));
      const snap = await getDocs(q);
      const updates = snap.docs.map(d => updateDoc(d.ref, { status: 'rejected' }));
      await Promise.all(updates);
    } catch (error) {
      console.error("AuthService: Failed to disable user by email", error);
    }
  },

  /**
   * Deletes user document from `users` collection.
   */
  async deleteUserDocumentByEmail(email: string): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', cleanEmail));
      const snap = await getDocs(q);
      const deletes = snap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletes);
    } catch (error) {
      console.error("AuthService: Failed to delete user document by email", error);
    }
  }
};
