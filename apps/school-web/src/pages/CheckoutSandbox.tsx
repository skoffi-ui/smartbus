import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CreditCard, Phone, CheckCircle, XCircle, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react';
import { GATEWAY_URL } from '../config';

export default function CheckoutSandbox() {
  const [searchParams] = useSearchParams();
  const paymentId = searchParams.get('paymentId') || '';
  const amount = parseInt(searchParams.get('amount') || '0', 10);
  const schoolName = decodeURIComponent(searchParams.get('schoolName') || 'École SMARTBUS');
  const method = searchParams.get('method') || 'orange';

  const [step, setStep] = useState(1); // 1: Info, 2: OTP, 3: Success, 4: Error
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [loading, setLoading] = useState(false);

  const getMethodDetails = () => {
    switch (method.toLowerCase()) {
      case 'orange':
        return { name: 'Orange Money Côte d\'Ivoire', color: 'from-orange-500 to-amber-600', icon: '🍊', placeholder: '07 XX XX XX XX' };
      case 'mtn':
        return { name: 'MTN Mobile Money', color: 'from-yellow-400 to-yellow-600', icon: '💛', placeholder: '05 XX XX XX XX' };
      case 'wave':
        return { name: 'Wave Côte d\'Ivoire', color: 'from-sky-400 to-blue-500', icon: '🌊', placeholder: '07 XX XX XX XX' };
      case 'card':
        return { name: 'Carte Bancaire / Prépayée', color: 'from-slate-700 to-slate-900', icon: '💳', placeholder: 'Saisissez votre numéro de carte' };
      default:
        return { name: 'Paiement Mobile', color: 'from-brand-500 to-brand-700', icon: '📱', placeholder: 'Numéro de téléphone' };
    }
  };

  const details = getMethodDetails();

  const handleInitiateOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (method === 'card') {
        // Direct validation for card to step 3
        handleConfirmPayment('success');
      } else {
        setStep(2); // Go to OTP
      }
    }, 1500);
  };

  const handleConfirmPayment = async (status: 'success' | 'failed') => {
    setLoading(true);
    try {
      const transactionId = `${method.toUpperCase()}_TXN_${Math.floor(Math.random() * 10000000)}`;
      const res = await fetch(`${GATEWAY_URL}/api/v1/payments/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId,
          status,
          transactionId,
        }),
      });

      if (res.ok) {
        setStep(status === 'success' ? 3 : 4);
      } else {
        setStep(4);
      }
    } catch (err) {
      console.error(err);
      setStep(4);
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    // Redirige vers le dashboard de l'école
    window.location.href = 'http://localhost:5174/dashboard';
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center p-4 font-sans text-white bg-[url('https://horizon-ui.com/horizon-tailwind-react/static/media/background.ed80b6fb.png')] bg-cover bg-no-repeat bg-fixed">
      <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-8 flex flex-col gap-6 relative overflow-hidden">
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/10 rounded-full blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl"></div>

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold bg-gradient-to-r from-brand-400 to-blue-400 bg-clip-text text-transparent">SMARTPAY</span>
            <span className="bg-white/10 text-xs px-2 py-0.5 rounded-full text-brand-300 font-bold uppercase tracking-wider">Sandbox</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
            <ShieldCheck size={14} /> Sécurisé
          </div>
        </div>

        {/* Steps */}
        {step === 1 && (
          <form onSubmit={handleInitiateOtp} className="flex flex-col gap-5">
            <div>
              <p className="text-navy-300 text-sm">Établissement bénéficiaire</p>
              <h3 className="text-lg font-bold text-white mt-0.5">{schoolName}</h3>
            </div>

            <div className={`p-4 rounded-2xl bg-gradient-to-r ${details.color} flex justify-between items-center shadow-lg`}>
              <div>
                <p className="text-white/70 text-xs font-medium">Forfait SMARTBUS</p>
                <h4 className="text-xl font-black mt-0.5">{amount.toLocaleString()} FCFA</h4>
              </div>
              <span className="text-3xl">{details.icon}</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-navy-300 uppercase tracking-wider">Mode sélectionné</label>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 font-bold text-sm text-white">
                {details.name}
              </div>
            </div>

            {method === 'card' ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-navy-300 uppercase tracking-wider">Numéro de carte</label>
                  <div className="relative">
                    <input
                      required
                      type="text"
                      maxLength={19}
                      placeholder="4000 1234 5678 9010"
                      value={cardNumber}
                      onChange={e => setCardNumber(e.target.value.replace(/[^\d\s]/g, ''))}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white placeholder-navy-500 outline-none focus:border-brand-500 transition-all font-mono"
                    />
                    <CreditCard className="absolute right-4 top-4 text-navy-400" size={20} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-navy-300 uppercase tracking-wider">Expiration</label>
                    <input
                      required
                      type="text"
                      maxLength={5}
                      placeholder="MM/YY"
                      value={expiry}
                      onChange={e => setExpiry(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white placeholder-navy-500 outline-none focus:border-brand-500 transition-all text-center font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-navy-300 uppercase tracking-wider">CVV</label>
                    <input
                      required
                      type="password"
                      maxLength={3}
                      placeholder="123"
                      value={cvv}
                      onChange={e => setCvv(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white placeholder-navy-500 outline-none focus:border-brand-500 transition-all text-center font-mono"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-navy-300 uppercase tracking-wider">Numéro de téléphone</label>
                <div className="relative">
                  <input
                    required
                    type="tel"
                    placeholder={details.placeholder}
                    value={phoneNumber}
                    onChange={e => setPhoneNumber(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white placeholder-navy-500 outline-none focus:border-brand-500 transition-all font-semibold"
                  />
                  <Phone className="absolute right-4 top-4 text-navy-400" size={20} />
                </div>
                <p className="text-[10px] text-navy-400 leading-normal mt-1">Vous allez recevoir une demande d'autorisation de débit sur votre téléphone après validation.</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 rounded-2xl font-bold bg-gradient-to-r ${details.color} hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-black/20`}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Initialisation sécurisée...
                </>
              ) : (
                <>
                  Suivant
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-5">
            <div className="text-center">
              <span className="text-4xl animate-bounce inline-block">📲</span>
              <h3 className="text-lg font-bold text-white mt-3">Saisie du code OTP</h3>
              <p className="text-xs text-navy-300 mt-1">Saisissez le code de sécurité reçu par SMS ou généré via le code de paiement pour valider la transaction.</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-navy-300 uppercase tracking-wider text-center">Code secret de paiement / OTP</label>
              <input
                required
                type="text"
                maxLength={6}
                placeholder="Ex: 123456"
                value={otp}
                onChange={e => setOtp(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white placeholder-navy-500 outline-none focus:border-brand-500 transition-all text-center tracking-widest text-xl font-bold font-mono"
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => handleConfirmPayment('failed')}
                disabled={loading}
                className="flex-1 py-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 font-bold hover:bg-red-500/20 transition-all"
              >
                Simuler Échec
              </button>
              <button
                onClick={() => handleConfirmPayment('success')}
                disabled={loading || otp.length < 4}
                className="flex-1 py-4 rounded-2xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : 'Confirmer'}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col items-center text-center gap-4 py-4 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <CheckCircle size={36} />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-white">Paiement Réussi !</h3>
              <p className="text-sm text-navy-300 mt-2">Votre abonnement a été activé et votre école est maintenant opérationnelle.</p>
            </div>
            <button
              onClick={handleFinish}
              className="w-full py-4 rounded-2xl bg-brand-500 text-white font-bold hover:bg-brand-400 transition-all mt-4"
            >
              Retourner au Dashboard
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col items-center text-center gap-4 py-4 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/30">
              <XCircle size={36} />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-white">Échec du Paiement</h3>
              <p className="text-sm text-navy-300 mt-2">La transaction a été refusée par l'opérateur ou le code OTP entré est invalide.</p>
            </div>
            <div className="flex gap-4 w-full mt-4">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-4 rounded-2xl border border-white/10 hover:bg-white/5 transition-all text-sm font-semibold"
              >
                Réessayer
              </button>
              <button
                onClick={handleFinish}
                className="flex-1 py-4 rounded-2xl bg-red-600 text-white font-bold hover:bg-red-500 transition-all text-sm"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
