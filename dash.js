(function () {
  'use strict';
  const EEE = window.EEE;
  if (!EEE) return;
  const { db, $, el, money } = EEE;

  // Weeks: 1-7, 8-14, 15-21, 22-end of month (4 weeks only)
  const START = [1, 8, 15, 22];
  const ORD = ['1st', '2nd', '3rd', '4th'];
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
.dx-notice{grid-column:1/-1;border:2px solid #fbbf24;background:#fffbeb}
.dx-notice h2{color:#92400e}
.dx-nitem{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid #fde68a}
.dx-nitem:last-of-type{border-bottom:0}
.dx-nmsg{font-size:16px;font-weight:700;color:#0f172a;word-break:break-word}
.dx-ntime{font-size:12px;color:#92400e;margin-top:2px}
.dx-nform{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.dx-nform input{flex:1;min-width:200px;margin:0}
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

  /* ---------- notice board ---------- */
  async function noticesCard(isAdmin) {
    const r = await db.from('notices')
      .select('id, message, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    if (r.error) {
      if (!isAdmin) return null;
      const c = card('Notice board');
      c.classList.add('dx-notice');
      c.appendChild(el('p', 'err', 'Could not load notices: ' + r.error.message));
      return c;
    }
    const list = r.data || [];
    // students see the card only when there is a notice
    if (!isAdmin && !list.length) return null;

    const c = card('Notice board');
    c.classList.add('dx-notice');

    if (!list.length) c.appendChild(el('p', 'empty', 'No notices yet.'));
    list.forEach(n => {
      const row = el('div', 'dx-nitem');
      const left = el('div');
      left.appendChild(el('div', 'dx-nmsg', n.message));
      left.appendChild(el('div', 'dx-ntime', EEE.fmtTime(n.created_at)));
      row.appendChild(left);
      if (isAdmin) {
        const del = el('button', 'btn danger sm', 'Delete');
        del.addEventListener('click', async () => {
          if (!confirm('Delete this notice?')) return;
          del.disabled = true;
          const d = await db.from('notices').delete().eq('id', n.id);
          if (d.error) { del.disabled = false; EEE.toast('Could not delete: ' + d.error.message); return; }
          EEE.toast('Notice deleted.');
          render();
        });
        row.appendChild(del);
      }
      c.appendChild(row);
    });

    if (isAdmin) {
      const form = el('div', 'dx-nform');
      const inp = el('input');
      inp.id = 'dx-notice-in';
      inp.maxLength = 300;
      inp.placeholder = 'Write a notice for everyone (max 300 letters)';
      const post = el('button', 'btn', 'Post notice');
      post.addEventListener('click', async () => {
        const msg = inp.value.trim();
        if (!msg) { EEE.toast('Write the notice first.'); return; }
        post.disabled = true;
        const ins = await db.from('notices').insert({ message: msg });
        post.disabled = false;
        if (ins.error) { EEE.toast('Could not post: ' + ins.error.message); return; }
        inp.value = '';
        EEE.toast('Notice posted.');
        render();
      });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') post.click(); });
      form.appendChild(inp);
      form.appendChild(post);
      c.appendChild(form);
    }
    return c;
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
    const [r, notice] = await Promise.all([
      db.from('payments').select('status, amount, payment_weeks(week_start)'),
      noticesCard(false)
    ]);
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
    if (notice) grid.appendChild(notice);

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
    const [p, m, pw, notice] = await Promise.all([
      db.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      db.from('students').select('id').eq('is_active', true).eq('approved', false),
      db.from('payment_weeks').select('week_start, payments(student_id, status)'),
      noticesCard(true)
    ]);
    const pendPay = p.count || 0;
    const pendMem = (m.data || []).length;

    setBannerMsg(pendPay || pendMem
      ? pendPay + ' payment(s) and ' + pendMem + ' member(s) waiting for you.'
      : 'Nothing is waiting. All clear ✓');

    const grid = el('div', 'dx-grid');
    if (notice) grid.appendChild(notice);

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
    // do not rebuild the cards while the admin is typing a notice
    const typing = $('dx-notice-in');
    if (typing && document.activeElement === typing) return;
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

  /* ---------- admin backup: download CSV files (shown in Settings) ---------- */
  function csvCell(v) {
    if (v === null || v === undefined) return '';
    let s = String(v);
    // stop spreadsheet formulas from running
    if (/^[=+@]/.test(s) || /^-(?![0-9.])/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function downloadCsv(name, header, rows) {
    const lines = [header.map(csvCell).join(',')].concat(rows.map(r => r.map(csvCell).join(',')));
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
  async function fetchAll(build) {
    let all = [];
    let from = 0;
    for (;;) {
      const r = await build().range(from, from + 999);
      if (r.error) return { error: r.error };
      const rows = r.data || [];
      all = all.concat(rows);
      if (rows.length < 1000) break;
      from += 1000;
    }
    return { data: all };
  }
  function stamp() {
    const t = today();
    return t.y + '-' + pad(t.m) + '-' + pad(t.d);
  }

  const EXPORTS = {
    payments: {
      label: 'Download payments',
      file: 'eee13-payments-',
      query: () => db.from('payments')
        .select('id, amount, method, transaction_id, sender_number, status, submitted_at, reviewed_at, review_note, students(full_name, roll_no), payment_weeks(week_start)')
        .order('submitted_at', { ascending: false }).order('id'),
      header: ['Submitted', 'Student', 'Roll', 'Method', 'Amount', 'Weeks', 'TrxID', 'Sender', 'Status', 'Reviewed', 'Review note'],
      row: p => [
        p.submitted_at, p.students && p.students.full_name, p.students && p.students.roll_no, p.method, p.amount,
        EEE.weeksText((p.payment_weeks || []).map(w => w.week_start).sort()),
        p.transaction_id, p.sender_number, p.status, p.reviewed_at, p.review_note
      ]
    },
    expenses: {
      label: 'Download expenses',
      file: 'eee13-expenses-',
      query: () => db.from('public_expenses').select('*').order('expense_date', { ascending: false }).order('id'),
      header: ['Date', 'Reason', 'Category', 'Amount', 'Receipt link'],
      row: x => [x.expense_date, x.reason, x.category, x.amount, x.receipt_url]
    },
    members: {
      label: 'Download members',
      file: 'eee13-members-',
      query: () => db.from('students').select('*').order('created_at', { ascending: false }).order('id'),
      header: ['Name', 'Nickname', 'Roll', 'Registration no', 'Phone', 'Email', 'Active', 'Approved', 'Joined'],
      row: s => [s.full_name, s.nickname, s.roll_no, s.registration_no, s.phone, s.email, s.is_active ? 'yes' : 'no', s.approved ? 'yes' : 'no', s.created_at]
    }
  };

  function backupCard() {
    const page = $('page-settings');
    let c = $('bk-card');
    if (EEE.state.role !== 'admin') { if (c) c.remove(); return; }
    if (!page || c) return;

    c = card('Backup (download CSV files)');
    c.id = 'bk-card';
    c.appendChild(el('div', 'help', 'Download your data as files you can open in Excel. Download them now and then and keep them safe.'));
    const row = el('div', 'dx-row');
    const msg = el('p', '');
    Object.keys(EXPORTS).forEach(key => {
      const ex = EXPORTS[key];
      const b = el('button', 'btn', ex.label);
      b.addEventListener('click', async () => {
        msg.className = ''; msg.textContent = '';
        b.disabled = true;
        const old = b.textContent;
        b.textContent = 'Preparing...';
        const r = await fetchAll(ex.query);
        b.disabled = false;
        b.textContent = old;
        if (r.error) { msg.className = 'err'; msg.textContent = 'Could not download: ' + r.error.message; return; }
        downloadCsv(ex.file + stamp() + '.csv', ex.header, r.data.map(ex.row));
        msg.className = 'ok';
        msg.textContent = 'Downloaded ' + r.data.length + ' row(s).';
      });
      row.appendChild(b);
    });
    c.appendChild(row);
    c.appendChild(msg);
    page.appendChild(c);
  }

  /* ---------- admin notification bell (top bar) ---------- */
  let bellWired = false;

  function setAdminBadge(n) {
    const b = $('bell-badge');
    if (!b) return;
    b.textContent = n > 99 ? '99+' : String(n);
    b.hidden = !n;
    b.style.display = n ? 'grid' : 'none';
  }

  async function updateAdminBell() {
    const bell = $('bell-btn');
    if (!bell || EEE.state.role !== 'admin') return;
    bell.hidden = false;
    const [p, m] = await Promise.all([
      db.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      db.from('students').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('approved', false)
    ]);
    if (p.error || m.error) return;
    setAdminBadge((p.count || 0) + (m.count || 0));
  }

  async function openAdminPanel() {
    const old = $('admin-bell-back');
    if (old) { old.remove(); return; }

    const back = el('div', 'modal-back');
    back.id = 'admin-bell-back';
    back.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.25);z-index:9999;';
    const box = el('div', 'card');
    box.style.cssText = 'position:absolute;top:64px;right:12px;width:min(400px,calc(100% - 24px));max-height:75vh;overflow:auto;margin:0;';
    back.appendChild(box);
    back.addEventListener('click', e => { if (e.target === back) back.remove(); });
    document.body.appendChild(back);

    box.appendChild(el('h2', '', 'Waiting for you'));
    box.appendChild(el('p', 'help', 'Loading...'));

    const [p, m] = await Promise.all([
      db.from('payments')
        .select('id, amount, method, submitted_at, students(full_name), payment_weeks(week_start)')
        .eq('status', 'pending')
        .order('submitted_at', { ascending: false })
        .limit(8),
      db.from('students').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('approved', false)
    ]);
    box.innerHTML = '';
    box.appendChild(el('h2', '', 'Waiting for you'));
    if (p.error) {
      box.appendChild(el('p', 'err', 'Could not load: ' + p.error.message));
      return;
    }
    const list = p.data || [];
    const memN = m.count || 0;

    if (!list.length && !memN) box.appendChild(el('p', 'empty', 'Nothing is waiting. All clear.'));

    list.forEach(x => {
      const weeks = EEE.weeksText((x.payment_weeks || []).map(w => w.week_start).sort());
      const row = el('div', 'feed-item');
      row.appendChild(el('div', 'fav', ((x.students && x.students.full_name) || '?').charAt(0).toUpperCase()));
      const main = el('div', 'fmain');
      main.appendChild(el('div', 'fname', ((x.students && x.students.full_name) || 'Unknown') + ' · ' + (x.method || '')));
      main.appendChild(el('div', 'fsub', (weeks ? weeks + ' · ' : '') + EEE.fmtTime(x.submitted_at)));
      row.appendChild(main);
      row.appendChild(el('div', 'famt', money(x.amount)));
      box.appendChild(row);
    });

    if (memN) {
      const mb = el('button', 'dx-todo hot');
      mb.style.marginTop = '10px';
      mb.appendChild(el('span', '', 'Members to approve'));
      mb.appendChild(el('b', '', String(memN)));
      mb.addEventListener('click', () => { back.remove(); EEE.showPage('students'); });
      box.appendChild(mb);
    }

    if (list.length) {
      const go = el('button', 'btn full', 'Open payment review');
      go.style.marginTop = '10px';
      go.addEventListener('click', () => { back.remove(); EEE.showPage('review'); });
      box.appendChild(go);
    }
    const closeBtn = el('button', 'btn ghost full', 'Close');
    closeBtn.style.marginTop = '8px';
    closeBtn.addEventListener('click', () => back.remove());
    box.appendChild(closeBtn);
  }

  function wireAdminBell() {
    const bell = $('bell-btn');
    if (!bell || bellWired) return;
    bellWired = true;
    bell.addEventListener('click', () => {
      if (EEE.state.role === 'admin') openAdminPanel();
    });
  }

  wireAdminBell();
  EEE.refreshHooks.push(render);
  EEE.refreshHooks.push(backupCard);
  EEE.refreshHooks.push(updateAdminBell);
})();
