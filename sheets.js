/* ============================================================
   sheets.js — Lecture / Écriture Google Sheets
   Arche de Mallo — Comptabilité
   ============================================================ */

// ---- CONFIGURATION ----
const SHEETS_CONFIG = {
  spreadsheetId:   '1KOuX0XnccyjPOPntOJUYzivk2jGn07y7tp__gRIN3F0',
  formulairesId:   '1y6yD4AohP7T10GE7mmguIqNWSnwla9t1mewBpCDej_Y',
  facturesDriveId: 'VOTRE_DOSSIER_DRIVE_ID',
  sheets: {
    caisse:       'Caisse',
    caisse_2:     'Caisse2',
    banque:       'Banque',
    caisse1:      'Caisse1_physique',
    caisse2:      'Caisse2_physique',
    config:       'Config',
    journal:      'Journal',
    cheques:      'Cheques',
    remises:      'Remises_cheques',
    factures:     'Factures',
    import_hist:  'Import_historique',
    import_rap:   'Import_Rapprochement',
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
  try {
    const cfg = JSON.parse(localStorage.getItem('arche_sheets_config') || '{}');
    if (cfg.spreadsheetId)   SHEETS_CONFIG.spreadsheetId   = cfg.spreadsheetId;
    if (cfg.formulairesId)   SHEETS_CONFIG.formulairesId   = cfg.formulairesId;
    if (cfg.facturesDriveId) SHEETS_CONFIG.facturesDriveId = cfg.facturesDriveId;
  } catch(e) {}
})();

// ============================================================
// DÉFINITION DES COLONNES
// ============================================================

const COLS_CAISSE = {
  source:       0,
  date:         1,
  libelle:      2,
  debit:        3,
  credit:       4,
  solde:        5,
  periode:      6,
  type_mvt:     7,
  type_comp:    8,
  description:  9,
  nom:          10,
  reglement:    11,
  nom_chat:     12,
  num_recu:     13,
  num_bordereau:14,
  lien_facture: 15,
  flag_check:   16,
  flag_comment: 17,
  suivi_ref:    18,  // S — Référence suivi / rapprochement banque
  fournisseur:  19,  // T — Fournisseur
};

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
  type_comp:      9,
  num_facture:    10,
  nom_chat:       11,
  num_don_fiscal: 12,
  flag_check:     13,
  ref_remise:     14,
  num_rem_espece: 15,
  ref_cheque:     16,
  lien_facture:   17,
  statut:         18,
  flag_comment:   19,
  suivi_ref:      20,
  fournisseur:    21,  // V — Fournisseur
};

const COLS_CHEQUE = {
  id:           0,
  num_cheque:   1,
  date_emission:2,
  beneficiaire: 3,
  montant:      4,
  type_mvt:     5,
  type_comp:    6,
  description:  7,
  periode:      8,
  statut:       9,
  date_encaiss: 10,
  ref_banque:   11,
  verified:     12,  // M — Vérifié
  fournisseur:  13,  // N — Fournisseur
};

const COLS_REMISE = {
  id:           0,
  date_remise:  1,
  num_bordereau:2,
  nb_cheques:   3,
  montant_total:4,
  periode:      5,
  statut:       6,
  date_encaiss: 7,
  ref_banque:   8,
  verified:     9,   // J — Vérifié (TRUE/FALSE) — colonne ajoutée dans le sheet
  detail_start: 10,  // K — Donateur1, Montant1, Chèque1, Type1, Desc1, LibComp1, Chat1, Reçu1…
};

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

const COLS_IMPORT_RAP = {
  id:                 0,
  onglet:             1,
  statut:             2,
  destination:        3,
  date:               4,
  periode:            5,
  libelle:            6,
  montant:            7,
  type_mvt:           8,
  mode_reglement:     9,
  nom_chat:           10,
  num_cheque:         11,
  num_recu:           12,
  description:        13,
  date_import:        14,
  date_rapprochement: 15,
};

// ============================================================
// CONFIG DEPUIS GOOGLE SHEET
// ============================================================
let _configSynced = false;

async function loadConfigFromSheet() {
  if (_configSynced) return;
  try {
    const rows = await readSheet(SHEETS_CONFIG.sheets.config);
    const keyMap = {
      periodes:        'arche_periodes',
      types_mvt:       'arche_types_mvt',
      types_desc:      'arche_types_desc',
      types_comp:      'arche_types_comp',
      reglements:      'arche_reglements',
      soldes_initiaux: 'arche_soldes_initiaux',
      periode_active:  'arche_periode',
      types_fourn:     'arche_types_fourn',
    };
    rows.forEach(r => {
      if (!r[0] || r[1] === undefined) return;
      const lsKey = keyMap[String(r[0]).trim()];
      if (lsKey) {
        const val = String(r[1]).trim();
        if (val) localStorage.setItem(lsKey, val);
      }
    });
    _configSynced = true;
  } catch(e) {
    console.warn('loadConfigFromSheet: fallback localStorage', e.message || e);
  }
}

async function saveConfigKey(key, value) {
  const json = JSON.stringify(value);
  try {
    const rows = await readSheet(SHEETS_CONFIG.sheets.config);
    const rowIdx = rows.findIndex(r => String(r[0]).trim() === key);
    if (rowIdx >= 0) {
      await updateRange(SHEETS_CONFIG.sheets.config, rowIdx + 1, 0, [[key, json]]);
    } else {
      await appendRows(SHEETS_CONFIG.sheets.config, [[key, json]]);
    }
  } catch(e) {
    console.warn('saveConfigKey sheet error:', e.message || e);
  }
}

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
  return readRange(spreadsheetId || SHEETS_CONFIG.spreadsheetId, `${sheetName}!A:CZ`);
}

async function getCaisse2Operations(periode) {
  const rows = await readSheet(SHEETS_CONFIG.sheets.caisse_2);
  const data = rows.length > 1 ? rows.slice(1) : [];
  data.forEach((r, i) => { r._sheetIndex = i; });
  return periode ? data.filter(r => r[COLS_CAISSE.periode] === periode) : data;
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
  data.forEach((r, i) => { r._sheetIndex = i; });
  return statut ? data.filter(r => r[COLS_CHEQUE.statut] === statut) : data;
}

async function getRemises(statut) {
  const rows = await readSheet(SHEETS_CONFIG.sheets.remises);
  const data = rows.length > 1 ? rows.slice(1) : [];
  data.forEach((r, i) => { r._sheetIndex = i; });
  return statut ? data.filter(r => r[COLS_REMISE.statut] === statut) : data;
}

async function getFactures() {
  const rows = await readSheet(SHEETS_CONFIG.sheets.factures);
  const data = rows.length > 1 ? rows.slice(1) : [];
  data.forEach((r, i) => { r._sheetIndex = i; });
  return data;
}

async function getJournal(limit) {
  const rows = await readSheet(SHEETS_CONFIG.sheets.journal);
  if (rows.length < 2) return [];
  return rows.slice(1).slice(-(limit || 500)).reverse();
}

async function getFormulairesData(type) {
  const sheetName = SHEETS_CONFIG.formulaires[type];
  if (!sheetName) return [];
  try { return await readSheet(sheetName, SHEETS_CONFIG.formulairesId); }
  catch(e) { return []; }
}

async function getImportRapprochement(statut) {
  const rows = await readSheet(SHEETS_CONFIG.sheets.import_rap);
  const data = rows.length > 1 ? rows.slice(1) : [];
  data.forEach((r, i) => { r._sheetIndex = i; });
  // Ignorer les lignes vides (après archivage)
  const nonEmpty = data.filter(r => r[COLS_IMPORT_RAP.id] && String(r[COLS_IMPORT_RAP.id]).trim());
  return statut ? nonEmpty.filter(r => r[COLS_IMPORT_RAP.statut] === statut) : nonEmpty;
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
  await updateRange(sheetName, rowIndex + 2, 0, [new Array(30).fill('')]);
}

async function toggleVerified(sheetKey, rowIndex, value) {
  const sheetName = SHEETS_CONFIG.sheets[sheetKey];
  const col = sheetKey === 'cheques' ? COLS_CHEQUE.verified
            : sheetKey === 'remises' ? COLS_REMISE.verified
            : null;
  if (col === null) return;
  await updateCell(sheetName, rowIndex + 2, col, value ? 'TRUE' : 'FALSE');
  await logAction('MODIF', sheetName, `Ligne ${rowIndex+1}`, `Vérifié: ${value}`);
}

// ---- CAISSE ----
async function saveCaisse2Operation(op) {
  const id  = op.id || genId('C2');
  const row = new Array(20).fill('');
  const cc  = COLS_CAISSE;
  row[cc.id]           = id;
  row[cc.date]         = op.date          || todayFR();
  row[cc.libelle]      = op.libelle       || '';
  row[cc.debit]        = op.debit         || '';
  row[cc.credit]       = op.credit        || '';
  row[cc.type_mvt]     = op.type_mvt      || '';
  row[cc.type_comp]    = op.type_comp     || '';
  row[cc.description]  = op.description   || '';
  row[cc.nom_chat]     = op.nom_chat      || '';
  row[cc.num_recu]     = op.num_recu      || '';
  row[cc.num_bordereau]= op.num_bordereau || '';
  row[cc.periode]      = op.periode       || '';
  row[cc.flag_check]   = 'FALSE';
  row[cc.flag_comment] = op.flag_comment  || '';
  row[cc.libelle_comp] = op.libelle_comp  || '';
  row[cc.num_facture]  = op.num_facture   || '';
  row[cc.num_don_fiscal]= op.num_don_fiscal|| '';
  row[cc.solde]        = '';
  row[cc.suivi_ref]    = op.suivi_ref     || '';
  row[cc.fournisseur]  = op.fournisseur   || '';
  await appendRows(SHEETS_CONFIG.sheets.caisse_2, [row]);
  await logAction('AJOUT', 'Caisse2', op.libelle, `${op.credit||op.debit||0} €`);
}

async function saveCaisseOperation(op) {
  const row = new Array(19).fill('');
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
  row[COLS_CAISSE.suivi_ref]    = op.suivi_ref     || '';
  row[COLS_CAISSE.fournisseur]  = op.fournisseur   || '';
  await appendRows(SHEETS_CONFIG.sheets.caisse, [row]);
  await logAction('AJOUT', 'Caisse', op.libelle, `${op.date} — ${op.type_mvt} — ${op.credit || op.debit}€`);
  if (!Auth.isAdmin()) await sendAlert(Auth.getUser(), 'Caisse', op);
}

async function updateCaisse2Operation(rowIndex, op) {
  const rows = await readSheet(SHEETS_CONFIG.sheets.caisse_2);
  const orig = rows[rowIndex + 1] || [];
  const row  = [...orig];
  const cc   = COLS_CAISSE;
  row[cc.date]         = op.date          || orig[cc.date]         || '';
  row[cc.libelle]      = op.libelle       || orig[cc.libelle]      || '';
  row[cc.debit]        = op.debit         || '';
  row[cc.credit]       = op.credit        || '';
  row[cc.type_mvt]     = op.type_mvt      || '';
  row[cc.type_comp]    = op.type_comp     || '';
  row[cc.description]  = op.description   || '';
  row[cc.nom_chat]     = op.nom_chat      || '';
  row[cc.num_recu]     = op.num_recu      || '';
  row[cc.num_bordereau]= op.num_bordereau || '';
  row[cc.periode]      = op.periode       || orig[cc.periode]      || '';
  row[cc.flag_comment] = op.flag_comment  || orig[cc.flag_comment] || '';
  row[cc.libelle_comp] = op.libelle_comp  || '';
  row[cc.num_facture]  = op.num_facture   || '';
  row[cc.num_don_fiscal]= op.num_don_fiscal|| '';
  row[cc.suivi_ref]    = op.suivi_ref     || '';
  row[cc.fournisseur]  = op.fournisseur   || '';
  const sheetRow = rowIndex + 2;
  await updateRange(SHEETS_CONFIG.sheets.caisse_2, sheetRow, 0, [row]);
  await logAction('MODIF', 'Caisse2', op.libelle, `Modifié le ${todayFR()}`);
}

async function updateCaisseOperation(rowIndex, op) {
  const sheetRow = rowIndex + 2;
  const row = new Array(19).fill('');
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
  row[COLS_CAISSE.flag_check]   = op.flag_check    || 'FALSE';
  row[COLS_CAISSE.flag_comment] = op.flag_comment  || '';
  row[COLS_CAISSE.suivi_ref]    = op.suivi_ref     || '';
  row[COLS_CAISSE.fournisseur]  = op.fournisseur   || '';
  await updateRange(SHEETS_CONFIG.sheets.caisse, sheetRow, 0, [row]);
  await logAction('MODIF', 'Caisse', op.libelle, `Modifié le ${todayFR()}`);
}

// ---- BANQUE ----
async function saveBanqueOperation(op) {
  const row = new Array(21).fill('');
  row[COLS_BANQUE.date]           = op.date           || '';
  row[COLS_BANQUE.libelle]        = op.libelle        || '';
  row[COLS_BANQUE.debit]          = op.debit          || '';
  row[COLS_BANQUE.credit]         = op.credit         || '';
  row[COLS_BANQUE.solde]          = op.solde          || '';
  row[COLS_BANQUE.periode]        = op.periode        || '';
  row[COLS_BANQUE.type_mvt]       = op.type_mvt       || '';
  row[COLS_BANQUE.description]    = op.description    || '';
  row[COLS_BANQUE.nom]            = op.nom            || '';
  row[COLS_BANQUE.type_comp]      = op.type_comp      || '';
  row[COLS_BANQUE.num_facture]    = op.num_facture    || '';
  row[COLS_BANQUE.nom_chat]       = op.nom_chat       || '';
  row[COLS_BANQUE.num_don_fiscal] = op.num_don_fiscal || '';
  row[COLS_BANQUE.flag_check]     = 'FALSE';
  row[COLS_BANQUE.ref_remise]     = op.ref_remise     || '';
  row[COLS_BANQUE.num_rem_espece] = op.num_rem_espece || '';
  row[COLS_BANQUE.ref_cheque]     = op.ref_cheque     || '';
  row[COLS_BANQUE.lien_facture]   = op.lien_facture   || '';
  row[COLS_BANQUE.statut]         = op.statut         || '';
  row[COLS_BANQUE.flag_comment]   = '';
  row[COLS_BANQUE.suivi_ref]      = op.suivi_ref      || '';
  row[COLS_BANQUE.fournisseur]    = op.fournisseur    || '';
  await appendRows(SHEETS_CONFIG.sheets.banque, [row]);
  await logAction('AJOUT', 'Banque', op.libelle, `${op.date} — ${op.type_mvt} — ${op.credit || op.debit}€`);
  if (!Auth.isAdmin()) await sendAlert(Auth.getUser(), 'Banque', op);
}

async function updateBanqueOperation(rowIndex, op) {
  const sheetRow = rowIndex + 2;
  const row = new Array(21).fill('');
  row[COLS_BANQUE.date]           = op.date           || '';
  row[COLS_BANQUE.libelle]        = op.libelle        || '';
  row[COLS_BANQUE.debit]          = op.debit          || '';
  row[COLS_BANQUE.credit]         = op.credit         || '';
  row[COLS_BANQUE.solde]          = op.solde          || '';
  row[COLS_BANQUE.periode]        = op.periode        || '';
  row[COLS_BANQUE.type_mvt]       = op.type_mvt       || '';
  row[COLS_BANQUE.description]    = op.description    || '';
  row[COLS_BANQUE.nom]            = op.nom            || '';
  row[COLS_BANQUE.type_comp]      = op.type_comp      || '';
  row[COLS_BANQUE.num_facture]    = op.num_facture    || '';
  row[COLS_BANQUE.nom_chat]       = op.nom_chat       || '';
  row[COLS_BANQUE.num_don_fiscal] = op.num_don_fiscal || '';
  row[COLS_BANQUE.flag_check]     = op.flag_check     || 'FALSE';
  row[COLS_BANQUE.ref_remise]     = op.ref_remise     || '';
  row[COLS_BANQUE.num_rem_espece] = op.num_rem_espece || '';
  row[COLS_BANQUE.ref_cheque]     = op.ref_cheque     || '';
  row[COLS_BANQUE.lien_facture]   = op.lien_facture   || '';
  row[COLS_BANQUE.statut]         = op.statut         || '';
  row[COLS_BANQUE.flag_comment]   = op.flag_comment   || '';
  row[COLS_BANQUE.suivi_ref]      = op.suivi_ref      || '';
  row[COLS_BANQUE.fournisseur]    = op.fournisseur    || '';
  await updateRange(SHEETS_CONFIG.sheets.banque, sheetRow, 0, [row]);
  await logAction('MODIF', 'Banque', op.libelle, `Modifié le ${todayFR()}`);
}

// ---- CHÈQUES ----
async function saveCheque(cheque) {
  const id  = cheque.id || genId('CHQ');
  const row = new Array(13).fill('');
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
  row[COLS_CHEQUE.verified]      = 'FALSE';
  row[COLS_CHEQUE.fournisseur]   = cheque.fournisseur   || '';
  await appendRows(SHEETS_CONFIG.sheets.cheques, [row]);
  await logAction('AJOUT', 'Cheques', cheque.beneficiaire, `N°${cheque.num_cheque} — ${cheque.montant}€`);
  return id;
}

async function updateCheque(rowIndex, cheque) {
  const sheetRow = rowIndex + 2;
  const row = new Array(13).fill('');
  row[COLS_CHEQUE.id]            = cheque.id            || '';
  row[COLS_CHEQUE.num_cheque]    = cheque.num_cheque    || '';
  row[COLS_CHEQUE.date_emission] = cheque.date_emission || '';
  row[COLS_CHEQUE.beneficiaire]  = cheque.beneficiaire  || '';
  row[COLS_CHEQUE.montant]       = cheque.montant       || '';
  row[COLS_CHEQUE.type_mvt]      = cheque.type_mvt      || '';
  row[COLS_CHEQUE.type_comp]     = cheque.type_comp     || '';
  row[COLS_CHEQUE.description]   = cheque.description   || '';
  row[COLS_CHEQUE.periode]       = cheque.periode       || '';
  row[COLS_CHEQUE.statut]        = cheque.statut        || 'en_attente';
  row[COLS_CHEQUE.date_encaiss]  = cheque.date_encaiss  || '';
  row[COLS_CHEQUE.ref_banque]    = cheque.ref_banque    || '';
  row[COLS_CHEQUE.verified]      = cheque.verified      || 'FALSE';
  row[COLS_CHEQUE.fournisseur]   = cheque.fournisseur   || '';
  await updateRange(SHEETS_CONFIG.sheets.cheques, sheetRow, 0, [row]);
  await logAction('MODIF', 'Cheques', cheque.beneficiaire, `Modifié le ${todayFR()}`);
}

async function encaisserCheque(chequeRowIndex, dateBanque, refBanque) {
  const sheetRow = chequeRowIndex + 2;
  await updateCell(SHEETS_CONFIG.sheets.cheques, sheetRow, COLS_CHEQUE.statut,       'encaisse');
  await updateCell(SHEETS_CONFIG.sheets.cheques, sheetRow, COLS_CHEQUE.date_encaiss,  dateBanque);
  await updateCell(SHEETS_CONFIG.sheets.cheques, sheetRow, COLS_CHEQUE.ref_banque,    refBanque);
  await logAction('MODIF', 'Cheques', `Ligne ${chequeRowIndex+1}`, `Encaissé le ${dateBanque}`);
}

// ---- REMISES ----
async function saveRemise(remise) {
  const id  = remise.id || genId('BRD');
  const mainRow = new Array(10 + remise.cheques.length * 8).fill('');
  mainRow[COLS_REMISE.id]            = id;
  mainRow[COLS_REMISE.date_remise]   = remise.date_remise   || '';
  mainRow[COLS_REMISE.num_bordereau] = remise.num_bordereau || id;
  mainRow[COLS_REMISE.nb_cheques]    = remise.cheques.length;
  mainRow[COLS_REMISE.montant_total] = remise.cheques.reduce((s,c) => s+(parseFloat(c.montant)||0), 0);
  mainRow[COLS_REMISE.periode]       = remise.periode || '';
  mainRow[COLS_REMISE.statut]        = 'en_attente';
  mainRow[COLS_REMISE.date_encaiss]  = '';
  mainRow[COLS_REMISE.ref_banque]    = '';
  mainRow[COLS_REMISE.verified]      = 'FALSE';
  remise.cheques.forEach((c, i) => {
    const base = COLS_REMISE.detail_start + i * 8;
    mainRow[base]     = c.donateur    || '';
    mainRow[base + 1] = c.montant     || '';
    mainRow[base + 2] = c.num_cheque  || '';
    mainRow[base + 3] = c.type_mvt    || '';
    mainRow[base + 4] = c.description || '';
    mainRow[base + 5] = c.type_comp   || '';
    mainRow[base + 6] = c.nom_chat    || '';
    mainRow[base + 7] = c.recu_fiscal || '';
  });
  await appendRows(SHEETS_CONFIG.sheets.remises, [mainRow]);
  await logAction('AJOUT', 'Remises', id, `${remise.cheques.length} chèque(s) — ${mainRow[COLS_REMISE.montant_total]}€`);
  return id;
}

async function encaisserRemise(remiseRowIndex, dateBanque, refBanque) {
  const sheetRow = remiseRowIndex + 2;
  await updateCell(SHEETS_CONFIG.sheets.remises, sheetRow, COLS_REMISE.statut,       'encaissee');
  await updateCell(SHEETS_CONFIG.sheets.remises, sheetRow, COLS_REMISE.date_encaiss,  dateBanque);
  await updateCell(SHEETS_CONFIG.sheets.remises, sheetRow, COLS_REMISE.ref_banque,    refBanque);
  await logAction('MODIF', 'Remises', `Ligne ${remiseRowIndex+1}`, `Encaissée le ${dateBanque}`);
}

async function updateRemise(rowIndex, remise) {
  const id = remise.id || genId('BRD');
  const sheetRow = rowIndex + 2;
  const mainRow = new Array(10 + remise.cheques.length * 8).fill('');
  mainRow[COLS_REMISE.id]            = id;
  mainRow[COLS_REMISE.date_remise]   = remise.date_remise   || '';
  mainRow[COLS_REMISE.num_bordereau] = remise.num_bordereau || id;
  mainRow[COLS_REMISE.nb_cheques]    = remise.cheques.length;
  mainRow[COLS_REMISE.montant_total] = remise.cheques.reduce((s,c) => s+(parseFloat(c.montant)||0), 0);
  mainRow[COLS_REMISE.periode]       = remise.periode || '';
  mainRow[COLS_REMISE.statut]        = remise.statut  || 'en_attente';
  mainRow[COLS_REMISE.date_encaiss]  = remise.date_encaiss || '';
  mainRow[COLS_REMISE.ref_banque]    = remise.ref_banque    || '';
  mainRow[COLS_REMISE.verified]      = remise.verified      || 'FALSE';
  remise.cheques.forEach((c, i) => {
    const base = COLS_REMISE.detail_start + i * 8;
    mainRow[base]     = c.donateur    || '';
    mainRow[base + 1] = c.montant     || '';
    mainRow[base + 2] = c.num_cheque  || '';
    mainRow[base + 3] = c.type_mvt    || '';
    mainRow[base + 4] = c.description || '';
    mainRow[base + 5] = c.type_comp   || '';
    mainRow[base + 6] = c.nom_chat    || '';
    mainRow[base + 7] = c.recu_fiscal || '';
  });
  await updateRange(SHEETS_CONFIG.sheets.remises, sheetRow, 0, [mainRow]);
  await logAction('MODIF', 'Remises', id, `Modifié le ${todayFR()}`);
}

// ---- FACTURES ----
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
  row[COLS_FACTURE.statut]        = facture.statut        || '';
  await appendRows(SHEETS_CONFIG.sheets.factures, [row]);
  await logAction('AJOUT', 'Factures', facture.fournisseur, `${facture.montant_ttc}€`);
  return id;
}

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
  row[COLS_FACTURE.statut]        = facture.statut        || '';
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
  await logAction('MODIF', sheetName, `Ligne ${rowIndex+1}`, `Flag: ${isChecked}`);
}

// ---- RAPPROCHEMENT CAISSE ----
async function rapprocheCaisseOperation(rowIndex, refBanque) {
  const sheetRow = rowIndex + 2;
  await updateCell(SHEETS_CONFIG.sheets.caisse, sheetRow, COLS_CAISSE.suivi_ref, refBanque || 'Banque');
  await logAction('MODIF', 'Caisse', `Ligne ${rowIndex+1}`, 'Rapproché avec banque');
}

// ============================================================
// IMPORT RAPPROCHEMENT
// ============================================================

async function saveImportRapprochement(op) {
  const ci = COLS_IMPORT_RAP;
  const row = new Array(16).fill('');
  row[ci.id]             = op.id            || '';
  row[ci.onglet]         = op.onglet        || '';
  row[ci.statut]         = 'en_attente';
  row[ci.destination]    = op.destination   || '';
  row[ci.date]           = op.date          || '';
  row[ci.periode]        = op.periode       || '';
  row[ci.libelle]        = op.libelle       || '';
  row[ci.montant]        = op.montant       || '';
  row[ci.type_mvt]       = op.type_mvt      || '';
  row[ci.mode_reglement] = op.mode_reglement|| '';
  row[ci.nom_chat]       = op.nom_chat      || '';
  row[ci.num_cheque]     = op.num_cheque    || '';
  row[ci.num_recu]       = op.num_recu      || '';
  row[ci.description]    = op.description   || '';
  row[ci.date_import]    = todayFR();
  row[ci.date_rapprochement] = '';
  await appendRows(SHEETS_CONFIG.sheets.import_rap, [row]);
  await logAction('AJOUT', 'Import_Rapprochement', op.id, `${op.onglet} — ${op.libelle} — ${op.montant}€`);
}

async function updateImportRapprochement(rowIndex, op) {
  const ci = COLS_IMPORT_RAP;
  const sheetRow = rowIndex + 2;
  const row = new Array(16).fill('');
  row[ci.id]             = op.id            || '';
  row[ci.onglet]         = op.onglet        || '';
  row[ci.statut]         = op.statut        || 'en_attente';
  row[ci.destination]    = op.destination   || '';
  row[ci.date]           = op.date          || '';
  row[ci.periode]        = op.periode       || '';
  row[ci.libelle]        = op.libelle       || '';
  row[ci.montant]        = op.montant       || '';
  row[ci.type_mvt]       = op.type_mvt      || '';
  row[ci.mode_reglement] = op.mode_reglement|| '';
  row[ci.nom_chat]       = op.nom_chat      || '';
  row[ci.num_cheque]     = op.num_cheque    || '';
  row[ci.num_recu]       = op.num_recu      || '';
  row[ci.description]    = op.description   || '';
  row[ci.date_import]    = op.date_import   || '';
  row[ci.date_rapprochement] = op.date_rapprochement || '';
  await updateRange(SHEETS_CONFIG.sheets.import_rap, sheetRow, 0, [row]);
  await logAction('MODIF', 'Import_Rapprochement', op.id, `Modifié le ${todayFR()}`);
}

async function archiverImportRapprochement(rowIndex, datRapprochement) {
  const rows = await readSheet(SHEETS_CONFIG.sheets.import_rap);
  const r = rows[rowIndex + 1];
  if (!r) return;
  const hist = [...r];
  hist[COLS_IMPORT_RAP.statut]             = 'rapprochee';
  hist[COLS_IMPORT_RAP.date_rapprochement] = datRapprochement || todayFR();
  await appendRows(SHEETS_CONFIG.sheets.import_hist, [hist]);
  await updateRange(SHEETS_CONFIG.sheets.import_rap, rowIndex + 2, 0, [new Array(16).fill('')]);
  await logAction('MODIF', 'Import_Rapprochement', r[COLS_IMPORT_RAP.id] || '', 'Archivé');
}

async function importRapExistsId(id) {
  try {
    const [rap, hist] = await Promise.all([
      readSheet(SHEETS_CONFIG.sheets.import_rap),
      readSheet(SHEETS_CONFIG.sheets.import_hist),
    ]);
    const ci = COLS_IMPORT_RAP;
    const allRows = [...(rap.slice(1)), ...(hist.slice(1))];
    return allRows.some(r => r[ci.id] && String(r[ci.id]) === String(id));
  } catch(e) {
    console.warn('importRapExistsId error:', e);
    return false; // En cas d'erreur, on laisse passer pour ne pas bloquer
  }
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
// SOLDES INITIAUX
// ============================================================
function getSoldeInitial(periode, compte) {
  try {
    const cfg = JSON.parse(localStorage.getItem('arche_soldes_initiaux') || '{}');
    return parseFloat(cfg?.[periode]?.[compte] || 0) || 0;
  } catch(e) { return 0; }
}

async function saveSoldeInitial(periode, compte, montant) {
  try {
    const cfg = JSON.parse(localStorage.getItem('arche_soldes_initiaux') || '{}');
    if (!cfg[periode]) cfg[periode] = {};
    cfg[periode][compte] = parseFloat(montant) || 0;
    cfg[periode].date    = todayFR();
    localStorage.setItem('arche_soldes_initiaux', JSON.stringify(cfg));
    await saveConfigKey('soldes_initiaux', cfg);
  } catch(e) { console.warn('saveSoldeInitial error:', e); }
}

async function saveSoldesInitiauxBatch(periode, soldes) {
  try {
    const cfg = JSON.parse(localStorage.getItem('arche_soldes_initiaux') || '{}');
    cfg[periode] = { ...soldes, date: todayFR() };
    localStorage.setItem('arche_soldes_initiaux', JSON.stringify(cfg));
    await saveConfigKey('soldes_initiaux', cfg);
  } catch(e) { console.warn('saveSoldesInitiauxBatch error:', e); }
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
// PARAMÈTRES
// ============================================================
function getPeriodes() {
  const s = localStorage.getItem('arche_periodes');
  if (s) { try { const p = JSON.parse(s); if (p.length) return p; } catch(e) {} }
  const y = new Date().getFullYear(), m = new Date().getMonth() + 1;
  const start = m >= 9 ? y : y - 1;
  const periodes = [];
  for (let i = 2024; i <= start; i++) periodes.push(`${i} - ${i+1}`);
  return periodes;
}
async function savePeriodes(p) {
  localStorage.setItem('arche_periodes', JSON.stringify(p));
  await saveConfigKey('periodes', p);
}

function getCurrentPeriode() {
  const s = localStorage.getItem('arche_periode');
  if (s && s !== 'undefined') return s;
  const d = new Date(), y = d.getFullYear(), m = d.getMonth()+1;
  return m >= 9 ? `${y} - ${y+1}` : `${y-1} - ${y}`;
}
async function setCurrentPeriode(p) {
  localStorage.setItem('arche_periode', p);
  await saveConfigKey('periode_active', p);
}

function getTypesMouvement() {
  const s = localStorage.getItem('arche_types_mvt');
  if (s) { try { return JSON.parse(s); } catch(e) {} }
  return ['Adoption','Don','Adhésion','Événement','Dépense alimentaire','Dépense vétérinaire','Dépense matériel','Dépense autre','Remboursement','Virement interne','Divers'];
}
async function saveTypesMouvement(t) {
  localStorage.setItem('arche_types_mvt', JSON.stringify(t));
  await saveConfigKey('types_mvt', t);
}

function getTypesComplementaires() {
  const s = localStorage.getItem('arche_types_comp');
  if (s) { try { return JSON.parse(s); } catch(e) {} }
  return ['Subvention','Parrainage','Vente en ligne','Collecte','Événement ponctuel','Urgence vétérinaire','Stérilisation','Vaccin','Médicaments','Matériel cage','Litière','Transport','Frais bancaires','Autre'];
}
async function saveTypesComplementaires(t) {
  localStorage.setItem('arche_types_comp', JSON.stringify(t));
  await saveConfigKey('types_comp', t);
}

function getModesReglement() {
  const s = localStorage.getItem('arche_reglements');
  if (s) { try { return JSON.parse(s); } catch(e) {} }
  return ['Espèces','Chèque','Virement','CB','PayPal','Prélèvement','Autre'];
}
async function saveModesReglement(m) {
  localStorage.setItem('arche_reglements', JSON.stringify(m));
  await saveConfigKey('reglements', m);
}

function getDescriptions() {
  const s = localStorage.getItem('arche_types_desc');
  if (s) { try { return JSON.parse(s); } catch(e) {} }
  return [];
}
async function saveDescriptions(arr) {
  localStorage.setItem('arche_types_desc', JSON.stringify(arr));
  await saveConfigKey('types_desc', arr);
}

function getFournisseurs() {
  const s = localStorage.getItem('arche_types_fourn');
  if (s) { try { return JSON.parse(s); } catch(e) {} }
  return [];
}
async function saveFournisseurs(arr) {
  arr = [...arr].sort((a,b) => a.localeCompare(b,'fr',{sensitivity:'base'}));
  localStorage.setItem('arche_types_fourn', JSON.stringify(arr));
  await saveConfigKey('types_fourn', arr);
}

// ============================================================
// UTILITAIRES
// ============================================================
function normalizeDate(dateStr) {
  if (!dateStr) return '';
  const s = String(dateStr).trim();
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
    facture: COLS_FACTURE, caissePhysique: COLS_CAISSE_PHYSIQUE,
    journal: COLS_JOURNAL, importRap: COLS_IMPORT_RAP,
  },
  // Config sheet
  loadConfigFromSheet, saveConfigKey,
  // Lecture
  readSheet,
  getCaisseOperations, getCaisse2Operations,
  saveCaisse2Operation, updateCaisse2Operation,
  getBanqueOperations, getCaissePhysique,
  getCheques, getRemises, getFactures, getJournal, getFormulairesData,
  getImportRapprochement,
  // Écriture
  saveCaisseOperation,  updateCaisseOperation,
  saveBanqueOperation,  updateBanqueOperation,
  saveCaissePhysique,
  saveCheque, updateCheque, encaisserCheque,
  saveRemise, encaisserRemise, updateRemise,
  saveFacture, updateFacture,
  saveImportRapprochement, updateImportRapprochement,
  archiverImportRapprochement, importRapExistsId,
  updateFlag, toggleVerified, appendRows, updateCell, updateRange, deleteRow,
  logAction, rapprocheCaisseOperation,
  // Soldes
  getSoldeInitial, saveSoldeInitial, saveSoldesInitiauxBatch,
  // Calculs
  calculerTotalCaisse, detectDoublons,
  // Paramètres
  getPeriodes, savePeriodes, getCurrentPeriode, setCurrentPeriode,
  getTypesMouvement, saveTypesMouvement,
  getTypesComplementaires, saveTypesComplementaires,
  getModesReglement, saveModesReglement,
  getDescriptions, saveDescriptions,
  getFournisseurs, saveFournisseurs,
  // Utilitaires
  formatMoney, normalizeDate, todayISO, todayFR, genId, openFacture,
};
