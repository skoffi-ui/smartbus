import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Users,
  Phone,
  Mail,
  Key,
  Calendar,
  Bus,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import './ChildProfile.css';
import api, { messageFromError } from '../services/api';

export default function ChildProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [child, setChild] = useState<any>(null);
  const [punches, setPunches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState('');

  // Group punches by date for better display (MUST BE BEFORE EARLY RETURNS)
  const groupedPunches = React.useMemo(() => {
    const groups: Record<string, { date: string; punches: any[] }> = {};
    punches.forEach((p) => {
      if (!groups[p.date]) {
        groups[p.date] = { date: p.date, punches: [] };
      }
      groups[p.date].punches.push(p);
    });
    // Sort groups by date descending
    return Object.values(groups).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [punches]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // 1. Fetch child details
        const childRes = await api.get(`/children/${id}`);
        setChild(childRes.data);

        // 2. Fetch punch history (using the new endpoint) — informations d'appoint :
        // son absence ne doit pas empêcher d'afficher la fiche de l'élève.
        try {
          const punchesRes = await api.get(`/children/${id}/punches`);
          setPunches(punchesRes.data);
        } catch (err) {
          console.warn(
            'Historique de pointages non chargé :',
            messageFromError(err),
          );
        }
      } catch (err) {
        setErreur(
          messageFromError(err, "Impossible de charger la fiche de l'élève."),
        );
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [id]);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">
        Chargement de la fiche élève...
      </div>
    );
  }

  if (erreur || !child) {
    return (
      <div className="p-8 text-center text-red-500">
        {erreur || 'Élève introuvable.'}
      </div>
    );
  }

  // Generate last 30 days for the heatmap
  const heatmapDays = Array.from({ length: 30 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return d;
  });

  const getDayStatus = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const dayPunches = punches.filter((p) => p.date === dateStr);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    if (dayPunches.length >= 2) return 'perfect'; // Montée + Descente
    if (dayPunches.length === 1) return 'partial'; // Seulement Montée ou Descente
    if (isWeekend) return 'weekend';
    // If it's today and no punch yet, don't mark as absent if it's early
    if (dateStr === new Date().toISOString().split('T')[0]) return 'today';
    return 'absent';
  };

  const statusColors: Record<string, string> = {
    perfect: 'bg-emerald-500',
    partial: 'bg-amber-400',
    absent: 'bg-rose-500',
    weekend: 'bg-slate-200',
    today: 'bg-slate-300',
  };

  return (
    <div className="profile-container">
      {/* Header */}
      <button
        onClick={() => navigate('/children')}
        className="profile-back-btn"
      >
        <ArrowLeft size={18} /> Retour à la liste
      </button>

      <div className="profile-grid">
        {/* Left Column: Profile Info */}
        <div>
          {/* Child Card */}
          <div className="profile-card">
            <div className="profile-card-header"></div>

            <div className="profile-avatar-container">
              <div className="profile-avatar">
                {child.photoUrl ? (
                  <img
                    src={child.photoUrl}
                    alt={`${child.firstName} ${child.lastName}`}
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <User size={40} color="var(--accent-primary)" />
                )}
              </div>

              <h1 className="profile-name">
                {child.firstName} {child.lastName}
              </h1>
              <p className="profile-class">
                {child.className || 'Classe non assignée'}
              </p>

              {child.empCode ? (
                <span className="badge-tag badge-success">
                  <Key size={14} /> Matricule: {child.empCode}
                </span>
              ) : (
                <span className="badge-tag badge-warning">
                  <AlertTriangle size={14} /> Aucun badge assigné
                </span>
              )}
            </div>
          </div>

          {/* Parent Card */}
          <div className="profile-card">
            <h3 className="section-title">
              <Users size={20} color="var(--accent-primary)" /> Contact Parent
            </h3>

            {child.parent ? (
              <div>
                <div className="parent-info-group">
                  <div
                    style={{
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      marginBottom: '0.25rem',
                    }}
                  >
                    {child.parent.firstName} {child.parent.lastName}
                  </div>
                  <div
                    style={{
                      fontSize: '0.85rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Responsable légal
                  </div>
                </div>

                <div className="parent-info-row">
                  <Phone size={16} color="var(--accent-primary)" />
                  <span style={{ fontWeight: 600 }}>{child.parent.phone}</span>
                </div>

                <div className="parent-info-row">
                  <Mail size={16} color="var(--accent-primary)" />
                  <span>{child.parent.email || 'Non renseigné'}</span>
                </div>

                <a
                  href={`https://wa.me/${child.parent.phone.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="whatsapp-btn"
                >
                  Ouvrir WhatsApp
                </a>
              </div>
            ) : (
              <div
                style={{
                  textAlign: 'center',
                  padding: '2rem 0',
                  color: 'var(--text-secondary)',
                }}
              >
                Aucun parent associé à cet enfant.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Activity & Heatmap */}
        <div>
          {/* Heatmap Card */}
          <div className="profile-card">
            <h3 className="section-title">
              <Calendar size={20} color="var(--accent-primary)" /> Calendrier de
              Présence
            </h3>
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '0.9rem',
                marginBottom: '1.5rem',
              }}
            >
              Historique des 30 derniers jours
            </p>

            {/* Heatmap Grid */}
            <div className="heatmap-grid">
              {heatmapDays.map((date, idx) => {
                const status = getDayStatus(date);
                return (
                  <div
                    key={idx}
                    className={`heatmap-cell hm-${status}`}
                    title={`${date.toLocaleDateString('fr-FR')} - ${status}`}
                  ></div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="heatmap-legend">
              <div className="legend-item">
                <div className="legend-color hm-perfect"></div> Présent
                (Aller/Retour)
              </div>
              <div className="legend-item">
                <div className="legend-color hm-partial"></div> Partiel (1
                trajet)
              </div>
              <div className="legend-item">
                <div className="legend-color hm-absent"></div> Absent
              </div>
              <div className="legend-item">
                <div className="legend-color hm-weekend"></div> Week-end
              </div>
            </div>
          </div>

          {/* Detailed Activity Log */}
          <div className="profile-card">
            <h3 className="section-title">
              <Clock size={20} color="var(--accent-primary)" /> Journal
              d'Activité
            </h3>

            {groupedPunches.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '3rem 0',
                  color: 'var(--text-secondary)',
                }}
              >
                Aucun historique de pointage pour le moment.
              </div>
            ) : (
              <div className="timeline">
                {groupedPunches.slice(0, 10).map((dayGroup, idx) => {
                  const montees = dayGroup.punches
                    .filter((p) => p.stateLabel === 'MONTÉE')
                    .sort((a, b) => a.time.localeCompare(b.time));
                  const descentes = dayGroup.punches
                    .filter((p) => p.stateLabel === 'DESCENTE')
                    .sort((a, b) => a.time.localeCompare(b.time));

                  return (
                    <div key={idx} className="day-group">
                      <div className="day-group-header">
                        <Calendar size={16} color="var(--accent-primary)" />
                        {new Date(dayGroup.date).toLocaleDateString('fr-FR', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </div>

                      <div className="day-group-content">
                        {/* MONTÉES */}
                        <div className="punch-column montee-col">
                          <h4 className="punch-col-title">
                            <CheckCircle size={14} /> Montée (Aller)
                          </h4>
                          {montees.length > 0 ? (
                            montees.map((m, i) => (
                              <div key={i} className="punch-item">
                                <span className="punch-time">{m.time}</span>
                                <span className="punch-bus">
                                  <Bus size={12} /> {m.terminal}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="punch-empty">Aucun pointage</div>
                          )}
                        </div>

                        {/* DESCENTES */}
                        <div className="punch-column descente-col">
                          <h4 className="punch-col-title">
                            <ArrowLeft
                              size={14}
                              style={{ transform: 'rotate(-45deg)' }}
                            />{' '}
                            Descente (Retour)
                          </h4>
                          {descentes.length > 0 ? (
                            descentes.map((d, i) => (
                              <div key={i} className="punch-item">
                                <span className="punch-time">{d.time}</span>
                                <span className="punch-bus">
                                  <Bus size={12} /> {d.terminal}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="punch-empty">Aucun pointage</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
