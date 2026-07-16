import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import '../leaflet-setup';
import 'leaflet-draw';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  render() { 
    if (this.state.hasError) return <div className="p-4 bg-red-50 text-red-600 font-mono text-sm">Map Error: {this.state.error?.message}</div>; 
    return this.props.children; 
  }
}

// Fix default icons for Leaflet in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// OSRM Route API avec tolérance (Radius)
// La tolérance de 50m permet d'éviter les gros détours si on clique du mauvais côté de la route
const snapToRoads = async (latlngs: L.LatLng[]) => {
  if (latlngs.length < 2) return latlngs;
  const coords = latlngs.map(ll => `${ll.lng},${ll.lat}`).join(';');
  const radiuses = latlngs.map(() => '50').join(';'); // 50m de tolérance
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?geometries=geojson&overview=full&radiuses=${radiuses}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const geojson = data.routes[0].geometry;
      return geojson.coordinates.map((c: number[]) => new L.LatLng(c[1], c[0]));
    }
  } catch (error) {
    console.error('OSRM route failed:', error);
  }
  return latlngs;
};

const extractMapData = (featureGroup: L.FeatureGroup, onMapChange?: (data: { route: [number, number][], markers: [number, number][] }) => void) => {
  if (!onMapChange) return;
  const layers = featureGroup.getLayers();
  
  let route: [number, number][] = [];
  const markers: [number, number][] = [];
  
  layers.forEach((layer: any) => {
    if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
      const latlngs = (Array.isArray(layer.getLatLngs()[0]) ? layer.getLatLngs()[0] : layer.getLatLngs()) as L.LatLng[];
      route = latlngs.map(ll => [ll.lat, ll.lng]);
    } else if (layer instanceof L.Marker) {
      const ll = layer.getLatLng();
      markers.push([ll.lat, ll.lng]);
    }
  });
  
  onMapChange({ route, markers });
};

const DrawControl = ({ color, onMapChange, initialRoute, initialMarkers }: { color: string, onMapChange?: (data: any) => void, initialRoute?: [number, number][], initialMarkers?: [number, number][] }) => {
  const map = useMap();
  const drawControlRef = useRef<L.Control.Draw | null>(null);
  const featureGroupRef = useRef<L.FeatureGroup | null>(null);

  useEffect(() => {
    if (!featureGroupRef.current) {
      featureGroupRef.current = new L.FeatureGroup();
      map.addLayer(featureGroupRef.current);
    }

    featureGroupRef.current.clearLayers();
    
    if (initialRoute && initialRoute.length > 0) {
      const polyline = new L.Polyline(initialRoute as L.LatLngExpression[], {
        color: color || '#2563EB', weight: 5, opacity: 0.9, lineCap: 'round', lineJoin: 'round'
      });
      featureGroupRef.current.addLayer(polyline);
    }
    
    if (initialMarkers && initialMarkers.length > 0) {
      initialMarkers.forEach(coord => {
        const marker = new L.Marker(coord as L.LatLngExpression);
        featureGroupRef.current?.addLayer(marker);
      });
    }

    const bounds = featureGroupRef.current.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20], maxZoom: 15 });
    }

    if (!drawControlRef.current) {
      const drawControl = new L.Control.Draw({
        edit: { featureGroup: featureGroupRef.current, remove: true },
        draw: {
          polyline: { shapeOptions: { color: color || '#2563EB', weight: 5, opacity: 0.9, lineCap: 'round', lineJoin: 'round' } },
          polygon: false, circle: false, rectangle: false, circlemarker: false, marker: {},
        },
      });

      map.addControl(drawControl);
      drawControlRef.current = drawControl;
    }

    const onDrawCreated = async (e: any) => {
      const layer = e.layer;
      if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
        const latlngs = layer.getLatLngs() as L.LatLng[];
        featureGroupRef.current?.addLayer(layer);
        
        // Use the new Match API to snap the drawn line intelligently
        const snappedLatLngs = await snapToRoads(latlngs);
        layer.setLatLngs(snappedLatLngs);
        
        if (featureGroupRef.current) extractMapData(featureGroupRef.current, onMapChange);
      } else {
        featureGroupRef.current?.addLayer(layer);
        if (featureGroupRef.current) extractMapData(featureGroupRef.current, onMapChange);
      }
    };

    const onDrawEdited = () => { if (featureGroupRef.current) extractMapData(featureGroupRef.current, onMapChange); };
    const onDrawDeleted = () => { if (featureGroupRef.current) extractMapData(featureGroupRef.current, onMapChange); };

    map.on(L.Draw.Event.CREATED, onDrawCreated);
    map.on(L.Draw.Event.EDITED, onDrawEdited);
    map.on(L.Draw.Event.DELETED, onDrawDeleted);

    return () => {
      map.off(L.Draw.Event.CREATED, onDrawCreated);
      map.off(L.Draw.Event.EDITED, onDrawEdited);
      map.off(L.Draw.Event.DELETED, onDrawDeleted);
    };
  }, [initialRoute, initialMarkers, color, map]);

  return null;
};

interface CourseMapEditorProps {
  center: [number, number];
  zoom?: number;
  routeColor?: string;
  onMapChange?: (data: { route: [number, number][], markers: [number, number][] }) => void;
  initialRoute?: [number, number][];
  initialMarkers?: [number, number][];
}

export default function CourseMapEditor({ center, zoom = 13, routeColor = '#2563EB', onMapChange, initialRoute, initialMarkers }: CourseMapEditorProps) {
  return (
    <ErrorBoundary>
      <div className="w-full relative z-0" style={{ height: '400px' }}>
        <MapContainer center={center} zoom={zoom} style={{ height: '400px', width: '100%' }} zoomControl={false}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
          <DrawControl color={routeColor} onMapChange={onMapChange} initialRoute={initialRoute} initialMarkers={initialMarkers} />
        </MapContainer>
      </div>
    </ErrorBoundary>
  );
}
