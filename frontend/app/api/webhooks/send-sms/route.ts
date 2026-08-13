import { NextResponse, type NextRequest } from 'next/server';
import { Webhook } from 'standardwebhooks';
import { envoyerSms } from '@/lib/africastalking';

interface HookPayload {
  user: { phone?: string };
  sms: { otp: string };
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const headers = Object.fromEntries(request.headers);

  const secretBrut = process.env.SEND_SMS_HOOK_SECRET;
  if (!secretBrut) {
    console.error('[send-sms-hook] SEND_SMS_HOOK_SECRET manquant');
    return NextResponse.json({ error: { http_code: 500, message: 'Configuration manquante' } }, { status: 500 });
  }
  const secretBase64 = secretBrut.replace('v1,whsec_', '');

  let payload: HookPayload;
  try {
    const wh = new Webhook(secretBase64);
    payload = wh.verify(rawBody, headers) as HookPayload;
  } catch (err) {
    // Ne jamais logger le corps brut ici : peut contenir des donnees
    // utilisateur. Seul err.message est sur a logger.
    console.error('[send-sms-hook] signature invalide :', err instanceof Error ? err.message : 'erreur inconnue');
    return NextResponse.json({ error: { http_code: 401, message: 'Signature invalide' } }, { status: 401 });
  }

  const otp = payload.sms.otp;
  if (!payload.user.phone || !otp) {
    console.error('[send-sms-hook] payload sans numero ou code');
    return NextResponse.json({ error: { http_code: 400, message: 'Payload incomplet' } }, { status: 400 });
  }
  // Supabase transmet le numero au format E.164 SANS le "+" (ex: "2290196116003"),
  // mais le SDK Africa's Talking exige le "+" pour reconnaitre l'indicatif pays.
  const phone = payload.user.phone.startsWith('+') ? payload.user.phone : `+${payload.user.phone}`;

  try {
    await envoyerSms(phone, `Votre code MargoPro : ${otp}`);
  } catch (err) {
    console.error('[send-sms-hook] echec envoi SMS pour', phone, ':', err instanceof Error ? err.message : 'erreur inconnue');
    return NextResponse.json({ error: { http_code: 500, message: "Echec de l'envoi du SMS" } }, { status: 500 });
  }

  return NextResponse.json({});
}
