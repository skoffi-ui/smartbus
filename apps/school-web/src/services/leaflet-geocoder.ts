/**
 * Service pour charger Leaflet Control Geocoder de manière dynamique
 */

let chargementPromise: Promise<void> | null = null;

export async function chargerLeafletGeocoder(): Promise<void> {
  if (chargementPromise) return chargementPromise;

  chargementPromise = new Promise((resolve, reject) => {
    // Vérifier si déjà chargé
    if ((window as any).L?.Control?.Geocoder) {
      resolve();
      return;
    }

    // Charger le CSS
    const linkCss = document.createElement('link');
    linkCss.rel = 'stylesheet';
    linkCss.href =
      'https://unpkg.com/leaflet-control-geocoder@2.4.0/dist/Control.Geocoder.css';
    document.head.appendChild(linkCss);

    // Charger le JS
    const script = document.createElement('script');
    script.src =
      'https://unpkg.com/leaflet-control-geocoder@2.4.0/dist/Control.Geocoder.js';
    script.async = true;
    script.onload = () => {
      console.log('✅ Leaflet Control Geocoder chargé');
      resolve();
    };
    script.onerror = () => {
      reject(new Error('Impossible de charger Leaflet Control Geocoder'));
    };
    document.body.appendChild(script);
  });

  return chargementPromise;
}
