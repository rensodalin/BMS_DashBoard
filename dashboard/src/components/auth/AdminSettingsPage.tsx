import React, { useEffect, useState } from 'react';
import {
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  LogOut,
  Copy,
  RotateCcw,
  UserPlus,
  Users,
  Trash2,
  CheckCheck,
  Sliders,
} from 'lucide-react';
import { useAuth, type ClientAccount } from '../../context/AuthContext';

export const AdminSettingsPage: React.FC = () => {
  const {
    user,
    adminPassword,
    updateAdminProfile,
    resetToEnvDefaults,
    logout,
    clientAccounts,
    addClientAccount,
    updateClientAccount,
    deleteClientAccount,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'account' | 'clients'>('account');

  // Form states - Admin Profile
  const [firstName, setFirstName] = useState('System');
  const [lastName, setLastName] = useState('Administrator');
  const [email, setEmail] = useState('admin@intersys.com');
  const [username, setUsername] = useState('admin');
  const [phoneNumber, setPhoneNumber] = useState('+855 (0) 12 345 678');
  const [department, setDepartment] = useState('BMS Automation & Controls');
  const [showPassword, setShowPassword] = useState(false);
  const [copiedAdminPass, setCopiedAdminPass] = useState(false);

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

  // Feedback states
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [warningMsg, setWarningMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasCustomCreds, setHasCustomCreds] = useState(false);

  useEffect(() => {
    if (user) {
      const parts = (user.name || 'System Administrator').trim().split(' ');
      setFirstName(parts[0] || 'System');
      setLastName(parts.slice(1).join(' ') || 'Administrator');
      setEmail(user.email || 'admin@intersys.com');
      setUsername(user.email ? user.email.split('@')[0] : 'admin');
      setErrorMsg('');
      setSuccessMsg('');
      setWarningMsg('');
    }
    const custom = localStorage.getItem('bms_admin_custom_credentials');
    setHasCustomCreds(!!custom);
  }, [user]);

  const handleCopyAdminPassword = () => {
    const pw = adminPassword || import.meta.env.VITE_ADMIN_PASSWORD || 'admin12345.intersys';
    navigator.clipboard.writeText(pw);
    setCopiedAdminPass(true);
    setTimeout(() => setCopiedAdminPass(false), 2500);
  };

  // Handle Admin Profile Update
  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setWarningMsg('');

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim() || 'System Administrator';

    setIsSaving(true);
    try {
      const res = await updateAdminProfile({
        name: fullName,
        email: email.trim(),
      });

      if (res.success) {
        if (res.warning) {
          setWarningMsg(res.warning);
          setSuccessMsg('Administrator profile saved locally.');
        } else {
          setSuccessMsg('Administrator account settings updated and synced to Supabase.');
        }
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

  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim() || 'System Administrator';
  const initials = firstName ? `${firstName[0]}${lastName ? lastName[0] : ''}`.toUpperCase() : 'AD';

  return (
    <div className="flex-1 w-full text-left select-none font-sans pb-10">
      {/* =========================================================
          ENTERPRISE PAGE HEADER (Honeywell Forge Style)
      ========================================================== */}


      {/* =========================================================
          MAIN 2-COLUMN LAYOUT
      ========================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 px-6 mt-6">

        {/* ── LEFT PROFILE & CLEARANCE CARD ── */}
        <div className="lg:col-span-4 xl:col-span-3">
          <div className="bg-[#15161b] border border-[#202228] rounded-xl p-5 shadow-lg flex flex-col items-center text-center">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-[#0080c8] to-[#00a4e4] p-0.5 shadow-lg shadow-sky-950/40 flex items-center justify-center mb-3.5">
              <div className="w-full h-full rounded-[10px] bg-[#11131a] flex items-center justify-center text-2xl font-bold text-white">
                {initials}
              </div>
            </div>

            {/* Name & Role */}
            <h2 className="text-base font-bold text-white tracking-tight">{fullName}</h2>
            <p className="text-xs text-slate-400 mt-0.5 font-normal truncate max-w-full">
              {email}
            </p>


            {/* Status & Scope metadata */}
            <div className="w-full mt-6 pt-4 border-t border-[#202228] space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-normal">Department</span>
                <span className="font-medium text-slate-200 truncate max-w-[130px]">{department}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-normal">Security Level</span>
                <span className="font-medium text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Level 5 (Full Control)</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-normal">Client Accounts</span>
                <span className="font-medium text-[#00a4e4]">
                  {clientAccounts.length} Registered
                </span>
              </div>
            </div>

            {/* Action Button: Sign Out */}
            <div className="w-full mt-6 pt-3 border-t border-[#202228]">
              <button
                type="button"
                onClick={() => logout()}
                className="w-full py-2 px-3 rounded-lg text-xs font-medium text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out of Gateway</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT MAIN SETTINGS & MANAGEMENT CARD ── */}
        <div className="lg:col-span-8 xl:col-span-9">
          <div className="bg-[#15161b] border border-[#202228] rounded-xl shadow-lg p-6">

            {/* Tab Strip */}
            <div className="flex items-center gap-6 border-b border-[#202228] pb-3 mb-6 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('account')}
                className={`text-xs font-semibold pb-3 -mb-3 transition-colors cursor-pointer relative whitespace-nowrap flex items-center gap-2 ${activeTab === 'account'
                  ? 'text-white border-b-2 border-[#00a4e4]'
                  : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Administrator Credentials</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('clients')}
                className={`text-xs font-semibold pb-3 -mb-3 transition-colors cursor-pointer relative whitespace-nowrap flex items-center gap-2 ${activeTab === 'clients'
                  ? 'text-white border-b-2 border-[#00a4e4]'
                  : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Client & Tenant Directory</span>
                {clientAccounts.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-medium bg-[#00a4e4]/15 text-[#00a4e4] border border-[#00a4e4]/30">
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
                    <span>Database Sync Notice</span>
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
                        className="w-full bg-[#0e0f13] border border-[#232632] focus:border-[#00a4e4] text-white text-xs rounded-lg px-3.5 py-2.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30 transition-colors"
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
                        className="w-full bg-[#0e0f13] border border-[#232632] focus:border-[#00a4e4] text-white text-xs rounded-lg px-3.5 py-2.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30 transition-colors"
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
                        className="w-full bg-[#0e0f13] border border-[#232632] focus:border-[#00a4e4] text-white text-xs rounded-lg px-3.5 py-2.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Administrator Email Address
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@intersys.com"
                        className="w-full bg-[#0e0f13] border border-[#232632] focus:border-[#00a4e4] text-white text-xs rounded-lg px-3.5 py-2.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30 transition-colors"
                        required
                      />
                    </div>
                  </div>

                  {/* Row 3: Department & Username */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Department / Facility
                      </label>
                      <input
                        type="text"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder="BMS Operations"
                        className="w-full bg-[#0e0f13] border border-[#232632] focus:border-[#00a4e4] text-white text-xs rounded-lg px-3.5 py-2.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Login Username
                      </label>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="admin"
                        className="w-full bg-[#0e0f13] border border-[#232632] focus:border-[#00a4e4] text-white text-xs rounded-lg px-3.5 py-2.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Row 4: Administrator Password (View-Only) */}
                  <div className="pt-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium text-slate-300">
                        Administrator Password
                      </label>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        <span>Read-Only • System Managed</span>
                      </div>
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={adminPassword || import.meta.env.VITE_ADMIN_PASSWORD || 'admin12345.intersys'}
                        readOnly
                        autoComplete="off"
                        aria-label="Administrator Password"
                        className="w-full bg-[#0e0f13] border border-[#232632] text-slate-200 text-xs rounded-lg pl-3.5 pr-28 py-2.5 cursor-default select-all focus:outline-none focus:border-[#00a4e4]/40"
                      />
                      <div className="absolute right-2 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-[#1a1c24] transition cursor-pointer"
                          title={showPassword ? 'Hide password' : 'View password'}
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5 text-slate-300" /> : <Eye className="w-3.5 h-3.5 text-[#00a4e4]" />}
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyAdminPassword}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                            copiedAdminPass
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-[#1a1c24] text-slate-300 hover:text-white hover:bg-[#252833] border border-[#2b2e3b]'
                          }`}
                          title="Copy password to clipboard"
                        >
                          {copiedAdminPass ? (
                            <>
                              <CheckCheck className="w-3 h-3 text-emerald-400" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-500">
                      The administrator password cannot be changed from the dashboard. You can reveal or copy the active password here.
                    </p>
                  </div>
                </div>

                {/* Bottom Action Row */}
                <div className="pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-[#202228]">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2.5 rounded-lg text-xs font-semibold text-white bg-[#00a4e4] hover:bg-[#0092cc] active:bg-[#0081b5] transition cursor-pointer disabled:opacity-50 shadow-md shadow-[#00a4e4]/15 flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isSaving ? 'Updating...' : 'Save Administrator Settings'}</span>
                  </button>

                  <div className="flex items-center gap-3">
                    {hasCustomCreds && (
                      <button
                        type="button"
                        onClick={handleResetDefaults}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-[#1a1c24] hover:bg-[#252833] border border-[#232632] transition cursor-pointer"
                        title="Revert back to .env values"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-[#00a4e4]" />
                        <span>Revert to .env Defaults</span>
                      </button>
                    )}
                  </div>
                </div>
              </form>
            )}

            {/* =========================================================
                TAB 2: ADD CLIENT ACCOUNT & DIRECTORY
            ========================================================== */}
            {activeTab === 'clients' && (
              <div className="space-y-7">
                {/* 1. Add Client Form */}
                <div className="bg-[#0e0f13] border border-[#202228] rounded-xl p-5">
                  <div className="flex items-center gap-2.5 pb-3 mb-4 border-b border-[#202228]">

                    <div>
                      <h3 className="text-sm font-semibold text-white">Create New Client Account</h3>

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
                          className="w-full bg-[#15161b] border border-[#232632] focus:border-[#00a4e4] text-white text-xs rounded-lg px-3.5 py-2.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30 transition-colors"
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
                          className="w-full bg-[#15161b] border border-[#232632] focus:border-[#00a4e4] text-white text-xs rounded-lg px-3.5 py-2.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30 transition-colors"
                          required
                        />
                      </div>

                      {/* Username */}
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
                          Login Username <span className="text-slate-500 font-normal">(optional)</span>
                        </label>
                        <input
                          type="text"
                          value={clientUsername}
                          onChange={(e) => setClientUsername(e.target.value)}
                          placeholder="e.g. koi_client"
                          className="w-full bg-[#15161b] border border-[#232632] focus:border-[#00a4e4] text-white text-xs rounded-lg px-3.5 py-2.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30 transition-colors"
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
                            autoComplete="new-password"
                            className="w-full bg-[#15161b] border border-[#232632] focus:border-[#00a4e4] text-white text-xs rounded-lg pl-3.5 pr-10 py-2.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30 transition-colors"
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
                          className="w-full bg-[#15161b] border border-[#232632] focus:border-[#00a4e4] text-white text-xs rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30 transition-colors cursor-pointer font-sans"
                        >
                          <option value="client">Client (Full Dashboard Access)</option>
                          <option value="tenant">Tenant (Utility Billing & Meters)</option>
                          <option value="viewer">Viewer (Read-Only Telemetry)</option>
                        </select>
                      </div>

                      {/* Access Scope / Tenant */}
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
                          Assigned Facility Scope
                        </label>
                        <input
                          type="text"
                          value={clientTenant}
                          onChange={(e) => setClientTenant(e.target.value)}
                          placeholder="e.g. KOI Facility, or All Tenants"
                          className="w-full bg-[#15161b] border border-[#232632] focus:border-[#00a4e4] text-white text-xs rounded-lg px-3.5 py-2.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30 transition-colors"
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
                        <span>{isCreatingClient ? 'Provisioning...' : 'Provision Client Account'}</span>
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
                        Authorized Accounts ({clientAccounts.length})
                      </h3>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Credentials authenticate at login page
                    </span>
                  </div>

                  {clientAccounts.length === 0 ? (
                    <div className="p-8 rounded-xl bg-[#0e0f13] border border-[#202228] text-center space-y-2">
                      <Users className="w-8 h-8 text-slate-600 mx-auto" />
                      <p className="text-xs font-medium text-slate-300">No client accounts created yet</p>
                      <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                        Use the form above to provision a client account with their login email and password.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-[#202228] bg-[#0e0f13]">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-[#202228] text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-[#12141a]">
                            <th className="py-2.5 px-3.5">Client Identity</th>
                            <th className="py-2.5 px-3.5">Login ID</th>
                            <th className="py-2.5 px-3.5">Role</th>
                            <th className="py-2.5 px-3.5">Assigned Facility</th>
                            <th className="py-2.5 px-3.5">Status</th>
                            <th className="py-2.5 px-3.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#202228]">
                          {clientAccounts.map((client) => {
                            const isCopied = copiedClientId === client.id;
                            return (
                              <tr key={client.id} className="hover:bg-[#15161b] transition-colors">
                                <td className="py-3 px-3.5">
                                  <div className="font-semibold text-white">{client.name}</div>
                                  <div className="text-[11px] text-slate-400">{client.email}</div>
                                </td>

                                <td className="py-3 px-3.5 text-slate-300 font-medium">
                                  {client.username || client.email.split('@')[0]}
                                </td>

                                <td className="py-3 px-3.5">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase border ${client.role === 'tenant'
                                    ? 'bg-purple-500/10 border-purple-500/25 text-purple-400'
                                    : client.role === 'viewer'
                                      ? 'bg-slate-500/10 border-slate-500/25 text-slate-400'
                                      : 'bg-[#00a4e4]/10 border-[#00a4e4]/25 text-[#00a4e4]'
                                    }`}>
                                    {client.role}
                                  </span>
                                </td>

                                <td className="py-3 px-3.5 text-slate-300 text-xs">
                                  {client.assignedTenant || 'All Tenants'}
                                </td>

                                <td className="py-3 px-3.5">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleClientStatus(client)}
                                    className={`px-2 py-0.5 rounded text-[10px] font-medium border transition cursor-pointer flex items-center gap-1.5 ${client.status === 'ACTIVE'
                                      ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20'
                                      : 'bg-red-500/10 border-red-500/25 text-red-400 hover:bg-red-500/20'
                                      }`}
                                    title="Click to toggle status"
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full ${client.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                    <span>{client.status}</span>
                                  </button>
                                </td>

                                <td className="py-3 px-3.5 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleCopyClientCredentials(client)}
                                      className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium text-slate-300 hover:text-white bg-[#1a1c23] hover:bg-[#252833] border border-[#202228] transition cursor-pointer"
                                      title="Copy login credentials to clipboard"
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
