import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { beginTotpEnrollment, getCreatorById, totpAuthUrl } from "@melii/db";
import { getCurrentCreatorId } from "@/lib/auth";

// Étape 1/2 de l'activation du 2FA : génère un secret TOTP tout neuf et son
// QR code — rien n'est encore enregistré en base (voir enableTotp côté DB) :
// tant que /api/2fa/enable n'a pas reçu un code valide généré à partir de ce
// secret, on ne sait pas si la créatrice a réussi à le scanner.
export async function POST() {
  const creatorId = await getCurrentCreatorId();
  if (!creatorId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const creator = await getCreatorById(creatorId);
  if (!creator) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const secret = beginTotpEnrollment();
  const otpauthUrl = totpAuthUrl(secret, creator.email);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 240 });

  return NextResponse.json({ secret, otpauthUrl, qrCodeDataUrl });
}
