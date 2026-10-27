import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  X, 
  User, 
  Building2, 
  FolderKanban, 
  FileText, 
  Calendar, 
  Book, 
  Lightbulb, 
  Link as LinkIcon, 
  CheckSquare, 
  Layers, 
  Boxes,
  Loader2,
  Check,
  Atom,
  Plane,
  Sparkles
} from 'lucide-react';
import { 
  AppObject, 
  AppProject, 
  AppNote, 
  AppTask, 
  AppArea, 
  EntityType,
  ObjectTypeDefinition,
  DEFAULT_OBJECT_TYPES 
} from '../lib/types';
import { db } from '../lib/insforge';

export interface UniversalLinkItem {
  id: string;
  type: EntityType;
  title: string;
  subtitle: string;
  icon?: string;
  color?: string;
  category?: string;
  objectType?: string;
}

interface UniversalLinkSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: UniversalLinkItem, relationLabel?: string) => Promise<void> | void;
  onCreateAndSelect?: (type: string, title: string, relationLabel?: string) => Promise<UniversalLinkItem | null | void>;
  notes?: AppNote[];
  tasks?: AppTask[];
  projects?: AppProject[];
  objects?: AppObject[];
  areas?: AppArea[];
  customTypes?: ObjectTypeDefinition[];
  currentEntityId?: string;
  currentEntityType?: EntityType;
  title?: string;
  initialQuery?: string;
  defaultRelationLabel?: string;
}

export const UniversalLinkSelectorModal: React.FC<UniversalLinkSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  onCreateAndSelect,
  notes = [],
  tasks = [],
  projects = [],
  objects = [],
  areas = [],
  customTypes = [],
  currentEntityId,
  currentEntityType,
  title = 'Vincular elemento',
  initialQuery = '',
  defaultRelationLabel = 'related'
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [selectedRelation, setSelectedRelation] = useState<string>(defaultRelationLabel);
  const [isCreating, setIsCreating] = useState(false);
  const [creatingType, setCreatingType] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Available types for "Crear como..."
  const creatableTypes = useMemo(() => {
    return [
      { id: 'person', label: 'Persona', icon: User, color: '#3b82f6', category: 'object' },
      { id: 'company', label: 'Empresa', icon: Building2, color: '#0ea5e9', category: 'object' },
      { id: 'project', label: 'Proyecto', icon: FolderKanban, color: '#3b82f6', category: 'project' },
      { id: 'page', label: 'Página', icon: FileText, color: '#6366f1', category: 'object' },
      { id: 'meeting', label: 'Reunión', icon: Calendar, color: '#f59e0b', category: 'object' },
      { id: 'resource', label: 'Recurso', icon: LinkIcon, color: '#10b981', category: 'object' },
      { id: 'book', label: 'Libro', icon: Book, color: '#8b5cf6', category: 'object' },
      { id: 'concept', label: 'Concepto', icon: Lightbulb, color: '#eab308', category: 'object' },
      { id: 'atomic_note', label: 'Nota Atómica', icon: Atom, color: '#06b6d4', category: 'object' },
      { id: 'trip', label: 'Viaje', icon: Plane, color: '#14b8a6', category: 'object' },
      { id: 'idea', label: 'Idea', icon: Sparkles, color: '#f59e0b', category: 'object' },
      { id: 'note', label: 'Nota', icon: FileText, color: '#a855f7', category: 'note' },
      { id: 'task', label: 'Tarea', icon: CheckSquare, color: '#10b981', category: 'task' },
      ...customTypes.map(ct => ({
        id: ct.id,
        label: ct.name,
        icon: Boxes,
        color: ct.color || '#3b82f6',
        category: 'object'
      }))
    ];
  }, [customTypes]);

  // Aggregate all linkable entities
  const allItems = useMemo<UniversalLinkItem[]>(() => {
    const list: UniversalLinkItem[] = [];

    // 1. Objects
    objects.forEach(o => {
      if (currentEntityId && o.id === currentEntityId && currentEntityType === 'object') return;
      
      let typeLabel = o.object_type;
      const typeDef = [...DEFAULT_OBJECT_TYPES, ...customTypes].find(t => t.id === o.object_type);
      if (typeDef) typeLabel = typeDef.name;

      list.push({
        id: o.id,
        type: 'object',
        title: o.title || 'Sin título',
        subtitle: `${typeLabel} • ${o.description || 'Objeto'}`,
        color: o.color || typeDef?.color || '#3b82f6',
        objectType: o.object_type,
        category: 'Objetos y Entidades'
      });
    });

    // 2. Projects
    projects.forEach(p => {
      if (currentEntityId && p.id === currentEntityId && currentEntityType === 'project') return;
      list.push({
        id: p.id,
        type: 'project',
        title: p.title || 'Proyecto sin título',
        subtitle: `Proyecto • ${p.status || 'activo'}`,
        color: p.color || '#3b82f6',
        category: 'Proyectos'
      });
    });

    // 3. Notes
    notes.forEach(n => {
      if (currentEntityId && n.id === currentEntityId && currentEntityType === 'note') return;
      list.push({
        id: n.id,
        type: 'note',
        title: n.title || 'Nota sin título',
        subtitle: `Nota • ${n.note_type || 'texto'}`,
        color: '#a855f7',
        category: 'Notas'
      });
    });

    // 4. Tasks
    tasks.forEach(t => {
      if (currentEntityId && t.id === currentEntityId && currentEntityType === 'task') return;
      list.push({
        id: t.id,
        type: 'task',
        title: t.title || 'Tarea sin título',
        subtitle: `Tarea • ${t.status || 'todo'}`,
        color: '#10b981',
        category: 'Tareas'
      });
    });

    // 5. Areas
    areas.forEach(a => {
      if (currentEntityId && a.id === currentEntityId && currentEntityType === 'area') return;
      list.push({
        id: a.id,
        type: 'area',
        title: a.title || 'Área sin título',
        subtitle: `Área de Responsabilidad`,
        color: a.color || '#8b5cf6',
        category: 'Áreas'
      });
    });

    return list;
  }, [objects, projects, notes, tasks, areas, customTypes, currentEntityId, currentEntityType]);

  // Filter items
  const filteredItems = useMemo(() => {
    if (!query.trim()) return allItems.slice(0, 20);
    const q = query.toLowerCase();
    return allItems
      .filter(item => 
        item.title.toLowerCase().includes(q) || 
        item.subtitle.toLowerCase().includes(q) ||
        (item.objectType && item.objectType.toLowerCase().includes(q))
      )
      .slice(0, 25);
  }, [allItems, query]);

  // Group filtered results by category
  const groupedResults = useMemo(() => {
    const groups = new Map<string, UniversalLinkItem[]>();
    filteredItems.forEach(item => {
      const cat = item.category || 'Otros';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(item);
    });
    return Array.from(groups.entries()).map(([category, items]) => ({
      category,
      items
    }));
  }, [filteredItems]);

  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery);
      setSelectedRelation(defaultRelationLabel);
      setSelectedIndex(0);
      setIsCreating(false);
      setCreatingType(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, initialQuery, defaultRelationLabel]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < filteredItems.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        handleSelectItem(filteredItems[selectedIndex]);
      }
    }
  };

  const handleSelectItem = async (item: UniversalLinkItem) => {
    await onSelect(item, selectedRelation);
    onClose();
  };

  // Instant creation handler
  const handleInstantCreate = async (typeId: string) => {
    const cleanTitle = query.trim();
    if (!cleanTitle || isCreating) return;

    try {
      setIsCreating(true);
      setCreatingType(typeId);

      if (onCreateAndSelect) {
        const created = await onCreateAndSelect(typeId, cleanTitle, selectedRelation);
        if (created) {
          onClose();
          return;
        }
      }

      // Default creation fallback
      let createdItem: UniversalLinkItem | null = null;
      if (typeId === 'project') {
        const created = await db.createProject({ title: cleanTitle, status: 'active', priority: 'medium', progress: 0 });
        if (created) {
          createdItem = { id: created.id, type: 'project', title: created.title, subtitle: 'Proyecto', color: '#3b82f6' };
        }
      } else if (typeId === 'note') {
        const created = await db.createNote({ title: cleanTitle, note_type: 'text', content: `<p></p>`, plain_text: '' });
        if (created) {
          createdItem = { id: created.id, type: 'note', title: created.title, subtitle: 'Nota', color: '#a855f7' };
        }
      } else if (typeId === 'task') {
        const created = await db.createTask({ title: cleanTitle, status: 'todo', priority: 'medium' });
        if (created) {
          createdItem = { id: created.id, type: 'task', title: created.title, subtitle: 'Tarea', color: '#10b981' };
        }
      } else {
        // Object of any type
        const created = await db.createObject({
          title: cleanTitle,
          object_type: typeId,
          properties: {}
        });
        if (created) {
          createdItem = {
            id: created.id,
            type: 'object',
            title: created.title,
            subtitle: `Objeto • ${typeId}`,
            color: created.color || '#3b82f6',
            objectType: created.object_type
          };
        }
      }

      if (createdItem) {
        await onSelect(createdItem, selectedRelation);
        onClose();
      }
    } catch (err: any) {
      alert('Error creando el elemento: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsCreating(false);
      setCreatingType(null);
    }
  };

  const getEntityIcon = (item: UniversalLinkItem) => {
    if (item.type === 'project') return <FolderKanban className="w-4 h-4 text-blue-400" />;
    if (item.type === 'note') return <FileText className="w-4 h-4 text-purple-400" />;
    if (item.type === 'task') return <CheckSquare className="w-4 h-4 text-emerald-400" />;
    if (item.type === 'area') return <Layers className="w-4 h-4 text-indigo-400" />;
    
    // Objects
    if (item.objectType === 'person') return <User className="w-4 h-4 text-blue-400" />;
    if (item.objectType === 'company') return <Building2 className="w-4 h-4 text-sky-400" />;
    if (item.objectType === 'page') return <FileText className="w-4 h-4 text-indigo-400" />;
    if (item.objectType === 'meeting') return <Calendar className="w-4 h-4 text-amber-400" />;
    if (item.objectType === 'book') return <Book className="w-4 h-4 text-purple-400" />;
    if (item.objectType === 'concept') return <Lightbulb className="w-4 h-4 text-yellow-400" />;
    if (item.objectType === 'atomic_note') return <Atom className="w-4 h-4 text-cyan-400" />;
    if (item.objectType === 'trip') return <Plane className="w-4 h-4 text-teal-400" />;
    if (item.objectType === 'idea') return <Sparkles className="w-4 h-4 text-amber-400" />;
    if (item.objectType === 'resource') return <LinkIcon className="w-4 h-4 text-emerald-400" />;

    return <Boxes className="w-4 h-4 text-gray-400" />;
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-xl bg-[#161622] border-t sm:border border-[#2a2a3e] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90dvh] sm:max-h-[80vh] select-none"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)'
        }}
      >
        {/* Header with Grab Bar for Mobile */}
        <div className="pt-2 sm:pt-3 px-4 pb-2 border-b border-[#252538] flex flex-col">
          {/* Mobile grab bar */}
          <div className="w-12 h-1 rounded-full bg-gray-600 mx-auto mb-2 sm:hidden" />
          
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold text-white tracking-wide">{title}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white bg-[#1f1f2e] transition"
              aria-label="Cerrar selector"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search Input (Universal Command Palette style) */}
          <div className="relative mt-2.5 flex items-center bg-[#1c1c2a] border border-[#2f2f44] focus-within:border-blue-500/70 rounded-xl px-3 py-2 transition">
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0 mr-2.5" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Buscar para vincular o escribe para crear..."
              className="w-full bg-transparent text-sm text-gray-100 placeholder-gray-500 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-gray-500 hover:text-gray-300 p-1 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Results & Groups */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 no-scrollbar">
          
          {/* Section: Crear como... (if query is not empty) */}
          {query.trim().length > 0 && (
            <div className="p-2.5 rounded-xl bg-blue-950/20 border border-blue-900/30 space-y-2">
              <span className="text-[11px] font-semibold text-blue-300 block px-1">
                Crear «{query.trim()}» al instante como:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {creatableTypes.slice(0, 8).map(ct => {
                  const Icon = ct.icon;
                  const isCurrentCreating = isCreating && creatingType === ct.id;

                  return (
                    <button
                      key={ct.id}
                      type="button"
                      disabled={isCreating}
                      onClick={() => handleInstantCreate(ct.id)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-200 hover:text-white bg-[#1e1e2c] hover:bg-[#28283c] border border-[#2e2e44] hover:border-blue-500/50 flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
                    >
                      {isCurrentCreating ? (
                        <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                      ) : (
                        <Icon className="w-3.5 h-3.5 text-blue-400" />
                      )}
                      <span>{ct.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Grouped Existing Entities */}
          {groupedResults.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400 space-y-1">
              <p className="font-medium text-gray-300">No se encontraron elementos existentes</p>
              <p className="text-gray-500 text-[11px]">Usa las opciones de arriba para crearlo al instante</p>
            </div>
          ) : (
            groupedResults.map(({ category, items }) => (
              <div key={category} className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-2 block">
                  {category}
                </span>

                <div className="divide-y divide-[#222234]">
                  {items.map((item) => {
                    const isCurrent = filteredItems[selectedIndex]?.id === item.id;

                    return (
                      <button
                        key={`${item.type}-${item.id}`}
                        type="button"
                        onClick={() => handleSelectItem(item)}
                        className={`w-full text-left min-h-[48px] px-2.5 py-2 rounded-xl flex items-center justify-between gap-3 transition group active:scale-[0.99] ${
                          isCurrent
                            ? 'bg-blue-600/15 border border-blue-500/30'
                            : 'hover:bg-[#1f1f2e] border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-lg bg-[#14141c] border border-[#2b2b3e] flex items-center justify-center flex-shrink-0">
                            {getEntityIcon(item)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-medium text-gray-200 group-hover:text-white transition block truncate">
                              {item.title}
                            </span>
                            <span className="text-xs text-gray-400 truncate block mt-0.5">
                              {item.subtitle}
                            </span>
                          </div>
                        </div>

                        <span className="text-xs font-semibold text-blue-400 opacity-0 group-hover:opacity-100 transition flex items-center gap-1 flex-shrink-0">
                          <span>Vincular</span>
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}

        </div>
      </div>
    </div>
  );
};
