(function () {
  'use strict';
  const EEE = window.EEE;
  if (!EEE) return;
  const { db, $, el, money } = EEE;

  // Weeks: 1-7, 8-14, 15-21, 22-end of month (4 weeks only)
  const START = [1, 8, 15, 22];
  const ORD = ['1st', '2nd', '3rd', '4th'];
  const pad = n => String(n).padStart(2, '0');
  const dim = (y, m) => new Date(y, m, 0).getDate();
  function today() {
    const p = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' }).split('-').map(Number);
    return { y: p[0], m: p[1], d: p[2] };
  }
  function curWeek() {
    const t = today();
    let idx = 0;
    START.forEach((day, i) => { if (day <= t.d) idx = i; });
    return { iso: t.y + '-' + pad(t.m) + '-' + pad(START[idx]), name: ORD[idx] + ' week' };
  }
  function needWeeks(st) {
    const t = today();
    const need = [];
    if (!st || !st.start_date) return need;
    let [y, m] = st.start_date.split('-').map(Number);
    while (y < t.y || (y === t.y && m <= t.m)) {
      START.forEach(day => {
        if (day > dim(y, m)) return;
        if (y === t.y && m === t.m && day > t.d) return;
        need.push(y + '-' + pad(m) + '-' + pad(day));
      });
      m++; if (m > 12) { m = 1; y++; }
    }
    return need;
  }

  /* ---------- styles ---------- */
  const css = `
body:not(.dx-ready) #dx ~ *{visibility:hidden}
#chart-total,#chart-month-total{display:none !important}
#hello-n{display:none !important}
.hello-m{font-size:15px;font-weight:700;opacity:.97;margin-top:4px;text-shadow:0 1px 4px rgba(0,0,0,.25)}

/* ===== Greeting card: big, clear text, nice date chip ===== */
#hello{padding:20px 22px;min-height:112px;border-radius:20px;margin-bottom:12px;gap:12px}
#hello .hello-l{min-width:0;background:rgba(2,6,23,.30);border:1px solid rgba(255,255,255,.22);border-radius:16px;padding:12px 18px;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
#hello .hello-g{font-size:29px;line-height:1.2;font-weight:800;color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.55)}
#hello .hello-m{display:inline-flex;align-items:center;gap:8px;margin-top:9px;padding:6px 15px;border-radius:999px;background:rgba(255,255,255,.24);border:1px solid rgba(255,255,255,.45);font-size:15px;font-weight:600;color:#fff;opacity:1;text-shadow:0 1px 3px rgba(0,0,0,.45)}
#hello .hello-m svg{width:17px;height:17px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0}
#hello .hello-m b{font-weight:800}
#hello .hello-m b::after{content:"·";margin-left:8px;opacity:.8}
#hello .hello-t{padding:12px 18px;border-radius:16px;background:rgba(2,6,23,.32)}
#hello #hello-time{font-size:25px;font-weight:800;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.5)}
#hello #hello-date{display:none}
@media(max-width:600px){
#hello{padding:14px 12px;min-height:96px;gap:8px}
#hello .hello-l{padding:10px 12px}
#hello .hello-g{font-size:21px}
#hello .hello-m{font-size:12.5px;padding:5px 11px;gap:6px;margin-top:7px}
#hello .hello-m svg{width:14px;height:14px}
#hello .hello-t{padding:9px 10px}
#hello #hello-time{font-size:16px}
}

/* ===== bKash / Nagad: clear "tap to pay" buttons with effect ===== */
#page-overview #paybar .payhead{font-size:15px;color:#047857}
#page-overview #paybar .paybtn{min-height:104px;animation:dxglowB 1.8s ease-out infinite !important}
#page-overview #paybar .paybtn.nagad{animation-name:dxglowN !important}
#page-overview #paybar .paybtn::after{content:"";position:absolute;top:0;left:-70%;width:45%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.7),transparent);transform:skewX(-20deg);animation:dxshine 2.8s ease-in-out infinite;pointer-events:none}
#page-overview #paybar .bkash small{background:#e2136e !important;color:#fff !important}
#page-overview #paybar .nagad small{background:#f6921e !important;color:#fff !important}
#page-overview #paybar .paybtn small::after{display:inline-block;animation:dxarrow 1s ease-in-out infinite}
@keyframes dxglowB{0%{box-shadow:0 5px 14px rgba(0,0,0,.2),0 0 0 0 rgba(226,19,110,.55)}70%{box-shadow:0 5px 14px rgba(0,0,0,.2),0 0 0 14px rgba(226,19,110,0)}100%{box-shadow:0 5px 14px rgba(0,0,0,.2),0 0 0 0 rgba(226,19,110,0)}}
@keyframes dxglowN{0%{box-shadow:0 5px 14px rgba(0,0,0,.2),0 0 0 0 rgba(246,146,30,.6)}70%{box-shadow:0 5px 14px rgba(0,0,0,.2),0 0 0 14px rgba(246,146,30,0)}100%{box-shadow:0 5px 14px rgba(0,0,0,.2),0 0 0 0 rgba(246,146,30,0)}}
@keyframes dxshine{0%,55%{left:-70%}100%{left:130%}}
@keyframes dxarrow{0%,100%{transform:translateX(0)}50%{transform:translateX(5px)}}
@media (prefers-reduced-motion:reduce){
#page-overview #paybar .paybtn,#page-overview #paybar .paybtn::after,#page-overview #paybar .paybtn small::after{animation:none !important}
}

/* ===== dashboard cards ===== */
#dx-n:empty{display:none}
#dx-n .dx-notice{margin-bottom:14px}
.dx-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;margin:0 0 14px}
.dx-grid .card{margin-bottom:0;min-width:0}
.dx-big{font-size:26px;font-weight:800;margin:4px 0}
.dx-sub{font-size:14px;color:#475569;font-weight:600}
.dx-badge{display:inline-block;padding:5px 14px;border-radius:999px;font-size:14px;font-weight:800}
.dx-ok{background:#d1fae5;color:#047857}
.dx-wait{background:#fef3c7;color:#92400e}
.dx-due{background:#fee2e2;color:#b91c1c}
.dx-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.dx-paybtn{border:0;border-radius:999px;padding:10px 18px;font-size:14px;font-weight:700;color:#fff;cursor:pointer}
.dx-track{height:14px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin:10px 0 6px}
.dx-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#34d399,#047857)}
.dx-todo{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;margin-bottom:10px;border-radius:12px;cursor:pointer;font-size:15px;font-weight:700;border:1px solid #e2e8f0;background:#fff;width:100%;text-align:left}
.dx-todo.hot{background:#fef3c7;border-color:#fde68a;color:#92400e}
.dx-todo.zero{background:#ecfdf5;border-color:#a7f3d0;color:#047857}
.dx-todo b{font-size:20px}
.dx-notice{grid-column:1/-1;border:2px solid #fbbf24;background:#fffbeb}
.dx-notice h2{color:#92400e}
.dx-nitem{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:10px 0}
.dx-nmsg{font-size:16px;font-weight:700;color:#0f172a;word-break:break-word}
.dx-ntime{font-size:12px;color:#92400e;margin-top:2px}
.dx-ncar{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.dx-ncar::-webkit-scrollbar{display:none}
.dx-nslide{flex:0 0 100%;min-width:0;box-sizing:border-box;scroll-snap-align:start}
.dx-ndots{display:flex;justify-content:center;align-items:center;gap:8px;margin-top:6px}
.dx-ndot{width:8px;height:8px;border-radius:50%;border:0;padding:0;background:#fcd34d;cursor:pointer;transition:width .2s}
.dx-ndot.on{background:#92400e;width:22px;border-radius:999px}
.dx-ncount{text-align:center;font-size:12px;color:#92400e;margin-top:4px}
.dx-nform{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.dx-nform input{flex:1;min-width:200px;margin:0}
`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  /* ---------- helpers ---------- */
  function card(title) {
    const c = el('div', 'card');
    c.appendChild(el('h2', '', title));
    return c;
  }
  function link(text, page) {
    const b = el('button', 'btn ghost sm', text);
    b.style.marginTop = '12px';
    b.addEventListener('click', () => EEE.showPage(page));
    return b;
  }
  // Greeting card: shows today's date (Dhaka time) under the greeting
  function setDateLine() {
    const n = $('hello-n');
    if (!n) return;
    let m = $('hello-m');
    if (!m) { m = el('div', 'hello-m'); m.id = 'hello-m'; n.parentNode.insertBefore(m, n.nextSibling); }
    const d = new Date();
    const wd = d.toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka', weekday: 'long' });
    const rest = d.toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'long', year: 'numeric' });
    const key = wd + '|' + rest;
    if (m.dataset.k === key) return;
    m.dataset.k = key;
    m.innerHTML = '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><b>' + wd + '</b><span>' + rest + '</span>';
  }
  setDateLine();
  setInterval(setDateLine, 60000);

  /* ---------- notice board (one notice at a time, swipe sideways) ---------- */
  let noticeIdx = 0; // which notice is showing, kept when the page refreshes

  async function noticesCard(isAdmin) {
    const r = await db.from('notices')
      .select('id, message, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    if (r.error) {
      if (!isAdmin) return null;
      const c = card('Notice board');
      c.classList.add('dx-notice');
      c.appendChild(el('p', 'err', 'Could not load notices: ' + r.error.message));
      return c;
    }
    const list = r.data || [];
    // students see the card only when there is a notice
    if (!isAdmin && !list.length) return null;

    const c = card('Notice board');
    c.classList.add('dx-notice');

    if (!list.length) c.appendChild(el('p', 'empty', 'No notices yet.'));
    else {
      if (noticeIdx >= list.length || noticeIdx < 0) noticeIdx = 0;

      const car = el('div', 'dx-ncar');
      list.forEach(n => {
        const slide = el('div', 'dx-nslide');
        const row = el('div', 'dx-nitem');
        const left = el('div');
        left.appendChild(el('div', 'dx-nmsg', n.message));
        left.appendChild(el('div', 'dx-ntime', EEE.fmtTime(n.created_at)));
        row.appendChild(left);
        if (isAdmin) {
          const del = el('button', 'btn danger sm', 'Delete');
          del.addEventListener('click', async () => {
            if (!confirm('Delete this notice?')) return;
            del.disabled = true;
            const d = await db.from('notices').delete().eq('id', n.id);
            if (d.error) { del.disabled = false; EEE.toast('Could not delete: ' + d.error.message); return; }
            EEE.toast('Notice deleted.');
            render();
          });
          row.appendChild(del);
        }
        slide.appendChild(row);
        car.appendChild(slide);
      });
      c.appendChild(car);

      if (list.length > 1) {
        const dots = el('div', 'dx-ndots');
        const dotEls = list.map((n, i) => {
          const d = el('button', 'dx-ndot');
          d.setAttribute('aria-label', 'Notice ' + (i + 1));
          d.addEventListener('click', () => car.scrollTo({ left: i * car.clientWidth, behavior: 'smooth' }));
          dots.appendChild(d);
          return d;
        });
        const count = el('div', 'dx-ncount');
        const mark = i => {
          dotEls.forEach((d, k) => d.classList.toggle('on', k === i));
          count.textContent = (i + 1) + ' of ' + list.length;
        };
        car.addEventListener('scroll', () => {
          if (!car.clientWidth) return;
          const i = Math.max(0, Math.min(list.length - 1, Math.round(car.scrollLeft / car.clientWidth)));
          noticeIdx = i;
          mark(i);
        });
        mark(noticeIdx);
        c.appendChild(dots);
        c.appendChild(count);
      }
    }

    if (isAdmin) {
      const form = el('div', 'dx-nform');
      const inp = el('input');
      inp.id = 'dx-notice-in';
      inp.maxLength = 300;
      inp.placeholder = 'Write a notice for everyone (max 300 letters)';
      const post = el('button', 'btn', 'Post notice');
      post.addEventListener('click', async () => {
        const msg = inp.value.trim();
        if (!msg) { EEE.toast('Write the notice first.'); return; }
        post.disabled = true;
        const ins = await db.from('notices').insert({ message: msg }).select('id').single();
        if (ins.error) { post.disabled = false; EEE.toast('Could not post: ' + ins.error.message); return; }
        inp.value = '';
        noticeIdx = 0; // the new notice is first
        // The notice is saved. Now send it to every phone.
        let note = 'Notice posted.';
        try {
          const fn = await db.functions.invoke('send-notice', { body: { notice_id: ins.data.id } });
          if (fn.error) {
            let why = fn.error.message || 'unknown error';
            try {
              if (fn.error.context && typeof fn.error.context.json === 'function') {
                const j = await fn.error.context.json();
                if (j && j.error) why = j.error;
              }
            } catch (e2) {}
            note = 'Notice posted, but phone alerts failed: ' + why;
          } else if (fn.data && typeof fn.data.sent === 'number') {
            note = 'Notice posted. Sent to ' + fn.data.sent + ' device(s).';
          }
        } catch (e) {
          note = 'Notice posted, but phone alerts failed: ' + (e && e.message ? e.message : e);
        }
        post.disabled = false;
        EEE.toast(note);
        render();
      });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') post.click(); });
      form.appendChild(inp);
      form.appendChild(post);
      c.appendChild(form);
    }
    return c;
  }

  /* ---------- shared: recent expenses card ---------- */
  function expensesCard() {
    const c = card('Recent expenses');
    const list = (EEE.state.expenses || []).slice(0, 5);
    if (!list.length) c.appendChild(el('p', 'empty', 'No expenses yet.'));
    list.forEach(x => {
      const row = el('div', 'feed-item');
      row.appendChild(el('div', 'fav', (x.reason || '?').charAt(0).toUpperCase()));
      const main = el('div', 'fmain');
      main.appendChild(el('div', 'fname', x.reason || '-'));
      main.appendChild(el('div', 'fsub', EEE.fmtDate(x.expense_date) + (x.category ? ' · ' + x.category : '')));
      row.appendChild(main);
      row.appendChild(el('div', 'famt', money(x.amount)));
      c.appendChild(row);
    });
    c.appendChild(link('See all in Public Ledger', 'report'));
    return c;
  }

  /* ---------- shared: who paid this week (from approved payments) ---------- */
  function paidThisWeek() {
    const cw = curWeek();
    const names = new Set();
    (EEE.state.contribs || []).forEach(r => { if (r.week_start === cw.iso) names.add(r.student_name); });
    return names.size;
  }

  /* ---------- student ---------- */
  async function studentView() {
    const S = EEE.state;
    const [r, notice] = await Promise.all([
      db.from('payments')
        .select('status, amount, method, submitted_at, review_note, payment_weeks(week_start)')
        .order('submitted_at', { ascending: false }),
      noticesCard(false)
    ]);
    if (r.error) return { notice: null, mid: el('p', 'err', 'Could not load your status: ' + r.error.message), bottom: null };
    const rows = r.data || [];
    const wstat = {};
    rows.forEach(p => {
      if (p.status === 'approved' || p.status === 'pending') {
        (p.payment_weeks || []).forEach(w => { if (wstat[w.week_start] !== 'approved') wstat[w.week_start] = p.status; });
      }
    });
    const weekly = Number((S.settings || {}).weekly_amount || 30);
    const cw = curWeek();
    const need = needWeeks(S.settings);
    const dueList = need.filter(w => !wstat[w]);
    const dueWeeks = dueList.length;
    const doneWeeks = need.filter(w => wstat[w] === 'approved').length;
    const pct = need.length ? Math.round((doneWeeks / need.length) * 100) : 0;
    const status = wstat[cw.iso] || 'due';

    // the big bKash/Nagad buttons show only when this week is due
    const pb = $('paybar');
    if (pb) pb.hidden = !(status === 'due' && typeof EEE.openPay === 'function');
    const ph = document.querySelector('#paybar .payhead');
    if (ph) ph.textContent = 'Tap bKash or Nagad to pay this week (' + money(weekly) + ')';
    document.querySelectorAll('#paybar .paybtn small').forEach(s => { s.textContent = 'Tap to pay'; });

    setDateLine();

    /* ----- middle part: fund progress, my progress ----- */
    const mid = el('div', 'dx-grid');

    // fund progress (everyone)
    const c2 = card('Fund progress this week');
    c2.appendChild(el('div', 'dx-big', paidThisWeek() + ' member(s) paid'));
    c2.appendChild(el('div', 'dx-sub', 'Approved payments for the ' + cw.name + '.'));
    mid.appendChild(c2);

    // my progress
    const c3 = card('My progress');
    c3.appendChild(el('div', 'dx-big', doneWeeks + ' of ' + need.length + ' weeks paid'));
    const track = el('div', 'dx-track');
    const fillBar = el('div', 'dx-fill'); fillBar.style.width = pct + '%';
    track.appendChild(fillBar);
    c3.appendChild(track);
    c3.appendChild(el('div', 'dx-sub', pct + '% (approved payments only)'));
    mid.appendChild(c3);

    /* ----- bottom part (below the charts): this week, last payment, expenses ----- */
    const bottom = el('div', 'dx-grid');

    const c1 = card('This week · ' + cw.name);
    c1.appendChild(el('span', 'dx-badge ' + (status === 'approved' ? 'dx-ok' : status === 'pending' ? 'dx-wait' : 'dx-due'),
      status === 'approved' ? 'Paid ✓' : status === 'pending' ? 'Pending approval' : 'Due'));
    c1.appendChild(el('div', 'dx-big', money(weekly)));
    c1.appendChild(el('div', 'dx-sub', dueWeeks ? 'Total due: ' + money(dueWeeks * weekly) + ' (' + dueWeeks + ' week(s))' : 'Total due: ৳0'));
    if (dueWeeks) {
      const un = el('div', 'dx-sub', 'Unpaid: ' + EEE.weeksText(dueList));
      un.style.marginTop = '6px';
      c1.appendChild(un);
    }
    const row = el('div', 'dx-row');
    const mp = el('button', 'btn ghost sm', 'My payments');
    mp.addEventListener('click', () => EEE.showPage('mypayments'));
    row.appendChild(mp);
    c1.appendChild(row);
    bottom.appendChild(c1);

    const c4 = card('My last payment');
    const last = rows[0];
    if (!last) {
      c4.appendChild(el('p', 'empty', 'You have not made any payment yet.'));
    } else {
      const cls = last.status === 'approved' ? 'dx-ok' : last.status === 'rejected' ? 'dx-due' : 'dx-wait';
      const txt = last.status === 'approved' ? 'Approved ✓' : last.status === 'rejected' ? 'Rejected' : 'Pending approval';
      c4.appendChild(el('span', 'dx-badge ' + cls, txt));
      c4.appendChild(el('div', 'dx-big', money(last.amount)));
      const wk = EEE.weeksText((last.payment_weeks || []).map(w => w.week_start).sort());
      c4.appendChild(el('div', 'dx-sub', (last.method || '') + (wk ? ' · ' + wk : '')));
      c4.appendChild(el('div', 'dx-sub', EEE.fmtTime(last.submitted_at)));
      if (last.status === 'rejected') {
        const why = el('div', 'dx-sub', 'Reason: ' + (last.review_note || 'Not given'));
        why.style.color = '#b91c1c';
        why.style.marginTop = '6px';
        c4.appendChild(why);
      }
    }
    bottom.appendChild(c4);

    bottom.appendChild(expensesCard());
    return { notice, mid, bottom };
  }

  /* ---------- admin ---------- */
  async function adminView() {
    const S = EEE.state;
    const [p, m, pw, notice] = await Promise.all([
      db.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      db.from('students').select('id').eq('approved', false).eq('rejected', false),
      db.from('payment_weeks').select('week_start, payments(student_id, status)'),
      noticesCard(true)
    ]);
    const pendPay = p.count || 0;
    const pendMem = (m.data || []).length;

    setDateLine();

    const mid = el('div', 'dx-grid');

    // waiting card
    const c1 = card('Waiting for you');
    function todo(label, n, page) {
      const b = el('button', 'dx-todo ' + (n ? 'hot' : 'zero'));
      b.appendChild(el('span', '', label));
      b.appendChild(el('b', '', String(n)));
      b.addEventListener('click', () => EEE.showPage(page));
      return b;
    }
    c1.appendChild(todo('Payments to review', pendPay, 'review'));
    c1.appendChild(todo('Members to approve', pendMem, 'students'));
    mid.appendChild(c1);

    // progress card
    const members = (EEE.getMembers ? EEE.getMembers() : []).filter(x => x.is_active && x.approved);
    const cw = curWeek();
    const done = Math.min(paidThisWeek(), members.length || paidThisWeek());
    const pct = members.length ? Math.round((done / members.length) * 100) : 0;
    const c2 = card('Fund progress · ' + cw.name);
    c2.appendChild(el('div', 'dx-big', done + ' of ' + members.length + ' paid'));
    const track = el('div', 'dx-track');
    const fillBar = el('div', 'dx-fill'); fillBar.style.width = pct + '%';
    track.appendChild(fillBar);
    c2.appendChild(track);
    c2.appendChild(el('div', 'dx-sub', pct + '% (approved payments only)'));
    mid.appendChild(c2);

    // dues summary card
    const c3 = card('Dues summary');
    if (pw.error || !S.settings || !S.settings.start_date) {
      c3.appendChild(el('p', 'empty', 'Dues not available yet.'));
    } else {
      const taken = {};
      (pw.data || []).forEach(x => {
        const py = x.payments;
        if (!py || (py.status !== 'approved' && py.status !== 'pending')) return;
        (taken[py.student_id] = taken[py.student_id] || new Set()).add(x.week_start);
      });
      const need = needWeeks(S.settings);
      const weekly = Number(S.settings.weekly_amount || 30);
      const rows = members.map(s => {
        const got = taken[s.id] || new Set();
        return { s, due: need.filter(w => !got.has(w)).length };
      }).filter(x => x.due > 0).sort((a, b) => b.due - a.due);
      const grand = rows.reduce((a, x) => a + x.due * weekly, 0);
      c3.appendChild(el('div', 'dx-big', money(grand)));
      c3.appendChild(el('div', 'dx-sub', rows.length + ' member(s) have dues'));
      rows.slice(0, 5).forEach(x => {
        const row = el('div', 'feed-item');
        row.appendChild(el('div', 'fav', (x.s.full_name || '?').charAt(0).toUpperCase()));
        const main = el('div', 'fmain');
        main.appendChild(el('div', 'fname', x.s.full_name || '-'));
        main.appendChild(el('div', 'fsub', x.due + ' week(s)'));
        row.appendChild(main);
        row.appendChild(el('div', 'famt', money(x.due * weekly)));
        c3.appendChild(row);
      });
      c3.appendChild(link('Open Dues page', 'dues'));
    }
    mid.appendChild(c3);

    const bottom = el('div', 'dx-grid');
    bottom.appendChild(expensesCard());
    return { notice, mid, bottom };
  }

  /* ---------- places on the dashboard ----------
     #dx-n  = Notice board, right under the Quick pay buttons
     #dx    = Fund progress / My progress, right under Live payments
     #dx-b  = other cards, at the very bottom (below the charts)   */
  function hosts() {
    let n = $('dx-n'), m = $('dx'), b = $('dx-b');
    const pay = $('paybar'), feed = $('feed'), page = $('page-overview');
    if (!n && pay && pay.parentNode) {
      n = el('div'); n.id = 'dx-n';
      pay.parentNode.insertBefore(n, pay.nextSibling);
    }
    if (!m && feed) {
      const fc = feed.closest('.card');
      if (fc && fc.parentNode) {
        m = el('div'); m.id = 'dx';
        fc.parentNode.insertBefore(m, fc.nextSibling);
      }
    }
    if (!b && page) {
      b = el('div'); b.id = 'dx-b';
      page.appendChild(b);
    }
    return { n, m, b };
  }

  // Draw nodes into a place. If nothing changed, do not redraw (no flicker).
  function put(host, nodes) {
    if (!host) return false;
    const fresh = document.createElement('div');
    nodes.filter(Boolean).forEach(x => fresh.appendChild(x));
    const sig = fresh.innerHTML;
    if (host.dataset.sig === sig) return false;
    const y = window.scrollY;
    host.replaceChildren(...Array.from(fresh.childNodes));
    host.dataset.sig = sig;
    window.scrollTo(0, y);
    return true;
  }

  /* ---------- render ---------- */
  let seq = 0;
  async function render() {
    const S = EEE.state;
    const stats = $('stats');
    if (!stats || !S.role) return;
    // do not rebuild the cards while the admin is typing a notice
    const typing = $('dx-notice-in');
    if (typing && document.activeElement === typing) return;
    const my = ++seq;
    let parts;
    try { parts = S.role === 'admin' ? await adminView() : await studentView(); }
    catch (e) { console.error(e); document.body.classList.add('dx-ready'); return; }
    if (my !== seq) return;

    const h = hosts();
    const changed = put(h.n, [parts.notice]);
    put(h.m, [parts.mid]);
    put(h.b, [parts.bottom]);

    // The notice is on screen now, so the slider has a width.
    // Put it back on the notice that was showing before the refresh.
    if (changed && h.n) {
      const car = h.n.querySelector('.dx-ncar');
      if (car && car.clientWidth) {
        car.style.scrollBehavior = 'auto';
        car.scrollLeft = noticeIdx * car.clientWidth;
      }
    }
    if (h.m) h.m.style.minHeight = '';
    document.body.classList.add('dx-ready');
  }

  // Make the places ready at page load, so nothing jumps around
  (function () {
    hosts();
    // safety: never keep things hidden if the first render fails
    setTimeout(() => {
      document.body.classList.add('dx-ready');
    }, 8000);
  })();

  /* ---------- admin backup: download CSV files (shown in Settings) ---------- */
  function csvCell(v) {
    if (v === null || v === undefined) return '';
    let s = String(v);
    // stop spreadsheet formulas from running
    if (/^[=+@\t\r]/.test(s) || /^-(?![0-9.])/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function downloadCsv(name, header, rows) {
    const lines = [header.map(csvCell).join(',')].concat(rows.map(r => r.map(csvCell).join(',')));
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
  async function fetchAll(build) {
    let all = [];
    let from = 0;
    for (;;) {
      const r = await build().range(from, from + 999);
      if (r.error) return { error: r.error };
      const rows = r.data || [];
      all = all.concat(rows);
      if (rows.length < 1000) break;
      from += 1000;
    }
    return { data: all };
  }
  function stamp() {
    const t = today();
    return t.y + '-' + pad(t.m) + '-' + pad(t.d);
  }

  const EXPORTS = {
    payments: {
      label: 'Download payments',
      file: 'eee13-payments-',
      query: () => db.from('payments')
        .select('id, amount, method, transaction_id, sender_number, status, submitted_at, reviewed_at, review_note, students(full_name, roll_no), payment_weeks(week_start)')
        .order('submitted_at', { ascending: false }).order('id'),
      header: ['Submitted', 'Student', 'Roll', 'Method', 'Amount', 'Weeks', 'TrxID', 'Sender', 'Status', 'Reviewed', 'Review note'],
      row: p => [
        p.submitted_at, p.students && p.students.full_name, p.students && p.students.roll_no, p.method, p.amount,
        EEE.weeksText((p.payment_weeks || []).map(w => w.week_start).sort()),
        p.transaction_id, p.sender_number, p.status, p.reviewed_at, p.review_note
      ]
    },
    expenses: {
      label: 'Download expenses',
      file: 'eee13-expenses-',
      query: () => db.from('public_expenses').select('*').order('expense_date', { ascending: false }).order('id'),
      header: ['Date', 'Reason', 'Category', 'Amount', 'Receipt link'],
      row: x => [x.expense_date, x.reason, x.category, x.amount, x.receipt_url]
    },
    members: {
      label: 'Download members',
      file: 'eee13-members-',
      query: () => db.from('students').select('*').order('created_at', { ascending: false }).order('id'),
      header: ['Name', 'Nickname', 'Roll', 'Registration no', 'Phone', 'Email', 'Active', 'Approved', 'Joined'],
      row: s => [s.full_name, s.nickname, s.roll_no, s.registration_no, s.phone, s.email, s.is_active ? 'yes' : 'no', s.approved ? 'yes' : 'no', s.created_at]
    }
  };

  function backupCard() {
    const page = $('page-settings');
    let c = $('bk-card');
    if (EEE.state.role !== 'admin') { if (c) c.remove(); return; }
    if (!page || c) return;

    c = card('Backup (download CSV files)');
    c.id = 'bk-card';
    c.appendChild(el('div', 'help', 'Download your data as files you can open in Excel. Download them now and then and keep them safe.'));
    const row = el('div', 'dx-row');
    const msg = el('p', '');
    Object.keys(EXPORTS).forEach(key => {
      const ex = EXPORTS[key];
      const b = el('button', 'btn', ex.label);
      b.addEventListener('click', async () => {
        msg.className = ''; msg.textContent = '';
        b.disabled = true;
        const old = b.textContent;
        b.textContent = 'Preparing...';
        const r = await fetchAll(ex.query);
        b.disabled = false;
        b.textContent = old;
        if (r.error) { msg.className = 'err'; msg.textContent = 'Could not download: ' + r.error.message; return; }
        downloadCsv(ex.file + stamp() + '.csv', ex.header, r.data.map(ex.row));
        msg.className = 'ok';
        msg.textContent = 'Downloaded ' + r.data.length + ' row(s).';
      });
      row.appendChild(b);
    });
    c.appendChild(row);
    c.appendChild(msg);
    page.appendChild(c);
  }

  /* ---------- admin notification bell (top bar) ---------- */
  let bellWired = false;

  function setAdminBadge(n) {
    const b = $('bell-badge');
    if (!b) return;
    b.textContent = n > 99 ? '99+' : String(n);
    b.hidden = !n;
    b.style.display = n ? 'grid' : 'none';
  }

  async function updateAdminBell() {
    const bell = $('bell-btn');
    if (!bell || EEE.state.role !== 'admin') return;
    bell.hidden = false;
    const [p, m] = await Promise.all([
      db.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      db.from('students').select('id', { count: 'exact', head: true }).eq('approved', false).eq('rejected', false)
    ]);
    if (p.error || m.error) return;
    setAdminBadge((p.count || 0) + (m.count || 0));
  }

  async function openAdminPanel() {
    const old = $('admin-bell-back');
    if (old) { old.remove(); return; }

    const back = el('div', 'modal-back');
    back.id = 'admin-bell-back';
    back.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.25);z-index:9999;';
    const box = el('div', 'card');
    box.style.cssText = 'position:absolute;top:64px;right:12px;width:min(400px,calc(100% - 24px));max-height:75vh;overflow:auto;margin:0;';
    back.appendChild(box);
    back.addEventListener('click', e => { if (e.target === back) back.remove(); });
    document.body.appendChild(back);

    box.appendChild(el('h2', '', 'Waiting for you'));
    box.appendChild(el('p', 'help', 'Loading...'));

    const [p, m] = await Promise.all([
      db.from('payments')
        .select('id, amount, method, submitted_at, students(full_name), payment_weeks(week_start)')
        .eq('status', 'pending')
        .order('submitted_at', { ascending: false })
        .limit(8),
      db.from('students').select('id', { count: 'exact', head: true }).eq('approved', false).eq('rejected', false)
    ]);
    box.innerHTML = '';
    box.appendChild(el('h2', '', 'Waiting for you'));
    if (p.error) {
      box.appendChild(el('p', 'err', 'Could not load: ' + p.error.message));
      return;
    }
    const list = p.data || [];
    const memN = m.count || 0;

    if (!list.length && !memN) box.appendChild(el('p', 'empty', 'Nothing is waiting. All clear.'));

    list.forEach(x => {
      const weeks = EEE.weeksText((x.payment_weeks || []).map(w => w.week_start).sort());
      const row = el('div', 'feed-item');
      row.appendChild(el('div', 'fav', ((x.students && x.students.full_name) || '?').charAt(0).toUpperCase()));
      const main = el('div', 'fmain');
      main.appendChild(el('div', 'fname', ((x.students && x.students.full_name) || 'Unknown') + ' · ' + (x.method || '')));
      main.appendChild(el('div', 'fsub', (weeks ? weeks + ' · ' : '') + EEE.fmtTime(x.submitted_at)));
      row.appendChild(main);
      row.appendChild(el('div', 'famt', money(x.amount)));
      box.appendChild(row);
    });

    if (memN) {
      const mb = el('button', 'dx-todo hot');
      mb.style.marginTop = '10px';
      mb.appendChild(el('span', '', 'Members to approve'));
      mb.appendChild(el('b', '', String(memN)));
      mb.addEventListener('click', () => { back.remove(); EEE.showPage('students'); });
      box.appendChild(mb);
    }

    if (list.length) {
      const go = el('button', 'btn full', 'Open payment review');
      go.style.marginTop = '10px';
      go.addEventListener('click', () => { back.remove(); EEE.showPage('review'); });
      box.appendChild(go);
    }
    const closeBtn = el('button', 'btn ghost full', 'Close');
    closeBtn.style.marginTop = '8px';
    closeBtn.addEventListener('click', () => back.remove());
    box.appendChild(closeBtn);
  }

  function wireAdminBell() {
    const bell = $('bell-btn');
    if (!bell || bellWired) return;
    bellWired = true;
    bell.addEventListener('click', () => {
      if (EEE.state.role === 'admin') openAdminPanel();
    });
  }

  wireAdminBell();
  EEE.refreshHooks.push(render);
  EEE.refreshHooks.push(backupCard);
  EEE.refreshHooks.push(updateAdminBell);
})();
