/* ============================================================
   sheets.js — Lecture / Écriture Google Sheets
   Arche de Mallo — Comptabilité
   ============================================================ */

// ---- CONFIGURATION ----
const SHEETS_CONFIG = {
  // ID du Google Sheets compta (à renseigner après création)
  spreadsheetId: '1KOuX0XnccyjPOPntOJUYzivk2jGn07y7tp__gRIN3F0',

  // ID du Google Sheets formulaires (lecture seule)
  formulairesId: '1y6yD4AohP7T10GE7mmguIqNWSnwla9t1mewBpCDej_Y',

  // ID du dossier Google Drive pour les factures
  facturesDriveId: '1DW0uhw3P8rJMYPYQeUkNsQNNE79LMLes',

  // Noms des onglets dans le Sheets compta
  sheets: {
    caisse:       'Caisse',
    banque:       'Banque',
    caisse1:      'Caisse1_physique',
    caisse2:      'Caisse2_physique',
    config:       'Config',
    journal:      'Journal',
    remises:      'Remises_cheques',
    cheques:      'Cheques_emis',
  },

  // Noms des onglets dans le Sheets formulaires
  formulaires: {
    adoptions:    'Adoptions',
    reservations: 'Reservations',
    abandons:     'Abandons',
    adhesions:    'Adhesions',
    depots:       'Depots',
    familles:     'Familles_accueil',
    dons:         'Dons',
  },
};

// ---- COLONNES CAISSE ----
// Ordre des colonnes dans l'onglet Caisse
const COLS_CAISSE = {
  source:         0,  // C1/C2/BQ/D/M/E/VD
  date:           1,
  libelle:        2,
  debit:          3,
  credit:         4,
  solde:          5,
  periode:        6,
  type_mvt:       7,
  description:    8,
  nom:            9,
  reglement:      10,
  nom_chat:       11,
  verif_remise:   12,
  lien_remise:    13,
  num_facture:    14,
  lien_facture:   15, // nouveau : lien PDF Drive
  type_auto:      16,
  desc_auto:      17,
  type_final:     18,
  desc_final:     19,
  type_comp:      20,
  desc_comp:      21,
  num_recu:       22,
  num_bordereau:  23,
  niveau_adopt:   24,
  flag_check:     25, // nouveau : case à cocher "à vérifier"
  flag_comment:   26, // nouveau : commentaire sur la ligne
};

// ---- COLONNES BANQUE ----
const COLS_BANQUE = {
  date:           0,
  libelle:        1,
  debit:          2,
  credit:         3,
  solde:          4,
  periode:        5,
  type_mvt:       6,
  description:    7,
  nom:            8,
  num_cheque:     9,  // numéro chèque si chèque émis
  statut_cheque:  10, // émis / encaissé / annulé
  num_remise:     11, // N° bordereau remise chèques
  num_facture:    12,
  lien_facture:   13, // lien PDF Drive
  flag_check:     14,
  flag_comment:   15,
};

// ---- COLONNES CAISSE PHYSIQUE ----
const COLS_CAISSE_PHYSIQUE = {
  date:          0,  // date du comptage
  mois:          1,  // libellé mois (ex: "Mai 2026")
  b500:          2,  // billets 500€
  b200:          3,
  b100:          4,
  b50:           5,
  b20:           6,
  b10:           7,
  b5:            8,
  p200:          9,  // pièces 2€
  p100:          10, // pièces 1€
  p050:          11, // pièces 0.50€
  p020:          12,
  p010:          13,
  p005:          14,
  p002:          15,
  p001:          16,
  total:         17, // total calculé
  commentaire:   18,
};

// ---- COLONNES JOURNAL ----
const COLS_JOURNAL = {
  timestamp:    0,
  user_email:   1,
  user_name:    2,
  action:       3,  // AJOUT / MODIF / SUPPRESSION
  onglet:       4,
  ligne_ref:    5,  // identifiant de la ligne modifiée
  detail:       6,  // description de la modification
  is_admin:     7,
};

// ============================================================
// FONCTIONS DE LECTURE
// ============================================================

// Lire une plage de cellules
async function readRange(spreadsheetId, range) {
  try {
    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
    });
    return response.result.values || [];
  } catch(e) {
    console.error('Erreur lecture Sheets:', e);
    throw e;
  }
}

// Lire tout un onglet
async function readSheet(sheetName, spreadsheetId = SHEETS_CONFIG.spreadsheetId) {
  return readRange(spreadsheetId, `${sheetName}!A:ZZ`);
}

// ---- OPÉRATIONS CAISSE ----
async function getCaisseOperations(periode = null) {
  const rows = await readSheet(SHEETS_CONFIG.sheets.caisse);
  if (rows.length < 2) return [];
  const data = rows.slice(1); // ignorer en-tête
  if (periode) {
    return data.filter(r => r[COLS_CAISSE.periode] === periode);
  }
  return data;
}

// ---- OPÉRATIONS BANQUE ----
async function getBanqueOperations(periode = null) {
  const rows = await readSheet(SHEETS_CONFIG.sheets.banque);
  if (rows.length < 2) return [];
  const data = rows.slice(1);
  if (periode) {
    return data.filter(r => r[COLS_BANQUE.periode] === periode);
  }
  return data;
}

// ---- CAISSE PHYSIQUE ----
async function getCaissePhysique(numCaisse) {
  const sheet = numCaisse === 1 ? SHEETS_CONFIG.sheets.caisse1 : SHEETS_CONFIG.sheets.caisse2;
  const rows = await readSheet(sheet);
  if (rows.length < 2) return [];
  return rows.slice(1);
}

// ---- CONFIG ----
async function getConfig() {
  const rows = await readRange(SHEETS_CONFIG.spreadsheetId, `${SHEETS_CONFIG.sheets.config}!A:B`);
  const config = {};
  rows.forEach(r => { if (r[0]) config[r[0]] = r[1]; });
  return config;
}

// ---- DONNÉES FORMULAIRES (lecture seule) ----
async function getFormulairesData(type) {
  const sheetName = SHEETS_CONFIG.formulaires[type];
  if (!sheetName) return [];
  try {
    return await readSheet(sheetName, SHEETS_CONFIG.formulairesId);
  } catch(e) {
    console.warn(`Impossible de lire les formulaires ${type}:`, e);
    return [];
  }
}

// ---- JOURNAL ----
async function getJournal(limit = 50) {
  const rows = await readSheet(SHEETS_CONFIG.sheets.journal);
  if (rows.length < 2) return [];
  return rows.slice(1).slice(-limit).reverse();
}

// ============================================================
// FONCTIONS D'ÉCRITURE
// ============================================================

// Ajouter une ou plusieurs lignes à un onglet
async function appendRows(sheetName, rows) {
  try {
    await gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: SHEETS_CONFIG.spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: rows },
    });
  } catch(e) {
    console.error('Erreur écriture Sheets:', e);
    throw e;
  }
}

// Mettre à jour une cellule précise
async function updateCell(sheetName, row, col, value) {
  const colLetter = colToLetter(col);
  const range = `${sheetName}!${colLetter}${row}`;
  try {
    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: SHEETS_CONFIG.spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [[value]] },
    });
  } catch(e) {
    console.error('Erreur mise à jour cellule:', e);
    throw e;
  }
}

// Mettre à jour une plage
async function updateRange(sheetName, startRow, startCol, values) {
  const colLetter = colToLetter(startCol);
  const range = `${sheetName}!${colLetter}${startRow}`;
  try {
    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: SHEETS_CONFIG.spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      resource: { values },
    });
  } catch(e) {
    console.error('Erreur mise à jour plage:', e);
    throw e;
  }
}

// ---- SAUVEGARDER OPÉRATION CAISSE ----
async function saveCaisseOperation(op) {
  const user = Auth.getUser();
  const row = new Array(27).fill('');
  row[COLS_CAISSE.source]       = op.source       || 'C';
  row[COLS_CAISSE.date]         = op.date          || '';
  row[COLS_CAISSE.libelle]      = op.libelle       || '';
  row[COLS_CAISSE.debit]        = op.debit         || '';
  row[COLS_CAISSE.credit]       = op.credit        || '';
  row[COLS_CAISSE.periode]      = op.periode       || '';
  row[COLS_CAISSE.type_mvt]     = op.type_mvt      || '';
  row[COLS_CAISSE.description]  = op.description   || '';
  row[COLS_CAISSE.nom]          = op.nom           || '';
  row[COLS_CAISSE.nom_chat]     = op.nom_chat      || '';
  row[COLS_CAISSE.lien_remise]  = op.lien_remise   || '';
  row[COLS_CAISSE.num_facture]  = op.num_facture   || '';
  row[COLS_CAISSE.lien_facture] = op.lien_facture  || '';
  row[COLS_CAISSE.num_recu]     = op.num_recu      || '';
  row[COLS_CAISSE.num_bordereau]= op.num_bordereau || '';
  row[COLS_CAISSE.niveau_adopt] = op.niveau_adopt  || '';
  row[COLS_CAISSE.flag_check]   = 'FALSE';
  row[COLS_CAISSE.flag_comment] = '';

  await appendRows(SHEETS_CONFIG.sheets.caisse, [row]);
  await logAction('AJOUT', 'Caisse', op.libelle, `${op.date} — ${op.type_mvt} — ${op.credit || op.debit}€`);

  // Alerte si saisie par non-admin
  if (!Auth.isAdmin()) {
    await sendAlert(user, 'Caisse', op);
  }
}

// ---- SAUVEGARDER OPÉRATION BANQUE ----
async function saveBanqueOperation(op) {
  const user = Auth.getUser();
  const row = new Array(16).fill('');
  row[COLS_BANQUE.date]          = op.date          || '';
  row[COLS_BANQUE.libelle]       = op.libelle       || '';
  row[COLS_BANQUE.debit]         = op.debit         || '';
  row[COLS_BANQUE.credit]        = op.credit        || '';
  row[COLS_BANQUE.periode]       = op.periode       || '';
  row[COLS_BANQUE.type_mvt]      = op.type_mvt      || '';
  row[COLS_BANQUE.description]   = op.description   || '';
  row[COLS_BANQUE.nom]           = op.nom           || '';
  row[COLS_BANQUE.num_cheque]    = op.num_cheque    || '';
  row[COLS_BANQUE.statut_cheque] = op.statut_cheque || '';
  row[COLS_BANQUE.num_remise]    = op.num_remise    || '';
  row[COLS_BANQUE.num_facture]   = op.num_facture   || '';
  row[COLS_BANQUE.lien_facture]  = op.lien_facture  || '';
  row[COLS_BANQUE.flag_check]    = 'FALSE';
  row[COLS_BANQUE.flag_comment]  = '';

  await appendRows(SHEETS_CONFIG.sheets.banque, [row]);
  await logAction('AJOUT', 'Banque', op.libelle, `${op.date} — ${op.type_mvt} — ${op.credit || op.debit}€`);

  if (!Auth.isAdmin()) {
    await sendAlert(user, 'Banque', op);
  }
}

// ---- SAUVEGARDER COMPTAGE CAISSE PHYSIQUE ----
async function saveCaissePhysique(numCaisse, comptage) {
  const sheet = numCaisse === 1 ? SHEETS_CONFIG.sheets.caisse1 : SHEETS_CONFIG.sheets.caisse2;
  const total = calculerTotalCaisse(comptage);
  const row = [
    comptage.date,
    comptage.mois,
    comptage.b500  || 0, comptage.b200  || 0, comptage.b100 || 0,
    comptage.b50   || 0, comptage.b20   || 0, comptage.b10  || 0,
    comptage.b5    || 0,
    comptage.p200  || 0, comptage.p100  || 0, comptage.p050 || 0,
    comptage.p020  || 0, comptage.p010  || 0, comptage.p005 || 0,
    comptage.p002  || 0, comptage.p001  || 0,
    total,
    comptage.commentaire || '',
  ];
  await appendRows(sheet, [row]);
  await logAction('AJOUT', `Caisse${numCaisse}_physique`, comptage.mois, `Total: ${total}€`);
}

// ---- METTRE À JOUR FLAG "À VÉRIFIER" ----
async function updateFlag(sheetName, rowIndex, isChecked, comment) {
  const colCheck   = sheetName === 'Caisse' ? COLS_CAISSE.flag_check   : COLS_BANQUE.flag_check;
  const colComment = sheetName === 'Caisse' ? COLS_CAISSE.flag_comment  : COLS_BANQUE.flag_comment;
  const sheetRow = rowIndex + 2; // +1 en-tête, +1 base 1
  await updateCell(sheetName, sheetRow, colCheck,   isChecked ? 'TRUE' : 'FALSE');
  await updateCell(sheetName, sheetRow, colComment, comment || '');
  await logAction('MODIF', sheetName, `Ligne ${rowIndex + 1}`, `Flag: ${isChecked}, Commentaire: ${comment}`);
}

// ============================================================
// JOURNAL DES MODIFICATIONS
// ============================================================
async function logAction(action, onglet, reference, detail) {
  const user = Auth.getUser();
  if (!user) return;
  const row = [
    new Date().toLocaleString('fr-FR'),
    user.email,
    user.name,
    action,
    onglet,
    reference,
    detail,
    user.isAdmin ? 'OUI' : 'NON',
  ];
  try {
    await appendRows(SHEETS_CONFIG.sheets.journal, [row]);
  } catch(e) {
    console.warn('Impossible d\'enregistrer dans le journal:', e);
  }
}

// ============================================================
// ALERTE EMAIL (via un Google Apps Script webhook)
// ============================================================
// Un simple Apps Script dans le Sheets envoie l'email
// Il faut déployer un webhook et mettre son URL ici
const ALERT_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbzWoPr3ML_MrSh6HgzZYEFxL6WATrOrV4ZxayFTsTc5vy0zHVSmdHX3Jg_mk0Nbte9X/exec';

async function sendAlert(user, source, operation) {
  try {
    await fetch(ALERT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:      user.name,
        email:     user.email,
        source,
        operation: {
          date:        operation.date,
          libelle:     operation.libelle,
          type:        operation.type_mvt,
          montant:     operation.credit || operation.debit,
          sens:        operation.credit ? 'Crédit' : 'Débit',
        },
        timestamp: new Date().toISOString(),
      }),
      mode: 'no-cors',
    });
  } catch(e) {
    console.warn('Alerte non envoyée:', e);
  }
}

// ============================================================
// STATS ET CALCULS
// ============================================================

// Calculer total d'une caisse physique
function calculerTotalCaisse(c) {
  return (
    (c.b500 || 0) * 500 +
    (c.b200 || 0) * 200 +
    (c.b100 || 0) * 100 +
    (c.b50  || 0) *  50 +
    (c.b20  || 0) *  20 +
    (c.b10  || 0) *  10 +
    (c.b5   || 0) *   5 +
    (c.p200 || 0) *   2 +
    (c.p100 || 0) *   1 +
    (c.p050 || 0) * 0.5 +
    (c.p020 || 0) * 0.2 +
    (c.p010 || 0) * 0.1 +
    (c.p005 || 0) * 0.05 +
    (c.p002 || 0) * 0.02 +
    (c.p001 || 0) * 0.01
  );
}

// Stats du mois pour le dashboard
function calcStats(caisseRows, banqueRows, periode) {
  const filterPeriode = (rows, colPeriode, colDebit, colCredit) =>
    rows.filter(r => r[colPeriode] === periode).map(r => ({
      debit:  parseFloat(r[colDebit])  || 0,
      credit: parseFloat(r[colCredit]) || 0,
    }));

  const caisseOps = filterPeriode(caisseRows, COLS_CAISSE.periode, COLS_CAISSE.debit, COLS_CAISSE.credit);
  const banqueOps = filterPeriode(banqueRows, COLS_BANQUE.periode, COLS_BANQUE.debit, COLS_BANQUE.credit);

  const sum = (ops, key) => ops.reduce((acc, o) => acc + o[key], 0);

  return {
    caisse: {
      entrees: sum(caisseOps, 'credit'),
      sorties: sum(caisseOps, 'debit'),
      solde:   sum(caisseOps, 'credit') - sum(caisseOps, 'debit'),
    },
    banque: {
      entrees: sum(banqueOps, 'credit'),
      sorties: sum(banqueOps, 'debit'),
      solde:   sum(banqueOps, 'credit') - sum(banqueOps, 'debit'),
    },
  };
}

// ============================================================
// GESTION DES PÉRIODES
// ============================================================

function getPeriodes() {
  // Lire depuis localStorage si déjà chargé (mis à jour par Config)
  const stored = localStorage.getItem('arche_periodes');
  if (stored) {
    try { return JSON.parse(stored); } catch(e) {}
  }
  // Fallback : générer à partir de 2024-2025
  const currentYear  = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const startAssocYear = currentMonth >= 9 ? currentYear : currentYear - 1;
  const periodes = [];
  for (let y = 2024; y <= startAssocYear; y++) {
    periodes.push(`${y} - ${y + 1}`);
  }
  return periodes;
}

// Sauvegarder les périodes (appelé depuis config.html)
function savePeriodes(periodes) {
  localStorage.setItem('arche_periodes', JSON.stringify(periodes));
}

// Lire les types de mouvement depuis Config ou valeurs par défaut
function getTypesMouvement() {
  const stored = localStorage.getItem('arche_types_mvt');
  if (stored) { try { return JSON.parse(stored); } catch(e) {} }
  return [
    'Adoption','Don','Adhésion','Événement',
    'Dépense alimentaire','Dépense vétérinaire','Dépense matériel','Dépense autre',
    'Remboursement','Virement interne','Remise chèques','Chèque émis','Divers'
  ];
}
function saveTypesMouvement(types) {
  localStorage.setItem('arche_types_mvt', JSON.stringify(types));
}

// Lire les modes de règlement depuis Config ou valeurs par défaut
function getModesReglement() {
  const stored = localStorage.getItem('arche_reglements');
  if (stored) { try { return JSON.parse(stored); } catch(e) {} }
  return ['Espèces','Chèque','Virement','CB','PayPal','Prélèvement','Autre'];
}
function saveModesReglement(modes) {
  localStorage.setItem('arche_reglements', JSON.stringify(modes));
}

function getCurrentPeriode() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return m >= 9 ? `${y} - ${y + 1}` : `${y - 1} - ${y}`;
}
// ============================================================
// IMPORT RELEVÉ BANQUE
// ============================================================

// Détecter les doublons entre relevé importé et opérations existantes
function detectDoublons(releveRows, existingRows) {
  const results = releveRows.map(releve => {
    const dateReleve    = normalizeDate(releve.date);
    const montantReleve = Math.abs(parseFloat(releve.montant) || 0);
    const libelleReleve = (releve.libelle || '').toLowerCase().trim();

    const doublon = existingRows.find(existing => {
      const dateExist    = normalizeDate(existing[COLS_BANQUE.date]);
      const montantExist = Math.abs(parseFloat(existing[COLS_BANQUE.debit] || existing[COLS_BANQUE.credit]) || 0);
      const libelleExist = (existing[COLS_BANQUE.libelle] || '').toLowerCase().trim();

      const sameMontant = Math.abs(montantReleve - montantExist) < 0.01;
      const sameDate    = dateReleve === dateExist;
      const libelleOk   = libelleExist.includes(libelleReleve.slice(0, 8)) ||
                          libelleReleve.includes(libelleExist.slice(0, 8));

      return sameMontant && sameDate;
    });

    return { ...releve, doublon: !!doublon, existingMatch: doublon || null };
  });
  return results;
}

// ============================================================
// DRIVE — LIENS FACTURES
// ============================================================

// Construire l'URL d'aperçu Drive à partir de l'ID du fichier
function buildDrivePreviewUrl(fileId) {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

// Ouvrir une facture PDF dans un nouvel onglet
function openFacture(fileIdOrUrl) {
  if (!fileIdOrUrl) return;
  const url = fileIdOrUrl.startsWith('http')
    ? fileIdOrUrl
    : `https://drive.google.com/file/d/${fileIdOrUrl}/view`;
  window.open(url, '_blank');
}

// ============================================================
// UTILITAIRES
// ============================================================

function normalizeDate(dateStr) {
  if (!dateStr) return '';
  // Accepte DD/MM/YYYY ou YYYY-MM-DD
  const parts = String(dateStr).split(/[\/\-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) return `${parts[2]}/${parts[1]}/${parts[0]}`; // YYYY-MM-DD → DD/MM/YYYY
    return `${parts[0].padStart(2,'0')}/${parts[1].padStart(2,'0')}/${parts[2]}`;
  }
  return dateStr;
}

function formatMoney(value) {
  if (value === '' || value === null || value === undefined) return '';
  const num = parseFloat(value);
  if (isNaN(num)) return '';
  return num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function colToLetter(col) {
  let letter = '';
  let n = col;
  while (n >= 0) {
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function todayFR() {
  return new Date().toLocaleDateString('fr-FR');
}

// ============================================================
// EXPORT
// ============================================================
window.Sheets = {
  config:              SHEETS_CONFIG,
  cols: {
    caisse:            COLS_CAISSE,
    banque:            COLS_BANQUE,
    caissePhysique:    COLS_CAISSE_PHYSIQUE,
    journal:           COLS_JOURNAL,
  },

  // Lecture
  getCaisseOperations,
  getBanqueOperations,
  getCaissePhysique,
  getConfig,
  getFormulairesData,
  getJournal,

  // Écriture
  saveCaisseOperation,
  saveBanqueOperation,
  saveCaissePhysique,
  updateFlag,
  appendRows,
  updateCell,

  // Stats
  calcStats,
  calculerTotalCaisse,
  detectDoublons,

  // Périodes
  getPeriodes,
  savePeriodes,
  getCurrentPeriode,
  getTypesMouvement,
  saveTypesMouvement,
  getModesReglement,
  saveModesReglement,
   
  // Drive
  openFacture,
  buildDrivePreviewUrl,

  // Utilitaires
  formatMoney,
  normalizeDate,
  todayISO,
  todayFR,
};
