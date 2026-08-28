/**
 * Export table data to CSV file formatted for Microsoft Excel
 */
export function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  // UTF-8 Byte Order Mark (BOM) to ensure Excel opens UTF-8 symbols cleanly
  const bom = '\uFEFF';
  const csvLines = [
    headers.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(','),
    ...rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')),
  ];

  const csvContent = bom + csvLines.join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
