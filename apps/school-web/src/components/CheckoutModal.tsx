import React, { useState } from 'react';
import { X, CreditCard, DollarSign, ShieldAlert, Check } from 'lucide-react';
import axios from 'axios';
import { GATEWAY_URL } from '../config';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CheckoutModal({ isOpen, onClose }: CheckoutModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<'STARTER' | 'PREMIUM'>('STARTER');
  const [paymentMethod, setPaymentMethod] = useState<'orange' | 'mtn' | 'wave' | 'card'>('orange');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const getAmount = () => (selectedPlan === 'STARTER' ? 50000 : 100000);

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('accessToken');
      // Appel direct de l'API de facturation globale (Super-App port 3000)
      const response = await axios.post(`${GATEWAY_URL}/api/v1/payments/initiate`, {
        plan: selectedPlan,
        amount: getAmount(),
        method: paymentMethod
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data && response.data.checkoutUrl) {
        // Redirection externe vers le guichet de paiement (réel ou simulé)
        window.location.href = response.data.checkoutUrl;
      } else {
        throw new Error('Impossible de générer le lien de paiement.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Une erreur est survenue.');
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.6)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem',
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '500px',
        padding: '2rem',
        position: 'relative',
        animation: 'fadeIn 0.25s ease',
      }}>
        {/* Close Button */}
        <button onClick={onClose} style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
        }}>
          <X size={20} />
        </button>

        {/* Title */}
        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '2.5rem', height: '2.5rem', borderRadius: '50%',
            background: 'rgba(79, 70, 229, 0.1)', color: 'var(--accent-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <DollarSign size={20} />
          </div>
          <div>
            <h3 className="text-xl" style={{ margin: 0, fontWeight: 700 }}>Abonnement SmartBus</h3>
            <p className="text-sm text-secondary" style={{ margin: 0 }}>Renouvelez ou modifiez le forfait de votre école</p>
          </div>
        </div>

        {error && (
          <div className="glass-panel" style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: 'var(--danger)',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.875rem'
          }}>
            <ShieldAlert size={16} /> {error}
          </div>
        )}

        <form onSubmit={handlePaymentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Plan Selection */}
          <div>
            <label className="text-xs font-semibold text-secondary uppercase tracking-wider block mb-2">1. Sélectionnez votre forfait</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div 
                onClick={() => setSelectedPlan('STARTER')}
                className={`glass-panel cursor-pointer flex justify-between items-center`}
                style={{
                  padding: '1rem',
                  border: selectedPlan === 'STARTER' ? '2px solid var(--accent-primary)' : '1px solid var(--glass-border)',
                  background: selectedPlan === 'STARTER' ? 'rgba(79, 70, 229, 0.05)' : 'transparent',
                  transition: 'all 0.2s',
                  borderRadius: 'var(--radius-md)'
                }}
              >
                <div>
                  <h4 style={{ margin: 0, fontWeight: 600 }}>STARTER</h4>
                  <p className="text-xs text-secondary" style={{ margin: '0.2rem 0 0 0' }}>Jusqu'à 2 bus et 60 élèves</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 700 }}>50.000 FCFA</span>
                  {selectedPlan === 'STARTER' && <Check size={16} className="text-accent" />}
                </div>
              </div>

              <div 
                onClick={() => setSelectedPlan('PREMIUM')}
                className={`glass-panel cursor-pointer flex justify-between items-center`}
                style={{
                  padding: '1rem',
                  border: selectedPlan === 'PREMIUM' ? '2px solid var(--accent-primary)' : '1px solid var(--glass-border)',
                  background: selectedPlan === 'PREMIUM' ? 'rgba(79, 70, 229, 0.05)' : 'transparent',
                  transition: 'all 0.2s',
                  borderRadius: 'var(--radius-md)'
                }}
              >
                <div>
                  <h4 style={{ margin: 0, fontWeight: 600 }}>PREMIUM</h4>
                  <p className="text-xs text-secondary" style={{ margin: '0.2rem 0 0 0' }}>Bus illimités et suivi avancé</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 700 }}>100.000 FCFA</span>
                  {selectedPlan === 'PREMIUM' && <Check size={16} className="text-accent" />}
                </div>
              </div>
            </div>
          </div>

          {/* Payment Method Selection */}
          <div>
            <label className="text-xs font-semibold text-secondary uppercase tracking-wider block mb-2">2. Mode de paiement local</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div 
                onClick={() => setPaymentMethod('orange')}
                style={{
                  padding: '0.75rem',
                  textAlign: 'center',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  border: paymentMethod === 'orange' ? '2px solid #f97316' : '1px solid var(--glass-border)',
                  background: paymentMethod === 'orange' ? 'rgba(249, 115, 22, 0.08)' : 'transparent',
                  color: paymentMethod === 'orange' ? '#f97316' : 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  transition: 'all 0.2s'
                }}
              >
                🍊 Orange Money
              </div>
              
              <div 
                onClick={() => setPaymentMethod('mtn')}
                style={{
                  padding: '0.75rem',
                  textAlign: 'center',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  border: paymentMethod === 'mtn' ? '2px solid #eab308' : '1px solid var(--glass-border)',
                  background: paymentMethod === 'mtn' ? 'rgba(234, 179, 8, 0.08)' : 'transparent',
                  color: paymentMethod === 'mtn' ? '#eab308' : 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  transition: 'all 0.2s'
                }}
              >
                💛 MTN Money
              </div>

              <div 
                onClick={() => setPaymentMethod('wave')}
                style={{
                  padding: '0.75rem',
                  textAlign: 'center',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  border: paymentMethod === 'wave' ? '2px solid #3b82f6' : '1px solid var(--glass-border)',
                  background: paymentMethod === 'wave' ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                  color: paymentMethod === 'wave' ? '#3b82f6' : 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  transition: 'all 0.2s'
                }}
              >
                🌊 Wave Money
              </div>

              <div 
                onClick={() => setPaymentMethod('card')}
                style={{
                  padding: '0.75rem',
                  textAlign: 'center',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  border: paymentMethod === 'card' ? '2px solid #64748b' : '1px solid var(--glass-border)',
                  background: paymentMethod === 'card' ? 'rgba(100, 116, 139, 0.08)' : 'transparent',
                  color: paymentMethod === 'card' ? '#64748b' : 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.25rem'
                }}
              >
                <CreditCard size={14} /> Carte Visa / Prépayée
              </div>
            </div>
          </div>

          {/* Action Button */}
          <button 
            type="submit" 
            disabled={loading}
            className="btn-primary" 
            style={{ width: '100%', padding: '1rem', fontWeight: 700 }}
          >
            {loading ? 'Redirection vers la passerelle sécurisée...' : `Payer ${getAmount().toLocaleString()} FCFA`}
          </button>
        </form>
      </div>
    </div>
  );
}
