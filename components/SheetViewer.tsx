import React from 'react';

declare const XLSX: any;

interface SheetViewerProps {
  sheet: any;
  onFormulaClick: (formula: string) => void;
}

const SheetViewer: React.FC<SheetViewerProps> = ({ sheet, onFormulaClick }) => {
  if (!sheet || !sheet['!ref']) {
    return <div className="p-4 text-center">لا توجد بيانات لعرضها.</div>;
  }

  const range = XLSX.utils.decode_range(sheet['!ref']);
  const rows = [];

  for (let R = range.s.r; R <= range.e.r; ++R) {
    const row = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = { c: C, r: R };
      const cellRef = XLSX.utils.encode_cell(cellAddress);
      const cell = sheet[cellRef];
      row.push(cell);
    }
    rows.push(row);
  }

  const headers = rows.length > 0 ? rows[0] : [];
  const dataRows = rows.length > 1 ? rows.slice(1) : (headers.some(h => h) ? [] : [headers]);


  return (
    <div className="overflow-auto border dark:border-slate-700 rounded-lg max-h-[70vh] bg-white dark:bg-slate-800">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-right">
        <thead className="bg-slate-50 dark:bg-slate-700 sticky top-0 z-10">
          <tr>
            {headers.map((header, index) => (
              <th key={index} scope="col" className="px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                {header ? XLSX.utils.format_cell(header) : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
          {dataRows.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
              {row.map((cell, colIndex) => (
                <td key={colIndex} className="px-6 py-4 whitespace-nowrap text-sm text-slate-800 dark:text-slate-200">
                  <div className="flex items-center justify-end gap-2">
                    {cell ? XLSX.utils.format_cell(cell) : ''}
                    {cell && cell.f && (
                       <button 
                         onClick={() => onFormulaClick(cell.f)} 
                         title="شرح هذه الصيغة"
                         className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                       >
                         <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 14.7 9 20l-4-4 5.7-5.7"/><path d="m14.5 5.5 5.5 5.5"/><path d="M12 22h8a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v8"/></svg>
                       </button>
                    )}
                   </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SheetViewer;