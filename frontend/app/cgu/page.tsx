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

export default function CguPage() {
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
        <h1 style={{ fontSize: 17, fontWeight: 700, color: T.text, margin: 0 }}>Conditions Générales d&apos;Utilisation</h1>
      </div>

      <div style={{ padding: '24px 20px', maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 28 }}>

        <div>
          <p style={{ fontSize: 13, color: T.textMuted, margin: 0 }}>Dernière mise à jour : 11 juillet 2026</p>
          <p style={{ fontSize: 14, color: T.textSub, lineHeight: 1.7, marginTop: 12 }}>
            Bienvenue sur <strong style={{ color: T.text }}>MargoPro</strong>. En utilisant cette application, vous acceptez les présentes conditions générales d&apos;utilisation. Veuillez les lire attentivement.
          </p>
        </div>

        <Section title="1. Présentation de l'application">
          MargoPro est une application mobile de gestion commerciale destinée aux petites entreprises et commerçants. Elle permet de gérer les stocks, les ventes, les marges et les alertes de réapprovisionnement, principalement en mode hors ligne.
        </Section>

        <Section title="2. Accès au service">
          L&apos;accès à MargoPro nécessite la création d&apos;un compte via une adresse email et un mot de passe. Vous êtes responsable de la confidentialité de vos identifiants de connexion. Toute utilisation effectuée depuis votre compte vous est attribuée.
        </Section>

        <Section title="3. Données et vie privée">
          Vos données commerciales (produits, ventes, stocks) sont stockées en priorité sur votre appareil, ce qui permet à MargoPro de fonctionner sans connexion internet.{'\n\n'}
          Dès la création de votre compte, ces données sont également sauvegardées automatiquement de façon sécurisée sur nos serveurs (Supabase), afin de vous protéger en cas de perte, de vol ou de panne de votre téléphone, et de vous permettre de les retrouver sur un nouvel appareil.{'\n\n'}
          Chaque commerçant n&apos;a accès qu&apos;à ses propres données : il est techniquement impossible pour un autre utilisateur de MargoPro de consulter votre stock ou vos ventes. Nous n&apos;accédons pas aux données individuelles de votre compte, sauf à votre demande dans le cadre d&apos;une assistance technique.{'\n\n'}
          Nous ne vendons, ne partageons ni ne louons vos données personnelles à des tiers.
        </Section>

        <Section title="4. Abonnement et paiement">
          MargoPro propose un plan gratuit avec des fonctionnalités limitées et un plan Premium donnant accès à l&apos;ensemble des fonctionnalités.{'\n\n'}
          Le plan Premium est actuellement en phase de lancement. Les modalités de paiement (Mobile Money, Wave, etc.) seront communiquées lors de l&apos;activation de cette fonctionnalité.{'\n\n'}
          Aucun paiement ne vous sera prélevé sans votre accord explicite.
        </Section>

        <Section title="5. Utilisation acceptable">
          Vous vous engagez à utiliser MargoPro uniquement à des fins légales et conformes à la réglementation de votre pays. Il est interdit d&apos;utiliser l&apos;application pour enregistrer des transactions frauduleuses ou illicites.
        </Section>

        <Section title="6. Disponibilité du service">
          Nous mettons tout en œuvre pour assurer la disponibilité de MargoPro. Cependant, nous ne pouvons garantir un accès continu et ininterrompu, notamment en cas de maintenance, de mise à jour ou de force majeure.{'\n\n'}
          MargoPro fonctionnant principalement en mode hors ligne, votre activité quotidienne n&apos;est pas interrompue en cas d&apos;absence de connexion internet.
        </Section>

        <Section title="7. Limitation de responsabilité">
          MargoPro est fourni "tel quel". Nous ne sommes pas responsables des pertes de données liées à une réinitialisation d&apos;appareil, une suppression de l&apos;application ou une panne matérielle.{'\n\n'}
          Vos données sont sauvegardées automatiquement en ligne dès la création de votre compte (voir section 3), ce qui limite ce risque.
        </Section>

        <Section title="8. Propriété intellectuelle">
          L&apos;application MargoPro, son design, son code source et ses contenus sont la propriété exclusive de leurs créateurs. Toute reproduction, modification ou distribution sans autorisation est interdite.
        </Section>

        <Section title="9. Modification des CGU">
          Nous nous réservons le droit de modifier les présentes CGU à tout moment. Les modifications entrent en vigueur dès leur publication dans l&apos;application. En continuant à utiliser MargoPro après une mise à jour, vous acceptez les nouvelles conditions.
        </Section>

        <Section title="10. Contact">
          Pour toute question relative aux présentes CGU ou à l&apos;utilisation de MargoPro, contactez-nous à :{'\n\n'}
          Email : contact@eidma.co{'\n'}
          WhatsApp : +1 514 552-2214
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
