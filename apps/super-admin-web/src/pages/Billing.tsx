import React, { useState, useEffect } from 'react';
import { DollarSign, Activity, AlertCircle, FileText } from 'lucide-react';

export default function Billing() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPayments = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('http://localhost:3000/api/v1/payments', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Erreur réseau');
      const data = await res.json();
      setPayments(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  if (loading) return <div className="text-center text-navy-300 py-10">Chargement de la facturation...</div>;
  if (error) return <div className="text-red-500 py-10">Erreur : {error}</div>;

  // Calcul des statistiques
  const totalRevenue = payments.filter(p => p.status === 'success').reduce((acc, curr) => acc + curr.amount, 0);
  const successfulTransactions = payments.filter(p => p.status === 'success').length;
  const failedTransactions = payments.filter(p => p.status !== 'success').length;

  const getMethodBadge = (method: string) => {
    switch (method?.toLowerCase()) {
      case 'orange_money':
        return <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2.5 py-1 rounded-md text-xs font-bold">🍊 Orange Money</span>;
      case 'mtn_money':
        return <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2.5 py-1 rounded-md text-xs font-bold">💛 MTN Money</span>;
      case 'wave':
        return <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-md text-xs font-bold">🌊 Wave</span>;
      case 'prepaid_card':
        return <span className="bg-slate-500/10 text-slate-400 border border-slate-500/20 px-2.5 py-1 rounded-md text-xs font-bold">💳 Carte Prépayée</span>;
      default:
        return <span className="bg-white/5 px-2.5 py-1 rounded-md border border-white/10 uppercase text-xs">{method}</span>;
    }
  };

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      
      {/* Section En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-white">Facturation & Revenus</h1>
        <p className="text-navy-300 mt-1">Supervisez l'état financier des abonnements des écoles.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
            <DollarSign size={28} />
          </div>
          <div>
            <p className="text-sm font-medium text-navy-300">Revenus Totaux</p>
            <h4 className="text-2xl font-bold text-white">{totalRevenue.toLocaleString()} FCFA</h4>
          </div>
        </div>

        <div className="glass-panel p-6 flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
            <Activity size={28} />
          </div>
          <div>
            <p className="text-sm font-medium text-navy-300">Transactions Réussies</p>
            <h4 className="text-2xl font-bold text-white">{successfulTransactions}</h4>
          </div>
        </div>

        <div className="glass-panel p-6 flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-red-500/20 flex items-center justify-center text-red-400">
            <AlertCircle size={28} />
          </div>
          <div>
            <p className="text-sm font-medium text-navy-300">Échecs ou En attente</p>
            <h4 className="text-2xl font-bold text-white">{failedTransactions}</h4>
          </div>
        </div>
      </div>

      {/* Tableau des Transactions */}
      <div className="glass-panel p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Dernières Transactions</h2>
          <button className="btn-secondary flex items-center gap-2 text-sm">
            <FileText size={16} /> Exporter
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-navy-300 text-sm">
                <th className="pb-4 font-semibold">Date</th>
                <th className="pb-4 font-semibold">Client (École)</th>
                <th className="pb-4 font-semibold">Montant</th>
                <th className="pb-4 font-semibold">Méthode</th>
                <th className="pb-4 font-semibold">Référence</th>
                <th className="pb-4 font-semibold text-right">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {payments.map(payment => (
                <tr key={payment.id} className="hover:bg-white/5 transition-colors group">
                  <td className="py-4 text-sm text-navy-300">
                    {new Date(payment.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-4">
                    <div className="font-bold text-white">{payment.organisation?.name || 'École Inconnue'}</div>
                    <div className="text-xs text-navy-300">CODE: {payment.organisation?.code || 'N/A'}</div>
                  </td>
                  <td className="py-4">
                    <div className="font-bold text-white">{payment.amount.toLocaleString()} {payment.currency}</div>
                  </td>
                  <td className="py-4 text-sm text-navy-300">
                    {getMethodBadge(payment.method)}
                  </td>
                  <td className="py-4 text-xs font-mono text-navy-300">
                    {payment.externalReference || '-'}
                  </td>
                  <td className="py-4 text-right">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      payment.status === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {payment.status === 'success' ? 'Succès' : payment.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-navy-300">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <DollarSign size={40} className="opacity-20" />
                      <p>Aucune transaction enregistrée pour le moment.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
