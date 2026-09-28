import * as React from 'react';
import { useState } from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
import { authService } from '@/src/services/authService';
import { toast } from 'sonner';
import { Mail, Lock, LogIn, UserPlus, AlertTriangle, User, Chrome, ArrowLeft, KeyRound } from 'lucide-react'; 

type AuthMode = 'login' | 'register' | 'forgot';

export function LoginForm() {
  const { signInWithEmail, registerWithEmail, setLoginDialogOpen } = useAuth();
  
  const [authMode, setAuthMode] = useState<AuthMode>('login');
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
    if (!email || !password || (authMode === 'register' && !displayName)) {
      toast.error("Vui lòng nhập đầy đủ thông tin!");
      return;
    }

    try {
      setIsLoading(true);
      if (authMode === 'register') {
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.trim()) {
      toast.error("Vui lòng nhập địa chỉ email của bạn!");
      return;
    }
    try {
      setIsLoading(true);
      await authService.sendPasswordReset(email.trim());
      toast.success("Đã gửi email khôi phục mật khẩu! Vui lòng kiểm tra hộp thư đến (hoặc thư rác).");
      setAuthMode('login');
    } catch (error: any) {
      toast.error(error.message || "Lỗi khi gửi email khôi phục mật khẩu");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-1 bg-white dark:bg-slate-900 rounded-2xl">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
          {authMode === 'register' 
            ? 'Tạo tài khoản mới' 
            : authMode === 'forgot' 
            ? 'Khôi phục mật khẩu' 
            : 'Đăng nhập hệ thống'}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {authMode === 'register' 
            ? 'Điền thông tin để đăng ký thành viên' 
            : authMode === 'forgot'
            ? 'Nhập email để nhận liên kết đổi mật khẩu'
            : 'Nhập thông tin tài khoản để tiếp tục'}
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

      {/* Google Login (only on login / register mode) */}
      {authMode !== 'forgot' && (
        <>
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold py-2.5 px-4 rounded-xl transition-all mb-4 disabled:opacity-50"
          >
            <Chrome className="w-5 h-5 text-blue-500" />
            Tiếp tục với Google
          </button>

          <div className="relative flex items-center py-2 mb-4">
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
            <span className="flex-shrink-0 mx-4 text-xs text-slate-400 dark:text-slate-500 font-medium uppercase">Hoặc</span>
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
          </div>
        </>
      )}

      {/* Form: Forgot Password */}
      {authMode === 'forgot' ? (
        <form onSubmit={handleForgotPassword} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Email của bạn</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-10 pl-9 pr-3 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="nhanvien@congty.com"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl transition-all disabled:opacity-50"
          >
            <KeyRound className="w-4 h-4" />
            {isLoading ? "Đang gửi email..." : "Gửi email khôi phục mật khẩu"}
          </button>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => setAuthMode('login')}
              className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Quay lại đăng nhập
            </button>
          </div>
        </form>
      ) : (
        /* Form: Login / Register */
        <form className="space-y-4">
          {authMode === 'register' && (
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
                  required={authMode === 'register'}
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
                placeholder="nhanvien@congty.com"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Mật khẩu</label>
              {authMode === 'login' && (
                <button
                  type="button"
                  onClick={() => setAuthMode('forgot')}
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  Quên mật khẩu?
                </button>
              )}
            </div>
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
            {authMode === 'register' ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
            {authMode === 'register' ? 'Đăng ký ngay' : 'Đăng nhập'}
          </button>
        </form>
      )}

      {authMode !== 'forgot' && (
        <div className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
          {authMode === 'register' ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}
          <button
            onClick={() => setAuthMode(authMode === 'register' ? 'login' : 'register')}
            className="ml-1 text-blue-600 dark:text-blue-400 font-bold hover:underline"
            type="button"
          >
            {authMode === 'register' ? 'Đăng nhập' : 'Đăng ký'}
          </button>
        </div>
      )}
    </div>
  );
}
