import { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, Search, Plus, Trash2, MapPin, RefreshCw, AlertCircle, Route, CheckCircle2, Circle, GripVertical, UserCheck, UserX, TrendingUp } from 'lucide-react';
import {
  getCourses,
  getPointsByCourse,
  getAffectations,
  affecterEnfant,
  supprimerAffectation,
  getEleves,
} from '../services/transport.service';
import { messageFromError } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useConfirm } from '../components/ConfirmProvider';

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
  courseId?: string | null;
  ordreMontee?: number;
  child?: Eleve;
}

const nomComplet = (e?: Eleve) =>
  e ? `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim() || 'Élève sans nom' : 'Élève inconnu';

/**
 * Affectation des élèves aux points de récupération, PAR COURSE.
 *
 * Un élève peut avoir une affectation par course (matin, retour midi,
 * remontée 14h, descente 16h...) — le serveur refuse seulement une seconde
 * affectation pour LA MÊME course. Toutes les listes/statistiques de cet
 * écran sont donc scopées à `courseId` (`affectationsDeLaCourse` ci-dessous) :
 * un élève déjà affecté sur une AUTRE course reste normalement proposable ici.
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

  // Nouveaux états pour UX améliorée
  const [selectedEleves, setSelectedEleves] = useState<Set<string>>(new Set());
  const [draggedEleve, setDraggedEleve] = useState<Eleve | null>(null);
  const [showAllStops, setShowAllStops] = useState(false);

  const toast = useToast();
  const confirmer = useConfirm();
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => toast[type](message);

  // Animation de succès
  const [recentlyAffected, setRecentlyAffected] = useState<Set<string>>(new Set());
  const [showConfetti, setShowConfetti] = useState(false);
  const [statsChanged, setStatsChanged] = useState(false);

  const triggerSuccessAnimation = (childId: string) => {
    setRecentlyAffected((prev) => new Set(prev).add(childId));
    setTimeout(() => {
      setRecentlyAffected((prev) => {
        const next = new Set(prev);
        next.delete(childId);
        return next;
      });
    }, 2000);
  };

  const triggerConfetti = () => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 1500);
  };

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
  // Scopées à la course choisie : un enfant peut avoir une affectation par
  // course (matin, retour midi, remontée 14h, descente 16h...), donc une
  // affectation sur une AUTRE course ne doit pas le faire apparaître comme
  // déjà placé ici. Les affectations héritées de TrajetEditor.tsx (sans
  // courseId) ne sont, elles, rattachées à aucune course : invisibles ici,
  // elles restent gérées par leur écran d'origine.
  const affectationsDeLaCourse = useMemo(
    () => (courseId ? affectations.filter((a) => a.courseId === courseId) : []),
    [affectations, courseId],
  );

  const affectationParEleve = useMemo(() => {
    const m = new Map<string, Affectation>();
    for (const a of affectationsDeLaCourse) m.set(a.childId, a);
    return m;
  }, [affectationsDeLaCourse]);

  const nomDuPoint = useCallback(
    (pointId: string) => points.find((p) => p.id === pointId)?.nom ?? 'un autre arrêt',
    [points],
  );

  const affectesAuPoint = useMemo(
    () => (pointActif ? affectationsDeLaCourse.filter((a) => a.pointId === pointActif.id) : []),
    [affectationsDeLaCourse, pointActif],
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

  // ── Statistiques globales ──
  const [prevStats, setPrevStats] = useState({ total: 0, affectes: 0, nonAffectes: 0, pourcentage: 0 });
  const stats = useMemo(() => {
    const total = eleves.length;
    const affectes = affectationsDeLaCourse.length;
    const nonAffectes = total - affectes;
    const pourcentage = total > 0 ? Math.round((affectes / total) * 100) : 0;
    return { total, affectes, nonAffectes, pourcentage };
  }, [eleves, affectationsDeLaCourse]);

  // Déclencher confetti à 100% et animation des stats
  useEffect(() => {
    if (stats.affectes !== prevStats.affectes) {
      setStatsChanged(true);
      setTimeout(() => setStatsChanged(false), 600);
    }
    if (stats.pourcentage === 100 && prevStats.pourcentage < 100 && stats.total > 0) {
      triggerConfetti();
      showToast('🎉 Tous les élèves sont affectés !', 'success');
    }
    setPrevStats(stats);
  }, [stats]);

  // ── Actions ──
  const affecter = async (eleve: Eleve) => {
    if (!pointActif) return;
    setEnCours(eleve.id);
    setErreur('');
    try {
      // Sans `ordreMontee`, l'affectation gardait la valeur par défaut `0`
      // (voir `Affectation.ordreMontee`) quel que soit l'ordre réel de
      // ramassage — l'ordre de passage restait donc silencieusement inerte
      // pour tout trajet géré depuis cet écran plutôt que TrajetEditor.tsx
      // (qui, lui, le calcule déjà correctement).
      const ordreMontee = affectationsDeLaCourse.filter((a) => a.pointId === pointActif.id).length + 1;
      await affecterEnfant(pointActif.id, { childId: eleve.id, ordreMontee, courseId });
      const a = await getAffectations();
      setAffectations(Array.isArray(a) ? a : []);
      triggerSuccessAnimation(eleve.id);
      showToast(`${nomComplet(eleve)} a été affecté(e) à ${pointActif.nom}`, 'success');
    } catch (err) {
      setErreur(messageFromError(err, "Impossible d'affecter cet élève."));
      showToast("Échec de l'affectation", 'error');
    } finally {
      setEnCours(null);
    }
  };

  const desaffecter = async (affectation: Affectation) => {
    const eleveNom = nomComplet(affectation.child);
    if (!(await confirmer(`Voulez-vous vraiment retirer ${eleveNom} de cet arrêt ?`))) return;

    setEnCours(affectation.id);
    setErreur('');
    try {
      await supprimerAffectation(affectation.id);
      setAffectations((prev) => prev.filter((a) => a.id !== affectation.id));
      showToast(`${eleveNom} a été retiré(e) de l'arrêt`, 'info');
    } catch (err) {
      setErreur(messageFromError(err, 'Impossible de retirer cet élève.'));
      showToast('Échec de la suppression', 'error');
    } finally {
      setEnCours(null);
    }
  };

  // ── Actions en masse ──
  const toggleSelectEleve = (eleveId: string) => {
    setSelectedEleves((prev) => {
      const next = new Set(prev);
      if (next.has(eleveId)) {
        next.delete(eleveId);
      } else {
        next.add(eleveId);
      }
      return next;
    });
  };

  const affecterSelection = async () => {
    if (!pointActif || selectedEleves.size === 0) return;
    const count = selectedEleves.size;
    const eleveIds = Array.from(selectedEleves);
    setEnCours('bulk');
    setErreur('');
    try {
      const ordreDeBase = affectationsDeLaCourse.filter((a) => a.pointId === pointActif.id).length;
      await Promise.all(
        eleveIds.map((childId, index) =>
          affecterEnfant(pointActif.id, { childId, ordreMontee: ordreDeBase + index + 1, courseId })
        )
      );
      const a = await getAffectations();
      setAffectations(Array.isArray(a) ? a : []);
      // Déclencher l'animation pour tous les élèves affectés
      eleveIds.forEach((id) => triggerSuccessAnimation(id));
      // Confetti pour affectation en masse (3+ élèves)
      if (count >= 3) {
        triggerConfetti();
      }
      setSelectedEleves(new Set());
      showToast(`${count} élève${count > 1 ? 's' : ''} affecté${count > 1 ? 's' : ''} à ${pointActif.nom}`, 'success');
    } catch (err) {
      setErreur(messageFromError(err, "Impossible d'affecter ces élèves."));
      showToast("Échec de l'affectation en masse", 'error');
    } finally {
      setEnCours(null);
    }
  };

  // ── Drag & Drop ──
  const handleDragStart = (e: React.DragEvent, eleve: Eleve) => {
    setDraggedEleve(eleve);
    e.dataTransfer.effectAllowed = 'move';

    // Créer une preview personnalisée
    const dragPreview = document.createElement('div');
    dragPreview.className = 'drag-preview';
    dragPreview.innerHTML = `
      <div style="
        padding: 12px 16px;
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        color: white;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4);
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 200px;
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
        </svg>
        <span>${nomComplet(eleve)}</span>
      </div>
    `;
    dragPreview.style.position = 'absolute';
    dragPreview.style.top = '-1000px';
    document.body.appendChild(dragPreview);
    e.dataTransfer.setDragImage(dragPreview, 0, 0);
    setTimeout(() => document.body.removeChild(dragPreview), 0);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedEleve || !pointActif) return;
    await affecter(draggedEleve);
    setDraggedEleve(null);
  };

  if (chargement) {
    return (
      <div className="p-6 text-center text-gray-500">
        Chargement des élèves et des arrêts…
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col h-[calc(100vh-100px)]">
      {/* Header avec actions */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Users className="text-blue-600" size={32} />
            Affectation des Élèves
          </h1>
          <p className="text-gray-500 mt-2">
            Associez chaque élève à l'arrêt où il monte. Utilisez le drag & drop ou les boutons.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAllStops(!showAllStops)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <MapPin size={15} />
            {showAllStops ? 'Masquer' : 'Vue d\'ensemble'}
          </button>
          <button
            onClick={charger}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw size={15} /> Actualiser
          </button>
        </div>
      </div>

      {/* Stepper visuel */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex items-center gap-2">
          {courseId ? (
            <CheckCircle2 size={20} className="text-green-500" />
          ) : (
            <Circle size={20} className="text-gray-300" />
          )}
          <span className={courseId ? 'text-green-600 font-medium' : 'text-gray-400'}>
            1. Course
          </span>
        </div>
        <div className="h-px flex-1 bg-gray-200 max-w-[60px]" />
        <div className="flex items-center gap-2">
          {pointActif ? (
            <CheckCircle2 size={20} className="text-green-500" />
          ) : (
            <Circle size={20} className="text-gray-300" />
          )}
          <span className={pointActif ? 'text-green-600 font-medium' : 'text-gray-400'}>
            2. Arrêt
          </span>
        </div>
        <div className="h-px flex-1 bg-gray-200 max-w-[60px]" />
        <div className="flex items-center gap-2">
          {pointActif && affectesAuPoint.length > 0 ? (
            <CheckCircle2 size={20} className="text-green-500" />
          ) : (
            <Circle size={20} className="text-gray-300" />
          )}
          <span
            className={
              pointActif && affectesAuPoint.length > 0
                ? 'text-green-600 font-medium'
                : 'text-gray-400'
            }
          >
            3. Affectation
          </span>
        </div>
      </div>

      {/* Statistiques globales */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total élèves */}
        <div className="glass-panel p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
            <Users size={24} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Élèves</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
        </div>

        {/* Élèves affectés */}
        <div className={`glass-panel p-4 flex items-center gap-4 transition-all ${statsChanged ? 'animate-stats-update' : ''}`}>
          <div className={`w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center ${statsChanged ? 'animate-bounce-small' : ''}`}>
            <UserCheck size={24} className="text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Affectés</p>
            <p className="text-2xl font-bold text-green-600">{stats.affectes}</p>
          </div>
        </div>

        {/* Élèves non affectés */}
        <div className={`glass-panel p-4 flex items-center gap-4 transition-all ${statsChanged ? 'animate-stats-update' : ''}`}>
          <div className={`w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center ${statsChanged ? 'animate-bounce-small' : ''}`}>
            <UserX size={24} className="text-orange-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Non Affectés</p>
            <p className="text-2xl font-bold text-orange-600">{stats.nonAffectes}</p>
          </div>
        </div>

        {/* Progression */}
        <div className={`glass-panel p-4 flex items-center gap-4 transition-all ${statsChanged ? 'animate-stats-update' : ''}`}>
          <div className={`w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center ${statsChanged ? 'animate-bounce-small' : ''}`}>
            <TrendingUp size={24} className="text-purple-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-500 font-medium">Progression</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-purple-600">{stats.pourcentage}%</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-1 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  stats.pourcentage === 100
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 animate-progress-glow'
                    : 'bg-purple-600'
                }`}
                style={{ width: `${stats.pourcentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {erreur && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{erreur}</span>
        </div>
      )}

      {courses.length === 0 && (
        <div className="mb-4 p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          Aucune course n'existe encore. Créez une course et son trajet dans « Courses » et
          « Trajets », puis ajoutez-y des arrêts pour pouvoir affecter des élèves.
        </div>
      )}

      {/* Vue d'ensemble de tous les arrêts */}
      {showAllStops && courseId && points.length > 0 && (
        <div className="mb-4 glass-panel p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <MapPin size={16} className="text-blue-600" />
            Vue d'ensemble des arrêts
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {points.map((point) => {
              const nb = affectations.filter((a) => a.pointId === point.id).length;
              const pct = nb > 0 ? Math.min((nb / 40) * 100, 100) : 0;
              const color =
                pct === 0 ? 'bg-gray-100' : pct < 50 ? 'bg-yellow-100' : pct < 80 ? 'bg-orange-100' : 'bg-green-100';
              const textColor =
                pct === 0 ? 'text-gray-600' : pct < 50 ? 'text-yellow-700' : pct < 80 ? 'text-orange-700' : 'text-green-700';
              return (
                <button
                  key={point.id}
                  onClick={() => {
                    setPointActif(point);
                    setShowAllStops(false);
                  }}
                  className={`${color} ${textColor} p-3 rounded-lg text-left hover:shadow-md transition-all`}
                >
                  <div className="text-xs font-medium mb-1 truncate">{point.nom}</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-white/50 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-current transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold">{nb}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Colonne gauche : course puis arrêt */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col min-h-0">
          <h2 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
            <Route size={20} className="text-blue-600" />
            Choisir l'arrêt
          </h2>

          <select
            value={courseId}
            onChange={(e) => {
              setCourseId(e.target.value);
              setSelectedEleves(new Set());
            }}
            className="w-full mb-4 px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">— Sélectionner une course —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>

          <div className="flex-1 overflow-y-auto space-y-2">
            {!courseId && (
              <div className="text-center py-8 text-gray-400">
                <Route size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">Sélectionnez une course</p>
              </div>
            )}

            {courseId && chargementPoints && (
              <p className="text-sm text-gray-400 py-4 text-center">Chargement des arrêts…</p>
            )}

            {courseId && !chargementPoints && points.length === 0 && (
              <div className="text-sm text-amber-600 bg-amber-50 p-4 rounded-lg flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>
                  Cette course n'a aucun arrêt. Ajoutez-en dans « Trajets ».
                </span>
              </div>
            )}

            {points.map((point) => {
              const nb = affectations.filter((a) => a.pointId === point.id).length;
              const actif = pointActif?.id === point.id;
              const pct = Math.min((nb / 40) * 100, 100);
              const statusColor =
                nb === 0 ? 'text-gray-400' : pct < 50 ? 'text-yellow-600' : pct < 80 ? 'text-orange-600' : 'text-green-600';
              return (
                <button
                  key={point.id}
                  onClick={() => {
                    setPointActif(point);
                    setSelectedEleves(new Set());
                  }}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-all ${
                    actif
                      ? 'bg-blue-50 border-blue-300 shadow-md'
                      : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  <MapPin size={18} className={`shrink-0 mt-0.5 ${actif ? 'text-blue-600' : 'text-gray-400'}`} />
                  <div className="flex-1 text-left min-w-0">
                    <div className={`font-medium truncate ${actif ? 'text-blue-700' : 'text-gray-700'}`}>
                      {point.ordrePassage ? `${point.ordrePassage}. ` : ''}
                      {point.nom}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            nb === 0 ? 'bg-gray-300' : pct < 50 ? 'bg-yellow-500' : pct < 80 ? 'bg-orange-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={`text-xs font-bold ${statusColor}`}>{nb}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Colonne droite : élèves de l'arrêt + élèves à affecter */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col min-h-0">
          {!pointActif ? (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-center px-6">
              Sélectionnez un arrêt à gauche pour voir et modifier les élèves qui y montent.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap justify-between items-center gap-3 mb-4 pb-4 border-b border-gray-100">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">
                    Arrêt : <span className="text-blue-600">{pointActif.nom}</span>
                  </h2>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm text-gray-500">
                      {affectesAuPoint.length} élève{affectesAuPoint.length > 1 ? 's' : ''}
                    </span>
                    {/* Barre de progression */}
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-blue-600 transition-all"
                          style={{ width: `${Math.min((affectesAuPoint.length / 40) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400">/40</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedEleves.size > 0 && (
                    <button
                      onClick={affecterSelection}
                      disabled={enCours === 'bulk'}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      <Plus size={16} />
                      Affecter ({selectedEleves.size})
                    </button>
                  )}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Rechercher…"
                      value={recherche}
                      onChange={(e) => setRecherche(e.target.value)}
                      className="pl-9 pr-4 py-2 rounded-lg border border-gray-300 bg-gray-50 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none w-48"
                    />
                    <Search size={16} className="absolute left-3 top-3 text-gray-400" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-0">
                {/* Déjà affectés à cet arrêt - ZONE DE DROP */}
                <div
                  className="flex flex-col min-h-0"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <h3 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                    <CheckCircle2 size={16} className={draggedEleve ? 'text-blue-600 animate-bounce-small' : 'text-green-600'} />
                    <span>Montent à cet arrêt</span>
                    {draggedEleve && (
                      <span className="ml-auto text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-700 animate-pulse">
                        Zone de dépôt active
                      </span>
                    )}
                  </h3>
                  <div
                    className={`flex-1 overflow-y-auto p-3 rounded-lg border-2 border-dashed transition-all relative ${
                      draggedEleve
                        ? 'border-blue-500 bg-blue-50 shadow-lg animate-drop-zone-pulse'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    {draggedEleve && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 bg-blue-50/90 backdrop-blur-sm rounded-lg">
                        <div className="text-center animate-bounce-small">
                          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-blue-500 flex items-center justify-center">
                            <Plus size={32} className="text-white" />
                          </div>
                          <p className="text-lg font-bold text-blue-700">Déposez {nomComplet(draggedEleve)} ici</p>
                          <p className="text-sm text-blue-600 mt-1">pour l'affecter à {pointActif?.nom}</p>
                        </div>
                      </div>
                    )}
                    {affectesAuPoint.length === 0 && !draggedEleve ? (
                      <p className="text-sm text-gray-400 py-4 text-center">
                        Aucun élève affecté
                      </p>
                    ) : !draggedEleve && (
                      <ul className="space-y-2">
                        {affectesAuPoint.map((a) => (
                          <li
                            key={a.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border shadow-sm hover:shadow transition-all ${
                              recentlyAffected.has(a.childId)
                                ? 'border-green-400 bg-green-50 animate-success-pulse'
                                : 'border-green-100 bg-white'
                            }`}
                          >
                            <CheckCircle2 size={18} className={`shrink-0 ${recentlyAffected.has(a.childId) ? 'text-green-600 animate-bounce-small' : 'text-green-600'}`} />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 truncate">
                                {nomComplet(a.child)}
                              </div>
                              <div className="text-xs text-gray-500">
                                {a.child?.className ?? 'Classe non renseignée'}
                                {a.child?.empCode ? ` · ${a.child.empCode}` : ''}
                              </div>
                            </div>
                            <button
                              onClick={() => desaffecter(a)}
                              disabled={enCours === a.id}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
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

                {/* Élèves encore libres - DRAGGABLE */}
                <div className="flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                      <Users size={16} className="text-gray-600" />
                      <span>Élèves sans arrêt ({elevesDisponibles.length})</span>
                      {elevesDisponibles.length > 0 && (
                        <span className="text-xs font-normal px-2 py-1 rounded-full bg-gray-200 text-gray-600 flex items-center gap-1">
                          <GripVertical size={12} />
                          Glissez pour affecter
                        </span>
                      )}
                    </h3>
                    {elevesDisponibles.length > 0 && (
                      <button
                        onClick={() => {
                          if (selectedEleves.size === elevesDisponibles.length) {
                            setSelectedEleves(new Set());
                          } else {
                            setSelectedEleves(new Set(elevesDisponibles.map((e) => e.id)));
                          }
                        }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {selectedEleves.size === elevesDisponibles.length
                          ? 'Tout désélectionner'
                          : 'Tout sélectionner'}
                      </button>
                    )}
                  </div>
                  {nbAffectesAilleurs > 0 && (
                    <p className="text-xs text-gray-400 mb-2">
                      {nbAffectesAilleurs} élève{nbAffectesAilleurs > 1 ? 's' : ''} déjà placé{nbAffectesAilleurs > 1 ? 's' : ''} ailleurs
                    </p>
                  )}
                  <div className="flex-1 overflow-y-auto p-3 rounded-lg bg-gray-50">
                    {eleves.length === 0 ? (
                      <p className="text-sm text-gray-400 py-4 text-center">
                        Aucun élève enregistré. Ajoutez-les depuis « Élèves ».
                      </p>
                    ) : elevesDisponibles.length === 0 ? (
                      <p className="text-sm text-gray-400 py-4 text-center">
                        {recherche
                          ? 'Aucun élève ne correspond.'
                          : 'Tous les élèves sont affectés.'}
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {elevesDisponibles.map((e) => (
                          <li
                            key={e.id}
                            draggable
                            onDragStart={(ev) => handleDragStart(ev, e)}
                            onDragEnd={() => setDraggedEleve(null)}
                            className={`flex items-center gap-3 p-3 rounded-lg border bg-white transition-all ${
                              draggedEleve?.id === e.id
                                ? 'border-blue-400 opacity-30 scale-95 cursor-grabbing'
                                : selectedEleves.has(e.id)
                                ? 'border-blue-300 bg-blue-50 cursor-grab hover:shadow-lg'
                                : 'border-gray-200 cursor-grab hover:shadow-lg hover:border-blue-200'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedEleves.has(e.id)}
                              onChange={() => toggleSelectEleve(e.id)}
                              className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                              onClick={(ev) => ev.stopPropagation()}
                            />
                            <div className="drag-handle p-1 rounded hover:bg-gray-100 transition-colors">
                              <GripVertical size={18} className="text-gray-400 shrink-0" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 truncate">
                                {nomComplet(e)}
                              </div>
                              <div className="text-xs text-gray-500">
                                {e.className ?? 'Classe non renseignée'}
                                {e.empCode ? ` · ${e.empCode}` : ''}
                              </div>
                            </div>
                            <button
                              onClick={() => affecter(e)}
                              disabled={enCours === e.id}
                              className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-40"
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

      {/* Confetti Animation */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-40 flex items-center justify-center">
          <div className="confetti-container">
            {[...Array(30)].map((_, i) => (
              <div
                key={i}
                className="confetti"
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 0.5}s`,
                  backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'][Math.floor(Math.random() * 5)],
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
