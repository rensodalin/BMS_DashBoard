import React, { useState, useEffect, useMemo } from 'react';
import type { SensorPoint, PointReading } from '../types/bms';
import { fetchPointReadings } from '../lib/supabase';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  Plus,
  X,
  Layers,
  Download,
  RefreshCw,
  Move,
  HelpCircle,
} from 'lucide-react';
import { formatPointReading } from './PointsGrid';
import { exportToCsv } from '../lib/exportCsv';

interface EquipmentHealthWorkspaceProps {
  points: SensorPoint[];
}

const LINE_COLORS = [
  '#001F3F',
  '#FF3523',
  '#10b981',
  '#f59e0b',
  '#6366f1',
  '#0ea5e9',
];

export const EquipmentHealthWorkspace: React.FC<
  EquipmentHealthWorkspaceProps
> = ({ points }) => {
  const [selectedPointNames, setSelectedPointNames] = useState<string[]>([]);
  const [readingsMap, setReadingsMap] = useState<
    Record<string, PointReading[]>
  >({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  useEffect(() => {
    if (selectedPointNames.length === 0 && points.length > 0) {
      const initial = points.slice(0, 2).map((p) => p.point_name);
      setSelectedPointNames(initial);
    }
  }, [points]);

  useEffect(() => {
    if (selectedPointNames.length > 0) {
      loadMultiPointData();

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

  const handleAddPoint = (name: string) => {
    if (!selectedPointNames.includes(name)) {
      setSelectedPointNames((prev) => [...prev, name]);
    }
  };

  const handleRemovePoint = (name: string) => {
    setSelectedPointNames((prev) =>
      prev.filter((n) => n !== name)
    );
  };

  const handleDragStart = (
    e: React.DragEvent,
    pointName: string
  ) => {
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

  const handleExportExcel = () => {
    if (selectedPointNames.length === 0) return;

    const headers = ['Timestamp', ...selectedPointNames];

    const timeSet = new Set<string>();

    Object.values(readingsMap).forEach((readings) => {
      readings.forEach((r) =>
        timeSet.add(
          new Date(r.recorded_at).toLocaleString()
        )
      );
    });

    const sortedTimes = Array.from(timeSet).sort();

    const rows = sortedTimes.map((timeStr) => {
      const rowVals = selectedPointNames.map((name) => {
        const pointReadings = readingsMap[name] || [];

        const match = pointReadings.find(
          (r) =>
            new Date(r.recorded_at).toLocaleString() ===
            timeStr
        );

        return match ? match.value : '';
      });

      return [timeStr, ...rowVals];
    });

    const dateStr = new Date()
      .toISOString()
      .slice(0, 10);

    exportToCsv(
      `Multi_Point_Equipment_Trend_${dateStr}.csv`,
      headers,
      rows
    );
  };

  const combinedChartData = useMemo(() => {
    if (selectedPointNames.length === 0) return [];

    const mapByTime: Record<string, any> = {};

    selectedPointNames.forEach((ptName) => {
      const ptReadings = readingsMap[ptName] || [];

      ptReadings.forEach((r) => {
        const timeKey = new Date(
          r.recorded_at
        ).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        if (!mapByTime[timeKey]) {
          mapByTime[timeKey] = {
            time: timeKey,
          };
        }

        mapByTime[timeKey][ptName] = r.value;
      });
    });

    return Object.values(mapByTime);
  }, [selectedPointNames, readingsMap]);

  return (
    <div className="flex flex-col lg:flex-row gap-5 w-full select-none">

      {/* Left Column: Draggable Points Selection */}
      <div className="w-full lg:w-72 shrink-0 flex flex-col gap-4">
        <div className="bg-white border border-slate-100/90 rounded-md p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Move className="w-3.5 h-3.5 text-[#001F3F]" />
              Telemetry Library
            </h4>

            <span className="text-[10px] font-medium text-slate-500">
              Drag to chart
            </span>
          </div>

          <p className="text-xs text-slate-400 mb-3 leading-relaxed">
            Drag any point below into the comparison canvas.
          </p>

          <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-0.5">
            {points.map((pt) => {
              const isSelected = selectedPointNames.includes(pt.point_name);
              const reading = formatPointReading(pt);

              return (
                <div
                  key={pt.point_name}
                  draggable
                  onDragStart={(e) => handleDragStart(e, pt.point_name)}
                  onClick={() =>
                    isSelected
                      ? handleRemovePoint(pt.point_name)
                      : handleAddPoint(pt.point_name)
                  }
                  className={`p-2.5 rounded-md border transition-all cursor-grab active:cursor-grabbing flex items-center justify-between ${
                    isSelected
                      ? 'bg-[#e6edf5] border-[#001F3F]/30 text-[#001F3F] shadow-xs'
                      : 'bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100/80'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Move className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[#001F3F]' : 'text-slate-400'}`} />

                    <div className="truncate">
                      <div className="font-bold text-xs truncate">
                        {pt.point_name}
                      </div>

                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        {pt.device_name || 'Niagara'} • {reading.displayText}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      isSelected
                        ? handleRemovePoint(pt.point_name)
                        : handleAddPoint(pt.point_name);
                    }}
                    className={`p-1.5 rounded text-xs transition cursor-pointer ${
                      isSelected
                        ? 'text-[#FF3523] hover:bg-[#fef2f2]'
                        : 'text-[#001F3F] hover:bg-white'
                    }`}
                    title={isSelected ? 'Remove' : 'Add to chart'}
                  >
                    {isSelected ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Column: Multi-Point Drop Zone & Multi-Line Chart */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">

        {/* Drop Zone Header */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`bg-white border rounded-md p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] transition-all ${
            isDragOver ? 'border-[#001F3F] bg-[#e6edf5]/40 ring-2 ring-[#001F3F]/20' : 'border-slate-100/90'
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-[#e6edf5] flex items-center justify-center text-[#001F3F]">
                <Layers className="w-4 h-4" />
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-800">
                  Multi-Point Telemetry Overlay
                </h3>

                <p className="text-xs text-slate-400 mt-0.5">
                  Comparing {selectedPointNames.length}{' '}
                  {selectedPointNames.length === 1 ? 'point' : 'points'} in real-time
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportExcel}
                disabled={selectedPointNames.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-40"
                title="Export CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={() => loadMultiPointData(true)}
                disabled={isLoading}
                className="p-2 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    isLoading ? 'animate-spin text-[#001F3F]' : ''
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Active Points Tags */}
          <div className="flex items-center gap-2 flex-wrap min-h-[40px] p-2.5 rounded-md bg-slate-50/80 border border-slate-100">
            <span className="text-[10px] font-medium text-slate-500 mr-1">
              Active Points:
            </span>

            {selectedPointNames.length === 0 ? (
              <span className="text-xs italic text-slate-400 flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                Drag & drop points here to compare trend lines.
              </span>
            ) : (
              selectedPointNames.map((name, idx) => (
                <span
                  key={name}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-white border border-slate-200 text-slate-800 shadow-2xs"
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor:
                        LINE_COLORS[idx % LINE_COLORS.length],
                    }}
                  />

                  <span>{name}</span>

                  <button
                    onClick={() => handleRemovePoint(name)}
                    className="hover:text-[#FF3523] transition ml-0.5 cursor-pointer text-slate-400"
                    title="Remove point"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Multi-Line Chart Workspace */}
        <div className="bg-white border border-slate-100/90 rounded-md p-5 h-[440px] relative shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
          {isLoading && combinedChartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs gap-2 text-slate-400">
              <RefreshCw className="w-4 h-4 animate-spin text-[#001F3F]" />
              <span>Loading multi-point comparison...</span>
            </div>
          ) : selectedPointNames.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <Layers className="w-10 h-10 mb-2 text-slate-300" />

              <h4 className="text-xs font-bold text-slate-700 mb-1">
                No Sensor Points Selected
              </h4>

              <p className="text-xs text-slate-400 max-w-sm">
                Drag any point from the left list and drop it into the workspace to display the trend.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={combinedChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />

                <XAxis
                  dataKey="time"
                  stroke="#94a3b8"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />

                <YAxis
                  stroke="#94a3b8"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                />

                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#f1f5f9',
                    borderRadius: '16px',
                    color: '#0f172a',
                    fontSize: '12px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                  }}
                />

                <Legend
                  wrapperStyle={{
                    fontSize: '11px',
                    paddingTop: '8px',
                  }}
                />

                {selectedPointNames.map((name, idx) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    name={name}
                    stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                    strokeWidth={2.2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
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