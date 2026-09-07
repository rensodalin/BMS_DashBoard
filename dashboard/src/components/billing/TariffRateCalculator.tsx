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
    <div
      className="bms-panel p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
      style={{
        backgroundColor: '#17191d',
        border: '1px solid #292c31',
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="p-2"
          style={{
            backgroundColor: '#1d2227',
            border: '1px solid #30353a',
            color: '#8a949b',
          }}
        >
          <Calculator className="w-4 h-4" />
        </div>

        <div className="min-w-0">
          <h3
            className="text-xs font-medium flex items-center gap-2"
            style={{ color: '#d4d7da' }}
          >
            Electricity Tariff Calculator Rate ($/kWh)
          </h3>

          <p
            className="text-[11px] mt-1 leading-relaxed"
            style={{ color: '#777d84' }}
          >
            Enter price per kWh below to instantly multiply by
            total consumption across all tenant meters.
          </p>
        </div>
      </div>

      {/* Input Box & Preset Buttons */}
      <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">

        <div
          className="flex items-center gap-2 p-1.5"
          style={{
            backgroundColor: '#111316',
            border: '1px solid #30343a',
          }}
        >
          <span
            className="text-xs font-mono pl-2"
            style={{ color: '#737980' }}
          >
            $
          </span>

          <input
            type="number"
            step="0.01"
            min="0"
            value={ratePerKwh}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onRateChange(isNaN(val) ? 0 : val);
            }}
            className="w-24 bg-transparent font-mono text-sm font-medium focus:outline-none"
            style={{ color: '#d6aa62' }}
            placeholder="0.15"
          />

          <span
            className="text-[11px] font-mono pr-2"
            style={{ color: '#626870' }}
          >
            / kWh
          </span>
        </div>

        {/* Quick Preset Rate Buttons */}
        <div className="flex items-center gap-1.5">
          <span
            className="text-[10px] font-mono hidden sm:inline"
            style={{ color: '#656b72' }}
          >
            Presets:
          </span>

          {presets.map((preset) => (
            <button
              key={preset}
              onClick={() => onRateChange(preset)}
              className={`px-2.5 py-1 text-[11px] font-mono transition cursor-pointer ${ratePerKwh === preset
                  ? 'text-white'
                  : 'hover:text-white'
                }`}
              style={
                ratePerKwh === preset
                  ? {
                    backgroundColor: '#126f91',
                    border: '1px solid #1982a5',
                  }
                  : {
                    backgroundColor: '#1b1e22',
                    border: '1px solid #30343a',
                    color: '#858b92',
                  }
              }
              onMouseEnter={(e) => {
                if (ratePerKwh !== preset) {
                  e.currentTarget.style.borderColor = '#484d53';
                  e.currentTarget.style.color = '#d0d3d6';
                }
              }}
              onMouseLeave={(e) => {
                if (ratePerKwh !== preset) {
                  e.currentTarget.style.borderColor = '#30343a';
                  e.currentTarget.style.color = '#858b92';
                }
              }}
            >
              ${preset.toFixed(2)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};