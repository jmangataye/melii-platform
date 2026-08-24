import { NextResponse } from "next/server";
import { listSales } from "@melii/db";
import { getCurrentCreatorId } from "@/lib/auth";

function csvCell(value: string | number): string {
  const s = String(value);
  // Encadre de guillemets dès qu'il y a une virgule, un guillemet ou un saut
  // de ligne — sinon la cellule reste telle quelle (plus lisible).
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET() {
  const creatorId = await getCurrentCreatorId();
  if (!creatorId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sales = await listSales(creatorId);

  const header = ["Date", "Palier", "Montant", "Devise", "Note"];
  const lines = [header.join(",")];
  for (const s of sales) {
    lines.push(
      [
        csvCell(new Date(s.declaredAt).toISOString().slice(0, 10)),
        csvCell(s.tierLabel),
        csvCell((s.amountCents / 100).toFixed(2)),
        csvCell(s.currency),
        csvCell(s.note || ""),
      ].join(",")
    );
  }

  // ﻿ (BOM) : Excel sur Windows n'affiche correctement les accents en
  // UTF-8 que si le fichier commence par ce marqueur.
  const csv = "﻿" + lines.join("\r\n") + "\r\n";

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="melii-ventes-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
