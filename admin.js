(function () {
  'use strict';
  const EEE = window.EEE;
  if (!EEE) return;
  const { db, $, el, money, toast, fmtDay, fmtDate, fmtTime, pill, fill } = EEE;

  const ORD = ['1st', '2nd', '3rd', '4th', '5th'];
  function weekName(iso) {
    const day = parseInt(String(iso).slice(8, 10), 10);
    const n = Math.ceil(day / 7);
    const mon = new Date(String(iso).slice(0, 7) + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'short' });
    return (ORD[n - 1] || n + 'th') + ' week of ' + mon;
  }

  let rows = [];

  async function load() {
    const r = await db
      .from('payments')
      .select('id, amount, method, transaction_id, sender_number, status, review_note, submitted_at, reviewed_at, students(full_name, roll_no), payment_weeks(week_start)')
      .order('submitted_at', { ascending: false })
      .limit(500);
    if (r.error) { toast('Could not load payments: ' + r.error.message); return; }
    rows = r.data || [];
    render();
    renderAdminProfile();
  }

  function weeksOf(p) {
    return (p.payment_weeks || []).map(w => w.week_start).sort().map(weekName).join(', ');
  }

  async function review(p, approve, note) {
    const r = await db.rpc('review_payment', { p_payment_id: p.id, p_approve: approve, p_note: note || null });
    if (r.error) { toast('Could not review: ' + r.error.message); return; }
    toast(approve ? 'Payment approved.' : 'Payment rejected.');
    if (EEE.refresh) await EEE.refresh(); else await load();
  }

  /* ---------- method badge & TrxID helpers ---------- */
  function methodBadge(method) {
    const m = String(method || '-');
    const b = el('span', '', m);
    const low = m.toLowerCase();
    let bg = '#e5e7eb', fg = '#374151';
    if (low === 'bkash') { bg = '#e2136e'; fg = '#ffffff'; }
    else if (low === 'nagad') { bg = '#f6921e'; fg = '#ffffff'; }
    b.style.cssText = 'display:inline-block;padding:3px 12px;border-radius:999px;font-weight:700;font-size:13px;background:' + bg + ';color:' + fg + ';';
    return b;
  }

  function trxText(trx) {
    const s = el('span', '', trx || '-');
    s.style.cssText = 'font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:700;letter-spacing:.5px;background:#f1f5f9;padding:2px 8px;border-radius:6px;';
    return s;
  }

  function copyText(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => toast('TrxID copied.'), () => toast('Could not copy.'));
    } else {
      toast('Copy is not supported on this browser.');
    }
  }

  function pendingCard(p) {
    const card = el('div', 'card');
    const st = p.students || {};

    // Header: name + method badge
    const head = el('div');
    head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;';
    head.appendChild(el('h2', '', (st.full_name || 'Unknown') + (st.roll_no ? ' (Roll ' + st.roll_no + ')' : '')));
    head.appendChild(methodBadge(p.method));
    card.appendChild(head);

    // TrxID highlight box
    const trxBox = el('div');
    trxBox.style.cssText = 'margin:10px 0;padding:12px;border:2px dashed #10b981;border-radius:10px;background:#ecfdf5;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;';
    const trxLeft = el('div');
    const trxLbl = el('div', 'lbl', 'TrxID / Transaction Reference');
    const trxVal = el('div', '', p.transaction_id || '-');
    trxVal.style.cssText = 'font-family:ui-monospace,Menlo,Consolas,monospace;font-size:20px;font-weight:800;letter-spacing:1px;color:#065f46;word-break:break-all;';
    trxLeft.appendChild(trxLbl);
    trxLeft.appendChild(trxVal);
    const copyBtn = el('button', 'btn ghost sm', 'Copy');
    copyBtn.addEventListener('click', () => copyText(p.transaction_id || ''));
    trxBox.appendChild(trxLeft);
    trxBox.appendChild(copyBtn);
    card.appendChild(trxBox);

    const lines = [
      ['Sender number', p.sender_number || '-'],
      ['Weeks', weeksOf(p) || '-'],
      ['Amount', money(p.amount)],
      ['Submitted', fmtTime(p.submitted_at)]
    ];
    lines.forEach(([k, v]) => {
      const d = el('div');
      d.appendChild(el('span', 'lbl', k + ': '));
      d.appendChild(el('b', '', v));
      card.appendChild(d);
    });

    const note = el('input'); note.placeholder = 'Reason (optional, for Reject)';
    note.style.marginTop = '10px';
    card.appendChild(note);
    const row = el('div'); row.style.cssText = 'display:flex;gap:8px;margin-top:10px;';
    const ok = el('button', 'btn sm', 'Approve');
    const no = el('button', 'btn danger sm', 'Reject');
    ok.addEventListener('click', async () => {
      if (!confirm('Approve ' + money(p.amount) + ' from ' + (st.full_name || 'this student') + '?\nMethod: ' + p.method + '\nTrxID: ' + p.transaction_id)) return;
      ok.disabled = no.disabled = true; await review(p, true, note.value.trim());
      ok.disabled = no.disabled = false;
    });
    no.addEventListener('click', async () => {
      if (!confirm('Reject this payment?\nStudent: ' + (st.full_name || '-') + '\nMethod: ' + p.method + '\nTrxID: ' + p.transaction_id)) return;
      ok.disabled = no.disabled = true; await review(p, false, note.value.trim());
      ok.disabled = no.disabled = false;
    });
    row.appendChild(ok); row.appendChild(no);
    card.appendChild(row);
    return card;
  }

  function render() {
    const page = document.getElementById('page-review');
    if (!page) return;
    page.innerHTML = '';
    const pending = rows.filter(p => p.status === 'pending');
    const done = rows.filter(p => p.status !== 'pending');
    EEE.setBadge('review', pending.length);

    const head = el('div', 'card');
    head.appendChild(el('h2', '', 'Pending payments (' + pending.length + ')'));
    if (!pending.length) head.appendChild(el('p', 'empty', 'No payments are waiting for review.'));
    page.appendChild(head);
    pending.forEach(p => page.appendChild(pendingCard(p)));

    const hist = el('div', 'card');
    hist.appendChild(el('h2', '', 'Reviewed payments'));
    const wrap = el('div', 'scroll');
    const table = el('table');
    table.innerHTML = '<thead><tr><th>Student</th><th>Method</th><th>TrxID</th><th>Sender</th><th>Weeks</th><th>Amount</th><th>Status</th><th>Note</th></tr></thead>';
    const tb = el('tbody');
    table.appendChild(tb); wrap.appendChild(table); hist.appendChild(wrap);
    page.appendChild(hist);
    fill(tb, done, [
      p => (p.students && p.students.full_name) || '-',
      p => methodBadge(p.method),
      p => trxText(p.transaction_id),
      p => p.sender_number || '-',
      p => weeksOf(p) || '-',
      p => money(p.amount),
      p => pill(p.status === 'approved' ? 'Approved' : 'Rejected', p.status === 'approved' ? 'ok' : 'no'),
      p => p.review_note || '-'
    ], 'No reviewed payments yet');
  }

  EEE.addPage('review', {
    title: 'Payments',
    label: 'Payments',
    icon: 'clock',
    roles: ['admin'],
    onShow: load
  });
  EEE.refreshHooks.push(async () => {
    if (EEE.state.role === 'admin') await load();
  });

  /* =====================================================
     Admin: Expenses page (add, edit, delete money out)
     ===================================================== */
  const X_LIMIT = 10;
  let xBuilt = false;
  let xCats = [];
  let xRows = [];
  let xEditing = null;
  let xOpen = false;
  let xUI = {};

  function todayDhakaISO() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
  }
  function catName(id) {
    const c = xCats.find(x => x.id === id);
    return c ? c.name : '-';
  }

  function xResetForm() {
    xEditing = null;
    xUI.date.value = todayDhakaISO();
    xUI.cat.value = '';
    xUI.amount.value = '';
    xUI.reason.value = '';
    xUI.link.value = '';
    xUI.save.textContent = 'Add expense';
    xUI.cancel.hidden = true;
    xUI.title.textContent = 'Add new expense';
    xUI.msg.textContent = '';
  }

  function xStartEdit(row) {
    xEditing = row;
    xUI.date.value = row.expense_date || todayDhakaISO();
    xUI.cat.value = row.category_id || '';
    xUI.amount.value = row.amount;
    xUI.reason.value = row.reason || '';
    xUI.link.value = row.receipt_url || '';
    xUI.save.textContent = 'Save changes';
    xUI.cancel.hidden = false;
    xUI.title.textContent = 'Edit expense';
    xUI.msg.textContent = '';
    xUI.msg.className = '';
    xUI.formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function xFillCats() {
    const keep = xUI.cat.value;
    xUI.cat.innerHTML = '';
    const first = el('option', '', 'Select category');
    first.value = '';
    xUI.cat.appendChild(first);
    xCats.forEach(c => {
      const o = el('option', '', c.name);
      o.value = c.id;
      xUI.cat.appendChild(o);
    });
    xUI.cat.value = keep;
  }

  async function xSave() {
    const msg = xUI.msg;
    msg.className = 'err'; msg.textContent = '';
    const date = xUI.date.value;
    const catId = xUI.cat.value;
    const amount = Number(xUI.amount.value);
    const reason = xUI.reason.value.trim();
    const link = xUI.link.value.trim();

    if (!date) { msg.textContent = 'Please select the date.'; return; }
    if (!catId) { msg.textContent = 'Please select a category.'; return; }
    if (!reason) { msg.textContent = 'Please write the reason.'; return; }
    if (!(amount > 0)) { msg.textContent = 'Amount must be more than 0.'; return; }
    if (link && !/^https?:\/\//i.test(link)) { msg.textContent = 'Receipt link must start with http:// or https://'; return; }

    const payload = {
      expense_date: date,
      category_id: catId,
      reason: reason,
      amount: amount,
      receipt_url: link || null
    };

    xUI.save.disabled = true;
    let r;
    if (xEditing) {
      r = await db.from('expenses').update(payload).eq('id', xEditing.id);
    } else {
      payload.created_by = EEE.state.user ? EEE.state.user.id : null;
      r = await db.from('expenses').insert(payload);
    }
    xUI.save.disabled = false;
    if (r.error) { msg.textContent = 'Could not save: ' + r.error.message; return; }

    toast(xEditing ? 'Expense updated.' : 'Expense added.');
    xResetForm();
    xOpen = false;
    if (EEE.refresh) await EEE.refresh(); else await xLoad();
  }

  async function xDelete(row) {
    if (!confirm('Delete this expense?\n' + fmtDate(row.expense_date) + ' · ' + row.reason + ' · ' + money(row.amount))) return;
    const r = await db.from('expenses').delete().eq('id', row.id);
    if (r.error) { toast('Could not delete: ' + r.error.message); return; }
    toast('Expense deleted.');
    if (xEditing && xEditing.id === row.id) xResetForm();
    if (EEE.refresh) await EEE.refresh(); else await xLoad();
  }

  function xReceipt(url) {
    if (url && /^https?:\/\//i.test(url)) {
      const a = el('a', '', 'View');
      a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      return a;
    }
    return '-';
  }

  function xRenderList() {
    if (!xBuilt) return;
    const total = xRows.reduce((a, r) => a + Number(r.amount || 0), 0);
    xUI.total.textContent = 'Total expenses: ' + money(total) + ' (' + xRows.length + ' entries)';
    const shown = xOpen ? xRows : xRows.slice(0, X_LIMIT);
    fill(xUI.tbody, shown, [
      r => fmtDate(r.expense_date),
      r => r.reason || '-',
      r => catName(r.category_id),
      r => money(r.amount),
      r => xReceipt(r.receipt_url),
      r => {
        const box = el('div');
        box.style.cssText = 'display:flex;gap:6px;';
        const e = el('button', 'btn ghost sm', 'Edit');
        e.addEventListener('click', () => xStartEdit(r));
        const d = el('button', 'btn danger sm', 'Delete');
        d.addEventListener('click', () => xDelete(r));
        box.appendChild(e); box.appendChild(d);
        return box;
      }
    ], 'No expenses yet');
    xUI.more.hidden = xRows.length <= X_LIMIT;
    xUI.more.textContent = xOpen ? 'Show less' : 'Show more (' + (xRows.length - X_LIMIT) + ')';
  }

  async function xLoad() {
    if (EEE.state.role !== 'admin') return;
    const [c, e] = await Promise.all([
      db.from('expense_categories').select('id, name').order('name'),
      db.from('expenses')
        .select('id, expense_date, reason, amount, receipt_url, category_id')
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(500)
    ]);
    if (c.error) { toast('Could not load categories: ' + c.error.message); return; }
    if (e.error) { toast('Could not load expenses: ' + e.error.message); return; }
    xCats = c.data || [];
    xRows = e.data || [];
    if (xBuilt) { xFillCats(); xRenderList(); }
  }

  // The form is built only once, so the 20 second refresh never erases what the admin is typing.
  function xBuild() {
    const page = $('page-expenses');
    if (!page || xBuilt) return;
    page.innerHTML = '';

    const formCard = el('div', 'card');
    formCard.style.border = '2px dashed #10b981';
    const title = el('h2', '', 'Add new expense');
    formCard.appendChild(title);

    const grid = el('div', 'formgrid');
    function field(labelText, input) {
      const w = el('div');
      w.appendChild(el('label', '', labelText));
      w.appendChild(input);
      grid.appendChild(w);
    }
    const dateIn = el('input'); dateIn.type = 'date';
    const catSel = el('select');
    const amtIn = el('input'); amtIn.type = 'number'; amtIn.min = '0'; amtIn.step = '0.01'; amtIn.placeholder = 'e.g. 500';
    const reasonIn = el('input'); reasonIn.placeholder = 'e.g. Printing of class notice';
    const linkIn = el('input'); linkIn.type = 'url'; linkIn.placeholder = 'https://drive.google.com/... (optional)';
    field('Date', dateIn);
    field('Category', catSel);
    field('Amount (৳)', amtIn);
    field('Reason', reasonIn);
    field('Receipt link (optional)', linkIn);
    formCard.appendChild(grid);

    const hint = el('p', 'hint', 'For the receipt, upload the photo or PDF to Google Drive, set "Anyone with the link can view", and paste the link here.');
    formCard.appendChild(hint);

    const btns = el('div');
    btns.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';
    const saveBtn = el('button', 'btn', 'Add expense');
    const cancelBtn = el('button', 'btn ghost', 'Cancel edit');
    cancelBtn.hidden = true;
    btns.appendChild(saveBtn); btns.appendChild(cancelBtn);
    formCard.appendChild(btns);
    const msg = el('p', 'err');
    formCard.appendChild(msg);
    page.appendChild(formCard);

    const listCard = el('div', 'card');
    listCard.appendChild(el('h2', '', 'All expenses'));
    const total = el('div', 'help', '');
    listCard.appendChild(total);
    const wrap = el('div', 'scroll');
    const table = el('table');
    table.innerHTML = '<thead><tr><th>Date</th><th>Reason</th><th>Category</th><th>Amount</th><th>Receipt</th><th>Action</th></tr></thead>';
    const tbody = el('tbody');
    table.appendChild(tbody); wrap.appendChild(table); listCard.appendChild(wrap);
    const more = el('button', 'btn ghost full', 'Show more');
    more.style.marginTop = '12px';
    more.hidden = true;
    listCard.appendChild(more);
    page.appendChild(listCard);

    xUI = { formCard, title, date: dateIn, cat: catSel, amount: amtIn, reason: reasonIn, link: linkIn, save: saveBtn, cancel: cancelBtn, msg, total, tbody, more };
    saveBtn.addEventListener('click', xSave);
    cancelBtn.addEventListener('click', xResetForm);
    more.addEventListener('click', () => { xOpen = !xOpen; xRenderList(); });

    xBuilt = true;
    xFillCats();
    xResetForm();
    xRenderList();
  }

  EEE.addPage('expenses', {
    title: 'Expenses',
    label: 'Expenses',
    icon: 'card',
    roles: ['admin'],
    onShow: async function () { xBuild(); await xLoad(); }
  });
  EEE.refreshHooks.push(async () => {
    if (EEE.state.role === 'admin') await xLoad();
  });

  /* =====================================================
     Admin: Profile page (opens from the profile menu)
     Own look (dark banner + ADMIN badge), own name, phone, designation.
     The page is built once, so the 20 second refresh never erases typing.
     ===================================================== */
  let apBuilt = false;
  let apEditing = false;
  let apLoadedOnce = false;
  let apData = { full_name: '', phone: '', designation: '' };
  let apUI = {};

  function apName() { return (apData.full_name || '').trim() || 'Admin'; }

  function apRenderHeader() {
    const name = apName();
    const avn = $('av-name');
    if (avn) avn.textContent = name;
    if (!apBuilt) return;
    apUI.avatar.textContent = name.charAt(0).toUpperCase();
    apUI.name.textContent = name;
    apUI.desig.textContent = apData.designation || 'Class Fund Admin';
    apUI.mail.textContent = EEE.state.email || '-';
  }

  function apFillInputs() {
    if (!apBuilt) return;
    apUI.nameIn.value = apData.full_name || '';
    apUI.phoneIn.value = apData.phone || '';
    apUI.desigIn.value = apData.designation || '';
    apUI.mailIn.value = EEE.state.email || '';
  }

  function apSetEditing(on) {
    apEditing = on;
    if (!apBuilt) return;
    apUI.nameIn.disabled = !on;
    apUI.phoneIn.disabled = !on;
    apUI.desigIn.disabled = !on;
    apUI.mailIn.disabled = true;
    apUI.edit.hidden = on;
    apUI.save.hidden = !on;
    apUI.cancel.hidden = !on;
  }

  async function apLoadProfile() {
    if (EEE.state.role !== 'admin' || !EEE.state.user) return;
    const r = await db.from('profiles').select('full_name, phone, designation').eq('id', EEE.state.user.id).maybeSingle();
    if (r.error) { toast('Could not load profile: ' + r.error.message); return; }
    apData = r.data || { full_name: '', phone: '', designation: '' };
    apLoadedOnce = true;
    apRenderHeader();
    if (!apEditing) apFillInputs();
  }

  async function apSave() {
    const msg = apUI.msg;
    msg.className = 'err'; msg.textContent = '';
    const name = apUI.nameIn.value.trim();
    const phone = apUI.phoneIn.value.trim();
    const desig = apUI.desigIn.value.trim();
    if (!name) { msg.textContent = 'Name is required.'; return; }
    if (phone && !/^01[0-9]{9}$/.test(phone)) { msg.textContent = 'Phone must be 11 digits and start with 01.'; return; }
    apUI.save.disabled = true;
    const r = await db.rpc('update_admin_profile', { new_name: name, new_phone: phone, new_designation: desig });
    apUI.save.disabled = false;
    if (r.error) { msg.textContent = 'Could not save: ' + r.error.message; return; }
    apData = { full_name: name, phone: phone, designation: desig };
    apRenderHeader();
    apFillInputs();
    apSetEditing(false);
    msg.className = 'ok'; msg.textContent = 'Profile updated.';
  }

  function apStatCard(label, value, bg) {
    const c = el('div', 'pcard');
    c.style.cssText = 'background:' + bg + ';border:0;color:#fff;box-shadow:0 6px 16px rgba(15,23,42,.18);';
    const l = el('div', 'pl', label);
    l.style.color = 'rgba(255,255,255,.85)';
    const v = el('div', 'pval', value);
    v.style.color = '#fff';
    c.appendChild(l); c.appendChild(v);
    return c;
  }

  function apRenderStats() {
    if (!apBuilt) return;
    const sum = EEE.state.summary || {};
    const members = EEE.getMembers ? EEE.getMembers() : [];
    const active = members.filter(m => m.is_active).length;
    const pending = rows.filter(p => p.status === 'pending').length;
    apUI.stats.innerHTML = '';
    apUI.stats.appendChild(apStatCard('Active members', String(active), 'linear-gradient(135deg,#f59e0b,#fbbf24)'));
    apUI.stats.appendChild(apStatCard('Pending payments', String(pending), 'linear-gradient(135deg,#ef4444,#f97316)'));
    apUI.stats.appendChild(apStatCard('Total money in', money(sum.total_contributions), 'linear-gradient(135deg,#059669,#34d399)'));
    apUI.stats.appendChild(apStatCard('Total money out', money(sum.total_expenses), 'linear-gradient(135deg,#dc2626,#f97316)'));
    apUI.stats.appendChild(apStatCard('Current balance', money(sum.current_balance), 'linear-gradient(135deg,#2563eb,#7c3aed)'));
  }

  function apBuild() {
    const page = $('page-adminprofile');
    if (!page || apBuilt) return;
    page.innerHTML = '';

    // dark banner with ADMIN badge
    const banner = el('div');
    banner.style.cssText = 'position:relative;display:flex;align-items:center;gap:18px;flex-wrap:wrap;padding:28px 24px;margin-bottom:18px;border-radius:18px;color:#fff;background:linear-gradient(135deg,#0f172a,#1e1b4b 55%,#6d28d9);box-shadow:0 10px 26px rgba(30,27,75,.35);border-bottom:4px solid #fbbf24;';
    const avatar = el('div', '', 'A');
    avatar.style.cssText = 'width:84px;height:84px;border-radius:50%;display:grid;place-items:center;font-size:36px;font-weight:800;background:rgba(251,191,36,.2);border:3px solid #fbbf24;color:#fde68a;flex-shrink:0;';
    banner.appendChild(avatar);
    const info = el('div');
    const nameRow = el('div');
    nameRow.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;';
    const nameEl = el('div', '', 'Admin');
    nameEl.style.cssText = 'font-size:24px;font-weight:800;';
    const badge = el('span', '', 'ADMIN');
    badge.style.cssText = 'background:#fbbf24;color:#1e1b4b;font-size:11px;font-weight:800;letter-spacing:1.5px;padding:4px 10px;border-radius:999px;';
    nameRow.appendChild(nameEl); nameRow.appendChild(badge);
    const desigEl = el('div', '', 'Class Fund Admin');
    desigEl.style.cssText = 'font-size:15px;font-weight:600;color:#fde68a;margin-top:4px;';
    const mailEl = el('div', '', '-');
    mailEl.style.cssText = 'font-size:14px;opacity:.85;margin-top:2px;word-break:break-all;';
    info.appendChild(nameRow); info.appendChild(desigEl); info.appendChild(mailEl);
    banner.appendChild(info);
    page.appendChild(banner);

    // stats
    const stats = el('div', 'pcards');
    page.appendChild(stats);

    // quick actions
    const act = el('div', 'card');
    act.appendChild(el('h2', '', 'Quick actions'));
    const arow = el('div');
    arow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';
    [
      ['Review payments', 'review'],
      ['Add expense', 'expenses'],
      ['Members', 'students'],
      ['Change password', 'settings']
    ].forEach(([label, pg]) => {
      const b = el('button', 'btn ghost', label);
      b.addEventListener('click', () => EEE.showPage(pg));
      arow.appendChild(b);
    });
    act.appendChild(arow);
    page.appendChild(act);

    // edit card
    const ecard = el('div', 'card');
    ecard.style.border = '2px dashed #7c3aed';
    ecard.appendChild(el('h2', '', 'Your details'));
    const grid = el('div', 'formgrid');
    function field(labelText, input) {
      const w = el('div');
      w.appendChild(el('label', '', labelText));
      w.appendChild(input);
      grid.appendChild(w);
    }
    const nameIn = el('input'); nameIn.placeholder = 'Your full name';
    const phoneIn = el('input'); phoneIn.type = 'tel'; phoneIn.placeholder = '01XXXXXXXXX';
    const desigIn = el('input'); desigIn.placeholder = 'e.g. CR, Cashier';
    const mailIn = el('input'); mailIn.type = 'email';
    field('Full name', nameIn);
    field('Phone number', phoneIn);
    field('Designation', desigIn);
    field('Email (locked)', mailIn);
    ecard.appendChild(grid);
    ecard.appendChild(el('p', 'hint', 'You can edit your name, phone and designation. Email can only be changed from Supabase.'));
    const btns = el('div');
    btns.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';
    const editBtn = el('button', 'btn', 'Edit');
    const saveBtn = el('button', 'btn', 'Save changes');
    const cancelBtn = el('button', 'btn ghost', 'Cancel');
    saveBtn.hidden = true; cancelBtn.hidden = true;
    btns.appendChild(editBtn); btns.appendChild(saveBtn); btns.appendChild(cancelBtn);
    ecard.appendChild(btns);
    const msg = el('p', '');
    ecard.appendChild(msg);
    page.appendChild(ecard);

    // logout
    const out = el('button', 'btn danger', 'Logout');
    out.addEventListener('click', () => { const b = $('av-logout'); if (b) b.click(); });
    page.appendChild(out);

    apUI = { avatar, name: nameEl, desig: desigEl, mail: mailEl, stats, nameIn, phoneIn, desigIn, mailIn, edit: editBtn, save: saveBtn, cancel: cancelBtn, msg };
    editBtn.addEventListener('click', () => { msg.textContent = ''; apSetEditing(true); nameIn.focus(); });
    saveBtn.addEventListener('click', apSave);
    cancelBtn.addEventListener('click', () => { apFillInputs(); apSetEditing(false); msg.textContent = ''; });

    apBuilt = true;
    apRenderHeader();
    apFillInputs();
    apSetEditing(false);
    apRenderStats();
  }

  function renderAdminProfile() {
    if (EEE.state.role !== 'admin') return;
    apRenderStats();
  }

  EEE.addPage('adminprofile', {
    title: 'My Profile',
    label: 'My Profile',
    icon: 'user',
    roles: ['admin'],
    nav: false,
    onShow: async function () { apBuild(); apRenderStats(); await apLoadProfile(); }
  });
  // Load the admin name once after login so the top-right menu shows it too.
  EEE.refreshHooks.push(async () => {
    if (EEE.state.role === 'admin' && !apLoadedOnce) await apLoadProfile();
  });

  // Show "My Profile" in the top-right menu for admin, and open the admin profile page.
  const avBtn = $('avatar');
  if (avBtn) avBtn.addEventListener('click', () => {
    if (EEE.state.role === 'admin') { const b = $('av-profile'); if (b) b.hidden = false; }
  });
  document.addEventListener('click', e => {
    if (EEE.state.role === 'admin' && e.target.closest('#av-profile')) {
      e.stopPropagation();
      const m = $('avmenu'); if (m) m.hidden = true;
      EEE.showPage('adminprofile');
    }
  }, true);
})();
