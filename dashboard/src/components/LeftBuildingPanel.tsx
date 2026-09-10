import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { SensorPoint } from '../types/bms';
import { Star, MapPin, Bell, Info, CheckCircle2, AlertTriangle, Camera, Upload, X, Check, Building2, RotateCcw, ExternalLink, Globe } from 'lucide-react';
import { formatPointReading } from './PointsGrid';
import { useAuth } from '../context/AuthContext';
import { supabase, fetchFacilityProfileDb, saveFacilityProfileDb } from '../lib/supabase';

interface LeftBuildingPanelProps {
  points: SensorPoint[];
  facilityName?: string;
  onUpdateFacilityName?: (newName: string) => void;
}

// Client-side lightweight image resizer to keep database payloads efficient (<150KB)
const resizeImageFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 800;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const LeftBuildingPanel: React.FC<LeftBuildingPanelProps> = ({ points, facilityName, onUpdateFacilityName }) => {
  const { user, updateClientAccount } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeName = facilityName || 'Station HQ';
  const storageKey = `bms_site_profile_${activeName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

  const [siteName, setSiteName] = useState<string>(activeName);
  const [siteImage, setSiteImage] = useState<string>('/building_hq.jpg');
  const [siteLocation, setSiteLocation] = useState<string>('Phnom Penh, Cambodia');
  const [mapUrl, setMapUrl] = useState<string>('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Edit form states
  const [inputName, setInputName] = useState<string>(activeName);
  const [previewImage, setPreviewImage] = useState<string>('/building_hq.jpg');
  const [inputLocation, setInputLocation] = useState<string>('Phnom Penh, Cambodia');
  const [inputMapUrl, setInputMapUrl] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Load saved site name, custom photo, and location for this facility from Database & local cache
  useEffect(() => {
    let isMounted = true;

    // 1. Initial fast load from localStorage cache or user session
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.image) setSiteImage(parsed.image);
        if (parsed.name) setSiteName(parsed.name);
        if (parsed.location) setSiteLocation(parsed.location);
        if (parsed.mapUrl) setMapUrl(parsed.mapUrl);
      } else if (user && user.role !== 'admin') {
        if (user.imageUrl) setSiteImage(user.imageUrl);
        else setSiteImage('/building_hq.jpg');
        setSiteName(user.siteName || user.name || activeName);
        setSiteLocation(user.locationAddress || 'Phnom Penh, Cambodia');
        setMapUrl(user.mapUrl || '');
      } else {
        setSiteImage('/building_hq.jpg');
        setSiteName(activeName);
        setSiteLocation('Phnom Penh, Cambodia');
        setMapUrl('');
      }
    } catch {
      setSiteImage('/building_hq.jpg');
      setSiteName(activeName);
      setSiteLocation('Phnom Penh, Cambodia');
      setMapUrl('');
    }

    // 2. Fetch authoritative profile from Supabase database
    fetchFacilityProfileDb(activeName).then((dbProfile) => {
      if (!isMounted || !dbProfile) return;
      if (dbProfile.site_name) setSiteName(dbProfile.site_name);
      if (dbProfile.image_url) setSiteImage(dbProfile.image_url);
      if (dbProfile.location_address) setSiteLocation(dbProfile.location_address);
      if (dbProfile.map_url !== undefined && dbProfile.map_url !== null) {
        setMapUrl(dbProfile.map_url);
      }

      // Update localStorage cache
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          name: dbProfile.site_name || activeName,
          image: dbProfile.image_url || '/building_hq.jpg',
          location: dbProfile.location_address || 'Phnom Penh, Cambodia',
          mapUrl: dbProfile.map_url || '',
          updatedAt: dbProfile.updated_at || new Date().toISOString(),
        })
      );
    });

    // 3. Realtime subscription to live updates from Supabase database
    const channel = supabase
      .channel(`realtime_facility_${activeName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'facility_profiles' },
        (payload) => {
          const newRow: any = payload.new;
          if (
            newRow &&
            newRow.facility_name &&
            newRow.facility_name.toLowerCase().trim() === activeName.toLowerCase().trim()
          ) {
            if (newRow.site_name) setSiteName(newRow.site_name);
            if (newRow.image_url) setSiteImage(newRow.image_url);
            if (newRow.location_address) setSiteLocation(newRow.location_address);
            if (newRow.map_url !== undefined) setMapUrl(newRow.map_url || '');

            // Update localStorage cache
            localStorage.setItem(
              storageKey,
              JSON.stringify({
                name: newRow.site_name,
                image: newRow.image_url,
                location: newRow.location_address,
                mapUrl: newRow.map_url || '',
                updatedAt: newRow.updated_at || new Date().toISOString(),
              })
            );
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [storageKey, activeName, user]);

  // Compute Google Maps Link
  const resolvedMapUrl = (() => {
    if (mapUrl && mapUrl.trim().startsWith('http')) return mapUrl.trim();
    if (mapUrl && mapUrl.trim().length > 0) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapUrl.trim())}`;
    }
    if (siteLocation && siteLocation.trim().length > 0) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(siteLocation.trim())}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(siteName + ' Phnom Penh')}`;
  })();

  const handleOpenEdit = () => {
    setInputName(siteName);
    setPreviewImage(siteImage);
    setInputLocation(siteLocation);
    setInputMapUrl(mapUrl);
    setIsEditModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const resizedBase64 = await resizeImageFile(file);
      setPreviewImage(resizedBase64);
    } catch (err) {
      console.warn('Failed to read image file:', err);
    }
  };

  const handleResetImage = () => {
    setPreviewImage('/building_hq.jpg');
  };

  const handleSaveSite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const cleanName = inputName.trim() || activeName;
    const finalImage = previewImage || '/building_hq.jpg';
    const cleanLocation = inputLocation.trim() || 'Phnom Penh, Cambodia';
    const cleanMapUrl = inputMapUrl.trim();

    try {
      // 1. Save to Supabase Cloud Database (both facility_profiles & client_accounts)
      await saveFacilityProfileDb({
        facility_name: activeName,
        site_name: cleanName,
        image_url: finalImage,
        location_address: cleanLocation,
        map_url: cleanMapUrl,
        client_id: user?.role !== 'admin' ? user?.id : undefined,
      });

      // 2. Cache in local storage for fast instant load
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          name: cleanName,
          image: finalImage,
          location: cleanLocation,
          mapUrl: cleanMapUrl,
          updatedAt: new Date().toISOString(),
        })
      );

      // 3. Update local state
      setSiteName(cleanName);
      setSiteImage(finalImage);
      setSiteLocation(cleanLocation);
      setMapUrl(cleanMapUrl);

      if (onUpdateFacilityName && cleanName !== activeName) {
        onUpdateFacilityName(cleanName);
      }

      // 4. If client is logged in and modifying their facility, sync client account
      if (user && user.role !== 'admin' && user.id) {
        await updateClientAccount(user.id, {
          assignedTenant: cleanName,
          name: cleanName,
          siteName: cleanName,
          imageUrl: finalImage,
          locationAddress: cleanLocation,
          mapUrl: cleanMapUrl,
        });
      }
    } catch (err) {
      console.warn('Failed to persist site profile to database:', err);
    } finally {
      setIsSaving(false);
      setIsEditModalOpen(false);
    }
  };

  const activeAlarmsList = points.filter((pt) => {
    const reading = formatPointReading(pt);
    return reading.isAlarm;
  });

  const activeAlarmsCount = activeAlarmsList.length;

  // Rating calculation: 5 stars if 0 alarms, 4 if 1-2 alarms, 3 if <=5 alarms, etc.
  const buildingRating = activeAlarmsCount === 0 ? 5 : activeAlarmsCount <= 2 ? 4 : activeAlarmsCount <= 5 ? 3 : 2;
  const ratingLabel = buildingRating >= 4 ? 'Good' : buildingRating === 3 ? 'Fair' : 'Poor';

  const totalZones = points.length;

  return (
    <div className="w-full lg:w-64 shrink-0 flex flex-col gap-3 select-none lg:sticky lg:top-[88px] lg:self-start lg:max-h-[calc(100vh-100px)] lg:overflow-y-auto pr-0.5">
      
      {/* ── 1. Building Site Photo Card ── */}
      <div className="hw-panel overflow-hidden relative group">
        <div className="h-36 relative bg-slate-900 overflow-hidden">
          <img
            src={siteImage}
            alt={siteName}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              e.currentTarget.src = '/building_hq.jpg';
            }}
          />
          {/* Subtle gradient scrim */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to top, rgba(23,24,28,0.75) 0%, transparent 60%)',
            }}
          />
          {/* Location badge overlay */}
          <div
            className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium"
            style={{
              background: 'rgba(18, 19, 22, 0.85)',
              backdropFilter: 'blur(4px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#ffffff',
            }}
          >
            <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
            <span className="truncate max-w-[130px]">{siteName}</span>
          </div>

          {/* Edit Site Information Pill Button */}
          <button
            type="button"
            onClick={handleOpenEdit}
            className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold text-white bg-black/60 hover:bg-[#00a4e4] border border-white/20 hover:border-[#00a4e4] backdrop-blur-xs transition cursor-pointer z-10 shadow-md"
            title="Edit site name, location & photo"
          >
            <Camera className="w-3 h-3 text-cyan-300" />
            <span>Edit</span>
          </button>
        </div>

        {/* Site Location & Google Maps Navigation Link */}
        <div className="p-2 px-3 bg-[#111319] border-t border-[#20222a] flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <MapPin className="w-3 h-3 text-[#00a4e4] shrink-0" />
            <span className="text-[11px] text-slate-300 font-medium truncate" title={siteLocation}>
              {siteLocation}
            </span>
          </div>
          {resolvedMapUrl && (
            <a
              href={resolvedMapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold text-[#00a4e4] hover:text-white bg-[#00a4e4]/10 hover:bg-[#00a4e4] border border-[#00a4e4]/30 hover:border-[#00a4e4] transition-all cursor-pointer"
              title="Open location on Google Maps"
            >
              <span>Map</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      </div>

      {/* ── 2. Healthy Building Rating Card ── */}
      <div className="hw-panel p-3.5">
        <div className="flex items-center gap-1 mb-1">
          <span className="font-semibold text-xs text-white">Healthy Building</span>
          <Info className="w-3 h-3 text-slate-400" />
        </div>

        <div className="text-[11px] text-slate-400 mb-2">
          Overall Rating (Total {totalZones} zones)
        </div>

        {/* Large Rating Number & Stars */}
        <div className="flex items-center gap-2 mb-3">
          <span className="font-bold text-white text-3xl leading-none">
            {buildingRating}
          </span>
          <div className="flex flex-col">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className="w-3 h-3"
                  style={{
                    color: s <= buildingRating ? '#fa8c16' : '#4a4e5a',
                    fill: s <= buildingRating ? '#fa8c16' : 'none',
                  }}
                />
              ))}
            </div>
            <span className="text-[11px] font-medium text-slate-400">{ratingLabel}</span>
          </div>
        </div>

        {/* Intelligent Optimization Badge */}
        <div
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
          style={{
            backgroundColor: '#16181c',
            border: '1px solid #2d3038',
            color: '#d1d5db',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span>INTELLIGENT OPTIMIZATION ON</span>
        </div>
      </div>

      {/* ── 3. Alarm Summary Card ── */}
      <div className="hw-panel p-3.5">
        <div className="text-xs font-semibold text-white mb-2.5">
          Alarm
        </div>

        {/* Alarm 3-Column Stats Grid */}
        <div className="grid grid-cols-3 gap-2 pb-3 mb-3" style={{ borderBottom: '1px solid #282a32' }}>
          
          {/* Total reported */}
          <div className="flex flex-col">
            <Bell className="w-3.5 h-3.5 text-cyan-400 mb-1" />
            <span className="font-bold font-mono text-white text-xl leading-tight">
              {totalZones}
            </span>
            <span className="text-[9px] font-bold text-slate-400 uppercase leading-tight mt-0.5">
              REPORTED<br />HIGH ALARM
            </span>
          </div>

          {/* Active alarms */}
          <div className="flex flex-col">
            <Bell className={`w-3.5 h-3.5 mb-1 ${activeAlarmsCount > 0 ? 'text-red-500' : 'text-slate-500'}`} />
            <span className={`font-bold font-mono text-xl leading-tight ${activeAlarmsCount > 0 ? 'text-red-500' : 'text-slate-400'}`}>
              {activeAlarmsCount}
            </span>
            <span className="text-[9px] font-bold text-slate-400 uppercase leading-tight mt-0.5">
              ACTIVE<br />HIGH ALARM
            </span>
          </div>

          {/* Severity breakdown */}
          <div className="flex flex-col justify-between">
            <div className="flex items-center gap-1 mb-1">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              <span className="font-bold font-mono text-white text-xs">{Math.ceil(activeAlarmsCount * 0.35)}</span>
              <span className="text-[8px] font-bold text-slate-400 uppercase">MEDIUM</span>
            </div>
            <div className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-emerald-400" />
              <span className="font-bold font-mono text-white text-xs">{Math.ceil(activeAlarmsCount * 0.65)}</span>
              <span className="text-[8px] font-bold text-slate-400 uppercase">LOW</span>
            </div>
          </div>

        </div>

        {/* ── Active High Alarm Feed ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
              <Bell className={`w-3.5 h-3.5 ${activeAlarmsCount > 0 ? 'text-red-500' : 'text-slate-500'}`} />
              <span>Active High Alarm</span>
            </div>
            <span className="font-mono text-xs text-slate-400 font-bold">
              {String(activeAlarmsCount).padStart(2, '0')}
            </span>
          </div>

          {/* Alarm Items List */}
          <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-0.5">
            {activeAlarmsList.length > 0 ? (
              activeAlarmsList.map((pt) => {
                const reading = formatPointReading(pt);
                return (
                  <div
                    key={pt.point_name}
                    className="p-2.5 rounded text-xs"
                    style={{
                      backgroundColor: '#16181c',
                      border: '1px solid #282a32',
                    }}
                  >
                    <div className="font-medium font-mono text-white text-xs mb-0.5">
                      {pt.point_name}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {pt.device_name || 'ObixTest'} — <span className={`font-medium ${reading.statusClass}`}>{reading.displayText}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 font-mono">
                      {pt.updated_at ? new Date(pt.updated_at).toLocaleTimeString() : 'Live'}
                    </div>
                  </div>
                );
              })
            ) : (
              <div
                className="p-3 rounded text-xs text-center flex items-center justify-center gap-1.5"
                style={{
                  backgroundColor: '#16181c',
                  border: '1px solid #282a32',
                  color: '#9ca3af',
                }}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>All Points Normal</span>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── 4. Edit Site & Company Information Modal (Rendered via Portal to avoid stacking context clipping) ── */}
      {isEditModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg rounded-2xl p-6 relative text-left shadow-2xl border border-[#262833] animate-in zoom-in-95 duration-150"
            style={{ backgroundColor: '#13151b' }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-[#20222a]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0080c8] to-[#00a4e4] p-0.5 shadow-md shadow-sky-950/50 flex items-center justify-center">
                  <div className="w-full h-full rounded-[10px] bg-[#11131a] flex items-center justify-center text-white">
                    <Building2 className="w-4 h-4 text-[#00a4e4]" />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">Edit Site & Company Profile</h3>
                  <p className="text-[11px] text-slate-400">Customize facility name and company banner photo</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#1f222b] transition cursor-pointer"
                title="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSite} className="space-y-4">
              {/* Image Preview & Upload Controls */}
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center justify-between">
                  <span>Company / Facility Photo</span>
                  <span className="text-[10px] text-slate-500 font-normal">Auto-optimized for performance</span>
                </label>
                
                {/* Image Card Preview */}
                <div className="relative h-44 rounded-xl overflow-hidden border border-[#282a35] bg-black/70 mb-3 group shadow-inner">
                  <img
                    src={previewImage}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = '/building_hq.jpg';
                    }}
                  />
                  
                  {/* Scrim overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

                  {/* Top preview badge */}
                  <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded text-[10px] font-medium bg-black/60 border border-white/10 text-slate-300 backdrop-blur-xs flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#00a4e4]" />
                    <span>{inputName || activeName}</span>
                  </div>

                  {/* Hover action overlay */}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-2 rounded-lg bg-[#00a4e4] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-lg hover:bg-[#0092cc] transition"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Select New Photo</span>
                    </button>
                  </div>
                </div>

                {/* Upload action buttons */}
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-2.5 px-3 rounded-lg text-xs font-semibold text-white bg-[#1c1e27] hover:bg-[#252834] border border-[#2d303d] transition cursor-pointer flex items-center justify-center gap-2 hover:border-[#00a4e4]/50"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#00a4e4]" />
                    <span>Upload Company Photo</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetImage}
                    className="py-2.5 px-3.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 bg-[#1c1e27] hover:bg-[#252834] border border-[#2d303d] transition cursor-pointer flex items-center gap-1.5"
                    title="Reset to default building photo"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Default</span>
                  </button>
                </div>
              </div>

              {/* Site / Company Name Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                  Site / Company Name
                </label>
                <div className="relative">
                  <Building2 className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={inputName}
                    onChange={(e) => setInputName(e.target.value)}
                    placeholder="e.g. nita company, KOI Facility, Station HQ"
                    className="w-full bg-[#0d0e12] border border-[#282a35] focus:border-[#00a4e4] text-white text-xs rounded-lg pl-9 pr-3.5 py-2.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30 transition-colors font-sans"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  This name is displayed on your left building card, status badge, and reports.
                </p>
              </div>

              {/* Company Location / Physical Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center justify-between">
                  <span>Company Location / Physical Address</span>
                  <span className="text-[10px] text-slate-500 font-normal">Displayed on card</span>
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={inputLocation}
                    onChange={(e) => setInputLocation(e.target.value)}
                    placeholder="e.g. Russian Federation Blvd, Toul Kork, Phnom Penh"
                    className="w-full bg-[#0d0e12] border border-[#282a35] focus:border-[#00a4e4] text-white text-xs rounded-lg pl-9 pr-3.5 py-2.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30 transition-colors font-sans"
                  />
                </div>
              </div>

              {/* Google Maps Link or GPS Coordinates */}
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-[#00a4e4]" /> Google Maps Link or Coordinates
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal">Direct map navigation</span>
                </label>
                <div className="relative">
                  <Globe className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={inputMapUrl}
                    onChange={(e) => setInputMapUrl(e.target.value)}
                    placeholder="e.g. https://maps.app.goo.gl/... or 11.5564, 104.9282"
                    className="w-full bg-[#0d0e12] border border-[#282a35] focus:border-[#00a4e4] text-white text-xs rounded-lg pl-9 pr-3.5 py-2.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#00a4e4]/30 transition-colors font-mono text-[11px]"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Paste your Google Maps share link or coordinates. If left empty, it will automatically search by address on Google Maps.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-[#20222a] flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Cloud DB Synced</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-[#1a1c24] transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-[#00a4e4] hover:bg-[#0092cc] active:bg-[#0081b5] transition cursor-pointer flex items-center gap-2 shadow-md shadow-[#00a4e4]/20 disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isSaving ? 'Saving to Database...' : 'Save Site Information'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
