/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';
import { Property, MapViewport } from '../types';
import { MapDataTransformer, MapCluster } from '../services/MapDataTransformer';
import { MOCK_NEIGHBORHOOD_BOUNDARIES } from '../data/neighborhoodBoundaries';
import { exportPropertiesCSV, exportPropertiesJSON } from '../utils/export';
import { 
  ZoomIn, 
  ZoomOut, 
  Navigation, 
  Maximize2, 
  RotateCcw, 
  Layers, 
  Flame, 
  Grid, 
  Eye, 
  MapPin,
  Search,
  Building,
  Download,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  FileCode,
  Keyboard,
  Info,
  Tag
} from 'lucide-react';

interface MapSectionProps {
  properties: Property[];
  selectedProperty: Property | null;
  onSelectProperty: (p: Property) => void;
  onViewportChange?: (viewport: MapViewport) => void;
  onPolygonDrawn?: (polygon: { lat: number; lng: number }[]) => void;
  medianPrice: number;
}

export const MapSection: React.FC<MapSectionProps> = ({
  properties,
  selectedProperty,
  onSelectProperty,
  onViewportChange,
  onPolygonDrawn,
  medianPrice,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const polygonGroupRef = useRef<L.LayerGroup | null>(null);
  const heatmapGroupRef = useRef<L.LayerGroup | null>(null);

  const [zoomLevel, setZoomLevel] = useState<number>(12);
  const [showClusters, setShowClusters] = useState<boolean>(true);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
  const [showBoundaries, setShowBoundaries] = useState<boolean>(true);
  const [mapStyle, setMapStyle] = useState<'street' | 'satellite' | 'light'>('light');
  const [viewportMoved, setViewportMoved] = useState<boolean>(false);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const [showLayerMenu, setShowLayerMenu] = useState<boolean>(false);
  const [isLegendExpanded, setIsLegendExpanded] = useState<boolean>(true);

  const handleExportCSV = () => exportPropertiesCSV(properties);
  const handleExportJSON = () => exportPropertiesJSON(properties);

  // Default initial center: Kansas City / Overland Park Metro area
  const initialCenter: [number, number] = properties.length > 0 
    ? [properties[0].address.lat, properties[0].address.lng] 
    : [39.0997, -94.5786];

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return; // Prevent double init

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 12,
      zoomControl: false,
      attributionControl: true,
    });

    mapRef.current = map;

    // Tile Layers
    const lightTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    });

    const streetTiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    });

    const satelliteTiles = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18,
      attribution: 'Tiles &copy; Esri',
    });

    lightTiles.addTo(map);

    // Layer groups for markers, polygons, and density heatmap
    heatmapGroupRef.current = L.layerGroup().addTo(map);
    polygonGroupRef.current = L.layerGroup().addTo(map);
    layerGroupRef.current = L.layerGroup().addTo(map);
    const drawn = new L.FeatureGroup().addTo(map);
    const drawControl = new L.Control.Draw({ edit: { featureGroup: drawn }, draw: { polygon: {}, polyline: false, rectangle: false, circle: false, marker: false, circlemarker: false } });
    map.addControl(drawControl);
    map.on(L.Draw.Event.CREATED, (event: L.DrawEvents.Created) => {
      drawn.clearLayers(); drawn.addLayer(event.layer);
      const points = (event.layer as L.Polygon).getLatLngs()[0] as L.LatLng[];
      onPolygonDrawn?.(points.map(point => ({ lat: point.lat, lng: point.lng })));
    });

    // Event listeners
    map.on('zoomend', () => {
      setZoomLevel(map.getZoom());
      setViewportMoved(true);
      emitViewportChange();
    });

    map.on('moveend', () => {
      setViewportMoved(true);
      emitViewportChange();
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [onPolygonDrawn]);

  const emitViewportChange = () => {
    if (!mapRef.current || !onViewportChange) return;
    const bounds = mapRef.current.getBounds();
    const center = mapRef.current.getCenter();
    onViewportChange({
      southWest: { lat: bounds.getSouthWest().lat, lng: bounds.getSouthWest().lng },
      northEast: { lat: bounds.getNorthEast().lat, lng: bounds.getNorthEast().lng },
      center: { lat: center.lat, lng: center.lng },
      zoom: mapRef.current.getZoom(),
    });
  };

  // 2. Map Style Switcher
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    map.eachLayer(layer => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    let newTileLayer: L.TileLayer;
    if (mapStyle === 'satellite') {
      newTileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, attribution: 'Tiles &copy; Esri' });
    } else if (mapStyle === 'street') {
      newTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' });
    } else {
      // Light Cream Carto Voyager style
      newTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd', attribution: '&copy; OpenStreetMap contributors &copy; CARTO' });
    }

    newTileLayer.addTo(map);
  }, [mapStyle]);

  // 3. Render Neighborhood Boundaries
  useEffect(() => {
    if (!polygonGroupRef.current) return;
    polygonGroupRef.current.clearLayers();

    if (showBoundaries) {
      MOCK_NEIGHBORHOOD_BOUNDARIES.forEach(boundary => {
        const polygon = L.polygon(boundary.coordinates as [number, number][], {
          color: '#2b6cb0',
          weight: 2,
          opacity: 0.6,
          fillColor: '#3182ce',
          fillOpacity: 0.08,
          dashArray: '5, 5',
        });
        polygon.bindTooltip(boundary.name, { permanent: false, direction: 'center', className: 'bg-white px-2 py-1 rounded shadow text-xs font-semibold' });
        polygonGroupRef.current?.addLayer(polygon);
      });
    }
  }, [showBoundaries]);

  // 3.5. Render Property Density Heatmap Overlay
  useEffect(() => {
    if (!heatmapGroupRef.current) return;
    const heatmapGroup = heatmapGroupRef.current;
    heatmapGroup.clearLayers();

    if (showHeatmap && properties.length > 0) {
      // Calculate spatial density bins
      const { clusters, unclustered } = MapDataTransformer.clusterProperties(properties, Math.min(zoomLevel, 13));

      clusters.forEach(cluster => {
        const radiusMeters = Math.min(1600, Math.max(450, 300 + cluster.count * 100));
        const opacity = Math.min(0.55, 0.25 + (cluster.count / Math.max(1, properties.length)) * 1.8);

        let fillColor = '#f59e0b'; // Amber medium density
        if (cluster.count >= 12) fillColor = '#ef4444'; // Red high density
        else if (cluster.count >= 6) fillColor = '#f97316'; // Orange
        else fillColor = '#10b981'; // Green low density

        const circle = L.circle([cluster.lat, cluster.lng], {
          radius: radiusMeters,
          color: fillColor,
          weight: 1.5,
          opacity: 0.45,
          fillColor: fillColor,
          fillOpacity: opacity,
        });

        circle.bindTooltip(`
          <div class="p-1.5 text-xs text-slate-900 font-sans">
            <div class="font-bold flex items-center gap-1 text-amber-700">
              🔥 Density Hotspot
            </div>
            <div class="font-semibold">${cluster.count} properties in density zone</div>
            <div class="text-[10px] text-slate-500">Avg Price: $${cluster.avgPrice.toLocaleString()}</div>
          </div>
        `, { direction: 'top' });

        heatmapGroup.addLayer(circle);
      });

      unclustered.forEach(p => {
        const circle = L.circle([p.address.lat, p.address.lng], {
          radius: 350,
          color: '#f59e0b',
          weight: 1,
          opacity: 0.25,
          fillColor: '#f59e0b',
          fillOpacity: 0.3,
        });
        heatmapGroup.addLayer(circle);
      });
    }
  }, [showHeatmap, properties, zoomLevel]);

  // 4. Center map when selected property changes
  useEffect(() => {
    if (selectedProperty && mapRef.current) {
      mapRef.current.flyTo([selectedProperty.address.lat, selectedProperty.address.lng], 15, {
        duration: 0.8,
      });
    }
  }, [selectedProperty]);

  // 5. Render Markers and Clusters
  useEffect(() => {
    if (!layerGroupRef.current || !mapRef.current) return;
    const layerGroup = layerGroupRef.current;
    layerGroup.clearLayers();

    if (properties.length === 0) return;

    if (showClusters && zoomLevel < 14) {
      // Clustered View
      const { clusters, unclustered } = MapDataTransformer.clusterProperties(properties, zoomLevel);

      // Render Cluster Circles matching reference design
      clusters.forEach(cluster => {
        // Size proportional to property count
        const size = Math.min(80, Math.max(36, 24 + Math.sqrt(cluster.count) * 8));
        
        // Color gradient matching reference design (green -> yellow -> orange -> red)
        let bgClass = 'bg-[#e28743]'; // Default orange
        let borderClass = 'border-[#c06c28]';

        if (cluster.count >= 20) {
          bgClass = 'bg-[#d9534f]'; // Red cluster for high volume
          borderClass = 'border-[#b52b27]';
        } else if (cluster.avgPrice > medianPrice * 1.15) {
          bgClass = 'bg-[#e07a5f]'; // Above avg price
        } else if (cluster.avgPrice < medianPrice * 0.85) {
          bgClass = 'bg-[#81b29a]'; // Lower price green
          borderClass = 'border-[#588d75]';
        }

        const iconHtml = `
          <div class="rounded-full ${bgClass} border-2 ${borderClass} text-white font-bold flex items-center justify-center shadow-lg transform transition-transform hover:scale-110" style="width:${size}px; height:${size}px; font-size:${size > 50 ? '14px' : '11px'}; text-shadow:0 1px 2px rgba(0,0,0,0.4)">
            ${cluster.count}
          </div>
        `;

        const divIcon = L.divIcon({
          html: iconHtml,
          className: 'custom-cluster-icon',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

        const marker = L.marker([cluster.lat, cluster.lng], { icon: divIcon });

        // Tooltip
        marker.bindTooltip(`
          <div class="p-1.5 text-xs text-slate-800">
            <div class="font-bold text-slate-900">${cluster.count} Properties</div>
            <div>Avg Price: $${cluster.avgPrice.toLocaleString()}</div>
            <div>Range: $${cluster.minPrice.toLocaleString()} - $${cluster.maxPrice.toLocaleString()}</div>
            <div class="text-[10px] text-blue-600 font-semibold mt-1">Click to expand cluster</div>
          </div>
        `, { direction: 'top' });

        marker.on('click', () => {
          mapRef.current?.flyTo([cluster.lat, cluster.lng], zoomLevel + 2);
        });

        layerGroup.addLayer(marker);
      });

      // Render unclustered individual pins
      unclustered.forEach(p => renderIndividualPin(p, layerGroup));

    } else {
      // Unclustered view: show all individual property pins
      properties.forEach(p => renderIndividualPin(p, layerGroup));
    }

  }, [properties, showClusters, zoomLevel, selectedProperty, medianPrice]);

  const renderIndividualPin = (p: Property, layerGroup: L.LayerGroup) => {
    const isSelected = selectedProperty?.id === p.id;
    
    // Determine pin color by metric/status
    let pinColor = '#f59e0b'; // Yellow near average
    if (p.status === 'recently_sold') pinColor = '#3b82f6'; // Blue recently sold
    else if (p.status === 'pending') pinColor = '#a855f7'; // Purple pending
    else if (p.price < medianPrice * 0.85) pinColor = '#10b981'; // Green lower price
    else if (p.price > medianPrice * 1.25) pinColor = '#ef4444'; // Red high price
    else if (p.price > medianPrice * 1.05) pinColor = '#f97316'; // Orange above avg

    const formattedPrice = p.price >= 1000000 
      ? `$${(p.price / 1000000).toFixed(2)}M` 
      : `$${Math.round(p.price / 1000)}k`;

    const pinHtml = `
      <div class="relative group cursor-pointer transition-transform ${isSelected ? 'scale-125 z-50' : 'hover:scale-110 z-10'}">
        <div class="flex items-center gap-1 px-2 py-1 rounded-full text-white font-bold text-[11px] shadow-md border border-white/80" style="background-color:${pinColor}">
          <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
          <span>${formattedPrice}</span>
        </div>
        ${isSelected ? '<div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45"></div>' : ''}
      </div>
    `;

    const divIcon = L.divIcon({
      html: pinHtml,
      className: 'custom-property-pin',
      iconSize: [70, 26],
      iconAnchor: [35, 13],
    });

    const marker = L.marker([p.address.lat, p.address.lng], { icon: divIcon });

    marker.bindTooltip(`
      <div class="p-2 max-w-[220px]">
        <div class="font-bold text-xs text-slate-900">${p.address.street}</div>
        <div class="text-[11px] text-slate-600">${p.address.city}, ${p.address.state} ${p.address.zipCode}</div>
        <div class="mt-1 flex items-center justify-between border-t pt-1 border-slate-200">
          <span class="font-bold text-slate-900 text-xs">$${p.price.toLocaleString()}</span>
          <span class="text-[10px] uppercase font-semibold text-blue-600">${p.status.replace('_', ' ')}</span>
        </div>
        <div class="text-[10px] text-slate-500 mt-0.5">
          ${p.bedrooms} beds • ${p.bathrooms} baths • ${p.livingAreaSqFt} sqft ($${p.pricePerSqFt}/sqft)
        </div>
      </div>
    `, { direction: 'top', offset: [0, -10] });

    marker.on('click', () => {
      onSelectProperty(p);
    });

    layerGroup.addLayer(marker);
  };

  const handleResetMap = () => {
    if (mapRef.current) {
      mapRef.current.flyTo(initialCenter, 12);
      setViewportMoved(false);
    }
  };

  const handleGeolocation = () => {
    if (navigator.geolocation && mapRef.current) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          mapRef.current?.flyTo([pos.coords.latitude, pos.coords.longitude], 14);
        },
        () => alert('Unable to retrieve your current location.')
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const PAN_OFFSET = 120; // Panning step distance in pixels

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        map.panBy([0, -PAN_OFFSET]);
        break;
      case 'ArrowDown':
        e.preventDefault();
        map.panBy([0, PAN_OFFSET]);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        map.panBy([-PAN_OFFSET, 0]);
        break;
      case 'ArrowRight':
        e.preventDefault();
        map.panBy([PAN_OFFSET, 0]);
        break;
      case '+':
      case '=':
        e.preventDefault();
        map.zoomIn();
        break;
      case '-':
      case '_':
        e.preventDefault();
        map.zoomOut();
        break;
      default:
        break;
    }
  };

  return (
    <div 
      id="interactive-map-container"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="relative w-full h-[430px] sm:h-[540px] md:h-[620px] bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 transition-shadow"
      aria-label="Interactive real estate map. Click or press Tab to focus, then use Arrow keys to pan and + / - keys to zoom."
    >
      {/* Top Map Header Bar */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-200/80 shadow-sm text-xs text-slate-800">
        <span className="font-bold tracking-tight text-slate-900">ACTIVE LENS</span>
        <span className="text-slate-300">|</span>
        <span className="font-semibold text-slate-700">Transaction field</span>
        <span className="text-slate-300">|</span>
        <span className="text-slate-500 font-medium text-[11px]">{properties.length} properties in view</span>
      </div>

      {/* Floating "Search this area" Button when user pans map */}
      {viewportMoved && (
        <button
          onClick={() => {
            setViewportMoved(false);
            emitViewportChange();
          }}
          className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-md shadow-blue-200/50 flex items-center gap-2 transition-all transform hover:scale-105"
        >
          <Search className="w-3.5 h-3.5 text-white" />
          <span>Search this area</span>
        </button>
      )}

      {/* Map Style & View Controls Toolbar */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-white/95 backdrop-blur-md p-1 rounded-xl border border-slate-200/80 shadow-sm text-xs">
        {/* Heat Map Overlay Quick Toggle */}
        <button
          onClick={() => setShowHeatmap(!showHeatmap)}
          className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition-all text-xs ${
            showHeatmap 
              ? 'bg-amber-500 text-white shadow-xs font-bold' 
              : 'text-slate-700 hover:bg-slate-100'
          }`}
          title="Toggle Property Density Heat Map Overlay"
        >
          <Flame className={`w-3.5 h-3.5 ${showHeatmap ? 'text-white animate-pulse' : 'text-amber-500'}`} />
          <span>Heatmap</span>
        </button>

        <div className="w-px h-4 bg-slate-200 mx-0.5" />

        {/* Marker Clustering Quick Toggle */}
        <button
          onClick={() => setShowClusters(!showClusters)}
          className={`p-1.5 rounded-lg transition-all ${showClusters ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-100'}`}
          title="Toggle marker clustering"
        >
          <Grid className="w-4 h-4" />
        </button>

        {/* Layers Control Menu Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowLayerMenu(!showLayerMenu);
              setShowExportMenu(false);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-all text-xs border border-slate-200/80 shadow-2xs ${
              showLayerMenu ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
            }`}
            title="Layer Controls & Overlays"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Layers</span>
            <ChevronDown className="w-3 h-3" />
          </button>

          {showLayerMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 z-50 text-xs flex flex-col gap-3">
              {/* Basemap Selection */}
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Base Map View
                </div>
                <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setMapStyle('light')}
                    className={`py-1.5 px-1 rounded-lg text-[11px] font-semibold transition-all text-center ${
                      mapStyle === 'light' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Roadmap
                  </button>
                  <button
                    onClick={() => setMapStyle('street')}
                    className={`py-1.5 px-1 rounded-lg text-[11px] font-semibold transition-all text-center ${
                      mapStyle === 'street' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Street
                  </button>
                  <button
                    onClick={() => setMapStyle('satellite')}
                    className={`py-1.5 px-1 rounded-lg text-[11px] font-semibold transition-all text-center ${
                      mapStyle === 'satellite' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Satellite
                  </button>
                </div>
              </div>

              <div className="w-full h-px bg-slate-100" />

              {/* Data Overlays */}
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Analytics & Overlays
                </div>
                <div className="flex flex-col gap-1.5">
                  {/* Heatmap Overlay Toggle */}
                  <button
                    onClick={() => setShowHeatmap(!showHeatmap)}
                    className={`w-full flex items-center justify-between p-2 rounded-xl border text-left transition-all ${
                      showHeatmap
                        ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                        : 'bg-slate-50/60 border-slate-200/80 text-slate-700 hover:bg-slate-100/60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Flame className={`w-4 h-4 ${showHeatmap ? 'text-amber-600' : 'text-slate-400'}`} />
                      <div>
                        <div className="font-bold text-xs">Density Heatmap</div>
                        <div className="text-[10px] text-slate-500">Property count hotspot intensity</div>
                      </div>
                    </div>
                    <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${showHeatmap ? 'bg-amber-500' : 'bg-slate-300'}`}>
                      <div className={`w-3 h-3 rounded-full bg-white transition-transform ${showHeatmap ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                  </button>

                  {/* Marker Clustering Toggle */}
                  <button
                    onClick={() => setShowClusters(!showClusters)}
                    className={`w-full flex items-center justify-between p-2 rounded-xl border text-left transition-all ${
                      showClusters
                        ? 'bg-blue-50/80 border-blue-200 text-blue-900'
                        : 'bg-slate-50/60 border-slate-200/80 text-slate-700 hover:bg-slate-100/60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Grid className={`w-4 h-4 ${showClusters ? 'text-blue-600' : 'text-slate-400'}`} />
                      <div>
                        <div className="font-bold text-xs">Marker Clustering</div>
                        <div className="text-[10px] text-slate-500">Group nearby pins dynamically</div>
                      </div>
                    </div>
                    <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${showClusters ? 'bg-blue-600' : 'bg-slate-300'}`}>
                      <div className={`w-3 h-3 rounded-full bg-white transition-transform ${showClusters ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                  </button>

                  {/* Neighborhood Boundaries Toggle */}
                  <button
                    onClick={() => setShowBoundaries(!showBoundaries)}
                    className={`w-full flex items-center justify-between p-2 rounded-xl border text-left transition-all ${
                      showBoundaries
                        ? 'bg-blue-50/80 border-blue-200 text-blue-900'
                        : 'bg-slate-50/60 border-slate-200/80 text-slate-700 hover:bg-slate-100/60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Building className={`w-4 h-4 ${showBoundaries ? 'text-blue-600' : 'text-slate-400'}`} />
                      <div>
                        <div className="font-bold text-xs">Submarket Outlines</div>
                        <div className="text-[10px] text-slate-500">Neighborhood boundaries</div>
                      </div>
                    </div>
                    <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${showBoundaries ? 'bg-blue-600' : 'bg-slate-300'}`}>
                      <div className={`w-3 h-3 rounded-full bg-white transition-transform ${showBoundaries ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-4 bg-slate-200 mx-0.5" />

        {/* Export Data Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowExportMenu(!showExportMenu);
              setShowLayerMenu(false);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold transition-all text-xs border border-slate-200/80 shadow-2xs"
            title="Export visible properties list"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Export</span>
            <ChevronDown className="w-3 h-3 text-slate-500" />
          </button>

          {showExportMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs">
              <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                Download {properties.length} Properties
              </div>
              <button
                onClick={() => {
                  handleExportCSV();
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 font-medium flex items-center gap-2 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <div>
                  <div className="font-semibold text-slate-800">CSV Dataset (.csv)</div>
                  <div className="text-[10px] text-slate-400">Excel & Numbers compatible</div>
                </div>
              </button>
              <button
                onClick={() => {
                  handleExportJSON();
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 font-medium flex items-center gap-2 transition-colors"
              >
                <FileCode className="w-4 h-4 text-blue-600" />
                <div>
                  <div className="font-semibold text-slate-800">JSON Object (.json)</div>
                  <div className="text-[10px] text-slate-400">Structured MCP format</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Actual Map Canvas Container */}
      <div ref={mapContainerRef} className="w-full h-full z-10" />

      {/* Map Control Buttons (Zoom, Geo, Reset) */}
      <div className="absolute bottom-16 right-3 z-20 flex flex-col gap-1 bg-white/95 backdrop-blur-md p-1 rounded-xl border border-slate-200/80 shadow-sm text-slate-700">
        <button
          onClick={() => mapRef.current?.zoomIn()}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => mapRef.current?.zoomOut()}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="w-full h-px bg-slate-200" />
        <button
          onClick={handleGeolocation}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          title="Center on my location"
        >
          <Navigation className="w-4 h-4" />
        </button>
        <button
          onClick={handleResetMap}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          title="Reset map camera"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Map Status & Price Legend Overlay Component */}
      <div className="absolute bottom-3 left-3 z-20 max-w-[calc(100%-5rem)]">
        {isLegendExpanded ? (
          <div className="bg-white/95 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-slate-200/90 shadow-md flex flex-col gap-2 text-[11px] text-slate-700">
            {/* Header / Collapse Toggle */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-1.5">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 text-[10px] uppercase tracking-wider">
                <Tag className="w-3.5 h-3.5 text-blue-600" />
                <span>Map Status & Price Color Legend</span>
                <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded-md">
                  {properties.length} Properties
                </span>
              </div>
              <button
                onClick={() => setIsLegendExpanded(false)}
                className="text-slate-400 hover:text-slate-700 transition-colors p-0.5 rounded-md hover:bg-slate-100"
                title="Collapse Legend"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Legend Body: Categorized Property Statuses */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {/* Status 1: For Sale / Active */}
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
                  Active ({properties.filter(p => p.status === 'for_sale').length}):
                </span>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 font-medium text-slate-600" title="Active listing price below 85% of market median">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] ring-1 ring-emerald-600/30" />
                    &lt;Avg
                  </span>
                  <span className="flex items-center gap-1 font-medium text-slate-600" title="Active listing price near market median">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] ring-1 ring-amber-600/30" />
                    Near Avg
                  </span>
                  <span className="flex items-center gap-1 font-medium text-slate-600" title="Active listing price 5-25% above market median">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#f97316] ring-1 ring-orange-600/30" />
                    Above Avg
                  </span>
                  <span className="flex items-center gap-1 font-medium text-slate-600" title="Active listing price top 25% high tier">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] ring-1 ring-red-600/30" />
                    High Tier
                  </span>
                </div>
              </div>

              <div className="hidden sm:block w-px h-3 bg-slate-200" />

              {/* Status 2: Recently Sold */}
              <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] ring-1 ring-blue-600/30" />
                <span>Recently Sold ({properties.filter(p => p.status === 'recently_sold').length})</span>
              </div>

              <div className="hidden sm:block w-px h-3 bg-slate-200" />

              {/* Status 3: Pending */}
              <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-[#a855f7] ring-1 ring-purple-600/30" />
                <span>Pending ({properties.filter(p => p.status === 'pending').length})</span>
              </div>
            </div>

            {/* Keyboard tips bar */}
            <div className="hidden lg:flex items-center justify-between border-t border-slate-100 pt-1 text-[10px] text-slate-400">
              <span className="italic">Pins dynamically update color based on property status and price comparison</span>
              <span className="flex items-center gap-1 text-slate-500 font-medium">
                <Keyboard className="w-3 h-3 text-blue-600" />
                Arrows to pan • +/- to zoom
              </span>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsLegendExpanded(true)}
            className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200/90 shadow-md flex items-center gap-2 text-xs font-bold text-slate-800 hover:bg-slate-50 transition-all"
            title="Expand Property Status & Price Legend"
          >
            <Tag className="w-3.5 h-3.5 text-blue-600" />
            <span>Map Legend ({properties.length})</span>
            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
          </button>
        )}
      </div>
    </div>
  );
};
