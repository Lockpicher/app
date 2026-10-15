import React, { useState, useEffect } from 'react';
import { Search, FileText, CheckSquare, FolderKanban, Boxes, ArrowRight } from 'lucide-react';
import { AppNote, AppTask, AppProject, AppObject } from '../lib/types';

interface QuickSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  notes: AppNote[];
  tasks: AppTask[];
  projects: AppProject[];
  objects: AppObject[];
  onSelectEntity: (id: string, type: 'note' | 'task' | 'project' | 'object') => void;
}

export const QuickSwitcher: React.FC<QuickSwitcherProps> = ({
  isOpen,
  onClose,
  notes,
  tasks,
  projects,
  objects,
  onSelectEntity
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setQuery('');
    setSelectedIndex(0);
  }, [isOpen]);

  if (!isOpen) return null;

  const allItems = [
    ...notes.map(n => ({ id: n.id, title: n.title, type: 'note' as const, subtitle: 'Nota Markdown' })),
    ...projects.map(p => ({ id: p.id, title: p.title, type: 'project' as const, subtitle: 'Proyecto' })),
    ...tasks.map(t => ({ id: t.id, title: t.title, type: 'task' as const, subtitle: `Tarea • ${t.status}` })),
    ...objects.map(o => ({ id: o.id, title: o.title, type: 'object' as const, subtitle: `Objeto • ${o.object_type}` }))
  ];

  const filtered = allItems.filter(item => 
    item.title.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % (filtered.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filtered.length) % (filtered.length || 1));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      const item = filtered[selectedIndex];
      onSelectEntity(item.id, item.type);
      onClose();
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'note': return <FileText className="w-4 h-4 text-purple-400" />;
      case 'project': return <FolderKanban className="w-4 h-4 text-blue-400" />;
      case 'task': return <CheckSquare className="w-4 h-4 text-amber-400" />;
      case 'object': return <Boxes className="w-4 h-4 text-emerald-400" />;
      default: return null;
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-24 px-4 z-50"
      onClick={onClose}
    >
      <div 
        className="bg-[#181822] border border-[#2f2f42] rounded-xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Bar Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#29293a]">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Buscar notas, tareas, proyectos y objetos... (Enter para abrir)"
            className="w-full bg-transparent text-white placeholder-gray-500 text-sm outline-none"
          />
          <kbd className="text-[10px] bg-[#121217] px-2 py-0.5 rounded border border-[#343442] text-gray-400">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-[#232332]">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400">
              No se encontraron coincidencias para "{query}".
            </div>
          ) : (
            filtered.map((item, idx) => (
              <button
                key={`${item.type}-${item.id}`}
                onClick={() => {
                  onSelectEntity(item.id, item.type);
                  onClose();
                }}
                className={`w-full px-3 py-2.5 rounded-lg flex items-center justify-between transition text-left ${
                  idx === selectedIndex 
                    ? 'bg-purple-900/30 text-white border border-purple-500/40' 
                    : 'text-gray-300 hover:bg-[#20202c]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-md bg-[#121217] flex items-center justify-center border border-[#262635]">
                    {getIcon(item.type)}
                  </div>
                  <div>
                    <div className="text-xs font-semibold leading-tight">{item.title}</div>
                    <div className="text-[10px] text-gray-400 capitalize">{item.subtitle}</div>
                  </div>
                </div>

                <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
              </button>
            ))
          )}
        </div>

        {/* Keyboard Footer */}
        <div className="px-4 py-2 bg-[#121218] border-t border-[#232332] flex items-center justify-between text-[11px] text-gray-400">
          <span>Navega con ↑ ↓</span>
          <span>Presiona Enter para navegar</span>
        </div>
      </div>
    </div>
  );
};
