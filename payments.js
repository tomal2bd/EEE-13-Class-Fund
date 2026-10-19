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
  function brandOf(method) {
    const k = String(method).toLowerCase();
    if (k === 'nagad') return '#f6921e';
    if (k === 'cash') return '#059669';
    return '#e2136e';
  }

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

  /* ---------- Receipt (print or save as PDF) ---------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function printReceipt(p) {
    const s = EEE.state.student || {};
    const weeks = EEE.weeksText((p.payment_weeks || []).map(w => w.week_start).sort()) || '-';
    const no = 'R-' + String(p.id).replace(/-/g, '').slice(0, 8).toUpperCase();
    const rows = [
      ['Receipt no', no],
      ['Student', s.full_name || '-'],
      ['Class roll', s.roll_no || '-'],
      ['Payment for', weeks],
      ['Method', p.method || '-'],
      ['TrxID', p.transaction_id || '-'],
      ['Submitted', EEE.fmtTime(p.submitted_at)],
      ['Approved', p.reviewed_at ? EEE.fmtTime(p.reviewed_at) : '-']
    ].map(r => '<tr><td class="k">' + esc(r[0]) + '</td><td class="v">' + esc(r[1]) + '</td></tr>').join('');

    const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt ' + esc(no) + '</title>' +
      '<meta name="viewport" content="width=device-width, initial-scale=1"><style>' +
      'body{font-family:"Segoe UI",Arial,sans-serif;margin:0;padding:24px;color:#0f172a;background:#fff}' +
      '.r{max-width:480px;margin:0 auto;border:2px solid #059669;border-radius:16px;padding:24px}' +
      'h1{margin:0;font-size:22px;color:#022c22}.sub{color:#64748b;font-size:13px;margin:2px 0 18px}' +
      'table{width:100%;border-collapse:collapse}td{padding:9px 0;border-bottom:1px solid #e2e8f0;font-size:14px;vertical-align:top}' +
      '.k{color:#64748b;width:38%}.v{font-weight:600;text-align:right;word-break:break-word}' +
      '.amt{margin:18px 0 8px;padding:14px;border-radius:12px;background:#d1fae5;display:flex;justify-content:space-between;align-items:center}' +
      '.amt span{font-weight:700;color:#064e3b}.amt b{font-size:26px;color:#047857}' +
      '.paid{display:inline-block;background:#059669;color:#fff;font-weight:800;letter-spacing:2px;padding:4px 14px;border-radius:999px;font-size:12px}' +
      '.f{margin-top:16px;text-align:center;color:#64748b;font-size:12px}' +
      '.btn{display:block;margin:20px auto 0;padding:10px 22px;border:0;border-radius:10px;background:#059669;color:#fff;font-size:14px;font-weight:600;cursor:pointer}' +
      '@media print{.btn{display:none}body{padding:0}}' +
      '</style></head><body><div class="r">' +
      '<h1>EEE-13 · Class Fund</h1><div class="sub">Payment receipt</div>' +
      '<span class="paid">PAID</span>' +
      '<div class="amt"><span>Amount</span><b>' + esc(money(p.amount)) + '</b></div>' +
      '<table>' + rows + '</table>' +
      '<div class="f">This receipt was generated from the Class Fund website after admin approval.</div>' +
      '</div><button class="btn" onclick="window.print()">Print / Save as PDF</button></body></html>';

    const w = window.open('', '_blank');
    if (!w) { toast('Please allow pop-ups to open the receipt.'); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
  }
  EEE.printReceipt = printReceipt;

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
    if (p.status === 'approved') {
      const rb = el('button', 'btn sm ghost', 'Receipt');
      rb.style.marginTop = '10px';
      rb.addEventListener('click', () => printReceipt(p));
      card.appendChild(rb);
    }
    return card;
  }

  async function renderMy() {
    if (EEE.state.role !== 'student') return;
    const sec = $('page-mypayments');
    if (!sec) return;

    const r = await db.from('payments')
      .select('id, method, transaction_id, status, amount, submitted_at, reviewed_at, review_note, payment_weeks(week_start, amount)')
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

  /* ---------- Student: welcome message (shown once per device) ---------- */
  let welcomeShown = false;
  function welcomeKey() {
    return 'eee_welcome_' + (EEE.state.user ? EEE.state.user.id : 'x');
  }
  function welcomeSeen() {
    try { return !!localStorage.getItem(welcomeKey()); } catch (e) { return true; }
  }
  function welcomeMark() {
    try { localStorage.setItem(welcomeKey(), '1'); } catch (e) { /* storage not available */ }
  }
  function welcomeLine(text) {
    const p = el('div', '', text);
    p.style.cssText = 'font-size:15px;line-height:1.5;margin-bottom:10px;color:#0f172a;';
    return p;
  }
  function showWelcome() {
    if (welcomeShown || EEE.state.role !== 'student' || !EEE.state.student || welcomeSeen()) return;
    welcomeShown = true;
    const st = EEE.state.settings || {};
    const weekly = Number(st.weekly_amount || 30);
    const name = EEE.state.student.nickname || EEE.state.student.full_name || '';

    const back = el('div', 'modal-back');
    back.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    const box = el('div', 'card');
    box.style.cssText = 'width:100%;max-width:440px;max-height:92vh;overflow:auto;margin:0;padding:26px;border-top:6px solid #10b981;';

    const h = el('h2', '', 'Welcome' + (name ? ', ' + name : '') + '!');
    h.style.cssText = 'font-size:26px;font-weight:800;margin:0 0 6px;color:#064e3b;';
    box.appendChild(h);
    const sub = el('div', '', 'Your account is approved. Here is how the Class Fund works:');
    sub.style.cssText = 'font-size:14px;color:#475569;margin-bottom:16px;';
    box.appendChild(sub);

    box.appendChild(welcomeLine('1.  Every week you pay ' + money(weekly) + '. The weeks start on the 1st, 8th, 15th, 22nd and 29th of the month.'));
    box.appendChild(welcomeLine('2.  On the Dashboard, tap bKash or Nagad, send the money to the number shown, then enter your sender number and TrxID.'));
    box.appendChild(welcomeLine('3.  The admin checks your payment. You will see it under My Payments, and the bell at the top tells you when it is approved or rejected.'));
    box.appendChild(welcomeLine('4.  After approval you can open a receipt from My Payments.'));
    box.appendChild(welcomeLine('5.  Public Ledger shows all the money coming in and going out, so everything stays transparent.'));

    const go = el('button', 'btn full', 'Got it, let us start');
    go.style.marginTop = '10px';
    go.addEventListener('click', () => { welcomeMark(); back.remove(); });
    box.appendChild(go);

    back.appendChild(box);
    document.body.appendChild(back);
  }
  EEE.refreshHooks.push(async () => { showWelcome(); });

  EEE.openPay = openPay;
  const bar = $('paybar');
  if (bar && EEE.state.role === 'student') bar.hidden = false;
})();


/* =====================================================
   Student profile: new design + payment summary
   ===================================================== */
(function () {
  'use strict';
  const EEE = window.EEE;
  if (!EEE) return;
  const { db, $, el, money } = EEE;

  const START = [1, 8, 15, 22, 29];
  const ORD = ['1st', '2nd', '3rd', '4th', '5th'];
  const pad = n => String(n).padStart(2, '0');
  const dim = (y, m) => new Date(y, m, 0).getDate();
  function today() {
    const p = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' }).split('-').map(Number);
    return { y: p[0], m: p[1], d: p[2] };
  }

  /* ---------- styles ---------- */
  const css = `
#page-profile .pbanner{position:relative;overflow:hidden;gap:22px;padding:36px 28px;border-radius:24px;background:linear-gradient(135deg,#022c22,#047857 55%,#10b981);box-shadow:0 14px 34px rgba(4,120,87,.30)}
#page-profile .pbanner::before{content:"";position:absolute;right:-60px;top:-80px;width:260px;height:260px;border-radius:50%;background:rgba(255,255,255,.10)}
#page-profile .pbanner::after{content:"";position:absolute;left:30%;bottom:-100px;width:220px;height:220px;border-radius:50%;background:rgba(251,191,36,.14)}
#page-profile .pbanner>*{position:relative;z-index:1}
#page-profile .pbav{width:104px;height:104px;font-size:44px;background:linear-gradient(135deg,rgba(255,255,255,.35),rgba(255,255,255,.12));border:4px solid #fff;box-shadow:0 8px 22px rgba(0,0,0,.28)}
#page-profile .pbname{font-size:30px;line-height:1.15}
#page-profile .pbmail{font-size:14px;margin-top:4px}
.sp-chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.sp-chip{background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.35);color:#fff;font-size:13px;font-weight:600;padding:5px 12px;border-radius:999px}
.sp-chip.badge{background:#fbbf24;border-color:#fbbf24;color:#064e3b;font-weight:800;letter-spacing:1.5px;font-size:11px}
#page-profile .pcard{position:relative;border-radius:16px;padding:18px 16px 16px;transition:transform .15s ease,box-shadow .15s ease}
#page-profile .pcard:hover{transform:translateY(-3px);box-shadow:0 10px 22px rgba(15,23,42,.10)}
#page-profile .pcard.paid:hover{box-shadow:0 14px 28px rgba(37,99,235,.35)}
#page-profile .editcard{border-radius:18px;border-width:2px}
.sp-card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:20px;margin-bottom:18px;box-shadow:0 1px 3px rgba(15,23,42,.04)}
.sp-card h2{margin:0 0 14px;font-size:16px}
.sp-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:18px}
.sp-stat{border-radius:14px;padding:14px;color:#fff}
.sp-stat .l{font-size:12px;opacity:.92}
.sp-stat .v{font-size:22px;font-weight:800;margin-top:2px}
.sp-track{height:12px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin:8px 0 6px}
.sp-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#34d399,#047857)}
.sp-weeks{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
.sp-week{flex:1;min-width:110px;border-radius:14px;padding:12px;border:1px solid #e2e8f0;text-align:center}
.sp-week b{display:block;font-size:14px}
.sp-week span{display:inline-block;margin-top:6px;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700}
.sp-week.ok{background:#ecfdf5;border-color:#a7f3d0}.sp-week.ok span{background:#d1fae5;color:#047857}
.sp-week.wait{background:#fffbeb;border-color:#fde68a}.sp-week.wait span{background:#fef3c7;color:#92400e}
.sp-week.due{background:#fef2f2;border-color:#fecaca}.sp-week.due span{background:#fee2e2;color:#b91c1c}
`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  /* ---------- chips in the banner ---------- */
  function refreshChips() {
    const nameEl = $('p-name');
    if (!nameEl) return;
    const host = nameEl.parentElement;
    let box = $('sp-chips');
    if (!box) { box = el('div', 'sp-chips'); box.id = 'sp-chips'; host.appendChild(box); }
    const s = EEE.state.student || {};
    box.innerHTML = '';
    box.appendChild(el('span', 'sp-chip badge', 'STUDENT'));
    if (s.roll_no) box.appendChild(el('span', 'sp-chip', 'Roll ' + s.roll_no));
    if (s.registration_no) box.appendChild(el('span', 'sp-chip', 'Reg ' + s.registration_no));
  }

  /* ---------- payment summary card ---------- */
  function statBox(label, value, bg) {
    const d = el('div', 'sp-stat');
    d.style.background = bg;
    d.appendChild(el('div', 'l', label));
    d.appendChild(el('div', 'v', value));
    return d;
  }

  async function loadExtras() {
    const s = EEE.state.student;
    const page = $('page-profile');
    if (!s || !page) return;

    let card = $('sp-extra');
    if (!card) {
      card = el('div', 'sp-card');
      card.id = 'sp-extra';
      const anchor = page.querySelector('.editcard');
      if (anchor) page.insertBefore(card, anchor); else page.appendChild(card);
    }

    const r = await db.from('payments')
      .select('amount, status, payment_weeks(week_start)')
      .eq('student_id', s.id);
    if (r.error) { card.innerHTML = ''; card.appendChild(el('p', 'err', 'Could not load payment summary: ' + r.error.message)); return; }

    const list = r.data || [];
    const st = EEE.state.settings || {};
    const weekly = Number(st.weekly_amount || 30);
    const t = today();

    let paid = 0, pending = 0;
    const wstat = {};
    list.forEach(p => {
      if (p.status === 'approved') paid += Number(p.amount || 0);
      if (p.status === 'pending') pending += Number(p.amount || 0);
      if (p.status === 'approved' || p.status === 'pending') {
        (p.payment_weeks || []).forEach(w => { if (wstat[w.week_start] !== 'approved') wstat[w.week_start] = p.status; });
      }
    });

    const need = [];
    if (st.start_date) {
      let [y, m] = st.start_date.split('-').map(Number);
      while (y < t.y || (y === t.y && m <= t.m)) {
        START.forEach(day => {
          if (day > dim(y, m)) return;
          if (y === t.y && m === t.m && day > t.d) return;
          need.push(y + '-' + pad(m) + '-' + pad(day));
        });
        m++; if (m > 12) { m = 1; y++; }
      }
    }
    const approvedWeeks = need.filter(w => wstat[w] === 'approved').length;
    const dueWeeks = need.filter(w => !wstat[w]).length;
    const pct = need.length ? Math.round((approvedWeeks / need.length) * 100) : 0;

    card.innerHTML = '';
    card.appendChild(el('h2', '', 'Payment summary'));

    const stats = el('div', 'sp-stats');
    stats.appendChild(statBox('Total paid', money(paid), 'linear-gradient(135deg,#059669,#34d399)'));
    stats.appendChild(statBox('Waiting approval', money(pending), 'linear-gradient(135deg,#f59e0b,#fbbf24)'));
    stats.appendChild(statBox('Due weeks', String(dueWeeks), 'linear-gradient(135deg,#ef4444,#f97316)'));
    stats.appendChild(statBox('Due amount', money(dueWeeks * weekly), 'linear-gradient(135deg,#2563eb,#7c3aed)'));
    card.appendChild(stats);

    const lab = el('div');
    lab.style.cssText = 'display:flex;justify-content:space-between;font-size:14px;font-weight:700;';
    lab.appendChild(el('span', '', 'Payment progress'));
    lab.appendChild(el('span', '', approvedWeeks + ' of ' + need.length + ' weeks · ' + pct + '%'));
    card.appendChild(lab);
    const track = el('div', 'sp-track');
    const fillBar = el('div', 'sp-fill');
    fillBar.style.width = pct + '%';
    track.appendChild(fillBar);
    card.appendChild(track);

    const mon = new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka', month: 'long', year: 'numeric' });
    const mh = el('div', '', 'This month · ' + mon);
    mh.style.cssText = 'margin-top:16px;font-size:13px;font-weight:700;color:#047857;';
    card.appendChild(mh);
    const row = el('div', 'sp-weeks');
    START.forEach((day, i) => {
      if (day > dim(t.y, t.m) || day > t.d) return;
      const iso = t.y + '-' + pad(t.m) + '-' + pad(day);
      const status = wstat[iso];
      const cls = status === 'approved' ? 'ok' : status === 'pending' ? 'wait' : 'due';
      const txt = status === 'approved' ? 'Paid' : status === 'pending' ? 'Pending' : 'Due';
      const w = el('div', 'sp-week ' + cls);
      w.appendChild(el('b', '', ORD[i] + ' week'));
      w.appendChild(el('span', '', txt));
      row.appendChild(w);
    });
    card.appendChild(row);

    const tot = $('p-total');
    if (tot) tot.textContent = money(paid);
  }

  function enhance() {
    refreshChips();
    loadExtras();
  }

  EEE.addPage('profile', {
    title: 'My Profile', label: 'My Profile', icon: 'user', roles: ['student'], nav: false,
    onShow: enhance
  });

  ['p-roll', 'p-nick'].forEach(id => {
    const n = $(id);
    if (n) new MutationObserver(refreshChips).observe(n, { childList: true, characterData: true, subtree: true });
  });
})();

/* =====================================================
   Forgot password (paste at the very end of payments.js)
   ===================================================== */
(function () {
  'use strict';
  const EEE = window.EEE;
  if (!EEE) return;
  const { db, $, el, toast } = EEE;

  // Remember if this page was opened from a reset link
  const openedFromReset = /type=recovery/.test(window.location.hash);

  function msg(text, good) {
    const m = $('message');
    if (!m) return;
    m.className = good ? 'ok' : 'err';
    m.textContent = text || '';
  }

  /* ---------- 1) Send the reset email ---------- */
  let sending = false;
  document.addEventListener('click', async e => {
    if (!e.target.closest('#forgot')) return;
    e.preventDefault();
    e.stopImmediatePropagation(); // stops the old "coming soon" message
    if (sending) return;

    const email = ($('in-email').value || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      msg('Please write your email address above first, then press "Forgot password?" again.');
      $('in-email').focus();
      return;
    }

    sending = true;
    msg('Sending...', true);
    const r = await db.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    });
    sending = false;

    if (r.error) {
      if (/rate limit|too many|security purposes/i.test(r.error.message || '')) {
        msg('Too many requests. Please wait a few minutes and try again.');
      } else {
        msg('Could not send the email: ' + r.error.message);
      }
      return;
    }
    // Same message whether or not the email exists, so nobody can check who has an account
    msg('If this email has an account, a password reset link has been sent. Please check your inbox and spam folder.', true);
  }, true);

  /* ---------- 2) New password form (opens from the email link) ---------- */
  function openResetForm() {
    if ($('reset-back')) return;

    const back = el('div', 'modal-back');
    back.id = 'reset-back';
    back.style.cssText = 'position:fixed;inset:0;background:rgba(2,44,34,.65);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;';
    const box = el('div', 'card');
    box.style.cssText = 'width:100%;max-width:420px;margin:0;padding:26px;border-top:6px solid #10b981;';
    back.appendChild(box);

    const title = el('h2', '', 'Set a new password');
    title.style.cssText = 'font-size:22px;margin:0 0 6px;';
    box.appendChild(title);
    const sub = el('p', 'hint', 'Choose a new password for your account (at least 8 characters).');
    sub.style.margin = '0 0 16px';
    box.appendChild(sub);

    box.appendChild(el('label', '', 'New password'));
    const p1 = el('input'); p1.type = 'password'; p1.placeholder = 'Min 8 characters'; p1.autocomplete = 'new-password';
    box.appendChild(p1);
    box.appendChild(el('label', '', 'Confirm new password'));
    const p2 = el('input'); p2.type = 'password'; p2.placeholder = 'Repeat password'; p2.autocomplete = 'new-password';
    box.appendChild(p2);

    const note = el('p', '');
    note.style.margin = '0 0 10px';
    box.appendChild(note);

    const save = el('button', 'btn full', 'Save new password');
    box.appendChild(save);

    async function submit() {
      note.className = 'err'; note.textContent = '';
      if (p1.value.length < 8) { note.textContent = 'Password must be at least 8 characters.'; return; }
      if (p1.value !== p2.value) { note.textContent = 'Passwords do not match.'; return; }
      save.disabled = true; save.textContent = 'Saving...';
      const r = await db.auth.updateUser({ password: p1.value });
      if (r.error) {
        save.disabled = false; save.textContent = 'Save new password';
        note.textContent = 'Could not save: ' + r.error.message;
        return;
      }
      note.className = 'ok';
      note.textContent = 'Password changed. Opening your account...';
      history.replaceState(null, '', window.location.pathname);
      setTimeout(() => window.location.reload(), 1500);
    }
    save.addEventListener('click', submit);
    p2.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });

    document.body.appendChild(back);
    p1.focus();
  }

  // Supabase fires this event when the person arrives from the email link
  db.auth.onAuthStateChange(event => {
    if (event === 'PASSWORD_RECOVERY') openResetForm();
  });
  if (openedFromReset) setTimeout(() => { if (!$('reset-back')) openResetForm(); }, 1200);
})();
