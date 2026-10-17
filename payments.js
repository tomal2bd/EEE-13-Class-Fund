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

  function buildMonths(startStr) {
    const sp = startStr.split('-').map(Number);
    const t = todayDhaka();
    const months = [];
    let y = sp[0], m = sp[1];
    while (y < t.y || (y === t.y && m <= t.m)) {
      const key = monthKey(y, m);
      const weeks = [];
      START_DAYS.forEach((day, i) => {
        if (day > daysInMonth(y, m)) return;
        const isFuture = y === t.y && m === t.m && day > t.d;
        if (isFuture) return;
        weeks.push({ iso: key + '-' + pad(day), name: ORD[i] + ' week', idx: i });
      });
      months.push({ key, weeks });
      m++; if (m > 12) { m = 1; y++; }
    }
    return months;
  }

  function currentWeekIso(months) {
    const last = months[months.length - 1];
    if (!last || !last.weeks.length) return null;
    return last.weeks[last.weeks.length - 1].iso;
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
    if (/already paid or waiting/i.test(msg)) return 'One of the selected weeks is already paid or waiting for approval.';
    if (/Invalid transaction ID/i.test(msg)) return 'TrxID must be 6 to 20 letters or digits (A-Z, 0-9).';
    if (/Sender number/i.test(msg)) return 'Sender number must be 11 digits and start with 01.';
    if (/Invalid week/i.test(msg)) return 'One of the selected weeks is not valid.';
    if (/Select between/i.test(msg)) return 'Please select at least one week.';
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
    const months = buildMonths(st.start_date);
    if (!months.length) { toast('No weeks available yet.'); return; }
    const taken = await takenWeeks();
    let curMonth = months[months.length - 1].key;
    const picked = new Set();
    const cw = currentWeekIso(months);
    if (cw && !taken.has(cw)) picked.add(cw);
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

      box.appendChild(el('label', '', 'Month'));
      const sel = el('select');
      months.forEach(mo => {
        const o = el('option', '', monthLabel(mo.key)); o.value = mo.key; if (mo.key === curMonth) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', () => { curMonth = sel.value; draw(); });
      box.appendChild(sel);

      box.appendChild(el('label', '', 'Select week (' + money(weekly) + ' per week)'));
      const wrap = el('div');
      const mo = months.find(x => x.key === curMonth);
      mo.weeks.forEach(w => {
        const row = el('label');
        row.style.cssText = 'display:flex;gap:8px;align-items:center;margin:6px 0;';
        const cb = el('input'); cb.type = 'checkbox';
        const isTaken = taken.has(w.iso);
        cb.disabled = isTaken; cb.checked = picked.has(w.iso);
        cb.addEventListener('change', () => { if (cb.checked) picked.add(w.iso); else picked.delete(w.iso); draw(); });
        row.appendChild(cb);
        row.appendChild(document.createTextNode(w.name + (isTaken ? ' - already paid or pending' : '')));
        wrap.appendChild(row);
      });
      box.appendChild(wrap);

      box.appendChild(el('div', 'pname', 'Total: ' + money(picked.size * weekly)));

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
        if (!picked.size) { msg.textContent = 'Please select at least one week.'; return; }
        if (!/^01[0-9]{9}$/.test(s)) { msg.textContent = 'Sender number must be 11 digits and start with 01.'; return; }
        if (!/^[A-Z0-9]{6,20}$/.test(t)) { msg.textContent = 'TrxID is required (6 to 20 letters or digits).'; return; }
        submit.disabled = true; submit.textContent = 'Submitting...';
        const r = await db.rpc('submit_payment', { p_method: method, p_sender: s, p_trx: t, p_weeks: Array.from(picked).sort() });
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

  EEE.openPay = openPay;
  const bar = $('paybar');
  if (bar && EEE.state.role === 'student') bar.hidden = false;
})();
