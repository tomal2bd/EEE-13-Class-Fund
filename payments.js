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
  function brandOf(method) { return String(method).toLowerCase() === 'nagad' ? '#f6921e' : '#e2136e'; }

  function weekInfoFromIso(iso) {
    const y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)), day = Number(iso.slice(8, 10));
    const idx = START_DAYS.indexOf(day);
    const endDay = idx === 4 ? daysInMonth(y, m) : day + 6;
    return {
      iso,
      name: (ORD[idx] || '') + ' week',
      range: day + ' - ' + endDay,
      month: monthLabel(iso.slice(0, 7))
    };
  }

  // Only the current calendar week: 1-7 = 1st, 8-14 = 2nd, 15-21 = 3rd, 22-28 = 4th, 29-end = 5th
  function currentWeek() {
    const t = todayDhaka();
    let idx = 0;
    START_DAYS.forEach((day, i) => { if (day <= t.d) idx = i; });
    return weekInfoFromIso(monthKey(t.y, t.m) + '-' + pad(START_DAYS[idx]));
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

  function copyText(text, btn, label) {
    const done = () => {
      btn.textContent = 'Copied ✓';
      setTimeout(() => { btn.textContent = label; }, 2000);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => toast('Could not copy.'));
    } else {
      toast('Copy is not supported on this browser.');
    }
  }

  // weekIso is optional. If given, the form is for that week. Otherwise it is the current week.
  async function openPay(method, weekIso) {
    const st = EEE.state.settings || {};
    const number = method === 'bKash' ? st.bkash_number : st.nagad_number;
    if (!number || !st.start_date) {
      toast('Payment details are not set yet. Please contact the admin.');
      return;
    }
    const weekly = Number(st.weekly_amount || 30);
    const cw = weekIso ? weekInfoFromIso(weekIso) : currentWeek();
    const taken = await takenWeeks();
    const alreadyTaken = taken.has(cw.iso);
    const typed = { sender: '', trx: '' };
    const brand = brandOf(method);

    const back = el('div', 'modal-back');
    back.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    const box = el('div', 'card');
    box.style.cssText = 'width:100%;max-width:440px;max-height:92vh;overflow:auto;margin:0;padding:24px;border-top:6px solid ' + brand + ';';
    back.appendChild(box);

    function close() { back.remove(); }

    function bigLabel(text) {
      const l = el('label', '', text);
      l.style.cssText = 'font-size:16px;font-weight:700;color:#0f172a;margin:0 0 8px;';
      return l;
    }

    function draw() {
      box.innerHTML = '';

      const title = el('h2', '', 'Pay with ' + method);
      title.style.cssText = 'font-size:26px;font-weight:800;margin:0 0 16px;color:' + brand + ';';
      box.appendChild(title);

      const intro = el('div', '', 'Use "Send Money" and send to this ' + method + ' number:');
      intro.style.cssText = 'font-size:16px;font-weight:700;color:#0f172a;margin-bottom:10px;line-height:1.4;';
      box.appendChild(intro);

      const numBox = el('div', 'sendbox');
      numBox.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 20px;padding:16px;border:2px dashed ' + brand + ';background:#fff;border-radius:14px;';
      const num = el('div', 'numbig', number);
      num.style.cssText = 'font-size:32px;font-weight:800;letter-spacing:2px;color:#0f172a;';
      numBox.appendChild(num);
      const copy = el('button', 'btn sm', 'Copy');
      copy.style.cssText = 'flex-shrink:0;background:' + brand + ';font-size:14px;padding:9px 16px;';
      copy.addEventListener('click', () => copyText(number, copy, 'Copy'));
      numBox.appendChild(copy);
      box.appendChild(numBox);

      box.appendChild(bigLabel('Payment for'));
      const weekInfo = el('div', '', cw.name + ' of ' + cw.month);
      weekInfo.style.cssText = 'font-size:22px;font-weight:800;color:#064e3b;';
      box.appendChild(weekInfo);
      const rangeInfo = el('div', '', 'Days ' + cw.range);
      rangeInfo.style.cssText = 'font-size:16px;font-weight:600;color:#334155;margin:2px 0 18px;';
      box.appendChild(rangeInfo);

      if (alreadyTaken) {
        const note = el('p', 'help', 'This week is already paid or waiting for approval. There is nothing to pay right now.');
        note.style.fontSize = '15px';
        box.appendChild(note);
        const closeBtn = el('button', 'btn ghost full', 'Close');
        closeBtn.addEventListener('click', close);
        box.appendChild(closeBtn);
        return;
      }

      const totalBox = el('div', 'totalbox');
      totalBox.style.cssText = 'display:flex;justify-content:space-between;align-items:center;background:#d1fae5;border:2px solid #10b981;border-radius:14px;padding:14px 16px;margin-bottom:20px;';
      const tl = el('span', '', 'Amount to send');
      tl.style.cssText = 'font-size:17px;font-weight:700;color:#064e3b;';
      const tv = el('span', '', money(weekly));
      tv.style.cssText = 'font-size:28px;font-weight:800;color:#047857;';
      totalBox.appendChild(tl);
      totalBox.appendChild(tv);
      box.appendChild(totalBox);

      box.appendChild(bigLabel('Sender number (the number you sent from)'));
      const sender = el('input'); sender.type = 'tel'; sender.placeholder = '01XXXXXXXXX'; sender.id = 'pay-sender';
      sender.style.cssText = 'font-size:17px;padding:13px 14px;margin-bottom:18px;';
      sender.value = typed.sender;
      sender.addEventListener('input', () => { typed.sender = sender.value; });
      box.appendChild(sender);

      box.appendChild(bigLabel('TrxID (required)'));
      const trx = el('input'); trx.placeholder = 'e.g. 9H7ABC1234'; trx.id = 'pay-trx';
      trx.style.cssText = 'font-size:17px;padding:13px 14px;margin-bottom:14px;';
      trx.value = typed.trx;
      trx.addEventListener('input', () => { typed.trx = trx.value; });
      box.appendChild(trx);

      const msg = el('p', 'err');
      msg.style.margin = '0 0 10px';
      box.appendChild(msg);

      const submit = el('button', 'btn full', 'Submit payment');
      submit.style.cssText = 'font-size:16px;padding:14px;background:' + brand + ';';
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
      cancel.style.cssText = 'margin-top:8px;font-size:15px;padding:12px;';
      cancel.addEventListener('click', close);
      box.appendChild(cancel);
    }

    back.addEventListener('click', e => { if (e.target === back) close(); });
    document.body.appendChild(back);
    draw();
  }

  /* ---------- Student: My Payments page ---------- */
  let myMonth = null;
  let histOpen = false;

  function badge(text, bg, fg) {
    const b = el('span', '', text);
    b.style.cssText = 'display:inline-block;padding:4px 12px;border-radius:999px;font-size:13px;font-weight:700;white-space:nowrap;background:' + bg + ';color:' + fg + ';';
    return b;
  }
  function statusBadge(status) {
    if (status === 'approved') return badge('Approved', '#d1fae5', '#047857');
    if (status === 'rejected') return badge('Rejected', '#fee2e2', '#b91c1c');
    return badge('Pending', '#fef3c7', '#92400e');
  }

  function colorCard(grad, icon, label, value) {
    const c = el('div', 'card stat');
    c.style.cssText = 'background:' + grad + ';color:#fff;border:0;';
    const ic = el('div', 'ico', icon);
    ic.style.cssText = 'background:rgba(255,255,255,.25);color:#fff;';
    c.appendChild(ic);
    const wrap = el('div');
    const l = el('div', 'lbl', label);
    l.style.color = 'rgba(255,255,255,.92)';
    const v = el('div', 'val', value);
    v.style.textShadow = '0 1px 2px rgba(0,0,0,.15)';
    wrap.appendChild(l);
    wrap.appendChild(v);
    c.appendChild(wrap);
    return c;
  }

  function payNowBtn(method, iso) {
    const b = el('button', '', method);
    b.style.cssText = 'border:0;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:700;color:#fff;cursor:pointer;background:' + brandOf(method) + ';';
    b.addEventListener('click', () => openPay(method, iso));
    return b;
  }

  function historyCard(p) {
    const brand = brandOf(p.method);
    const card = el('div', '');
    card.style.cssText = 'border:1px solid #e2e8f0;border-left:6px solid ' + brand + ';border-radius:14px;padding:14px 16px;margin-bottom:12px;background:#fff;';

    const top = el('div', '');
    top.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;';
    const left = el('div', '');
    const amt = el('div', '', money(p.amount));
    amt.style.cssText = 'font-size:22px;font-weight:800;color:#0f172a;';
    const m = el('div', '', p.method || '-');
    m.style.cssText = 'font-size:13px;font-weight:700;color:' + brand + ';';
    left.appendChild(amt);
    left.appendChild(m);
    top.appendChild(left);
    top.appendChild(statusBadge(p.status));
    card.appendChild(top);

    const wk = (p.payment_weeks || []).map(w => w.week_start).sort();
    const weeksTxt = EEE.weeksText(wk);
    if (weeksTxt) {
      const w = el('div', '', weeksTxt);
      w.style.cssText = 'margin-top:8px;font-size:15px;font-weight:600;color:#334155;';
      card.appendChild(w);
    }

    const sub = el('div', '');
    sub.style.cssText = 'margin-top:6px;font-size:12px;color:#64748b;display:flex;align-items:center;gap:8px;flex-wrap:wrap;word-break:break-all;';
    sub.appendChild(el('span', '', 'TrxID: ' + (p.transaction_id || '-')));
    if (p.transaction_id) {
      const cb = el('button', '', 'Copy');
      cb.style.cssText = 'border:1px solid #cbd5e1;background:#fff;border-radius:6px;padding:2px 8px;font-size:11px;cursor:pointer;color:#334155;';
      cb.addEventListener('click', () => copyText(p.transaction_id, cb, 'Copy'));
      sub.appendChild(cb);
    }
    sub.appendChild(el('span', '', '· ' + EEE.fmtTime(p.submitted_at)));
    card.appendChild(sub);

    if (p.status === 'pending') {
      const w = el('div', '', 'Waiting for admin approval. It will be marked Paid after the admin checks it.');
      w.style.cssText = 'margin-top:10px;padding:10px 12px;background:#fef3c7;color:#92400e;border-radius:10px;font-size:13px;font-weight:600;';
      card.appendChild(w);
    }
    if (p.status === 'rejected') {
      const r = el('div', '', 'Reason: ' + (p.review_note || 'Not given'));
      r.style.cssText = 'margin-top:10px;padding:10px 12px;background:#fee2e2;color:#991b1b;border-radius:10px;font-size:14px;font-weight:600;';
      card.appendChild(r);
      if (wk.length) {
        const again = el('button', 'btn sm', 'Pay again');
        again.style.cssText = 'margin-top:10px;background:' + brand + ';';
        again.addEventListener('click', () => openPay(p.method, wk[0]));
        card.appendChild(again);
      }
    }
    return card;
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
    const st = EEE.state.settings || {};
    const t = todayDhaka();
    const nowKey = monthKey(t.y, t.m);
    const weekly = Number(st.weekly_amount || 30);

    // months from fund start to this month (used for the Total due calculation)
    const months = [];
    if (st.start_date) {
      const sp = st.start_date.split('-').map(Number);
      let y = sp[0], m = sp[1];
      while (y < t.y || (y === t.y && m <= t.m)) {
        months.push(monthKey(y, m));
        m++; if (m > 12) { m = 1; y++; }
      }
    }
    if (!months.length) months.push(nowKey);

    // Weekly status always shows only the current month. A new month starts fresh.
    myMonth = nowKey;

    let totalPaid = 0, pendingAmt = 0;
    const wstat = {};
    list.forEach(p => {
      const ws = p.payment_weeks || [];
      if (p.status === 'approved') totalPaid += Number(p.amount);
      if (p.status === 'pending') pendingAmt += Number(p.amount);
      if (p.status === 'approved' || p.status === 'pending') {
        ws.forEach(w => { if (wstat[w.week_start] !== 'approved') wstat[w.week_start] = p.status; });
      }
    });

    function weeksFor(key) {
      const y = Number(key.slice(0, 4)), m = Number(key.slice(5, 7));
      const out = [];
      START_DAYS.forEach((day, i) => {
        if (day > daysInMonth(y, m)) return;
        if (y === t.y && m === t.m && day > t.d) return;
        const endDay = i === 4 ? daysInMonth(y, m) : day + 6;
        const iso = key + '-' + pad(day);
        out.push({
          iso, name: ORD[i] + ' week', range: day + ' - ' + endDay,
          isCurrent: key === nowKey && t.d >= day && t.d <= endDay,
          status: wstat[iso] || 'due'
        });
      });
      return out;
    }

    // overall due (all months)
    let dueTotal = 0;
    const oldDueMonths = [];
    months.forEach(k => {
      const d = weeksFor(k).filter(w => w.status === 'due').length;
      dueTotal += d;
      if (k !== nowKey && d) oldDueMonths.push(monthLabel(k) + ' (' + d + ')');
    });

    const cards = el('div', 'cards');
    cards.appendChild(colorCard('linear-gradient(135deg,#059669,#34d399)', '✓', 'Total paid', money(totalPaid)));
    cards.appendChild(colorCard('linear-gradient(135deg,#f59e0b,#fbbf24)', '⏳', 'Waiting for approval', money(pendingAmt)));
    cards.appendChild(colorCard('linear-gradient(135deg,#ef4444,#f97316)', '!', 'Total due', money(dueTotal * weekly)));
    sec.appendChild(cards);

    if (oldDueMonths.length) {
      const warn = el('div', '', 'Unpaid weeks in earlier months: ' + oldDueMonths.join(', ') + '. Please contact the admin.');
      warn.style.cssText = 'margin-bottom:20px;padding:14px 16px;background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;border-radius:14px;font-size:14px;font-weight:700;';
      sec.appendChild(warn);
    }

    const wcard = el('div', 'card');
    const head = el('div', '');
    head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px;';
    head.appendChild(el('h2', '', 'Weekly status'));
    const mlab = el('span', '', monthLabel(nowKey));
    mlab.style.cssText = 'font-size:14px;font-weight:700;color:#047857;background:#d1fae5;padding:6px 14px;border-radius:999px;';
    head.appendChild(mlab);
    wcard.appendChild(head);

    const wl = weeksFor(myMonth);
    wl.forEach(w => {
      const row = el('div', 'feed-item');
      const main = el('div', 'fmain');
      main.appendChild(el('div', 'fname', w.name + (w.isCurrent ? ' · This week' : '')));
      main.appendChild(el('div', 'fsub', 'Days ' + w.range));
      row.appendChild(main);
      if (w.status === 'approved') row.appendChild(badge('Paid', '#d1fae5', '#047857'));
      else if (w.status === 'pending') row.appendChild(badge('Pending', '#fef3c7', '#92400e'));
      else {
        const box = el('div', '');
        box.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end;';
        box.appendChild(badge('Due', '#fee2e2', '#b91c1c'));
        box.appendChild(payNowBtn('bKash', w.iso));
        box.appendChild(payNowBtn('Nagad', w.iso));
        row.appendChild(box);
      }
      wcard.appendChild(row);
    });
    const dueHere = wl.filter(w => w.status === 'due').length;
    const note = el('div', 'help', dueHere ? ('You have ' + dueHere + ' unpaid week(s) in this month. Tap bKash or Nagad next to a week to pay.') : 'All weeks of this month are paid or waiting for approval.');
    note.style.marginTop = '12px';
    note.style.marginBottom = '0';
    wcard.appendChild(note);
    sec.appendChild(wcard);

    const hcard = el('div', 'card');
    hcard.appendChild(el('h2', '', 'My payment history'));
    if (!list.length) hcard.appendChild(el('p', 'empty', 'You have not made any payment yet.'));
    (histOpen ? list : list.slice(0, 5)).forEach(p => hcard.appendChild(historyCard(p)));
    if (list.length > 5) {
      const more = el('button', 'btn ghost full', histOpen ? 'Show less' : 'Show more (' + (list.length - 5) + ')');
      more.style.marginTop = '4px';
      more.addEventListener('click', () => { histOpen = !histOpen; renderMy(); });
      hcard.appendChild(more);
    }
    sec.appendChild(hcard);
  }

  EEE.addPage('mypayments', { title: 'My Payments', label: 'My Payments', icon: 'card', roles: ['student'], onShow: renderMy });
  EEE.refreshHooks.push(renderMy);

  /* ---------- Student: Notification bell (top bar) ---------- */
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

  function setBell(n) {
    const b = $('bell-badge');
    if (!b) return;
    b.textContent = n > 99 ? '99+' : String(n);
    b.hidden = !n;
  }

  async function updateNotifBadge() {
    const bell = $('bell-btn');
    if (!bell) return;
    if (EEE.state.role !== 'student') { bell.hidden = true; return; }
    bell.hidden = false;
    const r = await loadNotifs();
    if (r.error) return;
    const seen = getSeen();
    setBell((r.data || []).filter(p => isUnread(p, seen)).length);
  }

  async function openNotifs() {
    if (EEE.state.role !== 'student') return;
    const old = document.getElementById('notif-panel-back');
    if (old) { old.remove(); return; }

    const back = el('div', 'modal-back');
    back.id = 'notif-panel-back';
    back.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.25);z-index:9999;';
    const box = el('div', 'card');
    box.style.cssText = 'position:absolute;top:64px;right:12px;width:min(400px,calc(100% - 24px));max-height:75vh;overflow:auto;margin:0;';
    back.appendChild(box);
    back.addEventListener('click', e => { if (e.target === back) back.remove(); });
    document.body.appendChild(back);

    box.appendChild(el('h2', '', 'Notifications'));
    box.appendChild(el('p', 'help', 'Loading...'));

    const r = await loadNotifs();
    box.innerHTML = '';
    box.appendChild(el('h2', '', 'Notifications'));
    if (r.error) {
      box.appendChild(el('p', 'err', 'Could not load notifications: ' + r.error.message));
      return;
    }
    const list = r.data || [];
    const seen = getSeen();
    if (!list.length) {
      box.appendChild(el('p', 'empty', 'No notifications yet. You will see here when the admin approves or rejects your payment.'));
    }
    list.forEach(p => {
      const ok = p.status === 'approved';
      const weeks = EEE.weeksText((p.payment_weeks || []).map(w => w.week_start).sort());
      const row = el('div', 'feed-item');
      row.appendChild(el('div', 'fav', ok ? '✓' : '✕'));
      const main = el('div', 'fmain');
      const text = 'Your ' + (p.method || '') + ' payment of ' + money(p.amount) + (weeks ? ' for ' + weeks : '') +
        (ok ? ' was approved.' : ' was rejected.');
      const title = el('div', 'fname', text);
      if (isUnread(p, seen)) title.style.fontWeight = '800';
      main.appendChild(title);
      let sub = EEE.fmtTime(p.reviewed_at);
      if (!ok && p.review_note) sub += ' · Reason: ' + p.review_note;
      main.appendChild(el('div', 'fsub', sub));
      row.appendChild(main);
      row.appendChild(ok ? EEE.pill('Approved', 'ok') : EEE.pill('Rejected', 'no'));
      box.appendChild(row);
    });

    const closeBtn = el('button', 'btn ghost full', 'Close');
    closeBtn.style.marginTop = '10px';
    closeBtn.addEventListener('click', () => back.remove());
    box.appendChild(closeBtn);

    setSeen(new Date().toISOString());
    setBell(0);
  }

  const bellBtn = $('bell-btn');
  if (bellBtn) bellBtn.addEventListener('click', openNotifs);
  EEE.refreshHooks.push(updateNotifBadge);

  EEE.openPay = openPay;
  const bar = $('paybar');
  if (bar && EEE.state.role === 'student') bar.hidden = false;
})();
