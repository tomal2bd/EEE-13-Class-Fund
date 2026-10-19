(function () {
  'use strict';

  const db = window.supabase.createClient(
    'https://odrehouprwotoveklwnq.supabase.co',
    'sb_publishable_6diM-UcWc9yIE0FMU9mPsA_4cvpG_JB'
  );
  const $ = id => document.getElementById(id);
  const money = n => '৳' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };

  const ICON = {
    grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    card: '<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    check: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>'
  };

  const PAGE_DEFS = {
    overview: { title: 'Dashboard', label: 'Dashboard', icon: 'grid', roles: ['admin', 'student'] },
    students: { title: 'Members', label: 'Members', icon: 'users', roles: ['admin'] },
    report: { title: 'Public Ledger', label: 'Public Ledger', icon: 'chart', roles: ['admin', 'student'] },
    // profile has no sidebar button (nav: false). It opens from the profile menu at the top right.
    profile: { title: 'My Profile', label: 'My Profile', icon: 'user', roles: ['student'], nav: false },
    settings: { title: 'Settings', label: 'Settings', icon: 'sliders', roles: ['admin', 'student'] }
  };
  const ORDER = ['overview', 'review', 'mypayments', 'history', 'students', 'report', 'profile', 'settings'];

  const S = { user: null, email: '', role: null, student: null, settings: null, summary: null, contribs: [], expenses: [] };
  const EEE = window.EEE = { db, $, el, money, ICON, state: S, refreshHooks: [] };

  /* ---------- helpers ---------- */
  function toast(msg) {
    const t = el('div', 'toast', msg);
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }
  function parseDate(s) {
    if (!s) return null;
    const d = new Date(String(s).length === 10 ? s + 'T00:00:00' : s);
    return isNaN(d) ? null : d;
  }
  const fmtDate = s => { const d = parseDate(s); return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'; };
  const fmtDay = s => { const d = parseDate(s); return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '-'; };
  const fmtTime = s => { const d = parseDate(s); return d ? d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '-'; };
  const monthName = k => { const d = parseDate(k + '-01'); return d ? d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : k; };
  const monthShortYear = k => {
    const d = parseDate(k + '-01');
    return d ? d.toLocaleDateString('en-GB', { month: 'short' }) + ' ' + String(d.getFullYear()).slice(2) : k;
  };
  function pill(text, kind) { return el('span', 'pill ' + kind, text); }
  function fill(tbody, list, cols, emptyText) {
    tbody.innerHTML = '';
    if (!list.length) {
      const tr = el('tr'), td = el('td', 'empty', emptyText);
      td.colSpan = cols.length; tr.appendChild(td); tbody.appendChild(tr); return;
    }
    list.forEach(r => {
      const tr = el('tr');
      cols.forEach(c => {
        const td = el('td'); const v = c(r);
        if (v instanceof Node) td.appendChild(v); else td.textContent = v;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }
  function receiptCell(url) {
    if (url && /^https?:\/\//i.test(url)) {
      const a = el('a', '', 'View');
      a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      return a;
    }
    return '-';
  }

  /* ---------- calendar weeks: 1-7 = 1st, 8-14 = 2nd, 15-21 = 3rd, 22-28 = 4th, 29-end = 5th ---------- */
  const WEEK_ORD = ['1st', '2nd', '3rd', '4th', '5th'];
  const WEEK_START_DAYS = [1, 8, 15, 22, 29];
  function weekIndex(iso) {
    const day = Number(String(iso).slice(8, 10));
    return WEEK_START_DAYS.indexOf(day);
  }
  function weekMonthYear(iso) {
    const d = parseDate(iso);
    return d ? d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '';
  }
  function weekMonthShort(iso) {
    const d = parseDate(iso);
    return d ? d.toLocaleDateString('en-GB', { month: 'short' }) : '';
  }
  function weekShort(iso) {
    const i = weekIndex(iso);
    return i === -1 ? fmtDay(iso) : weekMonthShort(iso) + ' W' + (i + 1);
  }
  function weeksText(weeks) {
    const groups = new Map();
    weeks.forEach(w => {
      const mon = weekMonthYear(w);
      const i = weekIndex(w);
      const label = i === -1 ? fmtDay(w) : WEEK_ORD[i];
      if (!groups.has(mon)) groups.set(mon, []);
      groups.get(mon).push(label);
    });
    return Array.from(groups.entries()).map(([mon, labels]) =>
      labels.join(', ') + (labels.length > 1 ? ' weeks' : ' week') + ' · ' + mon
    ).join(' | ');
  }

  function groupPayments(rows) {
    const map = new Map();
    rows.forEach(r => {
      const key = r.student_name + '|' + r.approved_at;
      if (!map.has(key)) map.set(key, { name: r.student_name, at: r.approved_at, date: r.payment_date, amount: 0, weeks: [] });
      const g = map.get(key);
      g.amount += Number(r.amount);
      g.weeks.push(r.week_start);
    });
    const list = Array.from(map.values());
    list.forEach(g => g.weeks.sort());
    return list;
  }

  Object.assign(EEE, { toast, fmtDate, fmtDay, fmtTime, pill, fill, weeksText, weekShort, groupPayments });

  /* ---------- pages & navigation ---------- */
  EEE.addPage = (id, def) => { PAGE_DEFS[id] = def; };
  EEE.setBadge = (id, n) => {
    const b = document.querySelector('.nav[data-page="' + id + '"] .badge');
    if (b) { b.textContent = n; b.hidden = !n; }
  };
  const rank = id => { const i = ORDER.indexOf(id); return i === -1 ? 99 : i; };

  function openMenu() { $('side').classList.add('open'); $('scrim').classList.add('show'); }
  function closeMenu() { $('side').classList.remove('open'); $('scrim').classList.remove('show'); }

  function ensureSections() {
    Object.keys(PAGE_DEFS).forEach(id => {
      if (!$('page-' + id)) {
        const s = el('section'); s.id = 'page-' + id; s.hidden = true;
        $('pages').appendChild(s);
      }
    });
  }

  function buildNav(role) {
    const nav = $('nav'); nav.innerHTML = '';
    Object.keys(PAGE_DEFS).filter(id => PAGE_DEFS[id].roles.includes(role) && PAGE_DEFS[id].nav !== false).sort((a, b) => rank(a) - rank(b)).forEach(id => {
      const def = PAGE_DEFS[id];
      const b = el('button', 'nav'); b.dataset.page = id;
      b.innerHTML = '<svg viewBox="0 0 24 24">' + (ICON[def.icon] || ICON.grid) + '</svg><span></span><span class="badge" hidden>0</span>';
      b.querySelector('span').textContent = def.label;
      b.addEventListener('click', () => showPage(id));
      nav.appendChild(b);
    });
  }

  function showPage(name, fromPop) {
    const def = PAGE_DEFS[name];
    if (!def) return;
    document.querySelectorAll('#pages > section').forEach(s => { s.hidden = s.id !== 'page-' + name; });
    document.querySelectorAll('.nav').forEach(b => b.classList.toggle('on', b.dataset.page === name));
    $('title').textContent = def.title;
    closeMenu();
    closeAvMenu();
    if (def.onShow) def.onShow($('page-' + name));
    window.scrollTo(0, 0);
    // Back button support: every new page adds one history step
    if (!fromPop) {
      const st = { page: name };
      if (!history.state || !history.state.page) history.replaceState(st, '');
      else if (history.state.page !== name) history.pushState(st, '');
    }
  }
  EEE.showPage = showPage;

  // Phone Back button: go to the previous page instead of closing the app
  window.addEventListener('popstate', e => {
    if ($('app-view').hidden) return;
    const page = (e.state && e.state.page) || 'overview';
    if (PAGE_DEFS[page]) showPage(page, true);
  });

  /* ---------- profile menu (top right) ---------- */
  function closeAvMenu() { const m = $('avmenu'); if (m) m.hidden = true; }
  function toggleAvMenu() {
    const m = $('avmenu');
    if (!m) return;
    $('av-profile').hidden = S.role !== 'student';
    m.hidden = !m.hidden;
  }

  /* ---------- contact & footer ---------- */
  function renderContactFooter() {
    const st = S.settings || {};
    const people = [
      { name: st.owner_name, phone: st.owner_phone, email: st.owner_email },
      { name: st.assistant_name, phone: st.assistant_phone, email: st.assistant_email }
    ].filter(p => p.phone || p.email);

    const box = $('contact'); box.innerHTML = '';
    box.appendChild(el('h4', '', 'Contact Us'));
    people.forEach(p => {
      const d = el('div', 'cp');
      d.appendChild(el('b', '', p.name || 'Contact'));
      d.appendChild(el('br'));
      if (p.phone) {
        const a = el('a', '', p.phone);
        a.href = 'tel:' + p.phone.replace(/[^0-9+]/g, '');
        d.appendChild(a);
        d.appendChild(el('br'));
      }
      if (p.email && /^[^\s@]+@[^\s@]+$/.test(p.email)) {
        const a = el('a', '', p.email);
        a.href = 'mailto:' + p.email;
        d.appendChild(a);
      }
      box.appendChild(d);
    });
    if (!people.length) box.appendChild(el('div', 'cp', 'Contact details will be added soon.'));

    const f = $('foot'); f.innerHTML = '';
    f.appendChild(document.createTextNode('EEE-13 · Class Fund'));
    if (people.length) {
      f.appendChild(el('br'));
      f.appendChild(document.createTextNode('Contact: '));
      people.forEach((p, i) => {
        if (i) f.appendChild(document.createTextNode(' · '));
        f.appendChild(el('b', '', p.name || 'Contact'));
        if (p.phone) f.appendChild(document.createTextNode(' ' + p.phone));
      });
    }
  }

  /* ---------- dashboard ---------- */
  function renderStats() {
    const s = S.summary;
    if (!s) return;
    $('c-in').textContent = money(s.total_contributions);
    $('c-out').textContent = money(s.total_expenses);
    $('c-bal').textContent = money(s.current_balance);
  }

  // FEED5: Live payments shows the latest 5. "Show more" reveals the rest (up to 30).
  let feedOpen = false;
  function renderFeed() {
    const box = $('feed'); box.innerHTML = '';
    const groups = groupPayments(S.contribs).slice(0, 30);
    if (!groups.length) { box.appendChild(el('p', 'empty', 'No approved payments yet.')); return; }
    const shown = feedOpen ? groups : groups.slice(0, 5);
    shown.forEach(g => {
      const row = el('div', 'feed-item');
      row.appendChild(el('div', 'fav', (g.name || '?').charAt(0).toUpperCase()));
      const main = el('div', 'fmain');
      main.appendChild(el('div', 'fname', g.name));
      main.appendChild(el('div', 'fsub', weeksText(g.weeks) + ' · ' + fmtTime(g.at)));
      row.appendChild(main);
      row.appendChild(el('div', 'famt', money(g.amount)));
      box.appendChild(row);
    });
    if (groups.length > 5) {
      const more = el('button', 'btn ghost full', feedOpen ? 'Show less' : 'Show more (' + (groups.length - 5) + ')');
      more.style.marginTop = '12px';
      more.addEventListener('click', () => { feedOpen = !feedOpen; renderFeed(); });
      box.appendChild(more);
    }
  }

  // CHART3: thick bars, amount above each bar, bigger dark labels, highlighted total box
  function styleTotal(totalBox, text, theme) {
    if (!totalBox) return;
    totalBox.textContent = text;
    totalBox.style.cssText = 'margin-top:14px;padding:12px 16px;border-radius:12px;font-size:18px;font-weight:800;text-align:center;' +
      'background:' + theme.bg + ';color:' + theme.fg + ';border:2px solid ' + theme.border + ';';
  }
  function drawBars(boxId, totalId, keys, byKey, labelFn, titleFn, theme) {
    const box = $(boxId); box.innerHTML = '';
    const totalBox = $(totalId);
    if (!keys.length) {
      box.style.display = 'block';
      box.appendChild(el('p', 'empty', 'No approved contributions yet.'));
      styleTotal(totalBox, 'Total collected: ' + money(0), theme);
      return;
    }
    box.style.display = 'flex';
    box.style.gap = '12px';
    box.style.height = '210px';
    const max = Math.max(...keys.map(k => byKey[k]));
    let total = 0;
    keys.forEach(k => {
      total += byKey[k];
      const col = el('div', 'bar');

      const val = el('span', '', money(byKey[k]));
      val.style.cssText = 'margin:0 0 4px;font-size:13px;font-weight:800;color:#0f172a;white-space:nowrap;';
      col.appendChild(val);

      const bar = el('div');
      bar.style.height = Math.max(3, (byKey[k] / max) * 68) + '%';
      bar.style.maxWidth = '60px';
      bar.style.background = theme.gradient;
      bar.title = titleFn(k) + ': ' + money(byKey[k]);
      col.appendChild(bar);

      const lab = el('span', '', labelFn(k));
      lab.style.cssText = 'margin-top:8px;font-size:13px;font-weight:700;color:#334155;white-space:nowrap;';
      col.appendChild(lab);

      box.appendChild(col);
    });
    styleTotal(totalBox, 'Total collected: ' + money(total), theme);
  }
  function renderChart() {
    const GREEN = { gradient: 'linear-gradient(180deg,#34d399,#047857)', bg: '#d1fae5', fg: '#064e3b', border: '#10b981' };
    const BLUE = { gradient: 'linear-gradient(180deg,#60a5fa,#1d4ed8)', bg: '#dbeafe', fg: '#1e3a8a', border: '#3b82f6' };

    const byWeek = {};
    S.contribs.forEach(r => { byWeek[r.week_start] = (byWeek[r.week_start] || 0) + Number(r.amount); });
    const weeks = Object.keys(byWeek).sort().slice(-8);
    drawBars('chart', 'chart-total', weeks, byWeek, weekShort, w => weeksText([w]), GREEN);

    const byMonth = {};
    S.contribs.forEach(r => {
      const k = String(r.week_start).slice(0, 7);
      byMonth[k] = (byMonth[k] || 0) + Number(r.amount);
    });
    const months = Object.keys(byMonth).sort().slice(-6);
    drawBars('chart-month', 'chart-month-total', months, byMonth, monthShortYear, monthName, BLUE);
  }

  /* ---------- public ledger ---------- */
  const R_LIMIT = 10;
  let rMonth = 'all';
  let rInOpen = false;
  let rOutOpen = false;

  function setRTab(t) {
    $('r-in-wrap').hidden = t !== 'in';
    $('r-out-wrap').hidden = t !== 'out';
    $('r-tab-in').classList.toggle('on', t === 'in');
    $('r-tab-out').classList.toggle('on', t === 'out');
  }

  // Month dropdown. Options are rebuilt only when the list of months changes,
  // so the dropdown does not close by itself during the 20 second refresh.
  function syncMonthSelect(keys) {
    const sel = $('r-month');
    if (!sel) return;
    const sig = keys.join(',');
    if (sel.dataset.sig !== sig) {
      sel.innerHTML = '';
      const all = el('option', '', 'All months'); all.value = 'all';
      sel.appendChild(all);
      keys.forEach(k => {
        const o = el('option', '', monthName(k)); o.value = k;
        sel.appendChild(o);
      });
      sel.dataset.sig = sig;
    }
    if (rMonth !== 'all' && keys.indexOf(rMonth) === -1) rMonth = 'all';
    sel.value = rMonth;
  }

  function moreButton(id, total, open) {
    const b = $(id);
    if (!b) return;
    b.hidden = total <= R_LIMIT;
    b.textContent = open ? 'Show less' : 'Show more (' + (total - R_LIMIT) + ')';
  }

  function renderReport() {
    const sumBy = (list, f) => list.reduce((a, x) => a + Number(f(x) || 0), 0);

    // all months that have any money in or money out
    const monthSet = new Set();
    S.contribs.forEach(r => monthSet.add(String(r.payment_date).slice(0, 7)));
    S.expenses.forEach(r => monthSet.add(String(r.expense_date).slice(0, 7)));
    const monthKeys = Array.from(monthSet).filter(k => /^\d{4}-\d{2}$/.test(k)).sort().reverse();
    syncMonthSelect(monthKeys);

    const inMonth = d => rMonth === 'all' || String(d).slice(0, 7) === rMonth;
    const contribsM = S.contribs.filter(r => inMonth(r.payment_date));
    const expensesM = S.expenses.filter(r => inMonth(r.expense_date));

    // summary cards
    let totIn, totOut;
    if (rMonth === 'all' && S.summary) {
      totIn = Number(S.summary.total_contributions || 0);
      totOut = Number(S.summary.total_expenses || 0);
    } else {
      totIn = sumBy(contribsM, r => r.amount);
      totOut = sumBy(expensesM, r => r.amount);
    }
    $('r-c-in').textContent = money(totIn);
    $('r-c-out').textContent = money(totOut);
    $('r-c-bal').textContent = money(totIn - totOut);
    $('r-l-bal').textContent = rMonth === 'all' ? 'Current balance' : 'Net this month';
    $('r-period').textContent = rMonth === 'all' ? 'Showing: all months' : 'Showing: ' + monthName(rMonth);

    // money in
    const q = $('r-search').value.trim().toLowerCase();
    const groups = groupPayments(contribsM).filter(g => (g.name || '').toLowerCase().includes(q));
    const inShown = rInOpen ? groups : groups.slice(0, R_LIMIT);
    fill($('t-rin'), inShown, [g => g.name, g => weeksText(g.weeks), g => money(g.amount), g => fmtDate(g.date), () => pill('Approved', 'ok')], 'No approved payments yet');
    moreButton('r-in-more', groups.length, rInOpen);

    // money out
    const outShown = rOutOpen ? expensesM : expensesM.slice(0, R_LIMIT);
    fill($('t-rout'), outShown, [r => fmtDate(r.expense_date), r => r.reason, r => r.category || '-', r => money(r.amount), r => receiptCell(r.receipt_url)], 'No expenses yet');
    moreButton('r-out-more', expensesM.length, rOutOpen);

    // top contributors (follows the month filter)
    const totals = {};
    contribsM.forEach(r => { totals[r.student_name] = (totals[r.student_name] || 0) + Number(r.amount); });
    const top = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const tb = $('r-top'); tb.innerHTML = '';
    if (!top.length) tb.appendChild(el('p', 'empty', 'No contributions yet.'));
    top.forEach(([name, v], i) => {
      const row = el('div', 'feed-item');
      row.appendChild(el('div', 'fav', String(i + 1)));
      const main = el('div', 'fmain'); main.appendChild(el('div', 'fname', name)); row.appendChild(main);
      row.appendChild(el('div', 'famt', money(v)));
      tb.appendChild(row);
    });

    // monthly summary: collected, spent, net (always all months)
    const inBy = {}, outBy = {};
    S.contribs.forEach(r => { const k = String(r.payment_date).slice(0, 7); inBy[k] = (inBy[k] || 0) + Number(r.amount); });
    S.expenses.forEach(r => { const k = String(r.expense_date).slice(0, 7); outBy[k] = (outBy[k] || 0) + Number(r.amount); });
    const mlist = monthKeys.map(k => ({ k, i: inBy[k] || 0, o: outBy[k] || 0 }));
    fill($('t-month'), mlist, [
      m => monthName(m.k),
      m => money(m.i),
      m => money(m.o),
      m => {
        const net = m.i - m.o;
        const s = el('b', '', (net < 0 ? '-' : '') + money(Math.abs(net)));
        s.style.color = net < 0 ? '#dc2626' : '#047857';
        return s;
      }
    ], 'No data yet');
  }

  /* ---------- load public data ---------- */
  async function loadPublic() {
    const [s, c, e] = await Promise.all([
      db.from('public_summary').select('*').single(),
      db.from('public_contributions').select('*').order('approved_at', { ascending: false }).limit(2000),
      db.from('public_expenses').select('*').order('expense_date', { ascending: false }).limit(500)
    ]);
    if (s.data) S.summary = s.data;
    S.contribs = c.data || [];
    S.expenses = e.data || [];
    renderStats(); renderFeed(); renderChart(); renderReport();
  }

  /* ---------- members (admin) ---------- */
  let members = [];
  async function loadMembers() {
    const r = await db.from('students').select('*').order('created_at', { ascending: false });
    if (r.error) { $('m-msg').textContent = 'Could not load members: ' + r.error.message; return; }
    $('m-msg').textContent = '';
    members = r.data || [];
    $('c-stu').textContent = members.filter(m => m.is_active && m.approved).length;
    // sidebar badge: new sign ups waiting for a decision
    EEE.setBadge('students', members.filter(m => !m.approved && !m.rejected).length);
    renderMembers();
  }
  function memberStatus(m) {
    if (m.rejected && !m.approved) return pill('Rejected', 'no');
    if (!m.approved) return pill('Pending', 'wait');
    return pill(m.is_active ? 'Active' : 'Removed', m.is_active ? 'ok' : 'no');
  }
  function memberAction(m) {
    const box = el('div');
    box.style.cssText = 'display:flex;gap:6px;';
    if (!m.approved) {
      const ok = el('button', 'btn sm', 'Approve');
      ok.addEventListener('click', () => approveMember(m));
      box.appendChild(ok);
      if (!m.rejected) {
        const no = el('button', 'btn danger sm', 'Reject');
        no.addEventListener('click', () => rejectMember(m));
        box.appendChild(no);
      }
      return box;
    }
    const b = el('button', 'btn sm ' + (m.is_active ? 'danger' : 'ghost'), m.is_active ? 'Remove' : 'Restore');
    b.addEventListener('click', () => toggleMember(m));
    box.appendChild(b);
    return box;
  }
  function renderMembers() {
    const q = $('m-search').value.trim().toLowerCase();
    const list = members.filter(m => [m.full_name, m.roll_no, m.registration_no, m.email, m.phone].join(' ').toLowerCase().includes(q));
    // waiting for a decision first, then everyone else
    const order = m => (!m.approved && !m.rejected) ? 0 : 1;
    list.sort((a, b) => order(a) - order(b));
    fill($('t-members'), list, [
      m => m.full_name || '-', m => m.roll_no || '-', m => m.registration_no || '-', m => m.phone || '-', m => m.email || '-',
      m => fmtDate(m.created_at), m => memberStatus(m), m => memberAction(m)
    ], 'No members have signed up yet');
  }
  async function approveMember(m) {
    if (!confirm('Approve ' + (m.full_name || 'this member') + '?\nRoll: ' + (m.roll_no || '-') + ' · Reg: ' + (m.registration_no || '-'))) return;
    const r = await db.from('students').update({ approved: true, is_active: true, rejected: false }).eq('id', m.id);
    if (r.error) { toast('Could not approve: ' + r.error.message); return; }
    toast('Member approved.');
    await loadMembers();
  }
  async function rejectMember(m) {
    if (!confirm('Reject ' + (m.full_name || 'this member') + '? They will not be able to use the site.')) return;
    const r = await db.from('students').update({ approved: false, is_active: false, rejected: true }).eq('id', m.id);
    if (r.error) { toast('Could not reject: ' + r.error.message); return; }
    toast('Member rejected.');
    await loadMembers();
  }
  async function toggleMember(m) {
    const verb = m.is_active ? 'remove' : 'restore';
    if (!confirm('Do you want to ' + verb + ' ' + (m.full_name || 'this member') + '?')) return;
    const r = await db.from('students').update({ is_active: !m.is_active }).eq('id', m.id);
    if (r.error) { toast('Could not update: ' + r.error.message); return; }
    toast('Member ' + (m.is_active ? 'removed' : 'restored') + '.');
    await loadMembers();
  }
  EEE.getMembers = () => members;

  /* ---------- profile (student) ---------- */
  async function loadStudentRow() {
    const r = await db.from('students').select('*').eq('profile_id', S.user.id).maybeSingle();
    S.student = r.data || null;
    return r;
  }
  // Nickname and class roll can be edited. The phone number is always locked.
  function setProfileEditing(on) {
    $('p-nick-in').disabled = !on;
    $('p-roll-in').disabled = !on;
    $('p-phone-in').disabled = true;
    $('p-edit').hidden = on;
    $('p-save').hidden = !on;
    $('p-cancel').hidden = !on;
  }
  async function loadMyTotal() {
    const r = await db.from('payments').select('amount').eq('status', 'approved');
    if (r.error) { $('p-total').textContent = '-'; return; }
    const total = (r.data || []).reduce((a, p) => a + Number(p.amount || 0), 0);
    $('p-total').textContent = money(total);
  }
  // PROFILE2: info cards on top show all details; the edit card below changes nickname and class roll
  function renderProfile() {
    const s = S.student;
    if (!s) return;
    $('p-name').textContent = s.full_name || '-';
    $('p-avatar').textContent = (s.full_name || '?').charAt(0).toUpperCase();
    $('p-email').textContent = S.email;
    $('p-reg').textContent = s.registration_no || '-';
    $('p-roll').textContent = s.roll_no || '-';
    $('p-nick').textContent = s.nickname || '-';
    $('p-phone').textContent = s.phone || '-';
    $('p-joined').textContent = fmtDate(s.created_at);
    $('p-nick-in').value = s.nickname || '';
    $('p-roll-in').value = s.roll_no || '';
    $('p-phone-in').value = s.phone || '';
    setProfileEditing(false);
    loadMyTotal();
  }
  async function saveProfile() {
    const msg = $('p-msg'); msg.className = ''; msg.textContent = '';
    const nick = $('p-nick-in').value.trim();
    const roll = $('p-roll-in').value.trim();
    const phone = (S.student && S.student.phone) || '';
    if (!nick) { msg.className = 'err'; msg.textContent = 'Nickname is required.'; return; }
    if (!roll) { msg.className = 'err'; msg.textContent = 'Class roll is required.'; return; }
    const btn = $('p-save'); btn.disabled = true;
    const r = await db.rpc('update_my_profile', { new_roll: roll, new_phone: phone, new_nick: nick });
    btn.disabled = false;
    if (r.error) { msg.className = 'err'; msg.textContent = 'Could not save: ' + r.error.message; return; }
    await loadStudentRow(); renderProfile();
    msg.className = 'ok'; msg.textContent = 'Profile updated.';
  }

  /* ---------- settings: change password ---------- */
  async function savePassword() {
    const msg = $('s-pw-msg'); msg.className = ''; msg.textContent = '';
    const a = $('s-pw').value, b = $('s-pw2').value;
    if (a.length < 8) { msg.className = 'err'; msg.textContent = 'Password must be at least 8 characters.'; return; }
    if (a !== b) { msg.className = 'err'; msg.textContent = 'Passwords do not match.'; return; }
    const btn = $('s-pw-save'); btn.disabled = true;
    const r = await db.auth.updateUser({ password: a });
    btn.disabled = false;
    if (r.error) { msg.className = 'err'; msg.textContent = 'Could not change password: ' + r.error.message; return; }
    $('s-pw').value = ''; $('s-pw2').value = '';
    msg.className = 'ok'; msg.textContent = 'Password changed.';
  }

  /* ---------- live refresh ---------- */
  let timer = null;
  async function refreshAll() {
    await loadPublic();
    if (S.role === 'admin') await loadMembers();
    for (const fn of EEE.refreshHooks) { try { await fn(); } catch (e) { console.error(e); } }
  }
  EEE.refresh = refreshAll;
  function startLive() {
    stopLive();
    timer = setInterval(() => { if (!document.hidden && !$('app-view').hidden) refreshAll(); }, 20000);
  }
  function stopLive() { if (timer) clearInterval(timer); timer = null; }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('app-view').hidden) refreshAll(); });

  /* ---------- auth ---------- */
  let loginRole = 'student';
  function setMsg(text, good) {
    const m = $('message'); m.className = good ? 'ok' : 'err'; m.textContent = text || '';
  }
  function setTab(t) {
    $('form-in').hidden = t !== 'in';
    $('form-up').hidden = t !== 'up';
    $('tab-in').classList.toggle('on', t === 'in');
    $('tab-up').classList.toggle('on', t === 'up');
    $('auth-sub').textContent = t === 'in' ? 'Sign in to your account' : 'Create your student account';
    setMsg('');
  }

  async function enter(user, expected) {
    const p = await db.from('profiles').select('email, role').eq('id', user.id).single();
    if (p.error || !p.data) {
      setMsg('Profile not found: ' + (p.error ? p.error.message : 'no data'));
      await db.auth.signOut(); return;
    }
    const role = p.data.role === 'admin' ? 'admin' : 'student';
    if (expected && expected !== role) {
      await db.auth.signOut();
      setMsg('This is a ' + role + ' account. Please choose "' + (role === 'admin' ? 'Admin' : 'Student') + '" above and sign in again.');
      return;
    }
    S.user = user; S.email = p.data.email; S.role = role;
    if (role === 'student') {
      const sr = await loadStudentRow();
      if (sr.error || !S.student) {
        await db.auth.signOut();
        setMsg('No student record found for this account. Please contact the admin.');
        return;
      }
      if (S.student.rejected && !S.student.approved) {
        await db.auth.signOut();
        setMsg('Your sign up was not approved. Please contact the admin.');
        return;
      }
      if (!S.student.approved) {
        await db.auth.signOut();
        setMsg('Your account is waiting for admin approval. Please contact the admin.');
        return;
      }
      if (!S.student.is_active) {
        await db.auth.signOut();
        setMsg('Your account has been removed. Please contact the admin.');
        return;
      }
    }
    const st = await db.from('fund_settings').select('*').eq('id', 1).maybeSingle();
    S.settings = st.data || null;

    $('role').textContent = role;
    $('who').textContent = S.email;
    // AVMENU2: the round button keeps its person icon. The menu shows the name and email.
    $('av-name').textContent = (S.student && S.student.full_name) || (role === 'admin' ? 'Admin' : 'Student');
    $('av-email').textContent = S.email || '';
    $('card-stu').hidden = role !== 'admin';
    $('paybar').hidden = !(role === 'student' && typeof EEE.openPay === 'function');

    ensureSections();
    buildNav(role);
    renderContactFooter();
    if (role === 'student') renderProfile();

    $('login-view').hidden = true;
    $('app-view').hidden = false;
    showPage('overview');
    await refreshAll();
    startLive();
  }

  async function doLogin() {
    const btn = $('login-btn');
    setMsg('');
    btn.disabled = true; btn.textContent = 'Signing in...';
    const r = await db.auth.signInWithPassword({ email: $('in-email').value.trim(), password: $('in-password').value });
    btn.disabled = false; btn.textContent = 'Sign In';
    if (r.error) { setMsg('Sign in failed: ' + r.error.message); return; }
    await enter(r.data.user, loginRole);
  }

  async function doSignup() {
    const name = $('u-name').value.trim();
    const nick = $('u-nick').value.trim();
    const roll = $('u-roll').value.trim();
    const reg = $('u-reg').value.trim();
    const phone = $('u-phone').value.trim();
    const email = $('u-email').value.trim();
    const pw = $('u-pass').value;
    const pw2 = $('u-pass2').value;
    setMsg('');
    if (!name || !nick || !roll || !reg || !phone || !email || !pw) { setMsg('Please fill in all fields.'); return; }
    if (!/^01[0-9]{9}$/.test(phone)) { setMsg('Phone must be 11 digits and start with 01.'); return; }
    if (pw.length < 8) { setMsg('Password must be at least 8 characters.'); return; }
    if (pw !== pw2) { setMsg('Passwords do not match.'); return; }
    const btn = $('signup-btn');
    btn.disabled = true; btn.textContent = 'Creating account...';
    const r = await db.auth.signUp({
      email, password: pw,
      options: { data: { full_name: name, nickname: nick, class_roll: roll, registration_no: reg, phone } }
    });
    btn.disabled = false; btn.textContent = 'Create Account';
    if (r.error) {
      const m = r.error.message || '';
      if (/database error/i.test(m)) setMsg('Could not create the account. This registration number may already be registered.');
      else if (/already registered/i.test(m)) setMsg('This email is already registered. Please sign in instead.');
      else if (/rate limit/i.test(m)) setMsg('Too many attempts. Please wait a while and try again.');
      else setMsg('Sign up failed: ' + m);
      return;
    }
    if (!r.data.session) {
      setMsg('Account created, but Supabase still requires email confirmation. The "Confirm email" setting must be turned off.');
      return;
    }
    await enter(r.data.user, 'student');
  }

  async function doLogout() {
    stopLive();
    await db.auth.signOut();
    S.user = null; S.student = null; S.role = null;
    ['in-password', 'u-pass', 'u-pass2'].forEach(id => { $(id).value = ''; });
    $('app-view').hidden = true;
    $('login-view').hidden = false;
    closeMenu();
    closeAvMenu();
    setTab('in');
  }

  /* ---------- wire up ---------- */
  $('tab-in').addEventListener('click', () => setTab('in'));
  $('tab-up').addEventListener('click', () => setTab('up'));
  document.querySelectorAll('.rbtn').forEach(b => b.addEventListener('click', () => {
    loginRole = b.dataset.role;
    document.querySelectorAll('.rbtn').forEach(x => x.classList.toggle('on', x === b));
  }));
  $('login-btn').addEventListener('click', doLogin);
  $('signup-btn').addEventListener('click', doSignup);
  $('in-password').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  $('u-pass2').addEventListener('keydown', e => { if (e.key === 'Enter') doSignup(); });
  $('forgot').addEventListener('click', e => {
    e.preventDefault();
    setMsg('Password reset by email is coming soon. For now, please contact your CR.');
  });
  $('logout-btn').addEventListener('click', doLogout);
  $('menu-btn').addEventListener('click', () => ($('side').classList.contains('open') ? closeMenu() : openMenu()));
  $('scrim').addEventListener('click', closeMenu);
  $('r-tab-in').addEventListener('click', () => setRTab('in'));
  $('r-tab-out').addEventListener('click', () => setRTab('out'));
  $('r-search').addEventListener('input', () => { rInOpen = false; renderReport(); });
  $('r-month').addEventListener('change', e => { rMonth = e.target.value; rInOpen = false; rOutOpen = false; renderReport(); });
  $('r-in-more').addEventListener('click', () => { rInOpen = !rInOpen; renderReport(); });
  $('r-out-more').addEventListener('click', () => { rOutOpen = !rOutOpen; renderReport(); });
  $('m-search').addEventListener('input', renderMembers);
  $('p-save').addEventListener('click', saveProfile);
  $('s-pw-save').addEventListener('click', savePassword);

  // profile button opens the small menu
  $('avatar').addEventListener('click', e => { e.stopPropagation(); toggleAvMenu(); });
  $('av-profile').addEventListener('click', () => { closeAvMenu(); showPage('profile'); });
  $('av-logout').addEventListener('click', () => { closeAvMenu(); doLogout(); });
  document.addEventListener('click', e => { if (!e.target.closest('.avwrap')) closeAvMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAvMenu(); });

  // Profile Edit / Cancel buttons (delegated so they always work)
  document.addEventListener('click', e => {
    if (e.target.closest('#p-edit')) { setProfileEditing(true); $('p-nick-in').focus(); }
    if (e.target.closest('#p-cancel')) { renderProfile(); $('p-msg').textContent = ''; }
  });

  document.querySelectorAll('.paybtn').forEach(b => b.addEventListener('click', () => {
    if (typeof EEE.openPay === 'function') EEE.openPay(b.dataset.pay);
    else toast('Payments will be enabled in the next update.');
  }));

  db.auth.getSession().then(async ({ data }) => {
    if (data.session) {
      try { await enter(data.session.user, null); } catch (e) { console.error(e); }
    }
    // If not logged in (or enter failed), show the login page now
    if ($('app-view').hidden) $('login-view').hidden = false;
  });
})();
