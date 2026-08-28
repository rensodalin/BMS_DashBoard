import React, { useState } from 'react';
import { X, Plus, HardDrive, ShieldAlert, Check, Link } from 'lucide-react';
import { addOrUpdateSensorPoint } from '../lib/supabase';

interface AddPointModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddPointModal: React.FC<AddPointModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [obixUrl, setObixUrl] = useState('');
  const [pointName, setPointName] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [currentValue, setCurrentValue] = useState('25.0');
  const [alertThreshold, setAlertThreshold] = useState('30.0');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  // Auto-parse Niagara oBIX URL when typed or pasted
  const handleObixUrlChange = (rawUrl: string) => {
    setObixUrl(rawUrl);
    if (!rawUrl.trim()) return;

    try {
      // Clean trailing slashes
      const cleanUrl = rawUrl.trim().replace(/\/+$/, "");
      const parts = cleanUrl.split("/");

      const driversIndex = parts.findIndex(
        (p) => p.toLowerCase() === "drivers"
      );

      if (driversIndex !== -1 && driversIndex < parts.length - 1) {
        const device = parts[driversIndex + 1];
        setDeviceName(device);

        if (driversIndex + 2 < parts.length) {
          const pt = parts[driversIndex + 2];
          setPointName(pt);
        } else {
          // If only driver folder was provided (e.g. /Drivers/Pump)
          setPointName(`${device}_Temp`);
        }
      } else {
        const lastPart = parts[parts.length - 1];
        if (lastPart && !lastPart.startsWith("http")) {
          setPointName(lastPart);
        }
      }
    } catch (e) {
      // Ignore parsing errors
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!pointName.trim()) {
      setErrorMsg('Please enter a valid point name (e.g. Room1_Temp, Pump1).');
      return;
    }

    const val = parseFloat(currentValue);
    const threshold = parseFloat(alertThreshold);

    if (isNaN(val) || isNaN(threshold)) {
      setErrorMsg('Value and threshold must be numeric numbers.');
      return;
    }

    setIsSubmitting(true);
    const isAlarm = val >= threshold;

    const ok = await addOrUpdateSensorPoint({
      point_name: pointName.trim(),
      device_name: deviceName.trim() || 'Pump',
      obix_url: obixUrl.trim() || undefined,
      current_value: val,
      alert_threshold: threshold,
      is_alarm: isAlarm,
    });

    setIsSubmitting(false);

    if (ok) {
      setObixUrl('');
      setPointName('');
      onSuccess();
      onClose();
    } else {
      setErrorMsg('Failed to save sensor point to Supabase. Check console/RLS permissions.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
      <div className="bms-panel w-full max-w-lg rounded-2xl border border-[#23314a] p-6 relative">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1f293d] mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Add Sensor Point / oBIX URL</h3>
              <p className="text-xs text-slate-400">Paste Niagara oBIX endpoint URL or add manually</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 mb-4 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          
          {/* oBIX Target URL Input Box */}
          <div className="p-3.5 rounded-xl bg-[#0d131f] border border-blue-500/30">
            <label className="block text-xs font-semibold text-blue-400 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Link className="w-3.5 h-3.5" /> Niagara oBIX Endpoint URL
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Auto-extracts fields</span>
            </label>
            <input
              type="url"
              value={obixUrl}
              onChange={(e) => handleObixUrlChange(e.target.value)}
              placeholder="e.g. https://192.168.1.100/obix/config/Drivers/Pump/ or Room1_Temp"
              className="w-full px-3 py-2 rounded-lg bms-input text-xs font-mono text-cyan-300 border-blue-500/40"
            />
            <p className="text-[11px] text-slate-400 mt-1.5">
              Paste your Niagara oBIX URL to automatically extract Device Name & Point Name.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Controller / Device Name
            </label>
            <div className="relative">
              <HardDrive className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="e.g. Pump, ServerRoom, AHU1"
                className="w-full pl-9 pr-3 py-2 rounded-lg bms-input text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Sensor Point Name (Unique Key)
            </label>
            <input
              type="text"
              value={pointName}
              onChange={(e) => setPointName(e.target.value)}
              placeholder="e.g. Room1_Temp, Pump1, Smoke_Detector"
              className="w-full px-3 py-2 rounded-lg bms-input text-sm font-mono"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Initial Value
              </label>
              <input
                type="number"
                step="0.1"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bms-input text-sm font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Alert Threshold (&deg;C)
              </label>
              <input
                type="number"
                step="0.1"
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bms-input text-sm font-mono"
                required
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1f293d] mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" /> Save Sensor Point
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
