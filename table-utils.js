// ============================================================
// UTILITAIRES TABLEAU : RESIZE + SCROLL FIXE EN HAUT
// Inclure après chaque renderTable()
// ============================================================

function initColResize(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;
  table.querySelectorAll('thead th').forEach(th => {
    if (th.querySelector('.col-resizer')) return;
    const r = document.createElement('div');
    r.className = 'col-resizer';
    th.appendChild(r);
    let startX, startW;
    r.addEventListener('mousedown', e => {
      e.preventDefault(); e.stopPropagation();
      startX = e.pageX; startW = th.offsetWidth;
      r.classList.add('resizing');
      const onMove = ev => {
        const newW = Math.max(40, startW + ev.pageX - startX);
        th.style.width = newW + 'px';
        th.style.minWidth = newW + 'px';
        syncScrollTop(tableId);
      };
      const onUp = () => {
        r.classList.remove('resizing');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        syncScrollTop(tableId);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });
  syncScrollTop(tableId);
}

function syncScrollTop(tableId) {
  const outer = document.getElementById(tableId + '-outer');
  if (!outer) return;
  const topBar  = outer.querySelector('.table-scroll-top');
  const body    = outer.querySelector('.table-scroll-body');
  const inner   = outer.querySelector('.table-scroll-top-inner');
  const table   = document.getElementById(tableId);
  if (!topBar || !body || !inner || !table) return;
  // Synchroniser la largeur de l'inner avec la largeur réelle du tableau
  inner.style.width = table.scrollWidth + 'px';
  // Synchroniser le scroll dans les deux sens
  topBar._syncing = false;
  body._syncing   = false;
  topBar.onscroll = () => {
    if (topBar._syncing) return;
    body._syncing = true;
    body.scrollLeft = topBar.scrollLeft;
    setTimeout(() => body._syncing = false, 0);
  };
  body.onscroll = () => {
    if (body._syncing) return;
    topBar._syncing = true;
    topBar.scrollLeft = body.scrollLeft;
    setTimeout(() => topBar._syncing = false, 0);
    syncScrollTop(tableId); // recalcule la largeur au scroll
  };
}
