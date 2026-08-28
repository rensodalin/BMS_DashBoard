import React from 'react';
import type { SensorPoint } from '../types/bms';
import { StatusBadge } from './StatusBadge';
import { TrendingUp, HardDrive, Trash2 } from 'lucide-react';
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
    <div className="bms-panel rounded-xl overflow-hidden mb-8 border border-[#1f293d]">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-[#0d131f] text-xs font-semibold text-slate-400 border-b border-[#1f293d]">
            <tr>
              <th className="py-3.5 px-5">Controller / Device</th>
              <th className="py-3.5 px-5">Point Key Name</th>
              <th className="py-3.5 px-5">Live Value</th>
              <th className="py-3.5 px-5">Limit Threshold</th>
              <th className="py-3.5 px-5">Status</th>
              <th className="py-3.5 px-5">Last Updated</th>
              <th className="py-3.5 px-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1f293d] bg-[#111827]">
            {points.map((pt) => {
              const reading = formatPointReading(pt);

              return (
                <tr key={pt.point_name} className={`hover:bg-slate-800/40 transition ${reading.isAlarm ? 'bg-red-500/5' : ''}`}>
                  <td className="py-3.5 px-5 font-medium text-white flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-blue-400" />
                    <span>{pt.device_name || 'Niagara Controller'}</span>
                  </td>
                  <td className="py-3.5 px-5 font-semibold text-white font-mono text-sm">{pt.point_name}</td>
                  <td className={`py-3.5 px-5 font-mono font-bold text-base ${reading.statusClass}`}>
                    {reading.displayText}{reading.isTemp ? ' °C' : ''}
                  </td>
                  <td className="py-3.5 px-5 font-mono text-red-400 font-medium">
                    {reading.isTemp && pt.alert_threshold ? `≥ ${pt.alert_threshold}°C` : '-'}
                  </td>
                  <td className="py-3.5 px-5">
                    <StatusBadge point={pt} />
                  </td>
                  <td className="py-3.5 px-5 text-xs text-slate-400 font-mono">
                    {new Date(pt.updated_at).toLocaleTimeString()}
                  </td>
                  <td className="py-3.5 px-5 text-right flex items-center justify-end gap-2">
                    <button
                      onClick={() => onSelectPointTrend(pt)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition cursor-pointer"
                    >
                      <TrendingUp className="w-3.5 h-3.5 text-blue-400" /> View Trend
                    </button>
                    <button
                      onClick={() => onDeletePoint(pt.point_name)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition cursor-pointer"
                      title={`Delete ${pt.point_name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
