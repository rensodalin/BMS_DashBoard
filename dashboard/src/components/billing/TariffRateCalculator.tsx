import React from 'react';
import { Calculator } from 'lucide-react';

interface TariffRateCalculatorProps {
  ratePerKwh: number;
  onRateChange: (newRate: number) => void;
}

export const TariffRateCalculator: React.FC<TariffRateCalculatorProps> = ({
  ratePerKwh,
  onRateChange,
}) => {
  const presets = [0.12, 0.15, 0.18, 0.22];

  return (
    <div className="bms-panel rounded-xl p-5 bg-[#0f141d] border border-blue-500/30 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400">
          <Calculator className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            Electricity Tariff Calculator Rate ($/kWh)
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Enter price per kWh below to instantly multiply by total consumption across all tenant meters.
          </p>
        </div>
      </div>

      {/* Input Box & Preset Buttons */}
      <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
        <div className="flex items-center gap-2 bg-[#05080e] p-1.5 rounded-lg border border-[#1e2638]">
          <span className="text-slate-400 text-xs font-mono pl-2 font-bold">$</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={ratePerKwh}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onRateChange(isNaN(val) ? 0 : val);
            }}
            className="w-24 bg-transparent text-amber-400 font-mono text-sm font-bold focus:outline-none"
            placeholder="0.15"
          />
          <span className="text-[11px] text-slate-500 font-mono pr-2">/ kWh</span>
        </div>

        {/* Quick Preset Rate Buttons */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">Presets:</span>
          {presets.map((preset) => (
            <button
              key={preset}
              onClick={() => onRateChange(preset)}
              className={`px-2.5 py-1 rounded text-[11px] font-mono transition cursor-pointer ${
                ratePerKwh === preset
                  ? 'bg-blue-600 text-white font-bold'
                  : 'bg-[#131924] text-slate-400 hover:text-white border border-[#1e2638]'
              }`}
            >
              ${preset.toFixed(2)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
