'use client';

import { useRouter } from 'next/navigation';

const T = {
  accent: '#D4601A',
  bg: '#FAF7F3',
  surface: '#FFFFFF',
  text: '#1C1811',
  textSub: '#6A5D52',
  textMuted: '#9E8E84',
  border: '#E6DDD3',
};

export default function PolitiqueConfidentialitePage() {
  const router = useRouter();

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, fontFamily: 'Manrope, sans-serif', paddingBottom: 48 }}>

      {/* HEADER */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10 }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke={T.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 style={{ fontSize: 17, fontWeight: 700, color: T.text, margin: 0 }}>Politique de confidentialité</h1>
      </div>

      <div style={{ padding: '24px 20px', maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 28 }}>

        <div>
          <p style={{ fontSize: 13, color: T.textMuted, margin: 0 }}>Dernière mise à jour : 4 septembre 2026</p>
          <p style={{ fontSize: 14, color: T.textSub, lineHeight: 1.7, marginTop: 12 }}>
            Cette page explique quelles informations <strong style={{ color: T.text }}>MargoPro</strong> collecte, pourquoi, et comment elles sont protégées. On a essayé de l&apos;écrire simplement, sans jargon juridique.
          </p>
        </div>

        <Section title="1. Quelles informations nous collectons">
          Pour créer un compte : votre adresse email ou votre numéro de téléphone, et un mot de passe (ou, si vous utilisez "Continuer avec Google", votre nom et votre adresse email fournis par Google).{'\n\n'}
          Pour votre boutique : le nom de votre commerce et votre devise, saisis à la création du compte.{'\n\n'}
          Pour faire fonctionner l&apos;application : vos produits (nom, prix, quantités, photos), vos ventes, vos dépenses et pertes de stock, et éventuellement les noms et numéros de vos propres clients si vous choisissez de les enregistrer (ex : suivi des crédits).{'\n\n'}
          Nous ne demandons jamais votre localisation, vos contacts téléphoniques, ni l&apos;accès à d&apos;autres applications sur votre téléphone.
        </Section>

        <Section title="2. Comment ces informations sont utilisées">
          Uniquement pour faire fonctionner MargoPro : afficher votre stock, calculer vos marges et bénéfices, enregistrer vos ventes, et vous permettre de retrouver vos données si vous changez de téléphone.{'\n\n'}
          Nous n&apos;utilisons jamais vos données commerciales à des fins publicitaires, et nous ne les analysons pas à titre individuel. Nous consultons parfois des statistiques globales et anonymes (ex : nombre d&apos;inscriptions) pour améliorer l&apos;application, jamais le détail du compte d&apos;un commerçant précis, sauf à sa demande dans le cadre d&apos;une assistance.
        </Section>

        <Section title="3. Où vos données sont stockées">
          Vos données sont d&apos;abord enregistrées directement sur votre téléphone, ce qui permet à MargoPro de fonctionner sans connexion internet.{'\n\n'}
          Dès la création de votre compte, une copie sécurisée est aussi sauvegardée en ligne chez notre prestataire d&apos;hébergement de base de données, Supabase, pour vous protéger en cas de perte ou de panne de votre téléphone. Chaque commerçant n&apos;a accès qu&apos;à ses propres données : il est techniquement impossible pour un autre utilisateur de consulter votre stock ou vos ventes.
        </Section>

        <Section title="4. Les services tiers que nous utilisons">
          Pour faire fonctionner MargoPro, certaines informations transitent par des prestataires techniques de confiance, uniquement pour la tâche qui leur est confiée :{'\n\n'}
          • <strong style={{ color: T.text }}>Supabase</strong> — hébergement de votre compte et sauvegarde de vos données{'\n'}
          • <strong style={{ color: T.text }}>Google</strong> — uniquement si vous choisissez "Continuer avec Google" pour vous connecter{'\n'}
          • <strong style={{ color: T.text }}>Resend</strong> — envoi des emails de confirmation de compte{'\n'}
          • <strong style={{ color: T.text }}>Africa&apos;s Talking</strong> — envoi des codes de vérification par SMS{'\n'}
          • <strong style={{ color: T.text }}>FedaPay</strong> — traitement des paiements de l&apos;abonnement Premium{'\n'}
          • <strong style={{ color: T.text }}>Vercel</strong> — hébergement technique de l&apos;application{'\n\n'}
          Nous ne vendons, ne louons ni ne partageons vos données personnelles à des tiers à des fins commerciales ou publicitaires.
        </Section>

        <Section title="5. Sécurité">
          L&apos;accès à vos données est protégé par votre mot de passe (ou votre compte Google). Nous vous recommandons de ne jamais partager vos identifiants de connexion. Toute utilisation effectuée depuis votre compte vous est attribuée.
        </Section>

        <Section title="6. Combien de temps nous gardons vos données">
          Vos données restent disponibles tant que votre compte existe. Si vous supprimez votre compte, vos données sont effacées de nos serveurs, sous réserve des obligations légales de conservation (ex : historique de paiement) qui peuvent nous imposer de garder certaines informations plus longtemps.
        </Section>

        <Section title="7. Vos droits">
          Vous pouvez à tout moment demander à consulter les données que nous avons sur votre compte, les corriger, ou demander la suppression de votre compte et de vos données, en nous contactant (voir section 8).
        </Section>

        <Section title="8. Contact">
          Pour toute question sur cette politique de confidentialité ou sur vos données :{'\n\n'}
          Email : contact@eidma.co{'\n'}
          WhatsApp : +1 514 552-2214
        </Section>

        <Section title="9. Modifications de cette politique">
          Nous pouvons mettre à jour cette politique de confidentialité de temps en temps, par exemple si nous ajoutons un nouveau service. La date de dernière mise à jour en haut de cette page reflète toujours la version en vigueur.
        </Section>

      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: T.text, marginBottom: 10, letterSpacing: '-0.3px' }}>{title}</h2>
      <p style={{ fontSize: 14, color: T.textSub, lineHeight: 1.75, margin: 0, whiteSpace: 'pre-line' }}>
        {children}
      </p>
    </div>
  );
}
