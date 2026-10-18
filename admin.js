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
})();
