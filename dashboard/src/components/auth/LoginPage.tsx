import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { INTERSYS_LOGO_BASE64 } from '../../assets/logoBase64';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const res = await login(identifier, password);
      if (!res.success) {
        setErrorMessage(res.error || 'Authentication failed. Please check credentials.');
      }
    } catch {
      setErrorMessage('Network error during authentication. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 select-none relative bg-[#f3f5f9]">
      {/* Background soft ambient orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#001F3F]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] bg-[#FF3523]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-[420px] relative z-10">
        {/* Card Container */}
        <div className="bg-white border border-slate-100 rounded-md shadow-xl shadow-slate-200/50 p-8 sm:p-10">
          {/* Header Brand */}
          <div className="text-center mb-7">
            <div className="flex items-center justify-center mb-4">
              <img
                src={INTERSYS_LOGO_BASE64}
                alt="Intersys Solutions"
                className="h-10 w-auto object-contain"
                onError={(e) => {
                  e.currentTarget.src = '/intersys_logo.png';
                }}
              />
            </div>

            <h1 className="text-xl font-bold text-slate-800 mb-1">
              Welcome Back
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Sign in to manage building telemetry & billing
            </p>
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-md bg-[#fef2f2] border border-[#FF3523]/20 flex items-start gap-2.5 text-xs text-[#FF3523]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-snug font-medium">{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            {/* Username / Email */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Admin Username or Email
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="admin@intersys.com"
                  autoComplete="username"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#001F3F] text-slate-800 text-xs rounded-md pl-10 pr-3 py-2.5 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#001F3F]/20 focus:bg-white transition"
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#001F3F] text-slate-800 text-xs rounded-md pl-10 pr-10 py-2.5 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#001F3F]/20 focus:bg-white transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-3 flex items-center justify-center gap-2 py-3 px-4 rounded-md text-xs font-bold text-white bg-[#001F3F] hover:bg-[#001428] active:bg-[#001020] transition cursor-pointer disabled:opacity-60 shadow-md shadow-[#001F3F]/20"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Security Footer */}
        <div className="text-center mt-5 text-xs text-slate-400 font-medium">
          <span>Protected by 256-bit TLS • Enterprise Niagara BMS</span>
        </div>
      </div>
    </div>
  );
};
