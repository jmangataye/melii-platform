// Outil de vérification visuelle, PAS un test automatisé — capture des
// pages du site local dans un dossier de sortie pour permettre une revue
// visuelle réelle pendant le développement (avant/après un changement de
// design), plutôt que de deviner le rendu depuis le code seul.
//
// Usage : node tests/screenshot.js <base_url> <out_dir> [--mobile]
// Le serveur (dev ou start) doit déjà tourner sur base_url, avec au moins
// une créatrice de test (email/mdp ci-dessous) déjà créée dans sa base.

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const baseUrl = process.argv[2] || "http://localhost:3100";
const outDir = process.argv[3] || "/tmp/melii-screenshots";
const mobile = process.argv.includes("--mobile");

const TEST_EMAIL = process.env.SCREENSHOT_EMAIL || "screenshot-creator@example.com";
const TEST_PASSWORD = process.env.SCREENSHOT_PASSWORD || "password123";
const TEST_CREATOR_ID = process.env.SCREENSHOT_CREATOR_ID || null;
// Compte admin séparé : la page /admin redirige tout compte non-admin vers
// /dashboard (comportement voulu de AdminApp.tsx). Sans se reconnecter avec
// un compte listé dans ADMIN_EMAILS, "admin.png" ne montrerait donc jamais
// que la redirection — pas le vrai panneau admin.
const ADMIN_EMAIL = process.env.SCREENSHOT_ADMIN_EMAIL || null;
const ADMIN_PASSWORD = process.env.SCREENSHOT_ADMIN_PASSWORD || "password123";

const PUBLIC_PAGES = [
  { path: "/", name: "landing" },
  { path: "/comment-ca-marche", name: "comment-ca-marche" },
  { path: "/login", name: "login" },
  { path: "/signup", name: "signup" },
  { path: "/terms", name: "terms" },
  { path: "/privacy", name: "privacy" },
];

// Bug corrigé : le regex précédent (/stats/i) ne matchait PAS le libellé réel
// "Statistiques" (la sous-chaîne contiguë "stats" n'apparaît pas dans "Sta-t-i-
// stiques" — il manque le "i"), donc le clic échouait silencieusement et la
// capture "dashboard-stats.png" réutilisait l'onglet précédent (Telegram) au
// lieu de vraiment cliquer sur Statistiques. On mappe maintenant chaque clé
// vers le libellé exact affiché dans DashboardApp.tsx (TABS), pour ne plus
// dépendre d'une correspondance regex approximative.
const DASHBOARD_TABS = [
  { key: "overview", label: "Vue d'ensemble" },
  { key: "chat", label: "Chat en ligne" },
  { key: "persona", label: "Personnalité" },
  { key: "liens", label: "Liens & tarifs" },
  { key: "telegram", label: "Telegram" },
  { key: "stats", label: "Statistiques" },
  { key: "facturation", label: "Facturation" },
  { key: "compte", label: "Compte" },
];

// La version de Playwright installée localement ne correspond pas toujours
// au build Chromium pré-installé dans ce sandbox (chemin versionné) — on le
// retrouve dynamiquement plutôt que de coder en dur un numéro de version.
function findPreinstalledChrome() {
  const base = "/opt/pw-browsers";
  const dir = fs.readdirSync(base).find((d) => d.startsWith("chromium-"));
  if (!dir) throw new Error(`Aucun Chromium pré-installé trouvé dans ${base}`);
  return path.join(base, dir, "chrome-linux", "chrome");
}

async function shoot(page, outDir, name, suffix) {
  const file = path.join(outDir, `${name}${suffix}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`✓ ${file}`);
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: findPreinstalledChrome() });
  const viewport = mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const suffix = mobile ? "-mobile" : "";

  for (const p of PUBLIC_PAGES) {
    await page.goto(baseUrl + p.path, { waitUntil: "networkidle" });
    if (p.path === "/") {
      // Laisse le temps à l'aperçu de chat animé (LandingChatPreview) de
      // dérouler quelques messages avant la capture — sinon la page est
      // figée sur l'indicateur de frappe initial, peu représentatif.
      await page.waitForTimeout(3500);
    }
    await shoot(page, outDir, p.name, suffix);
  }

  // Connexion via le vrai formulaire de login (exerce l'UI, pas juste l'API).
  await page.goto(baseUrl + "/login", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click("form button");
  await page.waitForURL(baseUrl + "/dashboard", { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(500);

  for (const tab of DASHBOARD_TABS) {
    try {
      await page.getByRole("button", { name: tab.label, exact: true }).click({ timeout: 2000 });
    } catch (err) {
      // On log au lieu d'avaler l'erreur en silence — un clic manqué ici
      // veut dire que la capture qui suit montre encore l'onglet précédent,
      // ce qui a causé le bug diagnostiqué sur "stats" (voir commentaire
      // au-dessus de DASHBOARD_TABS). Mieux vaut un avertissement bruyant
      // qu'une capture mal étiquetée qu'on croit à tort fiable.
      console.warn(`⚠ clic sur l'onglet "${tab.label}" (${tab.key}) a échoué : ${err.message}`);
    }
    await page.waitForTimeout(300);
    await shoot(page, outDir, `dashboard-${tab.key}`, suffix);
  }

  if (TEST_CREATOR_ID) {
    await page.goto(`${baseUrl}/c/${TEST_CREATOR_ID}`, { waitUntil: "networkidle" });
    await shoot(page, outDir, "chat-public", suffix);
  }

  if (ADMIN_EMAIL) {
    // Nouveau contexte propre pour ne pas mélanger la session créatrice
    // (cookies) avec la session admin.
    const adminContext = await browser.newContext({ viewport });
    const adminPage = await adminContext.newPage();
    await adminPage.goto(baseUrl + "/login", { waitUntil: "networkidle" });
    await adminPage.fill('input[type="email"]', ADMIN_EMAIL);
    await adminPage.fill('input[type="password"]', ADMIN_PASSWORD);
    await adminPage.click("form button");
    await adminPage.waitForURL(baseUrl + "/dashboard", { timeout: 10000 }).catch(() => {});
    await adminPage.goto(baseUrl + "/admin", { waitUntil: "networkidle" });
    await shoot(adminPage, outDir, "admin", suffix);

    try {
      await adminPage.getByRole("button", { name: "Modération", exact: true }).click({ timeout: 2000 });
      await adminPage.waitForTimeout(300);
      await shoot(adminPage, outDir, "admin-moderation", suffix);
    } catch (err) {
      console.warn(`⚠ clic sur l'onglet "Modération" a échoué : ${err.message}`);
    }

    await adminContext.close();
  } else {
    console.warn(
      "⚠ SCREENSHOT_ADMIN_EMAIL non défini — admin.png montrera la redirection /dashboard, pas le vrai panneau admin."
    );
    await page.goto(baseUrl + "/admin", { waitUntil: "networkidle" });
    await shoot(page, outDir, "admin", suffix);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
