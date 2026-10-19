(function () {
  'use strict';
  const EEE = window.EEE;
  if (!EEE) return;
  const { db, $, el, money } = EEE;

  const START = [1, 8, 15, 22, 29];
  const ORD = ['1st', '2nd', '3rd', '4th', '5th'];
  const pad = n => String(n).padStart(2, '0');
  const dim = (y, m) => new Date(y, m, 0).getDate();
  function today() {
    const p = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' }).split('-').map(Number);
    return { y: p[0], m: p[1], d: p[2] };
  }
  function curWeek() {
    const t = today();
    let idx = 0;
    START.forEach((day, i) => { if (day <= t.d) idx = i; });
    return { iso: t.y + '-' + pad(t.m) + '-' + pad(START[idx]), name: ORD[idx] + ' week' };
  }
  function needWeeks(st) {
    const t = today();
    const need = [];
    if (!st || !st.start_date) return need;
    let [y, m] = st.start_date.split('-').map(Number);
    while (y < t.y || (y === t.y && m <= t.m)) {
      START.forEach(day => {
        if (day > dim(y, m)) return;
        if (y === t.y && m === t.m && day > t.d) return;
        need.push(y + '-' + pad(m) + '-' + pad(day));
      });
      m++; if (m > 12) { m = 1; y++; }
    }
    return need;
  }

  /* ---------- styles ---------- */
  const css = `
#chart-total,#chart-month-total{display:none !important}
#hello-n{display:none !important}
.hello-m{font-size:15px;font-weight:700;opacity:.97;margin-top:4px;text-shadow:0 1px 4px rgba(0,0,0,.25)}
.dx-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;margin-bottom:20px}
.dx-grid .card{margin-bottom:0;min-width:0}
.dx-big{font-size:26px;font-weight:800;margin:4px 0}
.dx-sub{font-size:14px;color:#475569;font-weight:600}
.dx-badge{display:inline-block;padding:5px 14px;border-radius:999px;font-size:14px;font-weight:800}
.dx-ok{background:#d1fae5;color:#047857}
.dx-wait{background:#fef3c7;color:#92400e}
.dx-due{background:#fee2e2;color:#b91c1c}
.dx-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.dx-paybtn{border:0;border-radius:999px;padding:10px 18px;font-size:14px;font-weight:700;color:#fff;cursor:pointer}
.dx-track{height:14px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin:10px 0 6px}
.dx-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#34d399,#047857)}
.dx-todo{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;margin-bottom:10px;border-radius:12px;cursor:pointer;font-size:15px;font-weight:700;border:1px solid #e2e8f0;background:#fff;width:100%;text-align:left}
.dx-todo.hot{background:#fef3c7;border-color:#fde68a;color:#92400e}
.dx-todo.zero{background:#ecfdf5;border-color:#a7f3d0;color:#047857}
.dx-todo b{font-size:20px}
`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  /* ---------- helpers ---------- */
  function card(title) {
    const c = el('div', 'card');
    c.appendChild(el('h2', '', title));
    return c;
  }
  function link(text, page) {
    const b = el('button', 'btn ghost sm', text);
    b.style.marginTop = '12px';
    b.addEventListener('click', () => EEE.showPage(page));
    return b;
  }
  function setBannerMsg(text) {
    const n = $('hello-n');
    if (!n) return;
    let m = $('hello-m');
    if (!m) { m = el('div', 'hello-m'); m.id = 'hello-m'; n.parentNode.insertBefore(m, n.nextSibling); }
    m.textContent = text || '';
  }

  /* ---------- shared: recent expenses card ---------- */
  function expensesCard() {
    const c = card('Recent expenses');
    const list = (EEE.state.expenses || []).slice(0, 5);
    if (!list.length) c.appendChild(el('p', 'empty', 'No expenses yet.'));
    list.forEach(x => {
      const row = el('div', 'feed-item');
      row.appendChild(el('div', 'fav', (x.reason || '?').charAt(0).toUpperCase()));
      const main = el('div', 'fmain');
      main.appendChild(el('div', 'fname', x.reason || '-'));
      main.appendChild(el('div', 'fsub', EEE.fmtDate(x.expense_date) + (x.category ? ' · ' + x.category : '')));
      row.appendChild(main);
      row.appendChild(el('div', 'famt', money(x.amount)));
      c.appendChild(row);
    });
    c.appendChild(link('See all in Public Ledger', 'report'));
    return c;
  }

  /* ---------- shared: who paid this week (from approved payments) ---------- */
  function paidThisWeek() {
    const cw = curWeek();
    const names = new Set();
    (EEE.state.contribs || []).forEach(r => { if (r.week_start === cw.iso) names.add(r.student_name); });
    return names.size;
  }

  /* ---------- student ---------- */
  async function studentView() {
    const S = EEE.state;
    const r = await db.from('payments').select('status, amount, payment_weeks(week_start)');
    if (r.error) return [el('p', 'err', 'Could not load your status: ' + r.error.message)];
    const wstat = {};
    (r.data || []).forEach(p => {
      if (p.status === 'approved' || p.status === 'pending') {
        (p.payment_weeks || []).forEach(w => { if (wstat[w.week_start] !== 'approved') wstat[w.week_start] = p.status; });
      }
    });
    const weekly = Number((S.settings || {}).weekly_amount || 30);
    const cw = curWeek();
    const need = needWeeks(S.settings);
    const dueWeeks = need.filter(w => !wstat[w]).length;
    const status = wstat[cw.iso] || 'due';

    // banner message
    if (status === 'due') setBannerMsg('This week ' + money(weekly) + ' is due. Please pay.');
    else if (dueWeeks) setBannerMsg('This week is done. ' + dueWeeks + ' older week(s) still unpaid.');
    else setBannerMsg('All your payments are done ✓');

    const grid = el('div', 'dx-grid');

    const c1 = card('This week · ' + cw.name);
    const bd = el('span', 'dx-badge ' + (status === 'approved' ? 'dx-ok' : status === 'pending' ? 'dx-wait' : 'dx-due'),
      status === 'approved' ? 'Paid ✓' : status === 'pending' ? 'Pending approval' : 'Due');
    c1.appendChild(bd);
    c1.appendChild(el('div', 'dx-big', money(weekly)));
    const total = el('div', 'dx-sub', dueWeeks ? 'Total due: ' + money(dueWeeks * weekly) + ' (' + dueWeeks + ' week)' : 'Total due: ৳0');
    c1.appendChild(total);
    const row = el('div', 'dx-row');
    if (status === 'due' && typeof EEE.openPay === 'function') {
      [['bKash', '#e2136e'], ['Nagad', '#f6921e']].forEach(([m, col]) => {
        const b = el('button', 'dx-paybtn', 'Pay with ' + m);
        b.style.background = col;
        b.addEventListener('click', () => EEE.openPay(m));
        row.appendChild(b);
      });
    }
    const mp = el('button', 'btn ghost sm', 'My payments');
    mp.addEventListener('click', () => EEE.showPage('mypayments'));
    row.appendChild(mp);
    c1.appendChild(row);
    grid.appendChild(c1);

    const c2 = card('Fund progress this week');
    const n = paidThisWeek();
    c2.appendChild(el('div', 'dx-big', n + ' member(s) paid'));
    c2.appendChild(el('div', 'dx-sub', 'Approved payments for the ' + cw.name + '.'));
    grid.appendChild(c2);

    grid.appendChild(expensesCard());
    return [grid];
  }

  /* ---------- admin ---------- */
  async function adminView() {
    const S = EEE.state;
    const [p, m, pw] = await Promise.all([
      db.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      db.from('students').select('id').eq('is_active', true).eq('approved', false),
      db.from('payment_weeks').select('week_start, payments(student_id, status)')
    ]);
    const pendPay = p.count || 0;
    const pendMem = (m.data || []).length;

    setBannerMsg(pendPay || pendMem
      ? pendPay + ' payment(s) and ' + pendMem + ' member(s) waiting for you.'
      : 'Nothing is waiting. All clear ✓');

    const grid = el('div', 'dx-grid');

    // waiting card
    const c1 = card('Waiting for you');
    function todo(label, n, page) {
      const b = el('button', 'dx-todo ' + (n ? 'hot' : 'zero'));
      b.appendChild(el('span', '', label));
      b.appendChild(el('b', '', String(n)));
      b.addEventListener('click', () => EEE.showPage(page));
      return b;
    }
    c1.appendChild(todo('Payments to review', pendPay, 'review'));
    c1.appendChild(todo('Members to approve', pendMem, 'students'));
    grid.appendChild(c1);

    // progress card
    const members = (EEE.getMembers ? EEE.getMembers() : []).filter(x => x.is_active);
    const cw = curWeek();
    const done = Math.min(paidThisWeek(), members.length || paidThisWeek());
    const pct = members.length ? Math.round((done / members.length) * 100) : 0;
    const c2 = card('Fund progress · ' + cw.name);
    c2.appendChild(el('div', 'dx-big', done + ' of ' + members.length + ' paid'));
    const track = el('div', 'dx-track');
    const fillBar = el('div', 'dx-fill'); fillBar.style.width = pct + '%';
    track.appendChild(fillBar);
    c2.appendChild(track);
    c2.appendChild(el('div', 'dx-sub', pct + '% (approved payments only)'));
    grid.appendChild(c2);

    // dues summary card
    const c3 = card('Dues summary');
    if (pw.error || !S.settings || !S.settings.start_date) {
      c3.appendChild(el('p', 'empty', 'Dues not available yet.'));
    } else {
      const taken = {};
      (pw.data || []).forEach(x => {
        const py = x.payments;
        if (!py || (py.status !== 'approved' && py.status !== 'pending')) return;
        (taken[py.student_id] = taken[py.student_id] || new Set()).add(x.week_start);
      });
      const need = needWeeks(S.settings);
      const weekly = Number(S.settings.weekly_amount || 30);
      const rows = members.map(s => {
        const got = taken[s.id] || new Set();
        return { s, due: need.filter(w => !got.has(w)).length };
      }).filter(x => x.due > 0).sort((a, b) => b.due - a.due);
      const grand = rows.reduce((a, x) => a + x.due * weekly, 0);
      c3.appendChild(el('div', 'dx-big', money(grand)));
      c3.appendChild(el('div', 'dx-sub', rows.length + ' member(s) have dues'));
      rows.slice(0, 5).forEach(x => {
        const row = el('div', 'feed-item');
        row.appendChild(el('div', 'fav', (x.s.full_name || '?').charAt(0).toUpperCase()));
        const main = el('div', 'fmain');
        main.appendChild(el('div', 'fname', x.s.full_name || '-'));
        main.appendChild(el('div', 'fsub', x.due + ' week(s)'));
        row.appendChild(main);
        row.appendChild(el('div', 'famt', money(x.due * weekly)));
        c3.appendChild(row);
      });
      c3.appendChild(link('Open Dues page', 'dues'));
    }
    grid.appendChild(c3);

    grid.appendChild(expensesCard());
    return [grid];
  }

  /* ---------- render ---------- */
  let seq = 0;
  async function render() {
    const S = EEE.state;
    const stats = $('stats');
    if (!stats || !S.role) return;
    const my = ++seq;
    let nodes;
    try { nodes = S.role === 'admin' ? await adminView() : await studentView(); }
    catch (e) { console.error(e); return; }
    if (my !== seq) return;
    let b = $('dx');
    if (!b) { b = el('div'); b.id = 'dx'; stats.parentNode.insertBefore(b, stats); }
    b.innerHTML = '';
    nodes.forEach(n => b.appendChild(n));
  }

  EEE.refreshHooks.push(render);
})();
