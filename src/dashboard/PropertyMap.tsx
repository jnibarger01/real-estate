import { useCallback, useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useQuery } from '@tanstack/react-query';
import { api, type MapFeatureCollection } from '../lib/api';
import { clampMapBbox } from '../api/schemas';
import { Skeleton } from '../components/ui/skeleton';

// Jackson County, MO bounds (within the 1° map bbox span cap)
const DEFAULT_BBOX: [number, number, number, number] = [-94.7, 38.65, -93.8, 39.5];
const CENTER: [number, number] = [-94.37, 39.03];
const ZOOM = 8.5;

// Public vector tile style (OpenFreeMap)
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

const VALUE_COLOR: maplibregl.ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['get', 'market_value_total'],
  0, '#fde68a',
  150000, '#fcd34d',
  300000, '#f59e0b',
  600000, '#ea580c',
  1000000, '#991b1b',
];

interface Props {
  onSelect?: (parcelId: string, propertyId: number) => void;
  selectedParcelId?: string | null;
  focus?: { lng: number; lat: number } | null;
}

function removeLayer(map: maplibregl.Map, id: string) {
  if (map.getLayer(id)) map.removeLayer(id);
}

export default function PropertyMap({ onSelect, selectedParcelId, focus }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const modeRef = useRef<'points' | 'polygons' | null>(null);
  const handlersBoundRef = useRef(false);
  const [bbox, setBbox] = useState<[number, number, number, number]>(() => clampMapBbox(DEFAULT_BBOX));
  const [zoom, setZoom] = useState(ZOOM);
  const [styleReady, setStyleReady] = useState(false);

  const mapQuery = useQuery({
    queryKey: ['map-properties', bbox, zoom],
    queryFn: () => api.mapProperties(bbox, undefined, zoom),
    enabled: true,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: CENTER,
      zoom: ZOOM,
      attributionControl: false,
      maxBounds: [-95.5, 38.2, -93.2, 39.8],
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    mapRef.current = map;
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__reMap = map;
    }

    let debounce: ReturnType<typeof setTimeout> | undefined;
    const updateViewport = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        const b = map.getBounds();
        setBbox(clampMapBbox([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]));
        setZoom(map.getZoom());
      }, 300);
    };

    map.on('load', () => {
      setStyleReady(true);
      updateViewport();
    });
    map.on('moveend', updateViewport);
    map.on('zoomend', updateViewport);

    return () => {
      clearTimeout(debounce);
      map.remove();
      mapRef.current = null;
      modeRef.current = null;
      handlersBoundRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!focus || !mapRef.current) return;
    mapRef.current.flyTo({ center: [focus.lng, focus.lat], zoom: Math.max(mapRef.current.getZoom(), 16), duration: 800 });
  }, [focus]);

  const ensureStyleReady = useCallback(() => {
    const map = mapRef.current;
    if (!map) return false;
    const style = map.getStyle();
    return !!(style && Array.isArray(style.layers) && style.layers.length > 0);
  }, []);

  const handleParcelSelect = useCallback(
    (parcelId: string, propertyId: number) => {
      if (parcelId && onSelect) onSelect(parcelId, propertyId);
    },
    [onSelect]
  );

  const bindHandlersOnce = useCallback((map: maplibregl.Map, sourceId: string) => {
    if (handlersBoundRef.current) return;
    handlersBoundRef.current = true;

    map.on('click', 'parcel-clusters', (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ['parcel-clusters'] });
      const clusterId = features[0]?.properties?.cluster_id;
      const source = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
      if (clusterId == null || !source) return;
      const geometry = features[0]?.geometry;
      if (!geometry || geometry.type !== 'Point') return;
      source.getClusterExpansionZoom(clusterId).then((z) => {
        map.easeTo({ center: geometry.coordinates as [number, number], zoom: z });
      }).catch(() => undefined);
    });

    map.on('click', 'parcel-points', (e) => {
      const f = e.features?.[0];
      if (f) handleParcelSelect(String(f.properties?.parcel_id ?? ''), Number(f.properties?.property_id));
    });

    map.on('click', 'parcel-fill', (e) => {
      const f = e.features?.[0];
      if (f) handleParcelSelect(String(f.properties?.parcel_id ?? ''), Number(f.properties?.property_id));
    });

    for (const layer of ['parcel-clusters', 'parcel-points', 'parcel-fill'] as const) {
      map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''));
    }
  }, [handleParcelSelect]);

  const ensureLayers = useCallback((map: maplibregl.Map, usePoints: boolean, data: MapFeatureCollection) => {
    const sourceId = 'parcels';
    const nextMode = usePoints ? 'points' : 'polygons';

    if (map.getSource(sourceId) && modeRef.current === nextMode) {
      (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(data);
    } else {
      if (map.getSource(sourceId)) {
        for (const id of [
          'parcel-fill', 'parcel-line', 'parcel-selected',
          'parcel-clusters', 'parcel-cluster-count', 'parcel-points',
        ]) {
          removeLayer(map, id);
        }
        map.removeSource(sourceId);
      }

      map.addSource(sourceId, {
        type: 'geojson',
        data,
        ...(usePoints ? { cluster: true, clusterMaxZoom: 12, clusterRadius: 48 } : {}),
      });

      if (usePoints) {
        map.addLayer({
          id: 'parcel-clusters',
          type: 'circle',
          source: sourceId,
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': [
              'step',
              ['get', 'point_count'],
              '#fcd34d',
              25, '#f59e0b',
              100, '#ea580c',
              250, '#991b1b',
            ],
            'circle-radius': [
              'step',
              ['get', 'point_count'],
              16,
              25, 22,
              100, 28,
              250, 34,
            ],
            'circle-opacity': 0.85,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#fff',
          },
        });
        map.addLayer({
          id: 'parcel-cluster-count',
          type: 'symbol',
          source: sourceId,
          filter: ['has', 'point_count'],
          layout: {
            'text-field': ['get', 'point_count_abbreviated'],
            'text-size': 11,
          },
          paint: { 'text-color': '#1e293b' },
        });
        map.addLayer({
          id: 'parcel-points',
          type: 'circle',
          source: sourceId,
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': VALUE_COLOR,
            'circle-radius': 5,
            'circle-opacity': 0.8,
            'circle-stroke-width': 1,
            'circle-stroke-color': '#475569',
          },
        });
      } else {
        map.addLayer({
          id: 'parcel-fill',
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': VALUE_COLOR,
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
      }

      modeRef.current = nextMode;
      bindHandlersOnce(map, sourceId);
    }

    const selLayer = map.getLayer('parcel-selected');
    if (selLayer) {
      map.setFilter('parcel-selected', ['==', ['get', 'parcel_id'], selectedParcelId ?? '']);
    }
  }, [bindHandlersOnce, selectedParcelId]);

  const renderParcels = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapQuery.data) return;
    if (!ensureStyleReady()) return;
    ensureLayers(map, mapQuery.data.geometry === 'centroid', mapQuery.data as MapFeatureCollection);
  }, [mapQuery.data, ensureStyleReady, ensureLayers]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as Record<string, unknown>).__reSelectParcel = handleParcelSelect;
    return () => {
      delete (window as unknown as Record<string, unknown>).__reSelectParcel;
    };
  }, [handleParcelSelect]);

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

  const geometryLabel =
    mapQuery.data?.geometry === 'centroid'
      ? 'clustered points'
      : mapQuery.data?.geometry === 'simplified'
        ? 'simplified parcels'
        : 'parcels';

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
              ? `${mapQuery.data.features.length.toLocaleString()} of ${mapQuery.data.total.toLocaleString()} ${geometryLabel} shown (cap ${mapQuery.data.limit.toLocaleString()})`
              : `${mapQuery.data.total.toLocaleString()} ${geometryLabel} in view`}
          </div>
          {mapQuery.data.truncated && (
            <div className="max-w-[240px] rounded bg-amber-50/95 px-2 py-1 text-xs leading-snug text-amber-800 shadow">
              Zoom in for more detail — at most {mapQuery.data.limit.toLocaleString()} features load per viewport (hard cap 5,000).
            </div>
          )}
        </div>
      )}
    </div>
  );
}
