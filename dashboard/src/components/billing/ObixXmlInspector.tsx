import React from 'react';
import { Code2 } from 'lucide-react';

interface ObixXmlInspectorProps {
  liveKwh: number;
}

export const ObixXmlInspector: React.FC<ObixXmlInspectorProps> = ({ liveKwh }) => {
  return (
    <div className="bms-panel rounded-xl p-5 bg-[#0c1018] border border-cyan-500/30 text-slate-200">
      <div className="flex items-center justify-between border-b border-[#1e2638] pb-3 mb-3">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold font-mono tracking-wider text-cyan-300 uppercase">
            Niagara oBIX Endpoint Response Inspector
          </h3>
        </div>
        <span className="text-[11px] font-mono text-slate-500">
          URI: https://localhost/obix/config/Drivers/ObixTest/PowerMeter/
        </span>
      </div>

      <div className="bg-[#05080e] p-4 rounded-lg border border-[#182030] overflow-x-auto font-mono text-[11px] leading-relaxed text-slate-300">
        <div className="text-slate-500">{`<!-- Live XML response payload received from Niagara Station -->`}</div>
        <div>
          <span className="text-purple-400">{`<obj `}</span>
          <span className="text-cyan-300">href</span>=
          <span className="text-emerald-300">"https://localhost/obix/config/Drivers/ObixTest/PowerMeter/"</span>{' '}
          <span className="text-cyan-300">is</span>=
          <span className="text-emerald-300">"/obix/def/baja:Folder"</span>{' '}
          <span className="text-cyan-300">display</span>=
          <span className="text-emerald-300">"Folder"</span>
          <span className="text-purple-400">{`>`}</span>
        </div>
        <div className="pl-4 py-1 bg-blue-950/20 my-1 rounded border-l-2 border-blue-500">
          <span className="text-purple-400">{`<ref `}</span>
          <span className="text-cyan-300">name</span>=
          <span className="text-amber-300">"TenantIntersys_kWh"</span>{' '}
          <span className="text-cyan-300">href</span>=
          <span className="text-emerald-300">"TenantIntersys_kWh/"</span>{' '}
          <span className="text-cyan-300">is</span>=
          <span className="text-emerald-300">
            "/obix/def/control:NumericWritable /obix/def/control:NumericPoint obix:Point"
          </span>{' '}
          <span className="text-cyan-300">display</span>=
          <span className="text-emerald-300">"{liveKwh.toFixed(2)} kW-hr {'{ok}'} @ 10"</span>
          <span className="text-purple-400">{` />`}</span>
        </div>
        <div>
          <span className="text-purple-400">{`</obj>`}</span>
        </div>
      </div>
    </div>
  );
};
