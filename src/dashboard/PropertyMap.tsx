import { useCallback, useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useQuery } from '@tanstack/react-query';
import { api, type MapFeatureCollection } from '../lib/api';
import { Skeleton } from '../components/ui/skeleton';

// Jackson County, MO bounds
const DEFAULT_BBOX: [number, number, number, number] = [-94.7, 38.65, -93.8, 39.5];
const CENTER: [number, number] = [-94.37, 39.03];
const ZOOM = 8.5;

// Public vector tile style (OpenFreeMap)
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

interface Props {
  onSelect?: (parcelId: string, propertyId: number) => void;
  selectedParcelId?: string | null;
}

export default function PropertyMap({ onSelect, selectedParcelId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [bbox, setBbox] = useState<[number, number, number, number]>(DEFAULT_BBOX);
  const [styleReady, setStyleReady] = useState(false);

  const mapQuery = useQuery({
    queryKey: ['map-properties', bbox],
    queryFn: () => api.mapProperties(bbox, 8000),
    enabled: true,
    staleTime: 30_000,
  });

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: CENTER,
      zoom: ZOOM,
      attributionControl: false,
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    mapRef.current = map;
    // Expose for deterministic tests/tooling: programmatic selection and map
    // introspection. This is the same code path the real parcel-fill click uses.
    (window as unknown as Record<string, unknown>).__reMap = map;

    const updateBbox = () => {
      const b = map.getBounds();
      setBbox([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    };

    map.on('load', () => setStyleReady(true));
    map.on('moveend', updateBbox);
    map.on('zoomend', updateBbox);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const ensureStyleReady = useCallback(() => {
    const map = mapRef.current;
    if (!map) return false;
    // The style is "ready" once its JSON has been applied (base layers exist).
    // isStyleLoaded()/loaded() only turn true after render completion, which
    // can lag or stall (e.g. software WebGL), so prefer the presence of layers.
    const style = map.getStyle();
    return !!(style && Array.isArray(style.layers) && style.layers.length > 0);
  }, []);

  // Selection handler — the same one the real parcel-fill click listener calls.
  // Extracted so tests can exercise the identical path without WebGL hit-testing.
  const handleParcelSelect = useCallback(
    (parcelId: string, propertyId: number) => {
      if (parcelId && onSelect) onSelect(parcelId, propertyId);
    },
    [onSelect]
  );

  const renderParcels = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapQuery.data) return;
    if (!ensureStyleReady()) return;

    const sourceId = 'parcels';
    if (map.getSource(sourceId)) {
      (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(mapQuery.data);
    } else {
      map.addSource(sourceId, { type: 'geojson', data: mapQuery.data as MapFeatureCollection });
      map.addLayer({
        id: 'parcel-fill',
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': [
            'interpolate',
            ['linear'],
            ['get', 'market_value_total'],
            0, '#fde68a',
            150000, '#fcd34d',
            300000, '#f59e0b',
            600000, '#ea580c',
            1000000, '#991b1b',
          ],
          'fill-opacity': 0.55,
        },
      });
      map.addLayer({
        id: 'parcel-line',
        type: 'line',
        source: sourceId,
        paint: { 'line-color': '#475569', 'line-width': 0.4 },
      });
      map.addLayer({
        id: 'parcel-selected',
        type: 'line',
        source: sourceId,
        paint: { 'line-color': '#7c3aed', 'line-width': 2.5 },
        filter: ['==', ['get', 'parcel_id'], ''],
      });

      map.on('click', 'parcel-fill', (e) => {
        const f = e.features?.[0];
        if (f) handleParcelSelect(f.properties.parcel_id, f.properties.property_id);
      });
      map.on('mouseenter', 'parcel-fill', () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', 'parcel-fill', () => (map.getCanvas().style.cursor = ''));
    }

    const selLayer = map.getLayer('parcel-selected');
    if (selLayer) {
      map.setFilter('parcel-selected', ['==', ['get', 'parcel_id'], selectedParcelId ?? '']);
    }
  }, [mapQuery.data, selectedParcelId, handleParcelSelect, ensureStyleReady]);

  // Expose the same selection handler for deterministic tests.
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__reSelectParcel = handleParcelSelect;
    return () => {
      delete (window as unknown as Record<string, unknown>).__reSelectParcel;
    };
  }, [handleParcelSelect]);

  // Render parcels once both data and style are ready (poll style as a fallback).
  useEffect(() => {
    if (!mapQuery.data) return;
    if (ensureStyleReady()) {
      renderParcels();
      return;
    }
    const poll = setInterval(() => {
      if (ensureStyleReady()) {
        clearInterval(poll);
        renderParcels();
      }
    }, 250);
    return () => clearInterval(poll);
  }, [mapQuery.data, renderParcels, ensureStyleReady]);

  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-lg">
      {!styleReady && !ensureStyleReady() && <Skeleton className="absolute inset-0 z-10" />}
      <div ref={containerRef} className="absolute inset-0" />
      {mapQuery.isLoading && (
        <div className="absolute right-3 top-3 z-10 rounded bg-white/90 px-2 py-1 text-xs text-slate-600 shadow">
          Loading parcels…
        </div>
      )}
      {mapQuery.data && (
        <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1">
          <div className="rounded bg-white/90 px-2 py-1 text-xs text-slate-600 shadow">
            {mapQuery.data.truncated
              ? `${mapQuery.data.features.length.toLocaleString()} of ${mapQuery.data.total.toLocaleString()} parcels shown (limit ${mapQuery.data.limit.toLocaleString()})`
              : `${mapQuery.data.total.toLocaleString()} parcels in view`}
          </div>
          {mapQuery.data.truncated && (
            <div className="max-w-[220px] rounded bg-amber-50/95 px-2 py-1 text-xs leading-snug text-amber-800 shadow">
              Zoom in to see individual parcels — only the first {mapQuery.data.limit.toLocaleString()} are rendered at this view.
            </div>
          )}
        </div>
      )}
    </div>
  );
}