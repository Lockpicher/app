import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Editor, EditorContent } from '@tiptap/react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  MapPin, 
  Navigation, 
  ExternalLink, 
  Search, 
  Globe, 
  Phone, 
  Mail, 
  Clock, 
  Calendar, 
  User, 
  Building2, 
  Plane, 
  CheckSquare, 
  FileText, 
  Plus, 
  Trash2, 
  Edit3, 
  Camera, 
  Upload, 
  Loader2, 
  Check, 
  X, 
  Share2, 
  Crosshair, 
  Layers, 
  Tag, 
  Sparkles, 
  Copy, 
  Eye, 
  ChevronRight, 
  Compass, 
  MessageSquare,
  AlertCircle,
  Table,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Quote,
  Code,
  Image as ImageIcon,
  Mic
} from 'lucide-react';
import { 
  AppObject, 
  AppProject, 
  AppArea, 
  AppNote, 
  AppTask, 
  AppAttachment, 
  AppLink, 
  PlaceVisitLog,
  PlaceProperties 
} from '../lib/types';
import { db } from '../lib/insforge';
import { r2Storage } from '../lib/r2Client';
import { EntityAttachmentsSection } from './EntityAttachmentsSection';
import { UniversalLinkSelectorModal, UniversalLinkItem } from './UniversalLinkSelectorModal';
import { DatePickerInput } from './DatePickerInput';
import { TableGridPicker } from './TableGridPicker';
import { TableToolbar } from './TableToolbar';

export interface PlaceProfileViewProps {
  object: AppObject;
  properties: Record<string, any>;
  onPropertyChange: (key: string, val: any) => void;
  title: string;
  onTitleChange: (newTitle: string) => void;
  description: string;
  onDescriptionChange: (newDesc: string) => void;
  thumbnailUrl: string;
  onThumbnailUrlChange: (newUrl: string) => void;
  editor: Editor | null;
  editorImageInputRef: React.RefObject<HTMLInputElement>;
  onUploadImage: (file: File) => Promise<void>;
  allObjects: AppObject[];
  projects: AppProject[];
  areas: AppArea[];
  notes: AppNote[];
  tasks?: AppTask[];
  attachments: AppAttachment[];
  onAttachmentCreated: (att: AppAttachment) => void;
  onAttachmentDeleted: (id: string, path: string) => void;
  outgoingLinks: AppLink[];
  incomingLinks: AppLink[];
  onOpenLinkSelector: () => void;
  onOpenNote?: (note: AppNote) => void;
  onNavigateToObject?: (object: AppObject) => void;
  onNavigateToEntity?: (id: string, type: string) => void;
  onSaveStatusChange: (status: 'saved' | 'saving' | 'dirty') => void;
  onOpenAudioModal?: () => void;
}

const PLACE_TYPE_PRESETS = [
  'Residencia',
  'Oficina',
  'Lugar de trabajo',
  'Lugar comercial',
  'Restaurante',
  'Hotel',
  'Lugar turístico',
  'Zona rural',
  'Centro cultural',
  'Salud / Médico',
  'Educativo',
  'Deportivo',
  'Otro'
];

type PlaceTab = 'resumen' | 'ubicacion' | 'contacto' | 'fotos_archivos' | 'relaciones' | 'historial';

export const PlaceProfileView: React.FC<PlaceProfileViewProps> = ({
  object,
  properties,
  onPropertyChange,
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  thumbnailUrl,
  onThumbnailUrlChange,
  editor,
  editorImageInputRef,
  onUploadImage,
  allObjects,
  projects,
  areas,
  notes,
  tasks = [],
  attachments,
  onAttachmentCreated,
  onAttachmentDeleted,
  outgoingLinks,
  incomingLinks,
  onOpenLinkSelector,
  onOpenNote,
  onNavigateToObject,
  onNavigateToEntity,
  onSaveStatusChange,
  onOpenAudioModal
}) => {
  const [activeTab, setActiveTab] = useState<PlaceTab>('resumen');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [copiedCoords, setCopiedCoords] = useState(false);
  const [relationFilter, setRelationFilter] = useState<'all' | 'person' | 'company' | 'trip' | 'task' | 'note'>('all');
  const [isLinkSelectorOpen, setIsLinkSelectorOpen] = useState(false);
  const [linkRelationLabel, setLinkRelationLabel] = useState('Ubicado en');

  // New visit modal / form state
  const [isAddingVisit, setIsAddingVisit] = useState(false);
  const [newVisitDate, setNewVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [newVisitMotivo, setNewVisitMotivo] = useState('');
  const [newVisitAcompanantes, setNewVisitAcompanantes] = useState('');
  const [newVisitNotas, setNewVisitNotas] = useState('');

  // Map refs for interactive editor
  const interactiveMapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerInstanceRef = useRef<L.Marker | null>(null);

  // Mini map ref for summary
  const miniMapRef = useRef<HTMLDivElement>(null);
  const miniMapInstanceRef = useRef<L.Map | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const lat = Number(properties.latitud ?? properties.lat);
  const lng = Number(properties.longitud ?? properties.lng);
  const hasCoordinates = !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;

  const fullAddress = [
    properties.direccion,
    properties.barrio,
    properties.ciudad,
    properties.departamento,
    properties.pais
  ].filter(Boolean).join(', ');

  // Photo gallery from properties
  const galleryPhotos: string[] = properties.fotos_adicionales || [];
  const visitsHistory: PlaceVisitLog[] = properties.visitas_historial || [];

  // Filter linked entities
  const linkedItems = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      type: 'person' | 'company' | 'trip' | 'task' | 'note' | 'object' | 'project';
      relationLabel: string;
      raw: any;
    }> = [];

    // Outgoing & incoming links
    const allLinks = [
      ...outgoingLinks.map(l => ({ targetId: l.to_id, label: l.relation_label || l.link_type || 'Vínculo', isOut: true })),
      ...incomingLinks.map(l => ({ targetId: l.from_id, label: l.relation_label || l.link_type || 'Vínculo', isOut: false }))
    ];

    allLinks.forEach(link => {
      // 1. Check in objects
      const foundObj = allObjects.find(o => o.id === link.targetId);
      if (foundObj) {
        let type: any = 'object';
        if (foundObj.object_type === 'person') type = 'person';
        else if (foundObj.object_type === 'company') type = 'company';
        else if (foundObj.object_type === 'trip') type = 'trip';

        list.push({
          id: foundObj.id,
          title: foundObj.title,
          type,
          relationLabel: link.label,
          raw: foundObj
        });
        return;
      }

      // 2. Check in tasks
      const foundTask = tasks.find(t => t.id === link.targetId);
      if (foundTask) {
        list.push({
          id: foundTask.id,
          title: foundTask.title,
          type: 'task',
          relationLabel: link.label,
          raw: foundTask
        });
        return;
      }

      // 3. Check in notes
      const foundNote = notes.find(n => n.id === link.targetId);
      if (foundNote) {
        list.push({
          id: foundNote.id,
          title: foundNote.title,
          type: 'note',
          relationLabel: link.label,
          raw: foundNote
        });
        return;
      }
    });

    return list;
  }, [outgoingLinks, incomingLinks, allObjects, tasks, notes]);

  const filteredLinks = useMemo(() => {
    if (relationFilter === 'all') return linkedItems;
    return linkedItems.filter(item => item.type === relationFilter);
  }, [linkedItems, relationFilter]);

  // Geocoding helper using OpenStreetMap Nominatim
  const handleAutoGeocode = async () => {
    const query = [properties.direccion, properties.barrio, properties.ciudad, properties.departamento, properties.pais]
      .filter(Boolean)
      .join(', ') || title;

    if (!query) {
      alert('Ingresa una dirección, ciudad o país para buscar en el mapa.');
      return;
    }

    try {
      setIsGeocoding(true);
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'es,en' } });
      const data = await res.json();

      if (data && data.length > 0) {
        const item = data[0];
        const newLat = parseFloat(item.lat);
        const newLng = parseFloat(item.lon);
        onPropertyChange('latitud', Number(newLat.toFixed(6)));
        onPropertyChange('longitud', Number(newLng.toFixed(6)));
        onSaveStatusChange('dirty');

        // Move marker on interactive map if visible
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([newLat, newLng], 15);
          if (markerInstanceRef.current) {
            markerInstanceRef.current.setLatLng([newLat, newLng]);
          } else {
            markerInstanceRef.current = L.marker([newLat, newLng]).addTo(mapInstanceRef.current);
          }
        }
      } else {
        alert('No se encontraron coordenadas exactas. Intenta con un nombre de ciudad o dirección más general, o haz clic directamente sobre el mapa.');
      }
    } catch (e: any) {
      console.warn('Error en geocodificación:', e);
      alert('Error consultando el servicio de geolocalización: ' + e.message);
    } finally {
      setIsGeocoding(false);
    }
  };

  // Copy GPS Coordinates
  const handleCopyCoords = () => {
    if (!hasCoordinates) return;
    navigator.clipboard.writeText(`${lat}, ${lng}`);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 2000);
  };

  // Upload main thumbnail to R2
  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingPhoto(true);
      const res = await r2Storage.uploadFile(file, `places/${object.id}/cover`);
      onThumbnailUrlChange(res.url);
      onSaveStatusChange('dirty');
    } catch (err: any) {
      alert('Error al subir la fotografía: ' + err.message);
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Upload additional gallery photos to R2
  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setIsUploadingPhoto(true);
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const res = await r2Storage.uploadFile(file, `places/${object.id}/gallery`);
        newUrls.push(res.url);
      }
      const updatedGallery = [...galleryPhotos, ...newUrls];
      onPropertyChange('fotos_adicionales', updatedGallery);
      onSaveStatusChange('dirty');
    } catch (err: any) {
      alert('Error al subir fotografías: ' + err.message);
    } finally {
      setIsUploadingPhoto(false);
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  // Remove photo from gallery
  const handleRemoveGalleryPhoto = (indexToRemove: number) => {
    const updated = galleryPhotos.filter((_, idx) => idx !== indexToRemove);
    onPropertyChange('fotos_adicionales', updated);
    onSaveStatusChange('dirty');
  };

  // Add visit to history
  const handleAddVisit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVisitDate) return;

    const newLog: PlaceVisitLog = {
      id: crypto.randomUUID(),
      fecha: newVisitDate,
      motivo: newVisitMotivo.trim() || undefined,
      acompanantes: newVisitAcompanantes.trim() || undefined,
      notas: newVisitNotas.trim() || undefined
    };

    const updated = [newLog, ...visitsHistory];
    onPropertyChange('visitas_historial', updated);
    onPropertyChange('fecha_ultima_visita', newVisitDate);
    onSaveStatusChange('dirty');

    // Reset form
    setNewVisitMotivo('');
    setNewVisitAcompanantes('');
    setNewVisitNotas('');
    setIsAddingVisit(false);
  };

  // Delete visit
  const handleDeleteVisit = (visitId: string) => {
    const updated = visitsHistory.filter(v => v.id !== visitId);
    onPropertyChange('visitas_historial', updated);
    if (updated.length > 0) {
      onPropertyChange('fecha_ultima_visita', updated[0].fecha);
    }
    onSaveStatusChange('dirty');
  };

  // Initialize Interactive Map when 'ubicacion' tab is active
  useEffect(() => {
    if (activeTab !== 'ubicacion' || !interactiveMapRef.current) return;

    const initialLat = hasCoordinates ? lat : 4.7110;
    const initialLng = hasCoordinates ? lng : -74.0721;
    const initialZoom = hasCoordinates ? 15 : 6;

    const map = L.map(interactiveMapRef.current, {
      center: [initialLat, initialLng],
      zoom: initialZoom,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    if (hasCoordinates) {
      markerInstanceRef.current = L.marker([lat, lng], { draggable: true }).addTo(map);
      markerInstanceRef.current.on('dragend', (event) => {
        const marker = event.target;
        const position = marker.getLatLng();
        onPropertyChange('latitud', Number(position.lat.toFixed(6)));
        onPropertyChange('longitud', Number(position.lng.toFixed(6)));
        onSaveStatusChange('dirty');
      });
    }

    // Click anywhere on the map to set / move marker
    map.on('click', (e: L.LeafletMouseEvent) => {
      const newLat = Number(e.latlng.lat.toFixed(6));
      const newLng = Number(e.latlng.lng.toFixed(6));
      onPropertyChange('latitud', newLat);
      onPropertyChange('longitud', newLng);
      onSaveStatusChange('dirty');

      if (markerInstanceRef.current) {
        markerInstanceRef.current.setLatLng([newLat, newLng]);
      } else {
        markerInstanceRef.current = L.marker([newLat, newLng], { draggable: true }).addTo(map);
        markerInstanceRef.current.on('dragend', (event) => {
          const marker = event.target;
          const pos = marker.getLatLng();
          onPropertyChange('latitud', Number(pos.lat.toFixed(6)));
          onPropertyChange('longitud', Number(pos.lng.toFixed(6)));
          onSaveStatusChange('dirty');
        });
      }
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerInstanceRef.current = null;
    };
  }, [activeTab]);

  // Mini Map in 'resumen' tab
  useEffect(() => {
    if (activeTab !== 'resumen' || !miniMapRef.current || !hasCoordinates) return;

    const miniMap = L.map(miniMapRef.current, {
      center: [lat, lng],
      zoom: 14,
      zoomControl: false,
      dragging: false,
      touchZoom: false,
      scrollWheelZoom: false,
      doubleClickZoom: false
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(miniMap);

    L.marker([lat, lng]).addTo(miniMap);
    miniMapInstanceRef.current = miniMap;

    return () => {
      miniMap.remove();
      miniMapInstanceRef.current = null;
    };
  }, [activeTab, lat, lng, hasCoordinates]);

  return (
    <div className="space-y-6">
      {/* 1. CABECERA VISUAL DEL LUGAR */}
      <div className="relative rounded-3xl bg-gradient-to-b from-[#1c1c28] to-[#14141d] border border-[#2b2b3d] p-5 sm:p-7 shadow-xl overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="flex flex-col sm:flex-row items-start gap-5 relative z-10">
          {/* Fotografía principal / Avatar del Lugar */}
          <div className="relative group shrink-0">
            {thumbnailUrl ? (
              <img loading="lazy" decoding="async" src={thumbnailUrl}
                alt={title}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-emerald-500/40 shadow-lg"
              />
            ) : (
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-emerald-950/80 to-emerald-900/40 border-2 border-emerald-500/30 text-emerald-400 flex flex-col items-center justify-center shadow-lg">
                <MapPin className="w-10 h-10" />
                <span className="text-[10px] uppercase font-bold tracking-wider mt-1 text-emerald-300">Lugar</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingPhoto}
              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 rounded-2xl flex flex-col items-center justify-center text-white transition gap-1 cursor-pointer"
              title="Cambiar fotografía principal"
            >
              {isUploadingPhoto ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
              <span className="text-[10px] font-medium">{isUploadingPhoto ? 'Subiendo...' : 'Cambiar foto'}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleThumbnailUpload}
            />
          </div>

          {/* Información principal editable */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {/* Tipo de Lugar Badge */}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-semibold">
                <MapPin className="w-3.5 h-3.5" />
                <span>{properties.place_type || 'Lugar general'}</span>
              </div>

              {properties.ciudad && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <span>•</span>
                  <span>{properties.ciudad}{properties.pais ? `, ${properties.pais}` : ''}</span>
                </span>
              )}
            </div>

            {/* Title Input */}
            <input
              type="text"
              value={title}
              onChange={e => {
                onTitleChange(e.target.value);
                onSaveStatusChange('dirty');
              }}
              placeholder="Nombre del lugar..."
              className="w-full bg-transparent text-xl sm:text-2xl font-black text-white placeholder-gray-500 border-none outline-none focus:ring-0 p-0 tracking-tight"
            />

            {/* Description Input */}
            <input
              type="text"
              value={description}
              onChange={e => {
                onDescriptionChange(e.target.value);
                onSaveStatusChange('dirty');
              }}
              placeholder="Descripción breve o resumen del lugar..."
              className="w-full bg-transparent text-xs sm:text-sm text-gray-400 placeholder-gray-600 border-none outline-none focus:ring-0 p-0"
            />

            {/* Quick Actions Row */}
            <div className="flex flex-wrap items-center gap-2 pt-2 text-xs">
              {hasCoordinates && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#20202e] hover:bg-[#28283a] text-blue-300 border border-blue-500/30 transition font-medium"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Google Maps</span>
                </a>
              )}

              {hasCoordinates && (
                <button
                  type="button"
                  onClick={handleCopyCoords}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#20202e] hover:bg-[#28283a] text-gray-300 border border-[#323246] transition font-medium"
                  title="Copiar coordenadas GPS"
                >
                  <Copy className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{copiedCoords ? '¡Copiado!' : `${lat.toFixed(4)}, ${lng.toFixed(4)}`}</span>
                </button>
              )}

              {properties.telefono && (
                <a
                  href={`tel:${properties.telefono}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#20202e] hover:bg-[#28283a] text-gray-300 border border-[#323246] transition font-medium"
                >
                  <Phone className="w-3.5 h-3.5 text-blue-400" />
                  <span>{properties.telefono}</span>
                </a>
              )}

              <button
                type="button"
                onClick={() => {
                  setLinkRelationLabel('Ubicado en');
                  setIsLinkSelectorOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 transition font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Vincular entidad</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. PESTAÑAS DE NAVEGACIÓN DE LA FICHA */}
      <div className="flex items-center gap-1.5 border-b border-[#252538] pb-1 overflow-x-auto no-scrollbar text-xs font-semibold">
        {[
          { id: 'resumen', label: 'Resumen', icon: MapPin },
          { id: 'ubicacion', label: 'Ubicación y mapa', icon: Navigation },
          { id: 'contacto', label: 'Contacto', icon: Phone },
          { id: 'fotos_archivos', label: 'Fotos y archivos', count: galleryPhotos.length + attachments.length, icon: Camera },
          { id: 'relaciones', label: 'Relaciones', count: linkedItems.length, icon: Share2 },
          { id: 'historial', label: 'Visitas e historial', count: visitsHistory.length, icon: Clock }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as PlaceTab)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition whitespace-nowrap ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                  : 'text-gray-400 hover:text-white hover:bg-[#1a1a24]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${isActive ? 'bg-black/30 text-emerald-200' : 'bg-[#222230] text-gray-400'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 3. CONTENIDO DE LAS PESTAÑAS */}

      {/* TAB 1: RESUMEN */}
      {activeTab === 'resumen' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Métricas / Datos clave */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-[#171722] border border-[#262638] space-y-1">
              <span className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold block">Clasificación</span>
              <select
                value={properties.place_type || 'Residencia'}
                onChange={e => {
                  onPropertyChange('place_type', e.target.value);
                  onSaveStatusChange('dirty');
                }}
                className="w-full bg-[#12121b] border border-[#2b2b3e] rounded-xl px-2 py-1 text-xs text-white outline-none cursor-pointer"
              >
                {PLACE_TYPE_PRESETS.map(preset => (
                  <option key={preset} value={preset}>{preset}</option>
                ))}
              </select>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#171722] border border-[#262638] space-y-1">
              <span className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold block">Ubicación</span>
              <p className="text-xs font-bold text-white truncate">
                {[properties.ciudad, properties.pais].filter(Boolean).join(', ') || 'No especificada'}
              </p>
              <span className="text-[10px] text-gray-500 truncate block">
                {properties.barrio || properties.direccion || 'Sin dirección exacta'}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#171722] border border-[#262638] space-y-1">
              <span className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold block">Última Visita</span>
              <p className="text-xs font-bold text-emerald-400 truncate">
                {properties.fecha_ultima_visita || 'Sin visitas'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('historial');
                  setIsAddingVisit(true);
                }}
                className="text-[10px] text-gray-400 hover:text-emerald-300 underline"
              >
                + Registrar visita
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#171722] border border-[#262638] space-y-1">
              <span className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold block">GPS / Mapa</span>
              <p className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${hasCoordinates ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span>{hasCoordinates ? 'Georreferenciado' : 'Sin coordenadas'}</span>
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('ubicacion')}
                className="text-[10px] text-blue-400 hover:underline block"
              >
                {hasCoordinates ? 'Ver en mapa' : 'Agregar coordenadas'}
              </button>
            </div>
          </div>

          {/* Mini Mapa Preview & Dirección */}
          {hasCoordinates && (
            <div className="p-4 rounded-2xl bg-[#171722] border border-[#262638] space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Vista en Mapa</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setActiveTab('ubicacion')}
                  className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <span>Mapa interactivo completo</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div 
                ref={miniMapRef} 
                className="w-full h-44 rounded-xl overflow-hidden border border-[#2b2b3e] shadow-inner" 
              />
              <p className="text-xs text-gray-400 font-mono">
                {fullAddress || `${lat}, ${lng}`}
              </p>
            </div>
          )}

          {/* Editor de Notas y Observaciones */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#171722] border border-[#262638] space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                <span>Notas y Observaciones del Lugar</span>
              </h4>
              {onOpenAudioModal && (
                <button
                  type="button"
                  onClick={onOpenAudioModal}
                  className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#20202e] text-xs flex items-center gap-1"
                  title="Grabar nota de voz"
                >
                  <Mic className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Insertar Audio</span>
                </button>
              )}
            </div>

            {editor && (
              <div className="prose prose-invert max-w-none text-sm min-h-[160px] bg-[#111118] border border-[#242436] p-4 rounded-xl focus-within:border-emerald-500 transition">
                <EditorContent editor={editor} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: UBICACIÓN Y MAPA INTERACTIVO */}
      {activeTab === 'ubicacion' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Formulario de Ubicación Geográfica */}
          <div className="p-5 rounded-2xl bg-[#171722] border border-[#262638] space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Navigation className="w-4 h-4 text-emerald-400" />
                <span>Coordenadas y Datos Geográficos</span>
              </h4>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAutoGeocode}
                  disabled={isGeocoding}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 transition disabled:opacity-50"
                  title="Buscar coordenadas automáticamente a partir de la dirección"
                >
                  {isGeocoding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crosshair className="w-3.5 h-3.5" />}
                  <span>Geocodificar dirección</span>
                </button>

                {hasCoordinates && (
                  <button
                    type="button"
                    onClick={() => {
                      onPropertyChange('latitud', null);
                      onPropertyChange('longitud', null);
                      onSaveStatusChange('dirty');
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-[#222230] hover:bg-red-950/40 text-gray-400 hover:text-red-300 text-xs transition"
                    title="Eliminar coordenadas guardadas"
                  >
                    Borrar coordenadas
                  </button>
                )}
              </div>
            </div>

            {/* Inputs de Ubicación */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-gray-400 font-medium mb-1">País:</label>
                <input
                  type="text"
                  value={properties.pais || ''}
                  onChange={e => {
                    onPropertyChange('pais', e.target.value);
                    onSaveStatusChange('dirty');
                  }}
                  placeholder="Ej: Colombia, España, México..."
                  className="w-full px-3 py-2 rounded-xl bg-[#111118] border border-[#2a2a3e] text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-gray-400 font-medium mb-1">Departamento / Estado / Región:</label>
                <input
                  type="text"
                  value={properties.departamento || ''}
                  onChange={e => {
                    onPropertyChange('departamento', e.target.value);
                    onSaveStatusChange('dirty');
                  }}
                  placeholder="Ej: Cundinamarca, Antioquia, Madrid..."
                  className="w-full px-3 py-2 rounded-xl bg-[#111118] border border-[#2a2a3e] text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-gray-400 font-medium mb-1">Ciudad / Municipio:</label>
                <input
                  type="text"
                  value={properties.ciudad || ''}
                  onChange={e => {
                    onPropertyChange('ciudad', e.target.value);
                    onSaveStatusChange('dirty');
                  }}
                  placeholder="Ej: Bogotá, Medellín, Barcelona..."
                  className="w-full px-3 py-2 rounded-xl bg-[#111118] border border-[#2a2a3e] text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-gray-400 font-medium mb-1">Barrio / Sector / Localidad:</label>
                <input
                  type="text"
                  value={properties.barrio || ''}
                  onChange={e => {
                    onPropertyChange('barrio', e.target.value);
                    onSaveStatusChange('dirty');
                  }}
                  placeholder="Ej: Chapinero, Poblado, Centro..."
                  className="w-full px-3 py-2 rounded-xl bg-[#111118] border border-[#2a2a3e] text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-gray-400 font-medium mb-1">Dirección específica:</label>
                <input
                  type="text"
                  value={properties.direccion || ''}
                  onChange={e => {
                    onPropertyChange('direccion', e.target.value);
                    onSaveStatusChange('dirty');
                  }}
                  placeholder="Ej: Carrera 7 # 71-21, Calle 100..."
                  className="w-full px-3 py-2 rounded-xl bg-[#111118] border border-[#2a2a3e] text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-gray-400 font-medium mb-1">Código Postal (opcional):</label>
                <input
                  type="text"
                  value={properties.codigo_postal || ''}
                  onChange={e => {
                    onPropertyChange('codigo_postal', e.target.value);
                    onSaveStatusChange('dirty');
                  }}
                  placeholder="Ej: 110111"
                  className="w-full px-3 py-2 rounded-xl bg-[#111118] border border-[#2a2a3e] text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-gray-400 font-medium mb-1">Latitud GPS:</label>
                <input
                  type="number"
                  step="any"
                  value={properties.latitud ?? ''}
                  onChange={e => {
                    const v = e.target.value ? parseFloat(e.target.value) : null;
                    onPropertyChange('latitud', v);
                    onSaveStatusChange('dirty');
                  }}
                  placeholder="Ej: 4.6097"
                  className="w-full px-3 py-2 rounded-xl bg-[#111118] border border-[#2a2a3e] text-emerald-300 font-mono outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-gray-400 font-medium mb-1">Longitud GPS:</label>
                <input
                  type="number"
                  step="any"
                  value={properties.longitud ?? ''}
                  onChange={e => {
                    const v = e.target.value ? parseFloat(e.target.value) : null;
                    onPropertyChange('longitud', v);
                    onSaveStatusChange('dirty');
                  }}
                  placeholder="Ej: -74.0817"
                  className="w-full px-3 py-2 rounded-xl bg-[#111118] border border-[#2a2a3e] text-emerald-300 font-mono outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-gray-400 font-medium mb-1">Enlace a Google Maps:</label>
                <input
                  type="url"
                  value={properties.google_maps_url || ''}
                  onChange={e => {
                    onPropertyChange('google_maps_url', e.target.value);
                    onSaveStatusChange('dirty');
                  }}
                  placeholder="https://maps.google.com/..."
                  className="w-full px-3 py-2 rounded-xl bg-[#111118] border border-[#2a2a3e] text-blue-300 outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Interactive Map Picker */}
          <div className="p-5 rounded-2xl bg-[#171722] border border-[#262638] space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span>Selector de Ubicación en Mapa</span>
              </h4>
              <p className="text-[11px] text-gray-400">
                Haz clic en el mapa para posicionar o arrastra el pin.
              </p>
            </div>

            <div 
              ref={interactiveMapRef} 
              className="w-full h-96 rounded-2xl overflow-hidden border border-[#2c2c40] shadow-2xl relative z-0" 
            />
          </div>
        </div>
      )}

      {/* TAB 3: CONTACTO */}
      {activeTab === 'contacto' && (
        <div className="p-5 rounded-2xl bg-[#171722] border border-[#262638] space-y-4 animate-fadeIn">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Phone className="w-4 h-4 text-emerald-400" />
            <span>Información de Contacto y Atención</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-gray-400 font-medium mb-1">Teléfono:</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={properties.telefono || ''}
                  onChange={e => {
                    onPropertyChange('telefono', e.target.value);
                    onSaveStatusChange('dirty');
                  }}
                  placeholder="+57 300 123 4567"
                  className="flex-1 px-3 py-2 rounded-xl bg-[#111118] border border-[#2a2a3e] text-white outline-none focus:border-emerald-500"
                />
                {properties.telefono && (
                  <a
                    href={`tel:${properties.telefono}`}
                    className="p-2.5 rounded-xl bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30 transition shrink-0"
                    title="Llamar"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            <div>
              <label className="block text-gray-400 font-medium mb-1">Correo Electrónico:</label>
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  value={properties.email || ''}
                  onChange={e => {
                    onPropertyChange('email', e.target.value);
                    onSaveStatusChange('dirty');
                  }}
                  placeholder="contacto@lugar.com"
                  className="flex-1 px-3 py-2 rounded-xl bg-[#111118] border border-[#2a2a3e] text-white outline-none focus:border-emerald-500"
                />
                {properties.email && (
                  <a
                    href={`mailto:${properties.email}`}
                    className="p-2.5 rounded-xl bg-purple-600/20 text-purple-300 border border-purple-500/30 hover:bg-purple-600/30 transition shrink-0"
                    title="Enviar correo"
                  >
                    <Mail className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            <div>
              <label className="block text-gray-400 font-medium mb-1">Sitio Web:</label>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={properties.website || ''}
                  onChange={e => {
                    onPropertyChange('website', e.target.value);
                    onSaveStatusChange('dirty');
                  }}
                  placeholder="https://www.lugar.com"
                  className="flex-1 px-3 py-2 rounded-xl bg-[#111118] border border-[#2a2a3e] text-white outline-none focus:border-emerald-500"
                />
                {properties.website && (
                  <a
                    href={properties.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 transition shrink-0"
                    title="Visitar sitio web"
                  >
                    <Globe className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            <div>
              <label className="block text-gray-400 font-medium mb-1">Persona de Contacto o Anfitrión:</label>
              <input
                type="text"
                value={properties.persona_contacto || ''}
                onChange={e => {
                  onPropertyChange('persona_contacto', e.target.value);
                  onSaveStatusChange('dirty');
                }}
                placeholder="Nombre de la persona encargada o contacto clave..."
                className="w-full px-3 py-2 rounded-xl bg-[#111118] border border-[#2a2a3e] text-white outline-none focus:border-emerald-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-gray-400 font-medium mb-1">Horarios de Atención o Acceso:</label>
              <input
                type="text"
                value={properties.horario || ''}
                onChange={e => {
                  onPropertyChange('horario', e.target.value);
                  onSaveStatusChange('dirty');
                }}
                placeholder="Ej: Lunes a Viernes 8:00 AM - 6:00 PM / Check-in 3:00 PM"
                className="w-full px-3 py-2 rounded-xl bg-[#111118] border border-[#2a2a3e] text-white outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: FOTOS Y ARCHIVOS */}
      {activeTab === 'fotos_archivos' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Galería de Fotografías del Lugar */}
          <div className="p-5 rounded-2xl bg-[#171722] border border-[#262638] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-emerald-400" />
                  <span>Galería Fotográfica ({galleryPhotos.length})</span>
                </h4>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Fotos de instalaciones, mapas físicos, fachadas y recuerdos.
                </p>
              </div>

              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
              >
                {isUploadingPhoto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                <span>Subir fotos</span>
              </button>
              <input
                ref={galleryInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={handleGalleryUpload}
              />
            </div>

            {galleryPhotos.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {galleryPhotos.map((url, idx) => (
                  <div key={idx} className="relative group rounded-xl overflow-hidden aspect-video bg-[#101018] border border-[#2b2b3e]">
                    <img loading="lazy" decoding="async" src={url} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/90 transition"
                        title="Ver en tamaño original"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleRemoveGalleryPhoto(idx)}
                        className="p-1.5 rounded-lg bg-red-600/80 text-white hover:bg-red-600 transition"
                        title="Eliminar foto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center border-2 border-dashed border-[#2b2b3e] rounded-2xl text-gray-500 text-xs">
                <Camera className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                <p>Aún no hay fotos adicionales guardadas para este lugar.</p>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="mt-2 text-emerald-400 hover:underline font-semibold"
                >
                  Subir la primera foto
                </button>
              </div>
            )}
          </div>

          {/* Archivos Adjuntos (PDFs, Documentos, R2) */}
          <div className="p-5 rounded-2xl bg-[#171722] border border-[#262638] space-y-4">
            <EntityAttachmentsSection
              entityId={object.id}
              entityType="object"
              attachments={attachments}
              onAttachmentCreated={onAttachmentCreated}
              onAttachmentDeleted={onAttachmentDeleted}
            />
          </div>
        </div>
      )}

      {/* TAB 5: RELACIONES CON OTRAS ENTIDADES */}
      {activeTab === 'relaciones' && (
        <div className="p-5 rounded-2xl bg-[#171722] border border-[#262638] space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Share2 className="w-4 h-4 text-emerald-400" />
                <span>Entidades Vinculadas ({linkedItems.length})</span>
              </h4>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Personas que viven/trabajan aquí, empresas asociadas, viajes con parada en este lugar y tareas.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setLinkRelationLabel('Asociado a');
                setIsLinkSelectorOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Vincular entidad</span>
            </button>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1 text-xs">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'person', label: 'Personas' },
              { id: 'company', label: 'Empresas' },
              { id: 'trip', label: 'Viajes' },
              { id: 'task', label: 'Tareas' },
              { id: 'note', label: 'Notas' }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setRelationFilter(f.id as any)}
                className={`px-3 py-1 rounded-lg transition font-medium ${
                  relationFilter === f.id
                    ? 'bg-[#28283a] text-white border border-[#3f3f58]'
                    : 'text-gray-400 hover:text-white hover:bg-[#1a1a24]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Links List */}
          {filteredLinks.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredLinks.map(item => {
                const getIcon = () => {
                  switch (item.type) {
                    case 'person': return <User className="w-4 h-4 text-blue-400" />;
                    case 'company': return <Building2 className="w-4 h-4 text-sky-400" />;
                    case 'trip': return <Plane className="w-4 h-4 text-teal-400" />;
                    case 'task': return <CheckSquare className="w-4 h-4 text-emerald-400" />;
                    case 'note': return <FileText className="w-4 h-4 text-purple-400" />;
                    default: return <Share2 className="w-4 h-4 text-gray-400" />;
                  }
                };

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (item.type === 'note' && onOpenNote) {
                        onOpenNote(item.raw);
                      } else if (onNavigateToObject && item.raw) {
                        onNavigateToObject(item.raw);
                      } else if (onNavigateToEntity) {
                        onNavigateToEntity(item.id, item.type);
                      }
                    }}
                    className="p-3 rounded-xl bg-[#111119] border border-[#252538] hover:border-emerald-500/50 hover:bg-[#171724] transition cursor-pointer flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[#1a1a28] flex items-center justify-center shrink-0">
                        {getIcon()}
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] text-gray-500 uppercase font-semibold block">
                          {item.type.toUpperCase()} • {item.relationLabel}
                        </span>
                        <p className="text-xs font-bold text-white truncate group-hover:text-emerald-300 transition">
                          {item.title}
                        </p>
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-emerald-400 transition shrink-0" />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center border-2 border-dashed border-[#2b2b3e] rounded-2xl text-gray-500 text-xs">
              <Share2 className="w-8 h-8 mx-auto mb-2 text-gray-600" />
              <p>No hay entidades vinculadas en esta categoría.</p>
              <button
                type="button"
                onClick={() => {
                  setLinkRelationLabel('Asociado a');
                  setIsLinkSelectorOpen(true);
                }}
                className="mt-2 text-emerald-400 hover:underline font-semibold"
              >
                Vincular persona, empresa, viaje o tarea
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: HISTORIAL DE ACTIVIDAD Y VISITAS */}
      {activeTab === 'historial' && (
        <div className="p-5 rounded-2xl bg-[#171722] border border-[#262638] space-y-5 animate-fadeIn">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>Bitácora de Visitas y Registro de Actividad</span>
              </h4>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Historial cronológico de cuándo has estado en este lugar y observaciones de cada estancia.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsAddingVisit(true)}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Registrar nueva visita</span>
            </button>
          </div>

          {/* Form to add a new visit */}
          {isAddingVisit && (
            <form onSubmit={handleAddVisit} className="p-4 rounded-xl bg-[#111119] border border-emerald-500/40 space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-bold text-emerald-300 uppercase">Nueva Visita al Lugar</h5>
                <button
                  type="button"
                  onClick={() => setIsAddingVisit(false)}
                  className="text-gray-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-gray-400 mb-1">Fecha de Visita:</label>
                  <input
                    type="date"
                    required
                    value={newVisitDate}
                    onChange={e => setNewVisitDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#181824] border border-[#2e2e42] text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">Motivo / Propósito:</label>
                  <input
                    type="text"
                    value={newVisitMotivo}
                    onChange={e => setNewVisitMotivo(e.target.value)}
                    placeholder="Ej: Vacaciones, Reunión de trabajo, Almuerzo..."
                    className="w-full px-3 py-1.5 rounded-lg bg-[#181824] border border-[#2e2e42] text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">Acompañantes:</label>
                  <input
                    type="text"
                    value={newVisitAcompanantes}
                    onChange={e => setNewVisitAcompanantes(e.target.value)}
                    placeholder="Ej: Familia, Juan Pérez..."
                    className="w-full px-3 py-1.5 rounded-lg bg-[#181824] border border-[#2e2e42] text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-gray-400 mb-1">Notas u Observaciones:</label>
                  <input
                    type="text"
                    value={newVisitNotas}
                    onChange={e => setNewVisitNotas(e.target.value)}
                    placeholder="Detalles sobre la experiencia, gastos, recomendaciones..."
                    className="w-full px-3 py-1.5 rounded-lg bg-[#181824] border border-[#2e2e42] text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingVisit(false)}
                  className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md"
                >
                  Guardar Visita
                </button>
              </div>
            </form>
          )}

          {/* Visits Timeline */}
          {visitsHistory.length > 0 ? (
            <div className="space-y-3 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#28283a]">
              {visitsHistory.map((visit) => (
                <div key={visit.id} className="relative pl-8 group">
                  <div className="absolute left-2 top-1.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#16161d]" />
                  <div className="p-3.5 rounded-xl bg-[#111119] border border-[#252538] flex items-start justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{visit.fecha}</span>
                        {visit.motivo && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium text-[11px]">
                            {visit.motivo}
                          </span>
                        )}
                      </div>
                      {visit.acompanantes && (
                        <p className="text-gray-400 text-[11px]">
                          <strong>Acompañantes:</strong> {visit.acompanantes}
                        </p>
                      )}
                      {visit.notas && (
                        <p className="text-gray-300 text-xs mt-1">
                          {visit.notas}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteVisit(visit.id)}
                      className="p-1 rounded text-gray-500 hover:text-red-400 transition opacity-0 group-hover:opacity-100"
                      title="Eliminar visita"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center border-2 border-dashed border-[#2b2b3e] rounded-2xl text-gray-500 text-xs">
              <Calendar className="w-7 h-7 mx-auto mb-2 text-gray-600" />
              <p>No se han registrado visitas aún para este lugar.</p>
            </div>
          )}

          {/* Metadata dates */}
          <div className="pt-4 border-t border-[#232334] text-[11px] text-gray-500 flex items-center justify-between">
            <span>Fecha de creación: {new Date(object.created_at).toLocaleDateString()}</span>
            <span>Última actualización: {new Date(object.updated_at).toLocaleDateString()}</span>
          </div>
        </div>
      )}

      {/* Universal Link Selector Modal */}
      <UniversalLinkSelectorModal
        isOpen={isLinkSelectorOpen}
        onClose={() => setIsLinkSelectorOpen(false)}
        currentEntityId={object.id}
        currentEntityType="object"
        objects={allObjects}
        notes={notes}
        tasks={tasks}
        projects={projects}
        areas={areas}
        defaultRelationLabel={linkRelationLabel}
        onSelect={async (targetItem, relationLabel) => {
          try {
            await db.createUniversalLink(object.id, targetItem.id, 'object', targetItem.type, relationLabel || 'related');
            // Refresh links
            const res = await db.getLinksForEntity(object.id);
            // Links state will be refreshed by parent
            setIsLinkSelectorOpen(false);
          } catch (e: any) {
            console.warn('Error linking entity:', e);
            alert('Error vinculando entidad: ' + e.message);
          }
        }}
      />
    </div>
  );
};
