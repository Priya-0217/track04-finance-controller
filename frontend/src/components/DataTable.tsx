import React, { useState, useMemo } from 'react';
import { Skeleton } from './Skeleton';

export interface Column<T> {
  key: string;
  header: string;
  accessor?: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  className?: string;
  sortValue?: (row: T) => string | number;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string;
  isLoading?: boolean;
  pageSize?: number;
  emptyMessage?: string;
  defaultSortKey?: string;
  defaultSortAsc?: boolean;
  caption?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  pageSize = 25,
  emptyMessage = 'No records found.',
  defaultSortKey,
  defaultSortAsc = true,
  caption,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | undefined>(defaultSortKey || columns[0]?.key);
  const [sortAsc, setSortAsc] = useState<boolean>(defaultSortAsc);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Sorting
  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col || !col.sortable) return data;

    const copy = [...data];
    copy.sort((a, b) => {
      let valA: string | number | undefined;
      let valB: string | number | undefined;

      if (col.sortValue) {
        valA = col.sortValue(a);
        valB = col.sortValue(b);
      } else {
        const rawA = (a as Record<string, unknown>)[col.key];
        const rawB = (b as Record<string, unknown>)[col.key];
        valA = typeof rawA === 'number' || typeof rawA === 'string' ? rawA : String(rawA ?? '');
        valB = typeof rawB === 'number' || typeof rawB === 'string' ? rawB : String(rawB ?? '');
      }

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA === undefined || valA === null) return sortAsc ? -1 : 1;
      if (valB === undefined || valB === null) return sortAsc ? 1 : -1;

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return copy;
  }, [data, sortKey, sortAsc, columns]);

  // Pagination
  const total = sortedData.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const validPage = Math.min(Math.max(currentPage, 1), totalPages);

  const paginatedData = useMemo(() => {
    const start = (validPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, validPage, pageSize]);

  const handleHeaderClick = (col: Column<T>) => {
    if (!col.sortable) return;
    if (sortKey === col.key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(col.key);
      setSortAsc(true);
    }
  };

  return (
    <div className="card-box overflow-hidden">
      {caption && <div className="sr-only">{caption}</div>}

      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 border-b border-gray-100 font-mono text-gray-500 select-none">
            <tr>
              {columns.map((col) => {
                const alignClass =
                  col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';
                return (
                  <th
                    key={col.key}
                    scope="col"
                    onClick={() => handleHeaderClick(col)}
                    className={`p-3 ${alignClass} ${col.sortable ? 'cursor-pointer hover:text-black transition' : ''} ${col.className || ''}`}
                  >
                    <div className={`inline-flex items-center space-x-1 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'}`}>
                      <span>{col.header}</span>
                      {col.sortable && (
                        <span className="text-[10px] text-gray-400">
                          {sortKey === col.key ? (sortAsc ? ' ▲' : ' ▼') : ' ⇅'}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, rIdx) => (
                <tr key={`skel-row-${rIdx}`} className="p-3">
                  {columns.map((_, cIdx) => (
                    <td key={`skel-cell-${cIdx}`} className="p-3">
                      <Skeleton height="14px" width="80%" />
                    </td>
                  ))}
                </tr>
              ))
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-6 text-center text-gray-400 font-mono">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, idx) => (
                <tr
                  key={keyExtractor(row, idx)}
                  className="hover:bg-gray-50/80 transition"
                >
                  {columns.map((col) => {
                    const alignClass =
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';
                    const cellContent = col.accessor
                      ? col.accessor(row)
                      : (row as Record<string, unknown>)[col.key] as React.ReactNode;

                    return (
                      <td key={col.key} className={`p-3 ${alignClass} ${col.className || ''}`}>
                        {cellContent}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {!isLoading && total > pageSize && (
        <div className="p-3 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs font-mono text-gray-500">
          <div>
            Showing {(validPage - 1) * pageSize + 1}–{Math.min(validPage * pageSize, total)} of {total} records
          </div>
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={validPage <= 1}
              className="px-2.5 py-1 rounded bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Prev
            </button>
            <span className="px-2 font-bold text-gray-800">
              {validPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={validPage >= totalPages}
              className="px-2.5 py-1 rounded bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
