import React from 'react';
import type { SensorPoint } from '../types/bms';
import { StatusBadge } from './StatusBadge';
import { TrendingUp, Trash2, ChevronsUpDown, HardDrive, Cloud } from 'lucide-react';
import { formatPointReading } from './PointsGrid';

interface PointsTableProps {
  points: SensorPoint[];
  onSelectPointTrend: (point: SensorPoint) => void;
  onDeletePoint: (pointName: string) => void;
}

export const PointsTable: React.FC<PointsTableProps> = ({
  points,
  onSelectPointTrend,
  onDeletePoint,
}) => {
  return (
    <div
      className="rounded overflow-hidden mb-6 select-none"
      style={{
        backgroundColor: '#202227',
        border: '1px solid #2d3038',
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left" style={{ borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2d3038', backgroundColor: '#1b1d22' }}>
              {/* NAME */}
              <th className="py-3 px-4 font-bold text-[11px] uppercase tracking-wider text-slate-400">
                <div className="flex items-center gap-1 cursor-pointer hover:text-white transition">
                  <span>NAME</span>
                  <ChevronsUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>

              {/* CONTROLLER / DEVICE */}
              <th className="py-3 px-4 font-bold text-[11px] uppercase tracking-wider text-slate-400">
                <div className="flex items-center gap-1 cursor-pointer hover:text-white transition">
                  <span>CONTROLLER / DEVICE</span>
                  <ChevronsUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>

              {/* LIVE VALUE */}
              <th className="py-3 px-4 font-bold text-[11px] uppercase tracking-wider text-slate-400">
                <div className="flex items-center gap-1 cursor-pointer hover:text-white transition">
                  <span>LIVE VALUE</span>
                  <ChevronsUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>

              {/* ACTIVE HIGH ALARM */}
              <th className="py-3 px-4 font-bold text-[11px] uppercase tracking-wider text-slate-400">
                <div className="flex items-center gap-1 cursor-pointer hover:text-white transition">
                  <span>ACTIVE HIGH ALARM</span>
                  <ChevronsUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>

              {/* STATUS */}
              <th className="py-3 px-4 font-bold text-[11px] uppercase tracking-wider text-slate-400">
                <div className="flex items-center gap-1 cursor-pointer hover:text-white transition">
                  <span>STATUS</span>
                  <ChevronsUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>

              {/* LAST UPDATED */}
              <th className="py-3 px-4 font-bold text-[11px] uppercase tracking-wider text-slate-400">
                <div className="flex items-center gap-1 cursor-pointer hover:text-white transition">
                  <span>LAST UPDATED</span>
                  <ChevronsUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>

              {/* ACTIONS */}
              <th className="py-3 px-4 font-bold text-[11px] uppercase tracking-wider text-slate-400 text-right">
                <span>ACTIONS</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {points.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-14 text-center text-slate-500 font-mono text-xs">
                  No monitored sensor points found.
                </td>
              </tr>
            ) : (
              points.map((pt) => {
                const reading = formatPointReading(pt);
                const isAlarm = reading.isAlarm;

                return (
                  <tr
                    key={pt.point_name}
                    className="hover:bg-[#262930] transition-colors"
                    style={{
                      borderBottom: '1px solid #282a31',
                    }}
                  >
                    {/* NAME Column with Cyan link or Red VAV Box 3 Alert Pill */}
                    <td className="py-3.5 px-4">
                      {isAlarm ? (
                        /* Alarm pill matching exact reference screenshot [ VAV Box 3 ] 🔴 ☁ */
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => onSelectPointTrend(pt)}
                            className="px-2 py-0.5 rounded text-xs font-semibold text-white cursor-pointer transition shadow-sm flex items-center gap-1"
                            style={{ backgroundColor: '#e52b20' }}
                            title="View alarm telemetry"
                          >
                            <span>{pt.point_name}</span>
                          </button>
                          <span className="p-0.5 rounded text-red-500" title="Active Alert">
                            <Cloud className="w-3.5 h-3.5 fill-red-500/20" />
                          </span>
                        </div>
                      ) : (
                        /* Normal cyan text link matching reference screenshot */
                        <span
                          onClick={() => onSelectPointTrend(pt)}
                          className="font-medium cursor-pointer hover:underline"
                          style={{
                            color: '#00a4e4',
                            fontSize: '13px',
                          }}
                        >
                          {pt.point_name}
                        </span>
                      )}
                    </td>

                    {/* Controller / Device */}
                    <td className="py-3.5 px-4 text-slate-300">
                      <div className="flex items-center gap-1.5 text-xs text-slate-300">
                        <HardDrive className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>{pt.device_name || 'Niagara Controller'}</span>
                      </div>
                    </td>

                    {/* Live Telemetry Value */}
                    <td className="py-3.5 px-4 font-mono font-bold text-xs">
                      <span className={reading.statusClass}>
                        {reading.displayText}{reading.isTemp ? ' °C' : ''}
                      </span>
                    </td>

                    {/* Active High Alarm Count */}
                    <td className="py-3.5 px-4">
                      <span
                        className="font-mono text-xs font-medium"
                        style={{
                          color: isAlarm ? '#ef4444' : '#8b929e',
                        }}
                      >
                        {isAlarm ? '1' : '0'}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4">
                      <StatusBadge point={pt} />
                    </td>

                    {/* Last Updated Timestamp */}
                    <td className="py-3.5 px-4 font-mono text-slate-400 text-xs">
                      {pt.updated_at ? new Date(pt.updated_at).toLocaleTimeString() : 'Live'}
                    </td>

                    {/* Action Buttons */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onSelectPointTrend(pt)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium text-slate-300 hover:text-white transition cursor-pointer"
                          style={{
                            backgroundColor: '#17181c',
                            border: '1px solid #2d3038',
                          }}
                          title="View Live Trend"
                        >
                          <TrendingUp className="w-3 h-3 text-cyan-400" />
                          <span>Trend</span>
                        </button>
                        <button
                          onClick={() => onDeletePoint(pt.point_name)}
                          className="p-1 rounded text-slate-500 hover:text-red-400 transition cursor-pointer"
                          title={`Delete ${pt.point_name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
