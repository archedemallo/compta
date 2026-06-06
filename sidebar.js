/* ============================================================
   sidebar.js — Composant sidebar commun à toutes les pages
   ============================================================ */

function buildSidebar(activePage) {
  const periodes = Sheets.getPeriodes();
  const current  = Sheets.getCurrentPeriode();
  const stored   = localStorage.getItem('arche_periode') || current;

  const nav = [
    { section: 'Tableau de bord' },
    { id: 'dashboard', label: 'Vue générale',       icon: 'ti-chart-bar',      href: 'index.html' },

    { section: 'Comptabilité' },
    { id: 'caisse',    label: 'Caisse1 — saisie',    icon: 'ti-cash',           href: 'caisse.html' },
    { id: 'caisse2',    label: 'Caisse2 — saisie',    icon: 'ti-cash',           href: 'caisse2.html' }, 
    { id: 'banque',    label: 'Banque — saisie',    icon: 'ti-building-bank',  href: 'banque.html' },
    { id: 'cheques',       label: 'Chèques émis',      icon: 'ti-writing',        href: 'cheques.html' },
    { id: 'remisecheques', label: 'Remises de chèques', icon: 'ti-stack',          href: 'remisecheques.html' },
    { id: 'factures',  label: 'Factures',            icon: 'ti-file-invoice',   href: 'factures.html' },
    { id: 'import',    label: 'Import relevé',       icon: 'ti-upload',         href: 'import.html' },

    { section: 'Caisses physiques' },
    { id: 'caisse1physique',   label: 'Caisse 1',           icon: 'ti-safe',           href: 'caisse-physique.html' },
    { id: 'caisse2physique',   label: 'Caisse 2',           icon: 'ti-safe',           href: 'caisse-physique2.html' },

    { section: 'Partage' },
    { id: 'synthese',  label: 'Vue synthèse',       icon: 'ti-eye',            href: 'synthese.html' },
    { id: 'alertes',   label: 'Journal / Alertes',  icon: 'ti-bell',           href: 'alertes.html', badge: true, adminOnly: true },

    { section: 'Administration' },
    { id: 'config',    label: 'Configuration',      icon: 'ti-settings',       href: 'config.html' },
  ];

  // Options du sélecteur de période
  const periodeOptions = periodes.map(p =>
    `<option value="${p}" ${p === stored ? 'selected' : ''}>${p}</option>`
  ).join('');

  // Items de navigation
  const navItems = nav.map(item => {
    if (item.section) {
      return `<div class="nav-section">${item.section}</div>`;
    }
    // Masquer les items admin si non-admin
    if (item.adminOnly) {
      try {
        const user = Auth.getUser();
        if (!user || !user.isAdmin) return '';
      } catch(e) { return ''; }
    }
    const isActive = item.id === activePage;
    const badge    = item.badge ? `<span class="nav-badge" id="badge-alertes">0</span>` : '';
    return `
      <a class="nav-item ${isActive ? 'active' : ''}" href="${item.href}" data-page="${item.id}">
        <i class="ti ${item.icon}"></i>
        ${item.label}
        ${badge}
      </a>`;
  }).join('');

  const html = `
    <div class="sidebar-logo">
      <div class="sidebar-logo-title">L'Arche de Mallo</div>
      <div class="sidebar-logo-sub">Gestion comptable</div>
    </div>

    <div class="sidebar-period" onclick="togglePeriodePicker()">
      <div>
        <div class="sidebar-period-label">Période active</div>
        <div class="sidebar-period-value" id="sidebar-period-display">${stored}</div>
      </div>
      <i class="ti ti-chevron-down sidebar-period-arrow" id="sidebar-period-arrow"></i>
    </div>
    <div id="sidebar-period-picker" style="display:none; padding:6px 10px;">
      <select onchange="setPeriode(this.value)" style="width:100%;font-size:11px;padding:5px 8px;border-radius:var(--radius-sm);border:0.5px solid var(--side-border);background:rgba(255,255,255,0.1);color:var(--side-text);">
        ${periodeOptions}
      </select>
    </div>

    ${navItems}

    <div class="sidebar-footer">
      <div class="sidebar-update">
        Dernière mise à jour
        <span id="sidebar-last-update">—</span>
      </div>
      <div class="sidebar-user">
        <div class="sidebar-avatar" id="sidebar-avatar">?</div>
        <span class="sidebar-username" id="sidebar-username">…</span>
      </div>
      <button id="sidebar-logout" onclick="Auth.signOut()" style="
        display:flex; align-items:center; justify-content:center; gap:8px;
        width:100%; margin-top:10px; padding:8px 12px;
        background:rgba(255,255,255,0.1); border:0.5px solid rgba(255,255,255,0.2);
        border-radius:var(--radius-sm); color:var(--side-text); font-size:12px;
        font-family:'DM Sans',sans-serif; font-weight:500; cursor:pointer;
        transition:all 0.15s;
      " onmouseover="this.style.background='rgba(255,255,255,0.2)'"
         onmouseout="this.style.background='rgba(255,255,255,0.1)'">
        <i class="ti ti-logout" style="font-size:15px;"></i> Déconnexion
      </button>
    </div>`;

  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.innerHTML = html;
}

// ---- PÉRIODE ----
function setPeriode(value) {
  localStorage.setItem('arche_periode', value);
  const display = document.getElementById('sidebar-period-display');
  if (display) display.textContent = value;
  // Recharger les données de la page courante
  if (typeof onPeriodeChange === 'function') onPeriodeChange(value);
}

function getActivePeriode() {
  return localStorage.getItem('arche_periode') || Sheets.getCurrentPeriode();
}

function togglePeriodePicker() {
  const picker = document.getElementById('sidebar-period-picker');
  const arrow  = document.getElementById('sidebar-period-arrow');
  if (!picker) return;
  const isOpen = picker.style.display !== 'none';
  picker.style.display = isOpen ? 'none' : 'block';
  if (arrow) arrow.style.transform = isOpen ? '' : 'rotate(180deg)';
}

// ---- DERNIÈRE MISE À JOUR ----
function setLastUpdate(dateStr) {
  const el = document.getElementById('sidebar-last-update');
  if (el) el.textContent = dateStr || new Date().toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
}

// ---- BADGE ALERTES ----
function setBadgeAlertes(count) {
  const el = document.getElementById('badge-alertes');
  if (!el) return;
  el.textContent = count;
  el.style.display = count > 0 ? 'inline-block' : 'none';
}

window.Sidebar = { build: buildSidebar, setPeriode, getActivePeriode, setLastUpdate, setBadgeAlertes };
