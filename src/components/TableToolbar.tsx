import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Editor } from '@tiptap/react';
import {
  Rows,
  Columns,
  Trash2,
  Table as TableIcon,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  PanelTop,
  PanelLeft,
  ChevronUp,
  ChevronDown,
  X,
} from 'lucide-react';

interface TableToolbarProps {
  editor: Editor | null;
  className?: string;
  onTableDeleted?: () => void;
  showWhenInactive?: boolean;
}

export interface TableInfo {
  totalRows: number;
  totalCols: number;
  rowIndex: number;
  colIndex: number;
  rowHasContent: boolean;
  colHasContent: boolean;
  tableHasContent: boolean;
}

/**
 * Inspects TipTap editor selection to get current row, column and content info
 */
export function getTableInfo(editor: Editor | null): TableInfo | null {
  if (!editor || !editor.isActive('table')) {
    return null;
  }

  try {
    const { state } = editor;
    const { selection } = state;
    const { $from } = selection;

    // Find table, row, cell depths
    let tableDepth = -1;
    let rowDepth = -1;
    let cellDepth = -1;

    for (let d = $from.depth; d > 0; d--) {
      const node = $from.node(d);
      if (node.type.name === 'table') tableDepth = d;
      if (node.type.name === 'tableRow') rowDepth = d;
      if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') cellDepth = d;
    }

    if (tableDepth === -1) {
      return null;
    }

    const tableNode = $from.node(tableDepth);
    const totalRows = tableNode.childCount;
    let totalCols = 0;
    if (totalRows > 0) {
      totalCols = tableNode.child(0).childCount;
    }

    let rowIndex = -1;
    let colIndex = -1;

    if (rowDepth !== -1) {
      rowIndex = $from.index(tableDepth);
    }

    if (cellDepth !== -1 && rowDepth !== -1) {
      colIndex = $from.index(rowDepth);
    }

    // Check if current row has content
    let rowHasContent = false;
    if (rowIndex >= 0 && rowIndex < totalRows) {
      const rowNode = tableNode.child(rowIndex);
      rowHasContent = rowNode.textContent.trim().length > 0;
    }

    // Check if current column has content
    let colHasContent = false;
    if (colIndex >= 0 && colIndex < totalCols) {
      for (let r = 0; r < totalRows; r++) {
        const rNode = tableNode.child(r);
        if (colIndex < rNode.childCount) {
          const cellNode = rNode.child(colIndex);
          if (cellNode.textContent.trim().length > 0) {
            colHasContent = true;
            break;
          }
        }
      }
    }

    const tableHasContent = tableNode.textContent.trim().length > 0;

    return {
      totalRows,
      totalCols,
      rowIndex,
      colIndex,
      rowHasContent,
      colHasContent,
      tableHasContent,
    };
  } catch {
    return null;
  }
}

export const TableToolbar: React.FC<TableToolbarProps> = ({
  editor,
  className = '',
  onTableDeleted,
  showWhenInactive = false,
}) => {
  const isInTable = Boolean(editor && editor.isActive('table'));
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const prevInTableRef = useRef<boolean>(false);

  // Re-arm menu visibility when entering a table from outside
  useEffect(() => {
    if (isInTable && !prevInTableRef.current) {
      setIsDismissed(false);
    }
    prevInTableRef.current = isInTable;
  }, [isInTable]);

  const info = useMemo(() => {
    return getTableInfo(editor);
  }, [editor?.state.selection, isInTable]);

  if (!editor) {
    return null;
  }

  // If outside a table and configured not to show, hide completely
  if (!isInTable && !showWhenInactive) {
    return null;
  }

  // If user explicitly dismissed the table toolbar while in table
  if (isDismissed && !showWhenInactive) {
    return null;
  }

  // --- Row Operations ---
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

  // --- Column Operations ---
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

  // --- Table Operations ---
  const handleToggleHeaderRow = () => {
    if (!editor || !isInTable) return;
    editor.chain().focus().toggleHeaderRow().run();
  };

  const handleToggleHeaderColumn = () => {
    if (!editor || !isInTable) return;
    editor.chain().focus().toggleHeaderColumn().run();
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
  };

  // Minimized / Collapsed Compact Bar (saves vertical space on mobile)
  if (isCollapsed) {
    return (
      <div
        className={`border-t sm:border-y border-[#26263b] bg-[#161623]/95 backdrop-blur-sm px-2.5 sm:px-4 py-1 transition-all ${className}`}
      >
        <div className="max-w-[940px] mx-auto flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <TableIcon className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">
              Tabla
            </span>
            {isInTable && info && info.rowIndex >= 0 && (
              <span className="text-[10px] text-gray-400 font-mono bg-[#1f1f2e] px-1.5 py-0.5 rounded border border-[#2d2d40]">
                Fila {info.rowIndex + 1}/{info.totalRows} • Col {info.colIndex + 1}/{info.totalCols}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setIsCollapsed(false)}
              className="flex items-center gap-1 px-2 py-0.5 bg-[#202030] hover:bg-[#2e2e46] text-gray-300 hover:text-white rounded text-[11px] font-medium border border-[#2d2d42] transition"
              title="Mostrar menú de herramientas de la tabla"
            >
              <span>Herramientas</span>
              <ChevronDown className="w-3.5 h-3.5 text-blue-400" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setIsDismissed(true)}
              className="p-1 text-gray-400 hover:text-gray-200 hover:bg-[#202030] rounded transition"
              title="Cerrar menú de tabla por completo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`border-t sm:border-y border-[#26263b] bg-[#161623]/95 backdrop-blur-sm px-2.5 sm:px-4 py-1.5 transition-all animate-in fade-in slide-in-from-top-1 duration-150 ${className}`}
    >
      <div className="max-w-[940px] mx-auto flex flex-col gap-1.5 text-xs">
        {/* Top Header Row with context and hide/close controls */}
        <div className="flex items-center justify-between gap-2 border-b border-[#222233]/80 pb-1">
          <div className="flex items-center gap-1.5">
            <TableIcon
              className={`w-3.5 h-3.5 ${
                isInTable ? 'text-blue-400 animate-pulse' : 'text-gray-500'
              }`}
            />
            <span
              className={`text-[11px] font-semibold uppercase tracking-wider ${
                isInTable ? 'text-blue-400' : 'text-gray-500'
              }`}
            >
              Tabla
            </span>
            {isInTable && info && info.rowIndex >= 0 && (
              <span className="inline-flex items-center text-[10px] text-gray-400 font-mono bg-[#1f1f2e] px-1.5 py-0.5 rounded border border-[#2d2d40]">
                Fila {info.rowIndex + 1}/{info.totalRows} • Col {info.colIndex + 1}/{info.totalCols}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            {isInTable && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleDeleteTable}
                className="flex items-center gap-1 px-2 py-0.5 text-red-400 hover:text-white hover:bg-red-600/90 border border-red-500/30 rounded text-[10px] transition shrink-0 font-medium"
                title="Eliminar tabla completa"
              >
                <Trash2 className="w-3 h-3" />
                <span className="hidden sm:inline">Eliminar tabla</span>
              </button>
            )}

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setIsCollapsed(true)}
              className="flex items-center gap-1 px-1.5 py-0.5 text-gray-400 hover:text-gray-200 hover:bg-[#202030] rounded text-[10px] font-medium border border-[#2d2d40]/60 transition"
              title="Minimizar menú de tabla para ahorrar espacio en móvil"
            >
              <ChevronUp className="w-3 h-3 text-blue-400" />
              <span>Ocultar</span>
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setIsDismissed(true)}
              className="p-1 text-gray-400 hover:text-gray-200 hover:bg-[#202030] rounded transition"
              title="Cerrar barra de tabla"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Action Controls Row (horizontally scrollable on mobile to prevent vertical stacking) */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
          {/* Row Management */}
          <div
            className={`flex items-center gap-0.5 bg-[#202030] px-1 sm:px-1.5 py-0.5 rounded-lg border border-[#2d2d42] shrink-0 ${
              !isInTable ? 'opacity-40' : ''
            }`}
          >
            <span className="text-[10px] text-gray-400 uppercase font-medium mr-1 flex items-center gap-0.5">
              <Rows className="w-3 h-3 text-blue-400" /> Fila:
            </span>
            <button
              type="button"
              disabled={!isInTable}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleAddRowBefore}
              className="px-1.5 sm:px-2 py-0.5 text-gray-300 hover:text-white hover:bg-[#2e2e46] disabled:pointer-events-none rounded text-[11px] transition flex items-center gap-0.5 font-medium whitespace-nowrap"
              title="Añadir nueva fila encima de la actual"
            >
              <ArrowUp className="w-2.5 h-2.5 text-emerald-400" />
              <span>+ Encima</span>
            </button>
            <button
              type="button"
              disabled={!isInTable}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleAddRowAfter}
              className="px-1.5 sm:px-2 py-0.5 text-gray-300 hover:text-white hover:bg-[#2e2e46] disabled:pointer-events-none rounded text-[11px] transition flex items-center gap-0.5 font-medium whitespace-nowrap"
              title="Añadir nueva fila debajo de la actual"
            >
              <ArrowDown className="w-2.5 h-2.5 text-emerald-400" />
              <span>+ Debajo</span>
            </button>
            <button
              type="button"
              disabled={!isInTable}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleDeleteRow}
              className="px-1.5 sm:px-2 py-0.5 text-red-400 hover:text-red-200 hover:bg-red-950/50 disabled:pointer-events-none rounded text-[11px] transition font-medium whitespace-nowrap"
              title="Eliminar la fila actual seleccionada"
            >
              Eliminar fila
            </button>
          </div>

          {/* Column Management */}
          <div
            className={`flex items-center gap-0.5 bg-[#202030] px-1 sm:px-1.5 py-0.5 rounded-lg border border-[#2d2d42] shrink-0 ${
              !isInTable ? 'opacity-40' : ''
            }`}
          >
            <span className="text-[10px] text-gray-400 uppercase font-medium mr-1 flex items-center gap-0.5">
              <Columns className="w-3 h-3 text-cyan-400" /> Columna:
            </span>
            <button
              type="button"
              disabled={!isInTable}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleAddColumnBefore}
              className="px-1.5 sm:px-2 py-0.5 text-gray-300 hover:text-white hover:bg-[#2e2e46] disabled:pointer-events-none rounded text-[11px] transition flex items-center gap-0.5 font-medium whitespace-nowrap"
              title="Añadir nueva columna a la izquierda"
            >
              <ArrowLeft className="w-2.5 h-2.5 text-emerald-400" />
              <span>+ Izq.</span>
            </button>
            <button
              type="button"
              disabled={!isInTable}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleAddColumnAfter}
              className="px-1.5 sm:px-2 py-0.5 text-gray-300 hover:text-white hover:bg-[#2e2e46] disabled:pointer-events-none rounded text-[11px] transition flex items-center gap-0.5 font-medium whitespace-nowrap"
              title="Añadir nueva columna a la derecha"
            >
              <ArrowRight className="w-2.5 h-2.5 text-emerald-400" />
              <span>+ Der.</span>
            </button>
            <button
              type="button"
              disabled={!isInTable}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleDeleteColumn}
              className="px-1.5 sm:px-2 py-0.5 text-red-400 hover:text-red-200 hover:bg-red-950/50 disabled:pointer-events-none rounded text-[11px] transition font-medium whitespace-nowrap"
              title="Eliminar la columna actual seleccionada"
            >
              Eliminar col.
            </button>
          </div>

          {/* Headers Toggles */}
          <div
            className={`flex items-center gap-1 bg-[#202030] px-1 sm:px-1.5 py-0.5 rounded-lg border border-[#2d2d42] shrink-0 ${
              !isInTable ? 'opacity-40' : ''
            }`}
          >
            <button
              type="button"
              disabled={!isInTable}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleToggleHeaderRow}
              className="px-1.5 sm:px-2 py-0.5 text-gray-300 hover:text-white hover:bg-[#2e2e46] disabled:pointer-events-none rounded text-[11px] transition flex items-center gap-1 whitespace-nowrap"
              title="Alternar estilo de fila de encabezado superior"
            >
              <PanelTop className="w-3 h-3 text-purple-400" />
              <span>Encabezado Fila</span>
            </button>
            <button
              type="button"
              disabled={!isInTable}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleToggleHeaderColumn}
              className="px-1.5 sm:px-2 py-0.5 text-gray-300 hover:text-white hover:bg-[#2e2e46] disabled:pointer-events-none rounded text-[11px] transition flex items-center gap-1 whitespace-nowrap"
              title="Alternar estilo de columna de encabezado lateral"
            >
              <PanelLeft className="w-3 h-3 text-purple-400" />
              <span>Encabezado Col.</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
