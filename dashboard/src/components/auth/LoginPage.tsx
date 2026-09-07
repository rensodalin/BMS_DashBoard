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
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center p-4 select-none relative overflow-hidden"
      style={{
        backgroundColor: '#0a0b0e',
        backgroundImage: 'radial-gradient(circle at 50% 25%, rgba(0, 164, 228, 0.08), transparent 60%)',
      }}
    >
      {/* Background industrial grid accent */}
      <div
        className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          backgroundImage:
            'linear-gradient(#202228 1px, transparent 1px), linear-gradient(to right, #202228 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="w-full max-w-[420px] relative z-10">
        {/* Card Container */}
        <div className="bg-[#15161b] border border-[#202228] rounded-xl shadow-2xl shadow-black p-7 sm:p-8">
          {/* Header Brand */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center mb-3">
              <img
                src={INTERSYS_LOGO_BASE64}
                alt="Intersys Solutions"
                className="h-10 w-auto object-contain"
                onError={(e) => {
                  e.currentTarget.src = '/intersys_logo.png';
                }}
              />
            </div>

            <div className="flex items-center justify-center gap-2 mb-1">
              <h1 className="text-base font-semibold text-white tracking-wide">
                Remote Building Manager
              </h1>
            </div>



          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div className="mb-4 p-3 rounded bg-red-500/10 border border-red-500/25 flex items-start gap-2.5 text-xs text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-snug">{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            {/* Username / Email */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Admin Username or Email
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="admin@intersys.com"
                  autoComplete="username"
                  className="w-full bg-[#0e0f13] border border-[#202228] focus:border-[#00a4e4] text-white text-xs rounded-md pl-9 pr-3 py-2.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30 transition-colors"
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full bg-[#0e0f13] border border-[#202228] focus:border-[#00a4e4] text-white text-xs rounded-md pl-9 pr-10 py-2.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30 transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition cursor-pointer"
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
              className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-xs font-semibold text-white bg-[#00a4e4] hover:bg-[#0092cc] active:bg-[#0081b5] transition cursor-pointer disabled:opacity-60 shadow-md shadow-[#00a4e4]/10"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In as Administrator</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

        </div>

        {/* Security Footer */}
        <div className="text-center mt-4 text-[10px] text-slate-600 font-mono">
          <span>Protected by 256-bit TLS • Authorized Access Only</span>
        </div>
      </div>
    </div>
  );
};
