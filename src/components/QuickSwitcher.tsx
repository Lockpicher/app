import React, { useState, useEffect } from 'react';
import { Search, FileText, CheckSquare, FolderKanban, Boxes, ArrowRight, Book, HardDrive, Layers, User } from 'lucide-react';
import { AppNote, AppTask, AppProject, AppObject, AppNotebook, AppAttachment } from '../lib/types';
import { db } from '../lib/insforge';

interface QuickSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  notes: AppNote[];
  tasks: AppTask[];
  projects: AppProject[];
  objects: AppObject[];
  notebooks?: AppNotebook[];
  attachments?: AppAttachment[];
  onSelectEntity: (id: string, type: 'note' | 'task' | 'project' | 'object' | 'notebook' | 'file') => void;
}

export const QuickSwitcher: React.FC<QuickSwitcherProps> = ({
  isOpen,
  onClose,
  notes,
  tasks,
  projects,
  objects,
  notebooks = [],
  attachments = [],
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
    ...notebooks.map(nb => ({ id: nb.id, title: nb.name, type: 'notebook' as const, subtitle: 'Cuaderno de notas' })),
    ...notes.map(n => ({ id: n.id, title: n.title, type: 'note' as const, subtitle: `Nota • ${n.note_type || 'texto'}` })),
    ...projects.map(p => ({ id: p.id, title: p.title, type: 'project' as const, subtitle: `Proyecto • ${p.status}` })),
    ...tasks.map(t => ({ id: t.id, title: t.title, type: 'task' as const, subtitle: `Tarea • ${t.status}` })),
    ...objects.map(o => ({ 
      id: o.id, 
      title: o.title, 
      type: 'object' as const, 
      subtitle: o.object_type === 'page' ? 'Página de conocimiento' : o.object_type === 'person' ? 'Contacto / Persona' : `Objeto • ${o.object_type}` 
    })),
    ...attachments.map(a => ({ id: a.id, title: a.display_name || a.file_name, type: 'file' as const, subtitle: `Archivo R2 • ${a.mime_type || 'archivo'}` }))
  ];

  const filtered = allItems.filter(item => 
    item.title.toLowerCase().includes(query.toLowerCase()) || item.subtitle.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 10);

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

  const getIcon = (item: typeof allItems[0]) => {
    switch (item.type) {
      case 'notebook': return <Book className="w-4 h-4 text-blue-400" />;
      case 'note': return <FileText className="w-4 h-4 text-purple-400" />;
      case 'project': return <FolderKanban className="w-4 h-4 text-blue-400" />;
      case 'task': return <CheckSquare className="w-4 h-4 text-amber-400" />;
      case 'file': return <HardDrive className="w-4 h-4 text-cyan-400" />;
      case 'object': {
        const obj = objects.find(o => o.id === item.id);
        if (obj?.object_type === 'page') return <Layers className="w-4 h-4 text-indigo-400" />;
        if (obj?.object_type === 'person') return <User className="w-4 h-4 text-emerald-400" />;
        return <Boxes className="w-4 h-4 text-pink-400" />;
      }
      default: return <Search className="w-4 h-4 text-gray-400" />;
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
            <div className="py-6 text-center text-xs text-gray-400">
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
                    ? 'bg-blue-900/30 text-white border border-blue-500/40' 
                    : 'text-gray-300 hover:bg-[#20202c]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-md bg-[#121217] flex items-center justify-center border border-[#262635]">
                    {getIcon(item)}
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

          {/* Opción rápida: Crear '[texto]' como... */}
          {query.trim().length > 1 && (
            <div className="pt-3 pb-1 px-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500 block mb-2 px-1">
                Crear "{query.trim()}" al instante como:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {[
                  { id: 'person', label: 'Persona', color: '#3b82f6' },
                  { id: 'company', label: 'Empresa', color: '#0ea5e9' },
                  { id: 'project', label: 'Proyecto', color: '#3b82f6' },
                  { id: 'page', label: 'Página', color: '#6366f1' },
                  { id: 'meeting', label: 'Reunión', color: '#f59e0b' },
                  { id: 'resource', label: 'Recurso', color: '#10b981' },
                  { id: 'book', label: 'Libro', color: '#8b5cf6' },
                  { id: 'concept', label: 'Concepto', color: '#eab308' }
                ].map(type => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={async () => {
                      try {
                        if (type.id === 'project') {
                          const p = await db.createProject({
                            title: query.trim(),
                            status: 'active',
                            priority: 'medium',
                            progress: 0
                          });
                          if (p) {
                            onSelectEntity(p.id, 'project');
                            onClose();
                          }
                        } else {
                          const obj = await db.createObject({
                            title: query.trim(),
                            object_type: type.id,
                            properties: {}
                          });
                          if (obj) {
                            onSelectEntity(obj.id, 'object');
                            onClose();
                          }
                        }
                      } catch (err: any) {
                        alert('Error al crear: ' + err.message);
                      }
                    }}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[#14141c] hover:bg-[#1f1f2e] border border-[#232332] text-xs text-gray-300 hover:text-white transition text-left"
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: type.color }} />
                    <span className="truncate">{type.label}</span>
                  </button>
                ))}
              </div>
            </div>
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
