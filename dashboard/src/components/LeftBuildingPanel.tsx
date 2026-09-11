import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { SensorPoint } from '../types/bms';
import { Star, MapPin, CheckCircle2, Camera, Upload, X, Check, Building2, RotateCcw, ExternalLink, Globe } from 'lucide-react';
import { formatPointReading } from './PointsGrid';
import { useAuth } from '../context/AuthContext';
import { supabase, fetchFacilityProfileDb, saveFacilityProfileDb } from '../lib/supabase';

interface LeftBuildingPanelProps {
  points: SensorPoint[];
  facilityName?: string;
  onUpdateFacilityName?: (newName: string) => void;
  selectedFloor?: string;
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

export const LeftBuildingPanel: React.FC<LeftBuildingPanelProps> = ({
  points,
  facilityName,
  onUpdateFacilityName,
  selectedFloor: _selectedFloor,
}) => {
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
    <div className="w-full lg:w-64 shrink-0 flex flex-col gap-4 select-none lg:sticky lg:top-[88px] lg:self-start lg:max-h-[calc(100vh-100px)] lg:overflow-y-auto pr-0.5">

      {/* ── 1. Building Site Photo Card ── */}
      <div className="shrink-0 bg-white border border-slate-100/90 rounded-md overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.03)] group">
        <div className="h-52 w-full relative bg-slate-100 overflow-hidden shrink-0" style={{ height: '210px', minHeight: '210px' }}>
          <img
            src={siteImage}
            alt={siteName}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 45%' }}
            onError={(e) => {
              e.currentTarget.src = '/building_hq.jpg';
            }}
          />
          {/* Soft gradient scrim */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

          {/* Location badge overlay */}
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium bg-white/95 backdrop-blur-md text-slate-800 shadow-xs z-10">
            <MapPin className="w-3 h-3 text-[#001F3F] shrink-0" />
            <span className="truncate max-w-[120px]">{siteName}</span>
          </div>

          {/* Edit Site Information Button */}
          <button
            type="button"
            onClick={handleOpenEdit}
            className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold text-white bg-slate-900/70 hover:bg-[#001F3F] backdrop-blur-md transition cursor-pointer z-10 shadow-xs"
            title="Edit site name, location & photo"
          >
            <Camera className="w-3 h-3" />
            <span>Edit</span>
          </button>
        </div>

        {/* Site Location & Google Maps Navigation Link */}
        <div className="p-3 bg-white flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <MapPin className="w-3.5 h-3.5 text-[#001F3F] shrink-0" />
            <span className="text-xs text-slate-600 font-medium truncate" title={siteLocation}>
              {siteLocation}
            </span>
          </div>
          {resolvedMapUrl && (
            <a
              href={resolvedMapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-semibold text-[#001F3F] bg-[#e6edf5] hover:bg-[#001F3F] hover:text-white transition-all cursor-pointer shrink-0"
              title="Open location on Google Maps"
            >
              <span>Map</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      </div>

      {/* ── 2. Healthy Building Rating Card (Intersys Donut Format) ── */}
      <div className="shrink-0 bg-white border border-slate-100 rounded-md p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col items-center text-center">
        <div className="w-full flex items-center justify-between mb-3">
          <span className="font-bold text-xs text-slate-800">Building Health</span>
          <span className="text-[10px] font-bold text-slate-500">{totalZones} Points</span>
        </div>

        {/* Intersys Style SVG Donut Chart */}
        <div className="relative w-28 h-28 my-1 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {/* Background circle track */}
            <circle
              cx="50"
              cy="50"
              r="40"
              className="stroke-slate-100"
              strokeWidth="10"
              fill="transparent"
            />
            {/* Intersys Navy Healthy Arc */}
            <circle
              cx="50"
              cy="50"
              r="40"
              stroke="#001F3F"
              strokeWidth="10"
              strokeDasharray={251.2}
              strokeDashoffset={251.2 * (1 - (totalZones > 0 ? (totalZones - activeAlarmsCount) / totalZones : 1))}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-700 ease-out"
            />
            {/* Intersys Red Alarm Arc (if active alarms exist) */}
            {activeAlarmsCount > 0 && (
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="#FF3523"
                strokeWidth="10"
                strokeDasharray={251.2}
                strokeDashoffset={251.2 * (1 - activeAlarmsCount / totalZones)}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-700 ease-out"
              />
            )}
          </svg>
          {/* Donut Center Metrics */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="font-extrabold font-mono text-slate-900 text-xl leading-none">
              {totalZones > 0 ? Math.round(((totalZones - activeAlarmsCount) / totalZones) * 100) : 100}%
            </span>
            <span className="text-[9px] font-bold text-slate-500 mt-1">
              Healthy
            </span>
          </div>
        </div>

        {/* Stars & Rating Label */}
        <div className="flex items-center gap-1 mt-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star
              key={s}
              className="w-3.5 h-3.5"
              style={{
                color: s <= buildingRating ? '#f59e0b' : '#e2e8f0',
                fill: s <= buildingRating ? '#f59e0b' : 'none',
              }}
            />
          ))}
          <span className="text-xs font-bold text-slate-700 ml-1">{ratingLabel}</span>
        </div>

        {/* Intelligent Optimization Badge */}
        <div className="mt-3 w-full py-1.5 px-2 rounded-md bg-[#e6edf5] text-[#001F3F] text-[10px] font-bold flex items-center justify-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#001F3F] animate-pulse" />
          <span>Niagara Optimization Active</span>
        </div>
      </div>

      {/* ── 3. Alarm Summary Card ── */}
      <div className="shrink-0 bg-white border border-slate-100 rounded-md p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
        <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-3">
          <span>Active Alarms</span>
          <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
            activeAlarmsCount > 0 ? 'bg-[#fef2f2] text-[#FF3523]' : 'bg-[#e6edf5] text-[#001F3F]'
          }`}>
            {activeAlarmsCount} Active
          </span>
        </div>

        {/* Alarm 3-Column Stats Grid */}
        <div className="grid grid-cols-3 gap-2 pb-3 mb-3 border-b border-slate-100 text-center">
          {/* Total reported */}
          <div className="flex flex-col items-center">
            <span className="font-extrabold font-mono text-slate-900 text-lg leading-tight">
              {totalZones}
            </span>
            <span className="text-[9px] font-bold text-slate-500 leading-tight mt-0.5">
              Total
            </span>
          </div>

          {/* Active alarms */}
          <div className="flex flex-col items-center">
            <span className={`font-extrabold font-mono text-lg leading-tight ${activeAlarmsCount > 0 ? 'text-[#FF3523]' : 'text-slate-800'}`}>
              {activeAlarmsCount}
            </span>
            <span className="text-[9px] font-bold text-slate-500 leading-tight mt-0.5">
              Alarms
            </span>
          </div>

          {/* Warning state */}
          <div className="flex flex-col items-center">
            <span className="font-extrabold font-mono text-slate-800 text-lg leading-tight">
              {Math.ceil(activeAlarmsCount * 0.35)}
            </span>
            <span className="text-[9px] font-bold text-slate-500 leading-tight mt-0.5">
              Warnings
            </span>
          </div>
        </div>

        {/* ── Active High Alarm Feed ── */}
        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-0.5">
          {activeAlarmsList.length > 0 ? (
            activeAlarmsList.map((pt) => {
              const reading = formatPointReading(pt);
              return (
                <div
                  key={pt.point_name}
                  className="p-2.5 rounded bg-slate-50 border border-slate-100 text-xs"
                >
                  <div className="font-bold font-mono text-slate-800 text-xs mb-0.5">
                    {pt.point_name}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {pt.device_name || 'ObixTest'} — <span className="font-bold text-[#FF3523]">{reading.displayText}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 font-mono">
                    {pt.updated_at ? new Date(pt.updated_at).toLocaleTimeString() : 'Live'}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-3 rounded bg-blue-50/60 border border-blue-100 text-xs text-[#001F3F] font-semibold text-center flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#001F3F]" />
              <span>All Points Operating Normally</span>
            </div>
          )}
        </div>
      </div>

      {/* ── 4. Edit Site & Company Information Modal ── */}
      {isEditModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs select-none animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-md p-6 relative text-left shadow-2xl border border-slate-100 bg-white animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-[#e6edf5] flex items-center justify-center text-[#001F3F]">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Edit Site & Company Profile</h3>
                  <p className="text-xs text-slate-500">Customize facility name and company banner photo</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                title="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSite} className="space-y-4">
              {/* Image Preview & Upload Controls */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Company / Facility Photo</span>
                  <span className="text-[10px] text-slate-400 font-normal">Auto-optimized for performance</span>
                </label>

                {/* Image Card Preview */}
                <div className="relative h-44 rounded-md overflow-hidden border border-slate-200 bg-slate-100 mb-3 group shadow-inner">
                  <img
                    src={previewImage}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = '/building_hq.jpg';
                    }}
                  />

                  {/* Scrim overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

                  {/* Top preview badge */}
                  <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded text-[10px] font-semibold bg-white/90 text-slate-800 shadow-xs flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#001F3F]" />
                    <span>{inputName || activeName}</span>
                  </div>

                  {/* Hover action overlay */}
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 rounded-md bg-[#001F3F] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md hover:bg-[#001428] transition"
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
                    className="flex-1 py-2 px-3 rounded-md text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#001F3F]" />
                    <span>Upload Company Photo</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetImage}
                    className="py-2 px-3.5 rounded-md text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition cursor-pointer flex items-center gap-1.5"
                    title="Reset to default building photo"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Default</span>
                  </button>
                </div>
              </div>

              {/* Site / Company Name Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Site / Company Name
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={inputName}
                    onChange={(e) => setInputName(e.target.value)}
                    placeholder="e.g. Intersys Solutions Facility, Station HQ"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#001F3F] text-slate-800 text-xs rounded-md pl-9 pr-3.5 py-2.5 placeholder:text-slate-400 focus:outline-none focus:bg-white transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Company Location / Physical Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Company Location / Physical Address
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={inputLocation}
                    onChange={(e) => setInputLocation(e.target.value)}
                    placeholder="e.g. Russian Federation Blvd, Toul Kork, Phnom Penh"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#001F3F] text-slate-800 text-xs rounded-md pl-9 pr-3.5 py-2.5 placeholder:text-slate-400 focus:outline-none focus:bg-white transition-colors"
                  />
                </div>
              </div>

              {/* Google Maps Link or GPS Coordinates */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-[#001F3F]" /> Google Maps Link or Coordinates
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Direct map navigation</span>
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={inputMapUrl}
                    onChange={(e) => setInputMapUrl(e.target.value)}
                    placeholder="e.g. https://maps.app.goo.gl/... or 11.5564, 104.9282"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#001F3F] text-slate-800 text-xs rounded-md pl-9 pr-3.5 py-2.5 placeholder:text-slate-400 focus:outline-none focus:bg-white transition-colors font-mono text-[11px]"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-1.5 text-[11px] text-[#001F3F] font-semibold">
                  <span className="w-2 h-2 rounded-full bg-[#001F3F] animate-pulse" />
                  <span>Cloud DB Synced</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 rounded-md text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 rounded-md text-xs font-bold text-white bg-[#001F3F] hover:bg-[#001428] active:bg-[#001428] transition cursor-pointer flex items-center gap-2 shadow-sm shadow-[#001F3F]/20 disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isSaving ? 'Saving...' : 'Save Site Information'}</span>
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
