(function () {
  'use strict';
  const EEE = window.EEE;
  if (!EEE) return;
  const { db, $, el, money, toast } = EEE;

  const isAdmin = () => EEE.state.role === 'admin';
  const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });

  function addField(grid, label, input) {
    const w = el('div');
    w.appendChild(el('label', '', label));
    w.appendChild(input);
    grid.appendChild(w);
  }

  /* ============ 1) REVIEW: pending payments (approve / reject) ============ */
  async function renderReview(page) {
    if (!page || !isAdmin()) return;
    page.innerHTML = '';
    page.appendChild(el('p', 'empty', 'Loading...'));

    const r = await db.from('payments')
      .select('id, amount, method, transaction_id, sender_number, submitted_at, students(full_name, roll_no), payment_weeks(week_start)')
      .eq('status', 'pending')
      .order('submitted_at', { ascending: true });

    page.innerHTML = '';
    if (r.error) {
      page.appendChild(el('p', 'err', 'Could not load payments: ' + r.error.message));
      return;
    }
    const rows = r.data || [];
    EEE.setBadge('review', rows.length);

    const card = el('div', 'card');
    card.appendChild(el('h2', '', 'Payments waiting for review'));
    card.appendChild(el('div', 'help', rows.length + ' pending. Check the TrxID in your bKash/Nagad app before approving.'));
    const wrap = el('div', 'scroll');
    const table = el('table');
    table.innerHTML = '<thead><tr><th>Submitted</th><th>Student</th><th>Method</th><th>Amount</th><th>Weeks</th><th>TrxID</th><th>Sender</th><th>Action</th></tr></thead>';
    const tb = el('tbody');
    table.appendChild(tb); wrap.appendChild(table); card.appendChild(wrap);
    page.appendChild(card);

    async function decide(p, approve, btns) {
      let note = null;
      if (approve) {
        if (!confirm('Approve ' + money(p.amount) + ' from ' + ((p.students && p.students.full_name) || 'this student') + '?')) return;
      } else {
        const reason = prompt('Why are you rejecting this payment? (the student will see this)');
        if (reason === null) return;
        note = reason.trim() || null;
      }
      btns.forEach(b => { b.disabled = true; });
      const res = await db.rpc('review_payment', { p_payment_id: p.id, p_approve: approve, p_note: note });
      if (res.error) {
        btns.forEach(b => { b.disabled = false; });
        toast('Could not save: ' + res.error.message);
        return;
      }
      toast(approve ? 'Payment approved.' : 'Payment rejected.');
      await renderReview(page);
      if (EEE.refresh) EEE.refresh();
    }

    EEE.fill(tb, rows, [
      p => EEE.fmtTime(p.submitted_at),
      p => ((p.students && p.students.full_name) || '-') + ((p.students && p.students.roll_no) ? ' (Roll ' + p.students.roll_no + ')' : ''),
      p => p.method || '-',
      p => money(p.amount),
      p => EEE.weeksText((p.payment_weeks || []).map(w => w.week_start).sort()) || '-',
      p => p.transaction_id || '-',
      p => p.sender_number || '-',
      p => {
        const box = el('div'); box.style.cssText = 'display:flex;gap:6px;';
        const ok = el('button', 'btn sm', 'Approve');
        const no = el('button', 'btn danger sm', 'Reject');
        ok.addEventListener('click', () => decide(p, true, [ok, no]));
        no.addEventListener('click', () => decide(p, false, [ok, no]));
        box.appendChild(ok); box.appendChild(no);
        return box;
      }
    ], 'No payments are waiting for review');
  }

  EEE.addPage('review', {
    title: 'Review Payments', label: 'Review', icon: 'clock', roles: ['admin'],
    onShow: function (page) { renderReview(page); }
  });

  /* ============ 2) EXPENSES: add and list ============ */
  async function renderExpenses(page) {
    if (!page || !isAdmin()) return;
    page.innerHTML = '';

    const cats = await db.from('expense_categories').select('id, name').order('name');
    const catList = cats.error ? [] : (cats.data || []);
    const catName = {};
    catList.forEach(c => { catName[c.id] = c.name; });

    /* ----- add form ----- */
    const form = el('div', 'card');
    form.style.border = '2px dashed #ef4444';
    form.appendChild(el('h2', '', 'Add an expense'));
    const grid = el('div', 'formgrid');
    const date = el('input'); date.type = 'date'; date.value = todayISO();
    const cat = el('select');
    const first = el('option', '', 'Select category'); first.value = ''; cat.appendChild(first);
    catList.forEach(c => { const o = el('option', '', c.name); o.value = c.id; cat.appendChild(o); });
    const reason = el('input'); reason.placeholder = 'Reason (what was it for?)';
    const amount = el('input'); amount.type = 'number'; amount.min = '1'; amount.step = '1'; amount.placeholder = 'Amount (৳)';
    const receipt = el('input'); receipt.type = 'url'; receipt.placeholder = 'Receipt link (optional, https://...)';
    addField(grid, 'Date', date);
    addField(grid, 'Category', cat);
    addField(grid, 'Reason', reason);
    addField(grid, 'Amount (৳)', amount);
    addField(grid, 'Receipt link', receipt);
    form.appendChild(grid);
    if (cats.error) form.appendChild(el('p', 'err', 'Could not load categories: ' + cats.error.message));
    else if (!catList.length) form.appendChild(el('p', 'hint', 'No categories yet. Add one in Settings first.'));
    const add = el('button', 'btn', 'Add expense');
    const msg = el('p', '');
    form.appendChild(add); form.appendChild(msg);
    page.appendChild(form);

    /* ----- list ----- */
    const listCard = el('div', 'card');
    listCard.appendChild(el('h2', '', 'Recent expenses'));
    const totalBox = el('div', 'help', '');
    listCard.appendChild(totalBox);
    const wrap = el('div', 'scroll');
    const table = el('table');
    table.innerHTML = '<thead><tr><th>Date</th><th>Reason</th><th>Category</th><th>Amount</th><th>Receipt</th><th>Action</th></tr></thead>';
    const tb = el('tbody');
    table.appendChild(tb); wrap.appendChild(table); listCard.appendChild(wrap);
    page.appendChild(listCard);

    async function loadList() {
      const r = await db.from('expenses')
        .select('id, category_id, expense_date, reason, amount, receipt_url')
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100);
      if (r.error) {
        tb.innerHTML = '';
        const tr = el('tr'), td = el('td', 'err', 'Could not load expenses: ' + r.error.message);
        td.colSpan = 6; tr.appendChild(td); tb.appendChild(tr);
        return;
      }
      const rows = r.data || [];
      const sum = rows.reduce((a, x) => a + Number(x.amount || 0), 0);
      totalBox.textContent = 'Showing latest ' + rows.length + ' · Total: ' + money(sum);
      EEE.fill(tb, rows, [
        x => EEE.fmtDate(x.expense_date),
        x => x.reason || '-',
        x => catName[x.category_id] || '-',
        x => money(x.amount),
        x => {
          if (x.receipt_url && /^https?:\/\//i.test(x.receipt_url)) {
            const a = el('a', '', 'View');
            a.href = x.receipt_url; a.target = '_blank'; a.rel = 'noopener noreferrer';
            return a;
          }
          return '-';
        },
        x => {
          const del = el('button', 'btn danger sm', 'Delete');
          del.addEventListener('click', async () => {
            if (!confirm('Delete this expense?\n' + (x.reason || '') + ' · ' + money(x.amount))) return;
            del.disabled = true;
            const d = await db.from('expenses').delete().eq('id', x.id);
            if (d.error) { del.disabled = false; toast('Could not delete: ' + d.error.message); return; }
            toast('Expense deleted.');
            loadList();
            if (EEE.refresh) EEE.refresh();
          });
          return del;
        }
      ], 'No expenses yet');
    }

    add.addEventListener('click', async () => {
      msg.className = 'err'; msg.textContent = '';
      const amt = Number(amount.value);
      const rs = reason.value.trim();
      const rc = receipt.value.trim();
      if (!date.value) { msg.textContent = 'Please select the date.'; return; }
      if (!cat.value) { msg.textContent = 'Please select a category.'; return; }
      if (!rs) { msg.textContent = 'Please write the reason.'; return; }
      if (!(amt > 0)) { msg.textContent = 'Amount must be more than 0.'; return; }
      if (rc && !/^https?:\/\//i.test(rc)) { msg.textContent = 'Receipt link must start with https://'; return; }
      if (!confirm('Add expense of ' + money(amt) + ' for "' + rs + '"?')) return;
      add.disabled = true;
      const r = await db.from('expenses').insert({
        expense_date: date.value,
        category_id: cat.value,
        reason: rs,
        amount: amt,
        receipt_url: rc || null,
        created_by: EEE.state.user ? EEE.state.user.id : null
      });
      add.disabled = false;
      if (r.error) { msg.textContent = 'Could not add: ' + r.error.message; return; }
      reason.value = ''; amount.value = ''; receipt.value = '';
      toast('Expense added.');
      loadList();
      if (EEE.refresh) EEE.refresh();
    });

    loadList();
  }

  EEE.addPage('expenses', {
    title: 'Expenses', label: 'Expenses', icon: 'card', roles: ['admin'],
    onShow: function (page) { renderExpenses(page); }
  });

  /* ---------- sidebar badge for pending payments ---------- */
  EEE.refreshHooks.push(async () => {
    if (!isAdmin()) return;
    const r = await db.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'pending');
    if (!r.error) EEE.setBadge('review', r.count || 0);
  });
})();
