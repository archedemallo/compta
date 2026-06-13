/* ============================================================
   table-utils.js — Resize colonnes + scroll fixe en haut
   À inclure dans toutes les pages avec tableaux
   ============================================================ */

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
        th.style.width    = newW + 'px';
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
  const outer  = document.getElementById(tableId + '-outer');
  if (!outer) return;
  const topBar = outer.querySelector('.tbl-scroll-top');
  const body   = outer.querySelector('.tbl-scroll-body');
  const inner  = outer.querySelector('.tbl-scroll-top-inner');
  const table  = document.getElementById(tableId);
  if (!topBar || !body || !inner || !table) return;

  inner.style.width = table.scrollWidth + 'px';

  if (!topBar._syncInit) {
    topBar._syncInit = true;
    topBar.addEventListener('scroll', () => {
      if (topBar._syncing) return;
      body._syncing = true;
      body.scrollLeft = topBar.scrollLeft;
      requestAnimationFrame(() => { body._syncing = false; });
    });
    body.addEventListener('scroll', () => {
      if (body._syncing) return;
      topBar._syncing = true;
      topBar.scrollLeft = body.scrollLeft;
      requestAnimationFrame(() => { topBar._syncing = false; });
      syncScrollTop(tableId);
    });
  }
}
