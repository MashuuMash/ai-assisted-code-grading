import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export type LoginModalMode =
  | 'login'
  | 'register'
  | 'verify-otp'
  | 'forgot-password'
  | 'reset-password';

const SPECIAL_CHAR_REGEX = /[!@#$%^&*()_+\-=[\]{}|;:,.<>?~`]/;

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { login, register, verifyOtp, resendOtp, forgotPassword, resetPassword } = useAuth();
  const [mode, setMode] = useState<LoginModalMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // OTP Verification & Password Reset State
  const [pendingIdentifier, setPendingIdentifier] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Reset Password Inputs
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if ((mode === 'verify-otp' || mode === 'reset-password') && isOpen) {
      window.setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 60);
    }
  }, [mode, isOpen]);

  if (!isOpen) return null;

  // Real-time password criteria for Reset Password
  const resetHasLength = resetNewPassword.length >= 8 && resetNewPassword.length <= 72;
  const resetHasUpper = /[A-Z]/.test(resetNewPassword);
  const resetHasLower = /[a-z]/.test(resetNewPassword);
  const resetHasNumber = /[0-9]/.test(resetNewPassword);
  const resetHasSpecial = SPECIAL_CHAR_REGEX.test(resetNewPassword);
  const isResetPasswordValid =
    resetHasLength && resetHasUpper && resetHasLower && resetHasNumber && resetHasSpecial;
  const resetPasswordsMatch =
    resetNewPassword.length > 0 && resetNewPassword === resetConfirmPassword;

  const switchMode = (nextMode: LoginModalMode) => {
    setMode(nextMode);
    setError(null);
    setInfoMessage(null);
  };

  const handleOtpDigitChange = (index: number, rawValue: string) => {
    const digit = rawValue.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    setError(null);

    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        const next = [...otpDigits];
        next[index - 1] = '';
        setOtpDigits(next);
        otpInputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < 6; i++) {
      next[i] = pasted[i] || '';
    }
    setOtpDigits(next);
    setError(null);
    const focusIdx = Math.min(5, pasted.length - 1);
    otpInputRefs.current[focusIdx]?.focus();
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || loading) return;
    setError(null);
    setInfoMessage(null);
    setLoading(true);
    try {
      if (mode === 'reset-password') {
        const target = pendingIdentifier || resetIdentifier || username || email;
        const res = await forgotPassword(target);
        setOtpDigits(['', '', '', '', '', '']);
        setResendCooldown(60);
        setInfoMessage(res.email_hint ? `${res.message} (sent to ${res.email_hint})` : res.message);
      } else {
        const res = await resendOtp(pendingIdentifier || email || username);
        setOtpDigits(['', '', '', '', '', '']);
        setResendCooldown(60);
        setInfoMessage(res.message || 'A fresh 6-digit verification code has been sent.');
      }
      otpInputRefs.current[0]?.focus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resend verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (mode === 'verify-otp') {
      const code = otpDigits.join('');
      if (code.length !== 6) {
        setError('Please enter the complete 6-digit verification code.');
        return;
      }
      setLoading(true);
      try {
        await verifyOtp(pendingIdentifier || email || username, code);
        onClose();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Invalid verification code.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (mode === 'forgot-password') {
      const target = (resetIdentifier || username || email).trim();
      if (!target) {
        setError('Please enter your username or registered email.');
        return;
      }
      setLoading(true);
      try {
        const res = await forgotPassword(target);
        setPendingIdentifier(target);
        setOtpDigits(['', '', '', '', '', '']);
        setResendCooldown(60);
        setResetNewPassword('');
        setResetConfirmPassword('');
        setInfoMessage(res.email_hint ? `${res.message} (sent to ${res.email_hint})` : res.message);
        setMode('reset-password');
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to send password reset code.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (mode === 'reset-password') {
      const code = otpDigits.join('');
      if (code.length !== 6) {
        setError('Please enter the complete 6-digit verification code.');
        return;
      }
      if (!isResetPasswordValid) {
        setError('New password must satisfy all strength requirements (8-72 chars, upper, lower, number, symbol).');
        return;
      }
      if (!resetPasswordsMatch) {
        setError('Passwords do not match.');
        return;
      }
      setLoading(true);
      try {
        await resetPassword(
          pendingIdentifier || resetIdentifier || username || email,
          code,
          resetNewPassword
        );
        onClose();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to reset password.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (mode === 'register') {
      const cleanUsername = username.trim().toLowerCase();
      if (cleanUsername.length < 3 || cleanUsername.length > 32 || !/^[a-z0-9_.]{3,32}$/.test(cleanUsername)) {
        setError('Username must be 3-32 characters (lowercase letters, numbers, dot or underscore).');
        return;
      }
      if (cleanUsername.includes('@') || cleanUsername.includes(' ')) {
        setError('Username cannot contain spaces or the "@" symbol.');
        return;
      }
      const hasUpper = /[A-Z]/.test(password);
      const hasLower = /[a-z]/.test(password);
      const hasNumber = /[0-9]/.test(password);
      const hasSpecial = SPECIAL_CHAR_REGEX.test(password);
      if (password.length < 8 || password.length > 72 || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
        setError('Password must be 8-72 characters with uppercase, lowercase, number, and a symbol.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await login(username, password);
        onClose();
      } else {
        const cleanEmail = email.trim();
        const registeredUser = await register({
          full_name: fullName.trim(),
          username: username.trim(),
          email: cleanEmail,
          password,
        });
        if (registeredUser.otp_required !== false && !registeredUser.is_email_verified) {
          setPendingIdentifier(registeredUser.email || cleanEmail);
          setOtpDigits(['', '', '', '', '', '']);
          setResendCooldown(60);
          setMode('verify-otp');
        } else {
          onClose();
        }
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : mode === 'login'
          ? 'Login failed. Check your credentials.'
          : 'Registration failed.';

      // If an unverified user tries to log in, transition directly to OTP verification
      if (mode === 'login' && /verification required/i.test(msg)) {
        const targetId = username.trim();
        setPendingIdentifier(targetId);
        setOtpDigits(['', '', '', '', '', '']);
        setMode('verify-otp');
        try {
          await resendOtp(targetId);
          setResendCooldown(60);
          setInfoMessage('Your account awaits email verification. We sent a fresh 6-digit code.');
        } catch {
          // ignore
        }
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
      data-testid="login-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#FFFDF9] dark:bg-[#38322E] border-2 border-[#AEAC78] rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12 animate-in zoom-in-95 duration-200">
        {/* Left Column: Visual Brand & Academic Identity */}
        <div className="hidden md:flex md:col-span-5 bg-[#FCF0DA] dark:bg-[#2C2623] p-7 flex-col justify-between border-r border-[#AEAC78]/40">
          <div>
            <div className="flex items-center space-x-2.5">
              <img
                src="/logo.png"
                alt="VeriPie"
                className="h-9 w-auto object-contain"
              />
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#F2C46A]/35 text-[#4C4541] dark:text-[#F2C46A] border border-[#AEAC78]/50">
                <ShieldCheck className="w-3 h-3" />
                <span>Faculty Portal</span>
              </span>
            </div>
            <p className="mt-2 text-xs text-[#6B625B] dark:text-[#D8CEBA] font-medium leading-relaxed">
              Automated Python Evaluation &amp; Deterministic Evidence Workstation.
            </p>
          </div>

          <div className="my-4 flex items-center justify-center">
            <img
              src="/lecturer-illustration.svg"
              alt="Instructor grading workstation illustration"
              className="w-full max-w-[240px] h-auto object-contain drop-shadow-xs select-none"
            />
          </div>

          <div className="pt-3 border-t border-[#AEAC78]/30 text-[11px] font-mono text-[#6B625B] dark:text-[#AEAC78] flex items-center justify-between">
            <span>Evidence First</span>
            <span>&middot;</span>
            <span>Human Decision Last</span>
          </div>
        </div>

        {/* Right Column: Sign-In, Registration, OTP, or Password Reset */}
        <div className="md:col-span-7 p-6 sm:p-7 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between pb-3 border-b border-[#AEAC78]/30">
              <div>
                <h2
                  id="login-modal-title"
                  className="text-lg font-bold text-[#4C4541] dark:text-[#FCF0DA] tracking-tight"
                >
                  {mode === 'login'
                    ? 'Instructor Workstation Sign-In'
                    : mode === 'register'
                    ? 'Create Instructor Account'
                    : mode === 'verify-otp'
                    ? 'Verify Your Academic Email'
                    : mode === 'forgot-password'
                    ? 'Reset Account Password'
                    : 'Enter Reset Code & Set Password'}
                </h2>
                <p className="mt-0.5 text-xs text-[#6B625B] dark:text-[#D8CEBA]">
                  {mode === 'login'
                    ? 'Enter your academic lecturer credentials to access cohorts and grading queues.'
                    : mode === 'register'
                    ? 'Register a dedicated instructor workspace to manage courses and evaluate submissions.'
                    : mode === 'verify-otp'
                    ? `We sent a 6-digit verification code to ${pendingIdentifier || email}.`
                    : mode === 'forgot-password'
                    ? 'Enter your username or email address and we will send a 6-digit verification code.'
                    : `Enter the 6-digit code sent to ${pendingIdentifier || resetIdentifier || username || email} along with your new password.`}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close login dialog"
                className="text-[#6B625B] dark:text-[#AEAC78] hover:text-[#4C4541] dark:hover:text-[#FCF0DA] p-1.5 rounded-lg hover:bg-[#FCF0DA]/50 dark:hover:bg-[#2C2623] transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Top Navigation / Mode Toggle */}
            {mode === 'login' || mode === 'register' ? (
              <div className="mt-3.5 grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#FCF0DA]/60 dark:bg-[#2C2623] border border-[#AEAC78]/40 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                    mode === 'login'
                      ? 'bg-[#4C4541] dark:bg-[#F2C46A] text-[#FCF0DA] dark:text-[#4C4541] shadow-xs'
                      : 'text-[#6B625B] dark:text-[#AEAC78] hover:text-[#4C4541] dark:hover:text-[#FCF0DA]'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                    mode === 'register'
                      ? 'bg-[#4C4541] dark:bg-[#F2C46A] text-[#FCF0DA] dark:text-[#4C4541] shadow-xs'
                      : 'text-[#6B625B] dark:text-[#AEAC78] hover:text-[#4C4541] dark:hover:text-[#FCF0DA]'
                  }`}
                >
                  Create Account
                </button>
              </div>
            ) : mode === 'verify-otp' ? (
              <div className="mt-3 flex items-center justify-between text-xs bg-[#FCF0DA]/55 dark:bg-[#2C2623] px-3 py-2 rounded-xl border border-[#AEAC78]/35">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Mail className="w-3.5 h-3.5 text-[#4C4541] dark:text-[#F2C46A] shrink-0" />
                  <span className="font-mono text-[11px] truncate font-semibold">
                    {pendingIdentifier || email}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#4C4541] dark:text-[#F2C46A] hover:underline shrink-0 ml-2 cursor-pointer"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Change email</span>
                </button>
              </div>
            ) : mode === 'reset-password' ? (
              <div className="mt-3 flex items-center justify-between text-xs bg-[#FCF0DA]/55 dark:bg-[#2C2623] px-3 py-2 rounded-xl border border-[#AEAC78]/35">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Mail className="w-3.5 h-3.5 text-[#4C4541] dark:text-[#F2C46A] shrink-0" />
                  <span className="font-mono text-[11px] truncate font-semibold">
                    {pendingIdentifier || resetIdentifier || username || email}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => switchMode('forgot-password')}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#4C4541] dark:text-[#F2C46A] hover:underline shrink-0 ml-2 cursor-pointer"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Change identifier</span>
                </button>
              </div>
            ) : (
              <div className="mt-3 flex items-center justify-between text-xs bg-[#FCF0DA]/55 dark:bg-[#2C2623] px-3 py-2 rounded-xl border border-[#AEAC78]/35">
                <span className="text-[11px] text-[#6B625B] dark:text-[#AEAC78]">
                  Forgot password recovery
                </span>
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#4C4541] dark:text-[#F2C46A] hover:underline shrink-0 ml-2 cursor-pointer"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Back to login</span>
                </button>
              </div>
            )}

            {error && (
              <div className="mt-3.5 p-3 bg-[#8F3D2C]/10 border border-[#8F3D2C] rounded-xl text-xs text-[#8F3D2C] dark:text-[#f8b4a6] flex items-start space-x-2">
                <ShieldAlert className="w-4 h-4 text-[#8F3D2C] shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {infoMessage && (
              <div className="mt-3.5 p-3 bg-emerald-500/10 border border-emerald-600/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>{infoMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
              {/* MODE 1: VERIFY-OTP (Registration Verification) */}
              {mode === 'verify-otp' && (
                <div data-testid="otp-verification-panel" className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#4C4541] dark:text-[#FCF0DA] mb-2 text-center">
                      Enter 6-Digit Verification Code
                    </label>
                    <div className="grid grid-cols-6 gap-2 max-w-xs mx-auto">
                      {otpDigits.map((digit, idx) => (
                        <input
                          key={idx}
                          ref={(el) => {
                            otpInputRefs.current[idx] = el;
                          }}
                          data-testid={`otp-digit-${idx}`}
                          aria-label={`Verification digit ${idx + 1}`}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                          onPaste={handleOtpPaste}
                          className="w-full h-12 text-center font-mono text-lg font-bold bg-[#FCF0DA]/60 dark:bg-[#2C2623] border-2 border-[#AEAC78] rounded-xl text-[#4C4541] dark:text-[#FCF0DA] focus:outline-none focus:border-[#F2C46A] focus:ring-2 focus:ring-[#F2C46A]/40 transition-all"
                        />
                      ))}
                    </div>
                    <p className="mt-2 text-center text-[11px] text-[#6B625B] dark:text-[#AEAC78]">
                      Check your inbox (and Spam folder) for the 6-digit code sent by VeriPie.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || otpDigits.join('').length !== 6}
                    className="w-full py-2.5 bg-[#F2C46A] hover:bg-[#e2b55b] border border-[#AEAC78]/60 disabled:opacity-50 text-[#4C4541] rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>{loading ? 'Verifying Code...' : 'Verify & Open Workstation'}</span>
                  </button>

                  <div className="flex items-center justify-between pt-1 text-xs text-[#6B625B] dark:text-[#AEAC78]">
                    <span>Didn&apos;t receive the email?</span>
                    <button
                      type="button"
                      disabled={resendCooldown > 0 || loading}
                      onClick={handleResendOtp}
                      className="inline-flex items-center gap-1 font-bold text-[#4C4541] dark:text-[#F2C46A] hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>
                        {resendCooldown > 0
                          ? `Resend in ${resendCooldown}s`
                          : 'Resend 6-Digit Code'}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* MODE 2: FORGOT-PASSWORD (Request reset code) */}
              {mode === 'forgot-password' && (
                <div data-testid="forgot-password-panel" className="space-y-4">
                  <div>
                    <label
                      htmlFor="forgot-identifier-input"
                      className="block text-xs font-semibold text-[#4C4541] dark:text-[#FCF0DA] mb-1"
                    >
                      Username or Academic Email
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#AEAC78]">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        id="forgot-identifier-input"
                        type="text"
                        required
                        autoFocus
                        value={resetIdentifier}
                        onChange={(e) => setResetIdentifier(e.target.value)}
                        placeholder="e.g. lecturer_username or user@university.edu"
                        className="w-full pl-9 pr-3 py-2.5 bg-[#FCF0DA]/50 dark:bg-[#2C2623] border border-[#AEAC78] rounded-xl text-[#4C4541] dark:text-[#FCF0DA] text-xs focus:outline-none focus:border-[#F2C46A] focus:ring-1 focus:ring-[#F2C46A] font-sans transition-colors placeholder-[#8F8782]"
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-[#6B625B] dark:text-[#AEAC78]">
                      Enter your account username or registered email. We will send a 6-digit code to reset your password.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !resetIdentifier.trim()}
                    className="w-full py-2.5 bg-[#F2C46A] hover:bg-[#e2b55b] border border-[#AEAC78]/60 disabled:opacity-50 text-[#4C4541] rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>{loading ? 'Sending Code...' : 'Send Password Reset Code'}</span>
                  </button>
                </div>
              )}

              {/* MODE 3: RESET-PASSWORD (Enter OTP & new password) */}
              {mode === 'reset-password' && (
                <div data-testid="reset-password-panel" className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-[#4C4541] dark:text-[#FCF0DA] mb-2 text-center">
                      Enter 6-Digit Password Reset Code
                    </label>
                    <div className="grid grid-cols-6 gap-2 max-w-xs mx-auto">
                      {otpDigits.map((digit, idx) => (
                        <input
                          key={idx}
                          ref={(el) => {
                            otpInputRefs.current[idx] = el;
                          }}
                          data-testid={`reset-otp-digit-${idx}`}
                          aria-label={`Reset verification digit ${idx + 1}`}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                          onPaste={handleOtpPaste}
                          className="w-full h-11 text-center font-mono text-base font-bold bg-[#FCF0DA]/60 dark:bg-[#2C2623] border-2 border-[#AEAC78] rounded-xl text-[#4C4541] dark:text-[#FCF0DA] focus:outline-none focus:border-[#F2C46A] focus:ring-2 focus:ring-[#F2C46A]/40 transition-all"
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-2 text-[11px] text-[#6B625B] dark:text-[#AEAC78]">
                      <span>Check your email for the 6-digit code</span>
                      <button
                        type="button"
                        disabled={resendCooldown > 0 || loading}
                        onClick={handleResendOtp}
                        className="inline-flex items-center gap-1 font-bold text-[#4C4541] dark:text-[#F2C46A] hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>
                          {resendCooldown > 0
                            ? `Resend in ${resendCooldown}s`
                            : 'Resend Code'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div>
                    <label
                      htmlFor="reset-new-password"
                      className="block text-xs font-semibold text-[#4C4541] dark:text-[#FCF0DA] mb-1"
                    >
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        id="reset-new-password"
                        type={showResetPassword ? 'text' : 'password'}
                        required
                        value={resetNewPassword}
                        onChange={(e) => setResetNewPassword(e.target.value)}
                        placeholder="Min. 8 characters, uppercase, number & symbol"
                        className="w-full pl-3 pr-10 py-2 bg-[#FCF0DA]/50 dark:bg-[#2C2623] border border-[#AEAC78] rounded-xl text-[#4C4541] dark:text-[#FCF0DA] text-xs focus:outline-none focus:border-[#F2C46A] focus:ring-1 focus:ring-[#F2C46A] font-sans transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#AEAC78] hover:text-[#4C4541] dark:hover:text-[#FCF0DA]"
                      >
                        {showResetPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {/* Real-Time Requirement Checklist */}
                    <div className="mt-2 p-2.5 rounded-xl bg-[#FCF0DA]/40 dark:bg-[#2C2623] border border-[#AEAC78]/30 space-y-1 text-[11px]">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        <div className={`flex items-center space-x-1.5 ${resetHasLength ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-[#8F8782]'}`}>
                          <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${resetHasLength ? 'bg-emerald-500 text-white' : 'bg-black/10 dark:bg-white/10'}`}>
                            {resetHasLength ? <Check className="w-2.5 h-2.5" /> : '-'}
                          </span>
                          <span>8 to 72 characters</span>
                        </div>

                        <div className={`flex items-center space-x-1.5 ${resetHasUpper ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-[#8F8782]'}`}>
                          <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${resetHasUpper ? 'bg-emerald-500 text-white' : 'bg-black/10 dark:bg-white/10'}`}>
                            {resetHasUpper ? <Check className="w-2.5 h-2.5" /> : '-'}
                          </span>
                          <span>One uppercase (A-Z)</span>
                        </div>

                        <div className={`flex items-center space-x-1.5 ${resetHasLower ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-[#8F8782]'}`}>
                          <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${resetHasLower ? 'bg-emerald-500 text-white' : 'bg-black/10 dark:bg-white/10'}`}>
                            {resetHasLower ? <Check className="w-2.5 h-2.5" /> : '-'}
                          </span>
                          <span>One lowercase (a-z)</span>
                        </div>

                        <div className={`flex items-center space-x-1.5 ${resetHasNumber ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-[#8F8782]'}`}>
                          <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${resetHasNumber ? 'bg-emerald-500 text-white' : 'bg-black/10 dark:bg-white/10'}`}>
                            {resetHasNumber ? <Check className="w-2.5 h-2.5" /> : '-'}
                          </span>
                          <span>One number (0-9)</span>
                        </div>

                        <div className={`flex items-center space-x-1.5 sm:col-span-2 ${resetHasSpecial ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-[#8F8782]'}`}>
                          <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${resetHasSpecial ? 'bg-emerald-500 text-white' : 'bg-black/10 dark:bg-white/10'}`}>
                            {resetHasSpecial ? <Check className="w-2.5 h-2.5" /> : '-'}
                          </span>
                          <span>One special symbol (!@#$%^&*...)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Confirm New Password */}
                  <div>
                    <label
                      htmlFor="reset-confirm-password"
                      className="block text-xs font-semibold text-[#4C4541] dark:text-[#FCF0DA] mb-1"
                    >
                      Confirm New Password
                    </label>
                    <input
                      id="reset-confirm-password"
                      type="password"
                      required
                      value={resetConfirmPassword}
                      onChange={(e) => setResetConfirmPassword(e.target.value)}
                      placeholder="Re-enter your new password"
                      className="w-full px-3 py-2 bg-[#FCF0DA]/50 dark:bg-[#2C2623] border border-[#AEAC78] rounded-xl text-[#4C4541] dark:text-[#FCF0DA] text-xs focus:outline-none focus:border-[#F2C46A] focus:ring-1 focus:ring-[#F2C46A] font-sans transition-colors"
                    />
                    {resetConfirmPassword && (
                      <p className={`mt-1 text-[11px] font-semibold flex items-center space-x-1 ${resetPasswordsMatch ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {resetPasswordsMatch && <Check className="w-3 h-3" />}
                        <span>{resetPasswordsMatch ? 'Passwords match' : 'Passwords do not match'}</span>
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading || otpDigits.join('').length !== 6 || !isResetPasswordValid || !resetPasswordsMatch}
                    className="w-full py-2.5 bg-[#F2C46A] hover:bg-[#e2b55b] border border-[#AEAC78]/60 disabled:opacity-50 text-[#4C4541] rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>{loading ? 'Updating Password...' : 'Reset Password & Sign In'}</span>
                  </button>
                </div>
              )}

              {/* MODE 4 & 5: LOGIN & REGISTER */}
              {(mode === 'login' || mode === 'register') && (
                <>
                  {mode === 'register' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#4C4541] dark:text-[#FCF0DA] mb-1">
                          Full Name
                        </label>
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Dr. Nguyen Van A"
                          className="w-full px-3 py-2 bg-[#FCF0DA]/50 dark:bg-[#2C2623] border border-[#AEAC78] rounded-xl text-[#4C4541] dark:text-[#FCF0DA] text-xs focus:outline-none focus:border-[#F2C46A] focus:ring-1 focus:ring-[#F2C46A] font-sans transition-colors placeholder-[#8F8782]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#4C4541] dark:text-[#FCF0DA] mb-1">
                          Academic Email
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#AEAC78]">
                            <Mail className="w-3.5 h-3.5" />
                          </div>
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="lecturer@university.edu"
                            className="w-full pl-8 pr-3 py-2 bg-[#FCF0DA]/50 dark:bg-[#2C2623] border border-[#AEAC78] rounded-xl text-[#4C4541] dark:text-[#FCF0DA] text-xs focus:outline-none focus:border-[#F2C46A] focus:ring-1 focus:ring-[#F2C46A] font-sans transition-colors placeholder-[#8F8782]"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-[#4C4541] dark:text-[#FCF0DA] mb-1">
                      {mode === 'login' ? 'Username or Email' : 'Username'}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#AEAC78]">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        required
                        minLength={mode === 'register' ? 3 : undefined}
                        maxLength={mode === 'register' ? 32 : undefined}
                        autoFocus
                        value={username}
                        onChange={(e) =>
                          setUsername(
                            mode === 'register'
                              ? e.target.value.toLowerCase().replace(/[@\s]/g, '')
                              : e.target.value
                          )
                        }
                        placeholder="lecturer_username"
                        className="w-full pl-9 pr-3 py-2.5 bg-[#FCF0DA]/50 dark:bg-[#2C2623] border border-[#AEAC78] rounded-xl text-[#4C4541] dark:text-[#FCF0DA] text-xs focus:outline-none focus:border-[#F2C46A] focus:ring-1 focus:ring-[#F2C46A] font-sans transition-colors placeholder-[#8F8782]"
                      />
                    </div>
                    {mode === 'register' && (
                      <p className="mt-1 text-[10px] text-[#6B625B] dark:text-[#AEAC78]">
                        3-32 characters &middot; lowercase letters, numbers, dot or underscore (no spaces, no @)
                      </p>
                    )}
                  </div>

                  <div className={mode === 'register' ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : ''}>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-[#4C4541] dark:text-[#FCF0DA]">
                          Password
                        </label>
                        {mode === 'login' && (
                          <button
                            type="button"
                            onClick={() => {
                              setResetIdentifier(username.trim());
                              switchMode('forgot-password');
                            }}
                            className="text-[11px] font-bold text-[#4C4541] dark:text-[#F2C46A] hover:underline cursor-pointer"
                          >
                            Forgot password?
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#AEAC78]">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          type="password"
                          required
                          minLength={mode === 'register' ? 8 : undefined}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={mode === 'register' ? 'Min. 8 characters' : 'Enter password'}
                          className="w-full pl-9 pr-3 py-2.5 bg-[#FCF0DA]/50 dark:bg-[#2C2623] border border-[#AEAC78] rounded-xl text-[#4C4541] dark:text-[#FCF0DA] text-xs focus:outline-none focus:border-[#F2C46A] focus:ring-1 focus:ring-[#F2C46A] font-sans transition-colors placeholder-[#8F8782]"
                        />
                      </div>
                    </div>

                    {mode === 'register' && (
                      <div>
                        <label className="block text-xs font-semibold text-[#4C4541] dark:text-[#FCF0DA] mb-1">
                          Confirm Password
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#AEAC78]">
                            <Lock className="w-4 h-4" />
                          </div>
                          <input
                            type="password"
                            required
                            minLength={8}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-enter password"
                            className="w-full pl-9 pr-3 py-2.5 bg-[#FCF0DA]/50 dark:bg-[#2C2623] border border-[#AEAC78] rounded-xl text-[#4C4541] dark:text-[#FCF0DA] text-xs focus:outline-none focus:border-[#F2C46A] focus:ring-1 focus:ring-[#F2C46A] font-sans transition-colors placeholder-[#8F8782]"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 bg-[#F2C46A] hover:bg-[#e2b55b] border border-[#AEAC78]/60 disabled:opacity-50 text-[#4C4541] rounded-xl text-xs font-bold transition-all shadow-md mt-2 flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    {mode === 'login' ? <KeyRound className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                    <span>
                      {loading
                        ? mode === 'login'
                          ? 'Authenticating...'
                          : 'Sending Verification Code...'
                        : mode === 'login'
                        ? 'Sign In to Workstation'
                        : 'Create Instructor Account'}
                    </span>
                  </button>
                </>
              )}
            </form>
          </div>

          <p className="mt-5 pt-3 border-t border-[#AEAC78]/30 text-center text-[11px] text-[#6B625B] dark:text-[#AEAC78]">
            {mode === 'login' ? (
              <>
                New to VeriPie?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="font-bold text-[#4C4541] dark:text-[#F2C46A] hover:underline cursor-pointer"
                >
                  Create an instructor account
                </button>
              </>
            ) : mode === 'register' ? (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="font-bold text-[#4C4541] dark:text-[#F2C46A] hover:underline cursor-pointer"
                >
                  Sign in here
                </button>
              </>
            ) : (
              <>
                Remember your password?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="font-bold text-[#4C4541] dark:text-[#F2C46A] hover:underline cursor-pointer"
                >
                  Back to Sign In
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};
