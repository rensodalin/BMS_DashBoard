import React, { useState, useEffect } from 'react';
import {
  X,
  HardDrive,
  ShieldAlert,
  Check,
  Link2,
  CheckSquare,
  Square,
  Search,
  Activity,
  Layers,
  FolderTree,
  SlidersHorizontal,
  RefreshCw,
} from 'lucide-react';
import { addOrUpdateSensorPoint } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { detectFloorFromPoint, setLocalPointFloor } from '../lib/floorUtils';

interface AddPointModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultFloor?: string;
  defaultBuilding?: string;
}

interface DiscoveredPoint {
  pointName: string;
  deviceName: string;
  subfolder: string;
  obixUrl: string;
  currentValue: number;
  displayVal?: string;
  pointType: string;
  floorName?: string;
}

export const AddPointModal: React.FC<AddPointModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultFloor,
}) => {
  const { user } = useAuth();
  const [modalMode, setModalMode] = useState<'discover' | 'manual'>('discover');

  // Target floor state
  const [targetFloor, setTargetFloor] = useState<string>(
    defaultFloor && defaultFloor !== 'ALL' ? defaultFloor : 'AUTO'
  );
  const [customFloor, setCustomFloor] = useState<string>('');

  // Folder Scan states - default to Billing System station path
  const [folderUrl, setFolderUrl] = useState(
    defaultFloor === 'Floor 2'
      ? 'https://192.168.1.140/obix/config/Drivers/Billing$20System/floor2/'
      : 'https://192.168.1.140/obix/config/Drivers/Billing$20System/floor1/'
  );

  useEffect(() => {
    if (isOpen) {
      if (defaultFloor === 'Floor 2') {
        setTargetFloor('Floor 2');
        setFolderUrl('https://192.168.1.140/obix/config/Drivers/Billing$20System/floor2/');
      } else if (defaultFloor === 'Floor 1') {
        setTargetFloor('Floor 1');
        setFolderUrl('https://192.168.1.140/obix/config/Drivers/Billing$20System/floor1/');
      } else {
        setTargetFloor('AUTO');
        setFolderUrl('https://192.168.1.140/obix/config/Drivers/Billing$20System/');
      }
    }
  }, [isOpen, defaultFloor]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanFilter, setScanFilter] = useState('');
  const [discoveredPoints, setDiscoveredPoints] = useState<DiscoveredPoint[]>([]);
  const [selectedPointNames, setSelectedPointNames] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [scanNotice, setScanNotice] = useState<{ total: number; simulated?: boolean } | null>(null);

  // Manual single-point states
  const [obixUrl, setObixUrl] = useState('');
  const [pointName, setPointName] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [currentValue, setCurrentValue] = useState('25.0');
  const [alertThreshold, setAlertThreshold] = useState('30.0');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  // Handle Scan Folder
  const handleScanFolder = async () => {
    setErrorMsg('');
    setScanNotice(null);
    if (!folderUrl.trim()) {
      setErrorMsg('Please enter a valid Niagara oBIX Folder URL.');
      return;
    }

    setIsScanning(true);
    try {
      const res = await fetch('/api/obix-discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: folderUrl.trim(),
          mockIfOffline: true,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to scan folder (HTTP ${res.status})`);
      }

      const data = await res.json();
      if (data.points && data.points.length > 0) {
        setDiscoveredPoints(data.points);
        // Select all by default
        setSelectedPointNames(new Set(data.points.map((p: DiscoveredPoint) => p.pointName)));
        setScanNotice({ total: data.total || data.points.length, simulated: data.simulated });
      } else {
        setDiscoveredPoints([]);
        setErrorMsg('No telemetry points found in this folder. Ensure URL ends with a slash and user has read permission.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error scanning Niagara folder.');
    } finally {
      setIsScanning(false);
    }
  };

  // Toggle point selection
  const handleTogglePoint = (ptName: string) => {
    setSelectedPointNames((prev) => {
      const next = new Set(prev);
      if (next.has(ptName)) {
        next.delete(ptName);
      } else {
        next.add(ptName);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedPointNames.size === filteredDiscovered.length) {
      setSelectedPointNames(new Set());
    } else {
      setSelectedPointNames(new Set(filteredDiscovered.map((p) => p.pointName)));
    }
  };

  // Helper to determine floor assignment for a point
  const resolvePointFloor = (ptName: string, deviceOrFolder?: string, url?: string, pointFloor?: string): string => {
    if (targetFloor === '__CUSTOM__') {
      return customFloor.trim() || 'Floor 1';
    }
    if (targetFloor !== 'AUTO') {
      return targetFloor;
    }
    if (pointFloor && pointFloor.trim()) {
      return pointFloor.trim();
    }
    return detectFloorFromPoint({
      point_name: ptName,
      device_name: deviceOrFolder,
      obix_url: url,
    } as any);
  };

  // Quick folder path chip appends
  const handleAppendChip = (slug: string) => {
    const billingBase = 'https://192.168.1.140/obix/config/Drivers/Billing$20System/';
    if (slug === 'billing') {
      setFolderUrl(billingBase);
      setTargetFloor('AUTO');
    } else if (slug === 'drivers') {
      setFolderUrl('https://192.168.1.140/obix/config/Drivers/');
      setTargetFloor('AUTO');
    } else if (slug === 'gf') {
      setFolderUrl(`${billingBase}GF/`);
      setTargetFloor('Ground Floor');
    } else if (slug === '1f' || slug === '$31F') {
      setFolderUrl(`${billingBase}$31F/`);
      setTargetFloor('Floor 1');
    } else if (slug === '2f' || slug === '$32F') {
      setFolderUrl(`${billingBase}$32F/`);
      setTargetFloor('Floor 2');
    } else {
      setFolderUrl(`${billingBase}${slug}/`);
      if (slug === 'floor1') setTargetFloor('Floor 1');
      else if (slug === 'floor2') setTargetFloor('Floor 2');
      else if (slug === 'floor3') setTargetFloor('Floor 3');
      else if (slug === 'floor4') setTargetFloor('Floor 4');
    }
  };

  // Batch import selected points
  const handleImportSelected = async () => {
    setErrorMsg('');
    const pointsToImport = discoveredPoints.filter((p) => selectedPointNames.has(p.pointName));

    if (pointsToImport.length === 0) {
      setErrorMsg('Please select at least 1 point to import.');
      return;
    }

    setIsImporting(true);
    setImportProgress({ current: 0, total: pointsToImport.length });

    let imported = 0;
    for (let i = 0; i < pointsToImport.length; i++) {
      const p = pointsToImport[i];
      const assignedFloor = resolvePointFloor(p.pointName, p.subfolder || p.deviceName, p.obixUrl, p.floorName);
      setLocalPointFloor(p.pointName, assignedFloor);

      const ok = await addOrUpdateSensorPoint({
        point_name: p.pointName,
        device_name: p.deviceName || p.subfolder || 'Niagara Device',
        building_name: user?.siteName || 'Station HQ',
        floor_name: assignedFloor,
        obix_url: p.obixUrl,
        current_value: p.currentValue,
        alert_threshold: 45.0,
        is_alarm: false,
      });
      if (ok) imported++;
      setImportProgress({ current: i + 1, total: pointsToImport.length });
    }

    setIsImporting(false);
    onSuccess();
    onClose();
  };

  // Manual single point URL change
  const handleObixUrlChange = (rawUrl: string) => {
    setObixUrl(rawUrl);
    if (!rawUrl.trim()) return;

    try {
      const cleanUrl = rawUrl.trim().replace(/\/+$/, '');
      const parts = cleanUrl.split('/');
      const driversIndex = parts.findIndex((p) => p.toLowerCase() === 'drivers');

      if (driversIndex !== -1 && driversIndex < parts.length - 1) {
        const device = parts[driversIndex + 1];
        setDeviceName(device);
        if (driversIndex + 2 < parts.length) {
          setPointName(parts[driversIndex + 2]);
        } else {
          setPointName(`${device}_Temp`);
        }
      } else {
        const lastPart = parts[parts.length - 1];
        if (lastPart && !lastPart.startsWith('http')) {
          setPointName(lastPart);
        }
      }
    } catch {
      // Ignore
    }
  };

  // Manual single-point submit
  const handleManualSubmit = async (e: React.FormEvent) => {
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
    const assignedFloor = resolvePointFloor(pointName.trim(), deviceName.trim(), obixUrl.trim());
    setLocalPointFloor(pointName.trim(), assignedFloor);

    const ok = await addOrUpdateSensorPoint({
      point_name: pointName.trim(),
      device_name: deviceName.trim() || 'Niagara Controller',
      building_name: user?.siteName || 'Station HQ',
      floor_name: assignedFloor,
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
      setErrorMsg('Failed to save sensor point to database. Check network connection.');
    }
  };

  // Discovered points filtered by search input
  const filteredDiscovered = discoveredPoints.filter((p) => {
    if (!scanFilter.trim()) return true;
    const s = scanFilter.toLowerCase();
    return (
      p.pointName.toLowerCase().includes(s) ||
      p.subfolder.toLowerCase().includes(s) ||
      p.deviceName.toLowerCase().includes(s)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs select-none animate-in fade-in duration-150">
      <div className="w-full max-w-2xl rounded-md p-6 relative text-left shadow-2xl border border-slate-100 bg-white max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-[#e6edf5] flex items-center justify-center text-[#001F3F]">
              <FolderTree className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Niagara Station Point Manager
                </h3>
                <span className="text-[10px] px-2.5 py-0.5 rounded-lg bg-[#e6edf5] text-[#001F3F] font-mono font-bold">
                  oBIX / REST
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Scan station driver directory or configure individual sensor points
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 pt-4 pb-3 shrink-0">
          <button
            type="button"
            onClick={() => setModalMode('discover')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-xs font-bold transition cursor-pointer ${
              modalMode === 'discover'
                ? 'bg-[#001F3F] text-white shadow-sm shadow-[#001F3F]/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span>Folder Directory Scan</span>
          </button>
          <button
            type="button"
            onClick={() => setModalMode('manual')}
            className={`flex items-center justify-center gap-2 py-2 px-5 rounded-md text-xs font-bold transition cursor-pointer ${
              modalMode === 'manual'
                ? 'bg-[#001F3F] text-white shadow-sm shadow-[#001F3F]/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Manual Configuration</span>
          </button>
        </div>

        {/* Target Building Floor Selector */}
        <div className="p-3.5 rounded-md bg-slate-50 border border-slate-200 mt-1 shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#001F3F]" />
              <span>Target Building Floor</span>
            </label>
            <span className="text-[10px] text-slate-400">Points will be assigned to this floor</span>
          </div>
          <select
            value={targetFloor}
            onChange={(e) => setTargetFloor(e.target.value)}
            className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-md px-3 py-2 outline-none font-medium cursor-pointer"
          >
            <option value="AUTO">✨ Auto-Detect from Subfolder (e.g. /floor1/ → Floor 1)</option>
            <option value="Floor 1">🏢 Floor 1</option>
            <option value="Floor 2">🏢 Floor 2</option>
            <option value="Floor 3">🏢 Floor 3</option>
            <option value="Floor 4">🏢 Floor 4</option>
            <option value="Floor 5">🏢 Floor 5</option>
            <option value="Floor 6">🏢 Floor 6</option>
            <option value="Basement">🏢 Basement</option>
            <option value="Rooftop">🏢 Rooftop</option>
            <option value="__CUSTOM__">✏️ Custom floor name...</option>
          </select>
          {targetFloor === '__CUSTOM__' && (
            <input
              type="text"
              value={customFloor}
              onChange={(e) => setCustomFloor(e.target.value)}
              placeholder="Enter floor name (e.g. Floor 7, Mezzanine)"
              className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-md px-3 py-2 outline-none font-medium mt-2"
              required
            />
          )}
        </div>

        {errorMsg && (
          <div className="p-2.5 rounded-md text-xs bg-[#fef2f2] border border-[#FF3523]/30 text-[#FF3523] mt-2 flex items-center gap-2 shrink-0">
            <ShieldAlert className="w-4 h-4 shrink-0 text-[#FF3523]" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ====================================================================
            MODE 1: FOLDER DIRECTORY SCAN
        ==================================================================== */}
        {modalMode === 'discover' ? (
          <div className="flex-1 min-h-0 flex flex-col pt-3 space-y-3">
            {/* Folder URL Input with Quick Chips */}
            <div className="p-3.5 rounded-md bg-slate-50 border border-slate-200 shrink-0">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Niagara Station Folder Path</span>
                </label>
                <span className="text-[10px] text-slate-400 font-mono">Recursively traverses subfolders</span>
              </div>

              <div className="flex gap-2">
                <input
                  type="url"
                  value={folderUrl}
                  onChange={(e) => setFolderUrl(e.target.value)}
                  placeholder="https://192.168.1.140/obix/config/Drivers/Billing$20System/"
                  className="flex-1 bg-white border border-slate-200 rounded-md px-3 py-2 text-xs font-mono text-slate-800 outline-none focus:border-[#001F3F]"
                />
                <button
                  type="button"
                  disabled={isScanning}
                  onClick={handleScanFolder}
                  className="px-5 py-2 rounded-md bg-[#001F3F] hover:bg-[#001428] text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 shrink-0 shadow-sm shadow-[#001F3F]/20"
                >
                  {isScanning ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Scanning...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5" />
                      <span>Scan Directory</span>
                    </>
                  )}
                </button>
              </div>

              {/* Quick site folder chips */}
              <div className="flex items-center gap-1.5 mt-2.5 flex-wrap text-xs">
                <span className="text-slate-400 text-[10px]">Shortcuts:</span>
                <button
                  type="button"
                  onClick={() => handleAppendChip('gf')}
                  className="px-2.5 py-0.5 rounded-lg bg-white text-slate-600 hover:text-[#001F3F] hover:border-[#001F3F] text-[10px] font-mono transition cursor-pointer border border-slate-200"
                >
                  /GF/ (Ground Floor)
                </button>
                <button
                  type="button"
                  onClick={() => handleAppendChip('$31F')}
                  className="px-2.5 py-0.5 rounded-lg bg-white text-slate-600 hover:text-[#001F3F] hover:border-[#001F3F] text-[10px] font-mono transition cursor-pointer border border-slate-200"
                >
                  /$31F/ (Floor 1)
                </button>
                <button
                  type="button"
                  onClick={() => handleAppendChip('$32F')}
                  className="px-2.5 py-0.5 rounded-lg bg-white text-slate-600 hover:text-[#001F3F] hover:border-[#001F3F] text-[10px] font-mono transition cursor-pointer border border-slate-200"
                >
                  /$32F/ (Floor 2)
                </button>
                <button
                  type="button"
                  onClick={() => handleAppendChip('billing')}
                  className="px-2.5 py-0.5 rounded-lg bg-white text-slate-600 hover:text-[#001F3F] hover:border-[#001F3F] text-[10px] font-mono transition cursor-pointer border border-slate-200"
                >
                  /Billing$20System/
                </button>
              </div>
            </div>

            {/* Discovered Points Container */}
            {discoveredPoints.length > 0 && (
              <div className="flex-1 min-h-0 flex flex-col bg-slate-50 border border-slate-200 rounded-md p-3.5 overflow-hidden">
                {/* Discovery Toolbar */}
                <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-200 shrink-0 flex-wrap">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="flex items-center gap-1.5 text-xs text-slate-700 hover:text-slate-900 transition cursor-pointer font-bold"
                    >
                      {selectedPointNames.size === filteredDiscovered.length && filteredDiscovered.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-[#001F3F]" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                      <span>
                        Select All ({selectedPointNames.size}/{filteredDiscovered.length})
                      </span>
                    </button>

                    {scanNotice?.simulated && (
                      <span className="text-[10px] px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 font-semibold">
                        Simulated Mode
                      </span>
                    )}
                  </div>

                  <div className="relative w-44">
                    <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      value={scanFilter}
                      onChange={(e) => setScanFilter(e.target.value)}
                      placeholder="Filter points..."
                      className="w-full bg-white border border-slate-200 rounded-md px-2.5 pl-7 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#001F3F]"
                    />
                  </div>
                </div>

                {/* Scrollable Points List */}
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                  {filteredDiscovered.map((pt) => {
                    const isSelected = selectedPointNames.has(pt.pointName);
                    return (
                      <div
                        key={pt.pointName}
                        onClick={() => handleTogglePoint(pt.pointName)}
                        className={`p-2.5 rounded-md border transition cursor-pointer flex items-center justify-between gap-3 text-left select-none ${
                          isSelected
                            ? 'bg-[#e6edf5] border-[#001F3F]/40 text-[#001F3F]'
                            : 'bg-white border-slate-200 hover:bg-slate-100/80 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-[#001F3F] shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          <div className="truncate">
                            <div className="font-bold text-xs truncate">
                              {pt.pointName}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                              <span className="inline-flex items-center gap-1 font-mono text-slate-500">
                                <Layers className="w-2.5 h-2.5" />
                                {pt.subfolder}
                              </span>
                              <span className="px-1.5 py-0.2 rounded-lg text-[9px] font-mono font-bold bg-[#e6edf5] text-[#001F3F]">
                                {resolvePointFloor(pt.pointName, pt.subfolder || pt.deviceName, pt.obixUrl)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Live value badge */}
                        <div className="shrink-0 text-right">
                          <span className="px-2 py-0.5 rounded-lg text-xs font-mono font-bold bg-[#e6edf5] text-[#001F3F]">
                            {pt.displayVal || pt.currentValue}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Import Action Footer */}
                <div className="pt-3 mt-2 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
                  <div className="text-xs text-slate-500">
                    Target Floor: <strong className="text-slate-800">{targetFloor === '__CUSTOM__' ? customFloor || 'Custom' : targetFloor}</strong>
                  </div>

                  <button
                    type="button"
                    disabled={isImporting || selectedPointNames.size === 0}
                    onClick={handleImportSelected}
                    className="px-5 py-2 rounded-md text-xs font-bold text-white bg-[#001F3F] hover:bg-[#001428] transition cursor-pointer flex items-center gap-2 disabled:opacity-50 shadow-sm shadow-[#001F3F]/20"
                  >
                    {isImporting ? (
                      <>
                        <Activity className="w-3.5 h-3.5 animate-spin" />
                        <span>
                          Importing {importProgress ? `${importProgress.current}/${importProgress.total}` : ''}...
                        </span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Import {selectedPointNames.size} Points</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ====================================================================
              MODE 2: SINGLE POINT MANUAL ENTRY
          ==================================================================== */
          <form onSubmit={handleManualSubmit} className="space-y-3.5 text-left pt-2">
            <div className="p-3.5 rounded-md bg-slate-50 border border-slate-200">
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-slate-400" /> Direct oBIX Endpoint URL
                </span>
                <span className="text-[10px] text-slate-400 font-normal">Optional</span>
              </label>
              <input
                type="url"
                value={obixUrl}
                onChange={(e) => handleObixUrlChange(e.target.value)}
                placeholder="https://192.168.1.140/obix/config/Drivers/intersys/AHU1/SupplyTemp/"
                className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-xs font-mono text-slate-800 outline-none focus:border-[#001F3F]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Subfolder / Equipment Type
              </label>
              <div className="relative">
                <HardDrive className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="e.g. AHU_01, Chiller_Plant, PowerMeter"
                  className="w-full bg-slate-50 border border-slate-200 rounded-md pl-9 pr-3 py-2 text-xs text-slate-800 outline-none focus:bg-white focus:border-[#001F3F]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Point Identifier Name
              </label>
              <input
                type="text"
                value={pointName}
                onChange={(e) => setPointName(e.target.value)}
                placeholder="e.g. AHU_01 - SupplyTemp, Chiller_Status"
                className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-800 outline-none focus:bg-white focus:border-[#001F3F]"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Initial Telemetry Value
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={currentValue}
                  onChange={(e) => setCurrentValue(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-800 outline-none focus:bg-white focus:border-[#001F3F]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alert Limit Threshold
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={alertThreshold}
                  onChange={(e) => setAlertThreshold(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-800 outline-none focus:bg-white focus:border-[#001F3F]"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-md text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-5 py-2 rounded-md text-xs font-bold text-white bg-[#001F3F] hover:bg-[#001428] transition cursor-pointer disabled:opacity-50 shadow-sm shadow-[#001F3F]/20"
              >
                {isSubmitting ? (
                  <span>Saving to Database...</span>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" /> Save Sensor Point
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
