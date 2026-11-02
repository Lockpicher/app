import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  MapPin, 
  ExternalLink, 
  Search, 
  Crosshair, 
  Layers, 
  Eye, 
  Navigation,
  Globe,
  Phone,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { AppObject } from '../lib/types';

interface PlaceMapViewProps {
  places: AppObject[];
  onSelectPlace: (place: AppObject) => void;
  selectedPlaceId?: string | null;
  onUpdateCoordinates?: (placeId: string, lat: number, lng: number) => Promise<void>;
}

export const PlaceMapView: React.FC<PlaceMapViewProps> = ({
  places,
  onSelectPlace,
  selectedPlaceId,
  onUpdateCoordinates
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);

  const [activePlace, setActivePlace] = useState<AppObject | null>(null);
  const [mapLayer, setMapLayer] = useState<'standard' | 'satellite' | 'dark'>('dark');
  const [isAssigningPlace, setIsAssigningPlace] = useState<AppObject | null>(null);

  // Filter georeferenced places
  const georeferencedPlaces = places.filter(p => {
    const lat = Number(p.properties?.latitud ?? p.properties?.lat);
    const lng = Number(p.properties?.longitud ?? p.properties?.lng);
    return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
  });

  const unassignedPlaces = places.filter(p => {
    const lat = Number(p.properties?.latitud ?? p.properties?.lat);
    const lng = Number(p.properties?.longitud ?? p.properties?.lng);
    return isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0);
  });

  // Tile layer URLs
  const tileLayers = {
    dark: {
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    },
    standard: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors'
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{z}',
      attribution: '&copy; Esri &copy; OpenStreetMap'
    }
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Default center (e.g. Bogotá / Colombia or first place)
    let initialLat = 4.7110;
    let initialLng = -74.0721;
    let initialZoom = 6;

    if (georeferencedPlaces.length > 0) {
      const first = georeferencedPlaces[0];
      initialLat = Number(first.properties?.latitud || first.properties?.lat);
      initialLng = Number(first.properties?.longitud || first.properties?.lng);
      initialZoom = 12;
    }

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: initialZoom,
      zoomControl: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const layerConfig = tileLayers[mapLayer];
    const tileLayer = L.tileLayer(layerConfig.url, {
      attribution: layerConfig.attribution,
      maxZoom: 19
    }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;
    markersGroupRef.current = markersGroup;

    // Handle map click for manual coordinate assignment
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (isAssigningPlace && onUpdateCoordinates) {
        onUpdateCoordinates(isAssigningPlace.id, Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
        setIsAssigningPlace(null);
      }
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersGroupRef.current = null;
    };
  }, []);

  // Update Tile Layer if changed
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.eachLayer(layer => {
      if (layer instanceof L.TileLayer) {
        mapInstanceRef.current?.removeLayer(layer);
      }
    });
    const layerConfig = tileLayers[mapLayer];
    L.tileLayer(layerConfig.url, {
      attribution: layerConfig.attribution,
      maxZoom: 19
    }).addTo(mapInstanceRef.current);
  }, [mapLayer]);

  // Update Markers when places or selection change
  useEffect(() => {
    if (!mapInstanceRef.current || !markersGroupRef.current) return;
    const markersGroup = markersGroupRef.current;
    markersGroup.clearLayers();

    const bounds = L.latLngBounds([]);

    georeferencedPlaces.forEach(place => {
      const lat = Number(place.properties?.latitud || place.properties?.lat);
      const lng = Number(place.properties?.longitud || place.properties?.lng);
      if (isNaN(lat) || isNaN(lng)) return;

      bounds.extend([lat, lng]);

      const isSelected = selectedPlaceId === place.id || activePlace?.id === place.id;
      const typeLabel = place.properties?.place_type || 'Lugar';
      const city = place.properties?.ciudad || place.properties?.departamento || place.properties?.pais || '';

      // Custom HTML Pin icon
      const pinHtml = `
        <div class="relative flex items-center justify-center transform -translate-x-1/2 -translate-y-full transition-transform hover:scale-110 cursor-pointer">
          <div class="w-8 h-8 rounded-full ${isSelected ? 'bg-emerald-400 ring-4 ring-emerald-500/40' : 'bg-emerald-600'} text-white flex items-center justify-center shadow-lg border-2 border-[#16161d]">
            <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/>
            </svg>
          </div>
          <div class="absolute -bottom-1 w-2 h-2 bg-emerald-600 rotate-45 border-r border-b border-[#16161d]"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: pinHtml,
        className: 'place-custom-pin',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

      marker.on('click', () => {
        setActivePlace(place);
      });

      marker.addTo(markersGroup);
    });

    if (bounds.isValid() && georeferencedPlaces.length > 0) {
      if (georeferencedPlaces.length === 1) {
        mapInstanceRef.current.setView(bounds.getCenter(), 14);
      } else {
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    }
  }, [places, selectedPlaceId, activePlace]);

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-[#13131a]">
      {/* Map Header / Controls Overlay */}
      <div className="absolute top-3 left-3 z-[1000] flex items-center gap-2 bg-[#181824]/90 backdrop-blur-md p-1.5 rounded-xl border border-[#2d2d42] shadow-xl text-xs">
        <div className="flex items-center gap-1.5 px-2 py-1 text-gray-300 font-medium">
          <MapPin className="w-3.5 h-3.5 text-emerald-400" />
          <span>{georeferencedPlaces.length} ubicaciones georreferenciadas</span>
          {unassignedPlaces.length > 0 && (
            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full border border-amber-500/30">
              {unassignedPlaces.length} sin coordenadas
            </span>
          )}
        </div>

        <div className="h-4 w-px bg-[#323246]" />

        {/* Layer Switcher */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMapLayer('dark')}
            className={`px-2 py-1 rounded-lg text-[11px] font-medium transition ${mapLayer === 'dark' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Oscuro
          </button>
          <button
            type="button"
            onClick={() => setMapLayer('standard')}
            className={`px-2 py-1 rounded-lg text-[11px] font-medium transition ${mapLayer === 'standard' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Calles
          </button>
          <button
            type="button"
            onClick={() => setMapLayer('satellite')}
            className={`px-2 py-1 rounded-lg text-[11px] font-medium transition ${mapLayer === 'satellite' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Satélite
          </button>
        </div>
      </div>

      {/* Assignment Prompt Overlay */}
      {isAssigningPlace && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1000] bg-emerald-950/90 border border-emerald-500/50 backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl flex items-center gap-3 text-xs text-emerald-200 animate-in fade-in slide-in-from-top-2 duration-200">
          <Crosshair className="w-4 h-4 text-emerald-400 animate-spin" />
          <span>Haz clic en el mapa para ubicar: <strong>{isAssigningPlace.title}</strong></span>
          <button
            type="button"
            onClick={() => setIsAssigningPlace(null)}
            className="text-gray-400 hover:text-white underline ml-2 text-[11px]"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Main Leaflet Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Active Place Pop-up / Drawer (Bottom Card) */}
      {activePlace && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-[1000] bg-[#161622]/95 backdrop-blur-md border border-[#2e2e46] rounded-2xl p-4 shadow-2xl space-y-3 animate-fadeIn">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              {activePlace.thumbnail_url ? (
                <img loading="lazy" decoding="async" src={activePlace.thumbnail_url}
                  alt={activePlace.title}
                  className="w-12 h-12 rounded-xl object-cover border border-[#2e2e42] shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-emerald-950/80 border border-emerald-800/40 text-emerald-400 flex items-center justify-center shrink-0">
                  <MapPin className="w-6 h-6" />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {activePlace.properties?.place_type || 'Lugar'}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white truncate mt-0.5" title={activePlace.title}>
                  {activePlace.title}
                </h4>
                <p className="text-xs text-gray-400 truncate">
                  {[activePlace.properties?.barrio, activePlace.properties?.ciudad, activePlace.properties?.pais].filter(Boolean).join(', ') || 'Sin dirección'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActivePlace(null)}
              className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#202030] transition"
            >
              ✕
            </button>
          </div>

          {/* Quick info row */}
          <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-300 bg-[#101018] p-2.5 rounded-xl border border-[#242436]">
            <div>
              <span className="text-gray-500 block text-[10px]">Coordenadas GPS:</span>
              <span className="font-mono text-emerald-400">
                {Number(activePlace.properties?.latitud || activePlace.properties?.lat).toFixed(4)},{' '}
                {Number(activePlace.properties?.longitud || activePlace.properties?.lng).toFixed(4)}
              </span>
            </div>
            {activePlace.properties?.telefono && (
              <div>
                <span className="text-gray-500 block text-[10px]">Teléfono:</span>
                <a href={`tel:${activePlace.properties.telefono}`} className="text-blue-400 hover:underline truncate block">
                  {activePlace.properties.telefono}
                </a>
              </div>
            )}
            {activePlace.properties?.fecha_ultima_visita && (
              <div>
                <span className="text-gray-500 block text-[10px]">Última visita:</span>
                <span>{activePlace.properties.fecha_ultima_visita}</span>
              </div>
            )}
            {activePlace.properties?.website && (
              <div>
                <span className="text-gray-500 block text-[10px]">Sitio Web:</span>
                <a 
                  href={activePlace.properties.website} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-emerald-400 hover:underline truncate block"
                >
                  Visitar enlace ↗
                </a>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => onSelectPlace(activePlace)}
              className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition flex items-center justify-center gap-1.5 shadow-md"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Abrir Ficha de Lugar</span>
            </button>

            {activePlace.properties?.latitud && activePlace.properties?.longitud && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${activePlace.properties.latitud},${activePlace.properties.longitud}`}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2 px-3 rounded-xl bg-[#202030] hover:bg-[#28283c] text-gray-200 border border-[#32324a] text-xs font-medium transition flex items-center gap-1.5 shrink-0"
                title="Abrir en Google Maps"
              >
                <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                <span>Google Maps</span>
              </a>
            )}
          </div>
        </div>
      )}

      {/* Unassigned Places Floating Accordion */}
      {unassignedPlaces.length > 0 && !activePlace && (
        <div className="absolute bottom-4 left-4 z-[1000] max-w-sm bg-[#161622]/90 backdrop-blur-md border border-[#2e2e46] rounded-2xl p-3 shadow-xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-300 mb-2">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span>Lugares sin georreferenciar ({unassignedPlaces.length})</span>
          </div>
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {unassignedPlaces.map(p => (
              <div 
                key={p.id}
                className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-[#111119] border border-[#242436] text-[11px] text-gray-300"
              >
                <span className="truncate max-w-[170px]" title={p.title}>{p.title}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsAssigningPlace(p)}
                    className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[10px] flex items-center gap-1 transition"
                    title="Marcar posición en el mapa"
                  >
                    <Crosshair className="w-2.5 h-2.5" />
                    <span>Ubicar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectPlace(p)}
                    className="px-2 py-0.5 rounded bg-[#20202e] hover:bg-[#28283a] text-gray-300 text-[10px] transition"
                  >
                    Editar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
