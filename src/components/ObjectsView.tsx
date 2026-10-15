import React, { useState } from 'react';
import { 
  Boxes, 
  Plus, 
  User, 
  Calendar, 
  BookOpen, 
  Link as LinkIcon, 
  Lightbulb, 
  Trash2, 
  Tag, 
  Filter,
  FolderKanban,
  Edit2
} from 'lucide-react';
import { AppObject, AppProject } from '../lib/types';

interface ObjectsViewProps {
  objects: AppObject[];
  projects: AppProject[];
  onCreateObject: (obj: Partial<AppObject>) => Promise<void>;
  onUpdateObject: (id: string, updates: Partial<AppObject>) => Promise<void>;
  onDeleteObject: (id: string) => Promise<void>;
}

export const ObjectsView: React.FC<ObjectsViewProps> = ({
  objects,
  projects,
  onCreateObject,
  onUpdateObject,
  onDeleteObject
}) => {
  const [selectedType, setSelectedType] = useState<string>('all');
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<string>('person');
  const [newDescription, setNewDescription] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [newProperties, setNewProperties] = useState<string>('{"rol": "", "contacto": ""}');

  const types = [
    { id: 'all', label: 'Todos', icon: Boxes },
    { id: 'person', label: 'Personas', icon: User, color: 'text-blue-400 bg-blue-950/40' },
    { id: 'meeting', label: 'Reuniones', icon: Calendar, color: 'text-amber-400 bg-amber-950/40' },
    { id: 'resource', label: 'Recursos', icon: LinkIcon, color: 'text-emerald-400 bg-emerald-950/40' },
    { id: 'book', label: 'Libros', icon: BookOpen, color: 'text-purple-400 bg-purple-950/40' },
    { id: 'concept', label: 'Conceptos', icon: Lightbulb, color: 'text-yellow-400 bg-yellow-950/40' }
  ];

  const filteredObjects = objects.filter(obj => {
    if (selectedType !== 'all' && obj.object_type !== selectedType) return false;
    return true;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    let parsedProps = {};
    try {
      parsedProps = JSON.parse(newProperties);
    } catch (e) {
      parsedProps = { raw: newProperties };
    }

    await onCreateObject({
      title: newTitle.trim(),
      object_type: newType,
      description: newDescription.trim() || undefined,
      project_id: newProjectId || undefined,
      properties: parsedProps
    });

    setNewTitle('');
    setNewDescription('');
    setNewProperties('{"rol": "", "contacto": ""}');
    setIsCreating(false);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'person': return <User className="w-4 h-4 text-blue-400" />;
      case 'meeting': return <Calendar className="w-4 h-4 text-amber-400" />;
      case 'resource': return <LinkIcon className="w-4 h-4 text-emerald-400" />;
      case 'book': return <BookOpen className="w-4 h-4 text-purple-400" />;
      case 'concept': return <Lightbulb className="w-4 h-4 text-yellow-400" />;
      default: return <Boxes className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-[#16161d] overflow-hidden">
      {/* Header */}
      <div className="px-8 py-5 border-b border-[#252530] bg-[#141419] flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Boxes className="w-5 h-5 text-emerald-400" />
            Objetos y Entidades (Capacities & Dataview)
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Estructura conceptos, personas, libros y recursos con propiedades dinámicas.
          </p>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm shadow-emerald-900/30"
        >
          <Plus className="w-4 h-4" />
          Nuevo Objeto
        </button>
      </div>

      {/* Filter Tabs by Object Type */}
      <div className="px-8 py-3 bg-[#131318] border-b border-[#23232f] flex items-center gap-2 overflow-x-auto">
        {types.map(t => {
          const Icon = t.icon;
          const count = t.id === 'all' 
            ? objects.length 
            : objects.filter(o => o.object_type === t.id).length;
          return (
            <button
              key={t.id}
              onClick={() => setSelectedType(t.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                selectedType === t.id
                  ? 'bg-[#22222e] text-white border border-[#3b3b4f]'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a22]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#292936] text-gray-400">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Objects Grid */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredObjects.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-400 text-xs">
              No hay objetos creados en esta categoría. Haz clic en "Nuevo Objeto" para registrar uno.
            </div>
          ) : (
            filteredObjects.map(obj => {
              const project = projects.find(p => p.id === obj.project_id);
              const props = obj.properties || {};

              return (
                <div
                  key={obj.id}
                  className="bg-[#1a1a24] rounded-xl border border-[#292938] hover:border-[#38384d] transition p-5 flex flex-col justify-between shadow-sm group"
                >
                  <div>
                    {/* Top Type & Title */}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#20202c] border border-[#2f2f40] flex items-center justify-center">
                          {getTypeIcon(obj.object_type)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm text-white leading-tight">
                            {obj.title}
                          </h3>
                          <span className="text-[10px] text-gray-400 uppercase tracking-wider font-mono">
                            {obj.object_type}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          if (confirm(`¿Eliminar objeto "${obj.title}"?`)) {
                            onDeleteObject(obj.id);
                          }
                        }}
                        className="text-gray-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition p-1"
                        title="Eliminar objeto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {obj.description && (
                      <p className="text-xs text-gray-400 mb-3 line-clamp-2">
                        {obj.description}
                      </p>
                    )}

                    {/* Key-Value Properties table */}
                    {Object.keys(props).length > 0 && (
                      <div className="bg-[#14141a] rounded-lg p-2.5 border border-[#232330] space-y-1 mb-3 text-[11px]">
                        {Object.entries(props).map(([k, v]) => (
                          <div key={k} className="flex justify-between items-center text-gray-400">
                            <span className="font-mono text-gray-400 capitalize">{k}:</span>
                            <span className="text-gray-200 truncate max-w-[150px]">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="pt-3 border-t border-[#232332] flex items-center justify-between text-xs text-gray-400">
                    {project ? (
                      <span className="flex items-center gap-1 text-[11px] text-blue-300">
                        <FolderKanban className="w-3 h-3" />
                        {project.title}
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-400">Sin proyecto</span>
                    )}

                    <span className="text-[10px] font-mono text-gray-400">
                      {new Date(obj.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal Nuevo Objeto */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={handleCreate} className="bg-[#1a1a24] border border-[#2f2f40] rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Boxes className="w-4 h-4 text-emerald-400" />
              Nuevo Objeto / Entidad
            </h3>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Tipo de Objeto</label>
              <select
                value={newType}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewType(val);
                  if (val === 'person') setNewProperties('{"rol": "Diseñador", "email": "contacto@mail.com"}');
                  else if (val === 'book') setNewProperties('{"autor": "", "año": 2026, "calificacion": 5}');
                  else if (val === 'meeting') setNewProperties('{"fecha": "2026-10-20", "participantes": "Equipo"}');
                  else setNewProperties('{}');
                }}
                className="w-full px-3 py-2 bg-[#121217] border border-[#2b2b3a] rounded-lg text-xs text-white outline-none cursor-pointer"
              >
                <option value="person">Persona (Contacto / Colaborador)</option>
                <option value="meeting">Reunión / Minuta</option>
                <option value="resource">Recurso / Link / Herramienta</option>
                <option value="book">Libro / Artículo</option>
                <option value="concept">Concepto / Idea</option>
                <option value="custom">Personalizado</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Nombre o Título</label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ej. Ana Morales, Atomic Habits, Minuta Sprint 4..."
                className="w-full px-3 py-2 bg-[#121217] border border-[#2b2b3a] rounded-lg text-xs text-white outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Descripción</label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Resumen o notas sobre este objeto..."
                rows={2}
                className="w-full px-3 py-2 bg-[#121217] border border-[#2b2b3a] rounded-lg text-xs text-white outline-none focus:border-emerald-500 resize-none"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Proyecto Vinculado</label>
              <select
                value={newProjectId}
                onChange={(e) => setNewProjectId(e.target.value)}
                className="w-full px-3 py-2 bg-[#121217] border border-[#2b2b3a] rounded-lg text-xs text-white outline-none cursor-pointer"
              >
                <option value="">Sin Proyecto</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Propiedades (JSON clave-valor)</label>
              <textarea
                value={newProperties}
                onChange={(e) => setNewProperties(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-[#121217] border border-[#2b2b3a] rounded-lg text-xs font-mono text-purple-300 outline-none focus:border-emerald-500 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-[#252533] transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-md"
              >
                Crear Objeto
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
