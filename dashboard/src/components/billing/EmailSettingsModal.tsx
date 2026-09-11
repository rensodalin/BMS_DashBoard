import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Key,
  CheckCircle2,
  AlertTriangle,
  Send,
  Eye,
  EyeOff,
  ExternalLink,
  ShieldCheck,
  Loader2,
  Info,
} from 'lucide-react';
import {
  getGmailSmtpConfig,
  saveGmailSmtpConfig,
  sendTestEmail,
  type GmailSmtpConfig,
} from '../../lib/emailService';

interface EmailSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: (config: GmailSmtpConfig) => void;
}

export const EmailSettingsModal: React.FC<EmailSettingsModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
}) => {
  const [email, setEmail] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [senderName, setSenderName] = useState('Intersys BMS Operations');
  const [showPassword, setShowPassword] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const cfg = getGmailSmtpConfig();
      setEmail(cfg.email || '');
      setAppPassword(cfg.appPassword || '');
      setSenderName(cfg.senderName || 'Intersys BMS Operations');
      setTestEmailAddress(cfg.email || '');
      setTestResult(null);
      setSaveSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!email.trim() || !appPassword.trim()) {
      alert('Please enter both your Gmail address and the 16-character Google App Password.');
      return;
    }

    const config: GmailSmtpConfig = {
      email: email.trim(),
      appPassword: appPassword.replace(/\s+/g, ''),
      senderName: senderName.trim() || 'Intersys BMS Operations',
    };

    saveGmailSmtpConfig(config);
    setSaveSuccess(true);
    if (onConfigSaved) onConfigSaved(config);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 1200);
  };

  const handleTest = async () => {
    const target = (testEmailAddress || email).trim();
    if (!target) {
      alert('Please enter an email address to send the test message to.');
      return;
    }
    if (!email.trim() || !appPassword.trim()) {
      alert('Please enter your Gmail address and Google App Password before testing.');
      return;
    }

    // Temporarily save to test with current input values
    saveGmailSmtpConfig({
      email: email.trim(),
      appPassword: appPassword.replace(/\s+/g, ''),
      senderName: senderName.trim(),
    });

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await sendTestEmail(target);
      if (res.success) {
        setTestResult({
          type: 'success',
          message: `Test email sent successfully to ${target}! Check your inbox.`,
        });
      } else {
        setTestResult({
          type: 'error',
          message: res.error || 'Failed to send test email. Please verify your Gmail address and App Password.',
        });
      }
    } catch (err: any) {
      setTestResult({
        type: 'error',
        message: err.message || 'Network error occurred while communicating with email service.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-xs select-none overflow-y-auto">
      <div className="w-full max-w-lg bg-[#15161b] border border-[#202228] rounded-xl shadow-2xl shadow-black flex flex-col max-h-[92vh] overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#202228] bg-[#121317]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-[#ea4335]/10 border border-[#ea4335]/25 text-[#ea4335]">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Gmail SMTP Dispatch Settings</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00a4e4]/15 text-[#38bdf8] border border-[#00a4e4]/30">
                  Direct Delivery
                </span>
              </h3>
              <p className="text-[11px] text-[#8b929e]">
                Send invoices and PDF statements automatically in the background from your Gmail.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-[#8b929e] hover:text-white hover:bg-[#202228] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto text-xs text-slate-300">
          {/* Instructions Box */}
          <div className="p-3.5 rounded-lg bg-[#101115] border border-[#202228] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white flex items-center gap-1.5 text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                How to Get Your Gmail App Password (1 Minute)
              </span>
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-[#38bdf8] hover:underline flex items-center gap-1 font-medium"
              >
                <span>Google Security</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-400 leading-relaxed">
              <li>Enable <strong className="text-slate-200">2-Step Verification</strong> on your Google Account.</li>
              <li>Open <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-[#38bdf8] underline">myaccount.google.com/apppasswords</a>.</li>
              <li>Type app name <span className="font-mono text-white bg-[#1a1c22] px-1 rounded">BMS Billing</span> and click <strong className="text-slate-200">Create</strong>.</li>
              <li>Copy the 16-letter password (e.g. <span className="font-mono text-emerald-300">abcd efgh ijkl mnop</span>) and paste below.</li>
            </ol>
          </div>

          {/* Form Fields */}
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Your Gmail Address
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (!testEmailAddress) setTestEmailAddress(e.target.value);
                  }}
                  placeholder="e.g. operations@intersys-bms.com or yourname@gmail.com"
                  className="w-full bg-[#101115] border border-[#202228] focus:border-[#00a4e4] rounded-lg pl-9 pr-3 py-2 text-white text-xs placeholder:text-slate-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                16-Character Google App Password
              </label>
              <div className="relative">
                <Key className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={appPassword}
                  onChange={(e) => setAppPassword(e.target.value)}
                  placeholder="e.g. abcd efgh ijkl mnop"
                  className="w-full bg-[#101115] border border-[#202228] focus:border-[#00a4e4] rounded-lg pl-9 pr-10 py-2 text-white font-mono text-xs placeholder:text-slate-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300 transition cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Sender Display Name
              </label>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Intersys BMS Operations"
                className="w-full bg-[#101115] border border-[#202228] focus:border-[#00a4e4] rounded-lg px-3 py-2 text-white text-xs placeholder:text-slate-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Test Dispatch Box */}
          <div className="p-3.5 rounded-lg bg-[#101115] border border-[#202228] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-300">
                Test Connection Before Saving
              </span>
              <span className="text-[10px] text-slate-500 font-mono">1-Click Test</span>
            </div>

            <div className="flex gap-2">
              <input
                type="email"
                value={testEmailAddress}
                onChange={(e) => setTestEmailAddress(e.target.value)}
                placeholder="Recipient test email address"
                className="flex-1 bg-[#15161b] border border-[#202228] focus:border-[#00a4e4] rounded pl-3 pr-3 py-1.5 text-white text-xs placeholder:text-slate-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleTest}
                disabled={isTesting || !email || !appPassword}
                className="flex items-center gap-1 px-3 py-1.5 bg-[#202228] hover:bg-[#2b2e36] text-[#38bdf8] hover:text-white font-medium rounded text-xs transition cursor-pointer disabled:opacity-50 border border-[#2d3039]"
              >
                {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>{isTesting ? 'Testing...' : 'Send Test'}</span>
              </button>
            </div>

            {testResult && (
              <div
                className={`p-2.5 rounded text-[11px] flex items-start gap-2 border ${
                  testResult.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                {testResult.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <span className="leading-snug">{testResult.message}</span>
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 text-[11px] text-slate-400">
            <Info className="w-3.5 h-3.5 text-[#38bdf8] shrink-0 mt-0.5" />
            <span>
              Credentials are kept securely in your browser and used strictly to dispatch utility invoices with PDF attachments via official Google SMTP.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-[#202228] bg-[#121317] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white rounded transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-[#005a87] to-[#00a4e4] hover:from-[#004870] hover:to-[#0093ce] text-white font-semibold rounded text-xs transition cursor-pointer shadow-md"
          >
            {saveSuccess ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            <span>{saveSuccess ? 'Settings Saved!' : 'Save Credentials'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
