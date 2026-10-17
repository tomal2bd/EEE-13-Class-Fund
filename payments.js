(function () {
  'use strict';
  const EEE = window.EEE;
  if (!EEE) return;
  const { db, $, el, money, toast } = EEE;

  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const ORD = ['1st', '2nd', '3rd', '4th', '5th'];

  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function todayDhaka() {
    const s = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
    return new Date(s + 'T00:00:00');
  }
  function monthKey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function monthLabel(k) {
    const d = new Date(k + '-01T00:00:00');
    return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }

  function allWeeks(startStr) {
    const start = new Date(startStr + 'T00:00:00');
    const today = todayDhaka();
    const list = [];
    for (let t = start.getTime(); t <= today.getTime(); t += WEEK_MS) {
      const d = new Date(t);
      list.push({ iso: iso(d), month: monthKey(d) });
    }
    return list;
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
    const weeks = allWeeks(st.start_date);
    const taken = await takenWeeks();
    const months = Array.from(new Set(weeks.map(w => w.month)));
    let curMonth = months[months.length - 1];
    const picked = new Set();
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
      months.forEach(m => {
        const o = el('option', '', monthLabel(m)); o.value = m; if (m === curMonth) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', () => { curMonth = sel.value; draw(); });
      box.appendChild(sel);

      box.appendChild(el('label', '', 'Select week (' + money(weekly) + ' per week)'));
      const wrap = el('div');
      weeks.filter(w => w.month === curMonth).forEach((w, i) => {
        const row = el('label');
        row.style.cssText = 'display:flex;gap:8px;align-items:center;margin:6px 0;';
        const cb = el('input'); cb.type = 'checkbox';
        const isTaken = taken.has(w.iso);
        cb.disabled = isTaken; cb.checked = picked.has(w.iso);
        cb.addEventListener('change', () => { if (cb.checked) picked.add(w.iso); else picked.delete(w.iso); draw(); });
        row.appendChild(cb);
        const label = (ORD[i] || (i + 1) + 'th') + ' week' + (isTaken ? ' - already paid or pending' : '');
        row.appendChild(document.createTextNode(label));
        wrap.appendChild(row);
      });
      box.appendChild(wrap);

      const total = el('div', 'pname', 'Total: ' + money(picked.size * weekly));
      box.appendChild(total);

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
