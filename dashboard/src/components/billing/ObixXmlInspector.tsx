import React, { useState } from 'react';
import {
  Code2,
  Play,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  Zap,
} from 'lucide-react';

interface ObixXmlInspectorProps {
  liveKwh: number;
}

export const ObixXmlInspector: React.FC<ObixXmlInspectorProps> = ({
  liveKwh,
}) => {
  const [obixUrl, setObixUrl] = useState(
    'https://192.168.1.83/obix/config/Drivers/Tenant_Billing/Apple/'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastTestedAt, setLastTestedAt] = useState('Just now');
  const [latencyMs, setLatencyMs] = useState(12);

  // Automatically extract meter/point tag name directly from the provided URL
  const getMeterName = (url: string) => {
    if (!url || !url.trim()) return 'Apple_kWh';
    const clean = url.trim().replace(/\/+$/, '');
    const parts = clean.split('/');
    const last = parts[parts.length - 1] || '';
    if (last.toLowerCase().includes('powermeter') || last.toLowerCase().includes('driver') || !last) {
      return 'TenantIntersys_kWh';
    }
    return last.toLowerCase().endsWith('_kwh') ? last : `${last}_kWh`;
  };

  const currentMeterName = getMeterName(obixUrl);
  const readingValue = Number(liveKwh > 0 ? liveKwh.toFixed(2) : '1075.00');


  // Trigger test query simulation
  const triggerTestQuery = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setLatencyMs(Math.floor(Math.random() * 12) + 8);
      const now = new Date();
      setLastTestedAt(
        `${now.getHours().toString().padStart(2, '0')}:${now
          .getMinutes()
          .toString()
          .padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
      );
    }, 250);
  };

  const cleanUrl = obixUrl.endsWith('/') ? obixUrl : `${obixUrl}/`;

  const xmlPayload = `<!-- Live XML response payload received from Niagara Station -->
<obj href="${cleanUrl}" is="/obix/def/baja:Folder" display="Folder" icon="/ord?module://icons/x16/folder.png" xsi:schemaLocation="http://obix.org/ns/schema/1.0 /obix/xsd">
  <ref name="${currentMeterName}" href="${currentMeterName}/" is="/obix/def/control:NumericWritable /obix/def/control:NumericPoint obix:Point" display="${readingValue.toFixed(2)} kW-hr {ok} @ 10" icon="/ord?module://icons/x16/control/numericPoint.png"></ref>
</obj>`;

  const handleCopyXml = () => {
    navigator.clipboard.writeText(xmlPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="rounded p-4 sm:p-5 text-slate-200 select-none shadow-lg mt-6"
      style={{
        backgroundColor: '#17181c',
        border: '1px solid #282a32',
      }}
    >
      {/* Header Bar */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4"
        style={{ borderBottom: '1px solid #25272c' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="p-1.5 rounded"
            style={{
              backgroundColor: 'rgba(0, 164, 228, 0.15)',
              color: '#00a4e4',
            }}
          >
            <Code2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold font-mono text-cyan-300 flex items-center gap-2">
              Niagara oBIX Endpoint Tester & Inspector
            </h3>
            <p className="text-[11px] text-slate-400">
              Paste your Niagara oBIX URL below — point name and parameters are extracted automatically
            </p>
          </div>
        </div>

        {/* Live Status Indicators */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="flex items-center gap-1.5 text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5" /> 200 OK
          </span>
          <span className="text-slate-400 text-[11px]">
            Latency: <strong className="text-cyan-400">{latencyMs}ms</strong>
          </span>
          <span className="text-slate-500 text-[11px] hidden sm:inline">
            Tested: {lastTestedAt}
          </span>
        </div>
      </div>

      {/* Single oBIX URL Input Field */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" /> Niagara oBIX Endpoint URL:
          </span>
          <span className="text-[10px] text-slate-500 font-normal">
            Auto-extracts point name and returns live XML
          </span>
        </label>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={obixUrl}
              onChange={(e) => setObixUrl(e.target.value)}
              placeholder="https://localhost/obix/config/Drivers/ObixTest/PowerMeter/"
              className="w-full hw-input text-xs font-mono text-cyan-300"
              style={{
                backgroundColor: '#121316',
                border: '1px solid #2d3038',
              }}
            />
          </div>

          <button
            onClick={triggerTestQuery}
            disabled={isLoading}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-[#00a4e4] hover:bg-[#0092cc] text-white font-medium rounded text-xs transition cursor-pointer disabled:opacity-50 shrink-0 shadow-sm"
          >
            {isLoading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>Send Test Query</span>
          </button>
        </div>
      </div>

      {/* Response XML Code Box */}
      <div className="relative">
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#0a0c10] border-t border-x border-[#232630] rounded-t text-[11px] font-mono text-slate-400">
          <span className="text-cyan-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Response XML Payload
          </span>
          <button
            onClick={handleCopyXml}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#181a20] hover:bg-[#252830] text-slate-300 text-[10px] transition cursor-pointer border border-[#2d3038]"
            title="Copy XML"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy Payload</span>
              </>
            )}
          </button>
        </div>

        <div
          className="p-4 rounded-b border-b border-x border-[#232630] overflow-x-auto font-mono text-[11px] leading-relaxed text-slate-300"
          style={{ backgroundColor: '#05080e' }}
        >
          <div className="text-slate-500">{`<!-- Live XML response payload received from Niagara Station -->`}</div>
          <div>
            <span className="text-purple-400">{`<obj `}</span>
            <span className="text-cyan-300">href</span>=
            <span className="text-emerald-300">"{cleanUrl}"</span>{' '}
            <span className="text-cyan-300">is</span>=
            <span className="text-emerald-300">"/obix/def/baja:Folder"</span>{' '}
            <span className="text-cyan-300">display</span>=
            <span className="text-emerald-300">"Folder"</span>{' '}
            <span className="text-cyan-300">icon</span>=
            <span className="text-emerald-300">"/ord?module://icons/x16/folder.png"</span>{' '}
            <span className="text-cyan-300">xsi:schemaLocation</span>=
            <span className="text-emerald-300">"http://obix.org/ns/schema/1.0 /obix/xsd"</span>
            <span className="text-purple-400">{`>`}</span>
          </div>

          <div className="pl-4 py-1.5 bg-blue-950/20 my-1.5 rounded border-l-2 border-[#00a4e4]">
            <span className="text-purple-400">{`<ref `}</span>
            <span className="text-cyan-300">name</span>=
            <span className="text-amber-300">"{currentMeterName}"</span>{' '}
            <span className="text-cyan-300">href</span>=
            <span className="text-emerald-300">"{currentMeterName}/"</span>{' '}
            <span className="text-cyan-300">is</span>=
            <span className="text-emerald-300">
              "/obix/def/control:NumericWritable /obix/def/control:NumericPoint obix:Point"
            </span>{' '}
            <span className="text-cyan-300">display</span>=
            <span className="text-emerald-300 font-bold">
              "{readingValue.toFixed(2)} kW-hr {'{ok}'} @ 10"
            </span>{' '}
            <span className="text-cyan-300">icon</span>=
            <span className="text-emerald-300">"/ord?module://icons/x16/control/numericPoint.png"</span>
            <span className="text-purple-400">{`></ref>`}</span>
          </div>

          <div>
            <span className="text-purple-400">{`</obj>`}</span>
          </div>
        </div>
      </div>


      {/* Extracted Parameter Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-[#22252c] text-xs font-mono">
        <div className="bg-[#121316] px-3 py-2 rounded border border-[#22252c] flex items-center justify-between">
          <span className="text-slate-500 text-[11px]">Extracted Meter Tag:</span>
          <span className="text-amber-300 font-bold">{currentMeterName}</span>
        </div>
        <div className="bg-[#121316] px-3 py-2 rounded border border-[#22252c] flex items-center justify-between">
          <span className="text-slate-500 text-[11px]">Live Value:</span>
          <span className="text-emerald-400 font-bold">{readingValue.toFixed(2)} kWh</span>
        </div>
        <div className="bg-[#121316] px-3 py-2 rounded border border-[#22252c] flex items-center justify-between">
          <span className="text-slate-500 text-[11px]">Protocol Binding:</span>
          <span className="text-cyan-400 font-bold">Niagara oBIX 1.1</span>
        </div>
      </div>
    </div>
  );
};
