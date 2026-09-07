import React, { useRef, useState, useEffect } from 'react';
import { X, FileDown, Loader2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { INTERSYS_LOGO_BASE64 } from '../../assets/logoBase64';
import type { TenantInvoiceDb } from '../../types/bms';
import { calculateIntervalConsumption } from './TenantInvoicesTable';
import { fetchMeterReadingRange } from '../../lib/supabase';

interface TenantInvoiceSummaryModalProps {
  isOpen: boolean;
  invoice: TenantInvoiceDb | null;
  ratePerKwh: number;
  onClose: () => void;
}

export const TenantInvoiceSummaryModal: React.FC<TenantInvoiceSummaryModalProps> = ({
  isOpen,
  invoice,
  ratePerKwh,
  onClose,
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [telemetryRange, setTelemetryRange] = useState<{
    startReading: number | null;
    endReading: number | null;
    deltaKwh: number | null;
  } | null>(null);

  useEffect(() => {
    if (!isOpen || !invoice?.meter_name) return;

    let isMounted = true;
    const startIso = invoice.start_date
      ? (invoice.start_date.includes(' ') ? invoice.start_date.replace(' ', 'T') : invoice.start_date).slice(0, 19)
      : '2026-08-01T00:00:00';
    const endIso = invoice.end_date
      ? (invoice.end_date.includes(' ') ? invoice.end_date.replace(' ', 'T') : invoice.end_date).slice(0, 19)
      : '2026-09-04T23:59:59';

    fetchMeterReadingRange(invoice.meter_name, startIso, endIso).then((res) => {
      if (isMounted) {
        setTelemetryRange(res);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, invoice?.meter_name, invoice?.start_date, invoice?.end_date]);

  if (!isOpen || !invoice) return null;

  // Format date helper: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss -> DD-MM-YYYY HH:mm:ss
  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '01-08-2026 00:00:00';
    if (dateStr.includes('T')) {
      const [d, t] = dateStr.split('T');
      const dParts = d.split('-');
      const formattedDate = dParts.length === 3 ? `${dParts[2]}-${dParts[1]}-${dParts[0]}` : d;
      return `${formattedDate} ${t.slice(0, 8)}`;
    }
    if (dateStr.includes(' ')) {
      const [d, t] = dateStr.split(' ');
      const dParts = d.split('-');
      const formattedDate = dParts.length === 3 ? `${dParts[2]}-${dParts[1]}-${dParts[0]}` : d;
      return `${formattedDate} ${t}`;
    }
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  };

  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const todayFormatted = `${pad(today.getDate())}-${pad(today.getMonth() + 1)}-${today.getFullYear()} ${pad(today.getHours())}:${pad(today.getMinutes())}:${pad(today.getSeconds())}`;

  const fromDate = formatDateTime(invoice.start_date || '2026-08-01T00:00:00');
  const toDate = formatDateTime(invoice.end_date || '2026-08-31T23:59:59');

  // Exact interval subtraction: End Hour - Start Hour
  const intervalCalc = calculateIntervalConsumption(
    invoice.kwh_reading || 0,
    invoice.start_date,
    invoice.end_date
  );

  const durationHours = intervalCalc.durationHours;
  const startHourStr = intervalCalc.startHourStr;
  const endHourStr = intervalCalc.endHourStr;

  // Use actual recorded database telemetry readings (e.g. 1926 kWh at End Hour - 1587 kWh at Start Hour)
  const hasTelemetryDelta = telemetryRange && telemetryRange.startReading !== null && telemetryRange.endReading !== null;
  const openReading = hasTelemetryDelta
    ? Number(telemetryRange.startReading!.toFixed(2))
    : Number((Math.max(0, (invoice.kwh_reading || 0) - intervalCalc.kwh)).toFixed(2));
  const closeReading = hasTelemetryDelta
    ? Number(telemetryRange.endReading!.toFixed(2))
    : Number((invoice.kwh_reading || 0).toFixed(2));

  // Subtraction formula: Close Read (End Hour) - Open Read (Start Hour) = Billed Consumption
  const kwhAmount = Number(Math.max(0, closeReading - openReading).toFixed(3));

  const effectiveRate = invoice.rate_per_kwh || ratePerKwh || 0.15;
  const electricityCost = Number((kwhAmount * effectiveRate).toFixed(2));
  const demandCharge = Number(((invoice.demand_charge || 0) * intervalCalc.fraction).toFixed(2));
  const totalCostUsd = Number((electricityCost + demandCharge).toFixed(2));




  // Direct PDF Download generation using jsPDF with exact logo image
  const handleExportPdf = () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);

    const fileName = `Tenant_Bill_Summary_${invoice.invoice_number}_${fromDate}_to_${toDate}.pdf`;

    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Background clean white
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, 210, 297, 'F');

      // ── Top Left: Exact Intersys Solutions Logo Image ──
      try {
        pdf.addImage(INTERSYS_LOGO_BASE64, 'PNG', 14, 12, 44, 14, undefined, 'FAST');
      } catch {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(18);
        pdf.setTextColor(20, 25, 30);
        pdf.text('INTERSYS', 14, 22);
        pdf.setTextColor(0, 164, 228);
        pdf.text('SOLUTIONS', 52, 22);
      }

      // ── Tenant Details (Left) ──
      pdf.setFontSize(9.5);
      pdf.setTextColor(40, 40, 40);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Invoice No: ', 14, 38);
      pdf.setFont('helvetica', 'normal');
      pdf.text(invoice.invoice_number.replace('INV-', ''), 36, 38);


      pdf.setFont('helvetica', 'bold');
      pdf.text('Tenant: ', 14, 44);
      pdf.setFont('helvetica', 'normal');
      pdf.text(invoice.tenant_name, 36, 44);

      pdf.setFont('helvetica', 'bold');
      pdf.text('Suite: ', 14, 50);
      pdf.setFont('helvetica', 'normal');
      pdf.text(invoice.unit_zone, 36, 50);

      pdf.setFont('helvetica', 'bold');
      pdf.text('Address: ', 14, 56);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Street 598, Phnom Penh', 36, 56);

      // ── Top Right: Title & Dates ──
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(22);
      pdf.setTextColor(30, 35, 45);
      pdf.text('Tenant Bill Summary', 196, 22, { align: 'right' });

      pdf.setFontSize(9.5);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Bill From:  ${fromDate}`, 196, 38, { align: 'right' });
      pdf.text(`Bill To:  ${toDate}`, 196, 44, { align: 'right' });
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Duration:  ${durationHours.toFixed(2)} hrs (${endHourStr} - ${startHourStr})`, 196, 50, { align: 'right' });
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Date Raised:  ${todayFormatted}`, 196, 56, { align: 'right' });

      // ── Section 1: Meter Information ──
      const yMeter = 68;

      pdf.setFillColor(158, 162, 169); // #9ea2a9
      pdf.rect(14, yMeter, 182, 6.5, 'F');
      pdf.setFont('helvetica', 'bolditalic');
      pdf.setFontSize(9.5);
      pdf.setTextColor(20, 20, 20);
      pdf.text('Meter Information', 16, yMeter + 4.8);

      // Table Headers
      const yMeterHead = yMeter + 11;
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(8.5);
      pdf.setTextColor(70, 70, 70);
      pdf.text('Meter Name', 16, yMeterHead);
      pdf.text('Serial No', 60, yMeterHead);
      pdf.text('From Date', 100, yMeterHead);
      pdf.text('To Date', 130, yMeterHead);
      pdf.text('Open Read', 165, yMeterHead, { align: 'right' });
      pdf.text('Close Read', 194, yMeterHead, { align: 'right' });

      // Table Row
      const yMeterRow = yMeterHead + 6;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(20, 20, 20);
      pdf.text(invoice.meter_name, 16, yMeterRow);
      pdf.text(`EDBRG-${invoice.meter_name.slice(0, 8)}`, 60, yMeterRow);
      pdf.text(fromDate, 100, yMeterRow);
      pdf.text(toDate, 130, yMeterRow);
      pdf.text(openReading.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 165, yMeterRow, { align: 'right' });
      pdf.text(closeReading.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 194, yMeterRow, { align: 'right' });

      // ── Section 2: Billing Charges ──
      const yCharges = yMeterRow + 10;
      pdf.setFillColor(230, 232, 235); // #e6e8eb
      pdf.rect(14, yCharges, 182, 6.5, 'F');
      pdf.setFont('helvetica', 'bolditalic');
      pdf.setFontSize(9.5);
      pdf.setTextColor(20, 20, 20);
      pdf.text('Billing Charges', 16, yCharges + 4.8);

      // Charges Table Headers
      const yChargeHead = yCharges + 11;
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(8.5);
      pdf.setTextColor(70, 70, 70);
      pdf.text('Item Name', 16, yChargeHead);
      pdf.text('Quantity', 80, yChargeHead, { align: 'right' });
      pdf.text('Units', 100, yChargeHead, { align: 'center' });
      pdf.text('Unit Price', 135, yChargeHead, { align: 'right' });
      pdf.text('Units', 155, yChargeHead, { align: 'center' });
      pdf.text('Price', 194, yChargeHead, { align: 'right' });

      // Charges Row: Electricity
      let yChargeRow = yChargeHead + 6;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(20, 20, 20);
      pdf.text(`Electricity (${durationHours.toFixed(2)} hrs)`, 16, yChargeRow);
      pdf.text(
        kwhAmount.toLocaleString('en-US', {
          minimumFractionDigits: 3,
          maximumFractionDigits: 3,
        }),
        80,
        yChargeRow,
        { align: 'right' }
      );
      pdf.text('kWh', 100, yChargeRow, { align: 'center' });
      pdf.text(`$ ${effectiveRate.toFixed(5)}`, 135, yChargeRow, { align: 'right' });
      pdf.text('$/kWh', 155, yChargeRow, { align: 'center' });
      pdf.text(`$ ${electricityCost.toFixed(2)}`, 194, yChargeRow, { align: 'right' });


      if (demandCharge > 0) {
        yChargeRow += 6;
        pdf.text('Demand Base Charge', 16, yChargeRow);
        pdf.text('1.00', 80, yChargeRow, { align: 'right' });
        pdf.text('Month', 100, yChargeRow, { align: 'center' });
        pdf.text(`$ ${demandCharge.toFixed(2)}`, 135, yChargeRow, { align: 'right' });
        pdf.text('$/Mo', 155, yChargeRow, { align: 'center' });
        pdf.text(`$ ${demandCharge.toFixed(2)}`, 194, yChargeRow, { align: 'right' });
      }

      // Net Total Row
      yChargeRow += 7;
      pdf.setFillColor(233, 234, 238);
      pdf.rect(14, yChargeRow - 4.5, 182, 6, 'F');
      pdf.setFont('helvetica', 'normal');
      pdf.text('Net Total', 16, yChargeRow);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`$ ${totalCostUsd.toFixed(2)}`, 194, yChargeRow, { align: 'right' });

      // Total Row
      yChargeRow += 6;
      pdf.setFillColor(233, 234, 238);
      pdf.rect(14, yChargeRow - 4.5, 182, 6, 'F');
      pdf.setFont('helvetica', 'normal');
      pdf.text('Total', 16, yChargeRow);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`$ ${totalCostUsd.toFixed(2)}`, 194, yChargeRow, { align: 'right' });

      // ── Section 3: Bill Total Bar ──
      const yTotalBar = yChargeRow + 14;
      pdf.setFillColor(158, 162, 169); // #9ea2a9
      pdf.rect(14, yTotalBar, 182, 8.5, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(15, 15, 15);
      pdf.text('Bill Total', 16, yTotalBar + 5.8);
      pdf.text(`$ ${totalCostUsd.toFixed(2)}`, 194, yTotalBar + 5.8, { align: 'right' });

      // Footer note
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(8.5);
      pdf.setTextColor(100, 100, 100);
      pdf.text('** This is auto generated / computerised bill **', 105, yTotalBar + 16, {
        align: 'center',
      });

      // Save PDF directly to PC
      pdf.save(fileName);
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xs overflow-y-auto select-none print-document">
      {/* Container Box */}
      <div className="w-full max-w-3xl my-auto flex flex-col items-center">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="w-full flex items-center justify-between px-4 py-2.5 mb-2 bg-[#202227] border border-[#2d3038] rounded no-print">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Tenant Bill Preview
            </span>
            <span className="text-[11px] font-mono text-cyan-400">
              {invoice.invoice_number}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#00a4e4] hover:bg-[#0092cc] text-white font-medium rounded text-xs transition cursor-pointer shadow-sm disabled:opacity-60"
              title="Download Tenant Bill directly as PDF"
            >
              {isExportingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>Download PDF</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white transition cursor-pointer ml-1"
              title="Close Preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Bill Paper (Matches Exact Design from Screenshot) ── */}
        <div
          ref={printRef}
          className="w-full bg-white text-slate-900 rounded-sm p-8 sm:p-10 shadow-2xl font-sans print-document"
          style={{ minHeight: '680px' }}
        >
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pb-4">
            {/* Left: Brand Logo & Tenant Info */}
            <div className="flex flex-col items-start">
              {/* Header Intersys Logo matching exact Header branding */}
              <div className="mb-4 flex items-center">
                <img
                  src={INTERSYS_LOGO_BASE64}
                  alt="Intersys Solutions"
                  className="h-12 sm:h-14 w-auto object-contain"
                />
              </div>




              {/* Invoice & Tenant Details */}
              <div className="space-y-0.5 text-xs text-slate-900">
                <div className="font-semibold text-[13px]">
                  <span>Invoice No: </span>
                  <span className="font-bold">{invoice.invoice_number.replace('INV-', '')}</span>
                </div>
                <div className="font-semibold text-[13px]">
                  <span>Tenant: </span>
                  <span className="font-bold">{invoice.tenant_name}</span>
                </div>
                <div className="font-semibold text-[13px]">
                  <span>Suite: </span>
                  <span className="font-bold">{invoice.unit_zone}</span>
                </div>
                <div className="font-semibold text-[13px]">
                  <span>Address: </span>
                  <span className="font-bold">Street 598, Phnom Penh</span>
                </div>
              </div>
            </div>



            {/* Right: Bill Title & Dates */}
            <div className="flex flex-col items-start sm:items-end text-left sm:text-right">
              <h1 className="text-2xl sm:text-[28px] font-normal text-slate-800 tracking-tight mb-4">
                Tenant Bill Summary
              </h1>

              <div className="space-y-0.5 text-xs text-slate-900">
                <div className="font-bold text-[13px]">
                  <span className="font-bold">Bill From: </span>
                  <span>{fromDate}</span>
                </div>
                <div className="font-bold text-[13px]">
                  <span className="font-bold">Bill To: </span>
                  <span>{toDate}</span>
                </div>
                <div className="text-[12px] font-mono text-cyan-800">
                  <span className="font-bold">Duration: </span>
                  <span>{durationHours.toFixed(2)} hrs ({endHourStr} − {startHourStr})</span>
                </div>
                <div className="font-bold text-[13px]">
                  <span className="font-bold">Date Raised: </span>
                  <span>{todayFormatted}</span>
                </div>
              </div>
            </div>
          </div>


          {/* ── Section 1: Meter Information ── */}
          <div className="mt-4">
            {/* Grey Banner */}
            <div className="bg-[#9ea2a9] px-3 py-1 text-slate-900 text-xs font-bold italic tracking-wide">
              Meter Information
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs mt-1">
                <thead>
                  <tr className="text-slate-800 italic font-medium">
                    <th className="py-1.5 px-3 font-medium">Meter Name</th>
                    <th className="py-1.5 px-3 font-medium">Serial No</th>
                    <th className="py-1.5 px-3 font-medium">From Date</th>
                    <th className="py-1.5 px-3 font-medium">To Date</th>
                    <th className="py-1.5 px-3 font-medium text-right">Open Read</th>
                    <th className="py-1.5 px-3 font-medium text-right">Close Read</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="text-slate-900 font-normal">
                    <td className="py-1.5 px-3 font-medium">{invoice.meter_name}</td>
                    <td className="py-1.5 px-3">EDBRG-{invoice.meter_name.slice(0, 8)}</td>
                    <td className="py-1.5 px-3">{fromDate}</td>
                    <td className="py-1.5 px-3">{toDate}</td>
                    <td className="py-1.5 px-3 text-right">
                      {openReading.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-1.5 px-3 text-right">
                      {closeReading.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Section 2: Billing Charges ── */}
          <div className="mt-4">
            {/* Light Grey Banner */}
            <div className="bg-[#e6e8eb] px-3 py-1 text-slate-900 text-xs font-bold italic tracking-wide">
              Billing Charges
            </div>

            {/* Charges Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs mt-1">
                <thead>
                  <tr className="text-slate-800 italic font-medium">
                    <th className="py-1.5 px-3 font-medium w-1/4">Item Name</th>
                    <th className="py-1.5 px-3 font-medium text-right">Quantity</th>
                    <th className="py-1.5 px-3 font-medium text-center">Units</th>
                    <th className="py-1.5 px-3 font-medium text-right">Unit Price</th>
                    <th className="py-1.5 px-3 font-medium text-center">Units</th>
                    <th className="py-1.5 px-3 font-medium text-right">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Electricity Charge */}
                  <tr className="text-slate-900">
                    <td className="py-1.5 px-3 font-medium">
                      Electricity ({durationHours.toFixed(2)} hrs: {endHourStr} − {startHourStr})
                    </td>
                    <td className="py-1.5 px-3 text-right">
                      {kwhAmount.toLocaleString('en-US', {
                        minimumFractionDigits: 3,
                        maximumFractionDigits: 3,
                      })}
                    </td>
                    <td className="py-1.5 px-3 text-center">kWh</td>
                    <td className="py-1.5 px-3 text-right">
                      $ {effectiveRate.toFixed(5)}
                    </td>
                    <td className="py-1.5 px-3 text-center">$/kWh</td>
                    <td className="py-1.5 px-3 text-right font-medium">
                      $ {electricityCost.toFixed(2)}
                    </td>
                  </tr>


                  {/* Demand Fee if exists */}
                  {demandCharge > 0 && (
                    <tr className="text-slate-900">
                      <td className="py-1.5 px-3 font-medium">Demand Base Charge</td>
                      <td className="py-1.5 px-3 text-right">1.00</td>
                      <td className="py-1.5 px-3 text-center">Month</td>
                      <td className="py-1.5 px-3 text-right">
                        $ {demandCharge.toFixed(2)}
                      </td>
                      <td className="py-1.5 px-3 text-center">$/Mo</td>
                      <td className="py-1.5 px-3 text-right font-medium">
                        $ {demandCharge.toFixed(2)}
                      </td>
                    </tr>
                  )}

                  {/* Net Total Row */}
                  <tr className="bg-[#e9eaee] text-slate-900 font-medium">
                    <td colSpan={5} className="py-1.5 px-3 font-normal">
                      Net Total
                    </td>
                    <td className="py-1.5 px-3 text-right font-semibold">
                      $ {totalCostUsd.toFixed(2)}
                    </td>
                  </tr>

                  {/* Total Row */}
                  <tr className="bg-[#e9eaee] text-slate-900 font-medium">
                    <td colSpan={5} className="py-1.5 px-3 font-normal">
                      Total
                    </td>
                    <td className="py-1.5 px-3 text-right font-semibold">
                      $ {totalCostUsd.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Section 3: Bill Total Full Bar ── */}
          <div className="mt-8">
            <div className="bg-[#9ea2a9] px-4 py-2 text-slate-900 font-bold text-sm flex items-center justify-between">
              <span>Bill Total</span>
              <span className="text-sm font-black">$ {totalCostUsd.toFixed(2)}</span>
            </div>

            {/* Footer computer generated note */}
            <div className="text-center text-[11px] text-slate-700 italic mt-3">
              ** This is auto generated / computerised bill **
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
