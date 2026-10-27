import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Excalidraw, 
  exportToBlob, 
  exportToSvg, 
  serializeAsJSON, 
  loadFromBlob,
  THEME 
} from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { 
  ArrowLeft, 
  Save, 
  Download, 
  Upload, 
  Image as ImageIcon, 
  Check, 
  Loader2, 
  AlertCircle, 
  FolderKanban, 
  Book, 
  Layers, 
  MoreHorizontal, 
  RefreshCw,
  Palette,
  FileImage,
  FileCode,
  Share2,
  Trash2,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { AppCanvas, AppProject, AppNotebook, AppArea, AppAttachment } from '../lib/types';
import { useTheme } from '../lib/themeContext';
import { db } from '../lib/insforge';
import { r2Storage } from '../lib/r2Client';

interface CanvasEditorProps {
  canvas: AppCanvas;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<AppCanvas>) => Promise<AppCanvas | null>;
  onDelete?: (id: string) => Promise<void>;
  projects?: AppProject[];
  notebooks?: AppNotebook[];
  areas?: AppArea[];
  attachments?: AppAttachment[];
  onAttachmentCreated?: (attachment: AppAttachment) => void;
}

export const CanvasEditor: React.FC<CanvasEditorProps> = ({
  canvas,
  onClose,
  onUpdate,
  onDelete,
  projects = [],
  notebooks = [],
  areas = [],
  attachments = [],
  onAttachmentCreated
}) => {
  const { theme } = useTheme();
  
  // Excalidraw API Ref
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);

  // Canvas State
  const [title, setTitle] = useState(canvas.title || 'Lienzo sin título');
  const [projectId, setProjectId] = useState<string | null>(canvas.project_id || null);
  const [notebookId, setNotebookId] = useState<string | null>(canvas.notebook_id || null);
  const [areaId, setAreaId] = useState<string | null>(canvas.area_id || null);

  // Auto-save Status
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty' | 'error'>('saved');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Refs for tracking changes
  const latestElementsRef = useRef<any[]>(canvas.elements || []);
  const latestAppStateRef = useRef<Record<string, any>>(canvas.app_state || {});
  const latestFilesRef = useRef<Record<string, any>>(canvas.files || {});
  const isSavingRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<any>(null);

  // Modals & Popovers
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isRelationsOpen, setIsRelationsOpen] = useState(false);
  const [isR2PickerOpen, setIsR2PickerOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Convert base64 dataURL to Blob for R2 upload
  const dataURLtoBlob = (dataURL: string): { blob: Blob; mime: string; ext: string } => {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
    const ext = mime.split('/')[1] || 'png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return { blob: new Blob([u8arr], { type: mime }), mime, ext };
  };

  // Upload any embedded base64 images to R2 before saving to database
  const syncFilesWithR2 = async (files: Record<string, any>): Promise<Record<string, any>> => {
    const updatedFiles = { ...files };
    let hasChanges = false;

    for (const fileId of Object.keys(updatedFiles)) {
      const fileObj = updatedFiles[fileId];
      if (fileObj && typeof fileObj.dataURL === 'string' && fileObj.dataURL.startsWith('data:')) {
        try {
          const { blob, mime, ext } = dataURLtoBlob(fileObj.dataURL);
          const uploadRes = await r2Storage.uploadFile(
            blob,
            `canvases/${canvas.id}/images`,
            `image_${fileId}.${ext}`
          );

          // Update file record with persistent remote URL
          updatedFiles[fileId] = {
            ...fileObj,
            dataURL: uploadRes.url,
            mimeType: mime
          };
          hasChanges = true;

          // Register in database attachments
          try {
            const att = await db.recordAttachment({
              entity_id: canvas.id,
              entity_type: 'canvas',
              file_name: uploadRes.name,
              display_name: uploadRes.name,
              file_url: uploadRes.url,
              file_path: uploadRes.r2Key,
              r2_key: uploadRes.provider === 'r2' ? uploadRes.r2Key : undefined,
              bucket_name: uploadRes.provider === 'r2' ? 'cloudflare-r2' : 'app-storage',
              storage_provider: uploadRes.provider,
              file_size: uploadRes.size,
              mime_type: mime,
              migration_status: uploadRes.provider === 'r2' ? 'migrated' : 'pending'
            });
            if (att && onAttachmentCreated) {
              onAttachmentCreated(att);
            }
          } catch (e) {
            console.warn('Error registrando adjunto de lienzo en DB:', e);
          }
        } catch (uploadErr) {
          console.warn('Error subiendo imagen base64 a R2:', uploadErr);
        }
      }
    }

    return hasChanges ? updatedFiles : files;
  };

  // Perform full persist
  const performSave = async () => {
    if (isSavingRef.current) return;
    try {
      isSavingRef.current = true;
      setSaveStatus('saving');
      setSaveError(null);

      // Clean base64 images into R2 URLs
      const cleanedFiles = await syncFilesWithR2(latestFilesRef.current);
      latestFilesRef.current = cleanedFiles;

      // Clean appState to keep essential viewport settings
      const stateToPersist = {
        viewBackgroundColor: latestAppStateRef.current.viewBackgroundColor || '#121212',
        zoom: latestAppStateRef.current.zoom || { value: 1 },
        scrollX: latestAppStateRef.current.scrollX || 0,
        scrollY: latestAppStateRef.current.scrollY || 0,
        theme: latestAppStateRef.current.theme || (theme === 'dark' ? 'dark' : 'light'),
        gridSize: latestAppStateRef.current.gridSize || null
      };

      const payload: Partial<AppCanvas> = {
        title: title.trim() || 'Lienzo sin título',
        elements: latestElementsRef.current || [],
        app_state: stateToPersist,
        files: cleanedFiles,
        project_id: projectId,
        notebook_id: notebookId,
        area_id: areaId,
        updated_at: new Date().toISOString()
      };

      await onUpdate(canvas.id, payload);
      setSaveStatus('saved');
    } catch (err: any) {
      console.error('Error al guardar lienzo:', err);
      setSaveStatus('error');
      setSaveError(err.message || 'Error de conexión');
    } finally {
      isSavingRef.current = false;
    }
  };

  // Trigger debounced save
  const scheduleAutoSave = () => {
    setSaveStatus('dirty');
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      performSave();
    }, 1200);
  };

  // Save immediately on title or relation changes
  useEffect(() => {
    if (
      title !== canvas.title || 
      projectId !== canvas.project_id || 
      notebookId !== canvas.notebook_id ||
      areaId !== canvas.area_id
    ) {
      scheduleAutoSave();
    }
  }, [title, projectId, notebookId, areaId]);

  // Clean timer on unmount and save pending changes
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (saveStatus === 'dirty') {
        performSave();
      }
    };
  }, []);

  // Excalidraw onChange handler
  const handleExcalidrawChange = (elements: readonly any[], appState: any, files: any) => {
    latestElementsRef.current = [...elements];
    latestAppStateRef.current = { ...appState };
    latestFilesRef.current = { ...files };
    scheduleAutoSave();
  };

  // Insert image from local device via Cloudflare R2
  const handleUploadImageFile = async (file: File) => {
    if (!file || !file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido.');
      return;
    }

    try {
      setIsUploadingImage(true);
      const res = await r2Storage.uploadFile(file, `canvases/${canvas.id}/images`);

      // Add image file to Excalidraw API
      const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      
      if (excalidrawAPI) {
        excalidrawAPI.addFiles([
          {
            id: fileId,
            dataURL: res.url,
            mimeType: file.type,
            created: Date.now()
          }
        ]);

        // Place image element in center of current viewport
        const appState = excalidrawAPI.getAppState();
        const zoom = appState.zoom.value || 1;
        const x = -appState.scrollX + (appState.width / 2) / zoom - 150;
        const y = -appState.scrollY + (appState.height / 2) / zoom - 100;

        const imageElement = {
          type: 'image',
          fileId: fileId,
          status: 'saved',
          x,
          y,
          width: 300,
          height: 200
        };

        const currentElements = excalidrawAPI.getSceneElements();
        excalidrawAPI.updateScene({
          elements: [...currentElements, imageElement]
        });
      }

      // Record in app_attachments
      try {
        const att = await db.recordAttachment({
          entity_id: canvas.id,
          entity_type: 'canvas',
          file_name: res.name,
          display_name: file.name,
          file_url: res.url,
          file_path: res.r2Key,
          r2_key: res.provider === 'r2' ? res.r2Key : undefined,
          bucket_name: res.provider === 'r2' ? 'cloudflare-r2' : 'app-storage',
          storage_provider: res.provider,
          file_size: res.size,
          mime_type: file.type,
          migration_status: res.provider === 'r2' ? 'migrated' : 'pending'
        });
        if (att && onAttachmentCreated) {
          onAttachmentCreated(att);
        }
      } catch (attErr) {
        console.warn('Error registrando adjunto:', attErr);
      }

      scheduleAutoSave();
    } catch (err: any) {
      alert('Error subiendo imagen a R2: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Insert image selected from R2 Library
  const handleInsertFromLibrary = (attachment: AppAttachment) => {
    if (!excalidrawAPI) return;
    const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    excalidrawAPI.addFiles([
      {
        id: fileId,
        dataURL: attachment.file_url,
        mimeType: attachment.mime_type || 'image/png',
        created: Date.now()
      }
    ]);

    const appState = excalidrawAPI.getAppState();
    const zoom = appState.zoom.value || 1;
    const x = -appState.scrollX + (appState.width / 2) / zoom - 150;
    const y = -appState.scrollY + (appState.height / 2) / zoom - 100;

    const imageElement = {
      type: 'image',
      fileId: fileId,
      status: 'saved',
      x,
      y,
      width: 300,
      height: 200
    };

    const currentElements = excalidrawAPI.getSceneElements();
    excalidrawAPI.updateScene({
      elements: [...currentElements, imageElement]
    });

    setIsR2PickerOpen(false);
    scheduleAutoSave();
  };

  // Export to PNG
  const handleExportPNG = async () => {
    if (!excalidrawAPI) return;
    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();

      const blob = await exportToBlob({
        elements,
        appState: {
          ...appState,
          exportBackground: true,
          viewBackgroundColor: appState.viewBackgroundColor || (theme === 'dark' ? '#121212' : '#ffffff')
        },
        files,
        mimeType: 'image/png'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/\s+/g, '_') || 'lienzo'}.png`;
      a.click();
      URL.revokeObjectURL(url);
      setIsExportMenuOpen(false);
    } catch (err: any) {
      alert('Error exportando a PNG: ' + err.message);
    }
  };

  // Export to SVG
  const handleExportSVG = async () => {
    if (!excalidrawAPI) return;
    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();

      const svg = await exportToSvg({
        elements,
        appState: {
          ...appState,
          exportBackground: true,
          viewBackgroundColor: appState.viewBackgroundColor || (theme === 'dark' ? '#121212' : '#ffffff')
        },
        files
      });

      const svgString = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/\s+/g, '_') || 'lienzo'}.svg`;
      a.click();
      URL.revokeObjectURL(url);
      setIsExportMenuOpen(false);
    } catch (err: any) {
      alert('Error exportando a SVG: ' + err.message);
    }
  };

  // Export to native .excalidraw file
  const handleExportJSON = () => {
    if (!excalidrawAPI) return;
    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();

      const jsonString = serializeAsJSON(elements, appState, files, 'local');
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/\s+/g, '_') || 'lienzo'}.excalidraw`;
      a.click();
      URL.revokeObjectURL(url);
      setIsExportMenuOpen(false);
    } catch (err: any) {
      alert('Error exportando archivo editable: ' + err.message);
    }
  };

  // Import native .excalidraw or .json file
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !excalidrawAPI) return;

    try {
      const sceneData = await loadFromBlob(file, null, null);
      if (sceneData) {
        excalidrawAPI.updateScene({
          elements: sceneData.elements,
          appState: sceneData.appState
        });
        if (sceneData.files) {
          excalidrawAPI.addFiles(Object.values(sceneData.files));
        }
        scheduleAutoSave();
      }
    } catch (err: any) {
      alert('Error al importar archivo de Excalidraw: ' + err.message);
    } finally {
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const imageAttachments = attachments.filter(a => {
    const mime = a.mime_type || '';
    const name = a.file_name.toLowerCase();
    return mime.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/.test(name);
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#121218] text-white select-none animate-in fade-in duration-150 overflow-hidden">
      {/* TOP HEADER BAR */}
      <div className="h-14 px-3 sm:px-5 bg-[#14141c] border-b border-[#252538] flex items-center justify-between gap-2 flex-shrink-0 z-20">
        {/* Left: Back button & Title */}
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <button
            type="button"
            onClick={async () => {
              if (saveStatus === 'dirty') {
                await performSave();
              }
              onClose();
            }}
            className="p-2 rounded-xl text-gray-300 hover:text-white hover:bg-[#20202e] transition"
            title="Volver a la vista anterior"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="w-7 h-7 rounded-lg bg-pink-500/20 text-pink-400 border border-pink-500/30 flex items-center justify-center flex-shrink-0">
            <Palette className="w-4 h-4" />
          </div>

          <div className="flex-1 min-w-0 max-w-xs sm:max-w-md">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nombre del lienzo..."
              className="w-full bg-transparent text-sm sm:text-base font-bold text-white outline-none placeholder-gray-500 truncate focus:bg-[#181824] px-2 py-1 rounded-lg transition"
            />
          </div>

          {/* Auto-save Status Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] bg-[#1a1a26] border border-[#2b2b3e]">
            {saveStatus === 'saving' && (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                <span className="text-blue-300">Guardando...</span>
              </>
            )}
            {saveStatus === 'saved' && (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-gray-300 font-medium">Guardado</span>
              </>
            )}
            {saveStatus === 'dirty' && (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-amber-300">Cambios pendientes</span>
              </>
            )}
            {saveStatus === 'error' && (
              <button
                type="button"
                onClick={performSave}
                className="flex items-center gap-1 text-rose-300 hover:underline"
                title={saveError || 'Reintentar guardado'}
              >
                <AlertCircle className="w-3 h-3 text-rose-400" />
                <span>Error (Reintentar)</span>
              </button>
            )}
          </div>
        </div>

        {/* Right: Actions (R2 Images, Export, Import, Relations, Save) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Relations (Project, Notebook, Area) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsRelationsOpen(prev => !prev)}
              className={`p-2 rounded-xl text-xs font-medium border transition flex items-center gap-1.5 ${
                projectId || notebookId || areaId
                  ? 'bg-blue-600/20 text-blue-300 border-blue-500/40'
                  : 'bg-[#1b1b26] text-gray-300 border-[#2a2a3e] hover:bg-[#252538]'
              }`}
              title="Vincular con Proyecto, Cuaderno o Área"
            >
              <FolderKanban className="w-4 h-4 text-blue-400" />
              <span className="hidden md:inline">Vínculos</span>
            </button>

            {isRelationsOpen && (
              <div 
                className="absolute right-0 top-full mt-2 w-72 bg-[#181824] border border-[#2c2c40] rounded-2xl p-3 shadow-2xl space-y-3 z-50 text-xs animate-in fade-in"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-[#252538]">
                  <span className="font-bold text-gray-200">Relaciones del lienzo</span>
                  <button 
                    type="button" 
                    onClick={() => setIsRelationsOpen(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                {/* Project Selector */}
                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">Proyecto</label>
                  <select
                    value={projectId || ''}
                    onChange={(e) => setProjectId(e.target.value || null)}
                    className="w-full bg-[#121217] border border-[#2b2b3e] rounded-xl px-2.5 py-1.5 text-xs text-white outline-none"
                  >
                    <option value="">Sin proyecto vinculado</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>

                {/* Notebook Selector */}
                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">Cuaderno</label>
                  <select
                    value={notebookId || ''}
                    onChange={(e) => setNotebookId(e.target.value || null)}
                    className="w-full bg-[#121217] border border-[#2b2b3e] rounded-xl px-2.5 py-1.5 text-xs text-white outline-none"
                  >
                    <option value="">Sin cuaderno vinculado</option>
                    {notebooks.map(nb => (
                      <option key={nb.id} value={nb.id}>{nb.name}</option>
                    ))}
                  </select>
                </div>

                {/* Area Selector */}
                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">Área de responsabilidad</label>
                  <select
                    value={areaId || ''}
                    onChange={(e) => setAreaId(e.target.value || null)}
                    className="w-full bg-[#121217] border border-[#2b2b3e] rounded-xl px-2.5 py-1.5 text-xs text-white outline-none"
                  >
                    <option value="">Sin área vinculada</option>
                    {areas.map(a => (
                      <option key={a.id} value={a.id}>{a.title}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Insert Image Button */}
          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleUploadImageFile(e.target.files[0]);
                }
              }}
            />
            <button
              type="button"
              disabled={isUploadingImage}
              onClick={() => setIsR2PickerOpen(prev => !prev)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition shadow-sm disabled:opacity-50"
              title="Insertar imagen desde R2 o equipo"
            >
              {isUploadingImage ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  <span className="hidden sm:inline">Subiendo a R2...</span>
                </>
              ) : (
                <>
                  <ImageIcon className="w-4 h-4 text-emerald-400" />
                  <span className="hidden sm:inline">Imagen</span>
                </>
              )}
            </button>

            {/* R2 Image Picker dropdown modal */}
            {isR2PickerOpen && (
              <div 
                className="absolute right-0 top-full mt-2 w-80 bg-[#181824] border border-[#2c2c40] rounded-2xl p-3 shadow-2xl space-y-3 z-50 text-xs animate-in fade-in"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-[#252538]">
                  <span className="font-bold text-gray-200 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Insertar imagen</span>
                  </span>
                  <button 
                    type="button" 
                    onClick={() => setIsR2PickerOpen(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                {/* Option 1: Upload from device */}
                <button
                  type="button"
                  onClick={() => {
                    setIsR2PickerOpen(false);
                    fileInputRef.current?.click();
                  }}
                  className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition shadow-md"
                >
                  <Upload className="w-4 h-4" />
                  <span>Subir desde dispositivo (a R2)</span>
                </button>

                {/* Option 2: Choose from R2 Attachments */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-gray-400 block">
                    O elegir de la biblioteca de archivos ({imageAttachments.length}):
                  </span>
                  
                  {imageAttachments.length === 0 ? (
                    <p className="text-[11px] text-gray-500 italic py-2 text-center">
                      No hay imágenes previas en la biblioteca.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
                      {imageAttachments.map(att => (
                        <div
                          key={att.id}
                          onClick={() => handleInsertFromLibrary(att)}
                          className="group relative aspect-square rounded-lg bg-[#14141c] border border-[#2a2a3c] hover:border-emerald-500 overflow-hidden cursor-pointer transition"
                          title={att.display_name || att.file_name}
                        >
                          <img 
                            src={att.file_url} 
                            alt={att.display_name || att.file_name}
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                            loading="lazy"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsExportMenuOpen(prev => !prev)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-semibold bg-[#1b1b26] hover:bg-[#252538] text-gray-200 border border-[#2a2a3e] transition"
              title="Exportar lienzo"
            >
              <Download className="w-4 h-4 text-purple-400" />
              <span className="hidden sm:inline">Exportar</span>
            </button>

            {isExportMenuOpen && (
              <div 
                className="absolute right-0 top-full mt-2 w-52 bg-[#181824] border border-[#2c2c40] rounded-2xl p-1.5 shadow-2xl space-y-1 z-50 text-xs animate-in fade-in"
                onClick={e => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={handleExportPNG}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-gray-200 hover:bg-[#222232] hover:text-white transition text-left"
                >
                  <FileImage className="w-4 h-4 text-emerald-400" />
                  <div>
                    <span className="block font-semibold">Exportar PNG</span>
                    <span className="block text-[10px] text-gray-400">Imagen de alta resolución</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleExportSVG}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-gray-200 hover:bg-[#222232] hover:text-white transition text-left"
                >
                  <FileCode className="w-4 h-4 text-purple-400" />
                  <div>
                    <span className="block font-semibold">Exportar SVG</span>
                    <span className="block text-[10px] text-gray-400">Formato vectorial escalable</span>
                  </div>
                </button>

                <div className="my-1 border-t border-[#252538]" />

                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-gray-200 hover:bg-[#222232] hover:text-white transition text-left"
                >
                  <Download className="w-4 h-4 text-blue-400" />
                  <div>
                    <span className="block font-semibold">Archivo .excalidraw</span>
                    <span className="block text-[10px] text-gray-400">Documento editable</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Import Button */}
          <input
            ref={importInputRef}
            type="file"
            accept=".excalidraw,.json"
            className="hidden"
            onChange={handleImportFile}
          />
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="p-2 rounded-xl bg-[#1b1b26] hover:bg-[#252538] text-gray-300 border border-[#2a2a3e] transition"
            title="Importar archivo .excalidraw"
          >
            <Upload className="w-4 h-4 text-amber-400" />
          </button>

          {/* Save explicit button */}
          <button
            type="button"
            onClick={performSave}
            disabled={saveStatus === 'saving'}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition shadow-md shadow-blue-900/30 disabled:opacity-50"
            title="Guardar cambios manualmente"
          >
            {saveStatus === 'saving' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Guardar</span>
          </button>
        </div>
      </div>

      {/* EXCALIDRAW CANVAS CONTAINER */}
      <div className="flex-1 w-full h-[calc(100vh-3.5rem)] relative overflow-hidden">
        <Excalidraw
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          theme={theme === 'dark' ? THEME.DARK : THEME.LIGHT}
          initialData={{
            elements: canvas.elements || [],
            appState: {
              ...(canvas.app_state || {}),
              theme: theme === 'dark' ? THEME.DARK : THEME.LIGHT,
              viewBackgroundColor: canvas.app_state?.viewBackgroundColor || (theme === 'dark' ? '#121218' : '#ffffff')
            },
            files: canvas.files || {}
          }}
          onChange={handleExcalidrawChange}
          isCollaborating={false}
          UIOptions={{
            canvasActions: {
              changeViewBackgroundColor: true,
              clearCanvas: true,
              export: false, // Usamos nuestro export nativo integrado con Segundo Cerebro
              loadScene: false,
              saveToActiveFile: false,
              toggleTheme: true
            }
          }}
        />
      </div>
    </div>
  );
};
