import AfricasTalking from 'africastalking';

// Instancie a la demande plutot qu'au chargement du module : sinon Next.js
// fait planter tout le build en collectant les donnees de la route (import
// du module) des que AFRICASTALKING_API_KEY/USERNAME sont absents, meme si
// aucun SMS n'est jamais envoye (ex: avant que les variables Vercel soient
// configurees).
let client: ReturnType<typeof AfricasTalking> | undefined;

function getClient() {
  if (!client) {
    client = AfricasTalking({
      apiKey: process.env.AFRICASTALKING_API_KEY!,
      username: process.env.AFRICASTALKING_USERNAME!,
    });
  }
  return client;
}

export function buildSmsOptions(phone: string, message: string): { to: string; message: string } {
  return { to: phone, message };
}

// Envoie un SMS. Leve une erreur si Africa's Talking ne confirme pas
// l'envoi (statut different de "Success" pour ce destinataire) - permet
// a l'appelant (route API du hook Supabase) de repondre une erreur
// structuree plutot que de repondre 200 sur un envoi qui a en realite
// echoue.
export async function envoyerSms(phone: string, message: string): Promise<void> {
  const options = buildSmsOptions(phone, message);
  let reponse;
  try {
    reponse = await getClient().SMS.send(options);
  } catch (err) {
    // Ne jamais logger l'objet d'erreur complet : peut contenir la cle API
    // dans la requete HTTP d'origine attachee par le SDK. Seul err.message
    // est sur a logger (meme regle que frontend/lib/fedapay.ts).
    throw new Error(err instanceof Error ? err.message : 'Erreur inconnue Africa\'s Talking');
  }
  const destinataire = reponse.SMSMessageData.Recipients[0];
  if (!destinataire || destinataire.status !== 'Success') {
    throw new Error(`Echec envoi SMS : ${destinataire?.status ?? 'aucun destinataire dans la reponse'}`);
  }
}
