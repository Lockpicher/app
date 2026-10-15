import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Book, 
  Upload, 
  Palette, 
  Image as ImageIcon, 
  Check, 
  Trash2, 
  Archive, 
  Sparkles,
  AlertTriangle 
} from 'lucide-react';
import { AppNotebook, CoverType } from '../lib/types';
import { PRESET_COVERS, getCoverById } from '../lib/covers';
import { storage } from '../lib/insforge';

interface NotebookModalProps {
  isOpen: boolean;
  onClose: () => void;
  notebook: AppNotebook | null; // null if creating
  onSave: (data: Partial<AppNotebook>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export const NotebookModal: React.FC<NotebookModalProps> = ({
  isOpen,
  onClose,
  notebook,
  onSave,
  onDelete
}) => {
  const isEditing = !!notebook?.id;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverType, setCoverType] = useState<CoverType>('gallery');
  const [selectedPresetId, setSelectedPresetId] = useState(PRESET_COVERS[0].id);
  const [customCoverUrl, setCustomCoverUrl] = useState('');
  const [solidColor, setSolidColor] = useState('#3b82f6');
  const [isDefault, setIsDefault] = useState(false);
  const [isArchived, setIsArchived] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (notebook) {
        setName(notebook.name || '');
        setDescription(notebook.description || '');
        setCoverType(notebook.cover_type || 'gallery');
        if (notebook.cover_type === 'custom') {
          setCustomCoverUrl(notebook.cover_url || '');
        } else if (notebook.cover_type === 'gallery') {
          setSelectedPresetId(notebook.cover_url || PRESET_COVERS[0].id);
        }
        setSolidColor(notebook.color || '#3b82f6');
        setIsDefault(!!notebook.is_default);
        setIsArchived(!!notebook.is_archived);
      } else {
        setName('');
        setDescription('');
        setCoverType('gallery');
        setSelectedPresetId(PRESET_COVERS[0].id);
        setCustomCoverUrl('');
        setSolidColor('#3b82f6');
        setIsDefault(false);
        setIsArchived(false);
      }
      setErrorMsg(null);
    }
  }, [isOpen, notebook]);

  if (!isOpen) return null;

  const handleUploadCover = async (file: File) => {
    try {
      setIsUploading(true);
      setErrorMsg(null);
      const res = await storage.uploadFile(file, 'notebooks/covers');
      setCustomCoverUrl(res.url);
      setCoverType('custom');
    } catch (err: any) {
      console.error('Error subiendo portada:', err);
      setErrorMsg('Error al subir imagen de portada: ' + (err.message || 'Error de conexión'));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('El nombre del cuaderno es obligatorio.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      let coverUrlToSave = '';
      if (coverType === 'gallery') {
        coverUrlToSave = selectedPresetId;
      } else if (coverType === 'custom') {
        coverUrlToSave = customCoverUrl;
      }

      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        cover_type: coverType,
        cover_url: coverUrlToSave || undefined,
        color: solidColor,
        is_default: isDefault,
        is_archived: isArchived
      });

      onClose();
    } catch (err: any) {
      console.error('Error al guardar cuaderno:', err);
      setErrorMsg(err.message || 'Error al guardar el cuaderno en InsForge.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentPreset = getCoverById(selectedPresetId);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-[#181824] border border-[#2d2d40] rounded-2xl max-w-2xl w-full flex flex-col shadow-2xl overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#252538] flex items-center justify-between bg-[#14141e]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <Book className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-white">
              {isEditing ? `Editar Cuaderno: ${notebook.name}` : 'Crear Nuevo Cuaderno'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#252538] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="px-6 py-2.5 bg-red-950/60 border-b border-red-800/60 text-red-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Top Row: Name & 3:4 Live Preview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {/* Live 3:4 Cover Preview */}
            <div className="flex flex-col items-center">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Vista Previa (3:4)
              </span>
              <div className="w-36 h-48 rounded-xl shadow-xl overflow-hidden border border-[#3b3b52] relative flex flex-col justify-between p-3 transition transform hover:scale-102">
                {coverType === 'custom' && customCoverUrl ? (
                  <img
                    src={customCoverUrl}
                    alt="Portada personalizada"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : coverType === 'color' ? (
                  <div
                    className="absolute inset-0"
                    style={{ backgroundColor: solidColor }}
                  />
                ) : (
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${currentPreset.bgGradient}`}
                    style={{ backgroundImage: currentPreset.patternSvg }}
                  />
                )}

                {/* Notebook spine line */}
                <div className="absolute left-0 top-0 bottom-0 w-3 bg-black/25 backdrop-blur-[1px] border-r border-white/10" />

                {/* Inner title badge */}
                <div className="relative z-10 mt-auto bg-black/50 backdrop-blur-md px-2 py-1.5 rounded-lg border border-white/10">
                  <p className="text-[11px] font-bold text-white truncate text-center">
                    {name || 'Mi Cuaderno'}
                  </p>
                </div>
              </div>
            </div>

            {/* Fields */}
            <div className="md:col-span-2 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Nombre del Cuaderno <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Estrategia 2026, Diario Personal, Ideas..."
                  className="w-full px-3 py-2 bg-[#121218] border border-[#2c2c3e] rounded-xl text-xs text-white outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Descripción (opcional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Temática, propósitos o reglas de este cuaderno..."
                  rows={2}
                  className="w-full px-3 py-2 bg-[#121218] border border-[#2c2c3e] rounded-xl text-xs text-white outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="rounded bg-[#121218] border-[#2c2c3e] text-blue-600 focus:ring-0"
                  />
                  <span>Cuaderno Predeterminado</span>
                </label>

                {isEditing && (
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                    <input
                      type="checkbox"
                      checked={isArchived}
                      onChange={(e) => setIsArchived(e.target.checked)}
                      className="rounded bg-[#121218] border-[#2c2c3e] text-amber-600 focus:ring-0"
                    />
                    <span>Archivar Cuaderno</span>
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Cover Style Selector Tabs */}
          <div className="pt-3 border-t border-[#252538] space-y-3">
            <label className="text-xs font-semibold text-gray-300 block">
              Estilo de Portada
            </label>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCoverType('gallery')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  coverType === 'gallery'
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#14141e] text-gray-400 hover:text-white border border-[#29293a]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Galería de Diseños
              </button>

              <button
                type="button"
                onClick={() => setCoverType('custom')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  coverType === 'custom'
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#14141e] text-gray-400 hover:text-white border border-[#29293a]'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                Subir Imagen Propia
              </button>

              <button
                type="button"
                onClick={() => setCoverType('color')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  coverType === 'color'
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#14141e] text-gray-400 hover:text-white border border-[#29293a]'
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                Color Sólido
              </button>
            </div>

            {/* Gallery Picker */}
            {coverType === 'gallery' && (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5 max-h-48 overflow-y-auto p-2 bg-[#12121a] rounded-xl border border-[#262638]">
                {PRESET_COVERS.map(cover => {
                  const isSelected = selectedPresetId === cover.id;
                  return (
                    <button
                      key={cover.id}
                      type="button"
                      onClick={() => {
                        setSelectedPresetId(cover.id);
                        setSolidColor(cover.color);
                      }}
                      className={`h-20 rounded-lg overflow-hidden relative border-2 transition transform hover:scale-105 flex flex-col justify-end p-1.5 ${
                        isSelected ? 'border-blue-400 ring-2 ring-blue-500/30' : 'border-transparent'
                      }`}
                      style={{ backgroundImage: cover.patternSvg }}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${cover.bgGradient}`} />
                      <div className="relative z-10 text-[9px] font-bold text-white truncate text-center bg-black/40 rounded px-1">
                        {cover.name}
                      </div>
                      {isSelected && (
                        <div className="absolute top-1 right-1 z-10 w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center">
                          <Check className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Custom Image Upload */}
            {coverType === 'custom' && (
              <div className="p-4 bg-[#12121a] rounded-xl border border-[#262638] space-y-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleUploadCover(e.target.files[0]);
                    }
                  }}
                />

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
                  >
                    <Upload className={`w-3.5 h-3.5 ${isUploading ? 'animate-bounce' : ''}`} />
                    {isUploading ? 'Subiendo imagen...' : 'Seleccionar Imagen (JPG, PNG, WebP)'}
                  </button>

                  {customCoverUrl && (
                    <button
                      type="button"
                      onClick={() => setCustomCoverUrl('')}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Quitar imagen
                    </button>
                  )}
                </div>

                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">
                    O pega la URL directa de una imagen web:
                  </label>
                  <input
                    type="text"
                    value={customCoverUrl}
                    onChange={(e) => setCustomCoverUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-3 py-1.5 bg-[#171722] border border-[#2c2c3e] rounded-lg text-xs text-white outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Color Picker */}
            {coverType === 'color' && (
              <div className="p-4 bg-[#12121a] rounded-xl border border-[#262638] flex items-center gap-4">
                <input
                  type="color"
                  value={solidColor}
                  onChange={(e) => setSolidColor(e.target.value)}
                  className="w-12 h-10 rounded-lg bg-transparent cursor-pointer border border-[#2c2c3e] p-0.5"
                />
                <input
                  type="text"
                  value={solidColor}
                  onChange={(e) => setSolidColor(e.target.value)}
                  className="w-32 px-3 py-1.5 bg-[#171722] border border-[#2c2c3e] rounded-lg text-xs text-white font-mono outline-none"
                />
                <span className="text-xs text-gray-400">Elige cualquier color para la portada minimalista</span>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-[#252538] flex items-center justify-between">
            {isEditing && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`¿Eliminar cuaderno "${notebook.name}"? Sus notas se conservarán en el espacio general.`)) {
                    onDelete(notebook.id);
                    onClose();
                  }
                }}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 p-1.5 rounded-lg hover:bg-red-500/10 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar Cuaderno
              </button>
            ) : <div />}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs text-gray-400 hover:text-white rounded-lg hover:bg-[#252538] transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-md transition disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                {isSubmitting ? 'Guardando...' : (isEditing ? 'Guardar Cambios' : 'Crear Cuaderno')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
