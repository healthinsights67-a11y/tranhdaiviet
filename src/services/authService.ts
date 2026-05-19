import { auth, signOut, onAuthStateChanged, setPersistence, indexedDBLocalPersistence, browserLocalPersistence, signInWithEmailAndPassword, createUserWithEmailAndPassword, db, doc, setDoc, getDoc, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from '../lib/firebase';
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
   * Get user profile from Firestore
   * Automatically upgrades whitelisted admins
   */
  async getUserProfile(uid: string) {
    try {
      const userRef = doc(db, 'users', uid);
      const snap = await getDoc(userRef);
      const user = auth.currentUser;
      
      const isWhitelistedAdmin = user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());

      if (snap.exists()) {
        const data = snap.data();
        
        // Auto-upgrade existing profile if email is now in whitelist
        if (isWhitelistedAdmin && (data.role !== 'admin' || data.status !== 'approved')) {
          console.log("AuthService: Auto-upgrading whitelisted admin profile");
          const updatedData = { ...data, role: 'admin', status: 'approved' };
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
      } else if (user) {
        // Create normal user profile
        console.log("AuthService: Creating profile for new user");
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
  }
};
