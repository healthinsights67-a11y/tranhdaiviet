import * as React from 'react';
import { useState } from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
import { authService } from '@/src/services/authService';
import { toast } from 'sonner';
import { Mail, Lock, LogIn, UserPlus, AlertTriangle, User, Chrome } from 'lucide-react'; 

export function LoginForm() {
  const { signInWithEmail, registerWithEmail, setLoginDialogOpen } = useAuth();
  
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      await authService.loginWithGoogle();
      setLoginDialogOpen(false); 
    } catch (error: any) {
      console.error("Lỗi Google Auth:", error);
      if (error.message === 'PWA_POPUP_BLOCKED') {
        toast.error("Safari chặn chức năng này trên màn hình chính. Vui lòng đăng nhập bằng Email/Mật khẩu.", { duration: 6000 });
      } else {
        toast.error("Lỗi đăng nhập Google");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (isRegisterMode && !displayName)) {
      toast.error("Vui lòng nhập đầy đủ thông tin!");
      return;
    }

    try {
      setIsLoading(true);
      if (isRegisterMode) {
        await registerWithEmail(email, password, displayName);
        toast.success("Đăng ký thành công! Vui lòng chờ Admin duyệt.");
      } else {
        await signInWithEmail(email, password);
        toast.success("Đăng nhập thành công!");
      }
      setLoginDialogOpen(false); 
    } catch (error: any) {
      console.error("Lỗi Email Auth:", error);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        toast.error("Sai email hoặc mật khẩu!");
      } else if (error.code === 'auth/email-already-in-use') {
        toast.error("Email này đã được sử dụng!");
      } else {
        toast.error(`Lỗi: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-1 bg-white dark:bg-slate-900 rounded-2xl">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
          {isRegisterMode ? 'Tạo tài khoản mới' : 'Đăng nhập hệ thống'}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {isRegisterMode ? 'Điền thông tin để đăng ký' : 'Nhập tài khoản để tiếp tục'}
        </p>
      </div>

      {/* Warning for iOS PWA users */}
      {typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent) && (
        <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50 rounded-xl text-xs text-amber-800 dark:text-amber-200 leading-relaxed shadow-sm">
          <p className="font-bold mb-1.5 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> 
            Lưu ý: Bạn đang dùng iPhone / PWA
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Hãy dùng <strong>Email & Mật khẩu</strong> để hệ thống hoạt động ổn định nhất.</li>
            <li>Nếu gặp sự cố, hãy thử đăng nhập bằng trình duyệt <strong>Safari</strong> gốc.</li>
          </ul>
        </div>
      )}

      {/* Google Login Button */}
      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold py-2.5 px-4 rounded-xl transition-all mb-4 disabled:opacity-50"
      >
        <Chrome className="w-5 h-5 text-blue-500" />
        Tiếp tục với Google
      </button>

      {/* Divider */}
      <div className="relative flex items-center py-2 mb-4">
        <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
        <span className="flex-shrink-0 mx-4 text-xs text-slate-400 dark:text-slate-500 font-medium uppercase">Hoặc</span>
        <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
      </div>
 
      {/* Technical Support Trigger */}
      <div className="mb-4 text-center">
        <button 
           type="button"
           onClick={() => {
              const info = authService.getDebugInfo();
              toast.info(`Diagnostic Info`, {
                description: `Domain: ${info.domain}\nStandalone: ${info.standalone}\nStorage: ${info.localStorage?"OK":"Fail"}\nIndexedDB: ${info.indexedDB?"OK":"Fail"}`,
                duration: 5000
              });
           }}
           className="text-[10px] text-slate-400 hover:text-slate-600 underline"
        >
          Hỗ trợ kỹ thuật
        </button>
      </div>

      <form className="space-y-4">
        {isRegisterMode && (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Họ và Tên</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full h-10 pl-9 pr-3 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="Nguyễn Văn A"
                required={isRegisterMode}
              />
            </div>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-10 pl-9 pr-3 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="admin@xuonggo.com"
              required
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Mật khẩu</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-10 pl-9 pr-3 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => handleEmailAuth(e as any)}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl transition-all disabled:opacity-50"
        >
          {isRegisterMode ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
          {isRegisterMode ? 'Đăng ký ngay' : 'Đăng nhập'}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
        {isRegisterMode ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}
        <button
          onClick={() => setIsRegisterMode(!isRegisterMode)}
          className="ml-1 text-blue-600 dark:text-blue-400 font-bold hover:underline"
          type="button"
        >
          {isRegisterMode ? 'Đăng nhập' : 'Đăng ký'}
        </button>
      </div>
    </div>
  );
}
