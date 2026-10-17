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

  EEE.openPay = openPay;
  const bar = $('paybar');
  if (bar && EEE.state.role === 'student') bar.hidden = false;
})();
