import * as React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { authService } from '../services/authService';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  userProfile: any | null;
  loading: boolean;
  signInWithEmail: (email:string, password:string) => Promise<void>;
  registerWithEmail: (email:string, password:string, displayName:string) => Promise<void>;
  signOut: () => Promise<void>;
  isLoginDialogOpen: boolean;
  setLoginDialogOpen: (open: boolean) => void;
  isApproved: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({ 
    user: null, 
    userProfile: null,
    loading: true, 
    signInWithEmail: async () => {}, 
    registerWithEmail: async () => {}, 
    signOut: async () => {},
    isLoginDialogOpen: false,
    setLoginDialogOpen: () => {},
    isApproved: false,
    isAdmin: false
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoginDialogOpen, setLoginDialogOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | null = null;

    const init = async () => {
      try {
        console.log("AuthContext: Starting initialization...");
        
        // Ensure persistence is configured
        await authService.initializeAuth();
        
        if (!isMounted) return;

        // Process any pending redirect results
        // Note: initializeAuth already calls getRedirectResult, 
        // but we want to make sure onAuthStateChanged has a chance to trigger.
        
        unsubscribe = authService.subscribeToAuthChanges(async (firebaseUser) => {
          if (isMounted) {
            console.log("AuthContext: State change ->", firebaseUser ? firebaseUser.email : "No User");
            setUser(firebaseUser);
            
            if (firebaseUser) {
              const profile = await authService.getUserProfile(firebaseUser.uid);
              if (isMounted) setUserProfile(profile);
            } else {
              if (isMounted) setUserProfile(null);
            }
            
            setLoading(false);
          }
        });

        // Set a timeout as a fallback so we don't stay in loading forever
        setTimeout(() => {
          if (isMounted && loading) {
            console.warn("AuthContext: Initialization check slow, forcing loading finish");
            setLoading(false);
          }
        }, 5000);

      } catch (err) {
        console.error("AuthContext: Initialization failed", err);
        if (isMounted) setLoading(false);
      }
    };

    init();

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const signInWithEmail = async (email:string, password:string) => {
    try {
      const u = await authService.loginWithEmail(email, password);
      // Fetch profile immediately after login
      if (u) {
        const profile = await authService.getUserProfile(u.uid);
        setUserProfile(profile);
      }
    } catch (error: any) {
      console.error("AuthContext: Email login error", error);
      throw error;
    }
  };

  const registerWithEmail = async (email:string, password:string, displayName:string) => {
    try {
      const u = await authService.registerWithEmail(email, password, displayName);
      if (u) {
        const profile = await authService.getUserProfile(u.uid);
        setUserProfile(profile);
      }
    } catch (error: any) {
      console.error("AuthContext: Registration error", error);
      throw error;
    }
  };

  const logout = async () => {
    await authService.logout();
    setUserProfile(null);
  };

  const isApproved = userProfile?.status === 'approved';
  const isAdmin = userProfile?.role === 'admin';

  return (
    <AuthContext.Provider value={{ 
      user, 
      userProfile,
      loading, 
      signInWithEmail, 
      registerWithEmail, 
      signOut: logout, 
      isLoginDialogOpen, 
      setLoginDialogOpen,
      isApproved,
      isAdmin
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
