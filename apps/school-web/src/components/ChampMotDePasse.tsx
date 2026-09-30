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
 * en place pour le mot de passe actuel dans Settings.tsx, désormais
 * réutilisable pour tous les champs mot de passe de l'app (inscription,
 * activation, connexion...).
 */
export default function ChampMotDePasse({
  value,
  onChange,
  placeholder,
  required,
  minLength,
  className = 'form-input',
  id,
}: ChampMotDePasseProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        className={className}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        style={{ paddingRight: '2.5rem' }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        title={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        aria-label={
          visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
        }
        style={{
          position: 'absolute',
          right: '0.75rem',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          display: 'flex',
          padding: 0,
        }}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
