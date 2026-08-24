"use client";

// Petit simulateur sur la landing page : "avec X€ de ventes déclarées par
// mois, vous gardez Y€". Rend concret le modèle "aucun abonnement fixe,
// juste une commission" affiché juste au-dessus. Taux affiché = taux de
// base par défaut de la plateforme (voir COMMISSION_RATE côté serveur) —
// une créatrice déjà inscrite peut le réduire via le parrainage, précisé
// en note sous le résultat.

import { useState } from "react";

const DEFAULT_RATE = 0.15;

function eur(amount: number) {
  return amount.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

export default function CommissionCalculator() {
  const [revenue, setRevenue] = useState(500);

  const commission = Math.round(revenue * DEFAULT_RATE);
  const net = revenue - commission;

  return (
    <div className="card glow p-6 sm:p-8">
      <p className="text-xs uppercase tracking-wide text-muted mb-1">Simulateur</p>
      <h3 className="text-lg font-medium mb-5">Combien vous garderiez ce mois-ci</h3>

      <label className="block mb-6">
        <span className="block text-sm text-muted mb-2">Ventes déclarées estimées</span>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={0}
            max={5000}
            step={50}
            value={revenue}
            onChange={(e) => setRevenue(Number(e.target.value))}
            className="flex-1 accent-[var(--accent)]"
            aria-label="Ventes déclarées estimées en euros"
          />
          <span className="text-sm font-medium w-20 text-right shrink-0">{eur(revenue)}</span>
        </div>
      </label>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-surface-2 p-4">
          <p className="text-xs text-muted mb-1">Commission ({Math.round(DEFAULT_RATE * 100)} %)</p>
          <p className="text-xl font-semibold">{eur(commission)}</p>
        </div>
        <div className="rounded-xl bg-surface-2 p-4">
          <p className="text-xs text-muted mb-1">Vous gardez</p>
          <p className="text-xl font-semibold gradient-text">{eur(net)}</p>
        </div>
      </div>

      <p className="text-xs text-muted mt-4">
        Taux de base — réductible jusqu&apos;à -5 points en parrainant d&apos;autres créatrices,
        sans limite de temps. Aucun frais si vous n&apos;avez aucune vente.
      </p>
    </div>
  );
}
