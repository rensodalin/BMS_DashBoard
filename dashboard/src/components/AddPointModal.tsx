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

  const handleObixUrlChange = (rawUrl: string) => {
    setObixUrl(rawUrl);
    if (!rawUrl.trim()) return;

    try {
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
          setPointName(`${device}_Temp`);
        }
      } else {
        const lastPart = parts[parts.length - 1];
        if (lastPart && !lastPart.startsWith("http")) {
          setPointName(lastPart);
        }
      }
    } catch (e) {
      // Ignore
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
      setErrorMsg('Value and threshold must be numeric.');
      return;
    }

    setIsSubmitting(true);
    const isAlarm = val >= threshold;

    const ok = await addOrUpdateSensorPoint({
      point_name: pointName.trim(),
      device_name: deviceName.trim() || 'Niagara Controller',
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
      setErrorMsg('Failed to save sensor point to Supabase. Check network/permissions.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs select-none">
      <div
        className="w-full max-w-lg rounded p-5 relative"
        style={{ backgroundColor: '#202227', border: '1px solid #2d3038' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-4" style={{ borderBottom: '1px solid #282a32' }}>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded" style={{ backgroundColor: 'rgba(0, 164, 228, 0.15)', color: '#00a4e4' }}>
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Add Sensor Point / oBIX URL</h3>
              <p className="text-[11px] text-slate-400">Configure telemetry endpoint or add manual sensor</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div
            className="p-2.5 mb-3 rounded text-xs flex items-center gap-2"
            style={{ backgroundColor: 'rgba(229, 43, 32, 0.12)', border: '1px solid rgba(229, 43, 32, 0.3)', color: '#ef4444' }}
          >
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-left">
          {/* oBIX URL Box */}
          <div className="p-3 rounded" style={{ backgroundColor: '#17181c', border: '1px solid #282a32' }}>
            <label className="block text-xs font-semibold text-cyan-400 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Link className="w-3.5 h-3.5" /> Niagara oBIX Endpoint URL
              </span>
              <span className="text-[10px] text-slate-500 font-normal">Auto-extract</span>
            </label>
            <input
              type="url"
              value={obixUrl}
              onChange={(e) => handleObixUrlChange(e.target.value)}
              placeholder="e.g. https://192.168.1.100/obix/config/Drivers/Pump1/ or Room1_Temp"
              className="w-full hw-input text-xs font-mono text-cyan-300"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Controller / Device Name
            </label>
            <div className="relative">
              <HardDrive className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="e.g. Niagara Controller, AHU1, Chiller01"
                className="w-full hw-input pl-8 text-xs font-mono"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Sensor Point Name (Unique Identifier)
            </label>
            <input
              type="text"
              value={pointName}
              onChange={(e) => setPointName(e.target.value)}
              placeholder="e.g. Chiller_01, VAV_Box_3, Room1_Temp"
              className="w-full hw-input text-xs font-mono"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Initial Value
              </label>
              <input
                type="number"
                step="0.1"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                className="w-full hw-input text-xs font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Alert Threshold (&deg;C)
              </label>
              <input
                type="number"
                step="0.1"
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(e.target.value)}
                className="w-full hw-input text-xs font-mono"
                required
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#282a32] mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 rounded text-xs font-medium text-slate-400 hover:text-white transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold text-white transition cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: '#00a4e4' }}
            >
              {isSubmitting ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" /> Save Sensor Point
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
