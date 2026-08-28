import React, { useState, useEffect, useMemo } from 'react';
import type { SensorPoint, PointReading } from '../types/bms';
import { fetchPointReadings } from '../lib/supabase';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Plus, X, Layers, Download, RefreshCw, Move, HelpCircle } from 'lucide-react';
import { formatPointReading } from './PointsGrid';
import { exportToCsv } from '../lib/exportCsv';

interface EquipmentHealthWorkspaceProps {
  points: SensorPoint[];
}

const LINE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444'];

export const EquipmentHealthWorkspace: React.FC<EquipmentHealthWorkspaceProps> = ({ points }) => {
  // Selected point names for multi-point overlay comparison
  const [selectedPointNames, setSelectedPointNames] = useState<string[]>([]);
  const [readingsMap, setReadingsMap] = useState<Record<string, PointReading[]>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Initialize with first 2 points by default if empty
  useEffect(() => {
    if (selectedPointNames.length === 0 && points.length > 0) {
      const initial = points.slice(0, 2).map((p) => p.point_name);
      setSelectedPointNames(initial);
    }
  }, [points]);

  // Fetch telemetry logs for all selected points
  useEffect(() => {
    if (selectedPointNames.length > 0) {
      loadMultiPointData();

      // Auto-poll multi-point telemetry every 3 seconds for live real-time trend updates
      const interval = setInterval(() => {
        loadMultiPointData(false);
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [selectedPointNames]);

  const loadMultiPointData = async (showLoading = false) => {
    if (selectedPointNames.length === 0) return;
    if (showLoading) setIsLoading(true);

    const newMap: Record<string, PointReading[]> = {};
    await Promise.all(
      selectedPointNames.map(async (name) => {
        const data = await fetchPointReadings(name, 30);
        newMap[name] = data;
      })
    );

    setReadingsMap(newMap);
    setIsLoading(false);
  };

  // Add a point to comparison workspace
  const handleAddPoint = (name: string) => {
    if (!selectedPointNames.includes(name)) {
      setSelectedPointNames((prev) => [...prev, name]);
    }
  };

  // Remove a point from comparison workspace
  const handleRemovePoint = (name: string) => {
    setSelectedPointNames((prev) => prev.filter((n) => n !== name));
  };

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent, pointName: string) => {
    e.dataTransfer.setData('text/plain', pointName);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedName = e.dataTransfer.getData('text/plain');
    if (droppedName) {
      handleAddPoint(droppedName);
    }
  };

  // Export Combined Multi-Point Data to Excel CSV
  const handleExportExcel = () => {
    if (selectedPointNames.length === 0) return;

    const headers = ['Timestamp', ...selectedPointNames];
    
    // Collect all timestamps across all selected points
    const timeSet = new Set<string>();
    Object.values(readingsMap).forEach((readings) => {
      readings.forEach((r) => timeSet.add(new Date(r.recorded_at).toLocaleString()));
    });

    const sortedTimes = Array.from(timeSet).sort();
    const rows = sortedTimes.map((timeStr) => {
      const rowVals = selectedPointNames.map((name) => {
        const pointReadings = readingsMap[name] || [];
        const match = pointReadings.find((r) => new Date(r.recorded_at).toLocaleString() === timeStr);
        return match ? match.value : '';
      });
      return [timeStr, ...rowVals];
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    exportToCsv(`Multi_Point_Equipment_Trend_${dateStr}.csv`, headers, rows);
  };

  // Transform multi-point readings into combined time-series chart dataset
  const combinedChartData = useMemo(() => {
    if (selectedPointNames.length === 0) return [];

    // Group by timestamp string
    const mapByTime: Record<string, any> = {};

    selectedPointNames.forEach((ptName) => {
      const ptReadings = readingsMap[ptName] || [];
      ptReadings.forEach((r) => {
        const timeKey = new Date(r.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        if (!mapByTime[timeKey]) {
          mapByTime[timeKey] = { time: timeKey };
        }
        mapByTime[timeKey][ptName] = r.value;
      });
    });

    return Object.values(mapByTime);
  }, [selectedPointNames, readingsMap]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full font-sans">
      
      {/* Left Sidebar: Draggable Points Selection */}
      <div className="w-full lg:w-80 shrink-0 flex flex-col gap-4">
        <div className="bms-panel p-4 rounded-xl border border-[#1e2638] bg-[#131924]">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Move className="w-3.5 h-3.5 text-blue-400" /> Draggable Points
            </h4>
            <span className="text-[10px] text-slate-500 font-mono">Drag to chart</span>
          </div>

          <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
            Drag any point below and drop it into the chart workspace to overlay multi-point trends!
          </p>

          <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-1">
            {points.map((pt) => {
              const isSelected = selectedPointNames.includes(pt.point_name);
              const reading = formatPointReading(pt);

              return (
                <div
                  key={pt.point_name}
                  draggable
                  onDragStart={(e) => handleDragStart(e, pt.point_name)}
                  onClick={() => (isSelected ? handleRemovePoint(pt.point_name) : handleAddPoint(pt.point_name))}
                  className={`p-3 rounded-lg border transition-all duration-200 cursor-grab active:cursor-grabbing flex items-center justify-between select-none ${
                    isSelected
                      ? 'bg-blue-600/15 border-blue-500/40 text-white'
                      : 'bg-[#0c1018] border-[#1e2638] hover:border-slate-600 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Move className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <div className="truncate">
                      <div className="font-mono text-xs font-semibold truncate">{pt.point_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">
                        {pt.device_name || 'ObixTest'} • {reading.displayText}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      isSelected ? handleRemovePoint(pt.point_name) : handleAddPoint(pt.point_name);
                    }}
                    className={`p-1 rounded text-xs transition ${
                      isSelected ? 'text-blue-400 hover:text-red-400' : 'text-slate-500 hover:text-white'
                    }`}
                  >
                    {isSelected ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Column: Multi-Point Drop Zone & Multi-Line Chart Workspace */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        
        {/* Drop Zone Header Bar */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`bms-panel p-4 rounded-xl border transition-all duration-300 ${
            isDragOver
              ? 'border-blue-500 bg-blue-600/10 shadow-lg shadow-blue-500/10'
              : 'border-[#1e2638] bg-[#131924]'
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Multi-Point Telemetry Overlay Chart</h3>
                <p className="text-[11px] text-slate-400">Comparing {selectedPointNames.length} points in real-time</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportExcel}
                disabled={selectedPointNames.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-medium transition cursor-pointer disabled:opacity-50"
                title="Export combined comparison table to Excel (.csv)"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Excel</span>
              </button>

              <button
                onClick={() => loadMultiPointData(true)}
                disabled={isLoading}
                className="p-1.5 rounded-lg bg-[#1a2233] border border-[#26324a] hover:border-slate-500 text-slate-300 hover:text-white transition cursor-pointer"
                title="Refresh telemetry"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* Active Dropped Point Tags */}
          <div className="flex items-center gap-2 flex-wrap min-h-[38px] p-2.5 rounded-lg bg-[#0c1018] border border-[#1e2638]">
            <span className="text-[11px] font-mono text-slate-500 mr-1 flex items-center gap-1">
              <Layers className="w-3 h-3 text-blue-400" /> ACTIVE POINTS:
            </span>

            {selectedPointNames.length === 0 ? (
              <span className="text-xs text-slate-500 italic flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 text-blue-400" /> Drag and drop points here to compare trend lines!
              </span>
            ) : (
              selectedPointNames.map((name, idx) => (
                <span
                  key={name}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-semibold text-white border transition-all"
                  style={{
                    backgroundColor: `${LINE_COLORS[idx % LINE_COLORS.length]}20`,
                    borderColor: `${LINE_COLORS[idx % LINE_COLORS.length]}50`,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: LINE_COLORS[idx % LINE_COLORS.length] }}
                  ></span>
                  <span>{name}</span>
                  <button
                    onClick={() => handleRemovePoint(name)}
                    className="hover:text-red-400 transition ml-1"
                    title="Remove point from chart"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Multi-Line Recharts Trend Workspace */}
        <div className="bms-panel p-5 rounded-xl border border-[#1e2638] bg-[#131924] h-[450px] relative">
          {isLoading && combinedChartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400 gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
              <span>Loading multi-point telemetry comparison...</span>
            </div>
          ) : selectedPointNames.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <Layers className="w-12 h-12 text-slate-600 mb-3" />
              <h4 className="text-sm font-semibold text-slate-300 mb-1">No Sensor Points Selected</h4>
              <p className="text-xs text-slate-500 max-w-sm">
                Drag any point from the left sidebar and drop it into this workspace to display live multi-line trend overlay!
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={combinedChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f293d" />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111827',
                    borderColor: '#1f293d',
                    borderRadius: '0.5rem',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />

                {selectedPointNames.map((name, idx) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    name={name}
                    stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                    strokeWidth={2.5}
                    dot={{ r: 2 }}
                    activeDot={{ r: 6 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

      </div>

    </div>
  );
};
