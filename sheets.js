/* ============================================================
   sheets.js — Lecture / Écriture Google Sheets
   Arche de Mallo — Comptabilité — v2
   ============================================================ */

// ---- CONFIGURATION ----
const SHEETS_CONFIG = {
  spreadsheetId:   'VOTRE_SPREADSHEET_ID',
  formulairesId:   '1y6yD4AohP7T10GE7mmguIqNWSnwla9t1mewBpCDej_Y',
  facturesDriveId: 'VOTRE_DOSSIER_DRIVE_ID',
  sheets: {
    caisse:       'Caisse',
    banque:       'Banque',
    caisse1:      'Caisse1_physique',
    caisse2:      'Caisse2_physique',
    config:       'Config',
    journal:      'Journal',
    cheques:      'Cheques',        // chèques émis en attente
    remises:      'Remises',        // remises de chèques
    factures:     'Factures',
    import_hist:  'Import_historique',
  },
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

// Charger config depuis localStorage si disponible
(function loadStoredConfig() {
  const cfg = JSON.parse(localStorage.getItem('arche_sheets_config') || '{}');
  if (cfg.spreadsheetId)   SHEETS_CONFIG.spreadsheetId   = cfg.spreadsheetId;
  if (cfg.formulairesId)   SHEETS_CONFIG.formulairesId   = cfg.formulairesId;
  if (cfg.facturesDriveId) SHEETS_CONFIG.facturesDriveId = cfg.facturesDriveId;
})();

// ============================================================
// DÉFINITION DES COLONNES
// ============================================================

const COLS_CAISSE = {
  source:       0,   // C1 / C2
  date:         1,
  libelle:      2,
  debit:        3,
  credit:       4,
  solde:        5,
  periode:      6,
  type_mvt:     7,   // 1ère liste déroulante
  type_comp:    8,   // 2ème liste déroulante (type complémentaire)
  description:  9,
  nom:          10,
  reglement:    11,
  nom_chat:     12,
  num_recu:     13,
  num_bordereau:14,
  lien_facture: 15,
  flag_check:   16,
  flag_comment: 17,
};

const COLS_BANQUE = {
  date:         0,
  libelle:      1,
  debit:        2,
  credit:       3,
  solde:        4,
  periode:      5,
  type_mvt:     6,   // 1ère liste déroulante
  type_comp:    7,   // 2ème liste déroulante
  description:  8,
  nom:          9,
  ref_cheque:   10,  // référence chèque lié (si encaissement chèque)
  ref_remise:   11,  // référence remise liée (si remise encaissée)
  lien_facture: 12,
  flag_check:   13,
  flag_comment: 14,
};

// Chèques émis (onglet Cheques)
const COLS_CHEQUE = {
  id:           0,   // identifiant unique
  num_cheque:   1,
  date_emission:2,
  beneficiaire: 3,
  montant:      4,
  type_mvt:     5,
  type_comp:    6,
  description:  7,
  periode:      8,
  statut:       9,   // 'en_attente' / 'encaisse' / 'annule'
  date_encaiss: 10,
  ref_banque:   11,  // ligne banque associée
};

// Remises de chèques (onglet Remises)
const COLS_REMISE = {
  id:           0,   // identifiant unique (BRD-2026-001)
  date_remise:  1,
  num_bordereau:2,
  nb_cheques:   3,
  montant_total:4,
  periode:      5,
  statut:       6,   // 'en_attente' / 'encaissee'
  date_encaiss: 7,
  ref_banque:   8,
  // Les chèques détaillés sont dans des colonnes dynamiques (9, 10, 11...)
  // Format: cheque_1_type, cheque_1_montant, cheque_1_donateur, cheque_1_description ...
  detail_start: 9,
};

// Factures
const COLS_FACTURE = {
  id:            0,
  num_facture:   1,
  fournisseur:   2,
  date_facture:  3,
  montant_ttc:   4,
  categorie:     5,
  description:   6, 
  date_reglement:7,
  mode_reglement:8,
  lien_pdf:      9,
  commentaire:   10,
  periode:       11,
  statut:        12, 
};

const COLS_CAISSE_PHYSIQUE = {
  date:0, mois:1,
  b500:2, b200:3, b100:4, b50:5, b20:6, b10:7, b5:8,
  p200:9, p100:10, p050:11, p020:12, p010:13, p005:14, p002:15, p001:16,
  total:17, commentaire:18,
};

const COLS_JOURNAL = {
  timestamp:0, user_email:1, user_name:2, action:3,
  onglet:4, ligne_ref:5, detail:6, is_admin:7,
};

// ============================================================
// FONCTIONS DE LECTURE
// ============================================================

async function readRange(spreadsheetId, range) {
  const response = await gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId, range,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });
  return response.result.values || [];
}

async function readSheet(sheetName, spreadsheetId) {
  return readRange(spreadsheetId || SHEETS_CONFIG.spreadsheetId, `${sheetName}!A:ZZ`);
}

async function getCaisseOperations(periode) {
  const rows = await readSheet(SHEETS_CONFIG.sheets.caisse);
  const data = rows.length > 1 ? rows.slice(1) : [];
  return periode ? data.filter(r => r[COLS_CAISSE.periode] === periode) : data;
}

async function getBanqueOperations(periode) {
  const rows = await readSheet(SHEETS_CONFIG.sheets.banque);
  const data = rows.length > 1 ? rows.slice(1) : [];
  return periode ? data.filter(r => r[COLS_BANQUE.periode] === periode) : data;
}

async function getCaissePhysique(numCaisse) {
  const sheet = numCaisse === 1 ? SHEETS_CONFIG.sheets.caisse1 : SHEETS_CONFIG.sheets.caisse2;
  const rows = await readSheet(sheet);
  return rows.length > 1 ? rows.slice(1) : [];
}

async function getCheques(statut) {
  const rows = await readSheet(SHEETS_CONFIG.sheets.cheques);
  const data = rows.length > 1 ? rows.slice(1) : [];
  return statut ? data.filter(r => r[COLS_CHEQUE.statut] === statut) : data;
}

async function getRemises(statut) {
  const rows = await readSheet(SHEETS_CONFIG.sheets.remises);
  const data = rows.length > 1 ? rows.slice(1) : [];
  return statut ? data.filter(r => r[COLS_REMISE.statut] === statut) : data;
}

async function getFactures() {
  const rows = await readSheet(SHEETS_CONFIG.sheets.factures);
  return rows.length > 1 ? rows.slice(1) : [];
}

async function getJournal(limit) {
  const rows = await readSheet(SHEETS_CONFIG.sheets.journal);
  if (rows.length < 2) return [];
  return rows.slice(1).slice(-(limit || 200)).reverse();
}

async function getFormulairesData(type) {
  const sheetName = SHEETS_CONFIG.formulaires[type];
  if (!sheetName) return [];
  try { return await readSheet(sheetName, SHEETS_CONFIG.formulairesId); }
  catch(e) { return []; }
}

// ============================================================
// FONCTIONS D'ÉCRITURE
// ============================================================

async function appendRows(sheetName, rows) {
  await gapi.client.sheets.spreadsheets.values.append({
    spreadsheetId: SHEETS_CONFIG.spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    resource: { values: rows },
  });
}

async function updateCell(sheetName, row, col, value) {
  const range = `${sheetName}!${colToLetter(col)}${row}`;
  await gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: SHEETS_CONFIG.spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [[value]] },
  });
}

async function updateRange(sheetName, startRow, startCol, values) {
  const range = `${sheetName}!${colToLetter(startCol)}${startRow}`;
  await gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: SHEETS_CONFIG.spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    resource: { values },
  });
}

async function deleteRow(sheetName, rowIndex) {
  // Vider la ligne (l'API simple ne peut pas supprimer les lignes)
  const sheetRow  = rowIndex + 2;
  const emptyRow  = [new Array(30).fill('')];
  await updateRange(sheetName, sheetRow, 0, emptyRow);
}

// ---- SAUVEGARDER OPÉRATION CAISSE ----
async function saveCaisseOperation(op) {
  const row = new Array(18).fill('');
  row[COLS_CAISSE.source]       = op.source       || 'C1';
  row[COLS_CAISSE.date]         = op.date          || '';
  row[COLS_CAISSE.libelle]      = op.libelle       || '';
  row[COLS_CAISSE.debit]        = op.debit         || '';
  row[COLS_CAISSE.credit]       = op.credit        || '';
  row[COLS_CAISSE.periode]      = op.periode       || '';
  row[COLS_CAISSE.type_mvt]     = op.type_mvt      || '';
  row[COLS_CAISSE.type_comp]    = op.type_comp     || '';
  row[COLS_CAISSE.description]  = op.description   || '';
  row[COLS_CAISSE.nom]          = op.nom           || '';
  row[COLS_CAISSE.reglement]    = op.reglement     || '';
  row[COLS_CAISSE.nom_chat]     = op.nom_chat      || '';
  row[COLS_CAISSE.num_recu]     = op.num_recu      || '';
  row[COLS_CAISSE.num_bordereau]= op.num_bordereau || '';
  row[COLS_CAISSE.lien_facture] = op.lien_facture  || '';
  row[COLS_CAISSE.flag_check]   = 'FALSE';
  row[COLS_CAISSE.flag_comment] = '';
  await appendRows(SHEETS_CONFIG.sheets.caisse, [row]);
  await logAction('AJOUT', 'Caisse', op.libelle, `${op.date} — ${op.type_mvt} — ${op.credit || op.debit}€`);
  if (!Auth.isAdmin()) await sendAlert(Auth.getUser(), 'Caisse', op);
}

// ---- MODIFIER OPÉRATION CAISSE ----
async function updateCaisseOperation(rowIndex, op) {
  const sheetRow = rowIndex + 2;
  const row = new Array(18).fill('');
  row[COLS_CAISSE.source]       = op.source       || 'C1';
  row[COLS_CAISSE.date]         = op.date          || '';
  row[COLS_CAISSE.libelle]      = op.libelle       || '';
  row[COLS_CAISSE.debit]        = op.debit         || '';
  row[COLS_CAISSE.credit]       = op.credit        || '';
  row[COLS_CAISSE.periode]      = op.periode       || '';
  row[COLS_CAISSE.type_mvt]     = op.type_mvt      || '';
  row[COLS_CAISSE.type_comp]    = op.type_comp     || '';
  row[COLS_CAISSE.description]  = op.description   || '';
  row[COLS_CAISSE.nom]          = op.nom           || '';
  row[COLS_CAISSE.reglement]    = op.reglement     || '';
  row[COLS_CAISSE.nom_chat]     = op.nom_chat      || '';
  row[COLS_CAISSE.num_recu]     = op.num_recu      || '';
  row[COLS_CAISSE.lien_facture] = op.lien_facture  || '';
  row[COLS_CAISSE.flag_check]   = op.flag_check    || 'FALSE';
  row[COLS_CAISSE.flag_comment] = op.flag_comment  || '';
  await updateRange(SHEETS_CONFIG.sheets.caisse, sheetRow, 0, [row]);
  await logAction('MODIF', 'Caisse', op.libelle, `Modifié le ${todayFR()}`);
}

// ---- SAUVEGARDER OPÉRATION BANQUE ----
async function saveBanqueOperation(op) {
  const row = new Array(15).fill('');
  row[COLS_BANQUE.date]         = op.date          || '';
  row[COLS_BANQUE.libelle]      = op.libelle       || '';
  row[COLS_BANQUE.debit]        = op.debit         || '';
  row[COLS_BANQUE.credit]       = op.credit        || '';
  row[COLS_BANQUE.solde]        = op.solde         || '';
  row[COLS_BANQUE.periode]      = op.periode       || '';
  row[COLS_BANQUE.type_mvt]     = op.type_mvt      || '';
  row[COLS_BANQUE.type_comp]    = op.type_comp     || '';
  row[COLS_BANQUE.description]  = op.description   || '';
  row[COLS_BANQUE.nom]          = op.nom           || '';
  row[COLS_BANQUE.ref_cheque]   = op.ref_cheque    || '';
  row[COLS_BANQUE.ref_remise]   = op.ref_remise    || '';
  row[COLS_BANQUE.lien_facture] = op.lien_facture  || '';
  row[COLS_BANQUE.flag_check]   = 'FALSE';
  row[COLS_BANQUE.flag_comment] = '';
  await appendRows(SHEETS_CONFIG.sheets.banque, [row]);
  await logAction('AJOUT', 'Banque', op.libelle, `${op.date} — ${op.type_mvt} — ${op.credit || op.debit}€`);
  if (!Auth.isAdmin()) await sendAlert(Auth.getUser(), 'Banque', op);
}

// ---- MODIFIER OPÉRATION BANQUE ----
async function updateBanqueOperation(rowIndex, op) {
  const sheetRow = rowIndex + 2;
  const row = new Array(15).fill('');
  row[COLS_BANQUE.date]         = op.date          || '';
  row[COLS_BANQUE.libelle]      = op.libelle       || '';
  row[COLS_BANQUE.debit]        = op.debit         || '';
  row[COLS_BANQUE.credit]       = op.credit        || '';
  row[COLS_BANQUE.solde]        = op.solde         || '';
  row[COLS_BANQUE.periode]      = op.periode       || '';
  row[COLS_BANQUE.type_mvt]     = op.type_mvt      || '';
  row[COLS_BANQUE.type_comp]    = op.type_comp     || '';
  row[COLS_BANQUE.description]  = op.description   || '';
  row[COLS_BANQUE.nom]          = op.nom           || '';
  row[COLS_BANQUE.ref_cheque]   = op.ref_cheque    || '';
  row[COLS_BANQUE.ref_remise]   = op.ref_remise    || '';
  row[COLS_BANQUE.lien_facture] = op.lien_facture  || '';
  row[COLS_BANQUE.flag_check]   = op.flag_check    || 'FALSE';
  row[COLS_BANQUE.flag_comment] = op.flag_comment  || '';
  await updateRange(SHEETS_CONFIG.sheets.banque, sheetRow, 0, [row]);
  await logAction('MODIF', 'Banque', op.libelle, `Modifié le ${todayFR()}`);
}

// ---- SAUVEGARDER CHÈQUE ----
async function saveCheque(cheque) {
  const id  = cheque.id || genId('CHQ');
  const row = new Array(12).fill('');
  row[COLS_CHEQUE.id]            = id;
  row[COLS_CHEQUE.num_cheque]    = cheque.num_cheque    || '';
  row[COLS_CHEQUE.date_emission] = cheque.date_emission || '';
  row[COLS_CHEQUE.beneficiaire]  = cheque.beneficiaire  || '';
  row[COLS_CHEQUE.montant]       = cheque.montant       || '';
  row[COLS_CHEQUE.type_mvt]      = cheque.type_mvt      || '';
  row[COLS_CHEQUE.type_comp]     = cheque.type_comp     || '';
  row[COLS_CHEQUE.description]   = cheque.description   || '';
  row[COLS_CHEQUE.periode]       = cheque.periode       || '';
  row[COLS_CHEQUE.statut]        = 'en_attente';
  row[COLS_CHEQUE.date_encaiss]  = '';
  row[COLS_CHEQUE.ref_banque]    = '';
  await appendRows(SHEETS_CONFIG.sheets.cheques, [row]);
  await logAction('AJOUT', 'Cheques', cheque.beneficiaire, `N°${cheque.num_cheque} — ${cheque.montant}€`);
  return id;
}

// ---- ENCAISSER UN CHÈQUE (lors d'une op banque) ----
async function encaisserCheque(chequeRowIndex, dateBanque, refBanque) {
  const sheetRow = chequeRowIndex + 2;
  await updateCell(SHEETS_CONFIG.sheets.cheques, sheetRow, COLS_CHEQUE.statut,      'encaisse');
  await updateCell(SHEETS_CONFIG.sheets.cheques, sheetRow, COLS_CHEQUE.date_encaiss, dateBanque);
  await updateCell(SHEETS_CONFIG.sheets.cheques, sheetRow, COLS_CHEQUE.ref_banque,   refBanque);
  await logAction('MODIF', 'Cheques', `Ligne ${chequeRowIndex+1}`, `Encaissé le ${dateBanque}`);
}

// ---- SAUVEGARDER REMISE DE CHÈQUES ----
async function saveRemise(remise) {
  const id  = remise.id || genId('BRD');
  // Ligne principale remise
  const mainRow = new Array(9 + remise.cheques.length * 4).fill('');
  mainRow[COLS_REMISE.id]            = id;
  mainRow[COLS_REMISE.date_remise]   = remise.date_remise   || '';
  mainRow[COLS_REMISE.num_bordereau] = remise.num_bordereau || id;
  mainRow[COLS_REMISE.nb_cheques]    = remise.cheques.length;
  mainRow[COLS_REMISE.montant_total] = remise.cheques.reduce((s, c) => s + (parseFloat(c.montant)||0), 0);
  mainRow[COLS_REMISE.periode]       = remise.periode || '';
  mainRow[COLS_REMISE.statut]        = 'en_attente';
  mainRow[COLS_REMISE.date_encaiss]  = '';
  mainRow[COLS_REMISE.ref_banque]    = '';
  // Détail chèques
  remise.cheques.forEach((c, i) => {
    const base = COLS_REMISE.detail_start + i * 4;
    mainRow[base]     = c.type_mvt    || '';
    mainRow[base + 1] = c.montant     || '';
    mainRow[base + 2] = c.donateur    || '';
    mainRow[base + 3] = c.description || '';
  });
  await appendRows(SHEETS_CONFIG.sheets.remises, [mainRow]);
  await logAction('AJOUT', 'Remises', id, `${remise.cheques.length} chèque(s) — ${mainRow[COLS_REMISE.montant_total]}€`);
  return id;
}

// ---- ENCAISSER UNE REMISE ----
async function encaisserRemise(remiseRowIndex, dateBanque, refBanque) {
  const sheetRow = remiseRowIndex + 2;
  await updateCell(SHEETS_CONFIG.sheets.remises, sheetRow, COLS_REMISE.statut,       'encaissee');
  await updateCell(SHEETS_CONFIG.sheets.remises, sheetRow, COLS_REMISE.date_encaiss,  dateBanque);
  await updateCell(SHEETS_CONFIG.sheets.remises, sheetRow, COLS_REMISE.ref_banque,    refBanque);
  await logAction('MODIF', 'Remises', `Ligne ${remiseRowIndex+1}`, `Encaissée le ${dateBanque}`);
}

// ---- SAUVEGARDER FACTURE ----
async function saveFacture(facture) {
  const id  = facture.id || genId('FAC');
  const row = new Array(13).fill('');
  row[COLS_FACTURE.id]            = id;
  row[COLS_FACTURE.num_facture]   = facture.num_facture   || '';
  row[COLS_FACTURE.fournisseur]   = facture.fournisseur   || '';
  row[COLS_FACTURE.date_facture]  = facture.date_facture  || '';
  row[COLS_FACTURE.montant_ttc]   = facture.montant_ttc   || '';
  row[COLS_FACTURE.categorie]     = facture.categorie     || '';
  row[COLS_FACTURE.description]   = facture.description   || '';
  row[COLS_FACTURE.date_reglement]= facture.date_reglement|| '';
  row[COLS_FACTURE.mode_reglement]= facture.mode_reglement|| '';
  row[COLS_FACTURE.lien_pdf]      = facture.lien_pdf      || '';
  row[COLS_FACTURE.commentaire]   = facture.commentaire   || '';
  row[COLS_FACTURE.periode]       = facture.periode       || '';
  row[COLS_FACTURE.statut] = facture.statut || ''; 
  await appendRows(SHEETS_CONFIG.sheets.factures, [row]);
  await logAction('AJOUT', 'Factures', facture.fournisseur, `${facture.montant_ttc}€`);
  return id;
}

// ---- MODIFIER FACTURE ----
async function updateFacture(rowIndex, facture) {
  const sheetRow = rowIndex + 2;
  const row = new Array(13).fill('');
  row[COLS_FACTURE.id]            = facture.id            || '';
  row[COLS_FACTURE.num_facture]   = facture.num_facture   || '';
  row[COLS_FACTURE.fournisseur]   = facture.fournisseur   || '';
  row[COLS_FACTURE.date_facture]  = facture.date_facture  || '';
  row[COLS_FACTURE.montant_ttc]   = facture.montant_ttc   || '';
  row[COLS_FACTURE.categorie]     = facture.categorie     || '';
  row[COLS_FACTURE.description]   = facture.description   || '';
  row[COLS_FACTURE.date_reglement]= facture.date_reglement|| '';
  row[COLS_FACTURE.mode_reglement]= facture.mode_reglement|| '';
  row[COLS_FACTURE.lien_pdf]      = facture.lien_pdf      || '';
  row[COLS_FACTURE.commentaire]   = facture.commentaire   || '';
  row[COLS_FACTURE.periode]       = facture.periode       || '';
  row[COLS_FACTURE.statut] = facture.statut || '';
  await updateRange(SHEETS_CONFIG.sheets.factures, sheetRow, 0, [row]);
  await logAction('MODIF', 'Factures', facture.fournisseur, `Modifié le ${todayFR()}`);
}

// ---- CAISSE PHYSIQUE ----
async function saveCaissePhysique(numCaisse, comptage) {
  const sheet = numCaisse === 1 ? SHEETS_CONFIG.sheets.caisse1 : SHEETS_CONFIG.sheets.caisse2;
  const total = calculerTotalCaisse(comptage);
  const row = [
    comptage.date, comptage.mois,
    comptage.b500||0, comptage.b200||0, comptage.b100||0,
    comptage.b50||0,  comptage.b20||0,  comptage.b10||0, comptage.b5||0,
    comptage.p200||0, comptage.p100||0, comptage.p050||0,
    comptage.p020||0, comptage.p010||0, comptage.p005||0,
    comptage.p002||0, comptage.p001||0, total,
    comptage.commentaire || '',
  ];
  await appendRows(sheet, [row]);
  await logAction('AJOUT', `Caisse${numCaisse}_physique`, comptage.mois, `Total: ${total}€`);
}

// ---- FLAG ----
async function updateFlag(sheetName, rowIndex, isChecked, comment) {
  const colCheck   = sheetName === 'Caisse' ? COLS_CAISSE.flag_check   : COLS_BANQUE.flag_check;
  const colComment = sheetName === 'Caisse' ? COLS_CAISSE.flag_comment : COLS_BANQUE.flag_comment;
  const sheetRow   = rowIndex + 2;
  await updateCell(sheetName, sheetRow, colCheck,   isChecked ? 'TRUE' : 'FALSE');
  await updateCell(sheetName, sheetRow, colComment, comment || '');
  await logAction('MODIF', sheetName, `Ligne ${rowIndex+1}`, `Flag: ${isChecked}, Commentaire: ${comment}`);
}

// ============================================================
// JOURNAL
// ============================================================
async function logAction(action, onglet, reference, detail) {
  const user = Auth.getUser();
  if (!user) return;
  const row = [
    new Date().toLocaleString('fr-FR'),
    user.email, user.name, action, onglet, reference, detail,
    user.isAdmin ? 'OUI' : 'NON',
  ];
  try { await appendRows(SHEETS_CONFIG.sheets.journal, [row]); }
  catch(e) { console.warn('Journal non enregistré:', e); }
}

// ============================================================
// ALERTE EMAIL
// ============================================================
async function sendAlert(user, source, operation) {
  const cfg = JSON.parse(localStorage.getItem('arche_sheets_config') || '{}');
  const url = cfg.webhookUrl;
  if (!url || url.includes('VOTRE')) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: user.name, email: user.email, source, operation, timestamp: new Date().toISOString() }),
      mode: 'no-cors',
    });
  } catch(e) { console.warn('Alerte non envoyée:', e); }
}

// ============================================================
// CALCULS
// ============================================================
function calculerTotalCaisse(c) {
  return Math.round((
    (c.b500||0)*500 + (c.b200||0)*200 + (c.b100||0)*100 +
    (c.b50||0)*50   + (c.b20||0)*20   + (c.b10||0)*10   + (c.b5||0)*5 +
    (c.p200||0)*2   + (c.p100||0)*1   + (c.p050||0)*0.5 +
    (c.p020||0)*0.2 + (c.p010||0)*0.1 + (c.p005||0)*0.05 +
    (c.p002||0)*0.02 + (c.p001||0)*0.01
  ) * 100) / 100;
}

function detectDoublons(releveRows, existingRows) {
  return releveRows.map(releve => {
    const dateR    = normalizeDate(releve.date);
    const montantR = Math.abs(parseFloat(releve.montant || releve.debit || releve.credit) || 0);
    const doublon  = existingRows.find(e => {
      const dateE    = normalizeDate(e[COLS_BANQUE.date]);
      const montantE = Math.abs(parseFloat(e[COLS_BANQUE.debit] || e[COLS_BANQUE.credit]) || 0);
      return dateR === dateE && Math.abs(montantR - montantE) < 0.01;
    });
    return { ...releve, doublon: !!doublon };
  });
}

// ============================================================
// PÉRIODES ET PARAMÈTRES
// ============================================================
function getPeriodes() {
  const stored = localStorage.getItem('arche_periodes');
  if (stored) { try { return JSON.parse(stored); } catch(e) {} }
  const y = new Date().getFullYear();
  const m = new Date().getMonth() + 1;
  const start = m >= 9 ? y : y - 1;
  const periodes = [];
  for (let i = 2024; i <= start; i++) periodes.push(`${i} - ${i+1}`);
  return periodes;
}
function savePeriodes(p)         { localStorage.setItem('arche_periodes',    JSON.stringify(p)); }
function getCurrentPeriode() {
  const d = new Date(), y = d.getFullYear(), m = d.getMonth()+1;
  return m >= 9 ? `${y} - ${y+1}` : `${y-1} - ${y}`;
}
function getTypesMouvement() {
  const s = localStorage.getItem('arche_types_mvt');
  if (s) { try { return JSON.parse(s); } catch(e) {} }
  return ['Adoption','Don','Adhésion','Événement','Dépense alimentaire','Dépense vétérinaire','Dépense matériel','Dépense autre','Remboursement','Virement interne','Divers'];
}
function saveTypesMouvement(t)   { localStorage.setItem('arche_types_mvt',   JSON.stringify(t)); }

function getTypesComplementaires() {
  const s = localStorage.getItem('arche_types_comp');
  if (s) { try { return JSON.parse(s); } catch(e) {} }
  return ['Subvention','Parrainage','Vente en ligne','Collecte','Événement ponctuel','Urgence vétérinaire','Stérilisation','Vaccin','Médicaments','Matériel cage','Litière','Transport','Frais bancaires','Autre'];
}
function saveTypesComplementaires(t) { localStorage.setItem('arche_types_comp', JSON.stringify(t)); }

function getModesReglement() {
  const s = localStorage.getItem('arche_reglements');
  if (s) { try { return JSON.parse(s); } catch(e) {} }
  return ['Espèces','Chèque','Virement','CB','PayPal','Prélèvement','Autre'];
}
function saveModesReglement(m)   { localStorage.setItem('arche_reglements',  JSON.stringify(m)); }

// ============================================================
// UTILITAIRES
// ============================================================
function normalizeDate(dateStr) {
  if (!dateStr) return '';
  const s = String(dateStr).trim();
  // Nombre Excel (ex: 45940) → date
  const num = parseFloat(s);
  if (!isNaN(num) && num > 40000 && num < 60000) {
    const d = new Date(Math.round((num - 25569) * 86400 * 1000));
    return d.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' });
  }
  const parts = s.split(/[\/\-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) return `${parts[2].padStart(2,'0')}/${parts[1].padStart(2,'0')}/${parts[0]}`;
    return `${parts[0].padStart(2,'0')}/${parts[1].padStart(2,'0')}/${parts[2]}`;
  }
  return s;
}

function formatMoney(value) {
  if (value === '' || value === null || value === undefined) return '';
  const num = parseFloat(value);
  if (isNaN(num)) return '';
  return num.toLocaleString('fr-FR', { minimumFractionDigits:2, maximumFractionDigits:2 }) + ' €';
}

function colToLetter(col) {
  let letter = '', n = col;
  while (n >= 0) {
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

function todayISO()  { return new Date().toISOString().split('T')[0]; }
function todayFR()   { return new Date().toLocaleDateString('fr-FR'); }

function genId(prefix) {
  const d = new Date();
  return `${prefix}-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getTime()).slice(-5)}`;
}

function openFacture(fileIdOrUrl) {
  if (!fileIdOrUrl) return;
  const url = fileIdOrUrl.startsWith('http') ? fileIdOrUrl : `https://drive.google.com/file/d/${fileIdOrUrl}/view`;
  window.open(url, '_blank');
}

// ============================================================
// EXPORT
// ============================================================
window.Sheets = {
  config: SHEETS_CONFIG,
  cols: {
    caisse: COLS_CAISSE, banque: COLS_BANQUE,
    cheque: COLS_CHEQUE, remise: COLS_REMISE,
    facture: COLS_FACTURE, caissePhysique: COLS_CAISSE_PHYSIQUE, journal: COLS_JOURNAL,
  },
  // Lecture
  getCaisseOperations, getBanqueOperations, getCaissePhysique,
  getCheques, getRemises, getFactures, getJournal, getFormulairesData,
  // Écriture
  saveCaisseOperation,  updateCaisseOperation,
  saveBanqueOperation,  updateBanqueOperation,
  saveCaissePhysique,
  saveCheque,           encaisserCheque,
  saveRemise,           encaisserRemise,
  saveFacture,          updateFacture,
  updateFlag, appendRows, updateCell, updateRange, deleteRow,
  // Calculs
  calculerTotalCaisse, detectDoublons,
  // Paramètres
  getPeriodes, savePeriodes, getCurrentPeriode,
  getTypesMouvement, saveTypesMouvement,
  getTypesComplementaires, saveTypesComplementaires,
  getModesReglement, saveModesReglement,
  getDescriptions: () => { try { return JSON.parse(localStorage.getItem('arche_types_desc')||'[]'); } catch(e){ return []; } },
  // Utilitaires
  formatMoney, normalizeDate, todayISO, todayFR, genId, openFacture,
};
