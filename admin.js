(function () {
  'use strict';
  const EEE = window.EEE;
  if (!EEE) return;
  const { db, $, el, money, toast } = EEE;

  const START = [1, 8, 15, 22, 29];
  const ORD = ['1st', '2nd', '3rd', '4th', '5th'];
  const pad = n => String(n).padStart(2, '0');
  const dim = (y, m) => new Date(y, m, 0).getDate();
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
  const isAdmin = () => EEE.state.role === 'admin';

  /* ---------- sidebar order (admin) ---------- */
  function orderNav() {
    const nav = $('nav');
    if (!nav || !isAdmin()) return;
    ['overview', 'review', 'manual', 'dues', 'expenses', 'students', 'report', 'settings'].forEach(id => {
      const b = nav.querySelector('.nav[data-page="' + id + '"]');
      if (b) nav.appendChild(b);
    });
  }

  /* ============ 1) Settings: fund + contact + categories ============ */
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
    const st = EEE.state.settings || {};
    const card = el('div', 'card');
    card.appendChild(el('h2', '', title));
    const grid = el('div', 'formgrid');
    const inputs = {};
    defs.forEach(([key, label, type]) => {
      const i = el('input'); i.type = type;
      if (type === 'number') { i.min = '1'; i.step = '1'; }
      i.value = st[key] == null ? '' : st[key];
      inputs[key] = i;
      addField(grid, label, i);
    });
    card.appendChild(grid);
    if (hintText) card.appendChild(el('p', 'hint', hintText));
    const btn = el('button', 'btn', 'Save');
    const msg = el('p', '');
    card.appendChild(btn); card.appendChild(msg);
    btn.addEventListener('click', async () => {
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
      btn.disabled = true;
      const r = await db.from('fund_settings').update(payload).eq('id', 1);
      btn.disabled = false;
      if (r.error) { msg.textContent = 'Could not save: ' + r.error.message; return; }
      EEE.state.settings = Object.assign({}, EEE.state.settings, payload);
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

  function buildSettings() {
    const box = $('settings-extra');
    if (!box || sBuilt) return;
    sBuilt = true;
    box.innerHTML = '';
    box.appendChild(settingsCard('Fund settings', FUND, 'Changing the weekly amount affects new payments and the dues calculation.'));
    box.appendChild(settingsCard('Contact information', CONTACT, ''));
    box.appendChild(categoriesCard());
  }
  EEE.refreshHooks.push(async () => { if (isAdmin()) { buildSettings(); orderNav(); } });

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
      EEE.getMembers().filter(x => x.is_active).forEach(x => {
        const o = el('option', '', (x.full_name || '-') + (x.roll_no ? ' (Roll ' + x.roll_no + ')' : ''));
        o.value = x.id; stu.appendChild(o);
      });
      stu.value = keep;
    }
    month.addEventListener('change', drawWeeks);
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
    const rows = EEE.getMembers().filter(x => x.is_active).map(s => {
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
})();
