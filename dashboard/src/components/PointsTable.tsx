import React from 'react';
import type { SensorPoint } from '../types/bms';
import { StatusBadge } from './StatusBadge';
import { formatPointReading } from './PointsGrid';
import { detectFloorFromPoint } from '../lib/floorUtils';

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
    <div className="bg-white border border-slate-200/80 rounded-md shadow-xs overflow-hidden mb-6 select-none">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200/70">
              <th className="py-3 px-4 font-semibold text-[11px] text-slate-500">
                Point Name
              </th>
              <th className="py-3 px-4 font-semibold text-[11px] text-slate-500">
                Floor & Device
              </th>
              <th className="py-3 px-4 font-semibold text-[11px] text-slate-500">
                Live Reading
              </th>
              <th className="py-3 px-4 font-semibold text-[11px] text-slate-500">
                Alarms
              </th>
              <th className="py-3 px-4 font-semibold text-[11px] text-slate-500">
                Status
              </th>
              <th className="py-3 px-4 font-semibold text-[11px] text-slate-500">
                Last Sync
              </th>
              <th className="py-3 px-4 font-semibold text-[11px] text-slate-500 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {points.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400 font-medium text-xs">
                  No monitored sensor points found in this scope.
                </td>
              </tr>
            ) : (
              points.map((pt) => {
                const reading = formatPointReading(pt);
                const isAlarm = reading.isAlarm;

                return (
                  <tr
                    key={pt.point_name}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    {/* Point Name */}
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => onSelectPointTrend(pt)}
                        className="text-left font-medium text-slate-900 hover:text-[#001F3F] hover:underline cursor-pointer transition flex items-center gap-1.5"
                      >
                        {isAlarm && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#FF3523] shrink-0" />
                        )}
                        <span>{pt.point_name}</span>
                      </button>
                    </td>

                    {/* Controller / Device & Floor */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-[#e6edf5] text-[#001F3F] shrink-0">
                          {detectFloorFromPoint(pt)}
                        </span>
                        <span className="text-slate-600 truncate font-normal">
                          {pt.device_name || 'Niagara Controller'}
                        </span>
                      </div>
                    </td>

                    {/* Live Telemetry Value */}
                    <td className="py-3 px-4 font-mono font-medium text-xs">
                      <span className={isAlarm ? 'text-[#FF3523] font-bold' : 'text-slate-900'}>
                        {reading.displayText}{reading.isTemp ? ' °C' : ''}
                      </span>
                    </td>

                    {/* Active High Alarm Count */}
                    <td className="py-3 px-4">
                      {isAlarm ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[#fef2f2] text-[#FF3523]">
                          1 Alert
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono text-xs">0</span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-4">
                      <StatusBadge point={pt} />
                    </td>

                    {/* Last Updated Timestamp */}
                    <td className="py-3 px-4 font-mono text-slate-500 text-xs">
                      {pt.updated_at ? new Date(pt.updated_at).toLocaleTimeString() : 'Live'}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSelectPointTrend(pt)}
                          className="px-2.5 py-1 rounded text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer border border-slate-200"
                        >
                          Trend
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeletePoint(pt.point_name)}
                          className="px-2 py-1 rounded text-xs font-medium text-slate-400 hover:text-[#FF3523] hover:bg-red-50 transition cursor-pointer"
                          title={`Delete ${pt.point_name}`}
                        >
                          Delete
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
