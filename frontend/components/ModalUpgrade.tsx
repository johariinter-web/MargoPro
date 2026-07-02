'use client';

const WA_URL = 'https://wa.me/22996116003?text=Bonjour%2C+je+veux+passer+au+Premium+MargoPro.';

interface Props {
  onClose: () => void;
}

export function ModalUpgrade({ onClose }: Props) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(28,24,17,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Manrope, sans-serif', padding: 20,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#fff', borderRadius: 20, padding: '32px 24px',
        maxWidth: 340, width: '100%', textAlign: 'center',
      }}>
        <div style={{ fontSize: 42, marginBottom: 12 }}>⭐</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#1C1811', marginBottom: 10 }}>
          Passer au Premium
        </div>
        <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 24, lineHeight: 1.7 }}>
          Le paiement en ligne arrive bientôt !{'\n'}Pour passer au Premium maintenant, contactez-nous sur WhatsApp.
        </div>
        <a
          href={WA_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            height: 52, borderRadius: 14,
            background: '#25D366', color: 'white',
            fontWeight: 700, fontSize: 15, textDecoration: 'none',
            marginBottom: 12,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.524 3.655 1.435 5.16L2 22l4.981-1.404A9.96 9.96 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" fillRule="evenodd" clipRule="evenodd"/>
          </svg>
          Contacter sur WhatsApp
        </a>
        <button
          onClick={onClose}
          style={{
            width: '100%', height: 44, borderRadius: 12,
            background: '#F3F4F6', border: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: 14, color: '#6B7280',
          }}
        >
          Fermer
        </button>
      </div>
    </div>
  );
}
