(function () {
  'use strict';
  const EEE = window.EEE;
  if (!EEE) return;
  const { db, $, el, money, toast } = EEE;

  const ORD = ['1st', '2nd', '3rd', '4th', '5th'];
  const START_DAYS = [1, 8, 15, 22, 29];

  function pad(n) { return String(n).padStart(2, '0'); }
  function todayDhaka() {
    const s = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
    const p = s.split('-').map(Number);
    return { y: p[0], m: p[1], d: p[2] };
  }
  function monthKey(y, m) { return y + '-' + pad(m); }
  function monthLabel(k) {
    const d = new Date(k + '-01T00:00:00');
    return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }
  function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }

  // Only the current calendar week: 1-7 = 1st, 8-14 = 2nd, 15-21 = 3rd, 22-28 = 4th, 29-end = 5th
  function currentWeek() {
    const t = todayDhaka();
    let idx = 0;
    START_DAYS.forEach((day, i) => { if (day <= t.d) idx = i; });
    const startDay = START_DAYS[idx];
    const endDay = idx === 4 ? daysInMonth(t.y, t.m) : startDay + 6;
    const key = monthKey(t.y, t.m);
    return {
      iso: key + '-' + pad(startDay),
      name: ORD[idx] + ' week',
      range: startDay + ' - ' + endDay,
      month: monthLabel(key)
    };
  }

  async function takenWeeks() {
    const r = await db.from('payment_weeks').select('week_start, payments(status)');
    const set = new Set();
    (r.data || []).forEach(x => {
      const st = x.payments && x.payments.status;
      if (st === 'pending' || st === 'approved') set.add(x.week_start);
    });
    return set;
  }

  function friendlyError(msg) {
    msg = msg || '';
    if (/payments_trxid_unique|duplicate key/i.test(msg)) return 'This TrxID has already been used. Please check the TrxID and try again.';
    if (/already paid or waiting/i.test(msg)) return 'This week is already paid or waiting for approval.';
    if (/Invalid transaction ID/i.test(msg)) return 'TrxID must be 6 to 20 letters or digits (A-Z, 0-9).';
    if (/Sender number/i.test(msg)) return 'Sender number must be 11 digits and start with 01.';
    if (/Invalid week/i.test(msg)) return 'This week is not valid.';
    if (/Select between/i.test(msg)) return 'Please select the week.';
    return 'Could not submit payment: ' + msg;
  }

  async function openPay(method) {
    const st = EEE.state.settings || {};
    const number = method === 'bKash' ? st.bkash_number : st.nagad_number;
    if (!number || !st.start_date) {
      toast('Payment details are not set yet. Please contact the admin.');
      return;
    }
    const weekly = Number(st.weekly_amount || 30);
    const cw = currentWeek();
    const taken = await takenWeeks();
    const alreadyTaken = taken.has(cw.iso);
    const typed = { sender: '', trx: '' };

    const back = el('div', 'modal-back');
    back.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    const box = el('div', 'card');
    box.style.cssText = 'width:100%;max-width:420px;max-height:90vh;overflow:auto;';
    back.appendChild(box);

    function close() { back.remove(); }

    function draw() {
      box.innerHTML = '';
      box.appendChild(el('h2', '', 'Pay with ' + method));

      const info = el('div', 'help');
      info.appendChild(document.createTextNode('Send money (Send Money option) to this ' + method + ' number: '));
      info.appendChild(el('b', '', number));
      box.appendChild(info);

      const copy = el('button', 'btn ghost sm', 'Copy number');
      copy.addEventListener('click', () => {
        if (navigator.clipboard) navigator.clipboard.writeText(number).then(() => toast('Number copied.'), () => toast('Could not copy.'));
      });
      box.appendChild(copy);

      box.appendChild(el('label', '', 'Payment for'));
      const weekInfo = el('div', 'pname', cw.name + ' of ' + cw.month + ' (' + cw.range + ')');
      box.appendChild(weekInfo);

      if (alreadyTaken) {
        const note = el('p', 'help', 'This week is already paid or waiting for approval. There is nothing to pay right now.');
        box.appendChild(note);
        const closeBtn = el('button', 'btn ghost full', 'Close');
        closeBtn.style.marginTop = '8px';
        closeBtn.addEventListener('click', close);
        box.appendChild(closeBtn);
        return;
      }

      box.appendChild(el('div', 'pname', 'Amount: ' + money(weekly)));

      box.appendChild(el('label', '', 'Sender number (the number you sent from)'));
      const sender = el('input'); sender.type = 'tel'; sender.placeholder = '01XXXXXXXXX'; sender.id = 'pay-sender';
      sender.value = typed.sender;
      sender.addEventListener('input', () => { typed.sender = sender.value; });
      box.appendChild(sender);

      box.appendChild(el('label', '', 'TrxID (required)'));
      const trx = el('input'); trx.placeholder = 'e.g. 9H7ABC1234'; trx.id = 'pay-trx';
      trx.value = typed.trx;
      trx.addEventListener('input', () => { typed.trx = trx.value; });
      box.appendChild(trx);

      const msg = el('p', 'err');
      box.appendChild(msg);

      const submit = el('button', 'btn full', 'Submit payment');
      submit.addEventListener('click', async () => {
        msg.className = 'err'; msg.textContent = '';
        const s = sender.value.trim(), t = trx.value.trim().toUpperCase();
        if (!/^01[0-9]{9}$/.test(s)) { msg.textContent = 'Sender number must be 11 digits and start with 01.'; return; }
        if (!/^[A-Z0-9]{6,20}$/.test(t)) { msg.textContent = 'TrxID is required (6 to 20 letters or digits).'; return; }
        submit.disabled = true; submit.textContent = 'Submitting...';
        const r = await db.rpc('submit_payment', { p_method: method, p_sender: s, p_trx: t, p_weeks: [cw.iso] });
        if (r.error) {
          submit.disabled = false; submit.textContent = 'Submit payment';
          msg.textContent = friendlyError(r.error.message);
          return;
        }
        close();
        toast('Payment submitted. Waiting for admin approval.');
        if (EEE.refresh) EEE.refresh();
      });
      box.appendChild(submit);

      const cancel = el('button', 'btn ghost full', 'Cancel');
      cancel.style.marginTop = '8px';
      cancel.addEventListener('click', close);
      box.appendChild(cancel);
    }

    back.addEventListener('click', e => { if (e.target === back) close(); });
    document.body.appendChild(back);
    draw();
  }

  /* ---------- Student: My Payments page ---------- */
  function statCard(cls, icon, label, value) {
    const c = el('div', 'card stat ' + cls);
    c.appendChild(el('div', 'ico', icon));
    const wrap = el('div');
    wrap.appendChild(el('div', 'lbl', label));
    wrap.appendChild(el('div', 'val', value));
    c.appendChild(wrap);
    return c;
  }

  function statusCell(p) {
    const wrap = el('span');
    if (p.status === 'approved') wrap.appendChild(EEE.pill('Approved', 'ok'));
    else if (p.status === 'rejected') wrap.appendChild(EEE.pill('Rejected', 'no'));
    else {
      const pe = EEE.pill('Pending', '');
      pe.style.cssText = 'background:#fef3c7;color:#92400e;';
      wrap.appendChild(pe);
    }
    if (p.status === 'rejected' && p.review_note) {
      const n = el('div', 'help', 'Reason: ' + p.review_note);
      wrap.appendChild(n);
    }
    return wrap;
  }

  async function renderMy() {
    if (EEE.state.role !== 'student') return;
    const sec = $('page-mypayments');
    if (!sec) return;

    const r = await db.from('payments')
      .select('id, method, transaction_id, status, amount, submitted_at, review_note, payment_weeks(week_start, amount)')
      .order('submitted_at', { ascending: false });
    sec.innerHTML = '';
    if (r.error) {
      sec.appendChild(el('p', 'err', 'Could not load your payments: ' + r.error.message));
      return;
    }
    const list = r.data || [];
    const t = todayDhaka();
    const mk = monthKey(t.y, t.m);
    const weekly = Number((EEE.state.settings || {}).weekly_amount || 30);

    let totalPaid = 0, monthPaid = 0, pendingAmt = 0;
    const wstat = {};
    list.forEach(p => {
      const ws = p.payment_weeks || [];
      if (p.status === 'approved') {
        totalPaid += Number(p.amount);
        ws.forEach(w => { if (String(w.week_start).slice(0, 7) === mk) monthPaid += Number(w.amount); });
      }
      if (p.status === 'pending') pendingAmt += Number(p.amount);
      if (p.status === 'approved' || p.status === 'pending') {
        ws.forEach(w => {
          if (wstat[w.week_start] !== 'approved') wstat[w.week_start] = p.status;
        });
      }
    });

    // This month's weeks up to the current week
    const weeks = [];
    START_DAYS.forEach((day, i) => {
      if (day > daysInMonth(t.y, t.m) || day > t.d) return;
      const endDay = i === 4 ? daysInMonth(t.y, t.m) : day + 6;
      const iso = mk + '-' + pad(day);
      const isCurrent = t.d >= day && t.d <= endDay;
      weeks.push({ iso, name: ORD[i] + ' week (' + day + ' - ' + endDay + ')', isCurrent, status: wstat[iso] || 'due' });
    });
    const dueCount = weeks.filter(w => w.status === 'due').length;

    const cards = el('div', 'cards');
    cards.appendChild(statCard('s-in', '↓', 'Total paid (approved)', money(totalPaid)));
    cards.appendChild(statCard('s-bal', '৳', 'Paid this month', money(monthPaid)));
    cards.appendChild(statCard('s-stu', '⏳', 'Waiting for approval', money(pendingAmt)));
    cards.appendChild(statCard('s-out', '!', 'Due this month', money(dueCount * weekly)));
    sec.appendChild(cards);

    // This month weeks
    const wcard = el('div', 'card');
    wcard.appendChild(el('h2', '', 'This month: ' + monthLabel(mk)));
    weeks.forEach(w => {
      const row = el('div', 'feed-item');
      const main = el('div', 'fmain');
      main.appendChild(el('div', 'fname', w.name + (w.isCurrent ? ' · This week' : '')));
      row.appendChild(main);
      let p;
      if (w.status === 'approved') p = EEE.pill('Paid', 'ok');
      else if (w.status === 'pending') { p = EEE.pill('Pending', ''); p.style.cssText = 'background:#fef3c7;color:#92400e;'; }
      else p = EEE.pill('Due', 'no');
      row.appendChild(p);
      wcard.appendChild(row);
    });
    wcard.appendChild(el('div', 'chart-total', dueCount ? ('Weeks still due this month: ' + dueCount) : 'You are all paid up for this month.'));
    sec.appendChild(wcard);

    // History
    const hcard = el('div', 'card');
    hcard.appendChild(el('h2', '', 'My payment history'));
    const scroll = el('div', 'scroll');
    const table = el('table');
    const thead = el('thead');
    const hr = el('tr');
    ['Date', 'Method', 'TrxID', 'Weeks', 'Amount', 'Status'].forEach(h => hr.appendChild(el('th', '', h)));
    thead.appendChild(hr);
    table.appendChild(thead);
    const tbody = el('tbody');
    table.appendChild(tbody);
    scroll.appendChild(table);
    hcard.appendChild(scroll);
    sec.appendChild(hcard);

    EEE.fill(tbody, list, [
      p => EEE.fmtTime(p.submitted_at),
      p => p.method || '-',
      p => p.transaction_id || '-',
      p => EEE.weeksText((p.payment_weeks || []).map(w => w.week_start).sort()),
      p => money(p.amount),
      p => statusCell(p)
    ], 'You have not made any payment yet');
  }

  EEE.addPage('mypayments', { title: 'My Payments', label: 'My Payments', icon: 'card', roles: ['student'], onShow: renderMy });
  EEE.refreshHooks.push(renderMy);

  /* ---------- Student: Notifications (payment approved / rejected) ---------- */
  function seenKey() {
    return 'eee_notif_seen_' + (EEE.state.user ? EEE.state.user.id : 'x');
  }
  function getSeen() {
    try { return localStorage.getItem(seenKey()) || ''; } catch (e) { return ''; }
  }
  function setSeen(v) {
    try { localStorage.setItem(seenKey(), v); } catch (e) { /* storage not available */ }
  }
  function isUnread(p, seen) {
    if (!p.reviewed_at) return false;
    if (!seen) return true;
    return new Date(p.reviewed_at) > new Date(seen);
  }
  async function loadNotifs() {
    return db.from('payments')
      .select('id, method, status, amount, review_note, reviewed_at, payment_weeks(week_start)')
      .in('status', ['approved', 'rejected'])
      .order('reviewed_at', { ascending: false });
  }

  async function updateNotifBadge() {
    if (EEE.state.role !== 'student') return;
    const r = await loadNotifs();
    if (r.error) return;
    const seen = getSeen();
    const n = (r.data || []).filter(p => isUnread(p, seen)).length;
    EEE.setBadge('notifications', n);
  }

  async function renderNotifs() {
    if (EEE.state.role !== 'student') return;
    const sec = $('page-notifications');
    if (!sec) return;
    const r = await loadNotifs();
    sec.innerHTML = '';
    if (r.error) {
      sec.appendChild(el('p', 'err', 'Could not load notifications: ' + r.error.message));
      return;
    }
    const list = r.data || [];
    const seen = getSeen();
    const card = el('div', 'card');
    card.appendChild(el('h2', '', 'Notifications'));
    if (!list.length) {
      card.appendChild(el('p', 'empty', 'No notifications yet. You will see here when the admin approves or rejects your payment.'));
    }
    list.forEach(p => {
      const ok = p.status === 'approved';
      const weeks = EEE.weeksText((p.payment_weeks || []).map(w => w.week_start).sort());
      const row = el('div', 'feed-item');
      row.appendChild(el('div', 'fav', ok ? '✓' : '✕'));
      const main = el('div', 'fmain');
      let text = 'Your ' + (p.method || '') + ' payment of ' + money(p.amount) + (weeks ? ' for ' + weeks : '') +
        (ok ? ' was approved.' : ' was rejected.');
      const title = el('div', 'fname', text);
      if (isUnread(p, seen)) title.style.fontWeight = '800';
      main.appendChild(title);
      let sub = EEE.fmtTime(p.reviewed_at);
      if (!ok && p.review_note) sub += ' · Reason: ' + p.review_note;
      main.appendChild(el('div', 'fsub', sub));
      row.appendChild(main);
      row.appendChild(ok ? EEE.pill('Approved', 'ok') : EEE.pill('Rejected', 'no'));
      card.appendChild(row);
    });
    sec.appendChild(card);
    setSeen(new Date().toISOString());
    EEE.setBadge('notifications', 0);
  }

  EEE.addPage('notifications', { title: 'Notifications', label: 'Notifications', icon: 'clock', roles: ['student'], onShow: renderNotifs });
  EEE.refreshHooks.push(updateNotifBadge);

  EEE.openPay = openPay;
  const bar = $('paybar');
  if (bar && EEE.state.role === 'student') bar.hidden = false;
})();
