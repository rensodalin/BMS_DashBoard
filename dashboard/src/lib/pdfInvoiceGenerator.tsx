import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import type { TenantInvoiceDb } from '../types/bms';
import { TenantBillSheet, calculateTenantBillValues } from '../components/billing/TenantBillSheet';
import { fetchMeterReadingRange } from './supabase';
import { INTERSYS_LOGO_BASE64 } from '../assets/logoBase64';

/**
 * Derives dynamic account number from invoice digits matching format: 62-2103-XXXX-0000-7
 */
export function getInvoiceAccountNumber(invoiceNumber: string): string {
  const cleanDigits = (invoiceNumber.replace(/\D/g, '') || '1685').padEnd(4, '0').slice(-4);
  return `62-2103-${cleanDigits}-0000-7`;
}

/**
 * Fallback vector jsPDF builder for non-DOM / headless environments
 * Also includes the Intersys company logo and complete statement summary
 */
export function buildInvoiceJsPdfVector(
  inv: TenantInvoiceDb,
  globalStartDate?: string,
  globalEndDate?: string,
  ratePerKwh?: number,
  telemetryRange?: {
    startReading: number | null;
    endReading: number | null;
    deltaKwh: number | null;
  } | null
): jsPDF {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = 210;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const billValues = calculateTenantBillValues(
    inv,
    telemetryRange,
    ratePerKwh,
    globalStartDate,
    globalEndDate
  );

  const accountNumber = billValues.accountNumber;
  const billingPeriodStr = billValues.billingPeriodStr;
  const payByDateStr = billValues.payByDateStr;
  const totalDue = billValues.totalAmountDue;
  const rateVal = billValues.effectiveRate;
  const kwhConsumed = billValues.kwhAmount;

  // Top Decorative Brand Bar
  pdf.setFillColor(0, 90, 135);
  pdf.rect(0, 0, pageWidth, 5, 'F');

  let y = 14;

  // Try to render the authentic Intersys Logo image
  try {
    pdf.addImage(INTERSYS_LOGO_BASE64, 'PNG', margin, y - 2, 42, 11);
  } catch {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.setTextColor(0, 54, 82);
    pdf.text('INTERSYS SOLUTIONS', margin, y + 6);
  }

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(90, 100, 115);
  pdf.text('Energy Management & Intelligent Utility Sub-Metering', margin, y + 13);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(0, 164, 228);
  pdf.text('UTILITY STATEMENT', pageWidth - margin, y + 2, { align: 'right' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(100, 110, 125);
  pdf.text(`Invoice Ref: ${inv.invoice_number}`, pageWidth - margin, y + 7, { align: 'right' });

  y += 18;
  pdf.setDrawColor(220, 226, 235);
  pdf.setLineWidth(0.4);
  pdf.line(margin, y, pageWidth - margin, y);

  y += 6;
  const boxWidth = contentWidth;
  const boxHeight = 22;

  pdf.setFillColor(0, 90, 135);
  pdf.rect(margin, y, boxWidth - 55, boxHeight, 'F');

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(215, 235, 250);
  pdf.text('CURRENT BALANCE DUE', margin + 7, y + 7.5);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.setTextColor(255, 255, 255);
  pdf.text(`$${totalDue.toFixed(2)}`, margin + 7, y + 16.5);

  pdf.setFillColor(0, 54, 82);
  pdf.rect(margin + boxWidth - 55, y, 55, boxHeight, 'F');

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(190, 220, 245);
  pdf.text('PAY BY DATE', margin + boxWidth - 50, y + 7.5);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(255, 255, 255);
  pdf.text(payByDateStr, margin + boxWidth - 50, y + 16);

  y += boxHeight + 8;
  const colW = (contentWidth - 6) / 2;

  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(margin, y, colW, 30, 2, 2, 'FD');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text('CUSTOMER ACCOUNT INFORMATION', margin + 5, y + 6);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.setTextColor(15, 23, 42);
  pdf.text((inv.tenant_name || 'Valued Tenant').toUpperCase(), margin + 5, y + 13);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(51, 65, 85);
  pdf.text(`Account No: ${accountNumber}`, margin + 5, y + 19);
  pdf.text(`Unit / Space: ${inv.unit_zone || 'Commercial Unit'}`, margin + 5, y + 24.5);

  pdf.roundedRect(margin + colW + 6, y, colW, 30, 2, 2, 'FD');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text('BILLING PERIOD & FACILITY', margin + colW + 11, y + 6);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(51, 65, 85);
  pdf.text(`Billing Period: ${billingPeriodStr}`, margin + colW + 11, y + 12.5);
  pdf.text(`Sub-meter: ${inv.meter_name || 'Primary Meter'}`, margin + colW + 11, y + 18);
  pdf.text('Facility: Intersys Building A - Street 598', margin + colW + 11, y + 24.5);

  y += 38;

  pdf.setFillColor(0, 90, 135);
  pdf.rect(margin, y, contentWidth, 7, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(255, 255, 255);
  pdf.text('ITEMIZED UTILITY CHARGES', margin + 4, y + 5);

  y += 7;
  pdf.setFillColor(241, 245, 249);
  pdf.rect(margin, y, contentWidth, 6, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(71, 85, 105);
  pdf.text('Description', margin + 4, y + 4.2);
  pdf.text('Usage / Hours', margin + 80, y + 4.2);
  pdf.text('Rate', margin + 125, y + 4.2);
  pdf.text('Amount (USD)', pageWidth - margin - 4, y + 4.2, { align: 'right' });

  y += 6;
  const costEnergy = kwhConsumed * rateVal;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text(`Electricity Consumption (${inv.meter_name || 'Meter'})`, margin + 4, y + 6);
  pdf.text(`${kwhConsumed.toFixed(2)} kWh`, margin + 80, y + 6);
  pdf.text(`$${rateVal.toFixed(4)}`, margin + 125, y + 6);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`$${costEnergy.toFixed(2)}`, pageWidth - margin - 4, y + 6, { align: 'right' });

  y += 10;
  pdf.setDrawColor(226, 232, 240);
  pdf.line(margin, y, pageWidth - margin, y);

  if ((inv.demand_charge || 0) > 0) {
    y += 2;
    pdf.setFont('helvetica', 'normal');
    pdf.text('Demand Baseline Capacity Fee', margin + 4, y + 5);
    pdf.text('1.00 Unit', margin + 80, y + 5);
    pdf.text(`$${(inv.demand_charge || 0).toFixed(2)}`, margin + 125, y + 5);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`$${(inv.demand_charge || 0).toFixed(2)}`, pageWidth - margin - 4, y + 5, { align: 'right' });
    y += 9;
    pdf.line(margin, y, pageWidth - margin, y);
  }

  y += 5;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(0, 90, 135);
  pdf.text('TOTAL AMOUNT DUE:', pageWidth - margin - 50, y + 4, { align: 'right' });
  pdf.setFontSize(12);
  pdf.text(`$${totalDue.toFixed(2)}`, pageWidth - margin - 4, y + 4, { align: 'right' });

  return pdf;
}

/**
 * Creates an authentic, 1:1 pixel-perfect A4 PDF matching the Billing Summary screen exactly
 * (with Intersys company logo, solid pie chart, daily bar chart, and remittance coupon).
 */
export async function createInvoicePdf(
  invoice: TenantInvoiceDb,
  startDate?: string,
  endDate?: string,
  ratePerKwh?: number,
  sourceElement?: HTMLElement | null,
  telemetryRange?: {
    startReading: number | null;
    endReading: number | null;
    deltaKwh: number | null;
  } | null
): Promise<jsPDF> {
  let activeTelemetryRange = telemetryRange;
  const startIso = invoice.start_date || startDate;
  const endIso = invoice.end_date || endDate;
  const meterName = invoice.meter_name || invoice.tenant_name;

  // If telemetryRange was not provided, fetch it asynchronously so PDF readings are 100% accurate
  if (!activeTelemetryRange && meterName && startIso && endIso) {
    try {
      activeTelemetryRange = await fetchMeterReadingRange(meterName, startIso, endIso);
    } catch (err) {
      console.warn('Telemetry range fetch in createInvoicePdf notice:', err);
    }
  }

  const effectiveRate = ratePerKwh || invoice.rate_per_kwh || 0.155;

  try {
    if (typeof document !== 'undefined') {
      // 1. If an explicit sourceElement is provided (e.g. user clicked Download in TenantInvoiceSummaryModal and passed printRef.current)
      if (sourceElement && sourceElement.offsetHeight > 100) {
        try {
          const canvas = await html2canvas(sourceElement, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            scrollX: 0,
            scrollY: -window.scrollY,
            windowWidth: 1280,
            windowHeight: Math.max(sourceElement.scrollHeight, 1200),
            onclone: (clonedDoc) => {
              const clonedElement = clonedDoc.getElementById('conedison-bill-sheet') || clonedDoc.body;
              if (clonedElement) {
                clonedElement.style.boxShadow = 'none';
                clonedElement.style.borderRadius = '0';
                clonedElement.style.border = 'none';

                // Lift all ancestors out of modal overlays so backdrop-filter & overflow don't crash html2canvas
                let parent = clonedElement.parentElement;
                while (parent) {
                  try {
                    parent.style.overflow = 'visible';
                    parent.style.maxHeight = 'none';
                    parent.style.backdropFilter = 'none';
                    if (parent.style && 'webkitBackdropFilter' in parent.style) {
                      (parent.style as CSSStyleDeclaration & { webkitBackdropFilter: string }).webkitBackdropFilter = 'none';
                    }
                    parent.style.background = 'transparent';
                  } catch {
                    // ignore
                  }
                  parent = parent.parentElement;
                }
              }

              // Ensure SVGs have width & height attributes for html2canvas
              clonedDoc.querySelectorAll('svg').forEach((svg) => {
                try {
                  const rect = svg.getBoundingClientRect();
                  if (rect.width > 0) svg.setAttribute('width', `${Math.ceil(rect.width)}`);
                  if (rect.height > 0) svg.setAttribute('height', `${Math.ceil(rect.height)}`);
                } catch {
                  // ignore
                }
              });
            },
          });

          if (canvas && canvas.width > 100 && canvas.height > 100) {
            return buildPdfFromCanvas(canvas);
          }
        } catch (err) {
          console.warn('Explicit sourceElement capture failed, attempting offscreen render:', err);
        }
      }

      // 2. Offscreen render container placed safely within document bounds (No flushSync!)
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.top = '0px';
      container.style.left = '0px';
      container.style.width = '840px';
      container.style.minHeight = '1180px';
      container.style.zIndex = '-99999';
      container.style.backgroundColor = '#ffffff';
      container.style.pointerEvents = 'none';
      container.style.visibility = 'visible';
      container.style.opacity = '1';
      document.body.appendChild(container);

      let root: ReturnType<typeof createRoot> | null = null;
      try {
        const offscreenBillId = `offscreen-bill-${invoice.invoice_number.replace(/\W/g, '')}`;
        root = createRoot(container);
        root.render(
          <TenantBillSheet
            invoice={{
              ...invoice,
              start_date: startIso || invoice.start_date,
              end_date: endIso || invoice.end_date,
            }}
            ratePerKwh={effectiveRate}
            telemetryRange={activeTelemetryRange}
            id={offscreenBillId}
          />
        );

        // Allow SVGs and images to decode and render in DOM safely without flushSync
        await new Promise((resolve) => setTimeout(resolve, 350));

        const billElement = (container.querySelector(`#${offscreenBillId}`) as HTMLElement) || container;

        // Ensure all images are fully loaded before capturing
        const images = billElement.querySelectorAll('img');
        await Promise.all(
          Array.from(images).map((img) => {
            if (img.complete) return Promise.resolve();
            return new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            });
          })
        );

        // Ensure SVGs have width & height attributes for html2canvas
        billElement.querySelectorAll('svg').forEach((svg) => {
          try {
            const rect = svg.getBoundingClientRect();
            if (rect.width > 0) svg.setAttribute('width', `${Math.ceil(rect.width)}`);
            if (rect.height > 0) svg.setAttribute('height', `${Math.ceil(rect.height)}`);
          } catch {
            // ignore
          }
        });

        const canvas = await html2canvas(billElement, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 1280,
          windowHeight: Math.max(billElement.scrollHeight, 1200),
        });

        if (canvas && canvas.width > 100 && canvas.height > 100) {
          return buildPdfFromCanvas(canvas);
        }
      } catch (err) {
        console.warn('html2canvas offscreen capture failed, falling back to vector PDF:', err);
      } finally {
        try {
          if (root) root.unmount();
        } catch {
          // ignore unmount errors
        }
        if (container.parentElement) {
          container.remove();
        }
      }
    }
  } catch (outerErr) {
    console.warn('createInvoicePdf outer error, falling back to vector PDF:', outerErr);
  }

  return buildInvoiceJsPdfVector(invoice, startIso, endIso, effectiveRate, activeTelemetryRange);
}

/**
 * Builds standard A4 jsPDF instance from captured canvas.
 * Scales single-page statements cleanly into A4 printable dimensions with margins.
 * For multi-page statements, slices cleanly using separate page canvases with no negative coordinates.
 */
function buildPdfFromCanvas(canvas: HTMLCanvasElement): jsPDF {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = 210; // A4 standard width in mm
  const pageHeight = 297; // A4 standard height in mm
  const margin = 6; // 6mm margin around statement
  const printableWidth = pageWidth - margin * 2; // 198mm
  const printableHeight = pageHeight - margin * 2; // 285mm

  const imgHeightMm = (canvas.height * printableWidth) / canvas.width;

  // Single-page fit: if statement height is within 15% of single A4 page,
  // scale it to fit 1 page perfectly. This preserves the authentic single-page bill layout.
  if (imgHeightMm <= printableHeight * 1.15) {
    const scale = Math.min(printableWidth / canvas.width, printableHeight / canvas.height);
    const renderWidth = canvas.width * scale;
    const renderHeight = canvas.height * scale;
    const xOffset = margin + (printableWidth - renderWidth) / 2;
    const yOffset = margin + (printableHeight - renderHeight) / 2;

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    pdf.addImage(imgData, 'JPEG', xOffset, yOffset, renderWidth, renderHeight, undefined, 'FAST');
    return pdf;
  }

  // Multi-page slicing using discrete page canvases (strictly no negative Y coordinate bugs)
  const pxPerPage = (canvas.width * printableHeight) / printableWidth;
  let currentSrcY = 0;
  let pageIndex = 0;

  while (currentSrcY < canvas.height) {
    if (pageIndex > 0) {
      pdf.addPage();
    }

    const sliceHeightPx = Math.min(pxPerPage, canvas.height - currentSrcY);
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceHeightPx;
    const ctx = sliceCanvas.getContext('2d');

    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      ctx.drawImage(
        canvas,
        0,
        currentSrcY,
        canvas.width,
        sliceHeightPx,
        0,
        0,
        canvas.width,
        sliceHeightPx
      );
      const sliceImgData = sliceCanvas.toDataURL('image/jpeg', 0.95);
      const sliceHeightMm = (sliceHeightPx * printableWidth) / canvas.width;
      pdf.addImage(sliceImgData, 'JPEG', margin, margin, printableWidth, sliceHeightMm, undefined, 'FAST');
    }

    currentSrcY += sliceHeightPx;
    pageIndex++;
  }

  return pdf;
}

/**
 * Returns clean Base64 PDF string for automated background email attachments
 */
export async function getInvoicePdfBase64(
  invoice: TenantInvoiceDb,
  startDate?: string,
  endDate?: string,
  ratePerKwh?: number,
  telemetryRange?: {
    startReading: number | null;
    endReading: number | null;
    deltaKwh: number | null;
  } | null
): Promise<string> {
  const pdf = await createInvoicePdf(invoice, startDate, endDate, ratePerKwh, null, telemetryRange);
  const dataUri = pdf.output('datauristring');
  const base64 = dataUri.split(',')[1];
  return base64;
}

/**
 * Triggers a direct browser download of the exact utility bill PDF
 */
export async function downloadInvoicePdf(
  invoice: TenantInvoiceDb,
  startDate?: string,
  endDate?: string,
  ratePerKwh?: number,
  sourceElement?: HTMLElement | null,
  telemetryRange?: {
    startReading: number | null;
    endReading: number | null;
    deltaKwh: number | null;
  } | null
): Promise<void> {
  try {
    const pdf = await createInvoicePdf(invoice, startDate, endDate, ratePerKwh, sourceElement, telemetryRange);
    const cleanTenantName = (invoice.tenant_name || 'Tenant').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `Intersys_Utility_Bill_${invoice.invoice_number}_${cleanTenantName}.pdf`;
    pdf.save(fileName);
  } catch (err) {
    console.warn('downloadInvoicePdf fallback to vector PDF:', err);
    const fallbackPdf = buildInvoiceJsPdfVector(invoice, startDate, endDate, ratePerKwh, telemetryRange);
    const cleanTenantName = (invoice.tenant_name || 'Tenant').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `Intersys_Utility_Bill_${invoice.invoice_number}_${cleanTenantName}.pdf`;
    fallbackPdf.save(fileName);
  }
}
