import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Editor, EditorContent } from '@tiptap/react';
import { 
  Plane, 
  Car, 
  Bike, 
  Bus, 
  Ship, 
  Footprints, 
  Route, 
  MapPin, 
  Calendar, 
  Clock, 
  DollarSign, 
  CreditCard, 
  Plus, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  Circle, 
  ExternalLink, 
  Folder, 
  FolderPlus, 
  Upload, 
  Image as ImageIcon, 
  FileText, 
  Layers, 
  User, 
  Sparkles, 
  TrendingUp, 
  Gauge, 
  Fuel, 
  AlertTriangle, 
  Check, 
  X, 
  ChevronRight, 
  ArrowRight, 
  Search, 
  Filter, 
  Receipt, 
  StickyNote, 
  BookOpen,
  Loader2,
  Paperclip,
  Share2,
  Users,
  Compass,
  Smile,
  ShieldCheck,
  ChevronDown,
  Mic
} from 'lucide-react';
import { 
  AppObject, 
  AppProject, 
  AppArea, 
  AppNote, 
  AppAttachment, 
  AppLink, 
  AppFolder,
  AppTripLeg, 
  AppTripStop, 
  AppTripExpense, 
  AppTripJournal,
  TripTransportType,
  TripStatus,
  TripExpenseCategory
} from '../lib/types';
import { db } from '../lib/insforge';
import { r2Storage } from '../lib/r2Client';
import { DatePickerInput } from './DatePickerInput';
import { TableGridPicker } from './TableGridPicker';
import { TableToolbar } from './TableToolbar';

export interface TripManagerViewProps {
  object: AppObject;
  properties: Record<string, any>;
  onPropertyChange: (key: string, val: any) => void;
  editor: Editor | null;
  editorImageInputRef: React.RefObject<HTMLInputElement>;
  onUploadImage: (file: File) => Promise<void>;
  allObjects: AppObject[];
  projects: AppProject[];
  areas: AppArea[];
  notes: AppNote[];
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

const TRIP_STATUS_OPTIONS: { id: TripStatus; label: string; color: string; bg: string }[] = [
  { id: 'idea', label: 'Idea', color: 'text-purple-400', bg: 'bg-purple-950/40 border-purple-800/40' },
  { id: 'planeado', label: 'Planeado', color: 'text-blue-400', bg: 'bg-blue-950/40 border-blue-800/40' },
  { id: 'en_curso', label: 'En Curso', color: 'text-emerald-400', bg: 'bg-emerald-950/40 border-emerald-800/40' },
  { id: 'completado', label: 'Completado', color: 'text-cyan-400', bg: 'bg-cyan-950/40 border-cyan-800/40' },
  { id: 'cancelado', label: 'Cancelado', color: 'text-gray-400', bg: 'bg-gray-800/40 border-gray-700/40' }
];

const TRIP_TYPE_OPTIONS = [
  { id: 'vacaciones', label: 'Vacaciones / Descanso' },
  { id: 'aventura', label: 'Aventura / Naturaleza' },
  { id: 'trabajo', label: 'Trabajo / Negocios' },
  { id: 'escapada', label: 'Escapada de fin de semana' },
  { id: 'ruta', label: 'Ruta / Roadtrip' },
  { id: 'multidestino', label: 'Multidestino' },
  { id: 'cultural', label: 'Cultural / Histórico' },
  { id: 'otro', label: 'Otro tipo de viaje' }
];

const TRANSPORT_OPTIONS: { id: TripTransportType; label: string; icon: any; isVehicle: boolean }[] = [
  { id: 'moto', label: 'Moto', icon: Gauge, isVehicle: true },
  { id: 'carro', label: 'Carro', icon: Car, isVehicle: true },
  { id: 'bicicleta', label: 'Bicicleta', icon: Bike, isVehicle: true },
  { id: 'avion', label: 'Avión', icon: Plane, isVehicle: false },
  { id: 'transporte_publico', label: 'Transporte Público (Bus/Tren/Metro)', icon: Bus, isVehicle: false },
  { id: 'barco', label: 'Barco / Ferry', icon: Ship, isVehicle: false },
  { id: 'caminata', label: 'Caminata / Trekking', icon: Footprints, isVehicle: false },
  { id: 'multidestino', label: 'Combinación de transportes', icon: Route, isVehicle: false },
  { id: 'otro', label: 'Otro medio', icon: Compass, isVehicle: false }
];

const EXPENSE_CATEGORIES: { id: TripExpenseCategory; label: string; icon: any; color: string }[] = [
  { id: 'transporte', label: 'Transporte & Pasajes', icon: Plane, color: '#3b82f6' },
  { id: 'combustible', label: 'Combustible', icon: Fuel, color: '#f59e0b' },
  { id: 'peajes', label: 'Peajes', icon: Route, color: '#eab308' },
  { id: 'alojamiento', label: 'Alojamiento & Hotel', icon: MapPin, color: '#8b5cf6' },
  { id: 'alimentacion', label: 'Alimentación & Restaurantes', icon: DollarSign, color: '#10b981' },
  { id: 'actividades', label: 'Actividades & Entradas', icon: Sparkles, color: '#ec4899' },
  { id: 'parqueadero', label: 'Parqueadero', icon: Car, color: '#6366f1' },
  { id: 'mantenimiento', label: 'Mantenimiento / Taller', icon: Gauge, color: '#ef4444' },
  { id: 'compras', label: 'Compras & Recuerdos', icon: DollarSign, color: '#14b8a6' },
  { id: 'otros', label: 'Otros Gastos', icon: DollarSign, color: '#6b7280' }
];

export const TripManagerView: React.FC<TripManagerViewProps> = ({
  object,
  properties,
  onPropertyChange,
  editor,
  editorImageInputRef,
  onUploadImage,
  allObjects,
  projects,
  areas,
  notes,
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
  // Tabs: 1. Resumen, 2. Itinerario, 3. Gastos, 4. Diario y notas, 5. Archivos, 6. Propiedades y relaciones
  const [activeTab, setActiveTab] = useState<'resumen' | 'itinerario' | 'gastos' | 'diario' | 'archivos' | 'relaciones'>('resumen');

  // Sub-entities state
  const [legs, setLegs] = useState<AppTripLeg[]>([]);
  const [stops, setStops] = useState<AppTripStop[]>([]);
  const [expenses, setExpenses] = useState<AppTripExpense[]>([]);
  const [journals, setJournals] = useState<AppTripJournal[]>([]);
  const [folders, setFolders] = useState<AppFolder[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Modals state
  const [isLegModalOpen, setIsLegModalOpen] = useState(false);
  const [editingLeg, setEditingLeg] = useState<Partial<AppTripLeg> | null>(null);

  const [isStopModalOpen, setIsStopModalOpen] = useState(false);
  const [editingStop, setEditingStop] = useState<Partial<AppTripStop> | null>(null);

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Partial<AppTripExpense> | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  const [editingJournal, setEditingJournal] = useState<Partial<AppTripJournal> | null>(null);
  const [isUploadingJournalPhoto, setIsUploadingJournalPhoto] = useState(false);
  const journalPhotoInputRef = useRef<HTMLInputElement>(null);

  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // Expense filter
  const [expenseFilterCategory, setExpenseFilterCategory] = useState<string>('all');
  const [expenseSearchQuery, setExpenseSearchQuery] = useState<string>('');

  // Load trip sub-entities
  useEffect(() => {
    let isMounted = true;
    async function loadTripEntities() {
      try {
        setIsLoadingData(true);
        const [loadedLegs, loadedStops, loadedExpenses, loadedJournals, loadedFolders] = await Promise.all([
          db.getTripLegs(object.id),
          db.getTripStops(object.id),
          db.getTripExpenses(object.id),
          db.getTripJournals(object.id),
          db.getFileFolders().catch(() => [])
        ]);
        if (isMounted) {
          setLegs(loadedLegs);
          setStops(loadedStops);
          setExpenses(loadedExpenses);
          setJournals(loadedJournals);
          setFolders(loadedFolders);
        }
      } catch (err) {
        console.error('Error loading trip sub-entities:', err);
      } finally {
        if (isMounted) setIsLoadingData(false);
      }
    }
    loadTripEntities();
    return () => {
      isMounted = false;
    };
  }, [object.id]);

  // General Trip Properties
  const status: TripStatus = properties.status || 'planeado';
  const tripType = properties.trip_type || 'vacaciones';
  const tripTypeCustom = properties.trip_type_custom || '';
  const origin = properties.origin || '';
  const destination = properties.destination || '';
  const startDate = properties.start_date || properties.fecha_inicio || '';
  const endDate = properties.end_date || properties.fecha_fin || '';
  const timezone = properties.timezone || '';
  const estimatedBudget = Number(properties.estimated_budget || properties.presupuesto) || 0;
  const currency = properties.currency || 'COP';
  const mapsUrl = properties.maps_url || '';
  const folderId = properties.folder_id || '';
  const companionIds: string[] = Array.isArray(properties.companion_ids) ? properties.companion_ids : [];

  // ==========================================
  // CALCULATED METRICS
  // ==========================================

  // 1. Total Distance
  const totalDistanceKm = useMemo(() => {
    let sum = 0;
    legs.forEach(l => {
      const dist = Number(l.distance) || 0;
      if (l.distance_unit === 'mi') {
        sum += dist * 1.60934;
      } else {
        sum += dist;
      }
    });
    return Math.round(sum * 10) / 10;
  }, [legs]);

  // 2. Total Expenses grouped by currency
  const expensesTotalsByCurrency = useMemo(() => {
    const totals: Record<string, number> = {};
    expenses.forEach(e => {
      const curr = (e.currency || currency || 'COP').toUpperCase();
      const amt = Number(e.amount) || 0;
      totals[curr] = (totals[curr] || 0) + amt;
    });
    return totals;
  }, [expenses, currency]);

  const mainCurrencyTotal = expensesTotalsByCurrency[currency.toUpperCase()] || 0;

  // 3. Cost per km (for main currency when distance > 0)
  const costPerKm = useMemo(() => {
    if (totalDistanceKm > 0 && mainCurrencyTotal > 0) {
      return Math.round((mainCurrencyTotal / totalDistanceKm) * 100) / 100;
    }
    return null;
  }, [totalDistanceKm, mainCurrencyTotal]);

  // 4. Trip Duration
  const tripDurationText = useMemo(() => {
    if (!startDate) return null;
    try {
      const start = new Date(startDate);
      if (isNaN(start.getTime())) return null;
      if (!endDate) {
        return `Desde ${start.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`;
      }
      const end = new Date(endDate);
      if (isNaN(end.getTime())) return null;

      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return `${diffDays === 0 ? 1 : diffDays} día${diffDays > 1 ? 's' : ''}`;
    } catch {
      return null;
    }
  }, [startDate, endDate]);

  // 5. Stops progress
  const completedStopsCount = useMemo(() => {
    return stops.filter(s => s.status === 'completed').length;
  }, [stops]);

  // Format currency
  const formatMoney = (amount: number, curr = currency) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: curr,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Contacts / Companions list
  const companionObjects = useMemo(() => {
    return allObjects.filter(o => o.object_type === 'person' && companionIds.includes(o.id));
  }, [allObjects, companionIds]);

  const availablePersonObjects = useMemo(() => {
    return allObjects.filter(o => o.object_type === 'person' && !companionIds.includes(o.id));
  }, [allObjects, companionIds]);

  // Linked folder from R2
  const linkedFolder = useMemo(() => {
    return folders.find(f => f.id === folderId);
  }, [folders, folderId]);

  // Files of this trip (directly attached or in folder)
  const tripFiles = useMemo(() => {
    return attachments.filter(a => a.entity_id === object.id || (folderId && a.folder_id === folderId));
  }, [attachments, object.id, folderId]);

  // ==========================================
  // HANDLERS FOR SUB-ENTITIES
  // ==========================================

  // --- LEGS ---
  const handleSaveLeg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLeg) return;

    let finalDistance = Number(editingLeg.distance) || 0;
    // Auto calculate if odometer start & end are present
    if (editingLeg.odometer_start !== undefined && editingLeg.odometer_end !== undefined) {
      const oStart = Number(editingLeg.odometer_start);
      const oEnd = Number(editingLeg.odometer_end);
      if (!isNaN(oStart) && !isNaN(oEnd) && oEnd >= oStart) {
        finalDistance = oEnd - oStart;
      }
    }

    const payload: Partial<AppTripLeg> = {
      ...editingLeg,
      trip_id: object.id,
      distance: finalDistance,
      distance_unit: editingLeg.distance_unit || 'km',
      distance_source: editingLeg.distance_source || (editingLeg.odometer_start ? 'odometer' : 'estimated'),
      transport_type: editingLeg.transport_type || 'carro',
      origin: editingLeg.origin || '',
      destination: editingLeg.destination || ''
    };

    try {
      if (editingLeg.id) {
        const updated = await db.updateTripLeg(editingLeg.id, payload);
        if (updated) {
          setLegs(prev => prev.map(l => l.id === updated.id ? updated : l));
        }
      } else {
        const created = await db.createTripLeg(payload);
        if (created) {
          setLegs(prev => [...prev, created]);
        }
      }
      setIsLegModalOpen(false);
      setEditingLeg(null);
    } catch (err: any) {
      alert('Error guardando trayecto: ' + err.message);
    }
  };

  const handleDeleteLeg = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar este trayecto?')) return;
    try {
      await db.deleteTripLeg(id);
      setLegs(prev => prev.filter(l => l.id !== id));
    } catch (err: any) {
      alert('Error eliminando trayecto: ' + err.message);
    }
  };

  // --- STOPS ---
  const handleSaveStop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStop || !editingStop.name) return;

    const payload: Partial<AppTripStop> = {
      ...editingStop,
      trip_id: object.id,
      name: editingStop.name.trim(),
      status: editingStop.status || 'pending',
      order_index: editingStop.order_index ?? stops.length
    };

    try {
      if (editingStop.id) {
        const updated = await db.updateTripStop(editingStop.id, payload);
        if (updated) {
          setStops(prev => prev.map(s => s.id === updated.id ? updated : s));
        }
      } else {
        const created = await db.createTripStop(payload);
        if (created) {
          setStops(prev => [...prev, created]);
        }
      }
      setIsStopModalOpen(false);
      setEditingStop(null);
    } catch (err: any) {
      alert('Error guardando parada: ' + err.message);
    }
  };

  const handleToggleStopStatus = async (stop: AppTripStop) => {
    const nextStatus = stop.status === 'completed' ? 'pending' : 'completed';
    setStops(prev => prev.map(s => s.id === stop.id ? { ...s, status: nextStatus } : s));
    try {
      await db.updateTripStop(stop.id, { 
        status: nextStatus,
        actual_time: nextStatus === 'completed' ? new Date().toISOString() : null
      });
    } catch (err: any) {
      setStops(prev => prev.map(s => s.id === stop.id ? stop : s));
      alert('Error actualizando parada: ' + err.message);
    }
  };

  const handleDeleteStop = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar esta parada?')) return;
    try {
      await db.deleteTripStop(id);
      setStops(prev => prev.filter(s => s.id !== id));
    } catch (err: any) {
      alert('Error eliminando parada: ' + err.message);
    }
  };

  // --- EXPENSES ---
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense || !editingExpense.concept) return;

    const payload: Partial<AppTripExpense> = {
      ...editingExpense,
      trip_id: object.id,
      concept: editingExpense.concept.trim(),
      amount: Number(editingExpense.amount) || 0,
      currency: (editingExpense.currency || currency || 'COP').toUpperCase(),
      category: editingExpense.category || 'otros',
      expense_date: editingExpense.expense_date || new Date().toISOString()
    };

    try {
      if (editingExpense.id) {
        const updated = await db.updateTripExpense(editingExpense.id, payload);
        if (updated) {
          setExpenses(prev => prev.map(ex => ex.id === updated.id ? updated : ex));
        }
      } else {
        const created = await db.createTripExpense(payload);
        if (created) {
          setExpenses(prev => [created, ...prev]);
        }
      }
      setIsExpenseModalOpen(false);
      setEditingExpense(null);
    } catch (err: any) {
      alert('Error guardando gasto: ' + err.message);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar este gasto?')) return;
    try {
      await db.deleteTripExpense(id);
      setExpenses(prev => prev.filter(ex => ex.id !== id));
    } catch (err: any) {
      alert('Error eliminando gasto: ' + err.message);
    }
  };

  const handleUploadReceipt = async (file: File) => {
    if (!file) return;
    try {
      setIsUploadingReceipt(true);
      const res = await r2Storage.uploadFile(file, `trips/${object.id}/receipts`);
      setEditingExpense(prev => ({
        ...prev,
        receipt_url: res.url
      }));

      // Also record in app_attachments
      const att = await db.recordAttachment({
        entity_id: object.id,
        entity_type: 'object',
        file_name: res.name,
        display_name: file.name,
        file_url: res.url,
        file_path: res.r2Key,
        r2_key: res.provider === 'r2' ? res.r2Key : undefined,
        storage_provider: res.provider,
        file_size: res.size,
        mime_type: res.mime
      });
      if (att && onAttachmentCreated) onAttachmentCreated(att);
    } catch (err: any) {
      alert('Error subiendo recibo: ' + err.message);
    } finally {
      setIsUploadingReceipt(false);
      if (receiptInputRef.current) receiptInputRef.current.value = '';
    }
  };

  // --- JOURNALS ---
  const handleSaveJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingJournal || !editingJournal.title) return;

    const payload: Partial<AppTripJournal> = {
      ...editingJournal,
      trip_id: object.id,
      title: editingJournal.title.trim(),
      content: editingJournal.content || '',
      entry_date: editingJournal.entry_date || new Date().toISOString(),
      image_urls: editingJournal.image_urls || []
    };

    try {
      if (editingJournal.id) {
        const updated = await db.updateTripJournal(editingJournal.id, payload);
        if (updated) {
          setJournals(prev => prev.map(j => j.id === updated.id ? updated : j));
        }
      } else {
        const created = await db.createTripJournal(payload);
        if (created) {
          setJournals(prev => [created, ...prev]);
        }
      }
      setIsJournalModalOpen(false);
      setEditingJournal(null);
    } catch (err: any) {
      alert('Error guardando entrada de diario: ' + err.message);
    }
  };

  const handleDeleteJournal = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar esta entrada de diario?')) return;
    try {
      await db.deleteTripJournal(id);
      setJournals(prev => prev.filter(j => j.id !== id));
    } catch (err: any) {
      alert('Error eliminando entrada de diario: ' + err.message);
    }
  };

  const handleUploadJournalPhoto = async (file: File) => {
    if (!file) return;
    try {
      setIsUploadingJournalPhoto(true);
      const res = await r2Storage.uploadFile(file, `trips/${object.id}/journal-photos`);
      setEditingJournal(prev => ({
        ...prev,
        image_urls: [...(prev?.image_urls || []), res.url]
      }));

      // Record attachment
      const att = await db.recordAttachment({
        entity_id: object.id,
        entity_type: 'object',
        file_name: res.name,
        display_name: file.name,
        file_url: res.url,
        file_path: res.r2Key,
        r2_key: res.provider === 'r2' ? res.r2Key : undefined,
        storage_provider: res.provider,
        file_size: res.size,
        mime_type: res.mime
      });
      if (att && onAttachmentCreated) onAttachmentCreated(att);
    } catch (err: any) {
      alert('Error subiendo foto de diario: ' + err.message);
    } finally {
      setIsUploadingJournalPhoto(false);
      if (journalPhotoInputRef.current) journalPhotoInputRef.current.value = '';
    }
  };

  // --- FOLDERS (R2) ---
  const handleCreateTripFolder = async () => {
    try {
      setIsCreatingFolder(true);
      const newFolder = await db.createFileFolder({
        name: `Viaje: ${object.title || 'Sin título'}`,
        color: '#14b8a6',
        icon: 'plane'
      });
      if (newFolder) {
        setFolders(prev => [...prev, newFolder]);
        onPropertyChange('folder_id', newFolder.id);
        onSaveStatusChange('dirty');
      }
    } catch (err: any) {
      alert('Error creando carpeta de viaje: ' + err.message);
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // --- COMPANIONS ---
  const handleAddCompanion = (personId: string) => {
    if (!companionIds.includes(personId)) {
      const next = [...companionIds, personId];
      onPropertyChange('companion_ids', next);
      onSaveStatusChange('dirty');
    }
  };

  const handleRemoveCompanion = (personId: string) => {
    const next = companionIds.filter(id => id !== personId);
    onPropertyChange('companion_ids', next);
    onSaveStatusChange('dirty');
  };

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const matchesCat = expenseFilterCategory === 'all' || e.category === expenseFilterCategory;
      const matchesSearch = !expenseSearchQuery || 
        e.concept.toLowerCase().includes(expenseSearchQuery.toLowerCase()) || 
        (e.vendor && e.vendor.toLowerCase().includes(expenseSearchQuery.toLowerCase())) ||
        (e.notes && e.notes.toLowerCase().includes(expenseSearchQuery.toLowerCase()));
      return matchesCat && matchesSearch;
    });
  }, [expenses, expenseFilterCategory, expenseSearchQuery]);

  return (
    <div className="w-full flex flex-col space-y-6">
      
      {/* 1. TABS HEADER BAR (Responsive & Horizontal Scroll) */}
      <div className="border-b border-[#252538] -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar py-1">
          {[
            { id: 'resumen', label: 'Resumen', icon: Compass },
            { id: 'itinerario', label: `Itinerario (${stops.length})`, icon: MapPin },
            { id: 'gastos', label: `Gastos (${expenses.length})`, icon: DollarSign },
            { id: 'diario', label: `Diario & Notas (${journals.length})`, icon: BookOpen },
            { id: 'archivos', label: `Archivos (${tripFiles.length})`, icon: Paperclip },
            { id: 'relaciones', label: 'Propiedades & Relaciones', icon: Layers }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition whitespace-nowrap ${
                  isActive
                    ? 'bg-[#1e1e2c] text-teal-400 border border-[#2d2d42] shadow-sm'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#161622]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-teal-400' : 'text-gray-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: RESUMEN (INDICADORES + DATOS GENERALES + RESUMEN CRONOLÓGICO)     */}
      {/* ========================================================================= */}
      {activeTab === 'resumen' && (
        <div className="space-y-6">
          
          {/* Top Indicator Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            
            {/* Distancia Total */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-[#161622] border border-[#252536] flex flex-col justify-between space-y-1 shadow-sm">
              <div className="flex items-center justify-between text-gray-400">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Distancia Total</span>
                <Route className="w-4 h-4 text-teal-400" />
              </div>
              <div className="my-1">
                {totalDistanceKm > 0 ? (
                  <div className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {totalDistanceKm.toLocaleString('es-CO')} <span className="text-xs font-normal text-teal-400">km</span>
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 py-1">Sin distancia registrada</div>
                )}
              </div>
              <span className="text-[10px] text-gray-400 truncate">
                {legs.length > 0 ? `${legs.length} trayecto${legs.length > 1 ? 's' : ''}` : 'Añade trayectos para sumar'}
              </span>
            </div>

            {/* Gasto Total vs Presupuesto */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-[#161622] border border-[#252536] flex flex-col justify-between space-y-1 shadow-sm">
              <div className="flex items-center justify-between text-gray-400">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Gasto Total</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="my-1">
                {mainCurrencyTotal > 0 ? (
                  <div className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate">
                    {formatMoney(mainCurrencyTotal, currency)}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 py-1">Sin gastos registrados</div>
                )}
              </div>
              <div className="text-[10px] text-gray-400 flex items-center justify-between truncate">
                {estimatedBudget > 0 ? (
                  <span>Presupuesto: {formatMoney(estimatedBudget, currency)}</span>
                ) : (
                  <span>{expenses.length} gasto{expenses.length !== 1 ? 's' : ''}</span>
                )}
              </div>
            </div>

            {/* Duración y Fechas */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-[#161622] border border-[#252536] flex flex-col justify-between space-y-1 shadow-sm">
              <div className="flex items-center justify-between text-gray-400">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Fechas & Duración</span>
                <Calendar className="w-4 h-4 text-blue-400" />
              </div>
              <div className="my-1">
                {tripDurationText ? (
                  <div className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {tripDurationText}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 py-1">Fechas por definir</div>
                )}
              </div>
              <span className="text-[10px] text-gray-400 truncate">
                {startDate ? `${startDate} ${endDate ? `→ ${endDate}` : ''}` : 'Configura salida y regreso'}
              </span>
            </div>

            {/* Paradas & Destinos */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-[#161622] border border-[#252536] flex flex-col justify-between space-y-1 shadow-sm">
              <div className="flex items-center justify-between text-gray-400">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Itinerario & Paradas</span>
                <MapPin className="w-4 h-4 text-pink-400" />
              </div>
              <div className="my-1">
                {stops.length > 0 ? (
                  <div className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {completedStopsCount} <span className="text-xs font-normal text-gray-400">/ {stops.length} hechas</span>
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 py-1">0 paradas registradas</div>
                )}
              </div>
              <span className="text-[10px] text-gray-400 truncate">
                {destination ? `Hacia: ${destination}` : 'Sin destino principal'}
              </span>
            </div>

          </div>

          {/* Cost per km notice when available */}
          {costPerKm !== null && (
            <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-teal-950/20 border border-teal-800/30 text-xs text-teal-300">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-teal-400" />
                <span>Eficiencia estimada de costo de viaje: <strong>{formatMoney(costPerKm, currency)} / km</strong></span>
              </div>
              <span className="text-[11px] text-teal-400/80">Basado en {totalDistanceKm} km y {formatMoney(mainCurrencyTotal, currency)}</span>
            </div>
          )}

          {/* Información General del Viaje (Formulario Editable en Tiempo Real) */}
          <div className="p-5 rounded-2xl bg-[#161622] border border-[#252536] space-y-4">
            <div className="flex items-center justify-between border-b border-[#232332] pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Compass className="w-4 h-4 text-teal-400" />
                <span>Información General del Viaje</span>
              </h3>
              
              {/* Badge de Estado del Viaje */}
              <div className="flex items-center gap-2">
                <select
                  value={status}
                  onChange={(e) => {
                    onPropertyChange('status', e.target.value);
                    onSaveStatusChange('dirty');
                  }}
                  className="bg-[#1c1c28] border border-[#303046] rounded-lg px-2.5 py-1 text-xs font-medium text-white outline-none cursor-pointer"
                >
                  {TRIP_STATUS_OPTIONS.map(opt => (
                    <option key={opt.id} value={opt.id} className="bg-[#161622] text-white">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              
              {/* Tipo de Viaje */}
              <div>
                <label className="text-gray-400 font-medium block mb-1">Tipo de viaje</label>
                <select
                  value={tripType}
                  onChange={(e) => {
                    onPropertyChange('trip_type', e.target.value);
                    onSaveStatusChange('dirty');
                  }}
                  className="w-full bg-[#1c1c28] border border-[#2c2c40] rounded-xl px-3 py-2 text-white outline-none focus:border-teal-500 transition"
                >
                  {TRIP_TYPE_OPTIONS.map(opt => (
                    <option key={opt.id} value={opt.id} className="bg-[#161622] text-white">
                      {opt.label}
                    </option>
                  ))}
                </select>
                {tripType === 'otro' && (
                  <input
                    type="text"
                    value={tripTypeCustom}
                    onChange={(e) => {
                      onPropertyChange('trip_type_custom', e.target.value);
                      onSaveStatusChange('dirty');
                    }}
                    placeholder="Describe el tipo de viaje..."
                    className="w-full mt-2 bg-[#1c1c28] border border-[#2c2c40] rounded-xl px-3 py-1.5 text-white outline-none text-xs"
                  />
                )}
              </div>

              {/* Origen */}
              <div>
                <label className="text-gray-400 font-medium block mb-1">Ciudad o punto de origen</label>
                <input
                  type="text"
                  value={origin}
                  onChange={(e) => {
                    onPropertyChange('origin', e.target.value);
                    onSaveStatusChange('dirty');
                  }}
                  placeholder="Ej. Bogotá, Terminal Norte, Casa..."
                  className="w-full bg-[#1c1c28] border border-[#2c2c40] rounded-xl px-3 py-2 text-white outline-none focus:border-teal-500 transition"
                />
              </div>

              {/* Destino Principal */}
              <div>
                <label className="text-gray-400 font-medium block mb-1">Destino principal</label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => {
                    onPropertyChange('destination', e.target.value);
                    onSaveStatusChange('dirty');
                  }}
                  placeholder="Ej. Villa de Leyva, Santa Marta, París..."
                  className="w-full bg-[#1c1c28] border border-[#2c2c40] rounded-xl px-3 py-2 text-white outline-none focus:border-teal-500 transition"
                />
              </div>

              {/* Fecha de Salida */}
              <div>
                <label className="text-gray-400 font-medium block mb-1">Fecha de salida</label>
                <DatePickerInput
                  value={startDate}
                  onChange={(val) => {
                    onPropertyChange('start_date', val);
                    onPropertyChange('fecha_inicio', val);
                    onSaveStatusChange('dirty');
                  }}
                  placeholder="Elegir fecha de salida..."
                />
              </div>

              {/* Fecha de Regreso */}
              <div>
                <label className="text-gray-400 font-medium block mb-1">Fecha de regreso</label>
                <DatePickerInput
                  value={endDate}
                  onChange={(val) => {
                    onPropertyChange('end_date', val);
                    onPropertyChange('fecha_fin', val);
                    onSaveStatusChange('dirty');
                  }}
                  placeholder="Elegir fecha de regreso..."
                />
              </div>

              {/* Presupuesto Estimado y Moneda */}
              <div>
                <label className="text-gray-400 font-medium block mb-1">Presupuesto estimado</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={estimatedBudget || ''}
                    onChange={(e) => {
                      onPropertyChange('estimated_budget', Number(e.target.value) || 0);
                      onPropertyChange('presupuesto', Number(e.target.value) || 0);
                      onSaveStatusChange('dirty');
                    }}
                    placeholder="0"
                    className="flex-1 bg-[#1c1c28] border border-[#2c2c40] rounded-xl px-3 py-2 text-white outline-none focus:border-teal-500 transition"
                  />
                  <input
                    type="text"
                    value={currency}
                    onChange={(e) => {
                      onPropertyChange('currency', e.target.value.toUpperCase());
                      onSaveStatusChange('dirty');
                    }}
                    placeholder="COP"
                    className="w-20 bg-[#1c1c28] border border-[#2c2c40] rounded-xl px-2.5 py-2 text-white text-center font-bold outline-none uppercase"
                  />
                </div>
              </div>

              {/* Zona Horaria */}
              <div>
                <label className="text-gray-400 font-medium block mb-1">Zona horaria</label>
                <input
                  type="text"
                  value={timezone}
                  onChange={(e) => {
                    onPropertyChange('timezone', e.target.value);
                    onSaveStatusChange('dirty');
                  }}
                  placeholder="Ej. America/Bogota (UTC-5)..."
                  className="w-full bg-[#1c1c28] border border-[#2c2c40] rounded-xl px-3 py-2 text-white outline-none focus:border-teal-500 transition"
                />
              </div>

              {/* Enlace de Mapas / Reservas */}
              <div className="sm:col-span-2">
                <label className="text-gray-400 font-medium block mb-1">Enlace a ruta en mapas o reserva</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={mapsUrl}
                    onChange={(e) => {
                      onPropertyChange('maps_url', e.target.value);
                      onSaveStatusChange('dirty');
                    }}
                    placeholder="https://maps.google.com/?q=..."
                    className="flex-1 bg-[#1c1c28] border border-[#2c2c40] rounded-xl px-3 py-2 text-white outline-none focus:border-teal-500 transition text-xs"
                  />
                  {mapsUrl && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-xl bg-[#232334] text-teal-400 hover:text-white border border-[#34344d] flex items-center gap-1.5 transition text-xs flex-shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Abrir</span>
                    </a>
                  )}
                </div>
              </div>

            </div>

            {/* Acompañantes del Viaje */}
            <div className="pt-3 border-t border-[#232332]">
              <label className="text-gray-400 font-medium block mb-2">
                Acompañantes vinculados ({companionObjects.length})
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {companionObjects.map(person => (
                  <div 
                    key={person.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1d1d2b] border border-[#2f2f45] text-xs text-white"
                  >
                    <User className="w-3.5 h-3.5 text-blue-400" />
                    <span>{person.title}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCompanion(person.id)}
                      className="text-gray-400 hover:text-red-400 ml-1"
                      title="Quitar acompañante"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                {/* Add companion picker */}
                {availablePersonObjects.length > 0 && (
                  <div className="relative">
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAddCompanion(e.target.value);
                          e.target.value = '';
                        }
                      }}
                      className="bg-[#1c1c28] border border-[#303046] hover:border-teal-500 text-gray-300 rounded-full px-3 py-1.5 text-xs outline-none cursor-pointer transition"
                    >
                      <option value="">+ Vincular persona...</option>
                      {availablePersonObjects.map(p => (
                        <option key={p.id} value={p.id} className="bg-[#161622] text-white">
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Quick Actions Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button
              type="button"
              onClick={() => {
                setEditingLeg({
                  transport_type: 'carro',
                  distance_unit: 'km',
                  distance_source: 'estimated',
                  origin: origin || '',
                  destination: destination || ''
                });
                setIsLegModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-[#181824] hover:bg-[#202030] border border-[#28283a] text-xs font-semibold text-teal-300 transition"
            >
              <Plus className="w-4 h-4 text-teal-400" />
              <span>Añadir Trayecto</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingStop({ status: 'pending', name: '' });
                setIsStopModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-[#181824] hover:bg-[#202030] border border-[#28283a] text-xs font-semibold text-pink-300 transition"
            >
              <Plus className="w-4 h-4 text-pink-400" />
              <span>Añadir Parada</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingExpense({
                  category: 'transporte',
                  currency: currency || 'COP',
                  expense_date: new Date().toISOString()
                });
                setIsExpenseModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-[#181824] hover:bg-[#202030] border border-[#28283a] text-xs font-semibold text-emerald-300 transition"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Registrar Gasto</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingJournal({
                  title: `Bitácora - ${new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`,
                  entry_date: new Date().toISOString(),
                  content: '',
                  image_urls: []
                });
                setIsJournalModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-[#181824] hover:bg-[#202030] border border-[#28283a] text-xs font-semibold text-purple-300 transition"
            >
              <Plus className="w-4 h-4 text-purple-400" />
              <span>Entrada al Diario</span>
            </button>
          </div>

          {/* Resumen de Itinerario Próximo */}
          {stops.length > 0 && (
            <div className="p-5 rounded-2xl bg-[#161622] border border-[#252536] space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Próximas paradas & actividades
                </h4>
                <button
                  type="button"
                  onClick={() => setActiveTab('itinerario')}
                  className="text-xs text-teal-400 hover:underline flex items-center gap-1 font-medium"
                >
                  <span>Ver todas ({stops.length})</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="divide-y divide-[#202030]">
                {stops.slice(0, 4).map(stop => (
                  <div key={stop.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleToggleStopStatus(stop)}
                        className="text-gray-500 hover:text-emerald-400 transition"
                      >
                        {stop.status === 'completed' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Circle className="w-4 h-4" />
                        )}
                      </button>
                      <div>
                        <span className={`text-xs font-medium block ${stop.status === 'completed' ? 'line-through text-gray-500' : 'text-white'}`}>
                          {stop.name}
                        </span>
                        {stop.location && (
                          <span className="text-[11px] text-gray-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-gray-500" />
                            {stop.location}
                          </span>
                        )}
                      </div>
                    </div>
                    {stop.duration && (
                      <span className="text-[11px] text-gray-400 font-mono">
                        {stop.duration}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ITINERARIO (TRAYECTOS & PARADAS CRONOLÓGICAS)                      */}
      {/* ========================================================================= */}
      {activeTab === 'itinerario' && (
        <div className="space-y-8">
          
          {/* SECCIÓN 1: TRAYECTOS & TRANSPORTE */}
          <div className="p-5 rounded-2xl bg-[#161622] border border-[#252536] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Route className="w-4 h-4 text-teal-400" />
                  <span>Trayectos & Medios de Transporte ({legs.length})</span>
                </h3>
                <p className="text-[11px] text-gray-400">
                  Registra tramos por moto, carro, avión, bici o transporte público con odómetros o distancias estimadas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingLeg({
                    transport_type: 'carro',
                    distance_unit: 'km',
                    distance_source: 'estimated',
                    origin: origin || '',
                    destination: destination || ''
                  });
                  setIsLegModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-sm transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Añadir trayecto</span>
              </button>
            </div>

            {legs.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-[#29293a] text-center text-gray-400 text-xs">
                No hay trayectos registrados para este viaje. Haz clic en «Añadir trayecto» para iniciar el registro.
              </div>
            ) : (
              <div className="space-y-3">
                {legs.map((leg, idx) => {
                  const transportMeta = TRANSPORT_OPTIONS.find(t => t.id === leg.transport_type) || TRANSPORT_OPTIONS[0];
                  const Icon = transportMeta.icon;
                  const isVehicle = transportMeta.isVehicle;

                  return (
                    <div 
                      key={leg.id}
                      className="p-4 rounded-xl bg-[#1a1a26] border border-[#29293c] flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:border-[#383852] transition"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-[#232334] text-teal-400 flex-shrink-0 mt-0.5">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-white">
                              {leg.origin || 'Origen'} → {leg.destination || 'Destino'}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#232332] text-teal-300 uppercase">
                              {leg.transport_type === 'otro' && leg.transport_custom ? leg.transport_custom : transportMeta.label}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-gray-400 flex-wrap">
                            {leg.distance > 0 && (
                              <span className="font-semibold text-white">
                                {leg.distance} {leg.distance_unit}
                                {leg.distance_source === 'odometer' && ' (odómetro)'}
                              </span>
                            )}
                            {leg.departure_time && (
                              <span>Salida: {new Date(leg.departure_time).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                            )}
                            {isVehicle && (leg.odometer_start !== undefined && leg.odometer_end !== undefined) && (
                              <span className="font-mono text-gray-400">
                                Odo: {leg.odometer_start} → {leg.odometer_end}
                              </span>
                            )}
                            {leg.fuel_amount ? (
                              <span className="text-amber-400 flex items-center gap-1 font-mono">
                                <Fuel className="w-3 h-3" />
                                {leg.fuel_amount} {leg.fuel_unit || 'gal'} {leg.fuel_cost ? `(${formatMoney(leg.fuel_cost, currency)})` : ''}
                              </span>
                            ) : null}
                          </div>

                          {leg.notes && (
                            <p className="text-[11px] text-gray-400 italic">
                              {leg.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {leg.maps_url && (
                          <a
                            href={leg.maps_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-[#222230] text-gray-300 hover:text-white"
                            title="Ver en mapas"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingLeg(leg);
                            setIsLegModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-[#222230] text-gray-300 hover:text-white"
                          title="Editar trayecto"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLeg(leg.id)}
                          className="p-1.5 rounded-lg bg-[#222230] text-red-400 hover:text-red-300 hover:bg-red-950/40"
                          title="Eliminar trayecto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECCIÓN 2: PARADAS, DESTINOS Y ACTIVIDADES */}
          <div className="p-5 rounded-2xl bg-[#161622] border border-[#252536] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-pink-400" />
                  <span>Paradas, Destinos & Actividades ({stops.length})</span>
                </h3>
                <p className="text-[11px] text-gray-400">
                  Organiza cronológicamente tus visitas, sitios turísticos, reservas y actividades.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingStop({ status: 'pending', name: '' });
                  setIsStopModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold shadow-sm transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Añadir parada</span>
              </button>
            </div>

            {stops.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-[#29293a] text-center text-gray-400 text-xs">
                No hay paradas registradas en el itinerario. Haz clic en «Añadir parada».
              </div>
            ) : (
              <div className="space-y-3">
                {stops.map((stop, index) => (
                  <div 
                    key={stop.id}
                    className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                      stop.status === 'completed' 
                        ? 'bg-[#15151e]/80 border-[#222230] opacity-80' 
                        : 'bg-[#1a1a26] border-[#29293c] hover:border-[#383852]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => handleToggleStopStatus(stop)}
                        className="mt-0.5 text-gray-500 hover:text-emerald-400 transition"
                      >
                        {stop.status === 'completed' ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                      </button>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold text-gray-500">#{index + 1}</span>
                          <span className={`text-xs font-bold ${stop.status === 'completed' ? 'line-through text-gray-400' : 'text-white'}`}>
                            {stop.name}
                          </span>
                        </div>

                        {stop.location && (
                          <span className="text-[11px] text-gray-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-pink-400 flex-shrink-0" />
                            {stop.location}
                          </span>
                        )}

                        <div className="flex items-center gap-3 text-[11px] text-gray-400 flex-wrap">
                          {stop.scheduled_time && (
                            <span>Previsto: {new Date(stop.scheduled_time).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                          )}
                          {stop.duration && (
                            <span className="flex items-center gap-1 font-mono">
                              <Clock className="w-3 h-3 text-blue-400" />
                              {stop.duration}
                            </span>
                          )}
                        </div>

                        {stop.notes && (
                          <p className="text-[11px] text-gray-400 italic">
                            {stop.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {stop.maps_url && (
                        <a
                          href={stop.maps_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg bg-[#222230] text-gray-300 hover:text-white"
                          title="Ver en mapas"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingStop(stop);
                          setIsStopModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg bg-[#222230] text-gray-300 hover:text-white"
                        title="Editar parada"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteStop(stop.id)}
                        className="p-1.5 rounded-lg bg-[#222230] text-red-400 hover:text-red-300 hover:bg-red-950/40"
                        title="Eliminar parada"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: GASTOS (REGISTRO INDEPENDIENTE + CATEGORÍAS + COSTO POR KM)       */}
      {/* ========================================================================= */}
      {activeTab === 'gastos' && (
        <div className="space-y-6">
          
          {/* Resumen Financiero */}
          <div className="p-5 rounded-2xl bg-[#161622] border border-[#252536] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 block">Balance de Gastos</span>
                <div className="text-2xl sm:text-3xl font-extrabold text-white mt-0.5">
                  {formatMoney(mainCurrencyTotal, currency)}
                </div>
              </div>

              {estimatedBudget > 0 && (
                <div className="text-right sm:text-right">
                  <span className="text-[11px] text-gray-400 block">Presupuesto asignado</span>
                  <span className="text-sm font-bold text-gray-200">
                    {formatMoney(estimatedBudget, currency)}
                  </span>
                  <div className="text-[11px] text-emerald-400 mt-0.5 font-medium">
                    {mainCurrencyTotal <= estimatedBudget 
                      ? `Restante: ${formatMoney(estimatedBudget - mainCurrencyTotal, currency)}` 
                      : `Excedido por: ${formatMoney(mainCurrencyTotal - estimatedBudget, currency)}`}
                  </div>
                </div>
              )}
            </div>

            {/* Barra de progreso de presupuesto */}
            {estimatedBudget > 0 && (
              <div className="w-full h-2 rounded-full bg-[#20202e] overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${
                    mainCurrencyTotal > estimatedBudget ? 'bg-red-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, (mainCurrencyTotal / estimatedBudget) * 100)}%` }}
                />
              </div>
            )}

            {/* Multi-currency breakdown if multiple currencies exist */}
            {Object.keys(expensesTotalsByCurrency).length > 1 && (
              <div className="pt-3 border-t border-[#232332] flex items-center gap-4 text-xs text-gray-300">
                <span className="text-gray-500">Otras monedas:</span>
                {Object.entries(expensesTotalsByCurrency).map(([curr, amt]) => (
                  <span key={curr} className="font-mono bg-[#1c1c28] px-2 py-0.5 rounded border border-[#2b2b3a]">
                    {formatMoney(amt, curr)}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Filtros y Acción de Añadir */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={expenseSearchQuery}
                  onChange={(e) => setExpenseSearchQuery(e.target.value)}
                  placeholder="Buscar gastos..."
                  className="w-full bg-[#161622] border border-[#29293c] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white outline-none focus:border-emerald-500"
                />
              </div>

              <select
                value={expenseFilterCategory}
                onChange={(e) => setExpenseFilterCategory(e.target.value)}
                className="bg-[#161622] border border-[#29293c] rounded-xl px-3 py-1.5 text-xs text-white outline-none cursor-pointer"
              >
                <option value="all">Todas las categorías</option>
                {EXPENSE_CATEGORIES.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingExpense({
                  category: 'transporte',
                  currency: currency || 'COP',
                  expense_date: new Date().toISOString()
                });
                setIsExpenseModalOpen(true);
              }}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar gasto</span>
            </button>
          </div>

          {/* Lista de Gastos */}
          {filteredExpenses.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#161622] border border-dashed border-[#29293a] text-center text-gray-400 text-xs">
              No hay gastos registrados que coincidan con la búsqueda.
            </div>
          ) : (
            <div className="divide-y divide-[#222230] rounded-2xl bg-[#161622] border border-[#252536] overflow-hidden">
              {filteredExpenses.map(expense => {
                const catMeta = EXPENSE_CATEGORIES.find(c => c.id === expense.category) || EXPENSE_CATEGORIES[0];
                const Icon = catMeta.icon;

                return (
                  <div key={expense.id} className="p-4 flex items-center justify-between gap-3 hover:bg-[#1a1a26] transition">
                    <div className="flex items-center gap-3">
                      <div 
                        className="p-2.5 rounded-xl flex-shrink-0"
                        style={{ backgroundColor: `${catMeta.color}20`, color: catMeta.color }}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-white block">
                          {expense.concept}
                        </span>
                        <div className="flex items-center gap-2 text-[11px] text-gray-400 flex-wrap">
                          <span className="px-1.5 py-0.2 rounded bg-[#20202e] text-gray-300">
                            {catMeta.label}
                          </span>
                          {expense.vendor && <span>• {expense.vendor}</span>}
                          {expense.payment_method && <span>• {expense.payment_method}</span>}
                          <span>• {new Date(expense.expense_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
                        </div>
                        {expense.notes && (
                          <p className="text-[11px] text-gray-400 italic">
                            {expense.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-sm font-extrabold text-white block">
                          {formatMoney(expense.amount, expense.currency)}
                        </span>
                        {expense.receipt_url && (
                          <a
                            href={expense.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-teal-400 hover:underline flex items-center justify-end gap-1"
                          >
                            <Receipt className="w-3 h-3" />
                            <span>Ver recibo</span>
                          </a>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingExpense(expense);
                            setIsExpenseModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-white"
                          title="Editar gasto"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteExpense(expense.id)}
                          className="p-1.5 rounded-lg text-red-400 hover:text-red-300"
                          title="Eliminar gasto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: DIARIO Y NOTAS (BITÁCORA INDEPENDIENTE + EDITOR ENRIQUECIDO TIPTAP) */}
      {/* ========================================================================= */}
      {activeTab === 'diario' && (
        <div className="space-y-8">
          
          {/* SECCIÓN 1: BITÁCORA / ENTRADAS DE DIARIO CON FOTOS */}
          <div className="p-5 rounded-2xl bg-[#161622] border border-[#252536] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-purple-400" />
                  <span>Entradas de Diario & Bitácora ({journals.length})</span>
                </h3>
                <p className="text-[11px] text-gray-400">
                  Registra memorias, experiencias y anécdotas de cada día con fotografías.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingJournal({
                    title: `Día de Viaje - ${new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`,
                    entry_date: new Date().toISOString(),
                    content: '',
                    image_urls: []
                  });
                  setIsJournalModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-sm transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nueva entrada</span>
              </button>
            </div>

            {journals.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-[#29293a] text-center text-gray-400 text-xs">
                No hay entradas en el diario todavía. Haz clic en «Nueva entrada» para registrar tus vivencias.
              </div>
            ) : (
              <div className="space-y-4">
                {journals.map(entry => (
                  <div key={entry.id} className="p-4 rounded-xl bg-[#1a1a26] border border-[#29293c] space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-white block">{entry.title}</span>
                        <div className="flex items-center gap-2 text-[11px] text-gray-400">
                          <span>{new Date(entry.entry_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                          {entry.location && <span>• {entry.location}</span>}
                          {entry.mood && <span>• Ánimo: {entry.mood}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingJournal(entry);
                            setIsJournalModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-white"
                          title="Editar entrada"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteJournal(entry.id)}
                          className="p-1.5 rounded-lg text-red-400 hover:text-red-300"
                          title="Eliminar entrada"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {entry.content && (
                      <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {entry.content}
                      </p>
                    )}

                    {entry.image_urls && entry.image_urls.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                        {entry.image_urls.map((img, i) => (
                          <a
                            key={i}
                            href={img}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="relative aspect-video rounded-lg overflow-hidden border border-[#2f2f45] group bg-black/40"
                          >
                            <img src={img} alt="" className="w-full h-full object-cover group-hover:scale-105 transition" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECCIÓN 2: NOTAS GENERALES CON TIPTAP */}
          <div className="p-5 rounded-2xl bg-[#161622] border border-[#252536] space-y-4">
            <div className="flex items-center justify-between border-b border-[#232332] pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <StickyNote className="w-4 h-4 text-amber-400" />
                  <span>Bitácora General & Notas Enriquecidas</span>
                </h3>
                <p className="text-[11px] text-gray-400">
                  Documento principal del viaje con texto enriquecido, tablas, imágenes y enlaces.
                </p>
              </div>
              <div className="flex items-center gap-2">
              {onOpenAudioModal && (
                <button
                  type="button"
                  onClick={onOpenAudioModal}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 transition shadow-sm"
                  title="Grabar o insertar nota de voz en la bitácora"
                >
                  <Mic className="w-3.5 h-3.5 text-red-400" />
                  <span>Voz</span>
                </button>
              )}
              <TableGridPicker editor={editor} showLabel={true} />
            </div>
            </div>

            {/* Contextual Table Toolbar */}
            <TableToolbar editor={editor} className="rounded-xl border border-[#252538] mb-2" />

            {/* Editor de TipTap */}
            <div className="min-h-[220px] rounded-xl bg-[#121218] border border-[#252538] p-4 text-white">
              {editor ? (
                <EditorContent editor={editor} className="prose prose-invert max-w-none text-xs sm:text-sm focus:outline-none" />
              ) : (
                <div className="text-gray-500 text-xs">Cargando editor...</div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: ARCHIVOS (CARPETA R2 + BILLETES + COMPROBANTES + FOTOS)            */}
      {/* ========================================================================= */}
      {activeTab === 'archivos' && (
        <div className="space-y-6">
          
          {/* Carpeta Vinculada de Cloudflare R2 */}
          <div className="p-5 rounded-2xl bg-[#161622] border border-[#252536] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Folder className="w-4 h-4 text-cyan-400" />
                  <span>Carpeta en Gestor de Archivos (Cloudflare R2)</span>
                </h3>
                <p className="text-[11px] text-gray-400">
                  Organiza todos los archivos de este viaje en una carpeta dedicada de Segundo Cerebro.
                </p>
              </div>

              {linkedFolder ? (
                <div className="flex items-center gap-2">
                  <div className="px-3 py-1.5 rounded-xl bg-cyan-950/40 border border-cyan-800/40 text-xs text-cyan-300 flex items-center gap-2">
                    <Folder className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="font-semibold">{linkedFolder.name}</span>
                  </div>
                  {onNavigateToEntity && (
                    <button
                      type="button"
                      onClick={() => onNavigateToEntity(linkedFolder.id, 'file')}
                      className="px-3 py-1.5 rounded-xl bg-[#232334] hover:bg-[#2b2b40] text-white text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Abrir carpeta</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCreateTripFolder}
                    disabled={isCreatingFolder}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition"
                  >
                    {isCreatingFolder ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderPlus className="w-3.5 h-3.5" />}
                    <span>Crear carpeta para este viaje</span>
                  </button>

                  {folders.length > 0 && (
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          onPropertyChange('folder_id', e.target.value);
                          onSaveStatusChange('dirty');
                        }
                      }}
                      className="bg-[#1c1c28] border border-[#303046] text-gray-300 rounded-xl px-2.5 py-1.5 text-xs outline-none"
                    >
                      <option value="">Vincular carpeta existente...</option>
                      {folders.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Subida y Lista de Archivos */}
          <div className="p-5 rounded-2xl bg-[#161622] border border-[#252536] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Archivos & Documentos ({tripFiles.length})
                </h4>
                <p className="text-[11px] text-gray-400">
                  Billetes de avión, reservas de hotel, fotografías, pólizas y comprobantes.
                </p>
              </div>

              {/* Upload trigger */}
              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#232334] hover:bg-[#2e2e44] text-white text-xs font-semibold cursor-pointer transition">
                <Upload className="w-3.5 h-3.5 text-teal-400" />
                <span>Subir archivo</span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      for (let i = 0; i < e.target.files.length; i++) {
                        const f = e.target.files[i];
                        try {
                          const res = await r2Storage.uploadFile(f, `trips/${object.id}/files`);
                          const rec = await db.recordAttachment({
                            entity_id: object.id,
                            entity_type: 'object',
                            folder_id: folderId || undefined,
                            file_name: res.name,
                            display_name: f.name,
                            file_url: res.url,
                            file_path: res.r2Key,
                            r2_key: res.provider === 'r2' ? res.r2Key : undefined,
                            storage_provider: res.provider,
                            file_size: res.size,
                            mime_type: res.mime
                          });
                          if (rec && onAttachmentCreated) onAttachmentCreated(rec);
                        } catch (err: any) {
                          alert(`Error subiendo ${f.name}: ` + err.message);
                        }
                      }
                      e.target.value = '';
                    }
                  }}
                />
              </label>
            </div>

            {tripFiles.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-[#29293a] text-center text-gray-400 text-xs">
                No hay archivos adjuntos en este viaje.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {tripFiles.map(file => (
                  <div key={file.id} className="p-3 rounded-xl bg-[#1a1a26] border border-[#2b2b40] flex items-center justify-between gap-3 group">
                    <div className="flex items-center gap-2.5 truncate">
                      <FileText className="w-4 h-4 text-teal-400 flex-shrink-0" />
                      <div className="truncate">
                        <a
                          href={file.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-white hover:underline truncate block"
                        >
                          {file.display_name || file.file_name}
                        </a>
                        <span className="text-[10px] text-gray-400">
                          {file.file_size ? `${Math.round(file.file_size / 1024)} KB` : 'Archivo R2'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <a
                        href={file.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-white"
                        title="Ver / Descargar"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={async () => {
                          if (confirm('¿Eliminar este archivo?')) {
                            await db.deleteAttachment(file.id);
                            if (onAttachmentDeleted) onAttachmentDeleted(file.id, file.file_path || file.file_url);
                          }
                        }}
                        className="p-1.5 rounded-lg text-red-400 hover:text-red-300"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: PROPIEDADES & RELACIONES (BACKLINKS + PROYECTOS + VEHÍCULOS)       */}
      {/* ========================================================================= */}
      {activeTab === 'relaciones' && (
        <div className="space-y-6">
          
          {/* Relaciones con el resto de Segundo Cerebro */}
          <div className="p-5 rounded-2xl bg-[#161622] border border-[#252536] space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>Relaciones con el Sistema</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              
              {/* Proyecto Asociado */}
              <div>
                <label className="text-gray-400 font-medium block mb-1">Proyecto asociado</label>
                <select
                  value={object.project_id || ''}
                  onChange={async (e) => {
                    const nextVal = e.target.value || null;
                    await db.updateObject(object.id, { project_id: nextVal });
                    onSaveStatusChange('saved');
                  }}
                  className="w-full bg-[#1c1c28] border border-[#2c2c40] rounded-xl px-3 py-2 text-white outline-none"
                >
                  <option value="">Sin proyecto asociado</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>

              {/* Área PARA Asociada */}
              <div>
                <label className="text-gray-400 font-medium block mb-1">Área de responsabilidad (PARA)</label>
                <select
                  value={object.area_id || ''}
                  onChange={async (e) => {
                    const nextVal = e.target.value || null;
                    await db.updateObject(object.id, { area_id: nextVal });
                    onSaveStatusChange('saved');
                  }}
                  className="w-full bg-[#1c1c28] border border-[#2c2c40] rounded-xl px-3 py-2 text-white outline-none"
                >
                  <option value="">Sin área asignada</option>
                  {areas.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              {/* Vehículo Asociado */}
              <div>
                <label className="text-gray-400 font-medium block mb-1">Vehículo principal asignado</label>
                <select
                  value={properties.vehicle_id || ''}
                  onChange={(e) => {
                    onPropertyChange('vehicle_id', e.target.value);
                    onSaveStatusChange('dirty');
                  }}
                  className="w-full bg-[#1c1c28] border border-[#2c2c40] rounded-xl px-3 py-2 text-white outline-none"
                >
                  <option value="">Sin vehículo asignado</option>
                  {allObjects.map(o => (
                    <option key={o.id} value={o.id}>{o.title} ({o.object_type})</option>
                  ))}
                </select>
              </div>

            </div>
          </div>

          {/* Vínculos y Backlinks */}
          <div className="p-5 rounded-2xl bg-[#161622] border border-[#252536] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Vínculos bidireccionales & Backlinks ({outgoingLinks.length + incomingLinks.length})
                </h4>
                <p className="text-[11px] text-gray-400">
                  Conexiones del grafo con notas, proyectos y otros objetos de Segundo Cerebro.
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenLinkSelector}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#232334] hover:bg-[#2f2f45] text-white text-xs font-semibold transition"
              >
                <Plus className="w-3.5 h-3.5 text-blue-400" />
                <span>Vincular entidad</span>
              </button>
            </div>

            {/* Outgoing */}
            {outgoingLinks.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-gray-400 block">Enlaces salientes:</span>
                <div className="flex flex-wrap gap-2">
                  {outgoingLinks.map(link => (
                    <button
                      key={link.id}
                      type="button"
                      onClick={() => onNavigateToEntity && link.target_id && onNavigateToEntity(link.target_id, link.target_type || 'object')}
                      className="px-2.5 py-1 rounded-lg bg-[#1a1a26] border border-[#2d2d40] text-xs text-blue-300 hover:text-white flex items-center gap-1.5"
                    >
                      <Share2 className="w-3 h-3 text-blue-400" />
                      <span>{link.target_id ? `${link.target_id.slice(0, 8)}...` : 'Enlace'}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Incoming / Backlinks */}
            {incomingLinks.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-[#232332]">
                <span className="text-[11px] font-semibold text-gray-400 block">Mencionado en (Backlinks):</span>
                <div className="flex flex-wrap gap-2">
                  {incomingLinks.map(link => (
                    <button
                      key={link.id}
                      type="button"
                      onClick={() => onNavigateToEntity && link.source_id && onNavigateToEntity(link.source_id, link.source_type || 'object')}
                      className="px-2.5 py-1 rounded-lg bg-[#1a1a26] border border-[#2d2d40] text-xs text-indigo-300 hover:text-white flex items-center gap-1.5"
                    >
                      <Share2 className="w-3 h-3 text-indigo-400" />
                      <span>{link.source_id ? `${link.source_id.slice(0, 8)}...` : 'Enlace'}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: AÑADIR / EDITAR TRAYECTO (LEG)                                     */}
      {/* ========================================================================= */}
      {isLegModalOpen && editingLeg && (
        <div 
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setIsLegModalOpen(false)}
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="w-full max-w-lg bg-[#161622] border border-[#2c2c42] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="px-5 py-4 border-b border-[#242436] flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Route className="w-4 h-4 text-teal-400" />
                <span>{editingLeg.id ? 'Editar Trayecto' : 'Nuevo Trayecto'}</span>
              </h3>
              <button 
                type="button" 
                onClick={() => setIsLegModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveLeg} className="p-5 space-y-4 overflow-y-auto no-scrollbar text-xs">
              
              {/* Medio de transporte */}
              <div>
                <label className="text-gray-300 font-medium block mb-1">Medio de transporte *</label>
                <div className="grid grid-cols-3 gap-2">
                  {TRANSPORT_OPTIONS.map(opt => {
                    const isSelected = editingLeg.transport_type === opt.id;
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setEditingLeg(prev => ({ ...prev, transport_type: opt.id }))}
                        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-left transition ${
                          isSelected
                            ? 'bg-teal-600/25 border-teal-500 text-white font-semibold'
                            : 'bg-[#1a1a26] border-[#29293c] text-gray-300 hover:bg-[#202030]'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
                        <span className="truncate">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {editingLeg.transport_type === 'otro' && (
                <div>
                  <label className="text-gray-300 font-medium block mb-1">Describe el medio de transporte</label>
                  <input
                    type="text"
                    value={editingLeg.transport_custom || ''}
                    onChange={e => setEditingLeg(prev => ({ ...prev, transport_custom: e.target.value }))}
                    placeholder="Ej. Teleférico, Caballo, Cuatrimoto..."
                    className="w-full bg-[#121218] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
              )}

              {/* Origen y Destino */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-300 font-medium block mb-1">Origen *</label>
                  <input
                    type="text"
                    required
                    value={editingLeg.origin || ''}
                    onChange={e => setEditingLeg(prev => ({ ...prev, origin: e.target.value }))}
                    placeholder="Ej. Bogotá"
                    className="w-full bg-[#121218] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-gray-300 font-medium block mb-1">Destino *</label>
                  <input
                    type="text"
                    required
                    value={editingLeg.destination || ''}
                    onChange={e => setEditingLeg(prev => ({ ...prev, destination: e.target.value }))}
                    placeholder="Ej. Tunja"
                    className="w-full bg-[#121218] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
              </div>

              {/* Si es vehículo propio (moto, carro, bicicleta) muestra odómetros y combustible */}
              {['moto', 'carro', 'bicicleta'].includes(editingLeg.transport_type || '') && (
                <div className="p-3.5 rounded-xl bg-[#1a1a26] border border-[#2c2c40] space-y-3">
                  <span className="text-[11px] font-bold text-teal-300 uppercase tracking-wider block">
                    Odómetro & Combustible (Vehículo)
                  </span>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-gray-400 block mb-1">Odómetro inicial (km)</label>
                      <input
                        type="number"
                        value={editingLeg.odometer_start ?? ''}
                        onChange={e => setEditingLeg(prev => ({ ...prev, odometer_start: e.target.value ? Number(e.target.value) : undefined }))}
                        placeholder="Ej. 12450"
                        className="w-full bg-[#121218] border border-[#2a2a3e] rounded-lg px-2.5 py-1.5 text-white outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 block mb-1">Odómetro final (km)</label>
                      <input
                        type="number"
                        value={editingLeg.odometer_end ?? ''}
                        onChange={e => setEditingLeg(prev => ({ ...prev, odometer_end: e.target.value ? Number(e.target.value) : undefined }))}
                        placeholder="Ej. 12580"
                        className="w-full bg-[#121218] border border-[#2a2a3e] rounded-lg px-2.5 py-1.5 text-white outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-gray-400 block mb-1">Combustible (Galones o Litros)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingLeg.fuel_amount ?? ''}
                        onChange={e => setEditingLeg(prev => ({ ...prev, fuel_amount: e.target.value ? Number(e.target.value) : undefined }))}
                        placeholder="Ej. 3.5"
                        className="w-full bg-[#121218] border border-[#2a2a3e] rounded-lg px-2.5 py-1.5 text-white outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 block mb-1">Costo combustible ({currency})</label>
                      <input
                        type="number"
                        value={editingLeg.fuel_cost ?? ''}
                        onChange={e => setEditingLeg(prev => ({ ...prev, fuel_cost: e.target.value ? Number(e.target.value) : undefined }))}
                        placeholder="Ej. 55000"
                        className="w-full bg-[#121218] border border-[#2a2a3e] rounded-lg px-2.5 py-1.5 text-white outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Distancia y Unidad */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-300 font-medium block mb-1">Distancia</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.1"
                      value={editingLeg.distance ?? ''}
                      onChange={e => setEditingLeg(prev => ({ ...prev, distance: Number(e.target.value) || 0 }))}
                      placeholder="0"
                      className="flex-1 bg-[#121218] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none font-mono"
                    />
                    <select
                      value={editingLeg.distance_unit || 'km'}
                      onChange={e => setEditingLeg(prev => ({ ...prev, distance_unit: e.target.value as any }))}
                      className="bg-[#121218] border border-[#2a2a3e] rounded-xl px-2.5 py-2 text-white outline-none"
                    >
                      <option value="km">km</option>
                      <option value="mi">mi</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-gray-300 font-medium block mb-1">Fuente de distancia</label>
                  <select
                    value={editingLeg.distance_source || 'odometer'}
                    onChange={e => setEditingLeg(prev => ({ ...prev, distance_source: e.target.value as any }))}
                    className="w-full bg-[#121218] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none"
                  >
                    <option value="odometer">Odómetro real</option>
                    <option value="estimated">Ruta estimada (Maps)</option>
                    <option value="manual">Manual / Aproximada</option>
                  </select>
                </div>
              </div>

              {/* Enlace Maps y Notas */}
              <div>
                <label className="text-gray-300 font-medium block mb-1">Enlace a mapas o navegación</label>
                <input
                  type="url"
                  value={editingLeg.maps_url || ''}
                  onChange={e => setEditingLeg(prev => ({ ...prev, maps_url: e.target.value }))}
                  placeholder="https://maps.app.goo.gl/..."
                  className="w-full bg-[#121218] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>

              <div>
                <label className="text-gray-300 font-medium block mb-1">Notas, incidencias u observaciones</label>
                <textarea
                  rows={2}
                  value={editingLeg.notes || ''}
                  onChange={e => setEditingLeg(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Ej. Peajes pagados, buen estado de la vía, lluvia intensa..."
                  className="w-full bg-[#121218] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#232332]">
                <button
                  type="button"
                  onClick={() => setIsLegModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold shadow-sm"
                >
                  Guardar Trayecto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: AÑADIR / EDITAR PARADA O ACTIVIDAD (STOP)                           */}
      {/* ========================================================================= */}
      {isStopModalOpen && editingStop && (
        <div 
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setIsStopModalOpen(false)}
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="w-full max-w-lg bg-[#161622] border border-[#2c2c42] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="px-5 py-4 border-b border-[#242436] flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-pink-400" />
                <span>{editingStop.id ? 'Editar Parada / Actividad' : 'Nueva Parada o Actividad'}</span>
              </h3>
              <button 
                type="button" 
                onClick={() => setIsStopModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStop} className="p-5 space-y-4 overflow-y-auto no-scrollbar text-xs">
              <div>
                <label className="text-gray-300 font-medium block mb-1">Nombre del lugar o actividad *</label>
                <input
                  type="text"
                  required
                  value={editingStop.name || ''}
                  onChange={e => setEditingStop(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej. Hotel Plaza Mayor, Museo El Fósil, Almuerzo piqueteadero..."
                  className="w-full bg-[#121218] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>

              <div>
                <label className="text-gray-300 font-medium block mb-1">Ubicación o dirección textual</label>
                <input
                  type="text"
                  value={editingStop.location || ''}
                  onChange={e => setEditingStop(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Ej. Calle 12 # 4-50, Villa de Leyva"
                  className="w-full bg-[#121218] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-300 font-medium block mb-1">Duración estimada</label>
                  <input
                    type="text"
                    value={editingStop.duration || ''}
                    onChange={e => setEditingStop(prev => ({ ...prev, duration: e.target.value }))}
                    placeholder="Ej. 2 horas, 1 noche..."
                    className="w-full bg-[#121218] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-gray-300 font-medium block mb-1">Estado</label>
                  <select
                    value={editingStop.status || 'pending'}
                    onChange={e => setEditingStop(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full bg-[#121218] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none"
                  >
                    <option value="pending">Pendiente / Por visitar</option>
                    <option value="completed">Completada / Visitada</option>
                    <option value="skipped">Omitida / Cancelada</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-gray-300 font-medium block mb-1">Enlace a mapas o web de reservas</label>
                <input
                  type="url"
                  value={editingStop.maps_url || ''}
                  onChange={e => setEditingStop(prev => ({ ...prev, maps_url: e.target.value }))}
                  placeholder="https://booking.com/... o https://maps.google.com/..."
                  className="w-full bg-[#121218] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>

              <div>
                <label className="text-gray-300 font-medium block mb-1">Notas o instrucciones</label>
                <textarea
                  rows={2}
                  value={editingStop.notes || ''}
                  onChange={e => setEditingStop(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Ej. Check-in a las 15:00, código de entrada 4920..."
                  className="w-full bg-[#121218] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#232332]">
                <button
                  type="button"
                  onClick={() => setIsStopModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-semibold shadow-sm"
                >
                  Guardar Parada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REGISTRAR / EDITAR GASTO (EXPENSE)                                 */}
      {/* ========================================================================= */}
      {isExpenseModalOpen && editingExpense && (
        <div 
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setIsExpenseModalOpen(false)}
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="w-full max-w-lg bg-[#161622] border border-[#2c2c42] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="px-5 py-4 border-b border-[#242436] flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span>{editingExpense.id ? 'Editar Gasto' : 'Registrar Gasto de Viaje'}</span>
              </h3>
              <button 
                type="button" 
                onClick={() => setIsExpenseModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="p-5 space-y-4 overflow-y-auto no-scrollbar text-xs">
              <div>
                <label className="text-gray-300 font-medium block mb-1">Concepto o descripción *</label>
                <input
                  type="text"
                  required
                  value={editingExpense.concept || ''}
                  onChange={e => setEditingExpense(prev => ({ ...prev, concept: e.target.value }))}
                  placeholder="Ej. Gasolina Primax Tunja, Almuerzo típico, Hotel 2 noches..."
                  className="w-full bg-[#121218] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-300 font-medium block mb-1">Importe *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editingExpense.amount ?? ''}
                    onChange={e => setEditingExpense(prev => ({ ...prev, amount: Number(e.target.value) || 0 }))}
                    placeholder="0"
                    className="w-full bg-[#121218] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="text-gray-300 font-medium block mb-1">Moneda</label>
                  <input
                    type="text"
                    value={editingExpense.currency || currency || 'COP'}
                    onChange={e => setEditingExpense(prev => ({ ...prev, currency: e.target.value.toUpperCase() }))}
                    placeholder="COP"
                    className="w-full bg-[#121218] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none font-bold uppercase text-center"
                  />
                </div>
              </div>

              <div>
                <label className="text-gray-300 font-medium block mb-1">Categoría del gasto</label>
                <select
                  value={editingExpense.category || 'otros'}
                  onChange={e => setEditingExpense(prev => ({ ...prev, category: e.target.value as any }))}
                  className="w-full bg-[#121218] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none"
                >
                  {EXPENSE_CATEGORIES.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-300 font-medium block mb-1">Medio de pago</label>
                  <select
                    value={editingExpense.payment_method || 'efectivo'}
                    onChange={e => setEditingExpense(prev => ({ ...prev, payment_method: e.target.value }))}
                    className="w-full bg-[#121218] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none"
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta_credito">Tarjeta de Crédito</option>
                    <option value="tarjeta_debito">Tarjeta de Débito</option>
                    <option value="transferencia">Transferencia / Nequi / Daviplata</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="text-gray-300 font-medium block mb-1">Lugar o proveedor</label>
                  <input
                    type="text"
                    value={editingExpense.vendor || ''}
                    onChange={e => setEditingExpense(prev => ({ ...prev, vendor: e.target.value }))}
                    placeholder="Ej. Estación Texaco, Restaurante El Portal"
                    className="w-full bg-[#121218] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
              </div>

              {/* Subir Comprobante a Cloudflare R2 */}
              <div>
                <label className="text-gray-300 font-medium block mb-1">Recibo o factura adjunta</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editingExpense.receipt_url || ''}
                    onChange={e => setEditingExpense(prev => ({ ...prev, receipt_url: e.target.value }))}
                    placeholder="URL de recibo o sube un comprobante..."
                    className="flex-1 bg-[#121218] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => receiptInputRef.current?.click()}
                    disabled={isUploadingReceipt}
                    className="px-3 py-2 rounded-xl bg-[#232334] hover:bg-[#2b2b40] text-teal-400 text-xs font-semibold flex items-center gap-1.5 transition flex-shrink-0"
                  >
                    {isUploadingReceipt ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    <span>Subir a R2</span>
                  </button>
                  <input
                    type="file"
                    ref={receiptInputRef}
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        handleUploadReceipt(e.target.files[0]);
                      }
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="text-gray-300 font-medium block mb-1">Notas adicionales</label>
                <textarea
                  rows={2}
                  value={editingExpense.notes || ''}
                  onChange={e => setEditingExpense(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Detalles sobre el gasto..."
                  className="w-full bg-[#121218] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#232332]">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm"
                >
                  Guardar Gasto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ENTRADA DE DIARIO CON FOTOS (JOURNAL)                              */}
      {/* ========================================================================= */}
      {isJournalModalOpen && editingJournal && (
        <div 
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setIsJournalModalOpen(false)}
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="w-full max-w-lg bg-[#161622] border border-[#2c2c42] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="px-5 py-4 border-b border-[#242436] flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-purple-400" />
                <span>{editingJournal.id ? 'Editar Entrada de Diario' : 'Nueva Entrada de Bitácora'}</span>
              </h3>
              <button 
                type="button" 
                onClick={() => setIsJournalModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveJournal} className="p-5 space-y-4 overflow-y-auto no-scrollbar text-xs">
              <div>
                <label className="text-gray-300 font-medium block mb-1">Título de la entrada *</label>
                <input
                  type="text"
                  required
                  value={editingJournal.title || ''}
                  onChange={e => setEditingJournal(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Ej. Llegada a Villa de Leyva y primera caminata..."
                  className="w-full bg-[#121218] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-300 font-medium block mb-1">Ubicación del momento</label>
                  <input
                    type="text"
                    value={editingJournal.location || ''}
                    onChange={e => setEditingJournal(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="Ej. Mirador El Santo, Hotel"
                    className="w-full bg-[#121218] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-gray-300 font-medium block mb-1">Estado de ánimo / Sensación</label>
                  <input
                    type="text"
                    value={editingJournal.mood || ''}
                    onChange={e => setEditingJournal(prev => ({ ...prev, mood: e.target.value }))}
                    placeholder="Ej. Emocionado, Relajado, Cansado..."
                    className="w-full bg-[#121218] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-gray-300 font-medium block mb-1">Relato y observaciones</label>
                <textarea
                  rows={4}
                  value={editingJournal.content || ''}
                  onChange={e => setEditingJournal(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Escribe lo que viviste hoy, lugares descubiertos, personas conocidas..."
                  className="w-full bg-[#121218] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none resize-none leading-relaxed"
                />
              </div>

              {/* Fotografías */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-gray-300 font-medium block">Fotografías ({editingJournal.image_urls?.length || 0})</label>
                  <button
                    type="button"
                    onClick={() => journalPhotoInputRef.current?.click()}
                    disabled={isUploadingJournalPhoto}
                    className="text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1"
                  >
                    {isUploadingJournalPhoto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
                    <span>+ Subir foto a R2</span>
                  </button>
                  <input
                    type="file"
                    ref={journalPhotoInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        handleUploadJournalPhoto(e.target.files[0]);
                      }
                    }}
                  />
                </div>

                {editingJournal.image_urls && editingJournal.image_urls.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {editingJournal.image_urls.map((img, i) => (
                      <div key={i} className="relative aspect-video rounded-lg overflow-hidden border border-[#2d2d42] group">
                        <img src={img} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            setEditingJournal(prev => ({
                              ...prev,
                              image_urls: prev?.image_urls?.filter((_, idx) => idx !== i)
                            }));
                          }}
                          className="absolute top-1 right-1 p-1 rounded-md bg-black/60 text-white hover:text-red-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#232332]">
                <button
                  type="button"
                  onClick={() => setIsJournalModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold shadow-sm"
                >
                  Guardar Entrada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
