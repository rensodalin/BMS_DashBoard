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
  '#00a4e4',
  '#48bb78',
  '#fa8c16',
  '#ec4899',
  '#8b5cf6',
  '#06b6d4',
  '#e52b20',
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
    <div className="flex flex-col lg:flex-row gap-3 w-full select-none">

      {/* Left Column: Draggable Points Selection */}
      <div className="w-full lg:w-72 shrink-0 flex flex-col gap-3">
        <div
          className="p-3.5"
          style={{
            backgroundColor: '#17181b',
            border: '1px solid #292b30',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h4
              className="text-xs font-medium flex items-center gap-1.5"
              style={{ color: '#d0d2d5' }}
            >
              <Move
                className="w-3.5 h-3.5"
                style={{ color: '#7d858c' }}
              />
              Draggable Points
            </h4>

            <span
              className="text-[10px] font-mono"
              style={{ color: '#666a70' }}
            >
              Drag to chart
            </span>
          </div>

          <p
            className="text-[11px] mb-3 leading-relaxed"
            style={{ color: '#777b82' }}
          >
            Drag a point below into the workspace to compare
            its telemetry.
          </p>

          <div className="flex flex-col gap-1.5 max-h-[500px] overflow-y-auto pr-0.5">
            {points.map((pt) => {
              const isSelected =
                selectedPointNames.includes(pt.point_name);

              const reading = formatPointReading(pt);

              return (
                <div
                  key={pt.point_name}
                  draggable
                  onDragStart={(e) =>
                    handleDragStart(e, pt.point_name)
                  }
                  onClick={() =>
                    isSelected
                      ? handleRemovePoint(pt.point_name)
                      : handleAddPoint(pt.point_name)
                  }
                  className="p-2.5 transition-colors cursor-grab active:cursor-grabbing flex items-center justify-between"
                  style={{
                    backgroundColor: isSelected
                      ? '#20282c'
                      : '#1b1d20',
                    border: `1px solid ${isSelected ? '#315361' : '#292c31'
                      }`,
                    color: isSelected
                      ? '#e3e5e7'
                      : '#c3c6ca',
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Move
                      className="w-3.5 h-3.5 shrink-0"
                      style={{
                        color: isSelected
                          ? '#6e909d'
                          : '#5e6268',
                      }}
                    />

                    <div className="truncate">
                      <div className="font-mono text-xs font-medium truncate">
                        {pt.point_name}
                      </div>

                      <div
                        className="text-[10px] font-mono truncate mt-0.5"
                        style={{ color: '#73777e' }}
                      >
                        {pt.device_name || 'Niagara'} •{' '}
                        {reading.displayText}
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
                    className={`p-1 text-xs transition cursor-pointer ${isSelected
                        ? 'hover:text-red-400'
                        : 'hover:text-white'
                      }`}
                    style={{
                      color: isSelected
                        ? '#7f969e'
                        : '#62666c',
                    }}
                  >
                    {isSelected ? (
                      <X className="w-3.5 h-3.5" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Column: Multi-Point Drop Zone & Multi-Line Chart */}
      <div className="flex-1 min-w-0 flex flex-col gap-3">

        {/* Drop Zone Header */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="p-3.5 transition-all"
          style={{
            border: `1px solid ${isDragOver ? '#00a4e4' : '#292b30'
              }`,
            backgroundColor: isDragOver
              ? 'rgba(0, 164, 228, 0.06)'
              : '#17181b',
          }}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-2.5">

            <div className="flex items-center gap-2">
              <div
                className="p-1.5"
                style={{
                  color: '#858b91',
                }}
              >
                <Layers className="w-4 h-4" />
              </div>

              <div>
                <h3
                  className="text-xs font-medium"
                  style={{ color: '#d1d3d6' }}
                >
                  Multi-Point Telemetry Overlay
                </h3>

                <p
                  className="text-[11px] mt-0.5"
                  style={{ color: '#70747b' }}
                >
                  Comparing {selectedPointNames.length}{' '}
                  {selectedPointNames.length === 1
                    ? 'point'
                    : 'points'}{' '}
                  in real-time
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">

              <button
                onClick={handleExportExcel}
                disabled={selectedPointNames.length === 0}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors cursor-pointer disabled:opacity-40"
                style={{
                  backgroundColor: '#1d1f22',
                  border: '1px solid #30333a',
                  color: '#92979d',
                }}
                title="Export CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={() => loadMultiPointData(true)}
                disabled={isLoading}
                className="p-1 rounded transition-colors cursor-pointer disabled:opacity-50"
                style={{
                  backgroundColor: '#1d1f22',
                  border: '1px solid #30333a',
                  color: '#858a91',
                }}
                title="Refresh"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isLoading
                      ? 'animate-spin text-cyan-400'
                      : ''
                    }`}
                />
              </button>
            </div>
          </div>

          {/* Active Points Tags */}
          <div
            className="flex items-center gap-1.5 flex-wrap min-h-[36px] p-2"
            style={{
              backgroundColor: '#141619',
              border: '1px solid #292c31',
            }}
          >
            <span
              className="text-[10px] font-mono mr-1"
              style={{ color: '#62666c' }}
            >
              ACTIVE POINTS:
            </span>

            {selectedPointNames.length === 0 ? (
              <span
                className="text-xs italic flex items-center gap-1"
                style={{ color: '#666a70' }}
              >
                <HelpCircle
                  className="w-3 h-3"
                  style={{ color: '#777c82' }}
                />
                Drag & drop points here to compare trend lines.
              </span>
            ) : (
              selectedPointNames.map((name, idx) => (
                <span
                  key={name}
                  className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono"
                  style={{
                    backgroundColor: '#202328',
                    border: '1px solid #33363c',
                    color: '#d0d3d6',
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      backgroundColor:
                        LINE_COLORS[
                        idx % LINE_COLORS.length
                        ],
                    }}
                  />

                  <span>{name}</span>

                  <button
                    onClick={() =>
                      handleRemovePoint(name)
                    }
                    className="hover:text-red-400 transition ml-0.5 cursor-pointer"
                    style={{ color: '#6d7279' }}
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
        <div
          className="p-4 h-[440px] relative"
          style={{
            backgroundColor: '#17181b',
            border: '1px solid #292b30',
          }}
        >
          {isLoading && combinedChartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs gap-2">
              <RefreshCw
                className="w-4 h-4 animate-spin"
                style={{ color: '#00a4e4' }}
              />

              <span style={{ color: '#777b82' }}>
                Loading multi-point comparison...
              </span>
            </div>
          ) : selectedPointNames.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <Layers
                className="w-10 h-10 mb-2"
                style={{ color: '#45494f' }}
              />

              <h4
                className="text-xs font-medium mb-1"
                style={{ color: '#aeb2b7' }}
              >
                No Sensor Points Selected
              </h4>

              <p
                className="text-[11px] max-w-sm"
                style={{ color: '#656970' }}
              >
                Drag any point from the left list and drop it
                into the workspace to display the trend.
              </p>
            </div>
          ) : (
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <LineChart data={combinedChartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#292c31"
                />

                <XAxis
                  dataKey="time"
                  stroke="#555a61"
                  tick={{
                    fontSize: 10,
                    fill: '#858a92',
                  }}
                  tickLine={false}
                  axisLine={{
                    stroke: '#34373c',
                  }}
                />

                <YAxis
                  stroke="#555a61"
                  tick={{
                    fontSize: 10,
                    fill: '#858a92',
                  }}
                  tickLine={false}
                  axisLine={false}
                />

                <Tooltip
                  contentStyle={{
                    backgroundColor: '#151719',
                    borderColor: '#34373a',
                    borderRadius: '3px',
                    color: '#ffffff',
                    fontSize: '11px',
                  }}
                />

                <Legend
                  wrapperStyle={{
                    fontSize: '11px',
                    paddingTop: '8px',
                  }}
                />

                {selectedPointNames.map(
                  (name, idx) => (
                    <Line
                      key={name}
                      type="monotone"
                      dataKey={name}
                      name={name}
                      stroke={
                        LINE_COLORS[
                        idx % LINE_COLORS.length
                        ]
                      }
                      strokeWidth={1.8}
                      dot={{ r: 2 }}
                      activeDot={{ r: 4 }}
                    />
                  )
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};