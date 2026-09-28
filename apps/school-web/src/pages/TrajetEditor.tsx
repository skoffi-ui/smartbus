import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import {
  Map, Trash2, Route, Trash, MapPin, Plus,
  Clock, Users, X, ChevronDown, ChevronUp, AlertCircle, MapPinned
} from 'lucide-react';
import {
  getTrajets, createTrajet, updateTrajet, deleteTrajet, reverseGeocode,
  getPoints, createPoint, deletePoint, updatePoint,
  getEleves, affecterEnfant, getAffectationsByPoint, supprimerAffectation, getAffectations
} from '../services/transport.service';
import { chargerLeafletRouting } from '../services/leaflet-routing';
import { chargerLeafletGeocoder } from '../services/leaflet-geocoder';
import { useToast } from '../components/ToastProvider';
import { useConfirm } from '../components/ConfirmProvider';
import { messageFromError } from '../services/api';

import './UiverseButton.css';
import './UiverseInput.css';

const ABIDJAN: [number, number] = [5.3364, -4.0267];

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

function routage(): any {
  return (window as any).L?.Routing;
}

type MarkerType = 'depart' | 'arret' | 'arrivee';

/**
 * Apparence des points sur la carte : une lettre et une couleur par nature.
 *
 * Source unique pour les marqueurs et pour la légende sous la carte, afin que
 * les deux ne puissent pas diverger au fil des retouches.
 */
const MARQUEURS: Record<MarkerType, { lettre: string; couleur: string; libelle: string }> = {
  depart:  { lettre: 'D', couleur: '#10B981', libelle: 'Départ' },
  arret:   { lettre: 'A', couleur: '#3B82F6', libelle: 'Arrêt' },
  arrivee: { lettre: 'F', couleur: '#EF4444', libelle: 'Fin / Arrivée' },
};

// Composant pour gérer le curseur dynamique de la carte
function MapCursorController({ cursorType }: { cursorType: MarkerType | null }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const container = map.getContainer();
    if (!container) return;

    // Retirer toutes les classes de curseur
    container.classList.remove('cursor-crosshair', 'cursor-copy', 'cursor-cell', 'cursor-default');

    // Ajouter la classe appropriée et le style inline
    if (cursorType === 'depart') {
      container.classList.add('cursor-crosshair');
      container.style.cursor = 'crosshair';
    } else if (cursorType === 'arret') {
      container.classList.add('cursor-copy');
      container.style.cursor = 'copy';
    } else if (cursorType === 'arrivee') {
      container.classList.add('cursor-cell');
      container.style.cursor = 'cell';
    } else {
      container.classList.add('cursor-default');
      container.style.cursor = 'default';
    }
  }, [map, cursorType]);

  return null;
}

// Composant pour recentrer automatiquement la carte sur le trajet
function FitBoundsOnWaypoints({ waypoints }: { waypoints: any[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !waypoints || waypoints.length === 0) return;

    // Petit délai pour s'assurer que la carte est prête
    const timer = setTimeout(() => {
      try {
        console.log('🎯 Recentrage de la carte sur', waypoints.length, 'points');

        // Convertir les waypoints en LatLng si nécessaire
        const latLngs = waypoints.map((wp: any) => {
          if (wp && wp.lat !== undefined && wp.lng !== undefined) {
            return L.latLng(wp.lat, wp.lng);
          } else if (wp && wp.latLng) {
            return wp.latLng;
          }
          return null;
        }).filter(Boolean);

        if (latLngs.length === 0) return;

        // Calculer les bounds de tous les points
        const bounds = L.latLngBounds(latLngs);

        // Recentrer la carte avec animation
        map.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 15,
          animate: true,
          duration: 0.8
        });

        console.log('✅ Carte recentrée avec succès');
      } catch (err) {
        console.error('❌ Erreur lors du recentrage de la carte:', err);
      }
    }, 300); // Délai de 300ms pour laisser le temps à OSRM de calculer

    return () => clearTimeout(timer);
  }, [map, waypoints]);

  return null;
}

/**
 * Garde la carte Leaflet synchronisée avec la taille réelle de son conteneur.
 *
 * Leaflet calcule sa taille une seule fois à l'initialisation et la met en
 * cache : redimensionner le conteneur en CSS (ex. replier le panneau "Points
 * du Trajet" au-dessus) agrandit bien la `<div>`, mais la carte continue de
 * se croire à son ancienne taille tant que `invalidateSize()` n'est pas
 * appelé explicitement — l'espace gagné reste vide, décentré, sans tuiles.
 * Un `ResizeObserver` sur le conteneur couvre ce cas comme tout autre
 * changement de mise en page (repli du panneau, redimensionnement de
 * fenêtre, rotation d'écran…) sans dépendre d'un état précis à surveiller.
 */
function MapAutoResize() {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const container = map.getContainer();
    if (!container || typeof ResizeObserver === 'undefined') return;

    let frame: number | null = null;
    const observer = new ResizeObserver(() => {
      // `invalidateSize` recalcule la vue en pleine transition CSS sinon :
      // un cadre d'attente laisse la taille se stabiliser d'abord.
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        try { map.invalidateSize({ animate: false }); } catch {}
      });
    });
    observer.observe(container);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [map]);

  return null;
}

// Composant pour centrer la carte sur un point spécifique
function FlyToPoint({ point }: { point: { lat: number; lng: number } | null }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !point) return;

    try {
      // Centrer la carte sur le point avec animation
      map.flyTo([point.lat, point.lng], 16, {
        animate: true,
        duration: 0.8
      });
    } catch (err) {
      console.error('❌ Erreur lors du centrage sur le point:', err);
    }
  }, [map, point]);

  return null;
}

// Composant de recherche géographique
function SearchControl() {
  const map = useMap();
  const controlRef = useRef<any>(null);

  useEffect(() => {
    if (!map) return;
    let annule = false;

    chargerLeafletGeocoder()
      .then(() => {
        if (!annule) initGeocoder();
      })
      .catch((err) => console.error('Leaflet Geocoder indisponible', err));

    function initGeocoder() {
      const GeocoderControl = (window as any).L?.Control?.Geocoder;
      if (!map || !GeocoderControl) return;

      try {
        const searchControl = new GeocoderControl({
          geocoder: GeocoderControl.nominatim(),
          placeholder: 'Rechercher un lieu...',
          errorMessage: 'Aucun résultat trouvé',
          position: 'topleft',
          collapsed: false,
          defaultMarkGeocode: false
        })
          .on('markgeocode', function(e: any) {
            const bbox = e.geocode.bbox;
            const poly = L.polygon([
              bbox.getSouthEast(),
              bbox.getNorthEast(),
              bbox.getNorthWest(),
              bbox.getSouthWest()
            ]);
            map.fitBounds(poly.getBounds());

            // Ajouter un marqueur temporaire
            const marker = L.marker(e.geocode.center, {
              icon: L.divIcon({
                html: `
                  <div style="
                    width: 40px;
                    height: 40px;
                    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                    border-radius: 50% 50% 50% 0;
                    transform: rotate(-45deg);
                    border: 3px solid white;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  ">
                    <span style="
                      transform: rotate(45deg);
                      font-size: 20px;
                      filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
                    ">📍</span>
                  </div>
                `,
                className: '',
                iconSize: [40, 40] as [number, number],
                iconAnchor: [20, 40] as [number, number]
              })
            })
              .addTo(map)
              .bindPopup(`<strong>${e.geocode.name}</strong><br/><small>Cliquez sur la carte pour placer un point ici</small>`)
              .openPopup();

            // Supprimer le marqueur après 10 secondes
            setTimeout(() => {
              map.removeLayer(marker);
            }, 10000);
          })
          .addTo(map);

        controlRef.current = searchControl;
      } catch (error) {
        console.error('Erreur lors de l\'initialisation du geocoder:', error);
      }
    }

    return () => {
      annule = true;
      if (controlRef.current && map) {
        try {
          map.removeControl(controlRef.current);
        } catch (e) {
          // Ignore l'erreur si le contrôle n'existe plus
        }
      }
    };
  }, [map]);

  return null;
}

interface PointRecup {
  id?: string;
  nom: string;
  latitude: number;
  longitude: number;
  tempsArret: string; // Obsolète, gardé pour compatibilité
  heurePassage?: string; // Heure estimée de passage (HH:mm)
  dureeArretMin?: number; // Durée d'arrêt en minutes (par défaut 2)
  ordrePassage: number;
  type: MarkerType;
  affectations?: any[];
}

function RoutingMachine({ waypoints, pointsTypes, onRouteFound, onDeleteMarker, highlightedIndex, onRoutesFound, readOnly = false, selectedMarkerType }: any) {
  const map = useMap();
  const routingControlRef = useRef<any>(null);

  // `createMarker` est une fermeture construite une seule fois, à l'initialisation
  // du contrôle : elle capturerait les valeurs de ce premier rendu, quand aucun
  // point n'existe encore. Tous les marqueurs retomberaient alors sur le type par
  // défaut. Ces références lui donnent accès aux valeurs courantes.
  const pointsTypesRef = useRef<MarkerType[]>(pointsTypes || []);
  const highlightedRef = useRef<number | null>(highlightedIndex ?? null);
  useEffect(() => { pointsTypesRef.current = pointsTypes || []; }, [pointsTypes]);
  useEffect(() => { highlightedRef.current = highlightedIndex ?? null; }, [highlightedIndex]);

  useEffect(() => {
    if (!map) return;
    let annule = false;

    chargerLeafletRouting()
      .then(() => { if (!annule) initRouting(); })
      .catch((err) => console.error('Leaflet Routing Machine indisponible', err));

    function initRouting() {
      const Routing = routage();
      if (!map || !Routing) return;
      try {
        const control = Routing.control({
          waypoints: waypoints || [],
          routeWhileDragging: false, // Désactivé pour éviter les calculs pendant le drag
          show: false,
          addWaypoints: false, // Désactivé pour éviter les ajouts automatiques de waypoints
          // Le recadrage automatique reprenait la main sur la vue à chaque
          // itinéraire calculé, donc à chaque point ajouté : la carte sautait
          // sous le curseur pendant qu'on plaçait les arrêts suivants.
          // L'utilisateur garde le contrôle de son cadrage.
          fitSelectedRoutes: false,
          draggableWaypoints: false, // Désactivé pour permettre la navigation sur la carte
          lineOptions: {
            styles: [{ color: '#3b82f6', weight: 6, opacity: 0.85 }],
            extendToWaypoints: true,
            missingRouteTolerance: 0
          },
          router: Routing.osrmv1({
            serviceUrl: 'https://router.project-osrm.org/route/v1',
            profile: 'driving',
            timeout: 30 * 1000,
            routingOptions: {
              alternatives: true,
              steps: true,
              geometries: 'geojson',
              overview: 'full',
              continue_straight: false
            }
          }),
          showAlternatives: true,
          altLineOptions: {
            styles: [{ color: '#94a3b8', weight: 5, opacity: 0.6 }]
          },
          createMarker: function(i: number, wp: any) {
            const typesCourants = pointsTypesRef.current;
            const pointType = typesCourants && typesCourants[i] ? typesCourants[i] : 'arret';

            const isHighlighted = highlightedRef.current === i;
            const pulseAnimation = isHighlighted ? `
              @keyframes marker-pulse {
                0%, 100% {
                  transform: rotate(-45deg) scale(1);
                  box-shadow: 0 4px 8px rgba(0,0,0,0.3), 0 0 0 0 rgba(255, 193, 7, 0.7);
                }
                50% {
                  transform: rotate(-45deg) scale(1.15);
                  box-shadow: 0 8px 16px rgba(0,0,0,0.4), 0 0 0 15px rgba(255, 193, 7, 0);
                }
              }
            ` : '';

            // Design retenu : une lettre par nature de point, sur la couleur associée.
            // Les trois variantes étaient auparavant trois blocs de code quasi
            // identiques ne différant que par l'emoji et la teinte.
            const { lettre, couleur } = MARQUEURS[pointType as MarkerType] ?? MARQUEURS.arret;

            const iconConfig: L.DivIconOptions = {
              html: `
                <style>${pulseAnimation}</style>
                <div style="position: relative; width: 40px; height: 40px;">
                  <div style="
                    width: 40px;
                    height: 40px;
                    background: ${couleur};
                    border-radius: 50% 50% 50% 0;
                    transform: rotate(-45deg);
                    border: 3px solid ${isHighlighted ? '#ffc107' : 'white'};
                    box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    ${isHighlighted ? 'animation: marker-pulse 1.5s ease-in-out infinite;' : ''}
                  ">
                    <span style="
                      transform: rotate(45deg);
                      font-family: 'Poppins', sans-serif;
                      font-size: 17px;
                      font-weight: 700;
                      line-height: 1;
                      color: white;
                      text-shadow: 0 1px 2px rgba(0,0,0,0.35);
                    ">${lettre}</span>
                  </div>
                </div>
              `,
              className: '',
              iconSize: [40, 40] as [number, number],
              iconAnchor: [20, 40] as [number, number]
            };

            const marker = L.marker(wp.latLng, {
              draggable: false, // Désactivé pour permettre la navigation sur la carte
              icon: L.divIcon(iconConfig)
            });

            // Ajouter un popup avec bouton de suppression
            if (!readOnly && onDeleteMarker) {
              const pointName = pointsTypes && pointsTypes[i] ? (
                pointType === 'depart' ? 'Point de Départ' :
                pointType === 'arrivee' ? 'Point d\'Arrivée' :
                `Arrêt ${i + 1}`
              ) : `Point ${i + 1}`;

              const popupContent = `
                <div style="text-align: center; font-family: system-ui, -apple-system, sans-serif;">
                  <div style="font-weight: bold; margin-bottom: 8px; color: #1e293b;">
                    ${pointName}
                  </div>
                  <button
                    onclick="window.deleteMarker_${i}()"
                    style="
                      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                      color: white;
                      border: none;
                      padding: 6px 12px;
                      border-radius: 6px;
                      cursor: pointer;
                      font-weight: 600;
                      font-size: 12px;
                      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                      transition: all 0.2s;
                    "
                    onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 4px 8px rgba(0,0,0,0.2)'"
                    onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.1)'"
                  >
                    🗑️ Supprimer ce point
                  </button>
                </div>
              `;

              marker.bindPopup(popupContent);

              // Créer une fonction globale pour supprimer ce marker spécifique
              (window as any)[`deleteMarker_${i}`] = () => {
                if (onDeleteMarker) {
                  onDeleteMarker(i);
                  marker.closePopup();
                }
              };
            }

            return marker;
          }
        }).addTo(map);

        control.on('routesfound', (e: any) => {
          const routes = e.routes || [];
          const wps = control.getWaypoints().map((w: any) => w.latLng).filter(Boolean);

          // Préparer toutes les alternatives
          const allRoutes = routes.map((route: any, index: number) => ({
            index,
            distance: route.summary.totalDistance,
            duration: route.summary.totalTime,
            coordinates: route.coordinates,
            summary: route.summary,
            name: route.name || `Itinéraire ${index + 1}`,
          }));

          // Route principale (la plus rapide)
          if (routes.length > 0) {
            const mainRoute = routes[0];
            const geojson = {
              type: 'FeatureCollection',
              features: [{
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: mainRoute.coordinates.map((c: any) => [c.lng, c.lat])
                }
              }]
            };

            if (onRouteFound) {
              onRouteFound(mainRoute.summary.totalDistance, mainRoute.summary.totalTime, geojson, wps);
            }
          }

          // Envoyer toutes les alternatives au parent
          if (onRoutesFound) {
            onRoutesFound(allRoutes);
          }
        });

        routingControlRef.current = control;
      } catch (err) {
        console.error('Initialisation du routage impossible', err);
      }
    }

    return () => {
      annule = true;
      if (routingControlRef.current) {
        try { map.removeControl(routingControlRef.current); } catch { }
        routingControlRef.current = null;
      }
    };
  }, [map, readOnly]);

  useEffect(() => {
    console.log('🔄 useEffect waypoints déclenché. waypoints:', waypoints?.length, 'routingControl:', !!routingControlRef.current);

    // Si le RoutingControl n'est pas encore créé, attendre un peu puis réessayer
    if (!routingControlRef.current) {
      console.log('⚠️ RoutingControl pas encore créé, on attend...');
      const timeout = setTimeout(() => {
        if (routingControlRef.current && waypoints && waypoints.length > 0) {
          console.log('🔄 RoutingControl maintenant disponible, application des waypoints');
          try {
            routingControlRef.current.setWaypoints(waypoints);
          } catch (err) {
            console.error('❌ Erreur lors de la mise à jour des waypoints (retry)', err);
          }
        }
      }, 100);
      return () => clearTimeout(timeout);
    }

    if (!waypoints || waypoints.length === 0) {
      console.log('🗑️ Effacement des waypoints du RoutingMachine');
      routingControlRef.current.setWaypoints([]);
      return;
    }

    try {
      // Ne rien pousser si le contrôle a déjà exactement ces points.
      //
      // `setWaypoints` relance un calcul d'itinéraire à chaque appel. Un simple
      // re-rendu du parent suffisait donc à redemander la même route, et toute
      // boucle de rendu se transformait en rafale de requêtes OSRM. La
      // comparaison porte sur les coordonnées, pas sur l'identité du tableau,
      // qui change à chaque rendu.
      const actuels = routingControlRef.current
        .getWaypoints()
        .map((w: any) => w.latLng)
        .filter(Boolean);

      console.log('📊 Waypoints actuels dans le contrôle:', actuels.length);
      console.log('📊 Nouveaux waypoints à appliquer:', waypoints.length);

      const identiques =
        actuels.length === waypoints.length &&
        waypoints.every((wp: any, i: number) =>
          actuels[i] &&
          Math.abs(actuels[i].lat - Number(wp.lat)) < 1e-6 &&
          Math.abs(actuels[i].lng - Number(wp.lng)) < 1e-6,
        );

      if (!identiques) {
        console.log('✅ Mise à jour des waypoints dans le RoutingMachine');
        routingControlRef.current.setWaypoints(waypoints);
      } else {
        console.log('✓ Waypoints identiques, pas de mise à jour');
      }
    } catch (err) {
      console.error('❌ Erreur lors de la mise à jour des waypoints', err);
    }
  }, [waypoints]);

  /**
   * Centre la carte sur le point sélectionné dans la liste.
   *
   * `waypoints` figurait dans les dépendances : l'animation repartait donc à
   * chaque recalcul d'itinéraire, et Leaflet désactive le déplacement pendant un
   * `flyTo`. Un point mis en évidence rendait la carte durablement impossible à
   * déplacer. Seul un changement de sélection doit déclencher le vol.
   */
  const dernierSurvol = useRef<number | null>(null);
  useEffect(() => {
    if (highlightedIndex === null || highlightedIndex < 0) {
      dernierSurvol.current = null;
      return;
    }
    if (dernierSurvol.current === highlightedIndex) return;

    const wp = waypoints?.[highlightedIndex];
    if (wp && map) {
      dernierSurvol.current = highlightedIndex;
      map.flyTo(wp, 16, { duration: 0.8 });
    }
  }, [highlightedIndex, map]);

  // Gestionnaire de clic sur la carte : appelle directement handleMapClickForGeocode
  // sans ajouter de waypoint automatiquement (évite les doublons)
  // N'écoute les clics QUE si un mode de placement est actif
  useEffect(() => {
    if (readOnly) return;
    if (!selectedMarkerType) return; // ✅ Ne pas écouter si aucun mode actif - permet la navigation libre

    const onMapClick = (e: L.LeafletMouseEvent) => {
      if ((window as any).handleMapClickForGeocode) {
        (window as any).handleMapClickForGeocode(e.latlng.lat, e.latlng.lng);
      }
    };

    map.on('click', onMapClick);
    return () => { map.off('click', onMapClick); };
  }, [map, readOnly, selectedMarkerType]); // ✅ Dépend maintenant de selectedMarkerType

  return null;
}

export default function TrajetEditor() {
  const toast = useToast();
  const confirmer = useConfirm();
  const naviguer = useNavigate();
  const [trajets, setTrajets] = useState<any[]>([]);
  const [selectedTrajetId, setSelectedTrajetId] = useState<string | null>(null);
  // Bannière affichée juste après la création d'un nouveau trajet (pas une
  // mise à jour) : rien ne reliait auparavant cet écran à « Courses », d'où
  // la confusion « j'ai créé un trajet mais aucune course n'apparaît ».
  const [trajetJusteCree, setTrajetJusteCree] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nom: '',
    description: '',
    sens: 'aller',
    heureDepart: '07:00' // Heure de départ par défaut
  });

  // États pour le loader
  const [loadingTrajet, setLoadingTrajet] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  const [waypoints, setWaypoints] = useState<any[]>([]);
  const [pointsRecup, setPointsRecup] = useState<PointRecup[]>([]);
  const [geoJson, setGeoJson] = useState<any>(null);
  const [distanceKm, setDistanceKm] = useState(0);
  const [dureeMin, setDureeMin] = useState(0);

  const [eleves, setEleves] = useState<any[]>([]);
  // Affectations de TOUS les trajets (pas seulement celui-ci) — nécessaire
  // pour exclure du menu "+ Ajouter un enfant" un élève déjà affecté à un
  // point d'un AUTRE trajet. Avant ce correctif, le filtre ne regardait que
  // les affectations DE CE point : on pouvait choisir un élève déjà affecté
  // ailleurs et recevoir une erreur HTTP brute au lieu du message clair que
  // le backend renvoie (`affectations.service.ts`, "déjà affecté au point…").
  const [toutesAffectations, setToutesAffectations] = useState<any[]>([]);
  const [expandedPoint, setExpandedPoint] = useState<string | null>(null);

  // Replié = juste une petite pastille flottante au-dessus de la carte, sans
  // le panneau complet. Préférence mémorisée par appareil : simple confort
  // d'affichage, pas un état à partager.
  const [pointsListReplie, setPointsListReplie] = useState<boolean>(() => {
    try { return localStorage.getItem('trajetEditor.pointsListReplie') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('trajetEditor.pointsListReplie', pointsListReplie ? '1' : '0'); } catch {}
  }, [pointsListReplie]);

  // Hauteur du panneau flottant "Points du Trajet", ajustable à la souris via
  // la poignée de redimensionnement natif (`resize-y`) posée dessus. Le
  // navigateur pose la nouvelle hauteur directement en style inline sur le
  // nœud DOM — on la relit ici pour la mémoriser, et on la réapplique à
  // chaque réouverture du panneau (son démontage/remontage au repli sinon
  // perdrait la taille choisie).
  const pointsListPanelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = pointsListPanelRef.current;
    if (!el) return;

    try {
      const hauteurMemorisee = localStorage.getItem('trajetEditor.pointsListHauteur');
      el.style.height = hauteurMemorisee || '60vh';
    } catch {
      el.style.height = '60vh';
    }

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      try { localStorage.setItem('trajetEditor.pointsListHauteur', el.style.height); } catch {}
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [pointsListReplie]);

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [selectedMarkerType, setSelectedMarkerType] = useState<MarkerType | null>(null);
  const [highlightedPointIndex, setHighlightedPointIndex] = useState<number | null>(null);
  const [focusedPoint, setFocusedPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [alternativeRoutes, setAlternativeRoutes] = useState<any[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number>(0);

  useEffect(() => {
    (window as any).handleMapClickForGeocode = async (lat: number, lng: number) => {
      // Si mode navigation (null), ne rien faire - permet le déplacement de la carte
      if (!selectedMarkerType) {
        return; // Sortir silencieusement sans alerte
      }

      try {
        const geo = await reverseGeocode(lat, lng);
        const address = geo?.success ? geo.address : `Point ${pointsRecup.length + 1}`;

        // Pour départ et arrivée : un seul point autorisé (remplacer l'existant)
        if (selectedMarkerType === 'depart' || selectedMarkerType === 'arrivee') {
          const existingIndex = pointsRecup.findIndex(p => p.type === selectedMarkerType);

          if (existingIndex !== -1) {
            // Remplacer le point existant
            const updatedPoints = [...pointsRecup];
            updatedPoints[existingIndex] = {
              ...updatedPoints[existingIndex],
              nom: address,
              latitude: lat,
              longitude: lng,
            };
            setPointsRecup(updatedPoints);
            return;
          }
        }

        // Ajouter un nouveau point
        const newPoint: PointRecup = {
          nom: address,
          latitude: lat,
          longitude: lng,
          tempsArret: '08:00',
          ordrePassage: pointsRecup.length + 1,
          type: selectedMarkerType as MarkerType,
          affectations: []
        };

        setPointsRecup(prev => [...prev, newPoint]);

      } catch (err) {
        console.error("Geocoding failed", err);

        // Même logique sans geocoding
        const address = `Point ${pointsRecup.length + 1}`;

        if (selectedMarkerType === 'depart' || selectedMarkerType === 'arrivee') {
          const existingIndex = pointsRecup.findIndex(p => p.type === selectedMarkerType);

          if (existingIndex !== -1) {
            const updatedPoints = [...pointsRecup];
            updatedPoints[existingIndex] = {
              ...updatedPoints[existingIndex],
              nom: address,
              latitude: lat,
              longitude: lng,
            };
            setPointsRecup(updatedPoints);
            return;
          }
        }

        const newPoint: PointRecup = {
          nom: address,
          latitude: lat,
          longitude: lng,
          tempsArret: '08:00',
          ordrePassage: pointsRecup.length + 1,
          type: selectedMarkerType as MarkerType,
          affectations: []
        };

        setPointsRecup(prev => [...prev, newPoint]);
      }
    };

    return () => { delete (window as any).handleMapClickForGeocode; };
  }, [pointsRecup, selectedMarkerType]);

  // Synchroniser les waypoints avec pointsRecup pour que les marqueurs s'affichent correctement
  // Vérification d'égalité pour éviter les boucles infinies et les re-renders inutiles
  useEffect(() => {
    console.log('🔄 Synchronisation pointsRecup → waypoints. Points:', pointsRecup.length);

    const newWaypoints = pointsRecup.map(p => ({
      lat: Number(p.latitude),
      lng: Number(p.longitude)
    }));

    // Vérifier si les waypoints sont réellement différents avant de mettre à jour
    const areEqual = waypoints.length === newWaypoints.length &&
      waypoints.every((wp, i) =>
        newWaypoints[i] &&
        Math.abs(wp.lat - newWaypoints[i].lat) < 0.000001 &&
        Math.abs(wp.lng - newWaypoints[i].lng) < 0.000001
      );

    if (!areEqual) {
      console.log('✅ Mise à jour des waypoints (pointsRecup → waypoints)');
      setWaypoints(newWaypoints);
    } else {
      console.log('✓ Waypoints déjà à jour');
    }
  }, [pointsRecup]); // Ne pas inclure waypoints dans les dépendances pour éviter la boucle

  useEffect(() => { fetchTrajets(); fetchEleves(); fetchToutesAffectations(); }, []);

  const fetchTrajets = async () => {
    try {
      const data = await getTrajets();
      setTrajets(Array.isArray(data) ? data : []);
    } catch (e) { console.error('Fetch trajets failed', e); }
  };

  const fetchEleves = async () => {
    try {
      const data = await getEleves();
      setEleves(Array.isArray(data) ? data : []);
    } catch (e) { console.error('Fetch eleves failed', e); }
  };

  const fetchToutesAffectations = async () => {
    try {
      const data = await getAffectations();
      setToutesAffectations(Array.isArray(data) ? data : []);
    } catch (e) { console.error('Fetch affectations failed', e); }
  };

  const handleSelectTrajet = async (trajet: any) => {
    console.log('🎯 Sélection du trajet:', trajet.nom, 'ID:', trajet.id);

    // Activer le loader
    setLoadingTrajet(true);
    setLoadingMessage('Chargement des points...');

    setSelectedTrajetId(trajet.id);
    setTrajetJusteCree(null);
    setFormData({
      nom: trajet.nom,
      description: trajet.description || '',
      sens: trajet.sens || 'aller',
      heureDepart: trajet.heureDepart || '07:00'
    });
    setDistanceKm(trajet.distanceKm || 0);
    setDureeMin(trajet.dureeEstimative || 0);
    setGeoJson(trajet.geoJson || null);

    try {
      // ⚡ ÉTAPE 1 : Charger les points (rapide)
      const points = await getPoints(trajet.id);
      console.log('📍 Points chargés:', points.length, 'points');

      // ⚡ AFFICHAGE IMMÉDIAT : Créer les points sans affectations pour un affichage instantané
      const quickPoints = points.map((p: any, index: number) => {
        const type = p.type || (index === 0 ? 'depart' : (index === points.length - 1 ? 'arrivee' : 'arret'));
        return {
          ...p,
          type,
          affectations: [] // Vide temporairement pour affichage rapide
        };
      });

      // ✅ AFFICHER LES POINTS IMMÉDIATEMENT (sans attendre les affectations)
      setPointsRecup(quickPoints);

      // ✅ CRÉER LES WAYPOINTS IMMÉDIATEMENT pour affichage sur la carte
      const newWaypoints = quickPoints.map((p: any) => ({
        lat: Number(p.latitude),
        lng: Number(p.longitude)
      }));
      setWaypoints(newWaypoints);

      setLoadingMessage('Calcul de l\'itinéraire...');
      console.log('🗺️ Points et waypoints définis:', newWaypoints.length, 'points');

      // ⏳ ÉTAPE 2 : Charger les affectations en arrière-plan
      setLoadingMessage('Chargement des affectations...');

      const affectationsResults = await Promise.allSettled(
        points.map((p: any) => getAffectationsByPoint(p.id))
      );

      // ✅ METTRE À JOUR AVEC LES AFFECTATIONS
      const pointsWithAffectations = quickPoints.map((p: any, index: number) => ({
        ...p,
        affectations: affectationsResults[index].status === 'fulfilled'
          ? affectationsResults[index].value
          : []
      }));

      setPointsRecup(pointsWithAffectations);
      console.log('✅ Affectations chargées');

    } catch (err) {
      console.error('❌ Load points failed', err);
      setPointsRecup([]);
      setWaypoints([]);
    } finally {
      // Désactiver le loader après un court délai (pour laisser le temps à OSRM de calculer)
      setTimeout(() => {
        setLoadingTrajet(false);
        setLoadingMessage('');
      }, 800); // 800ms pour laisser OSRM terminer
    }
  };

  const handleNew = () => {
    setSelectedTrajetId(null);
    setFormData({ nom: '', description: '', sens: 'aller', heureDepart: '07:00' });
    setWaypoints([]);
    setPointsRecup([]);
    setGeoJson(null);
    setDistanceKm(0);
    setDureeMin(0);
    setTrajetJusteCree(null);
  };

  /**
   * Résultat d'un calcul d'itinéraire : on ne garde que la distance, la durée et
   * le tracé.
   *
   * Cette fonction réinjectait aussi les waypoints renvoyés par le contrôle de
   * routage (`setWaypoints(wps)`), ce qui refermait une boucle infinie : le
   * nouvel état repartait dans le contrôle, qui recalculait l'itinéraire, qui
   * rappelait cette fonction. Deux points suffisaient à déclencher des dizaines
   * de requêtes OSRM, à saturer la page — la carte ne répondait plus au
   * déplacement et refusait tout point supplémentaire.
   *
   * Les waypoints sont dérivés de `pointsRecup`, qui est la seule source de
   * vérité : le contrôle de routage les reçoit, il ne les dicte pas.
   */
  const handleRouteFound = (dist: number, time: number, geo: any, _wps: any) => {
    setDistanceKm(dist / 1000);
    setDureeMin(Math.round(time / 60));
    setGeoJson(geo);
  };

  const handleRoutesFound = (routes: any[]) => {
    setAlternativeRoutes(routes);
  };

  const handleSelectRoute = (index: number) => {
    setSelectedRouteIndex(index);
    const selectedRoute = alternativeRoutes[index];
    if (selectedRoute) {
      setDistanceKm(selectedRoute.distance / 1000);
      setDureeMin(Math.round(selectedRoute.duration / 60));
    }
  };

  /**
   * Calcule automatiquement les heures de passage pour chaque arrêt.
   * Basé sur l'heure de départ + durée OSRM + temps d'arrêt.
   */
  const calculerHoraires = () => {
    if (pointsRecup.length === 0 || !formData.heureDepart) return;

    // Parse heure de départ
    const [heures, minutes] = formData.heureDepart.split(':').map(Number);
    let tempsAccumule = heures * 60 + minutes; // En minutes depuis minuit

    const updatedPoints = pointsRecup.map((point, index) => {
      let heurePassage = '';

      if (index === 0) {
        // Premier point = heure de départ
        heurePassage = formData.heureDepart;
      } else {
        // Calculer le temps depuis le point précédent
        // On utilise la durée totale divisée par le nombre de segments
        const dureeSegmentMin = dureeMin > 0 ? dureeMin / pointsRecup.length : 5;
        const dureeArret = pointsRecup[index - 1].dureeArretMin || 2;

        tempsAccumule += dureeSegmentMin + dureeArret;

        const h = Math.floor(tempsAccumule / 60) % 24;
        const m = Math.floor(tempsAccumule % 60);
        heurePassage = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }

      return {
        ...point,
        heurePassage,
        dureeArretMin: point.dureeArretMin || 2 // 2 minutes par défaut
      };
    });

    setPointsRecup(updatedPoints);
  };

  // handleWaypointsChange supprimé - waypoints sont maintenant automatiquement synchronisés avec pointsRecup

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (waypoints.length < 2) {
      toast.error("Veuillez placer au moins un point de départ et un point d'arrivée sur la carte.");
      return;
    }

    setIsSaving(true);
    setLoadingMessage('Sauvegarde du trajet...');

    // Nettoyer et valider les waypoints
    const cleanWaypoints = waypoints.map(wp => {
      if (wp && typeof wp === 'object') {
        // Si c'est un objet Leaflet avec lat/lng
        if (wp.lat !== undefined && wp.lng !== undefined) {
          return { lat: Number(wp.lat), lng: Number(wp.lng) };
        }
        // Si c'est déjà au bon format
        return wp;
      }
      return null;
    }).filter(Boolean);

    // Valider le geoJson - doit être un objet valide ou undefined
    let cleanGeoJson;
    if (geoJson && typeof geoJson === 'object' && geoJson.type) {
      cleanGeoJson = geoJson;
    }

    const payload = {
      nom: formData.nom || 'Trajet sans nom',
      description: formData.description || '',
      sens: formData.sens || 'aller',
      heureDepart: formData.heureDepart || '07:00',
      distanceKm: Number(distanceKm) || 0,
      dureeEstimative: Number(dureeMin) || 0,
      ...(cleanGeoJson && { geoJson: cleanGeoJson }),
      ...(cleanWaypoints.length > 0 && { waypoints: cleanWaypoints })
    };

    console.log('Payload envoyé:', JSON.stringify(payload, null, 2));

    const estNouveauTrajet = !selectedTrajetId;
    try {
      let trajetId = selectedTrajetId;

      if (selectedTrajetId) {
        await updateTrajet(selectedTrajetId, payload);
        setTrajets(prev => prev.map(t => t.id === selectedTrajetId ? { ...t, ...payload } : t));
      } else {
        const created = await createTrajet(payload);
        setTrajets(prev => [...prev, created]);
        setSelectedTrajetId(created.id);
        trajetId = created.id;
      }

      if (trajetId) {
        setLoadingMessage('Sauvegarde des points...');

        const currentPointIds = pointsRecup.filter(p => p.id).map(p => p.id);
        const existingPoints = await getPoints(trajetId);
        for (const oldPoint of existingPoints) {
          if (!currentPointIds.includes(oldPoint.id)) {
            await deletePoint(oldPoint.id);
          }
        }

        const updatedPoints = [];
        const totalPoints = pointsRecup.length;

        for (let i = 0; i < pointsRecup.length; i++) {
          const point = pointsRecup[i];
          setLoadingMessage(`Sauvegarde des points... (${i + 1}/${totalPoints})`);

          const pointPayload = {
            trajetId,
            nom: point.nom || `Point ${point.ordrePassage}`,
            latitude: Number(point.latitude),
            longitude: Number(point.longitude),
            tempsArret: point.tempsArret || '08:00', // Gardé pour compatibilité
            heurePassage: point.heurePassage || undefined,
            dureeArretMin: point.dureeArretMin || 2,
            ordrePassage: Number(point.ordrePassage),
            type: point.type || 'arret'
          };

          console.log('Point payload:', pointPayload);

          if (point.id) {
            await updatePoint(point.id, pointPayload);
            updatedPoints.push({ ...point, ...pointPayload });
          } else {
            const created = await createPoint(pointPayload);
            updatedPoints.push({ ...point, ...pointPayload, id: created.id });
          }
        }

        // Mettre à jour pointsRecup avec les IDs créés
        setPointsRecup(updatedPoints);

        // Synchroniser les waypoints avec les points mis à jour
        const syncedWaypoints = updatedPoints.map((p: any) => ({
          lat: Number(p.latitude),
          lng: Number(p.longitude)
        }));
        setWaypoints(syncedWaypoints);
      }

      setLoadingMessage('');
      toast.success('Trajet et points sauvegardés avec succès !');
      if (estNouveauTrajet && trajetId) setTrajetJusteCree(trajetId);
    } catch (err: any) {
      console.error('Erreur complète:', err);
      console.error('Réponse du serveur:', err.response?.data);
      const errorMessage = err.response?.data?.message || err.message || 'Erreur inconnue';
      toast.error('Erreur lors de la sauvegarde : ' + errorMessage);
    } finally {
      setIsSaving(false);
      setLoadingMessage('');
    }
  };

  const handleDeleteTrajet = async () => {
    if (!selectedTrajetId) return;
    if (!(await confirmer('Voulez-vous vraiment supprimer ce trajet et tous ses points ?', { danger: true }))) return;
    setIsDeleting(true);
    try {
      await deleteTrajet(selectedTrajetId);
      setTrajets(prev => prev.filter(t => t.id !== selectedTrajetId));
      handleNew();
    } catch (err) {
      toast.error('Erreur lors de la suppression.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeletePoint = async (index: number) => {
    if (!(await confirmer('Supprimer ce point de récupération ?', { danger: true }))) return;

    const newPoints = pointsRecup.filter((_, i) => i !== index);
    newPoints.forEach((p, i) => { p.ordrePassage = i + 1; });

    const newWps = waypoints.filter((_, i) => i !== index);

    setWaypoints(newWps);
    setPointsRecup(newPoints);

    if (newWps.length < 2) {
      setGeoJson(null);
      setDistanceKm(0);
      setDureeMin(0);
    }
  };

  const handleUpdatePointName = (index: number, nom: string) => {
    const newPoints = [...pointsRecup];
    newPoints[index].nom = nom;
    setPointsRecup(newPoints);
  };

  const handleUpdatePointTime = (index: number, tempsArret: string) => {
    const newPoints = [...pointsRecup];
    newPoints[index].tempsArret = tempsArret;
    setPointsRecup(newPoints);
  };

  const handleAffecterEnfant = async (pointIndex: number, childId: string) => {
    const point = pointsRecup[pointIndex];

    // Seuls les points d'arrêt peuvent avoir des affectations d'enfants
    if (point.type !== 'arret') {
      toast.error('Vous ne pouvez affecter des enfants qu\'aux points d\'arrêt.');
      return;
    }

    if (!point.id) {
      toast.error('Veuillez d\'abord enregistrer le trajet avant d\'affecter des enfants.');
      return;
    }

    try {
      const affectation = await affecterEnfant(point.id, { childId, ordreMontee: (point.affectations?.length || 0) + 1 });
      const newPoints = [...pointsRecup];
      newPoints[pointIndex].affectations = [...(newPoints[pointIndex].affectations || []), affectation];
      setPointsRecup(newPoints);
      // Sans ce rafraîchissement, cet élève resterait proposable dans le menu
      // d'un AUTRE point jusqu'au prochain rechargement complet de la page.
      fetchToutesAffectations();
    } catch (err: any) {
      // `err.message` brut (ex. "Request failed with status code 409")
      // masquait le message clair que le backend renvoie déjà pour ce cas
      // précis (« … est déjà affecté au point … »).
      toast.error(messageFromError(err, "Erreur lors de l'affectation."));
    }
  };

  const handleSupprimerAffectation = async (pointIndex: number, affectationId: string) => {
    try {
      await supprimerAffectation(affectationId);
      const newPoints = [...pointsRecup];
      newPoints[pointIndex].affectations = newPoints[pointIndex].affectations?.filter(a => a.id !== affectationId);
      setPointsRecup(newPoints);
      fetchToutesAffectations();
    } catch (err: any) {
      toast.error(messageFromError(err, 'Erreur lors de la désaffectation.'));
    }
  };

  const clearMap = async () => {
    if (await confirmer("Voulez-vous effacer le tracé et tous les points ?", { danger: true })) {
      setWaypoints([]);
      setPointsRecup([]);
      setGeoJson(null);
      setDistanceKm(0);
      setDureeMin(0);
      setSelectedMarkerType(null); // Réinitialiser le mode de placement
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] p-4 font-sans text-[var(--text-primary)]">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-6rem)]">

        {/* Colonne Gauche */}
        <div className="lg:col-span-3 flex flex-col gap-3 overflow-hidden">

          <div className="bg-white rounded-[10px] p-5 shadow-sm border border-slate-100 shrink-0">
            <h2 className="text-[28px] font-bold text-slate-900 mb-1 leading-tight flex items-center gap-2">
              <Route className="text-blue-600" /> Éditeur de Trajet
            </h2>
            <p className="text-[var(--text-secondary)] text-[13px] mb-4">
              {trajets.length === 0
                ? "Créez un trajet, placez des points sur la carte, et affectez des enfants."
                : `${trajets.length} trajet${trajets.length > 1 ? 's' : ''} enregistré${trajets.length > 1 ? 's' : ''}.`}
            </p>

            <div className="flex gap-2">
              <select
                className="uiverse-input flex-1"
                value={selectedTrajetId || ''}
                onChange={(e) => {
                  if (e.target.value === '') handleNew();
                  else {
                    const trj = trajets.find(t => t.id === e.target.value);
                    if (trj) handleSelectTrajet(trj);
                  }
                }}
              >
                <option value="">-- Créer un nouveau trajet --</option>
                {trajets.map(t => (
                  <option key={t.id} value={t.id}>{t.nom} ({t.sens})</option>
                ))}
              </select>
              {selectedTrajetId && (
                <button onClick={handleNew} className="uiverse-new-btn px-3 flex-shrink-0" title="Nouveau">
                  <span className="button_top"><Plus size={18}/></span>
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-[10px] shadow-sm border border-slate-100 flex-1 overflow-y-auto custom-scrollbar p-5">
            <form onSubmit={handleSave} className="flex flex-col h-full">
              <div className="uiverse-flex-column mb-4">
                <label>Nom de la Ligne</label>
                <div className="uiverse-inputForm mt-1">
                  <input required value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value})}
                    placeholder="Ex: Ligne 1 - Nord" className="uiverse-input" />
                </div>
              </div>

              <div className="uiverse-flex-column mb-4">
                <label>Sens du trajet</label>
                <div className="mt-2 flex gap-2">
                  {['aller', 'retour', 'mixte'].map(s => (
                    <button key={s} type="button"
                      onClick={() => setFormData({...formData, sens: s})}
                      className={`flex-1 py-2 rounded font-semibold text-sm border capitalize transition-colors ${formData.sens === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="uiverse-flex-column mb-4">
                <label className="flex items-center gap-2">
                  <Clock size={16} className="text-blue-600" />
                  Heure de départ
                </label>
                <div className="uiverse-inputForm mt-1">
                  <input
                    type="time"
                    required
                    value={formData.heureDepart}
                    onChange={e => setFormData({...formData, heureDepart: e.target.value})}
                    className="uiverse-input"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Les horaires de passage seront calculés automatiquement pour chaque arrêt
                </p>
              </div>

              <div className="uiverse-flex-column mb-6 flex-1">
                <label>Description / Notes</label>
                <div className="uiverse-inputForm mt-1 h-full">
                  <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}
                    placeholder="Quartiers traversés..." className="uiverse-input resize-none h-full min-h-[80px]" />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
                <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                  <Route size={16} />
                  Statistiques
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-blue-600 block">Distance totale</span>
                    <span className="font-bold text-blue-900 text-lg">{distanceKm.toFixed(2)} km</span>
                  </div>
                  <div>
                    <span className="text-blue-600 block">Durée route</span>
                    <span className="font-bold text-blue-900 text-lg">{dureeMin} min</span>
                  </div>
                </div>

                {pointsRecup.length > 0 && pointsRecup[0]?.heurePassage && pointsRecup[pointsRecup.length - 1]?.heurePassage && (
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-green-600" />
                        <span className="text-blue-600">Départ</span>
                        <span className="font-bold text-blue-900">{pointsRecup[0].heurePassage}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-red-600" />
                        <span className="text-blue-600">Arrivée</span>
                        <span className="font-bold text-blue-900">{pointsRecup[pointsRecup.length - 1].heurePassage}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-auto">
                {selectedTrajetId && (
                  <button type="button" onClick={handleDeleteTrajet} disabled={isDeleting} className="uiverse-delete-btn flex-shrink-0">
                    <span className="button_top"><Trash2 size={20}/></span>
                  </button>
                )}
                <button type="submit" disabled={isSaving} className="uiverse-btn-submit flex-1">
                  {isSaving ? '...' : (selectedTrajetId ? 'Mettre à jour le trajet' : 'Enregistrer le trajet')}
                </button>
              </div>

              {/* Trajet et course sont deux étapes distinctes — sans ce lien,
                  rien ne guidait vers « Courses » après la création. */}
              {trajetJusteCree && (
                <div className="mt-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50 flex items-start justify-between gap-2">
                  <p className="text-[13px] text-emerald-800">
                    Trajet créé. Planifiez maintenant une course sur cette ligne pour pouvoir y affecter des élèves.
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => naviguer(`/courses?trajetId=${trajetJusteCree}`)}
                      className="text-[12px] font-semibold px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 whitespace-nowrap"
                    >
                      Créer une course
                    </button>
                    <button
                      type="button"
                      onClick={() => setTrajetJusteCree(null)}
                      className="text-emerald-600 hover:text-emerald-800 text-[13px] px-1"
                      title="Fermer"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Colonne Droite */}
        <div className="lg:col-span-9 flex flex-col gap-3 overflow-hidden">

          {/* Carte */}
          <div className="bg-white rounded-[10px] shadow-sm border border-slate-200 flex flex-col overflow-hidden relative flex-1 min-h-[300px]">
            <div className="p-2 bg-white border-b z-10 relative space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Map size={18} className="text-blue-600" />
                  <span className="text-sm font-semibold text-slate-700">Sélectionnez le type de point à placer :</span>
                </div>
                <button onClick={clearMap} className="text-red-500 hover:bg-red-50 p-2 rounded-md transition-colors flex items-center gap-1 text-sm font-bold">
                  <Trash size={16}/> Effacer tout
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedMarkerType(prev => prev === 'depart' ? null : 'depart')}
                  className={`px-4 py-2 rounded-md font-bold tracking-wide text-sm uppercase transition-all duration-200 border-2 ${
                    selectedMarkerType === 'depart'
                      ? 'bg-emerald-500 text-white border-emerald-300 scale-105 shadow-[0_0_15px_rgba(16,185,129,0.7)]'
                      : 'bg-white text-emerald-600 border-emerald-500 hover:scale-105 hover:shadow-lg'
                  }`}
                >
                  Départ
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMarkerType(prev => prev === 'arret' ? null : 'arret')}
                  className={`px-4 py-2 rounded-md font-bold tracking-wide text-sm uppercase transition-all duration-200 border-2 ${
                    selectedMarkerType === 'arret'
                      ? 'bg-blue-500 text-white border-blue-300 scale-105 shadow-[0_0_15px_rgba(59,130,246,0.7)]'
                      : 'bg-white text-blue-600 border-blue-500 hover:scale-105 hover:shadow-lg'
                  }`}
                >
                  Arrêt
                </button>

                <button
                  type="button"
                  disabled={formData.sens !== 'mixte'}
                  title={
                    formData.sens !== 'mixte'
                      ? "Le point d'arrivée n'est un point de récupération que pour un trajet mixte — passez le sens à \"mixte\" pour l'utiliser en affectation."
                      : undefined
                  }
                  onClick={() => setSelectedMarkerType(prev => prev === 'arrivee' ? null : 'arrivee')}
                  className={`px-4 py-2 rounded-md font-bold tracking-wide text-sm uppercase transition-all duration-200 border-2 ${
                    formData.sens !== 'mixte'
                      ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                      : selectedMarkerType === 'arrivee'
                      ? 'bg-red-500 text-white border-red-300 scale-105 shadow-[0_0_15px_rgba(239,68,68,0.7)]'
                      : 'bg-white text-red-600 border-red-500 hover:scale-105 hover:shadow-lg'
                  }`}
                >
                  Arrivée
                </button>
              </div>
              {formData.sens !== 'mixte' && (
                <p className="text-[11px] text-slate-500 -mt-1">
                  Point d'arrivée désactivé : non affectable pour un trajet « {formData.sens} ». Passez le sens à « mixte » pour l'utiliser en affectation.
                </p>
              )}

              {/* Bandeau indicateur du mode actif */}
              {selectedMarkerType && (
                <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 animate-in fade-in slide-in-from-top-2 duration-300 ${
                  selectedMarkerType === 'depart'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : selectedMarkerType === 'arret'
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-red-50 border-red-300 text-red-700'
                }`}>
                  <MapPin size={16} className="flex-shrink-0" />
                  <span className="text-xs font-semibold">
                    Mode actif : <span className="uppercase font-bold">{selectedMarkerType}</span> — Cliquez sur la carte pour placer le point
                    {selectedMarkerType !== 'arret' && <span className="text-xs font-normal opacity-75"> (remplace l'existant si déjà placé)</span>}
                  </span>
                </div>
              )}

              <div className="text-xs text-slate-600 flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-md border border-blue-100">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-blue-700">Sur la carte :</span>
                  {(Object.keys(MARQUEURS) as MarkerType[]).map((type, i) => (
                    <React.Fragment key={type}>
                      {i > 0 && <span className="text-slate-300">•</span>}
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="inline-flex items-center justify-center rounded-full text-white font-bold"
                          style={{
                            background: MARQUEURS[type].couleur,
                            width: '18px',
                            height: '18px',
                            fontSize: '10px',
                            lineHeight: 1,
                          }}
                        >
                          {MARQUEURS[type].lettre}
                        </span>
                        <span className="text-[10px] font-bold" style={{ color: MARQUEURS[type].couleur }}>
                          {MARQUEURS[type].libelle}
                        </span>
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Panneau de sélection d'itinéraire alternatif */}
              {alternativeRoutes.length > 1 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Route size={14} className="text-blue-600" />
                    <span className="text-xs font-semibold text-slate-700">
                      Choisissez votre itinéraire ({alternativeRoutes.length} options) :
                    </span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {alternativeRoutes.map((route, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleSelectRoute(index)}
                        className={`flex-shrink-0 px-3 py-2 rounded-lg border-2 transition-all text-left min-w-[160px] ${
                          selectedRouteIndex === index
                            ? 'bg-blue-50 border-blue-500 shadow-md'
                            : 'bg-white border-slate-200 hover:border-blue-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-bold ${
                            selectedRouteIndex === index ? 'text-blue-700' : 'text-slate-600'
                          }`}>
                            {index === 0 ? '⚡ Le plus rapide' :
                             index === 1 ? '📏 Le plus court' :
                             `🔄 Alternatif ${index}`}
                          </span>
                          {selectedRouteIndex === index && (
                            <span className="text-blue-600">✓</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-600">
                          <span className="flex items-center gap-0.5">
                            <Clock size={10} />
                            {Math.round(route.duration / 60)} min
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5">
                            📏 {(route.distance / 1000).toFixed(1)} km
                          </span>
                        </div>
                        {index === 0 && (
                          <div className="mt-1 text-[9px] text-green-600 font-semibold">
                            Recommandé
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 relative z-0">
              <MapContainer
                center={ABIDJAN}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; OpenStreetMap'
                />
                <MapAutoResize />
                <MapCursorController cursorType={selectedMarkerType} />
                <SearchControl />
                <FitBoundsOnWaypoints waypoints={waypoints} />
                <FlyToPoint point={focusedPoint} />
                {/*
                  Pas de `key` dérivée des coordonnées ici : elle changeait à chaque
                  point placé, ce qui démontait et reconstruisait tout le contrôle de
                  routage — nouveau contrôle, nouveau recadrage, nouvelles requêtes
                  OSRM. Le composant se met à jour seul quand `waypoints` change.
                */}
                <RoutingMachine
                  waypoints={waypoints}
                  pointsTypes={pointsRecup.map(p => p.type)}
                  onRouteFound={handleRouteFound}
                  onRoutesFound={handleRoutesFound}
                  onDeleteMarker={handleDeletePoint}
                  highlightedIndex={highlightedPointIndex}
                  selectedRouteIndex={selectedRouteIndex}
                  selectedMarkerType={selectedMarkerType}
                  readOnly={false}
                />
              </MapContainer>

              {/* Loader pendant le chargement ou la sauvegarde */}
              {(loadingTrajet || isSaving) && (
                <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50">
                  <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4 border border-slate-200">
                    {/* Spinner */}
                    <div className="relative">
                      <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200"></div>
                      <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-600 border-t-transparent absolute top-0"></div>
                    </div>

                    {/* Message */}
                    <div className="text-center">
                      <p className="text-lg font-semibold text-slate-800 mb-1">
                        {isSaving ? 'Sauvegarde en cours' : 'Chargement du trajet'}
                      </p>
                      <p className="text-sm text-slate-600">
                        {loadingMessage || 'Veuillez patienter...'}
                      </p>
                    </div>

                    {/* Barre de progression animée */}
                    <div className="w-48 h-1 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 animate-pulse"></div>
                    </div>
                  </div>
                </div>
              )}

              {/*
                Liste des Points — EN SURIMPRESSION sur la carte, plus du tout dans
                le flux (elle vivait comme sœur de la carte dans la colonne flex :
                repliée, il restait quand même la hauteur de son en-tête, donc la
                carte ne récupérait jamais tout l'espace, replié ou pas). Ici son
                conteneur (`<div className="flex-1 relative z-0">`) garde TOUJOURS
                sa taille pleine : la carte occupe donc 100% de cet espace en
                permanence, et ce panneau flotte juste par-dessus, sans jamais
                réduire la carte elle-même.
              */}
              {pointsRecup.length > 0 && (
                pointsListReplie ? (
                  <button
                    type="button"
                    onClick={() => setPointsListReplie(false)}
                    className="absolute bottom-3 right-3 z-[1000] bg-white shadow-lg hover:shadow-xl rounded-full pl-3 pr-4 py-2 flex items-center gap-2 border border-slate-200 transition-shadow text-sm font-semibold text-slate-800"
                    title="Afficher les points du trajet"
                  >
                    <MapPin size={16} className="text-blue-600"/>
                    Points du Trajet ({pointsRecup.length})
                    <ChevronUp size={16}/>
                  </button>
                ) : (
                <div
                  ref={pointsListPanelRef}
                  className="absolute bottom-3 right-3 z-[1000] w-[calc(100%-1.5rem)] sm:w-[360px] bg-white rounded-[10px] shadow-xl border border-slate-200 overflow-y-auto custom-scrollbar resize-y"
                  style={{ minHeight: '180px', maxHeight: '85vh' }}
                  title="Glissez le coin inférieur droit pour redimensionner"
                >
                  <div className="p-4 border-b bg-slate-50 space-y-3 sticky top-0 z-10">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setPointsListReplie(true)}
                        className="font-bold text-slate-900 flex items-center gap-2 hover:text-blue-600 transition-colors"
                        title="Replier pour dégager la carte"
                      >
                        <MapPin size={16} className="text-blue-600"/>
                        Points du Trajet ({pointsRecup.length})
                        <ChevronDown size={16}/>
                      </button>
                      <div className="flex items-center gap-2 text-[10px] font-semibold">
                        <span className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-gradient-to-br from-emerald-400 to-green-600"></div>
                          Départ
                        </span>
                        <span className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-gradient-to-br from-sky-400 to-blue-600"></div>
                          Arrêts
                        </span>
                        <span className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-gradient-to-br from-rose-400 to-red-600"></div>
                          Arrivée
                        </span>
                      </div>
                    </div>

                    {pointsRecup.length >= 2 && (
                      <button
                        type="button"
                        onClick={calculerHoraires}
                        className="w-full flex items-center justify-center gap-2 p-[10px] bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm text-sm font-semibold"
                      >
                        <Clock size={16} />
                        Calculer les horaires automatiquement
                      </button>
                    )}
                  </div>

                  <div className="p-2">
                {pointsRecup.map((point, index) => {
                  const isExpanded = expandedPoint === `${index}`;

                  let badgeConfig;
                  if (point.type === 'depart') {
                    badgeConfig = {
                      label: 'DÉPART',
                      gradient: 'from-emerald-500 to-green-600',
                      textColor: 'text-emerald-600',
                    };
                  } else if (point.type === 'arrivee') {
                    badgeConfig = {
                      label: 'ARRIVÉE',
                      gradient: 'from-red-500 to-rose-600',
                      textColor: 'text-red-600',
                    };
                  } else {
                    badgeConfig = {
                      label: `ARRÊT ${index + 1}`,
                      gradient: 'from-blue-500 to-indigo-600',
                      textColor: 'text-blue-600',
                    };
                  }

                  return (
                    <div key={index} className="mb-2 border border-slate-200 rounded-lg overflow-hidden hover:border-slate-300 transition-all">
                      <div className="p-3 bg-gradient-to-br from-slate-50 to-slate-100/50 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            const newIndex = highlightedPointIndex === index ? null : index;
                            setHighlightedPointIndex(newIndex);
                            if (newIndex !== null) {
                              setFocusedPoint({ lat: point.latitude, lng: point.longitude });
                            }
                          }}
                          className={`p-[3px] relative cursor-pointer ${highlightedPointIndex === index ? 'ring-4 ring-yellow-400 rounded-lg' : ''}`}
                          title="Cliquer pour localiser sur la carte"
                        >
                          <div className={`absolute inset-0 bg-gradient-to-r ${badgeConfig.gradient} rounded-lg`} />
                          <div className="px-4 py-2 bg-[var(--bg-secondary)] rounded-[6px] relative group transition duration-200 text-white hover:bg-transparent">
                            <span className="font-bold tracking-wide text-sm uppercase">
                              {badgeConfig.label}
                            </span>
                          </div>
                        </button>
                        <div className="flex-1 flex flex-col gap-1">
                          <input
                            type="text"
                            value={point.nom}
                            onChange={(e) => handleUpdatePointName(index, e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-slate-200 rounded"
                            placeholder="Nom du point"
                          />
                          {point.heurePassage && (
                            <div className="flex items-center gap-1 text-xs text-blue-600 font-semibold">
                              <Clock size={12} />
                              {point.heurePassage}
                              {point.dureeArretMin && point.type === 'arret' && (
                                <span className="text-gray-500">• Arrêt {point.dureeArretMin}min</span>
                              )}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newIndex = highlightedPointIndex === index ? null : index;
                            setHighlightedPointIndex(newIndex);
                            if (newIndex !== null) {
                              setFocusedPoint({ lat: point.latitude, lng: point.longitude });
                            }
                          }}
                          className={`p-1.5 hover:bg-blue-100 rounded transition-colors ${highlightedPointIndex === index ? 'bg-blue-100 text-blue-600' : 'text-slate-500'}`}
                          title="Localiser sur la carte"
                        >
                          <MapPinned size={16}/>
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedPoint(isExpanded ? null : `${index}`)}
                          className="p-1 hover:bg-slate-200 rounded"
                        >
                          {isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePoint(index)}
                          className="p-1 hover:bg-red-100 text-red-500 rounded"
                        >
                          <Trash size={16}/>
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="p-3 bg-white border-t space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                                <Clock size={12}/> Heure de passage
                              </label>
                              <input
                                type="time"
                                value={point.heurePassage || ''}
                                onChange={(e) => {
                                  const updated = [...pointsRecup];
                                  updated[index] = {...updated[index], heurePassage: e.target.value};
                                  setPointsRecup(updated);
                                }}
                                className="w-full mt-1 px-2 py-1 text-sm border border-slate-200 rounded"
                                placeholder="Calculé auto"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                                <Clock size={12}/> Temps d'arrêt (min)
                              </label>
                              <input
                                type="number"
                                min="0"
                                max="30"
                                value={point.dureeArretMin || 2}
                                onChange={(e) => {
                                  const updated = [...pointsRecup];
                                  updated[index] = {...updated[index], dureeArretMin: parseInt(e.target.value) || 2};
                                  setPointsRecup(updated);
                                }}
                                className="w-full mt-1 px-2 py-1 text-sm border border-slate-200 rounded"
                              />
                            </div>
                          </div>

                          {/* Affectation d'enfants uniquement pour les arrêts */}
                          {point.type === 'arret' ? (
                            <div>
                              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1 mb-2">
                                <Users size={12}/> Enfants à récupérer ({point.affectations?.length || 0})
                              </label>

                              {point.affectations && point.affectations.length > 0 && (
                                <div className="space-y-1 mb-2">
                                  {point.affectations.map((aff: any) => {
                                    const enfant = eleves.find(e => e.id === aff.childId);
                                    // `Child` n'a pas de champ `nom` (seulement
                                    // `firstName`/`lastName`) : chaque élève déjà
                                    // affecté s'affichait donc comme "Inconnu" ici.
                                    const nomEnfant = enfant ? `${enfant.firstName} ${enfant.lastName}`.trim() : '';
                                    return (
                                      <div key={aff.id} className="flex items-center justify-between bg-slate-50 px-2 py-1 rounded text-xs">
                                        <span className="font-medium">{nomEnfant || 'Inconnu'}</span>
                                        <button
                                          type="button"
                                          onClick={() => handleSupprimerAffectation(index, aff.id)}
                                          className="text-red-500 hover:text-red-700"
                                        >
                                          <X size={14}/>
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              <select
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleAffecterEnfant(index, e.target.value);
                                    e.target.value = '';
                                  }
                                }}
                                className="w-full px-2 py-1 text-xs border border-slate-200 rounded"
                              >
                                <option value="">+ Ajouter un enfant</option>
                                {eleves
                                  // Exclut tout élève déjà affecté à N'IMPORTE
                                  // QUEL point (pas seulement celui-ci) — sinon
                                  // on pouvait choisir un élève déjà affecté à
                                  // un autre point/trajet et recevoir une erreur
                                  // HTTP brute au lieu de ne simplement pas le
                                  // proposer dans la liste.
                                  .filter(eleve => !toutesAffectations.some((a: any) => a.childId === eleve.id))
                                  .map(eleve => (
                                    <option key={eleve.id} value={eleve.id}>{eleve.firstName} {eleve.lastName}</option>
                                  ))}
                              </select>
                            </div>
                          ) : (
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                              <p className="text-xs text-slate-600 flex items-center gap-2">
                                <AlertCircle size={14} className="text-slate-400 flex-shrink-0"/>
                                {point.type === 'depart' ? (
                                  <span>Point de départ : pas d'enfant à récupérer ici</span>
                                ) : (
                                  <span>Point d'arrivée : tous les enfants descendent ici</span>
                                )}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                  </div>
                </div>
                )
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
