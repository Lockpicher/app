import React, { useMemo } from 'react';
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
  Info,
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

export function getTableInfo(editor: Editor | null): TableInfo | null {
  if (!editor || !editor.isActive('table')) return null;

  try {
    const { state } = editor;
    const { $from } = state.selection;

    let tableDepth = -1;
    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type.name === 'table') {
        tableDepth = d;
        break;
      }
    }
    if (tableDepth === -1) return null;

    const tableNode = $from.node(tableDepth);
    const rowNode = $from.depth >= tableDepth + 1 ? $from.node(tableDepth + 1) : null;
    const cellNode = $from.depth >= tableDepth + 2 ? $from.node(tableDepth + 2) : null;

    let rowIndex = -1;
    if (tableNode && rowNode) {
      for (let i = 0; i < tableNode.childCount; i++) {
        if (tableNode.child(i) === rowNode) {
          rowIndex = i;
          break;
        }
      }
    }

    let colIndex = -1;
    if (rowNode && cellNode) {
      for (let j = 0; j < rowNode.childCount; j++) {
        if (rowNode.child(j) === cellNode) {
          colIndex = j;
          break;
        }
      }
    }

    const totalRows = tableNode.childCount;
    const totalCols = rowNode ? rowNode.childCount : 0;

    const rowHasContent = rowNode ? rowNode.textContent.trim().length > 0 : false;

    let colHasContent = false;
    if (colIndex !== -1) {
      for (let r = 0; r < tableNode.childCount; r++) {
        const row = tableNode.child(r);
        if (colIndex < row.childCount) {
          const cell = row.child(colIndex);
          if (cell.textContent.trim().length > 0) {
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
  showWhenInactive = true,
}) => {
  const isInTable = Boolean(editor && editor.isActive('table'));

  const info = useMemo(() => {
    return getTableInfo(editor);
  }, [editor?.state.selection, isInTable]);

  if (!editor) {
    return null;
  }

  // If outside a table and configured not to show, hide
  if (!isInTable && !showWhenInactive) {
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

  return (
    <div
      className={`border-t sm:border-y border-[#26263b] bg-[#161623]/95 backdrop-blur-sm px-2.5 sm:px-4 py-1.5 transition-all animate-in fade-in slide-in-from-top-1 duration-150 ${className}`}
    >
      <div className="max-w-[940px] mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Left Side: Operations */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* Badge & Context indicator */}
          <div className="flex items-center gap-1.5 pr-1">
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
              <span className="hidden sm:inline-flex items-center text-[10px] text-gray-400 font-mono bg-[#1f1f2e] px-1.5 py-0.5 rounded border border-[#2d2d40]">
                Fila {info.rowIndex + 1}/{info.totalRows} • Col {info.colIndex + 1}/{info.totalCols}
              </span>
            )}
          </div>

          {/* Row Management */}
          <div
            className={`flex items-center gap-0.5 bg-[#202030] px-1 sm:px-1.5 py-0.5 rounded-lg border border-[#2d2d42] ${
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
              className="px-1.5 sm:px-2 py-0.5 text-gray-300 hover:text-white hover:bg-[#2e2e46] disabled:pointer-events-none rounded text-[11px] transition flex items-center gap-0.5 font-medium"
              title={
                isInTable
                  ? 'Añadir nueva fila encima de la actual'
                  : 'Coloca el cursor dentro de una celda de la tabla para añadir filas'
              }
            >
              <ArrowUp className="w-2.5 h-2.5 text-emerald-400" />
              <span>+ Encima</span>
            </button>
            <button
              type="button"
              disabled={!isInTable}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleAddRowAfter}
              className="px-1.5 sm:px-2 py-0.5 text-gray-300 hover:text-white hover:bg-[#2e2e46] disabled:pointer-events-none rounded text-[11px] transition flex items-center gap-0.5 font-medium"
              title={
                isInTable
                  ? 'Añadir nueva fila debajo de la actual'
                  : 'Coloca el cursor dentro de una celda de la tabla para añadir filas'
              }
            >
              <ArrowDown className="w-2.5 h-2.5 text-emerald-400" />
              <span>+ Debajo</span>
            </button>
            <button
              type="button"
              disabled={!isInTable}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleDeleteRow}
              className="px-1.5 sm:px-2 py-0.5 text-red-400 hover:text-red-200 hover:bg-red-950/50 disabled:pointer-events-none rounded text-[11px] transition font-medium"
              title={
                isInTable
                  ? 'Eliminar la fila actual seleccionada'
                  : 'Coloca el cursor dentro de una celda de la tabla para eliminar filas'
              }
            >
              Eliminar fila
            </button>
          </div>

          {/* Column Management */}
          <div
            className={`flex items-center gap-0.5 bg-[#202030] px-1 sm:px-1.5 py-0.5 rounded-lg border border-[#2d2d42] ${
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
              className="px-1.5 sm:px-2 py-0.5 text-gray-300 hover:text-white hover:bg-[#2e2e46] disabled:pointer-events-none rounded text-[11px] transition flex items-center gap-0.5 font-medium"
              title={
                isInTable
                  ? 'Añadir nueva columna a la izquierda'
                  : 'Coloca el cursor dentro de una celda de la tabla para añadir columnas'
              }
            >
              <ArrowLeft className="w-2.5 h-2.5 text-emerald-400" />
              <span>+ Izquierda</span>
            </button>
            <button
              type="button"
              disabled={!isInTable}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleAddColumnAfter}
              className="px-1.5 sm:px-2 py-0.5 text-gray-300 hover:text-white hover:bg-[#2e2e46] disabled:pointer-events-none rounded text-[11px] transition flex items-center gap-0.5 font-medium"
              title={
                isInTable
                  ? 'Añadir nueva columna a la derecha'
                  : 'Coloca el cursor dentro de una celda de la tabla para añadir columnas'
              }
            >
              <ArrowRight className="w-2.5 h-2.5 text-emerald-400" />
              <span>+ Derecha</span>
            </button>
            <button
              type="button"
              disabled={!isInTable}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleDeleteColumn}
              className="px-1.5 sm:px-2 py-0.5 text-red-400 hover:text-red-200 hover:bg-red-950/50 disabled:pointer-events-none rounded text-[11px] transition font-medium"
              title={
                isInTable
                  ? 'Eliminar la columna actual seleccionada'
                  : 'Coloca el cursor dentro de una celda de la tabla para eliminar columnas'
              }
            >
              Eliminar columna
            </button>
          </div>

          {/* Headers Toggles */}
          <div
            className={`flex items-center gap-1 bg-[#202030] px-1 sm:px-1.5 py-0.5 rounded-lg border border-[#2d2d42] ${
              !isInTable ? 'opacity-40' : ''
            }`}
          >
            <button
              type="button"
              disabled={!isInTable}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleToggleHeaderRow}
              className="px-1.5 sm:px-2 py-0.5 text-gray-300 hover:text-white hover:bg-[#2e2e46] disabled:pointer-events-none rounded text-[11px] transition flex items-center gap-1"
              title="Alternar estilo de fila de encabezado superior"
            >
              <PanelTop className="w-3 h-3 text-purple-400" />
              <span>Fila Encabezado</span>
            </button>
            <button
              type="button"
              disabled={!isInTable}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleToggleHeaderColumn}
              className="px-1.5 sm:px-2 py-0.5 text-gray-300 hover:text-white hover:bg-[#2e2e46] disabled:pointer-events-none rounded text-[11px] transition flex items-center gap-1"
              title="Alternar estilo de columna de encabezado lateral"
            >
              <PanelLeft className="w-3 h-3 text-purple-400" />
              <span>Col. Encabezado</span>
            </button>
          </div>
        </div>

        {/* Right Side: Delete Table or Inactive Indication */}
        <div className="flex items-center gap-2 ml-auto">
          {!isInTable && (
            <div className="flex items-center gap-1 text-[11px] text-gray-400 italic">
              <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>Haz clic dentro de una celda para modificar la estructura</span>
            </div>
          )}

          <button
            type="button"
            disabled={!isInTable}
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleDeleteTable}
            className="flex items-center gap-1 px-2.5 py-1 text-red-400 hover:text-white hover:bg-red-600/90 disabled:opacity-30 disabled:pointer-events-none border border-red-500/30 rounded-lg text-[11px] transition shrink-0 font-medium"
            title="Eliminar tabla completa"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Eliminar tabla</span>
          </button>
        </div>
      </div>
    </div>
  );
};
