import { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, Search, Plus, Trash2, MapPin, RefreshCw, AlertCircle, Route } from 'lucide-react';
import {
  getCourses,
  getPointsByCourse,
  getAffectations,
  affecterEnfant,
  supprimerAffectation,
  getEleves,
} from '../services/transport.service';
import { messageFromError } from '../services/api';

interface Eleve {
  id: string;
  firstName?: string;
  lastName?: string;
  className?: string;
  empCode?: string;
}

interface Point {
  id: string;
  nom: string;
  ordrePassage?: number;
}

interface Affectation {
  id: string;
  childId: string;
  pointId: string;
  ordreMontee?: number;
  child?: Eleve;
}

const nomComplet = (e?: Eleve) =>
  e ? `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim() || 'Élève sans nom' : 'Élève inconnu';

/**
 * Affectation des élèves aux points de récupération.
 *
 * Un élève ne peut être affecté qu'à un seul point : le serveur refuse une
 * seconde affectation. L'écran distingue donc explicitement les élèves libres
 * de ceux déjà placés ailleurs, plutôt que de laisser l'utilisateur découvrir
 * le refus après coup.
 */
export default function AffectationEleves() {
  const [courses, setCourses] = useState<any[]>([]);
  const [courseId, setCourseId] = useState('');
  const [points, setPoints] = useState<Point[]>([]);
  const [pointActif, setPointActif] = useState<Point | null>(null);

  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [affectations, setAffectations] = useState<Affectation[]>([]);

  const [recherche, setRecherche] = useState('');
  const [chargement, setChargement] = useState(true);
  const [chargementPoints, setChargementPoints] = useState(false);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState<string | null>(null);

  // ── Chargement initial : courses, élèves, affectations existantes ──
  const charger = useCallback(async () => {
    setChargement(true);
    setErreur('');
    try {
      const [c, e, a] = await Promise.all([getCourses(), getEleves(), getAffectations()]);
      setCourses(Array.isArray(c) ? c : []);
      setEleves(Array.isArray(e) ? e : []);
      setAffectations(Array.isArray(a) ? a : []);
    } catch (err) {
      setErreur(messageFromError(err, "Impossible de charger les données d'affectation."));
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  // ── Points du trajet de la course choisie ──
  useEffect(() => {
    if (!courseId) {
      setPoints([]);
      setPointActif(null);
      return;
    }
    let annule = false;
    setChargementPoints(true);
    getPointsByCourse(courseId)
      .then((liste) => {
        if (annule) return;
        const tries = (Array.isArray(liste) ? liste : []).sort(
          (a: Point, b: Point) => (a.ordrePassage ?? 0) - (b.ordrePassage ?? 0),
        );
        setPoints(tries);
        setPointActif(tries[0] ?? null);
      })
      .catch((err) => {
        if (!annule) {
          setPoints([]);
          setPointActif(null);
          setErreur(messageFromError(err, 'Impossible de charger les arrêts de cette course.'));
        }
      })
      .finally(() => !annule && setChargementPoints(false));
    return () => {
      annule = true;
    };
  }, [courseId]);

  // ── Dérivés ──
  const affectationParEleve = useMemo(() => {
    const m = new Map<string, Affectation>();
    for (const a of affectations) m.set(a.childId, a);
    return m;
  }, [affectations]);

  const nomDuPoint = useCallback(
    (pointId: string) => points.find((p) => p.id === pointId)?.nom ?? 'un autre arrêt',
    [points],
  );

  const affectesAuPoint = useMemo(
    () => (pointActif ? affectations.filter((a) => a.pointId === pointActif.id) : []),
    [affectations, pointActif],
  );

  const elevesDisponibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return eleves
      .filter((e) => !affectationParEleve.has(e.id))
      .filter((e) =>
        !q
          ? true
          : `${nomComplet(e)} ${e.className ?? ''} ${e.empCode ?? ''}`.toLowerCase().includes(q),
      );
  }, [eleves, affectationParEleve, recherche]);

  const nbAffectesAilleurs = useMemo(
    () =>
      eleves.filter((e) => {
        const a = affectationParEleve.get(e.id);
        return a && a.pointId !== pointActif?.id;
      }).length,
    [eleves, affectationParEleve, pointActif],
  );

  // ── Actions ──
  const affecter = async (eleve: Eleve) => {
    if (!pointActif) return;
    setEnCours(eleve.id);
    setErreur('');
    try {
      await affecterEnfant(pointActif.id, { childId: eleve.id });
      const a = await getAffectations();
      setAffectations(Array.isArray(a) ? a : []);
    } catch (err) {
      setErreur(messageFromError(err, "Impossible d'affecter cet élève."));
    } finally {
      setEnCours(null);
    }
  };

  const desaffecter = async (affectation: Affectation) => {
    setEnCours(affectation.id);
    setErreur('');
    try {
      await supprimerAffectation(affectation.id);
      setAffectations((prev) => prev.filter((a) => a.id !== affectation.id));
    } catch (err) {
      setErreur(messageFromError(err, 'Impossible de retirer cet élève.'));
    } finally {
      setEnCours(null);
    }
  };

  if (chargement) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
        Chargement des élèves et des arrêts…
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col h-[calc(100vh-100px)]">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Users className="text-blue-600" size={32} />
            Affectation des Élèves
          </h1>
          <p className="text-gray-500 mt-2">
            Associez chaque élève à l'arrêt où il monte. Un élève ne peut avoir qu'un seul arrêt.
          </p>
        </div>
        <button
          onClick={charger}
          className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400"
        >
          <RefreshCw size={15} /> Actualiser
        </button>
      </div>

      {erreur && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{erreur}</span>
        </div>
      )}

      {courses.length === 0 && (
        <div className="mb-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300">
          Aucune course n'existe encore. Créez une course et son trajet dans « Courses » et
          « Trajets », puis ajoutez-y des arrêts pour pouvoir affecter des élèves.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Colonne gauche : course puis arrêt */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 flex flex-col min-h-0">
          <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">
            1. Choisir l'arrêt
          </h2>

          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="w-full mb-4 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-gray-900 dark:text-white"
          >
            <option value="">— Choisir une course —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>

          <div className="flex-1 overflow-y-auto space-y-2">
            {!courseId && (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
                Sélectionnez d'abord une course.
              </p>
            )}

            {courseId && chargementPoints && (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-4">Chargement des arrêts…</p>
            )}

            {courseId && !chargementPoints && points.length === 0 && (
              <div className="text-sm text-gray-500 dark:text-gray-400 py-4 flex items-start gap-2">
                <Route size={16} className="mt-0.5 shrink-0" />
                <span>
                  Cette course n'a aucun arrêt. Ajoutez-en dans « Points de récupération », ou
                  vérifiez qu'elle est bien rattachée à un trajet.
                </span>
              </div>
            )}

            {points.map((point) => {
              const nb = affectations.filter((a) => a.pointId === point.id).length;
              const actif = pointActif?.id === point.id;
              return (
                <button
                  key={point.id}
                  onClick={() => setPointActif(point)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    actif
                      ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                      : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <MapPin size={18} className="shrink-0" />
                  <span className="font-medium text-left flex-1 truncate">
                    {point.ordrePassage ? `${point.ordrePassage}. ` : ''}
                    {point.nom}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    {nb}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Colonne droite : élèves de l'arrêt + élèves à affecter */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 flex flex-col min-h-0">
          {!pointActif ? (
            <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400 text-center px-6">
              Sélectionnez un arrêt à gauche pour voir et modifier les élèves qui y montent.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap justify-between items-center gap-3 mb-4 pb-4 border-b border-gray-100 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                  Arrêt : <span className="text-blue-600">{pointActif.nom}</span>
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    {affectesAuPoint.length} élève{affectesAuPoint.length > 1 ? 's' : ''}
                  </span>
                </h2>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Rechercher un élève à affecter…"
                    value={recherche}
                    onChange={(e) => setRecherche(e.target.value)}
                    className="pl-9 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none w-64"
                  />
                  <Search size={16} className="absolute left-3 top-3 text-gray-400" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-0">
                {/* Déjà affectés à cet arrêt */}
                <div className="flex flex-col min-h-0">
                  <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">
                    Montent à cet arrêt
                  </h3>
                  <div className="flex-1 overflow-y-auto">
                    {affectesAuPoint.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
                        Aucun élève n'est encore affecté à cet arrêt.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {affectesAuPoint.map((a) => (
                          <li
                            key={a.id}
                            className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 dark:text-white truncate">
                                {nomComplet(a.child)}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {a.child?.className ?? 'Classe non renseignée'}
                                {a.child?.empCode ? ` · matricule ${a.child.empCode}` : ''}
                              </div>
                            </div>
                            <button
                              onClick={() => desaffecter(a)}
                              disabled={enCours === a.id}
                              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-40"
                              title="Retirer de cet arrêt"
                            >
                              <Trash2 size={18} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Élèves encore libres */}
                <div className="flex flex-col min-h-0">
                  <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">
                    Élèves sans arrêt
                    {nbAffectesAilleurs > 0 && (
                      <span className="ml-2 font-normal text-gray-400">
                        ({nbAffectesAilleurs} déjà placé{nbAffectesAilleurs > 1 ? 's' : ''} ailleurs)
                      </span>
                    )}
                  </h3>
                  <div className="flex-1 overflow-y-auto">
                    {eleves.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
                        Aucun élève enregistré. Ajoutez-les depuis la page « Enfants ».
                      </p>
                    ) : elevesDisponibles.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
                        {recherche
                          ? 'Aucun élève libre ne correspond à cette recherche.'
                          : 'Tous les élèves sont déjà affectés à un arrêt.'}
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {elevesDisponibles.map((e) => (
                          <li
                            key={e.id}
                            className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 dark:text-white truncate">
                                {nomComplet(e)}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {e.className ?? 'Classe non renseignée'}
                                {e.empCode ? ` · matricule ${e.empCode}` : ''}
                              </div>
                            </div>
                            <button
                              onClick={() => affecter(e)}
                              disabled={enCours === e.id}
                              className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors disabled:opacity-40"
                              title={`Affecter à ${pointActif.nom}`}
                            >
                              <Plus size={18} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
