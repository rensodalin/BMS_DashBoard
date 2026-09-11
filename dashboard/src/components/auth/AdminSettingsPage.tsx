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
  Building2,
} from 'lucide-react';
import { INTERSYS_LOGO_BASE64 } from '../../assets/logoBase64';
import { useAuth, type ClientAccount } from '../../context/AuthContext';
import { fetchSensorPoints } from '../../lib/supabase';
import type { SensorPoint } from '../../types/bms';

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

  // Live points list to compute point counts per client facility
  const [allPoints, setAllPoints] = useState<SensorPoint[]>([]);

  useEffect(() => {
    fetchSensorPoints().then((pts) => {
      if (pts) setAllPoints(pts);
    });
  }, []);

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
          MAIN 2-COLUMN LAYOUT
      ========================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 px-6 mt-6">

        {/* ── LEFT PROFILE & CLEARANCE CARD ── */}
        <div className="lg:col-span-4 xl:col-span-3">
          <div className="bg-white border border-slate-100 rounded-md p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col items-center text-center">
            {/* Intersys Company Logo */}
            <div className="flex items-center justify-center mb-5 pb-4 border-b border-slate-100 w-full">
              <img
                src={INTERSYS_LOGO_BASE64 || '/intersys_logo.png'}
                alt="Intersys Solutions"
                className="h-9 w-auto max-w-[160px] object-contain"
              />
            </div>

            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#001428] to-[#001F3F] p-0.5 shadow-md shadow-[#001F3F]/20 flex items-center justify-center mb-4">
              <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-2xl font-bold text-[#001F3F]">
                {initials}
              </div>
            </div>

            {/* Name & Role */}
            <h2 className="text-base font-bold text-slate-800">{fullName}</h2>
            <p className="text-xs text-slate-500 mt-0.5 font-medium truncate max-w-full">
              {email}
            </p>

            {/* Status & Scope metadata */}
            <div className="w-full mt-6 pt-4 border-t border-slate-100 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Department</span>
                <span className="font-semibold text-slate-700 truncate max-w-[140px]">{department}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Security Level</span>
                <span className="font-bold text-[#001F3F] bg-[#e6edf5] px-2.5 py-0.5 rounded-lg text-[11px] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#001F3F]" />
                  <span>Level 5 (Full)</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Client Accounts</span>
                <span className="font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-lg text-[11px]">
                  {clientAccounts.length} Registered
                </span>
              </div>
            </div>

            {/* Action Button: Sign Out */}
            <div className="w-full mt-6 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => logout()}
                className="w-full py-2.5 px-4 rounded-md text-xs font-bold text-[#FF3523] hover:text-white bg-[#fef2f2] hover:bg-[#FF3523] transition cursor-pointer flex items-center justify-center gap-2 shadow-2xs"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out of Gateway</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT MAIN SETTINGS & MANAGEMENT CARD ── */}
        <div className="lg:col-span-8 xl:col-span-9">
          <div className="bg-white border border-slate-100 rounded-md shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-6">

            {/* Tab Strip: Modern Rounded-xl Tabs */}
            <div className="flex items-center gap-2 pb-5 border-b border-slate-100 mb-6 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('account')}
                className={`text-xs font-bold px-4 py-2 rounded-md transition cursor-pointer flex items-center gap-2 ${activeTab === 'account'
                  ? 'bg-[#001F3F] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Administrator Credentials</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('clients')}
                className={`text-xs font-bold px-4 py-2 rounded-md transition cursor-pointer flex items-center gap-2 ${activeTab === 'clients'
                  ? 'bg-[#001F3F] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Client & Tenant Directory</span>
                {clientAccounts.length > 0 && (
                  <span className={`ml-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                    activeTab === 'clients' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {clientAccounts.length}
                  </span>
                )}
              </button>
            </div>

            {/* Alert notices */}
            {errorMsg && (
              <div className="mb-5 p-3.5 rounded-md bg-[#fef2f2] border border-[#FF3523]/20 flex items-start gap-2.5 text-xs text-[#FF3523]">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="font-medium">{errorMsg}</span>
              </div>
            )}

            {warningMsg && (
              <div className="mb-5 p-3.5 rounded-md bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-800">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <div className="space-y-1">
                  <div className="font-bold text-amber-900 flex items-center gap-1.5">
                    <span>Database Sync Notice</span>
                  </div>
                  <div>{warningMsg}</div>
                </div>
              </div>
            )}

            {successMsg && (
              <div className="mb-5 p-3.5 rounded-md bg-[#e6edf5] border border-[#001F3F]/25 flex items-center gap-2 text-xs text-[#001F3F]">
                <Check className="w-4 h-4 shrink-0" />
                <span className="font-bold">{successMsg}</span>
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
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        First Name
                      </label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="First name"
                        className="w-full bg-slate-50 border border-slate-200 focus:border-[#001F3F] text-slate-800 text-xs rounded-md px-3.5 py-2.5 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#001F3F]/20 focus:bg-white transition"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Last name"
                        className="w-full bg-slate-50 border border-slate-200 focus:border-[#001F3F] text-slate-800 text-xs rounded-md px-3.5 py-2.5 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#001F3F]/20 focus:bg-white transition"
                        required
                      />
                    </div>
                  </div>

                  {/* Row 2: Phone Number & Email Address */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Phone Number
                      </label>
                      <input
                        type="text"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+855 12 345 678"
                        className="w-full bg-slate-50 border border-slate-200 focus:border-[#001F3F] text-slate-800 text-xs rounded-md px-3.5 py-2.5 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#001F3F]/20 focus:bg-white transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Administrator Email Address
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@intersys.com"
                        className="w-full bg-slate-50 border border-slate-200 focus:border-[#001F3F] text-slate-800 text-xs rounded-md px-3.5 py-2.5 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#001F3F]/20 focus:bg-white transition"
                        required
                      />
                    </div>
                  </div>

                  {/* Row 3: Department & Username */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Department / Facility
                      </label>
                      <input
                        type="text"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder="BMS Operations"
                        className="w-full bg-slate-50 border border-slate-200 focus:border-[#001F3F] text-slate-800 text-xs rounded-md px-3.5 py-2.5 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#001F3F]/20 focus:bg-white transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Login Username
                      </label>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="admin"
                        className="w-full bg-slate-50 border border-slate-200 focus:border-[#001F3F] text-slate-800 text-xs rounded-md px-3.5 py-2.5 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#001F3F]/20 focus:bg-white transition"
                      />
                    </div>
                  </div>

                  {/* Row 4: Administrator Password (View-Only) */}
                  <div className="pt-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-700">
                        Administrator Password
                      </label>
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#001F3F]">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#001F3F]"></span>
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
                        className="w-full bg-slate-50 border border-slate-200 font-mono text-slate-700 text-xs rounded-md pl-3.5 pr-28 py-2.5 cursor-default select-all focus:outline-none focus:border-[#001F3F]"
                      />
                      <div className="absolute right-2 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                          title={showPassword ? 'Hide password' : 'View password'}
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5 text-slate-600" /> : <Eye className="w-3.5 h-3.5 text-[#001F3F]" />}
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyAdminPassword}
                          className={`flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                            copiedAdminPass
                              ? 'bg-[#e6edf5] text-[#001F3F]'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          }`}
                          title="Copy password to clipboard"
                        >
                          {copiedAdminPass ? (
                            <>
                              <CheckCheck className="w-3 h-3 text-[#001F3F]" />
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
                    <p className="mt-1.5 text-[11px] text-slate-400">
                      The administrator password cannot be changed from the dashboard. You can reveal or copy the active password here.
                    </p>
                  </div>
                </div>

                {/* Bottom Action Row */}
                <div className="pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2.5 rounded-md text-xs font-bold text-white bg-[#001F3F] hover:bg-[#001428] active:bg-[#001020] transition cursor-pointer disabled:opacity-50 shadow-xs flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isSaving ? 'Updating...' : 'Save Administrator Settings'}</span>
                  </button>

                  <div className="flex items-center gap-3">
                    {hasCustomCreds && (
                      <button
                        type="button"
                        onClick={handleResetDefaults}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                        title="Revert back to .env values"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-[#001F3F]" />
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
                <div className="bg-slate-50/70 border border-slate-100 rounded-md p-5">
                  <div className="flex items-center gap-2.5 pb-3 mb-4 border-b border-slate-200/60">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Create New Client Account</h3>
                    </div>
                  </div>

                  <form onSubmit={handleCreateClient} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Name */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          Client Full Name / Company
                        </label>
                        <input
                          type="text"
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value)}
                          placeholder="e.g. KOI Facility Manager"
                          className="w-full bg-white border border-slate-200 focus:border-[#001F3F] text-slate-800 text-xs rounded-md px-3.5 py-2.5 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#001F3F]/20 shadow-2xs transition"
                          required
                        />
                      </div>

                      {/* Email */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          Client Login Email
                        </label>
                        <input
                          type="email"
                          value={clientEmail}
                          onChange={(e) => setClientEmail(e.target.value)}
                          placeholder="e.g. client@koi.com"
                          className="w-full bg-white border border-slate-200 focus:border-[#001F3F] text-slate-800 text-xs rounded-md px-3.5 py-2.5 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#001F3F]/20 shadow-2xs transition"
                          required
                        />
                      </div>

                      {/* Username */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          Login Username <span className="text-slate-400 font-normal">(optional)</span>
                        </label>
                        <input
                          type="text"
                          value={clientUsername}
                          onChange={(e) => setClientUsername(e.target.value)}
                          placeholder="e.g. koi_client"
                          className="w-full bg-white border border-slate-200 focus:border-[#001F3F] text-slate-800 text-xs rounded-md px-3.5 py-2.5 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#001F3F]/20 shadow-2xs transition"
                        />
                      </div>

                      {/* Password */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          Client Password
                        </label>
                        <div className="relative">
                          <input
                            type={clientShowPass ? 'text' : 'password'}
                            value={clientPassword}
                            onChange={(e) => setClientPassword(e.target.value)}
                            placeholder="Enter login password"
                            autoComplete="new-password"
                            className="w-full bg-white border border-slate-200 focus:border-[#001F3F] text-slate-800 text-xs rounded-md pl-3.5 pr-10 py-2.5 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#001F3F]/20 shadow-2xs transition"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setClientShowPass(!clientShowPass)}
                            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                            tabIndex={-1}
                          >
                            {clientShowPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Assigned Role */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          Assigned Role
                        </label>
                        <select
                          value={clientRole}
                          onChange={(e) => setClientRole(e.target.value as any)}
                          className="w-full bg-white border border-slate-200 focus:border-[#001F3F] text-slate-800 text-xs rounded-md px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#001F3F]/20 shadow-2xs transition cursor-pointer font-sans"
                        >
                          <option value="client">Client (Full Dashboard Access)</option>
                          <option value="tenant">Tenant (Utility Billing & Meters)</option>
                          <option value="viewer">Viewer (Read-Only Telemetry)</option>
                        </select>
                      </div>

                      {/* Access Scope / Tenant */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                          <span>Assigned Facility / Building</span>
                          <span className="text-[10px] text-[#001F3F] font-semibold">Isolated point scope</span>
                        </label>
                        <input
                          type="text"
                          value={clientTenant}
                          onChange={(e) => setClientTenant(e.target.value)}
                          placeholder="e.g. nita facility, KOI Facility, BINGO Facility"
                          className="w-full bg-white border border-slate-200 focus:border-[#001F3F] text-slate-800 text-xs rounded-md px-3.5 py-2.5 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#001F3F]/20 shadow-2xs transition"
                        />
                        <p className="text-[11px] text-slate-400 mt-1">
                          When this client logs in, they will only see points assigned to this facility. If this building has no points yet, they will see 0 points.
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-end">
                      <button
                        type="submit"
                        disabled={isCreatingClient}
                        className="px-5 py-2.5 rounded-md text-xs font-bold text-white bg-[#001F3F] hover:bg-[#001428] active:bg-[#001020] transition cursor-pointer disabled:opacity-50 shadow-xs flex items-center gap-2"
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
                      <Users className="w-4 h-4 text-[#001F3F]" />
                      <h3 className="text-xs font-bold text-slate-800">
                        Authorized Accounts ({clientAccounts.length})
                      </h3>
                    </div>
                    <span className="text-xs text-slate-400 font-medium">
                      Credentials authenticate at login page
                    </span>
                  </div>

                  {clientAccounts.length === 0 ? (
                    <div className="p-8 rounded-md bg-slate-50 border border-slate-100 text-center space-y-2">
                      <Users className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="text-xs font-bold text-slate-700">No client accounts created yet</p>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        Use the form above to provision a client account with their login email and password.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-md border border-slate-100 bg-white">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500 bg-slate-50/60">
                            <th className="py-3 px-4">Client Identity</th>
                            <th className="py-3 px-4">Login ID</th>
                            <th className="py-3 px-4">Role</th>
                            <th className="py-3 px-4">Assigned Facility</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {clientAccounts.map((client) => {
                            const isCopied = copiedClientId === client.id;
                            return (
                              <tr key={client.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="py-3 px-4">
                                  <div className="font-bold text-slate-800">{client.name}</div>
                                  <div className="text-[11px] text-slate-400 font-medium">{client.email}</div>
                                </td>

                                <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                                  {client.username || client.email.split('@')[0]}
                                </td>

                                <td className="py-3 px-4">
                                  <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${client.role === 'tenant'
                                    ? 'bg-purple-50 text-purple-600'
                                    : client.role === 'viewer'
                                      ? 'bg-slate-100 text-slate-600'
                                      : 'bg-[#e6edf5] text-[#001F3F]'
                                    }`}>
                                    {client.role === 'tenant' ? 'Tenant' : client.role === 'viewer' ? 'Viewer' : 'Client'}
                                  </span>
                                </td>

                                <td className="py-3 px-4 text-slate-600 text-xs">
                                  {(() => {
                                    const tenant = (client.assignedTenant || '').trim();
                                    const tenantLower = tenant.toLowerCase();
                                    const keyword = tenantLower.replace(/(facility|building|hq|center|campus|tower)/gi, '').trim();

                                    const pointCount = allPoints.filter((pt) => {
                                      if (client.assignedPoints?.includes(pt.point_name)) return true;
                                      if (!tenantLower || tenantLower === 'all tenants') return true;
                                      const bName = (pt.building_name || '').toLowerCase().trim();
                                      const devName = (pt.device_name || '').toLowerCase().trim();
                                      const ptName = pt.point_name.toLowerCase().trim();
                                      return (
                                        bName === tenantLower ||
                                        devName === tenantLower ||
                                        (keyword.length >= 3 && ptName.includes(keyword))
                                      );
                                    }).length;

                                    return (
                                      <div className="flex flex-col gap-0.5">
                                        <span className="font-semibold text-slate-700 flex items-center gap-1">
                                          <Building2 className="w-3 h-3 text-[#001F3F]" />
                                          <span>{tenant || 'All Tenants'}</span>
                                        </span>
                                        <span className={`text-[10px] font-mono font-medium ${pointCount > 0 ? 'text-[#001F3F]' : 'text-amber-600'}`}>
                                          {pointCount > 0 ? `${pointCount} Points Monitored` : '0 Points (No points assigned)'}
                                        </span>
                                      </div>
                                    );
                                  })()}
                                </td>

                                <td className="py-3 px-4">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleClientStatus(client)}
                                    className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center gap-1.5 ${client.status === 'ACTIVE'
                                      ? 'bg-[#e6edf5] text-[#001F3F] hover:bg-[#d8e4f0]'
                                      : 'bg-[#fef2f2] text-[#FF3523] hover:bg-[#fee2e2]'
                                      }`}
                                    title="Click to toggle status"
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full ${client.status === 'ACTIVE' ? 'bg-[#001F3F]' : 'bg-[#FF3523]'}`} />
                                    <span>{client.status}</span>
                                  </button>
                                </td>

                                <td className="py-3 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleCopyClientCredentials(client)}
                                      className="flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                                      title="Copy login credentials to clipboard"
                                    >
                                      {isCopied ? <CheckCheck className="w-3 h-3 text-[#001F3F]" /> : <Copy className="w-3 h-3 text-[#001F3F]" />}
                                      <span>{isCopied ? 'Copied' : 'Credentials'}</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleDeleteClient(client)}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-[#FF3523] hover:bg-[#fef2f2] transition cursor-pointer"
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
