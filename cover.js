/* =====================================================================
   EEE-13 Class Fund · Cover Page Maker (Lab Report)
   Cover page by Tomal & Pronay
   - Students fill a form, see a live preview and download a PDF.
   - The admin controls the "Submitted to" teacher dropdown (name + department).
   - Everything is drawn in the browser. No student data is saved on a server.
   ===================================================================== */
(function () {
  'use strict';
  const EEE = window.EEE;
  if (!EEE) return;
  const { db, $, el, toast } = EEE;
  const S = EEE.state;
  const isAdmin = () => S.role === 'admin';

  /* ---------- template geometry (matches the template image) ---------- */
  const CW = 2482, CH = 3510;          // template image size (A4 at 300 dpi)
  const K = CW / 1414;                 // layout units -> template pixels
  const SHIFT = 56;                    // moves the page down so top and bottom space are equal
  const V = '?v=1';
  const ALICE = '"Cover Alice", Georgia, serif';
  const BMANGO = '"Cover Black Mango", "Cover Alice", Georgia, serif';
  // letters that exist in the Black Mango file we have. Update when the full font is added.
  const BM_GLYPHS = ' .IKMSabdefghikmnortuy';
  const DEPT_SUGGEST = [
    'Electrical & Electronic Engineering', 'Computer Science & Engineering', 'Civil Engineering',
    'Physics', 'Chemistry', 'Mathematics'
  ];

  /* ---------- form fields ---------- */
  const FIELDS = {
    course_code: ['Course code', 20, 'Example: EEE-1102'],
    course_title: ['Course title', 60, 'Example: Electrical Circuit I Sessional.'],
    exp_no: ['Experiment no.', 10, ''],
    exp_name: ['Experiment name', 120, 'Two lines fit. Very long names get smaller.'],
    name: ['Your name', 40, ''],
    class_roll: ['Class roll', 10, ''],
    exam_roll: ['Exam roll (optional)', 15, 'Leave empty if you do not have one yet.'],
    reg_no: ['Reg no.', 20, 'Example: 2025-732-270'],
    batch: ['Batch', 6, 'Example: 13'],
    semester: ['Semester', 12, 'Example: 1st'],
    session: ['Session', 12, 'Example: 2025-2026'],
    date_exp: ['Date of experiment', 0, ''],
    date_sub: ['Date of submission', 0, '']
  };
  const REQUIRED = ['course_code', 'course_title', 'exp_no', 'exp_name', 'name', 'class_roll', 'reg_no', 'batch', 'semester', 'session', 'date_exp', 'date_sub'];
  const D = {};                        // current form values (kept while the app stays open)
  Object.keys(FIELDS).forEach(k => { D[k] = ''; });
  let teacherId = '';
  let teachers = [];
  let teacherErr = '';
  const inputs = {};
  let built = false, ui = {}, assets = null;

  /* ---------- small helpers ---------- */
  const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
  const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
  const dmy = iso => (/^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4) : '');
  const curTeacher = () => teachers.find(t => t.id === teacherId) || null;
  const missingGlyphs = s => Array.from(new Set(Array.from(clean(s)).filter(c => BM_GLYPHS.indexOf(c) === -1)));

  EEE.ICON.file = '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="14" y2="17"/>';

  /* ---------- styles ---------- */
  const css = `
.cv-hero{position:relative;overflow:hidden;border-radius:20px;padding:22px 24px;margin-bottom:16px;color:#fff;background:linear-gradient(135deg,#022c22,#047857 60%,#10b981);box-shadow:0 8px 22px rgba(4,120,87,.25)}
.cv-hero h2{font-size:24px;margin:0 0 4px;color:#fff}
.cv-hero p{margin:0;font-size:14px;opacity:.95;line-height:1.5;max-width:560px}
.cv-credit{display:inline-flex;align-items:center;gap:8px;position:relative;overflow:hidden;margin-top:14px;padding:8px 16px;border-radius:999px;font-size:14px;font-weight:800;color:#3b2a00;background:linear-gradient(135deg,#fde68a,#fbbf24 55%,#f59e0b);box-shadow:0 0 0 3px rgba(253,224,71,.28),0 6px 16px rgba(245,158,11,.4)}
.cv-credit b{font-weight:900;letter-spacing:.2px}
.cv-credit::after{content:"";position:absolute;top:0;left:-60%;width:40%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.75),transparent);transform:skewX(-20deg);animation:cvshine 3s ease-in-out infinite}
@keyframes cvshine{0%,55%{left:-60%}100%{left:130%}}
.cv-types{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
.cv-type{padding:9px 16px;border-radius:999px;border:1px solid var(--b);background:#fff;font-size:14px;font-weight:700;color:var(--m);cursor:default}
.cv-type.on{background:var(--g6);border-color:var(--g5);color:var(--g3)}
.cv-type small{margin-left:6px;font-size:11px;font-weight:700;color:#b45309;background:#fef3c7;padding:2px 8px;border-radius:999px}
.cv-wrap{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:20px;align-items:start}
.cv-wrap .card{margin-bottom:0}
.cv-prev{position:sticky;top:84px}
.cv-prev canvas{display:block;width:100%;height:auto;border:1px solid var(--b);border-radius:8px;background:#fff;box-shadow:0 4px 14px rgba(15,23,42,.1)}
.cv-load{padding:40px 10px;text-align:center;color:var(--m);font-size:14px}
.cv-dept{display:inline-block;margin:-6px 0 14px;padding:5px 12px;border-radius:999px;background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;font-size:13px;font-weight:700}
.cv-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}
.cv-note{font-size:12px;color:var(--m);margin:12px 0 0;line-height:1.5}
.cv-warn{font-size:12px;color:#b45309;margin:-8px 0 12px}
.cv-trow{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--b)}
.cv-trow:last-child{border-bottom:0}
.cv-trow .cv-tm{flex:1;min-width:0}
.cv-trow .cv-tn{font-weight:700;word-break:break-word}
.cv-trow .cv-td{font-size:12px;color:var(--m);word-break:break-word}
.cv-admin{margin-top:20px;border:2px dashed #10b981}
/* dashboard promo card */
.cv-promo{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:16px 18px;margin-bottom:14px;border-radius:18px;color:#fff;background:linear-gradient(135deg,#064e3b,#059669 60%,#34d399);box-shadow:0 8px 22px rgba(5,150,105,.28)}
.cv-promo img{width:74px;height:auto;border-radius:6px;background:#fff;transform:rotate(-4deg);box-shadow:0 6px 16px rgba(0,0,0,.3);flex-shrink:0}
.cv-promo .cv-pt{flex:1;min-width:200px}
.cv-promo h3{margin:0 0 4px;font-size:18px;font-weight:800;color:#fff}
.cv-promo p{margin:0;font-size:13.5px;line-height:1.5;opacity:.95}
.cv-promo .btn{background:#fff;color:#047857;font-weight:800;padding:11px 20px;box-shadow:0 4px 12px rgba(0,0,0,.2)}
.cv-promo .btn:hover{background:#ecfdf5}
.cv-promo .cv-credit{margin-top:10px;font-size:12.5px;padding:6px 13px}
@media(max-width:900px){.cv-wrap{grid-template-columns:1fr}.cv-prev{position:static}}
@media(max-width:600px){.cv-hero{padding:18px 16px}.cv-hero h2{font-size:21px}.cv-promo img{width:60px}}
@media (prefers-reduced-motion:reduce){.cv-credit::after{animation:none}}
`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  function credit() {
    const c = el('div', 'cv-credit');
    c.appendChild(document.createTextNode('✨ Cover page by '));
    c.appendChild(el('b', '', 'Tomal & Pronay'));
    return c;
  }

  /* ---------- fonts + template image (loaded once) ---------- */
  function loadAssets() {
    if (assets) return assets;
    assets = (async () => {
      const f1 = new FontFace('Cover Alice', 'url(cover-alice.ttf' + V + ')');
      const f2 = new FontFace('Cover Black Mango', 'url(cover-blackmango.ttf' + V + ')');
      const img = new Image();
      img.src = 'cover-template.png' + V;
      await Promise.all([
        f1.load().then(f => document.fonts.add(f)),
        f2.load().then(f => document.fonts.add(f)),
        img.decode()
      ]);
      return img;
    })();
    assets.catch(() => { assets = null; });
    return assets;
  }

  /* ---------- drawing the cover (same layout as the template) ---------- */
  function draw(canvas, tpl, scale) {
    const ctx = canvas.getContext('2d');
    canvas.width = Math.round(CW * scale);
    canvas.height = Math.round(CH * scale);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, CW, CH);
    ctx.drawImage(tpl, 0, SHIFT, CW, CH);
    ctx.fillStyle = '#000';
    ctx.textBaseline = 'alphabetic';

    const widthAt = (font, size, text) => { ctx.font = size + 'px ' + font; return ctx.measureText(text).width; };
    const fit = (font, text, px) => 100 * (px * K) / widthAt(font, 100, text);
    const shrink = (font, text, size, maxPx) => {
      const w = widthAt(font, size, text);
      return w > maxPx * K ? size * maxPx * K / w : size;
    };
    const put = (x, y, text, size, font, align) => {
      ctx.font = size + 'px ' + font;
      ctx.textAlign = align || 'left';
      ctx.fillText(text, x * K, y * K + SHIFT + 0.33 * size);
    };
    const wrap = (text, font, size, maxW) => {
      const lines = []; let cur = '';
      text.split(' ').filter(Boolean).forEach(w => {
        const t = cur ? cur + ' ' + w : w;
        if (!cur || widthAt(font, size, t) <= maxW) cur = t; else { lines.push(cur); cur = w; }
      });
      if (cur) lines.push(cur);
      return lines;
    };

    const TOP = fit(ALICE, 'Electrical Circuit I Sessional.', 451);
    const BOX = fit(ALICE, '2025-2026', 146);
    const DEPT = fit(ALICE, 'Electrical & Electronic Engineering', 480);
    const TEACH = fit(BMANGO, 'Md. Ifthakhar Khan Sagor', 470);

    // top part: course and experiment
    [['course_code', 780], ['course_title', 837], ['exp_no', 894]].forEach(([k, y]) => {
      const v = clean(D[k]);
      if (v) put(438, y, v, shrink(ALICE, v, TOP, 852), ALICE);
    });
    const en = clean(D.exp_name);
    if (en) {
      const maxW = 852 * K;
      let size = TOP, lines = wrap(en, ALICE, size, maxW);
      while ((lines.length > 2 || lines.some(l => widthAt(ALICE, size, l) > maxW)) && size > TOP * 0.55) {
        size *= 0.95; lines = wrap(en, ALICE, size, maxW);
      }
      if (lines.length > 2) {
        let l2 = lines.slice(1).join(' ');
        while (widthAt(ALICE, size, l2 + '…') > maxW && l2.length > 1) l2 = l2.slice(0, -1);
        lines = [lines[0], l2 + '…'];
      }
      lines.forEach((l, i) => put(438, 952 + i * 57, l, size, ALICE));
    }

    // "Submitted by" box
    const rows = [['name', 1114], ['class_roll', 1166], ['exam_roll', 1218], ['reg_no', 1270], ['batch', 1321],
      ['semester', 1372], ['session', 1424], ['date_exp', 1476], ['date_sub', 1527]];
    rows.forEach(([k, y]) => {
      const v = (k === 'date_exp' || k === 'date_sub') ? dmy(D[k]) : clean(D[k]);
      if (v) put(343, y, v, shrink(ALICE, v, BOX, 352), ALICE);
    });

    // "Submitted to" box: teacher (Black Mango) and department (Alice)
    const t = curTeacher();
    if (t) {
      const nm = clean(t.name), dp = clean(t.department);
      put(992, 1175, nm, shrink(BMANGO, nm, TEACH, 470), BMANGO, 'center');
      put(990, 1437, dp, shrink(ALICE, dp, DEPT, 480), ALICE, 'center');
    }
  }

  /* ---------- tiny PDF writer: one A4 page holding the cover as a JPEG ---------- */
  function jpegToPdf(jpeg, w, h) {
    const enc = new TextEncoder();
    const chunks = []; const offsets = []; let pos = 0;
    const add = d => { const u = typeof d === 'string' ? enc.encode(d) : d; chunks.push(u); pos += u.length; };
    const begin = n => { offsets[n] = pos; add(n + ' 0 obj\n'); };
    const PW = 595.28, PH = 841.89;
    add('%PDF-1.4\n');
    add(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));
    begin(1); add('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    begin(2); add('<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
    begin(3); add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Resources << /XObject << /Im0 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>\nendobj\n');
    begin(4);
    add('<< /Type /XObject /Subtype /Image /Width ' + w + ' /Height ' + h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpeg.length + ' >>\nstream\n');
    add(jpeg); add('\nendstream\nendobj\n');
    const content = 'q ' + PW + ' 0 0 ' + PH + ' 0 0 cm /Im0 Do Q';
    begin(5); add('<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream\nendobj\n');
    begin(6); add('<< /Title (Lab Report Cover) /Producer (EEE-13 Class Fund) >>\nendobj\n');
    const xref = pos;
    let x = 'xref\n0 7\n0000000000 65535 f \n';
    for (let i = 1; i <= 6; i++) x += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    add(x);
    add('trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    return new Blob(chunks, { type: 'application/pdf' });
  }
  EEE.coverJpegToPdf = jpegToPdf;

  function saveBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  const fileBase = () => 'Lab-Report-Cover-' + (clean(D.name) + '-' + clean(D.course_code)).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50);

  /* ---------- preview ---------- */
  let timer = null;
  function renderSoon() {
    if (!built) return;
    clearTimeout(timer);
    timer = setTimeout(renderPreview, 120);
  }
  async function renderPreview() {
    if (!built) return;
    try {
      const tpl = await loadAssets();
      ui.load.hidden = true; ui.canvas.hidden = false;
      draw(ui.canvas, tpl, 0.5);
    } catch (e) {
      console.error(e);
      ui.load.hidden = false; ui.canvas.hidden = true;
      ui.load.textContent = 'Could not load the cover files. Please check your internet and try again.';
    }
  }

  function validate() {
    for (const k of REQUIRED) {
      if (!clean(D[k])) { inputs[k].focus(); return FIELDS[k][0] + ' is required.'; }
    }
    if (!teacherId || !curTeacher()) { ui.teacher.focus(); return 'Please choose the teacher in "Submitted to".'; }
    return '';
  }

  async function makeFile(kind) {
    ui.msg.className = 'err'; ui.msg.textContent = '';
    const bad = validate();
    if (bad) { ui.msg.textContent = bad; return; }
    const btn = kind === 'pdf' ? ui.pdf : ui.img;
    const old = btn.textContent;
    btn.disabled = true; btn.textContent = 'Preparing...';
    try {
      const tpl = await loadAssets();
      const cv = document.createElement('canvas');
      draw(cv, tpl, 1);
      const blob = await new Promise((res, rej) => cv.toBlob(b => (b ? res(b) : rej(new Error('Could not make the image'))), 'image/jpeg', 0.95));
      if (kind === 'img') saveBlob(blob, fileBase() + '.jpg');
      else {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        saveBlob(jpegToPdf(bytes, cv.width, cv.height), fileBase() + '.pdf');
      }
      ui.msg.className = 'ok';
      ui.msg.textContent = 'Your cover page is ready. Check the download.';
    } catch (e) {
      console.error(e);
      ui.msg.textContent = 'Could not make the file: ' + (e && e.message ? e.message : e);
    }
    btn.disabled = false; btn.textContent = old;
  }

  /* ---------- teachers (dropdown list, controlled by the admin) ---------- */
  function teacherLabel(t) { return t.name + ' (' + t.department + ')'; }

  function fillTeacherSelect() {
    if (!built) return;
    const sel = ui.teacher;
    sel.innerHTML = '';
    const first = el('option', '', teachers.length ? 'Select teacher' : 'No teacher added yet');
    first.value = '';
    sel.appendChild(first);
    teachers.forEach(t => { const o = el('option', '', teacherLabel(t)); o.value = t.id; sel.appendChild(o); });
    if (!teachers.some(t => t.id === teacherId)) teacherId = '';
    sel.value = teacherId;
    const t = curTeacher();
    ui.dept.hidden = !t;
    ui.dept.textContent = t ? 'Department of ' + t.department : '';
    if (teacherErr) {
      ui.terr.hidden = false;
      ui.terr.textContent = isAdmin()
        ? 'The teacher list is not ready. Run the teachers.sql setup in Supabase first. (' + teacherErr + ')'
        : 'The teacher list is not ready yet. Please tell the admin.';
    } else if (!teachers.length) {
      ui.terr.hidden = false;
      ui.terr.textContent = isAdmin() ? 'Add teachers in the box below.' : 'The admin has not added any teacher yet.';
    } else ui.terr.hidden = true;
  }

  async function loadTeachers() {
    const r = await db.from('teachers').select('id, name, department').order('name');
    if (r.error) { teacherErr = r.error.message || 'error'; teachers = []; }
    else { teacherErr = ''; teachers = r.data || []; }
    fillTeacherSelect();
    if (isAdmin()) renderTeacherAdmin();
    renderSoon();
  }

  function renderTeacherAdmin() {
    if (!built || !ui.tlist) return;
    const list = ui.tlist;
    list.innerHTML = '';
    if (!teachers.length) list.appendChild(el('p', 'empty', 'No teachers yet.'));
    teachers.forEach(t => {
      const row = el('div', 'cv-trow');
      const m = el('div', 'cv-tm');
      m.appendChild(el('div', 'cv-tn', t.name));
      m.appendChild(el('div', 'cv-td', t.department + (missingGlyphs(t.name).length ? '  ·  ⚠ some letters use a plain font' : '')));
      row.appendChild(m);
      const ed = el('button', 'btn ghost sm', 'Edit');
      const del = el('button', 'btn danger sm', 'Delete');
      ed.addEventListener('click', async () => {
        const n = prompt('Teacher name', t.name);
        if (n === null) return;
        const d = prompt('Department', t.department);
        if (d === null) return;
        const nn = clean(n), dd = clean(d);
        if (nn.length < 2 || nn.length > 60 || dd.length < 2 || dd.length > 60) { toast('Name and department must be 2 to 60 letters.'); return; }
        const r = await db.from('teachers').update({ name: nn, department: dd }).eq('id', t.id);
        if (r.error) { toast('Could not update: ' + r.error.message); return; }
        toast('Teacher updated.');
        loadTeachers();
      });
      del.addEventListener('click', async () => {
        if (!confirm('Delete ' + t.name + ' from the list?')) return;
        const r = await db.from('teachers').delete().eq('id', t.id);
        if (r.error) { toast('Could not delete: ' + r.error.message); return; }
        toast('Teacher deleted.');
        loadTeachers();
      });
      row.appendChild(ed); row.appendChild(del);
      list.appendChild(row);
    });
    // department suggestions = common ones + the ones already used
    const seen = new Set(DEPT_SUGGEST);
    teachers.forEach(t => seen.add(t.department));
    ui.dlist.innerHTML = '';
    seen.forEach(d => { const o = document.createElement('option'); o.value = d; ui.dlist.appendChild(o); });
  }

  function buildAdminCard(page) {
    const card = el('div', 'card cv-admin');
    card.appendChild(el('h2', '', 'Teachers list (admin only)'));
    card.appendChild(el('div', 'help', 'Students pick the teacher from this list in "Submitted to". The department shows on the cover automatically.'));
    ui.tlist = el('div');
    card.appendChild(ui.tlist);

    card.appendChild(el('div', 'sec', 'Add a teacher'));
    const grid = el('div', 'formgrid');
    const nameIn = el('input'); nameIn.maxLength = 60;
    const deptIn = el('input'); deptIn.maxLength = 60; deptIn.setAttribute('list', 'cv-dept-list');
    ui.dlist = document.createElement('datalist'); ui.dlist.id = 'cv-dept-list';
    const w1 = el('div'); w1.appendChild(el('label', '', 'Teacher name')); w1.appendChild(nameIn);
    const w2 = el('div'); w2.appendChild(el('label', '', 'Department')); w2.appendChild(deptIn); w2.appendChild(ui.dlist);
    grid.appendChild(w1); grid.appendChild(w2);
    card.appendChild(grid);
    const warn = el('p', 'cv-warn'); warn.hidden = true;
    card.appendChild(warn);
    const add = el('button', 'btn', 'Add teacher');
    const msg = el('p', '');
    card.appendChild(add); card.appendChild(msg);

    nameIn.addEventListener('input', () => {
      const miss = missingGlyphs(nameIn.value);
      warn.hidden = !miss.length;
      warn.textContent = miss.length ? 'These letters are not in the cover font yet: ' + miss.join(' ') + '. They will show in a plain font until the full font file is added.' : '';
    });
    add.addEventListener('click', async () => {
      msg.className = 'err'; msg.textContent = '';
      const n = clean(nameIn.value), d = clean(deptIn.value);
      if (n.length < 2 || n.length > 60) { msg.textContent = 'Teacher name must be 2 to 60 letters.'; return; }
      if (d.length < 2 || d.length > 60) { msg.textContent = 'Department must be 2 to 60 letters.'; return; }
      add.disabled = true;
      const r = await db.from('teachers').insert({ name: n, department: d });
      add.disabled = false;
      if (r.error) {
        msg.textContent = r.error.code === '23505' ? 'This teacher is already in the list.' : 'Could not add: ' + r.error.message;
        return;
      }
      nameIn.value = ''; warn.hidden = true;
      toast('Teacher added.');
      loadTeachers();
    });
    page.appendChild(card);
  }

  /* ---------- the page ---------- */
  function field(grid, key) {
    const [label, max, hint] = FIELDS[key];
    const w = el('div');
    w.appendChild(el('label', '', label));
    const i = el('input');
    if (key === 'date_exp' || key === 'date_sub') i.type = 'date';
    else if (max) i.maxLength = max;
    i.value = D[key];
    i.addEventListener('input', () => { D[key] = i.value; renderSoon(); });
    inputs[key] = i;
    w.appendChild(i);
    if (hint) w.appendChild(el('p', 'hint', hint));
    grid.appendChild(w);
  }

  function prefill() {
    const st = S.student;
    if (st) {
      if (!D.name) D.name = st.full_name || '';
      if (!D.class_roll) D.class_roll = st.roll_no || '';
      if (!D.reg_no) D.reg_no = st.registration_no || '';
    }
    if (!D.date_sub) D.date_sub = todayISO();
    Object.keys(inputs).forEach(k => { if (inputs[k].value !== D[k]) inputs[k].value = D[k]; });
  }

  function build(page) {
    page.innerHTML = '';

    const hero = el('div', 'cv-hero');
    hero.appendChild(el('h2', '', 'Cover Page Maker'));
    hero.appendChild(el('p', '', 'Fill in your details and get a ready-to-print lab report cover page, made exactly like the department template.'));
    hero.appendChild(credit());
    page.appendChild(hero);

    const types = el('div', 'cv-types');
    const t1 = el('span', 'cv-type on', 'Lab Report');
    const t2 = el('span', 'cv-type', 'Assignment'); t2.appendChild(el('small', '', 'Soon'));
    const t3 = el('span', 'cv-type', 'Index'); t3.appendChild(el('small', '', 'Soon'));
    [t1, t2, t3].forEach(t => types.appendChild(t));
    page.appendChild(types);

    const wrap = el('div', 'cv-wrap');

    /* form */
    const fc = el('div', 'card');
    fc.appendChild(el('div', 'sec', 'Experiment'));
    const g1 = el('div', 'formgrid');
    ['course_code', 'course_title', 'exp_no', 'exp_name'].forEach(k => field(g1, k));
    fc.appendChild(g1);
    fc.appendChild(el('div', 'sec', 'Submitted by (you)'));
    const g2 = el('div', 'formgrid');
    ['name', 'class_roll', 'exam_roll', 'reg_no', 'batch', 'semester', 'session', 'date_exp', 'date_sub'].forEach(k => field(g2, k));
    fc.appendChild(g2);
    fc.appendChild(el('div', 'sec', 'Submitted to'));
    const tw = el('div');
    tw.appendChild(el('label', '', 'Teacher'));
    const sel = el('select');
    sel.addEventListener('change', () => {
      teacherId = sel.value;
      const t = curTeacher();
      ui.dept.hidden = !t;
      ui.dept.textContent = t ? 'Department of ' + t.department : '';
      renderSoon();
    });
    tw.appendChild(sel);
    const dept = el('div', 'cv-dept'); dept.hidden = true;
    tw.appendChild(dept);
    const terr = el('p', 'err'); terr.hidden = true; terr.style.margin = '0 0 12px';
    tw.appendChild(terr);
    fc.appendChild(tw);

    const act = el('div', 'cv-actions');
    const pdf = el('button', 'btn', 'Download PDF');
    const img = el('button', 'btn ghost', 'Save as image');
    act.appendChild(pdf); act.appendChild(img);
    fc.appendChild(act);
    const msg = el('p', '');
    fc.appendChild(msg);
    fc.appendChild(el('p', 'cv-note', 'Your details are not saved anywhere. The cover is made on your own device.'));
    wrap.appendChild(fc);

    /* preview */
    const pc = el('div', 'card cv-prev');
    pc.appendChild(el('h2', '', 'Live preview'));
    const load = el('div', 'cv-load', 'Loading preview...');
    const canvas = document.createElement('canvas');
    canvas.hidden = true;
    pc.appendChild(load); pc.appendChild(canvas);
    wrap.appendChild(pc);
    page.appendChild(wrap);

    ui = { teacher: sel, dept, terr, pdf, img, msg, load, canvas };
    pdf.addEventListener('click', () => makeFile('pdf'));
    img.addEventListener('click', () => makeFile('img'));

    if (isAdmin()) buildAdminCard(page);
    built = true;
    prefill();
    fillTeacherSelect();
    if (isAdmin()) renderTeacherAdmin();
  }

  function markSeen() {
    try { localStorage.setItem('eee13_cover_seen', '1'); } catch (e) { /* ignore */ }
    EEE.setBadge('cover', 0);
  }

  EEE.addPage('cover', {
    title: 'Cover Page Maker', label: 'Cover Page', icon: 'file', roles: ['admin', 'student'],
    onShow: async function (page) {
      markSeen();
      if (!built) build(page); else prefill();
      renderSoon();
      await loadTeachers();
    }
  });

  /* ---------- dashboard card: tells everyone that cover pages can be made here ---------- */
  function mountPromo() {
    if ($('cover-promo')) return;
    const anchor = $('dx-n') || $('paybar') || $('stats');
    if (!anchor || !anchor.parentNode) return;
    const p = el('div', 'cv-promo dx-sec');
    p.id = 'cover-promo';
    p.style.setProperty('--d', '0.24s');
    const img = document.createElement('img');
    img.src = 'cover-thumb.jpg' + V; img.alt = ''; img.loading = 'lazy';
    img.addEventListener('error', () => img.remove());
    p.appendChild(img);
    const t = el('div', 'cv-pt');
    t.appendChild(el('h3', '', 'Make your lab report cover page'));
    t.appendChild(el('p', '', 'Fill in a short form and download a ready-to-print cover page in the department template.'));
    t.appendChild(credit());
    p.appendChild(t);
    const b = el('button', 'btn', 'Create cover page →');
    b.addEventListener('click', () => EEE.showPage('cover'));
    p.appendChild(b);
    anchor.parentNode.insertBefore(p, anchor.nextSibling);
  }
  mountPromo();

  /* ---------- sidebar: put "Cover Page" just above Settings and show NEW until opened ---------- */
  EEE.refreshHooks.push(async () => {
    mountPromo();
    const nav = $('nav');
    if (!nav) return;
    const b = nav.querySelector('.nav[data-page="cover"]');
    const st = nav.querySelector('.nav[data-page="settings"]');
    if (b && st && b.nextElementSibling !== st) nav.insertBefore(b, st);
    let seen = false;
    try { seen = !!localStorage.getItem('eee13_cover_seen'); } catch (e) { /* ignore */ }
    if (b && !seen) EEE.setBadge('cover', 'NEW');
  });
})();
