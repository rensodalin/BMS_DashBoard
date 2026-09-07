import React, { useEffect, useState } from 'react';
import {
  Shield,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  LogOut,
  Camera,
  Copy,
  RotateCcw,
  Building,
  UserPlus,
  Users,
  Trash2,
  CheckCheck,
} from 'lucide-react';
import { useAuth, type ClientAccount } from '../../context/AuthContext';

export const AdminSettingsPage: React.FC = () => {
  const {
    user,
    updateAdminProfile,
    resetToEnvDefaults,
    logout,
    clientAccounts,
    addClientAccount,
    updateClientAccount,
    deleteClientAccount,
  } = useAuth();

  // Tab state: 'account' | 'clients'
  const [activeTab, setActiveTab] = useState<'account' | 'clients'>('account');

  // Admin Profile form states
  const [firstName, setFirstName] = useState('System');
  const [lastName, setLastName] = useState('Administrator');
  const [email, setEmail] = useState('admin@intersys.com');
  const [username, setUsername] = useState('admin');
  const [phoneNumber, setPhoneNumber] = useState('+855 (0) 12 345 678');
  const [department, setDepartment] = useState('BMS Automation & Controls');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // New Client Account form states
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientUsername, setClientUsername] = useState('');
  const [clientPassword, setClientPassword] = useState('');
  const [clientRole, setClientRole] = useState<'client' | 'tenant' | 'viewer'>('client');
  const [clientTenant, setClientTenant] = useState('KOI Facility');
  const [clientShowPass, setClientShowPass] = useState(false);
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [copiedClientId, setCopiedClientId] = useState<string | null>(null);

  // Cover image preset
  const [coverPreset, setCoverPreset] = useState<number>(0);
  const coverGradients = [
    'linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #00a4e4 100%)',
    'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0284c7 100%)',
    'linear-gradient(135deg, #1e1b4b 0%, #3730a3 50%, #06b6d4 100%)',
  ];

  // Feedback states
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [warningMsg, setWarningMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const [hasCustomCreds, setHasCustomCreds] = useState(false);

  useEffect(() => {
    if (user) {
      const parts = (user.name || 'System Administrator').trim().split(' ');
      setFirstName(parts[0] || 'System');
      setLastName(parts.slice(1).join(' ') || 'Administrator');
      setEmail(user.email || 'admin@intersys.com');
      setUsername(user.email ? user.email.split('@')[0] : 'admin');
      setPassword('');
      setConfirmPassword('');
      setErrorMsg('');
      setSuccessMsg('');
      setWarningMsg('');
    }
    const custom = localStorage.getItem('bms_admin_custom_credentials');
    setHasCustomCreds(!!custom);
  }, [user]);

  // Handle Admin Profile Update
  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setWarningMsg('');

    if (password && password !== confirmPassword) {
      setErrorMsg('New password and confirmation password do not match.');
      return;
    }

    if (password && password.length < 4) {
      setErrorMsg('Password must be at least 4 characters.');
      return;
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim() || 'System Administrator';

    setIsSaving(true);
    try {
      const res = await updateAdminProfile({
        name: fullName,
        email: email.trim(),
        password: password || undefined,
      });

      if (res.success) {
        if (res.warning) {
          setWarningMsg(res.warning);
          setSuccessMsg('Administrator profile saved locally.');
        } else {
          setSuccessMsg('Administrator account settings updated and synced to Supabase.');
        }
        setPassword('');
        setConfirmPassword('');
        setHasCustomCreds(true);
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setErrorMsg(res.error || 'Failed to update administrator settings.');
      }
    } catch {
      setErrorMsg('Unexpected error while saving changes.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Create Client Account
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!clientName.trim()) {
      setErrorMsg('Client account name is required.');
      return;
    }
    if (!clientEmail.trim()) {
      setErrorMsg('Client email address is required.');
      return;
    }
    if (!clientPassword.trim()) {
      setErrorMsg('Client password is required.');
      return;
    }
    if (clientPassword.length < 4) {
      setErrorMsg('Client password must be at least 4 characters.');
      return;
    }

    setIsCreatingClient(true);
    try {
      const res = await addClientAccount({
        name: clientName.trim(),
        email: clientEmail.trim().toLowerCase(),
        username: clientUsername.trim().toLowerCase() || clientEmail.trim().toLowerCase().split('@')[0],
        password: clientPassword.trim(),
        role: clientRole,
        assignedTenant: clientTenant.trim() || 'All Tenants',
        status: 'ACTIVE',
      });

      if (res.success) {
        if (res.warning) {
          setWarningMsg(res.warning);
          setSuccessMsg(`Client account for "${clientName.trim()}" saved locally.`);
        } else {
          setSuccessMsg(`Client account for "${clientName.trim()}" created and synced to Supabase!`);
          setWarningMsg('');
        }
        setClientName('');
        setClientEmail('');
        setClientUsername('');
        setClientPassword('');
        setTimeout(() => setSuccessMsg(''), 4500);
      } else {
        setErrorMsg(res.error || 'Failed to create client account.');
      }
    } catch {
      setErrorMsg('Error creating client account.');
    } finally {
      setIsCreatingClient(false);
    }
  };

  const handleToggleClientStatus = async (client: ClientAccount) => {
    const nextStatus = client.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const res = await updateClientAccount(client.id, { status: nextStatus });
    if (res.success) {
      setSuccessMsg(`Account for "${client.name}" is now ${nextStatus}.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  };

  const handleDeleteClient = async (client: ClientAccount) => {
    if (window.confirm(`Delete client account for "${client.name}" (${client.email})? This client will no longer be able to log in.`)) {
      const res = await deleteClientAccount(client.id);
      if (res.success) {
        setSuccessMsg(`Client account for "${client.name}" was deleted.`);
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    }
  };

  const handleCopyClientCredentials = (client: ClientAccount) => {
    const text = `BMS Portal Access:\nUsername: ${client.username || client.email}\nEmail: ${client.email}\nPassword: ${client.password}\nRole: ${client.role.toUpperCase()}`;
    navigator.clipboard.writeText(text);
    setCopiedClientId(client.id);
    setTimeout(() => setCopiedClientId(null), 2500);
  };

  const handleResetDefaults = () => {
    if (window.confirm('Reset administrator name and credentials back to .env defaults?')) {
      resetToEnvDefaults();
      setHasCustomCreds(false);
      setSuccessMsg('Reverted administrator credentials to .env defaults.');
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  };

  const handleCopyLink = () => {
    const textToCopy = `https://192.168.1.140/bms/admin (${email})`;
    navigator.clipboard.writeText(textToCopy);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2500);
  };

  const cycleCover = () => {
    setCoverPreset((prev) => (prev + 1) % coverGradients.length);
  };

  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim() || 'System Administrator';
  const initials = firstName ? `${firstName[0]}${lastName ? lastName[0] : ''}`.toUpperCase() : 'AD';

  return (
    <div className="flex-1 w-full animate-fadeIn text-left select-none">
      {/* =========================================================
          HERO COVER BANNER
      ========================================================== */}
      <div
        className="w-full h-48 md:h-56 rounded-2xl relative overflow-hidden transition-all duration-700 shadow-xl"
        style={{
          background: coverGradients[coverPreset],
        }}
      >
        {/* Subtle geometric polygon overlay */}
        <div
          className="absolute inset-0 opacity-25 pointer-events-none mix-blend-overlay"
          style={{
            backgroundImage:
              'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.4) 0%, transparent 50%), linear-gradient(60deg, transparent 40%, rgba(255,255,255,0.15) 45%, transparent 60%)',
          }}
        />

        {/* Top bar controls on cover */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          <button
            type="button"
            onClick={cycleCover}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/35 hover:bg-black/55 backdrop-blur-md border border-white/20 text-white text-xs font-medium transition cursor-pointer shadow-md"
            title="Change cover background gradient"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Change Cover</span>
          </button>
        </div>

        {/* Honeywell & Intersys Badge in Cover */}
        <div className="absolute bottom-5 left-6 md:left-8 hidden md:flex items-center gap-2 text-white/80 font-mono text-[11px]">
          <Shield className="w-4 h-4 text-white" />
          <span className="font-semibold tracking-wider">HONEYWELL FORGE • SECURE GATEWAY</span>
        </div>
      </div>

      {/* =========================================================
          MAIN 2-COLUMN PROFILE & SETTINGS CONTAINER (Overlapping Cover)
      ========================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 px-3 sm:px-6 -mt-16 md:-mt-20 relative z-10">

        {/* ── LEFT PROFILE CARD ── */}
        <div className="lg:col-span-4 xl:col-span-3">
          <div className="bg-[#15161b] border border-[#202228] rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center">
            {/* Avatar with Camera badge */}
            <div className="relative mb-3.5">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#00a4e4]/20 via-[#0e1626] to-[#00a4e4]/10 border-2 border-[#00a4e4]/50 p-1 flex items-center justify-center shadow-lg shadow-[#00a4e4]/10">
                <div className="w-full h-full rounded-full bg-[#10131a] flex items-center justify-center text-2xl font-bold text-[#00a4e4]">
                  {initials}
                </div>
              </div>
              <button
                type="button"
                onClick={cycleCover}
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[#00a4e4] hover:bg-[#0092cc] text-white flex items-center justify-center border-2 border-[#15161b] shadow-md transition cursor-pointer"
                title="Change Appearance"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Name & Organization */}
            <h2 className="text-base font-bold text-white tracking-tight">{fullName}</h2>


            {/* Status stats list */}
            <div className="w-full mt-6 pt-4 border-t border-[#202228] space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Assigned Role</span>
                <span className="font-semibold text-amber-400 font-mono">Super Admin</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Security Clearance</span>
                <span className="font-semibold text-emerald-400 font-mono">Level 5 (Root)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Provisioned Clients</span>
                <span className="font-semibold text-[#00a4e4] font-mono">{clientAccounts.length} Accounts</span>
              </div>
            </div>

            {/* Action Button: Sign Out */}
            <div className="w-full mt-6 space-y-2">
              <button
                type="button"
                onClick={() => logout()}
                className="w-full py-2 px-3 rounded-lg text-xs font-medium text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out of BMS</span>
              </button>

              {/* Copyable Profile / Gateway URL Bar */}

            </div>
          </div>
        </div>

        {/* ── RIGHT MAIN SETTINGS CARD ── */}
        <div className="lg:col-span-8 xl:col-span-9">
          <div className="bg-[#15161b] border border-[#202228] rounded-2xl shadow-2xl p-6 sm:p-7">

            {/* Top Tab Strip (matching reference UI) */}
            <div className="flex items-center gap-6 sm:gap-8 border-b border-[#202228] pb-3 mb-6 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('account')}
                className={`text-xs font-semibold pb-3 -mb-3 transition-colors cursor-pointer relative whitespace-nowrap ${activeTab === 'account'
                  ? 'text-white border-b-2 border-[#00a4e4]'
                  : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                Account Settings
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('clients')}
                className={`text-xs font-semibold pb-3 -mb-3 transition-colors cursor-pointer relative whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'clients'
                  ? 'text-white border-b-2 border-[#00a4e4]'
                  : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Add Client Account</span>
                {clientAccounts.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-[#00a4e4]/15 text-[#00a4e4] border border-[#00a4e4]/30">
                    {clientAccounts.length}
                  </span>
                )}
              </button>
            </div>

            {/* Alert notices */}
            {errorMsg && (
              <div className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/25 flex items-start gap-2.5 text-xs text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {warningMsg && (
              <div className="mb-5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <div className="space-y-1">
                  <div className="font-semibold text-amber-400 flex items-center gap-1.5">
                    <span>Supabase Cloud Sync Notice</span>
                  </div>
                  <div>{warningMsg}</div>
                </div>
              </div>
            )}

            {successMsg && (
              <div className="mb-5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-2 text-xs text-emerald-400">
                <Check className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* =========================================================
                TAB 1: ACCOUNT SETTINGS
            ========================================================== */}
            {activeTab === 'account' && (
              <form onSubmit={handleAdminSubmit} className="space-y-5">
                <div className="space-y-4">
                  {/* Row 1: First Name & Last Name */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        First Name
                      </label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="First name"
                        className="w-full bg-[#0e0f13] border border-[#202228] focus:border-[#00a4e4] text-white text-xs rounded-lg px-3.5 py-2.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30 font-mono transition-colors"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Last name"
                        className="w-full bg-[#0e0f13] border border-[#202228] focus:border-[#00a4e4] text-white text-xs rounded-lg px-3.5 py-2.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30 font-mono transition-colors"
                        required
                      />
                    </div>
                  </div>

                  {/* Row 2: Phone Number & Email Address */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Phone Number
                      </label>
                      <input
                        type="text"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+855 12 345 678"
                        className="w-full bg-[#0e0f13] border border-[#202228] focus:border-[#00a4e4] text-white text-xs rounded-lg px-3.5 py-2.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30 font-mono transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Email address
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@intersys.com"
                        className="w-full bg-[#0e0f13] border border-[#202228] focus:border-[#00a4e4] text-white text-xs rounded-lg px-3.5 py-2.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30 font-mono transition-colors"
                        required
                      />
                    </div>
                  </div>

                  {/* Row 3: Department / Facility & Username */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Department / Facility
                      </label>
                      <input
                        type="text"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder="Facility Operations"
                        className="w-full bg-[#0e0f13] border border-[#202228] focus:border-[#00a4e4] text-white text-xs rounded-lg px-3.5 py-2.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30 font-mono transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Admin Login Username
                      </label>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="admin"
                        className="w-full bg-[#0e0f13] border border-[#202228] focus:border-[#00a4e4] text-white text-xs rounded-lg px-3.5 py-2.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30 font-mono transition-colors"
                      />
                    </div>
                  </div>

                  {/* Row 4: Password Update */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        New Password <span className="text-slate-500 font-normal">(leave blank to keep current)</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-[#0e0f13] border border-[#202228] focus:border-[#00a4e4] text-white text-xs rounded-lg pl-3.5 pr-10 py-2.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30 font-mono transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition cursor-pointer"
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Confirm New Password
                      </label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-[#0e0f13] border border-[#202228] focus:border-[#00a4e4] text-white text-xs rounded-lg px-3.5 py-2.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30 font-mono transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Bottom Update Button */}
                <div className="pt-4 flex items-center justify-between border-t border-[#202228]">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2.5 rounded-lg text-xs font-semibold text-white bg-[#2563eb] hover:bg-[#1d4ed8] active:bg-[#1e40af] transition cursor-pointer disabled:opacity-50 shadow-md shadow-blue-600/20 flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isSaving ? 'Updating...' : 'Update Admin Account'}</span>
                  </button>

                  <div className="flex items-center gap-3">
                    {hasCustomCreds && (
                      <button
                        type="button"
                        onClick={handleResetDefaults}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-400 hover:text-white bg-[#202228] hover:bg-[#2a2d36] transition cursor-pointer"
                        title="Revert back to .env values"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-[#00a4e4]" />
                        <span>Reset to .env</span>
                      </button>
                    )}
                    <span className="text-[11px] font-mono text-slate-500">
                      Changes sync immediately to local session
                    </span>
                  </div>
                </div>
              </form>
            )}

            {/* =========================================================
                TAB 2: ADD CLIENT ACCOUNT & CLIENT DIRECTORY
            ========================================================== */}
            {activeTab === 'clients' && (
              <div className="space-y-7">
                {/* 1. Add Client Form */}
                <div className="bg-[#0e0f13] border border-[#202228] rounded-xl p-5">
                  <div className="flex items-center gap-2.5 pb-3 mb-4 border-b border-[#202228]">
                    <div className="w-8 h-8 rounded-lg bg-[#00a4e4]/15 border border-[#00a4e4]/30 flex items-center justify-center text-[#00a4e4]">
                      <UserPlus className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">Create New Client Account</h3>
                      <p className="text-[11px] text-slate-400 font-mono">
                        Assign name, login email, password, and access scope
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleCreateClient} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Name */}
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
                          Client Full Name / Company
                        </label>
                        <input
                          type="text"
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value)}
                          placeholder="e.g. KOI Facility Manager"
                          className="w-full bg-[#15161b] border border-[#202228] focus:border-[#00a4e4] text-white text-xs rounded-lg px-3.5 py-2.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30 font-mono transition-colors"
                          required
                        />
                      </div>

                      {/* Email */}
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
                          Client Login Email
                        </label>
                        <input
                          type="email"
                          value={clientEmail}
                          onChange={(e) => setClientEmail(e.target.value)}
                          placeholder="e.g. client@koi.com"
                          className="w-full bg-[#15161b] border border-[#202228] focus:border-[#00a4e4] text-white text-xs rounded-lg px-3.5 py-2.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30 font-mono transition-colors"
                          required
                        />
                      </div>

                      {/* Username */}
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
                          Login Username <span className="text-slate-500 font-normal">(optional prefix)</span>
                        </label>
                        <input
                          type="text"
                          value={clientUsername}
                          onChange={(e) => setClientUsername(e.target.value)}
                          placeholder="e.g. koi_client"
                          className="w-full bg-[#15161b] border border-[#202228] focus:border-[#00a4e4] text-white text-xs rounded-lg px-3.5 py-2.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30 font-mono transition-colors"
                        />
                      </div>

                      {/* Password */}
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
                          Client Password
                        </label>
                        <div className="relative">
                          <input
                            type={clientShowPass ? 'text' : 'password'}
                            value={clientPassword}
                            onChange={(e) => setClientPassword(e.target.value)}
                            placeholder="Enter login password"
                            className="w-full bg-[#15161b] border border-[#202228] focus:border-[#00a4e4] text-white text-xs rounded-lg pl-3.5 pr-10 py-2.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30 font-mono transition-colors"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setClientShowPass(!clientShowPass)}
                            className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition cursor-pointer"
                            tabIndex={-1}
                          >
                            {clientShowPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Assigned Role */}
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
                          Assigned Role
                        </label>
                        <select
                          value={clientRole}
                          onChange={(e) => setClientRole(e.target.value as any)}
                          className="w-full bg-[#15161b] border border-[#202228] focus:border-[#00a4e4] text-white text-xs rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30 font-mono transition-colors cursor-pointer"
                        >
                          <option value="client">Client (Dashboard & Telemetry)</option>
                          <option value="tenant">Tenant (Utility Billing & Meters)</option>
                          <option value="viewer">Viewer (Read-Only Telemetry)</option>
                        </select>
                      </div>

                      {/* Access Scope / Tenant */}
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
                          Assigned Scope / Tenant
                        </label>
                        <input
                          type="text"
                          value={clientTenant}
                          onChange={(e) => setClientTenant(e.target.value)}
                          placeholder="e.g. KOI Facility, Amazon, or All Tenants"
                          className="w-full bg-[#15161b] border border-[#202228] focus:border-[#00a4e4] text-white text-xs rounded-lg px-3.5 py-2.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30 font-mono transition-colors"
                        />
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-end">
                      <button
                        type="submit"
                        disabled={isCreatingClient}
                        className="px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-[#00a4e4] hover:bg-[#0092cc] active:bg-[#0081b5] transition cursor-pointer disabled:opacity-50 shadow-md shadow-[#00a4e4]/15 flex items-center gap-2"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>{isCreatingClient ? 'Provisioning Account...' : 'Provision Client Account'}</span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* 2. Client Accounts Directory Table */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#00a4e4]" />
                      <h3 className="text-xs font-semibold text-white">
                        Authorized Client Accounts ({clientAccounts.length})
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">
                      Only listed accounts have login authorization
                    </span>
                  </div>

                  {clientAccounts.length === 0 ? (
                    <div className="p-8 rounded-xl bg-[#0e0f13] border border-[#202228] text-center space-y-2">
                      <Users className="w-8 h-8 text-slate-600 mx-auto" />
                      <p className="text-xs font-medium text-slate-300">No client accounts created yet</p>
                      <p className="text-[11px] text-slate-500 font-mono max-w-sm mx-auto">
                        Use the form above to provision a client account with their login email and password.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-[#202228] bg-[#0e0f13]">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-[#202228] text-[10px] font-mono uppercase text-slate-400 bg-[#12141a]">
                            <th className="py-2.5 px-3">Client / Name</th>
                            <th className="py-2.5 px-3">Login Username / ID</th>
                            <th className="py-2.5 px-3">Role</th>
                            <th className="py-2.5 px-3">Assigned Scope</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#202228]">
                          {clientAccounts.map((client) => {
                            const isCopied = copiedClientId === client.id;
                            return (
                              <tr key={client.id} className="hover:bg-[#15161b] transition-colors">
                                <td className="py-3 px-3">
                                  <div className="font-semibold text-white">{client.name}</div>
                                  <div className="text-[11px] text-slate-400 font-mono">{client.email}</div>
                                </td>

                                <td className="py-3 px-3 font-mono text-slate-300">
                                  {client.username || client.email.split('@')[0]}
                                </td>

                                <td className="py-3 px-3">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase border ${client.role === 'tenant'
                                    ? 'bg-purple-500/10 border-purple-500/25 text-purple-400'
                                    : client.role === 'viewer'
                                      ? 'bg-slate-500/10 border-slate-500/25 text-slate-400'
                                      : 'bg-[#00a4e4]/10 border-[#00a4e4]/25 text-[#00a4e4]'
                                    }`}>
                                    {client.role}
                                  </span>
                                </td>

                                <td className="py-3 px-3 text-slate-300 font-mono text-[11px]">
                                  {client.assignedTenant || 'All Tenants'}
                                </td>

                                <td className="py-3 px-3">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleClientStatus(client)}
                                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border transition cursor-pointer flex items-center gap-1.5 ${client.status === 'ACTIVE'
                                      ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20'
                                      : 'bg-red-500/10 border-red-500/25 text-red-400 hover:bg-red-500/20'
                                      }`}
                                    title="Click to toggle status"
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full ${client.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                    <span>{client.status}</span>
                                  </button>
                                </td>

                                <td className="py-3 px-3 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleCopyClientCredentials(client)}
                                      className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono text-slate-300 hover:text-white bg-[#1a1c23] hover:bg-[#252833] border border-[#202228] transition cursor-pointer"
                                      title="Copy login credentials to share with client"
                                    >
                                      {isCopied ? <CheckCheck className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-[#00a4e4]" />}
                                      <span>{isCopied ? 'Copied' : 'Credentials'}</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleDeleteClient(client)}
                                      className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                                      title={`Delete account for ${client.name}`}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
};
