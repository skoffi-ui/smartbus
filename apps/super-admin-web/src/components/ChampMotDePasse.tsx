import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface ChampMotDePasseProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  className?: string;
  id?: string;
}

/**
 * Champ mot de passe avec bouton "afficher/masquer" — reprend le motif déjà
 * en place dans Settings.tsx (onglet Sécurité), désormais réutilisable pour
 * tous les champs mot de passe de la console (ex: Login.tsx).
 */
export default function ChampMotDePasse({
  value,
  onChange,
  placeholder,
  required,
  minLength,
  className = 'form-input pr-12',
  id,
}: ChampMotDePasseProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        className={className}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        title={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        aria-label={
          visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
        }
        className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-300 hover:text-white"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
