import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Sparkles, 
  Check, 
  Layers, 
  Sliders, 
  HelpCircle,
  Tag,
  Hash,
  Calendar,
  Globe,
  Mail,
  CheckSquare,
  ListFilter
} from 'lucide-react';
import { ObjectTypeDefinition, ObjectFieldDefinition, ObjectFieldType } from '../lib/types';

interface CustomTypeBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (typeDef: ObjectTypeDefinition) => Promise<void>;
  existingTypes: ObjectTypeDefinition[];
}

const FIELD_TYPE_OPTIONS: { type: ObjectFieldType; label: string; icon: any }[] = [
  { type: 'text', label: 'Texto Corto', icon: Tag },
  { type: 'textarea', label: 'Texto Largo / Descripción', icon: Sliders },
  { type: 'number', label: 'Número', icon: Hash },
  { type: 'date', label: 'Fecha', icon: Calendar },
  { type: 'url', label: 'Enlace / URL', icon: Globe },
  { type: 'email', label: 'Correo Electrónico', icon: Mail },
  { type: 'checkbox', label: 'Casilla / Booleano (Sí/No)', icon: CheckSquare },
  { type: 'select', label: 'Menú Desplegable (Select)', icon: ListFilter },
  { type: 'multiselect', label: 'Selección Múltiple', icon: Layers },
];

const PRESET_ICONS = ['user', 'calendar', 'link', 'book', 'lightbulb', 'podcast', 'film', 'building', 'briefcase', 'map-pin', 'award', 'box', 'atom', 'plane', 'sparkles'];
const PRESET_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1', '#e11d48'];

export const CustomTypeBuilderModal: React.FC<CustomTypeBuilderModalProps> = ({
  isOpen,
  onClose,
  onSave,
  existingTypes
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Personalizado');
  const [selectedColor, setSelectedColor] = useState('#3b82f6');
  const [selectedIcon, setSelectedIcon] = useState('box');
  const [fields, setFields] = useState<ObjectFieldDefinition[]>([
    { key: 'nombre_corto', label: 'Nombre o Alias', type: 'text', required: true, visible: true },
    { key: 'estado', label: 'Estado / Fase', type: 'select', options: ['Activo', 'En Pausa', 'Completado'], visible: true }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddField = () => {
    const newField: ObjectFieldDefinition = {
      key: `campo_${Date.now().toString().slice(-4)}`,
      label: 'Nuevo Campo',
      type: 'text',
      required: false,
      visible: true
    };
    setFields(prev => [...prev, newField]);
  };

  const handleRemoveField = (index: number) => {
    setFields(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateField = (index: number, updates: Partial<ObjectFieldDefinition>) => {
    setFields(prev => prev.map((f, i) => {
      if (i === index) {
        const updated = { ...f, ...updates };
        if (updates.label && (!f.key || f.key.startsWith('campo_'))) {
          // Auto slugify key
          updated.key = updates.label.toLowerCase().trim().replace(/[^a-z0-9_]+/g, '_');
        }
        return updated;
      }
      return f;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('El nombre de la entidad es obligatorio.');
      return;
    }

    const slug = name.toLowerCase().trim().replace(/[^a-z0-9_]+/g, '_');
    if (existingTypes.some(t => t.id === slug)) {
      setError(`Ya existe una entidad con el identificador "${slug}". Elige otro nombre.`);
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const newTypeDef: ObjectTypeDefinition = {
        id: slug,
        name: name.trim(),
        description: description.trim() || undefined,
        category: category.trim() || 'Personalizado',
        icon: selectedIcon,
        color: selectedColor,
        fields,
        is_custom: true
      };

      await onSave(newTypeDef);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error guardando el tipo personalizado');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 z-50 animate-in fade-in duration-200">
      <div className="bg-[#181822] border border-[#2c2c3e] rounded-2xl max-w-2xl w-full flex flex-col max-h-[92vh] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#28283a] bg-[#14141c] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white leading-tight">
                Crear tu Propio Tipo de Objeto / Entidad
              </h3>
              <p className="text-[11px] text-gray-400">
                Diseña plantillas personalizadas (ej. Podcast, Cliente, Película, Vehículo) con atributos a medida.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#252535] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs flex items-center gap-2">
              <HelpCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Name & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-300 block mb-1.5">
                Nombre de la Entidad *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ej. Podcast, Empresa, Automóvil..."
                className="w-full px-3.5 py-2.5 bg-[#121218] border border-[#2d2d3e] rounded-xl text-xs sm:text-sm text-white placeholder-gray-500 outline-none focus:border-emerald-500 transition"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-300 block mb-1.5">
                Categoría Agrupadora
              </label>
              <input
                type="text"
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="Ej. Medios, Negocios, Colecciones..."
                className="w-full px-3.5 py-2.5 bg-[#121218] border border-[#2d2d3e] rounded-xl text-xs sm:text-sm text-white placeholder-gray-500 outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-gray-300 block mb-1.5">
              Descripción del Tipo
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="¿Qué representa este objeto en tu Segundo Cerebro?"
              className="w-full px-3.5 py-2 bg-[#121218] border border-[#2d2d3e] rounded-xl text-xs text-white placeholder-gray-500 outline-none focus:border-emerald-500 transition resize-none"
            />
          </div>

          {/* Color & Icon Picker */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="text-xs font-medium text-gray-300 block mb-2">
                Color de Identificación
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition ${
                      selectedColor === c ? 'ring-2 ring-white scale-110 shadow-lg' : 'opacity-80 hover:opacity-100'
                    }`}
                  >
                    {selectedColor === c && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-300 block mb-2">
                Ícono Representativo
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {PRESET_ICONS.map(ic => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setSelectedIcon(ic)}
                    className={`px-2 py-1 rounded-lg text-xs font-mono capitalize transition ${
                      selectedIcon === ic
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'bg-[#15151e] text-gray-400 hover:text-white border border-[#29293a]'
                    }`}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Dynamic Fields Section */}
          <div className="border-t border-[#252538] pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-xs sm:text-sm font-semibold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-400" />
                  <span>Campos y Atributos Personalizados ({fields.length})</span>
                </h4>
                <p className="text-[11px] text-gray-400">
                  Define qué datos pedir al registrar este objeto.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddField}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Añadir Campo</span>
              </button>
            </div>

            <div className="space-y-3">
              {fields.map((field, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-[#13131a] rounded-xl border border-[#252536] flex flex-col gap-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-[10px] font-mono text-gray-500 w-4">#{idx + 1}</span>
                      <input
                        type="text"
                        value={field.label}
                        onChange={e => handleUpdateField(idx, { label: e.target.value })}
                        placeholder="Nombre del atributo (ej. Presupuesto, Host, Calificación)"
                        className="flex-1 px-2.5 py-1.5 bg-[#1a1a24] border border-[#2f2f42] rounded-lg text-xs text-white outline-none focus:border-emerald-500"
                      />
                    </div>

                    <select
                      value={field.type}
                      onChange={e => handleUpdateField(idx, { type: e.target.value as ObjectFieldType })}
                      className="px-2.5 py-1.5 bg-[#1a1a24] border border-[#2f2f42] rounded-lg text-xs text-gray-200 outline-none cursor-pointer"
                    >
                      {FIELD_TYPE_OPTIONS.map(opt => (
                        <option key={opt.type} value={opt.type}>
                          {opt.label}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => handleRemoveField(idx)}
                      className="p-1.5 text-gray-500 hover:text-red-400 transition rounded-lg hover:bg-red-950/30"
                      title="Eliminar campo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Options editor for Select / MultiSelect */}
                  {(field.type === 'select' || field.type === 'multiselect') && (
                    <div className="pl-6">
                      <label className="text-[10px] text-gray-400 block mb-1">
                        Opciones separadas por coma:
                      </label>
                      <input
                        type="text"
                        value={(field.options || []).join(', ')}
                        onChange={e => handleUpdateField(idx, { 
                          options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
                        })}
                        placeholder="Ej. Alta, Media, Baja"
                        className="w-full px-2.5 py-1 bg-[#181822] border border-[#2c2c3e] rounded-lg text-xs text-purple-300 outline-none font-mono"
                      />
                    </div>
                  )}

                  <div className="pl-6 flex items-center gap-4 text-[11px] text-gray-400">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={field.required || false}
                        onChange={e => handleUpdateField(idx, { required: e.target.checked })}
                        className="rounded bg-[#1a1a24] border-gray-600 text-emerald-600 focus:ring-0"
                      />
                      <span>Obligatorio</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={field.visible !== false}
                        onChange={e => handleUpdateField(idx, { visible: e.target.checked })}
                        className="rounded bg-[#1a1a24] border-gray-600 text-emerald-600 focus:ring-0"
                      />
                      <span>Visible en tarjeta</span>
                    </label>

                    <span className="text-[10px] font-mono text-gray-600 ml-auto">
                      key: {field.key}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[#28283a] bg-[#14141c] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-gray-400 hover:text-white hover:bg-[#252535] transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`px-5 py-2 rounded-xl text-xs font-medium text-white transition shadow-lg flex items-center gap-1.5 ${
              isSubmitting ? 'bg-emerald-800 cursor-wait' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/40'
            }`}
          >
            {isSubmitting ? 'Guardando Tipo...' : 'Guardar y Habilitar Tipo'}
          </button>
        </div>
      </div>
    </div>
  );
};
