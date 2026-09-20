import * as L from 'leaflet';

/**
 * Chargement de Leaflet Routing Machine depuis le CDN, une seule fois.
 *
 * Le chargement était auparavant refait dans chaque composant, avec un
 * `script.onload` d'un côté et un `setTimeout(…, 500)` de l'autre selon que la
 * balise existait déjà. En développement, React monte les effets deux fois :
 * le premier passage insérait le script, le second trouvait la balise déjà
 * présente et partait sur le `setTimeout`, qui se déclenchait avant la fin du
 * téléchargement et abandonnait. Résultat, le contrôle de routage n'était jamais
 * créé et **les clics sur la carte ne plaçaient aucun point**.
 *
 * Une promesse partagée au niveau du module supprime la course : tous les
 * appelants attendent le même chargement et ne reprennent qu'une fois
 * `L.Routing` réellement disponible.
 */

const CDN = 'https://unpkg.com/leaflet-routing-machine@3.2.12/dist';

let promesse: Promise<void> | null = null;

export function chargerLeafletRouting(): Promise<void> {
  if ((L as any).Routing) return Promise.resolve();
  if (promesse) return promesse;

  promesse = new Promise<void>((resolve, reject) => {
    // Décisif : le script CDN s'attache à `window.L`. Sans cette ligne, il
    // augmente un objet différent de l'import ESM utilisé par les composants,
    // si bien que `L.Routing` y restait indéfini — le contrôle de routage
    // n'était jamais créé et les clics sur la carte ne plaçaient aucun point.
    (window as any).L = L;

    if (!document.getElementById('lrm-css')) {
      const lien = document.createElement('link');
      lien.id = 'lrm-css';
      lien.rel = 'stylesheet';
      lien.href = `${CDN}/leaflet-routing-machine.css`;
      document.head.appendChild(lien);
    }

    const existant = document.getElementById('lrm-js') as HTMLScriptElement | null;
    if (existant) {
      // La balise est là mais le téléchargement peut être en cours : on écoute
      // plutôt que de parier sur un délai.
      if ((L as any).Routing) return resolve();
      existant.addEventListener('load', () => resolve(), { once: true });
      existant.addEventListener('error', () => reject(new Error('LRM injoignable')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = 'lrm-js';
    script.src = `${CDN}/leaflet-routing-machine.js`;
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => {
      promesse = null; // permet une nouvelle tentative
      reject(new Error('LRM injoignable'));
    }, { once: true });
    document.head.appendChild(script);
  });

  return promesse;
}

/** Vrai si le module de routage est prêt à être utilisé. */
export function routingDisponible(): boolean {
  return !!(L as any).Routing;
}
