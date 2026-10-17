(function () {
  'use strict';
  const EEE = window.EEE;
  if (!EEE) return;
  const { db, el, money, toast, fmtDay, fmtTime, pill, fill } = EEE;

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

  function pendingCard(p) {
    const card = el('div', 'card');
    const st = p.students || {};
    card.appendChild(el('h2', '', (st.full_name || 'Unknown') + (st.roll_no ? ' (Roll ' + st.roll_no + ')' : '')));
    const lines = [
      ['Method', p.method],
      ['TrxID', p.transaction_id],
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
      if (!confirm('Approve ' + money(p.amount) + ' from ' + (st.full_name || 'this student') + '?\nTrxID: ' + p.transaction_id)) return;
      ok.disabled = no.disabled = true; await review(p, true, note.value.trim());
      ok.disabled = no.disabled = false;
    });
    no.addEventListener('click', async () => {
      if (!confirm('Reject this payment?\nTrxID: ' + p.transaction_id)) return;
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
      p => p.method,
      p => p.transaction_id,
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
})();
