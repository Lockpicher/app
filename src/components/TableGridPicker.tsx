import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Editor } from '@tiptap/react';
import {
  Grid3X3,
  Table as TableIcon,
  Rows,
  Columns,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  PanelTop,
} from 'lucide-react';
import { getTableInfo } from './TableToolbar';

interface TableGridPickerProps {
  editor: Editor | null;
  buttonClassName?: string;
  iconClassName?: string;
  showLabel?: boolean;
  align?: 'left' | 'right' | 'center';
  maxRows?: number;
  maxCols?: number;
  onTableDeleted?: () => void;
}

export const TableGridPicker: React.FC<TableGridPickerProps> = ({
  editor,
  buttonClassName,
  iconClassName = 'w-3.5 h-3.5',
  showLabel = false,
  align = 'left',
  maxRows = 10,
  maxCols = 10,
  onTableDeleted,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredRow, setHoveredRow] = useState(0);
  const [hoveredCol, setHoveredCol] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const isInTable = Boolean(editor && editor.isActive('table'));

  const info = useMemo(() => {
    return getTableInfo(editor);
  }, [editor?.state.selection, isInTable]);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleInsert = (rows: number, cols: number) => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
    setIsOpen(false);
    setHoveredRow(0);
    setHoveredCol(0);
  };

  // Row operations
  const handleAddRowBefore = () => {
    if (!editor || !isInTable) return;
    editor.chain().focus().addRowBefore().run();
  };

  const handleAddRowAfter = () => {
    if (!editor || !isInTable) return;
    editor.chain().focus().addRowAfter().run();
  };

  const handleDeleteRow = () => {
    if (!editor || !isInTable) return;

    if (info && info.totalRows <= 1) {
      const confirmed = window.confirm(
        'Esta es la única fila de la tabla. Al eliminarla, se eliminará la tabla completa. ¿Deseas continuar?'
      );
      if (confirmed) {
        editor.chain().focus().deleteTable().run();
        onTableDeleted?.();
        setIsOpen(false);
      }
      return;
    }

    if (info && info.rowHasContent) {
      const confirmed = window.confirm(
        `La fila ${info.rowIndex + 1} contiene información. ¿Estás seguro de que deseas eliminarla?`
      );
      if (!confirmed) return;
    }

    editor.chain().focus().deleteRow().run();
  };

  // Column operations
  const handleAddColumnBefore = () => {
    if (!editor || !isInTable) return;
    editor.chain().focus().addColumnBefore().run();
  };

  const handleAddColumnAfter = () => {
    if (!editor || !isInTable) return;
    editor.chain().focus().addColumnAfter().run();
  };

  const handleDeleteColumn = () => {
    if (!editor || !isInTable) return;

    if (info && info.totalCols <= 1) {
      const confirmed = window.confirm(
        'Esta es la única columna de la tabla. Al eliminarla, se eliminará la tabla completa. ¿Deseas continuar?'
      );
      if (confirmed) {
        editor.chain().focus().deleteTable().run();
        onTableDeleted?.();
        setIsOpen(false);
      }
      return;
    }

    if (info && info.colHasContent) {
      const confirmed = window.confirm(
        `La columna ${info.colIndex + 1} contiene información. ¿Estás seguro de que deseas eliminarla?`
      );
      if (!confirmed) return;
    }

    editor.chain().focus().deleteColumn().run();
  };

  const handleDeleteTable = () => {
    if (!editor || !isInTable) return;

    if (info && info.tableHasContent) {
      const confirmed = window.confirm(
        'La tabla contiene información. ¿Estás seguro de que deseas eliminar la tabla completa?'
      );
      if (!confirmed) return;
    }

    editor.chain().focus().deleteTable().run();
    onTableDeleted?.();
    setIsOpen(false);
  };

  const alignClasses = {
    left: 'left-0 origin-top-left',
    right: 'right-0 origin-top-right',
    center: 'left-1/2 -translate-x-1/2 origin-top',
  }[align];

  return (
    <div className="relative inline-flex items-center" ref={containerRef}>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setIsOpen(!isOpen)}
        className={
          buttonClassName ||
          `p-1 sm:p-1.5 rounded-lg transition flex items-center gap-1.5 ${
            isOpen || isInTable
              ? 'bg-blue-600/90 text-white shadow-sm shadow-blue-500/20 ring-1 ring-blue-400/40'
              : 'text-gray-400 hover:text-white hover:bg-[#252538]'
          }`
        }
        title={
          isInTable
            ? 'Gestionar tabla activa o insertar otra tabla'
            : 'Insertar tabla con selector matricial de filas y columnas (hasta 10x10)'
        }
      >
        <Grid3X3 className={iconClassName} />
        {showLabel && <span className="text-xs">Tabla</span>}
        {isInTable && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        )}
      </button>

      {isOpen && (
        <div
          className={`absolute top-full mt-2 z-50 bg-[#161622] border border-[#2b2b3e] rounded-xl shadow-2xl p-3.5 w-72 text-gray-200 animate-in fade-in zoom-in-95 duration-100 ${alignClasses}`}
        >
          {/* Active Table Operations (if cursor is in a table) */}
          {isInTable && (
            <div className="mb-3 pb-3 border-b border-[#29293e] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1">
                  <TableIcon className="w-3.5 h-3.5" />
                  <span>Modificar tabla activa</span>
                </span>
                {info && (
                  <span className="text-[10px] font-mono text-gray-400 bg-[#202030] px-1.5 py-0.5 rounded">
                    F{info.rowIndex + 1} • C{info.colIndex + 1}
                  </span>
                )}
              </div>

              {/* Row controls */}
              <div className="bg-[#1b1b28] p-2 rounded-lg border border-[#26263a] space-y-1.5">
                <span className="text-[10px] text-gray-400 font-semibold uppercase flex items-center gap-1">
                  <Rows className="w-3 h-3 text-blue-400" /> Filas:
                </span>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleAddRowBefore}
                    className="px-1.5 py-1 rounded bg-[#232334] hover:bg-[#303046] text-gray-200 text-[10px] flex items-center justify-center gap-0.5 font-medium transition"
                  >
                    <ArrowUp className="w-2.5 h-2.5 text-emerald-400" />
                    <span>+ Encima</span>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleAddRowAfter}
                    className="px-1.5 py-1 rounded bg-[#232334] hover:bg-[#303046] text-gray-200 text-[10px] flex items-center justify-center gap-0.5 font-medium transition"
                  >
                    <ArrowDown className="w-2.5 h-2.5 text-emerald-400" />
                    <span>+ Debajo</span>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleDeleteRow}
                    className="px-1.5 py-1 rounded bg-red-950/40 hover:bg-red-900/60 text-red-300 text-[10px] font-medium transition"
                  >
                    Eliminar
                  </button>
                </div>
              </div>

              {/* Column controls */}
              <div className="bg-[#1b1b28] p-2 rounded-lg border border-[#26263a] space-y-1.5">
                <span className="text-[10px] text-gray-400 font-semibold uppercase flex items-center gap-1">
                  <Columns className="w-3 h-3 text-cyan-400" /> Columnas:
                </span>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleAddColumnBefore}
                    className="px-1.5 py-1 rounded bg-[#232334] hover:bg-[#303046] text-gray-200 text-[10px] flex items-center justify-center gap-0.5 font-medium transition"
                  >
                    <ArrowLeft className="w-2.5 h-2.5 text-emerald-400" />
                    <span>+ Izquierda</span>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleAddColumnAfter}
                    className="px-1.5 py-1 rounded bg-[#232334] hover:bg-[#303046] text-gray-200 text-[10px] flex items-center justify-center gap-0.5 font-medium transition"
                  >
                    <ArrowRight className="w-2.5 h-2.5 text-emerald-400" />
                    <span>+ Derecha</span>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleDeleteColumn}
                    className="px-1.5 py-1 rounded bg-red-950/40 hover:bg-red-900/60 text-red-300 text-[10px] font-medium transition"
                  >
                    Eliminar
                  </button>
                </div>
              </div>

              {/* Delete table button */}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleDeleteTable}
                className="w-full flex items-center justify-center gap-1 px-2 py-1 bg-red-950/40 hover:bg-red-900/60 text-red-300 hover:text-white border border-red-800/40 rounded text-[11px] font-medium transition"
              >
                <Trash2 className="w-3 h-3" />
                <span>Eliminar tabla completa</span>
              </button>
            </div>
          )}

          {/* Header & Preview label */}
          <div className="flex items-center justify-between border-b border-[#242436] pb-2 mb-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-200">
              <TableIcon className="w-3.5 h-3.5 text-blue-400" />
              <span>{isInTable ? 'O insertar nueva tabla' : 'Insertar tabla'}</span>
            </div>
            <span
              className={`text-[11px] font-mono px-2 py-0.5 rounded ${
                hoveredRow > 0 && hoveredCol > 0
                  ? 'bg-blue-600/30 text-blue-300 font-bold border border-blue-500/30'
                  : 'text-gray-400'
              }`}
            >
              {hoveredRow > 0 && hoveredCol > 0 ? `${hoveredRow} × ${hoveredCol}` : 'Arrastra el cursor'}
            </span>
          </div>

          {/* Interactive 10x10 Matrix Grid */}
          <div
            className="grid gap-1 p-1 bg-[#0f0f17] rounded-lg border border-[#222232] cursor-pointer select-none"
            style={{
              gridTemplateColumns: `repeat(${maxCols}, minmax(0, 1fr))`,
            }}
            onMouseLeave={() => {
              setHoveredRow(0);
              setHoveredCol(0);
            }}
          >
            {Array.from({ length: maxRows }).map((_, rIndex) => {
              const r = rIndex + 1;
              return Array.from({ length: maxCols }).map((_, cIndex) => {
                const c = cIndex + 1;
                const isHighlighted = r <= hoveredRow && c <= hoveredCol;

                return (
                  <div
                    key={`${r}-${c}`}
                    onMouseEnter={() => {
                      setHoveredRow(r);
                      setHoveredCol(c);
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleInsert(r, c)}
                    className={`w-4 h-4 rounded-sm transition-all duration-75 ${
                      isHighlighted
                        ? 'bg-blue-500 border border-blue-400 shadow-[0_0_6px_rgba(59,130,246,0.6)] scale-105'
                        : 'bg-[#1e1e2d] border border-[#28283d] hover:bg-[#2b2b40]'
                    }`}
                    title={`${r} filas × ${c} columnas`}
                  />
                );
              });
            })}
          </div>

          {/* Footer note / shortcut buttons */}
          <div className="mt-2.5 pt-2 border-t border-[#242436] flex items-center justify-between text-[10px] text-gray-400">
            <span>Clic para insertar</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleInsert(2, 2)}
                className="px-1.5 py-0.5 bg-[#202030] hover:bg-blue-600 hover:text-white rounded transition text-gray-300"
              >
                2×2
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleInsert(3, 3)}
                className="px-1.5 py-0.5 bg-[#202030] hover:bg-blue-600 hover:text-white rounded transition text-gray-300"
              >
                3×3
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleInsert(4, 5)}
                className="px-1.5 py-0.5 bg-[#202030] hover:bg-blue-600 hover:text-white rounded transition text-gray-300"
              >
                4×5
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
