(function () {
  'use strict';
  const EEE = window.EEE;
  if (!EEE) return;
  const { db, $, el, money, toast } = EEE;

    const START = [1, 8, 15, 22];
  const ORD = ['1st', '2nd', '3rd', '4th'];
  const pad = n => String(n).padStart(2, '0');
  const dim = (y, m) => new Date(y, m, 0).getDate();
  const isAdmin = () => EEE.state.role === 'admin';
  function today() {
    const p = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' }).split('-').map(Number);
    return { y: p[0], m: p[1], d: p[2] };
  }
  function addField(grid, label, input) {
    const w = el('div');
    w.appendChild(el('label', '', label));
    w.appendChild(input);
    grid.appendChild(w);
  }

  /* ---------- payment method helpers ---------- */
  const METHODS = {
    bkash: { label: 'bKash', color: '#e2136e' },
    nagad: { label: 'Nagad', color: '#f6921e' },
    cash: { label: 'Cash', color: '#059669' }
  };
  function mInfo(m) {
    const k = String(m || '').toLowerCase();
    return METHODS[k] || { label: m || '-', color: '#64748b' };
  }
  function mBadge(m) {
    const i = mInfo(m);
    const b = el('span', '', i.label);
    b.style.cssText = 'display:inline-block;padding:3px 12px;border-radius:999px;font-weight:700;font-size:13px;color:#fff;background:' + i.color + ';';
    return b;
  }
  function statusPill(s) {
    if (s === 'approved') return EEE.pill('Approved', 'ok');
    if (s === 'rejected') return EEE.pill('Rejected', 'no');
    return EEE.pill('Pending', 'wait');
  }

  /* ---------- sidebar order (admin) ---------- */
  function orderNav() {
    const nav = $('nav');
    if (!nav || !isAdmin()) return;
    ['overview', 'review', 'paylog', 'manual', 'dues', 'expenses', 'students', 'report', 'settings'].forEach(id => {
      const b = nav.querySelector('.nav[data-page="' + id + '"]');
      if (b) nav.appendChild(b);
    });
  }

  /* ============ 1) Settings (locked until Edit is pressed) ============ */
  let sBuilt = false;
  const FUND = [
    ['weekly_amount', 'Weekly amount (৳)', 'number'],
    ['start_date', 'Fund start date', 'date'],
    ['bkash_number', 'bKash number', 'tel'],
    ['nagad_number', 'Nagad number', 'tel']
  ];
  const CONTACT = [
    ['owner_name', 'Owner name', 'text'], ['owner_phone', 'Owner phone', 'tel'], ['owner_email', 'Owner email', 'email'],
    ['assistant_name', 'Assistant name', 'text'], ['assistant_phone', 'Assistant phone', 'tel'], ['assistant_email', 'Assistant email', 'email']
  ];

  function settingsCard(title, defs, hintText) {
    const card = el('div', 'card');
    card.appendChild(el('h2', '', title));
    const grid = el('div', 'formgrid');
    const inputs = {};
    defs.forEach(([key, label, type]) => {
      const i = el('input'); i.type = type;
      if (type === 'number') { i.min = '1'; i.step = '1'; }
      inputs[key] = i;
      addField(grid, label, i);
    });
    card.appendChild(grid);
    if (hintText) card.appendChild(el('p', 'hint', hintText));

    const row = el('div'); row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';
    const edit = el('button', 'btn', 'Edit');
    const save = el('button', 'btn', 'Save changes');
    const cancel = el('button', 'btn ghost', 'Cancel');
    row.appendChild(edit); row.appendChild(save); row.appendChild(cancel);
    card.appendChild(row);
    const msg = el('p', '');
    card.appendChild(msg);

    function restore() {
      const s = EEE.state.settings || {};
      defs.forEach(([k]) => { inputs[k].value = s[k] == null ? '' : s[k]; });
    }
    function setEdit(on) {
      Object.keys(inputs).forEach(k => {
        inputs[k].disabled = !on;
        inputs[k].style.background = on ? '#fff' : '#f1f5f9';
      });
      edit.hidden = on; save.hidden = !on; cancel.hidden = !on;
    }
    restore(); setEdit(false);

    edit.addEventListener('click', () => { msg.textContent = ''; setEdit(true); inputs[defs[0][0]].focus(); });
    cancel.addEventListener('click', () => { restore(); setEdit(false); msg.textContent = ''; });
    save.addEventListener('click', async () => {
      if (!isAdmin()) { msg.className = 'err'; msg.textContent = 'Only the admin can change settings.'; return; }
      msg.className = 'err'; msg.textContent = '';
      const payload = {};
      for (const [key, label, type] of defs) {
        const v = inputs[key].value.trim();
        if (type === 'number') {
          if (!(Number(v) > 0)) { msg.textContent = label + ' must be more than 0.'; return; }
          payload[key] = Number(v);
        } else if (key === 'start_date') {
          if (!v) { msg.textContent = 'Please select the start date.'; return; }
          payload[key] = v;
        } else if (type === 'tel' && v && !/^01[0-9]{9}$/.test(v)) {
          msg.textContent = label + ' must be 11 digits and start with 01.'; return;
        } else if (type === 'email' && v && !/^[^\s@]+@[^\s@]+$/.test(v)) {
          msg.textContent = label + ' is not a valid email.'; return;
        } else payload[key] = v || null;
      }
      save.disabled = true;
      const r = await db.from('fund_settings').update(payload).eq('id', 1);
      save.disabled = false;
      if (r.error) { msg.textContent = 'Could not save: ' + r.error.message; return; }
      EEE.state.settings = Object.assign({}, EEE.state.settings, payload);
      setEdit(false);
      msg.className = 'ok'; msg.textContent = 'Saved. Contact info in the sidebar updates on next login.';
    });
    return card;
  }

  function categoriesCard() {
    const card = el('div', 'card');
    card.appendChild(el('h2', '', 'Expense categories'));
    const list = el('div');
    card.appendChild(list);
    const row = el('div'); row.style.cssText = 'display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;';
    const inp = el('input'); inp.placeholder = 'New category name'; inp.style.cssText = 'max-width:260px;margin:0;';
    const add = el('button', 'btn', 'Add');
    row.appendChild(inp); row.appendChild(add);
    card.appendChild(row);

    async function load() {
      const r = await db.from('expense_categories').select('id, name').order('name');
      list.innerHTML = '';
      if (r.error) { list.appendChild(el('p', 'err', 'Could not load: ' + r.error.message)); return; }
      (r.data || []).forEach(c => {
        const it = el('div', 'feed-item');
        it.appendChild(el('div', 'fmain', c.name));
        const ren = el('button', 'btn ghost sm', 'Rename');
        const del = el('button', 'btn danger sm', 'Delete');
        del.style.marginLeft = '6px';
        ren.addEventListener('click', async () => {
          const n = prompt('New name', c.name);
          if (!n || !n.trim() || n.trim() === c.name) return;
          const u = await db.from('expense_categories').update({ name: n.trim() }).eq('id', c.id);
          if (u.error) { toast('Could not rename: ' + u.error.message); return; }
          toast('Renamed.'); load();
        });
        del.addEventListener('click', async () => {
          if (!confirm('Delete category "' + c.name + '"?')) return;
          const d = await db.from('expense_categories').delete().eq('id', c.id);
          if (d.error) { toast('Could not delete (it may be used by expenses): ' + d.error.message); return; }
          toast('Deleted.'); load();
        });
        it.appendChild(ren); it.appendChild(del);
        list.appendChild(it);
      });
      if (!(r.data || []).length) list.appendChild(el('p', 'empty', 'No categories yet.'));
    }
    add.addEventListener('click', async () => {
      const n = inp.value.trim();
      if (!n) { toast('Write a category name.'); return; }
      add.disabled = true;
      const r = await db.from('expense_categories').insert({ name: n });
      add.disabled = false;
      if (r.error) { toast('Could not add: ' + r.error.message); return; }
      inp.value = ''; toast('Category added.'); load();
    });
    load();
    return card;
  }

  // Students never keep the admin cards. They are cleared for students
  // and rebuilt when an admin signs in again.
  function buildSettings() {
    const box = $('settings-extra');
    if (!box) return;
    if (!isAdmin()) { box.innerHTML = ''; sBuilt = false; return; }
    if (sBuilt && box.children.length) return;
    sBuilt = true;
    box.innerHTML = '';
    box.appendChild(settingsCard('Fund settings', FUND, 'Changing the weekly amount affects new payments and the dues calculation.'));
    box.appendChild(settingsCard('Contact information', CONTACT, ''));
    box.appendChild(categoriesCard());
  }

  /* ============ 2) Manual payment entry (cash) ============ */
  let mBuilt = false;
  const mSel = new Set();

  function buildManual() {
    const page = $('page-manual');
    if (!page || mBuilt) return;
    mBuilt = true;
    page.innerHTML = '';
    const card = el('div', 'card');
    card.style.border = '2px dashed #10b981';
    card.appendChild(el('h2', '', 'Add a payment manually (cash / offline)'));
    const grid = el('div', 'formgrid');
    const stu = el('select');
    const method = el('select');
    ['Cash', 'bKash', 'Nagad'].forEach(m => { const o = el('option', '', m); o.value = m; method.appendChild(o); });
    const t = today();
    const month = el('input'); month.type = 'month'; month.value = t.y + '-' + pad(t.m);
    const note = el('input'); note.placeholder = 'Note (optional)';
    addField(grid, 'Student', stu);
    addField(grid, 'Method', method);
    addField(grid, 'Month', month);
    addField(grid, 'Note', note);
    card.appendChild(grid);

    card.appendChild(el('label', '', 'Weeks'));
    const weeksBox = el('div'); weeksBox.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;';
    card.appendChild(weeksBox);
    const total = el('div', 'totalbox');
    card.appendChild(total);
    const btn = el('button', 'btn', 'Add approved payment');
    const msg = el('p', '');
    card.appendChild(btn); card.appendChild(msg);
    page.appendChild(card);

    function weekly() { return Number((EEE.state.settings || {}).weekly_amount || 30); }
    function updTotal() {
      total.innerHTML = '';
      total.appendChild(el('span', '', mSel.size + ' week(s)'));
      total.appendChild(el('span', '', money(mSel.size * weekly())));
    }
    function drawWeeks() {
      weeksBox.innerHTML = '';
      const [y, m] = month.value.split('-').map(Number);
      if (!y || !m) return;
      START.forEach((day, i) => {
        if (day > dim(y, m)) return;
        const iso = y + '-' + pad(m) + '-' + pad(day);
        const b = el('button', 'btn sm ' + (mSel.has(iso) ? '' : 'ghost'), ORD[i] + ' week');
        b.addEventListener('click', () => {
          if (mSel.has(iso)) mSel.delete(iso); else mSel.add(iso);
          drawWeeks();
        });
        weeksBox.appendChild(b);
      });
      updTotal();
    }
    function fillStudents() {
      const keep = stu.value;
      stu.innerHTML = '';
      const f = el('option', '', 'Select student'); f.value = ''; stu.appendChild(f);
            EEE.getMembers().filter(x => x.is_active && x.approved).forEach(x => {
        const o = el('option', '', (x.full_name || '-') + (x.roll_no ? ' (Roll ' + x.roll_no + ')' : ''));
        o.value = x.id; stu.appendChild(o);
      });
      stu.value = keep;
    }
    month.addEventListener('change', () => { mSel.clear(); drawWeeks(); });
    btn.addEventListener('click', async () => {
      msg.className = 'err'; msg.textContent = '';
      if (!stu.value) { msg.textContent = 'Please select a student.'; return; }
      if (!mSel.size) { msg.textContent = 'Please select at least one week.'; return; }
      const name = stu.options[stu.selectedIndex].text;
      if (!confirm('Add ' + money(mSel.size * weekly()) + ' (' + method.value + ') for ' + name + '?')) return;
      btn.disabled = true;
      const r = await db.rpc('admin_add_payment', {
        p_student_id: stu.value, p_method: method.value,
        p_weeks: Array.from(mSel).sort(), p_note: note.value.trim() || null
      });
      btn.disabled = false;
      if (r.error) {
        msg.textContent = /already/i.test(r.error.message) ? 'One of these weeks is already paid or pending.' : 'Could not add: ' + r.error.message;
        return;
      }
      mSel.clear(); note.value = ''; drawWeeks();
      toast('Payment added and approved.');
      if (EEE.refresh) EEE.refresh();
    });
    page._fill = fillStudents;
    fillStudents(); drawWeeks();
  }

  EEE.addPage('manual', {
    title: 'Add Payment', label: 'Add Payment', icon: 'check', roles: ['admin'],
    onShow: function (page) { buildManual(); if (page && page._fill) page._fill(); }
  });

  /* ============ 3) Dues list ============ */
  async function renderDues() {
    const page = $('page-dues');
    if (!page) return;
    const st = EEE.state.settings || {};
    page.innerHTML = '';
    if (!st.start_date) { page.appendChild(el('p', 'empty', 'Set the fund start date in Settings first.')); return; }
    const r = await db.from('payment_weeks').select('week_start, payments(student_id, status)');
    if (r.error) { page.appendChild(el('p', 'err', 'Could not load: ' + r.error.message)); return; }

    const taken = {};
    (r.data || []).forEach(x => {
      const p = x.payments;
      if (!p || (p.status !== 'approved' && p.status !== 'pending')) return;
      (taken[p.student_id] = taken[p.student_id] || new Set()).add(x.week_start);
    });

    const t = today();
    const need = [];
    let [y, m] = st.start_date.split('-').map(Number);
    while (y < t.y || (y === t.y && m <= t.m)) {
      START.forEach(day => {
        if (day > dim(y, m)) return;
        if (y === t.y && m === t.m && day > t.d) return;
        need.push(y + '-' + pad(m) + '-' + pad(day));
      });
      m++; if (m > 12) { m = 1; y++; }
    }
    const weekly = Number(st.weekly_amount || 30);
        const rows = EEE.getMembers().filter(x => x.is_active && x.approved).map(s => {
      const got = taken[s.id] || new Set();
      const due = need.filter(w => !got.has(w)).length;
      return { s, paid: need.length - due, due };
    }).sort((a, b) => b.due - a.due);

    const grand = rows.reduce((a, x) => a + x.due * weekly, 0);
    const card = el('div', 'card');
    card.appendChild(el('h2', '', 'Dues (up to this week)'));
    card.appendChild(el('div', 'help', 'Total due: ' + money(grand) + ' · Weeks counted from the fund start date. Pending payments count as paid.'));
    const wrap = el('div', 'scroll');
    const table = el('table');
    table.innerHTML = '<thead><tr><th>Student</th><th>Roll</th><th>Paid weeks</th><th>Due weeks</th><th>Due amount</th></tr></thead>';
    const tb = el('tbody'); table.appendChild(tb); wrap.appendChild(table); card.appendChild(wrap);
    page.appendChild(card);
    EEE.fill(tb, rows, [
      x => x.s.full_name || '-', x => x.s.roll_no || '-', x => String(x.paid),
      x => EEE.pill(String(x.due), x.due ? 'no' : 'ok'), x => money(x.due * weekly)
    ], 'No active members');
  }
  EEE.addPage('dues', { title: 'Dues', label: 'Dues', icon: 'users', roles: ['admin'], onShow: renderDues });

  /* ============ 4) Payment Log (shows the payment method) ============ */
  const L_LIMIT = 20;
  let lBuilt = false, lRows = [], lOpen = false, lUI = {};

  async function lLoad() {
    if (!isAdmin()) return;
    const r = await db.from('payments')
      .select('id, amount, method, transaction_id, sender_number, status, submitted_at, students(full_name, roll_no), payment_weeks(week_start)')
      .order('submitted_at', { ascending: false })
      .limit(1000);
    if (r.error) { toast('Could not load payment log: ' + r.error.message); return; }
    lRows = r.data || [];
    if (lBuilt) lRender();
  }

  function lRender() {
    const approved = lRows.filter(p => p.status === 'approved');
    lUI.cards.innerHTML = '';
    ['bkash', 'nagad', 'cash'].forEach(k => {
      const list = approved.filter(p => String(p.method).toLowerCase() === k);
      const sum = list.reduce((a, p) => a + Number(p.amount || 0), 0);
      const c = el('div', 'card stat');
      c.style.cssText = 'background:' + METHODS[k].color + ';color:#fff;border:0;';
      const w = el('div');
      const l = el('div', 'lbl', METHODS[k].label + ' (approved · ' + list.length + ')');
      l.style.color = 'rgba(255,255,255,.92)';
      w.appendChild(l);
      w.appendChild(el('div', 'val', money(sum)));
      c.appendChild(w);
      lUI.cards.appendChild(c);
    });

    const mf = lUI.method.value, sf = lUI.status.value, q = lUI.q.value.trim().toLowerCase();
    const list = lRows.filter(p => {
      if (mf !== 'all' && String(p.method).toLowerCase() !== mf) return false;
      if (sf !== 'all' && p.status !== sf) return false;
      if (q) {
        const hay = [(p.students && p.students.full_name) || '', p.transaction_id || '', p.sender_number || ''].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const shown = lOpen ? list : list.slice(0, L_LIMIT);
    EEE.fill(lUI.tbody, shown, [
      p => EEE.fmtTime(p.submitted_at),
      p => (p.students && p.students.full_name) || '-',
      p => mBadge(p.method),
      p => money(p.amount),
      p => EEE.weeksText((p.payment_weeks || []).map(w => w.week_start).sort()) || '-',
      p => p.transaction_id || '-',
      p => p.sender_number || '-',
      p => statusPill(p.status)
    ], 'No payments found');
    lUI.count.textContent = 'Showing ' + shown.length + ' of ' + list.length + ' payments';
    lUI.more.hidden = list.length <= L_LIMIT;
    lUI.more.textContent = lOpen ? 'Show less' : 'Show more (' + (list.length - L_LIMIT) + ')';
  }

  function lBuild() {
    const page = $('page-paylog');
    if (!page || lBuilt) return;
    page.innerHTML = '';
    const cards = el('div', 'cards');
    page.appendChild(cards);

    const card = el('div', 'card');
    card.appendChild(el('h2', '', 'All payments by method'));
    const tools = el('div', 'tools');
    const q = el('input'); q.placeholder = 'Search name, TrxID or sender number';
    const method = el('select');
    [['all', 'All methods'], ['bkash', 'bKash'], ['nagad', 'Nagad'], ['cash', 'Cash']].forEach(([v, t]) => {
      const o = el('option', '', t); o.value = v; method.appendChild(o);
    });
    const status = el('select');
    [['all', 'All status'], ['approved', 'Approved'], ['pending', 'Pending'], ['rejected', 'Rejected']].forEach(([v, t]) => {
      const o = el('option', '', t); o.value = v; status.appendChild(o);
    });
    method.style.cssText = status.style.cssText = 'width:auto;min-width:140px;margin:0;';
    tools.appendChild(q); tools.appendChild(method); tools.appendChild(status);
    card.appendChild(tools);
    const count = el('div', 'help', '');
    card.appendChild(count);
    const wrap = el('div', 'scroll');
    const table = el('table');
    table.innerHTML = '<thead><tr><th>Submitted</th><th>Student</th><th>Method</th><th>Amount</th><th>Weeks</th><th>TrxID</th><th>Sender</th><th>Status</th></tr></thead>';
    const tbody = el('tbody');
    table.appendChild(tbody); wrap.appendChild(table); card.appendChild(wrap);
    const more = el('button', 'btn ghost full', 'Show more');
    more.style.marginTop = '12px'; more.hidden = true;
    card.appendChild(more);
    page.appendChild(card);

    lUI = { cards, q, method, status, count, tbody, more };
    q.addEventListener('input', () => { lOpen = false; lRender(); });
    method.addEventListener('change', () => { lOpen = false; lRender(); });
    status.addEventListener('change', () => { lOpen = false; lRender(); });
    more.addEventListener('click', () => { lOpen = !lOpen; lRender(); });
    lBuilt = true;
    lRender();
  }

  EEE.addPage('paylog', {
    title: 'Payment Log', label: 'Payment Log', icon: 'chart', roles: ['admin'],
    onShow: async function () { lBuild(); await lLoad(); }
  });

  /* ============ 5) Admin profile (opens from the top-right Profile icon) ============ */
  let pBuilt = false, pEditing = false;
  let pData = { full_name: '', phone: '', designation: '' };
  let pUI = {};

  function pName() { return (pData.full_name || '').trim() || 'Admin'; }

  function pHeader() {
    const name = pName();
    const avn = $('av-name'); if (avn) avn.textContent = name;
    if (!pBuilt) return;
    pUI.avatar.textContent = name.charAt(0).toUpperCase();
    pUI.name.textContent = name;
    pUI.desig.textContent = pData.designation || 'Class Fund Admin';
    pUI.mail.textContent = '✉  ' + (EEE.state.email || '-');
    pUI.phone.textContent = pData.phone ? '☎  ' + pData.phone : '☎  Phone not added';
  }
  function pFill() {
    if (!pBuilt) return;
    pUI.nameIn.value = pData.full_name || '';
    pUI.phoneIn.value = pData.phone || '';
    pUI.desigIn.value = pData.designation || '';
    pUI.mailIn.value = EEE.state.email || '';
  }
  function pSetEditing(on) {
    pEditing = on;
    if (!pBuilt) return;
    [pUI.nameIn, pUI.phoneIn, pUI.desigIn].forEach(i => { i.disabled = !on; i.style.background = on ? '#fff' : '#f1f5f9'; });
    pUI.mailIn.disabled = true; pUI.mailIn.style.background = '#f1f5f9';
    pUI.edit.hidden = on; pUI.save.hidden = !on; pUI.cancel.hidden = !on;
  }
  async function pLoad() {
    if (!isAdmin() || !EEE.state.user) return;
    const r = await db.from('profiles').select('full_name, phone, designation').eq('id', EEE.state.user.id).maybeSingle();
    if (r.error) { toast('Could not load profile: ' + r.error.message); return; }
    pData = r.data || pData;
    pHeader();
    if (!pEditing) pFill();
  }
  async function pSave() {
    const msg = pUI.msg;
    msg.className = 'err'; msg.textContent = '';
    const name = pUI.nameIn.value.trim();
    const phone = pUI.phoneIn.value.trim();
    const desig = pUI.desigIn.value.trim();
    if (!name) { msg.textContent = 'Name is required.'; return; }
    if (phone && !/^01[0-9]{9}$/.test(phone)) { msg.textContent = 'Phone must be 11 digits and start with 01.'; return; }
    pUI.save.disabled = true;
    const r = await db.rpc('update_admin_profile', { new_name: name, new_phone: phone, new_designation: desig });
    pUI.save.disabled = false;
    if (r.error) { msg.textContent = 'Could not save: ' + r.error.message; return; }
    pData = { full_name: name, phone: phone, designation: desig };
    pHeader(); pFill(); pSetEditing(false);
    msg.className = 'ok'; msg.textContent = 'Profile updated.';
  }

  function pStatCard(label, value, bg) {
    const c = el('div', 'pcard');
    c.style.cssText = 'background:' + bg + ';border:0;color:#fff;box-shadow:0 6px 16px rgba(15,23,42,.18);';
    const l = el('div', 'pl', label); l.style.color = 'rgba(255,255,255,.88)';
    const v = el('div', 'pval', value); v.style.color = '#fff'; v.style.fontSize = '22px'; v.style.fontWeight = '800';
    c.appendChild(l); c.appendChild(v);
    return c;
  }

  async function pStats() {
    if (!pBuilt || !isAdmin()) return;
    const sum = EEE.state.summary || {};
        const active = (EEE.getMembers ? EEE.getMembers() : []).filter(m => m.is_active && m.approved).length;
    const r = await db.from('payments')
      .select('amount, method, status, submitted_at, students(full_name)')
      .order('submitted_at', { ascending: false })
      .limit(500);
    const rows = r.error ? [] : (r.data || []);
    const pending = rows.filter(p => p.status === 'pending').length;

    pUI.stats.innerHTML = '';
    pUI.stats.appendChild(pStatCard('Active members', String(active), 'linear-gradient(135deg,#f59e0b,#fbbf24)'));
    pUI.stats.appendChild(pStatCard('Pending payments', String(pending), 'linear-gradient(135deg,#ef4444,#f97316)'));
    pUI.stats.appendChild(pStatCard('Total money in', money(sum.total_contributions), 'linear-gradient(135deg,#059669,#34d399)'));
    pUI.stats.appendChild(pStatCard('Total money out', money(sum.total_expenses), 'linear-gradient(135deg,#dc2626,#f97316)'));
    pUI.stats.appendChild(pStatCard('Current balance', money(sum.current_balance), 'linear-gradient(135deg,#2563eb,#7c3aed)'));

    const approved = rows.filter(p => p.status === 'approved');
    const totals = {};
    approved.forEach(p => { const k = String(p.method || '').toLowerCase(); totals[k] = (totals[k] || 0) + Number(p.amount || 0); });
    const all = Object.keys(totals).reduce((a, k) => a + totals[k], 0);
    pUI.methods.innerHTML = '';
    if (!all) pUI.methods.appendChild(el('p', 'empty', 'No approved payments yet.'));
    ['bkash', 'nagad', 'cash'].forEach(k => {
      if (!totals[k]) return;
      const pct = Math.round((totals[k] / all) * 100);
      const row = el('div'); row.style.marginBottom = '14px';
      const top = el('div'); top.style.cssText = 'display:flex;justify-content:space-between;font-size:14px;font-weight:700;margin-bottom:6px;';
      top.appendChild(el('span', '', METHODS[k].label));
      top.appendChild(el('span', '', money(totals[k]) + ' · ' + pct + '%'));
      const track = el('div'); track.style.cssText = 'height:10px;background:#e2e8f0;border-radius:999px;overflow:hidden;';
      const fillBar = el('div'); fillBar.style.cssText = 'height:100%;border-radius:999px;width:' + pct + '%;background:' + METHODS[k].color + ';';
      track.appendChild(fillBar);
      row.appendChild(top); row.appendChild(track);
      pUI.methods.appendChild(row);
    });

    pUI.recent.innerHTML = '';
    const recent = rows.slice(0, 6);
    if (!recent.length) pUI.recent.appendChild(el('p', 'empty', 'No activity yet.'));
    recent.forEach(p => {
      const it = el('div', 'feed-item');
      it.appendChild(el('div', 'fav', ((p.students && p.students.full_name) || '?').charAt(0).toUpperCase()));
      const main = el('div', 'fmain');
      main.appendChild(el('div', 'fname', (p.students && p.students.full_name) || 'Unknown'));
      main.appendChild(el('div', 'fsub', mInfo(p.method).label + ' · ' + EEE.fmtTime(p.submitted_at)));
      it.appendChild(main);
      const right = el('div'); right.style.cssText = 'text-align:right;';
      right.appendChild(el('div', 'famt', money(p.amount)));
      right.appendChild(statusPill(p.status));
      it.appendChild(right);
      pUI.recent.appendChild(it);
    });
  }

  function pBuild() {
    const page = $('page-adminprofile');
    if (!page || pBuilt) return;
    page.innerHTML = '';

    const hero = el('div', 'card');
    hero.style.cssText = 'padding:0;overflow:hidden;border-radius:20px;box-shadow:0 10px 28px rgba(30,27,75,.18);';
    const cover = el('div');
    cover.style.cssText = 'position:relative;height:130px;background:linear-gradient(135deg,#0f172a,#1e1b4b 50%,#6d28d9);overflow:hidden;';
    cover.innerHTML = '<div style="position:absolute;right:-40px;top:-60px;width:220px;height:220px;border-radius:50%;background:rgba(251,191,36,.18)"></div>' +
      '<div style="position:absolute;right:120px;bottom:-70px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,.08)"></div>' +
      '<div style="position:absolute;left:-30px;bottom:-50px;width:140px;height:140px;border-radius:50%;background:rgba(16,185,129,.18)"></div>';
    hero.appendChild(cover);

    const body = el('div');
    body.style.cssText = 'display:flex;gap:18px;align-items:flex-end;flex-wrap:wrap;padding:0 24px 24px;margin-top:-48px;position:relative;';
    const avatar = el('div', '', 'A');
    avatar.style.cssText = 'width:104px;height:104px;border-radius:50%;display:grid;place-items:center;font-size:44px;font-weight:800;color:#fde68a;background:linear-gradient(135deg,#312e81,#6d28d9);border:5px solid #fff;box-shadow:0 8px 20px rgba(15,23,42,.25);flex-shrink:0;';
    body.appendChild(avatar);
    const info = el('div'); info.style.cssText = 'flex:1;min-width:200px;padding-top:54px;';
    const nameRow = el('div'); nameRow.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;';
    const nameEl = el('div', '', 'Admin'); nameEl.style.cssText = 'font-size:26px;font-weight:800;color:#0f172a;';
    const badge = el('span', '', 'ADMIN');
    badge.style.cssText = 'background:#fbbf24;color:#1e1b4b;font-size:11px;font-weight:800;letter-spacing:1.5px;padding:4px 10px;border-radius:999px;';
    nameRow.appendChild(nameEl); nameRow.appendChild(badge);
    const desigEl = el('div', '', 'Class Fund Admin'); desigEl.style.cssText = 'font-size:15px;font-weight:700;color:#6d28d9;margin-top:2px;';
    const chips = el('div'); chips.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;';
    function chip() {
      const c = el('span', '', '-');
      c.style.cssText = 'background:#f1f5f9;color:#334155;font-size:13px;font-weight:600;padding:6px 12px;border-radius:999px;word-break:break-all;';
      chips.appendChild(c); return c;
    }
    const mailEl = chip(), phoneEl = chip();
    info.appendChild(nameRow); info.appendChild(desigEl); info.appendChild(chips);
    body.appendChild(info);
    hero.appendChild(body);
    page.appendChild(hero);

    const stats = el('div', 'pcards');
    page.appendChild(stats);

    const two = el('div'); two.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;margin-bottom:20px;';
    const mCard = el('div', 'card'); mCard.style.marginBottom = '0';
    mCard.appendChild(el('h2', '', 'Collection by method'));
    const methods = el('div'); mCard.appendChild(methods);
    const rCard = el('div', 'card'); rCard.style.marginBottom = '0';
    rCard.appendChild(el('h2', '', 'Recent activity'));
    const recent = el('div'); rCard.appendChild(recent);
    two.appendChild(mCard); two.appendChild(rCard);
    page.appendChild(two);

    const act = el('div', 'card');
    act.appendChild(el('h2', '', 'Quick actions'));
    const arow = el('div'); arow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';
    [['Review payments', 'review'], ['Payment log', 'paylog'], ['Add payment', 'manual'], ['Dues', 'dues'], ['Add expense', 'expenses'], ['Members', 'students'], ['Settings', 'settings']].forEach(([label, pg]) => {
      const b = el('button', 'btn ghost', label);
      b.addEventListener('click', () => EEE.showPage(pg));
      arow.appendChild(b);
    });
    act.appendChild(arow);
    page.appendChild(act);

    const ecard = el('div', 'card');
    ecard.style.border = '2px dashed #7c3aed';
    ecard.appendChild(el('h2', '', 'Your details'));
    const grid = el('div', 'formgrid');
    const nameIn = el('input'); nameIn.placeholder = 'Your full name';
    const phoneIn = el('input'); phoneIn.type = 'tel'; phoneIn.placeholder = '01XXXXXXXXX';
    const desigIn = el('input'); desigIn.placeholder = 'e.g. CR, Cashier';
    const mailIn = el('input'); mailIn.type = 'email';
    addField(grid, 'Full name', nameIn);
    addField(grid, 'Phone number', phoneIn);
    addField(grid, 'Designation', desigIn);
    addField(grid, 'Email (locked)', mailIn);
    ecard.appendChild(grid);
    ecard.appendChild(el('p', 'hint', 'You can edit your name, phone and designation. Email can only be changed from Supabase.'));
    const btns = el('div'); btns.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';
    const editBtn = el('button', 'btn', 'Edit');
    const saveBtn = el('button', 'btn', 'Save changes');
    const cancelBtn = el('button', 'btn ghost', 'Cancel');
    btns.appendChild(editBtn); btns.appendChild(saveBtn); btns.appendChild(cancelBtn);
    ecard.appendChild(btns);
    const msg = el('p', '');
    ecard.appendChild(msg);
    page.appendChild(ecard);

    const out = el('button', 'btn danger', 'Logout');
    out.addEventListener('click', () => { const b = $('av-logout'); if (b) b.click(); });
    page.appendChild(out);

    pUI = { avatar, name: nameEl, desig: desigEl, mail: mailEl, phone: phoneEl, stats, methods, recent, nameIn, phoneIn, desigIn, mailIn, edit: editBtn, save: saveBtn, cancel: cancelBtn, msg };
    editBtn.addEventListener('click', () => { msg.textContent = ''; pSetEditing(true); nameIn.focus(); });
    saveBtn.addEventListener('click', pSave);
    cancelBtn.addEventListener('click', () => { pFill(); pSetEditing(false); msg.textContent = ''; });

    pBuilt = true;
    pHeader(); pFill(); pSetEditing(false);
  }

  // nav:false = no sidebar button. Opens only from the top-right Profile icon.
  EEE.addPage('adminprofile', {
    title: 'My Profile', label: 'My Profile', icon: 'user', roles: ['admin'], nav: false,
    onShow: async function () { pBuild(); await pLoad(); await pStats(); }
  });

  /* ============ 6) Profile menu fix: show "My Profile" for the admin ============ */
  function showProfileBtn() {
    const b = $('av-profile');
    if (b && isAdmin() && b.hidden) b.hidden = false;
  }
  const avBtnEl = $('avatar');
  if (avBtnEl) avBtnEl.addEventListener('click', () => { showProfileBtn(); setTimeout(showProfileBtn, 0); });
  const profBtnEl = $('av-profile');
  if (profBtnEl) new MutationObserver(showProfileBtn).observe(profBtnEl, { attributes: true, attributeFilter: ['hidden'] });
  document.addEventListener('click', e => {
    if (!isAdmin() || !e.target.closest('#av-profile')) return;
    e.stopPropagation();
    const m = $('avmenu'); if (m) m.hidden = true;
    EEE.showPage('adminprofile');
  }, true);

  /* ============ 7) Logout cleanup: forget everything the admin had ============ */
  // When anyone logs out, all built pages and data in memory are reset,
  // so the next person on the same tab never sees the old admin's data.
  function resetAfterLogout() {
    sBuilt = false;
    mBuilt = false;
    lBuilt = false;
    pBuilt = false;
    pEditing = false;
    lRows = [];
    lOpen = false;
    lUI = {};
    pUI = {};
    pData = { full_name: '', phone: '', designation: '' };
    mSel.clear();
    ['page-manual', 'page-paylog', 'page-adminprofile', 'page-dues'].forEach(id => {
      const p = $(id);
      if (p) p.innerHTML = '';
    });
    const box = $('settings-extra');
    if (box) box.innerHTML = '';
  }
  ['logout-btn', 'av-logout'].forEach(id => {
    const b = $(id);
    if (b) b.addEventListener('click', resetAfterLogout);
  });

  /* ---------- refresh hooks ---------- */
  EEE.refreshHooks.push(async () => {
    buildSettings();   // runs for everyone. Students get the admin cards removed.
    if (!isAdmin()) return;
    orderNav();
    showProfileBtn();
    if (!pBuilt) await pLoad();
    if (pBuilt) await pStats();
    if (lBuilt) await lLoad();
  });
})();
