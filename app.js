/* ================= CRT Academy — app.js ================= */
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const C = { up:'#22c55e', down:'#ef4444', high:'#38bdf8', low:'#f59e0b', eq:'#a78bfa',
  sl:'#f87171', tp:'#4ade80', entry:'#e5e7eb', mss:'#facc15', zone:'#a78bfa', text:'#93a0b8' };

const fmt = (n, d = 2) => { const s = Number(n).toFixed(d); return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s; };
const esc = s => String(s).replace(/[&<>"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };
const k = (o, h, l, c, label = '', extra = {}) => ({ o, h, l, c, label, ...extra });

/* ================= SVG CANDLESTICK RENDERER ================= */
function renderChart(candles, ann = {}, opt = {}) {
  const W = opt.w || 640, H = opt.h || 320, d = opt.dec ?? 2;
  const pad = { t: 24, r: 124, b: 30, l: 10 };
  const vals = [];
  candles.forEach(c => { if (!c.hidden) vals.push(c.h, c.l); });
  (ann.lines || []).forEach(l => vals.push(l.y));
  (ann.zones || []).forEach(z => vals.push(z.y1, z.y2));
  let max = Math.max(...vals), min = Math.min(...vals);
  const span = (max - min) || 1; max += span * 0.1; min -= span * 0.1;
  const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
  const n = candles.length, slot = pw / n, bw = Math.max(4, Math.min(slot * 0.6, 40));
  const X = i => pad.l + slot * i + slot / 2;
  const Y = p => pad.t + (max - p) / (max - min) * ph;
  const right = W - pad.r;

  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.title || 'กราฟแท่งเทียน')}">`;
  for (let g = 0; g <= 4; g++) { const gy = pad.t + ph * g / 4; s += `<line class="grid" x1="${pad.l}" x2="${right}" y1="${gy}" y2="${gy}"/>`; }

  // Zones
  (ann.zones || []).forEach(z => {
    const x1 = z.from != null ? X(z.from) - slot / 2 : pad.l;
    const x2 = z.to != null ? X(z.to) + slot / 2 : right;
    const top = Y(Math.max(z.y1, z.y2)), hh = Math.abs(Y(z.y1) - Y(z.y2));
    s += `<rect x="${x1}" y="${top}" width="${x2 - x1}" height="${hh}" fill="${z.color}" fill-opacity="${z.op || 0.15}" stroke="${z.color}" stroke-opacity=".45" stroke-dasharray="3 3"/>`;
    if (z.label) s += `<text x="${x1 + 4}" y="${top - 5}" fill="${z.color}" font-size="11" font-weight="600">${z.label}</text>`;
  });

  // Horizontal lines + right-side labels (with collision avoidance)
  const labels = [];
  (ann.lines || []).forEach(l => {
    const x1 = l.from != null ? X(l.from) - slot / 2 : pad.l;
    const x2 = l.to != null ? X(l.to) + slot / 2 : right;
    const y = Y(l.y);
    s += `<line x1="${x1}" x2="${x2}" y1="${y}" y2="${y}" stroke="${l.color}" stroke-width="1.4" ${l.dash ? 'stroke-dasharray="6 4"' : ''}/>`;
    if (x2 < right - 1) s += `<line x1="${x2}" x2="${right}" y1="${y}" y2="${y}" stroke="${l.color}" stroke-opacity=".25" stroke-dasharray="2 4"/>`;
    labels.push({ y, text: `${l.label} ${fmt(l.y, d)}`, color: l.color });
  });
  labels.sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < 13) labels[i].y = labels[i - 1].y + 13;
  labels.forEach(lb => { s += `<text x="${right + 6}" y="${lb.y + 4}" fill="${lb.color}" font-size="11" font-weight="600">${lb.text}</text>`; });

  // Candles
  candles.forEach((c, i) => {
    const x = X(i);
    if (c.label) s += `<text x="${x}" y="${H - 9}" text-anchor="middle" fill="${C.text}" font-size="11">${c.label}</text>`;
    if (c.hidden) {
      s += `<rect x="${x - bw / 2}" y="${pad.t + ph * 0.3}" width="${bw}" height="${ph * 0.4}" fill="none" stroke="${C.text}" stroke-opacity=".35" stroke-dasharray="4 4" rx="3"/>`;
      return;
    }
    const up = c.c >= c.o, col = up ? C.up : C.down;
    const top = Y(Math.max(c.o, c.c)), bh = Math.max(1.5, Math.abs(Y(c.o) - Y(c.c)));
    s += `<g opacity="${c.dim ? 0.4 : 1}"><line x1="${x}" x2="${x}" y1="${Y(c.h)}" y2="${Y(c.l)}" stroke="${col}" stroke-width="1.5"/>`;
    s += `<rect x="${x - bw / 2}" y="${top}" width="${bw}" height="${bh}" fill="${col}" rx="1.5"/></g>`;
  });

  // Markers
  (ann.marks || []).forEach(m => {
    const x = X(m.i), y = Y(m.y), col = m.color || C.mss, below = m.pos !== 'above';
    s += `<circle cx="${x}" cy="${y}" r="4.5" fill="none" stroke="${col}" stroke-width="1.8"/>`;
    s += `<text x="${x}" y="${below ? y + 18 : y - 10}" text-anchor="middle" fill="${col}" font-size="11" font-weight="600">${m.text}</text>`;
  });

  // Arrows
  (ann.arrows || []).forEach(a => {
    const x1 = X(a.i1), y1 = Y(a.y1), x2 = X(a.i2), y2 = Y(a.y2), col = a.color || C.tp;
    const ang = Math.atan2(y2 - y1, x2 - x1), L = 10;
    const p1 = [x2 - L * Math.cos(ang - 0.45), y2 - L * Math.sin(ang - 0.45)];
    const p2 = [x2 - L * Math.cos(ang + 0.45), y2 - L * Math.sin(ang + 0.45)];
    s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="2" stroke-dasharray="5 4"/>`;
    s += `<polygon points="${x2},${y2} ${p1.join(',')} ${p2.join(',')}" fill="${col}"/>`;
  });
  return s + '</svg>';
}

/* ================= PATTERN LIBRARY ================= */
const PATTERNS = {
  bull: {
    title: 'Bullish CRT', tag: ['ok', 'Valid'],
    desc: 'C2 กวาด Low ของ C1 แล้วปิดกลับในกรอบ คาดหวังว่าราคาจะวิ่งขึ้นไปหา High ของ C1',
    candles: [k(113,115,109,110), k(110,112,100,103,'C1'), k(103,105,96,102,'C2'), k(102,112.6,101,112,'C3')],
    ann: { lines: [
      { y:112, label:'C1 High', color:C.high, from:1 }, { y:100, label:'C1 Low', color:C.low, from:1 },
      { y:106, label:'50%', color:C.eq, from:1, dash:true }, { y:95.5, label:'SL', color:C.sl, from:2, dash:true }],
      marks: [{ i:2, y:96, text:'Sweep', pos:'below', color:C.low }] },
    points: ['C1 สร้างกรอบ 100 – 112', 'C2 มีไส้ลงไปถึง 96 (กวาด Sell-side Liquidity) แต่ปิดที่ 102 ซึ่งอยู่ในกรอบ', 'C3 วิ่งขึ้นไปแตะ High ของ C1 ที่ 112'],
  },
  bear: {
    title: 'Bearish CRT', tag: ['ok', 'Valid'],
    desc: 'C2 กวาด High ของ C1 แล้วปิดกลับในกรอบ คาดหวังว่าราคาจะวิ่งลงไปหา Low ของ C1',
    candles: [k(97,103,96,102), k(102,112,100,109,'C1'), k(109,116,107,110,'C2'), k(110,111,99.4,100,'C3')],
    ann: { lines: [
      { y:112, label:'C1 High', color:C.high, from:1 }, { y:100, label:'C1 Low', color:C.low, from:1 },
      { y:106, label:'50%', color:C.eq, from:1, dash:true }, { y:116.5, label:'SL', color:C.sl, from:2, dash:true }],
      marks: [{ i:2, y:116, text:'Sweep', pos:'above', color:C.high }] },
    points: ['C1 สร้างกรอบ 100 – 112', 'C2 มีไส้ขึ้นไปถึง 116 (กวาด Buy-side Liquidity) แต่ปิดที่ 110 ซึ่งอยู่ในกรอบ', 'C3 วิ่งลงไปแตะ Low ของ C1 ที่ 100'],
  },
  breakout: {
    title: 'Breakout (ไม่ใช่ CRT)', tag: ['bad', 'Invalid'],
    desc: 'C2 ลงไปใต้ Low และปิดนอกกรอบ แปลว่าตลาดยอมรับราคาใหม่ (Acceptance) ไม่ใช่การหลอกแล้วกลับ',
    candles: [k(113,115,109,110), k(110,112,100,103,'C1'), k(103,104,94,95,'C2'), k(95,96.5,90,91,'C3')],
    ann: { lines: [{ y:112, label:'C1 High', color:C.high, from:1 }, { y:100, label:'C1 Low', color:C.low, from:1 }],
      marks: [{ i:2, y:95, text:'ปิดนอกกรอบ', pos:'below', color:C.down }] },
    points: ['C2 ปิดที่ 95 ต่ำกว่า Low ของ C1 (100)', 'การปิดนอกกรอบคือสัญญาณไปต่อ ไม่ใช่สัญญาณกลับตัว', 'ถ้าเข้า Buy ตรงนี้ เท่ากับสวน Breakout'],
  },
  inside: {
    title: 'Inside Bar (ยังไม่มี Setup)', tag: ['info', 'รอ'],
    desc: 'C2 ไม่ได้ทะลุทั้ง High และ Low ของ C1 จึงยังไม่มีการกวาดสภาพคล่อง',
    candles: [k(113,115,109,110), k(110,112,100,103,'C1'), k(103,108,101,106,'C2'), k(0,0,0,0,'?',{ hidden:true })],
    ann: { lines: [{ y:112, label:'C1 High', color:C.high, from:1 }, { y:100, label:'C1 Low', color:C.low, from:1 }, { y:106, label:'50%', color:C.eq, from:1, dash:true }] },
    points: ['C2 อยู่ในกรอบ 101 – 108 ทั้งแท่ง', 'ยังไม่มี Sweep จึงยังไม่ใช่ CRT', 'รอแท่งถัดไป หรือใช้กรอบ C1 เป็น Range หลายแท่ง'],
  },
  outside: {
    title: 'Outside Bar (ไม่ชัดเจน)', tag: ['warn', 'ไม่ชัด'],
    desc: 'C2 กวาดทั้ง High และ Low ของ C1 แล้วปิดในกรอบ สภาพคล่องถูกเก็บไปแล้วทั้งสองฝั่ง',
    candles: [k(113,115,109,110), k(110,112,100,103,'C1'), k(103,114,98,107,'C2'), k(0,0,0,0,'?',{ hidden:true })],
    ann: { lines: [{ y:112, label:'C1 High', color:C.high, from:1 }, { y:100, label:'C1 Low', color:C.low, from:1 }],
      marks: [{ i:2, y:114, text:'Sweep', pos:'above', color:C.high }, { i:2, y:98, text:'Sweep', pos:'below', color:C.low }] },
    points: ['ไม่รู้ว่าฝั่งไหนคือ Manipulation จริง', 'ส่วนใหญ่ควรข้าม', 'หรือใช้ C2 เป็นกรอบใหม่ (C1 ใหม่) แล้วรอ Setup ถัดไป'],
  },
  multi: {
    title: 'Multi-Candle Range CRT', tag: ['ok', 'Valid'],
    desc: 'กรอบเกิดจากหลายแท่ง (แท่งแม่ + Inside Bars) แล้วมีแท่งกวาดขอบกรอบรวม',
    candles: [k(115,116,111,112), k(112,113,100,102,'R1'), k(102,108,101,107,'R2'), k(107,109,103,104,'R3'), k(104,105,97,103,'Sweep'), k(103,111,102,110.5), k(110.5,113.4,109.5,113,'Target')],
    ann: { zones: [{ y1:100, y2:113, from:1, to:3, color:C.zone, label:'Range' }],
      lines: [{ y:113, label:'Range High', color:C.high, from:1 }, { y:100, label:'Range Low', color:C.low, from:1 },
        { y:106.5, label:'50%', color:C.eq, from:1, dash:true }, { y:96.5, label:'SL', color:C.sl, from:4, dash:true }],
      marks: [{ i:4, y:97, text:'Sweep', pos:'below', color:C.low }] },
    points: ['R2 และ R3 เป็น Inside Bar ของ R1 กรอบรวมจึงเป็น 100 – 113', 'แท่ง Sweep ลงไปถึง 97 แล้วปิดที่ 103 ในกรอบ', 'ราคาวิ่งไปถึง High ของกรอบรวม'],
  },
  keylevel: {
    title: 'CRT ที่ Key Level (A+ Setup)', tag: ['ok', 'A+'],
    desc: 'ไส้ของ C2 กวาด Low ลงไปแตะ HTF FVG / Demand แล้วปิดกลับในกรอบ มีเหตุผลรองรับสองชั้น',
    candles: [k(114,116,109,110), k(110,112,100,102,'C1'), k(102,104,96.5,101,'C2'), k(101,112.5,100.5,112,'C3')],
    ann: { zones: [{ y1:95, y2:98.5, from:0, color:C.zone, label:'HTF FVG' }],
      lines: [{ y:112, label:'C1 High', color:C.high, from:1 }, { y:100, label:'C1 Low', color:C.low, from:1 }, { y:94.6, label:'SL', color:C.sl, from:2, dash:true }],
      marks: [{ i:2, y:96.5, text:'Sweep', pos:'below', color:C.low }] },
    points: ['มี Liquidity Sweep + HTF PD Array อยู่ที่จุดเดียวกัน', 'วาง SL ใต้โซน FVG', 'CRT ที่มี Confluence แบบนี้มักมีคุณภาพดีกว่า CRT ที่เกิดกลางกรอบ'],
  },
  failed: {
    title: 'Setup ถูกต้อง แต่แพ้', tag: ['warn', 'แพ้ได้'],
    desc: 'C2 ผ่านกฎ CRT ครบทุกข้อ แต่ราคาลงต่อจนโดน SL ซึ่งเป็นเรื่องปกติของทุกระบบ',
    candles: [k(113,115,109,110), k(110,112,100,103,'C1'), k(103,105,96,101.5,'C2'), k(101.5,103,93,94,'C3')],
    ann: { lines: [{ y:112, label:'C1 High', color:C.high, from:1 }, { y:100, label:'C1 Low', color:C.low, from:1 }, { y:95.5, label:'SL', color:C.sl, from:2, dash:true }],
      marks: [{ i:2, y:96, text:'Sweep', pos:'below', color:C.low }, { i:3, y:93, text:'SL โดน', pos:'below', color:C.down }] },
    points: ['ไม่มีระบบไหนชนะ 100%', 'สิ่งที่ปกป้องพอร์ตคือ SL และขนาด Position', 'ให้วัดผลจาก Expectancy ของเทรดจำนวนมาก ไม่ใช่จากเทรดเดียว'],
  },
};
const patternChart = (id, h = 300) => renderChart(PATTERNS[id].candles, PATTERNS[id].ann, { h, title: PATTERNS[id].title });

/* LTF entry model (M15) */
const LTF = [k(103,103.5,101.5,102), k(102,102.5,100.5,101), k(101,101.8,99.2,99.6), k(99.6,100,97.5,98), k(98,99,96,98.6),
  k(98.6,100.5,98.2,100.2), k(100.2,102.8,100,102.6), k(102.6,103.4,101.2,103), k(103,103.2,101.4,101.6), k(101.6,101.9,100.8,101.5),
  k(101.5,104,101.3,103.8), k(103.8,106.5,103.5,106.2), k(106.2,109,105.8,108.7), k(108.7,112.2,108.3,111.9)];
const LTF_ANN = {
  zones: [{ y1:100.5, y2:101.2, from:6, to:9, color:C.zone, label:'FVG' }],
  lines: [{ y:112, label:'TP2 C1 High', color:C.tp, from:0 }, { y:106, label:'TP1 50%', color:C.eq, from:0, dash:true },
    { y:101.8, label:'MSS', color:C.mss, from:2, to:6 }, { y:101.2, label:'Entry', color:C.entry, from:7, dash:true },
    { y:100, label:'C1 Low', color:C.low, from:0 }, { y:95.8, label:'SL', color:C.sl, from:4, dash:true }],
  marks: [{ i:4, y:96, text:'Sweep', pos:'below', color:C.low }, { i:6, y:102.8, text:'Displacement', pos:'above', color:C.mss }, { i:9, y:100.8, text:'Entry', pos:'below', color:C.entry }],
};

/* ================= LESSONS ================= */
const LESSONS = [
  { id:'l1', title:'1. CRT คืออะไร', chart:'bull', body:`
    <p><b>Candle Range Theory (CRT)</b> มองว่า <b>แท่งเทียนทุกแท่งคือ “กรอบราคา” (Range)</b> ที่มี High, Low และจุดกึ่งกลาง (50% หรือ Equilibrium) ถ้าเรามองแท่งเทียนใน Timeframe ใหญ่ (HTF) เป็นกรอบ การเคลื่อนไหวใน Timeframe เล็ก (LTF) ก็คือราคาที่วิ่งไปมาระหว่างขอบบนกับขอบล่างของกรอบนั้น</p>
    <ul>
      <li><b>เหนือ High</b> มี Buy-side Liquidity คือ Stop Loss ของฝั่ง Short และ Buy Stop ของคนที่รอ Breakout</li>
      <li><b>ใต้ Low</b> มี Sell-side Liquidity คือ Stop Loss ของฝั่ง Long และ Sell Stop</li>
    </ul>
    <p>แนวคิดหลักคือ ราคามักจะ <b>กวาดสภาพคล่องฝั่งหนึ่งก่อน</b> แล้วจึงเคลื่อนไปหาสภาพคล่องอีกฝั่ง</p>
    <div class="note"><b>เชื่อมกับ Power of 3 (AMD) ของ ICT:</b> C1 = Accumulation (สร้างกรอบ) • ไส้ของ C2 = Manipulation (หลอกและกวาด) • C3 = Distribution (วิ่งจริง)</div>` },
  { id:'l2', title:'2. โครงสร้าง 3 แท่ง', chart:'bear', body:`
    <p>Setup CRT แบบมาตรฐานประกอบด้วยแท่งเทียน 3 แท่งบน Timeframe เดียวกัน เช่น H4</p>
    <div class="table-wrap"><table>
      <tr><th>แท่ง</th><th>ชื่อเรียก</th><th>หน้าที่</th><th>AMD</th></tr>
      <tr><td><b>C1</b></td><td>Range Candle</td><td>กำหนดกรอบ: High, Low และ 50%</td><td>Accumulation</td></tr>
      <tr><td><b>C2</b></td><td>Manipulation Candle</td><td>ไส้ทะลุ High หรือ Low ของ C1 แล้ว <b>ปิดกลับในกรอบ</b></td><td>Manipulation</td></tr>
      <tr><td><b>C3</b></td><td>Distribution Candle</td><td>แท่งที่คาดหวังให้วิ่งไปหาอีกฝั่งของกรอบ C1</td><td>Distribution</td></tr>
    </table></div>
    <h3>สองทิศทาง</h3>
    <ul>
      <li><b>Bullish CRT:</b> C2 กวาด <u>Low</u> ของ C1 → ปิดในกรอบ → เป้าหมายคือ <u>High</u> ของ C1</li>
      <li><b>Bearish CRT:</b> C2 กวาด <u>High</u> ของ C1 → ปิดในกรอบ → เป้าหมายคือ <u>Low</u> ของ C1</li>
    </ul>
    <div class="note">จำง่ายๆ: <b>“กวาดฝั่งไหน วิ่งไปอีกฝั่ง”</b></div>` },
  { id:'l3', title:'3. กฎการยืนยัน Setup', chart:'breakout', body:`
    <p>ก่อนจะเรียก Setup ว่า CRT ต้องผ่านเงื่อนไขทั้งหมดนี้</p>
    <ol>
      <li><b>มีการ Sweep จริง:</b> ไส้ของ C2 ต้องทะลุ High หรือ Low ของ C1</li>
      <li><b>ปิดกลับในกรอบ:</b> ราคา <u>ปิด</u> ของ C2 ต้องอยู่ระหว่าง High และ Low ของ C1 (ดูที่ราคาปิด ไม่ใช่ไส้)</li>
      <li><b>รอแท่งปิดเสมอ:</b> ระหว่างที่ C2 ยังไม่ปิด อย่าเพิ่งสรุปว่าเป็น CRT</li>
    </ol>
    <div class="table-wrap"><table>
      <tr><th>สถานการณ์ของ C2</th><th>ผลลัพธ์</th></tr>
      <tr><td>กวาด Low + ปิดในกรอบ</td><td><span class="tag ok">Bullish CRT</span></td></tr>
      <tr><td>กวาด High + ปิดในกรอบ</td><td><span class="tag ok">Bearish CRT</span></td></tr>
      <tr><td>กวาดแล้วปิดนอกกรอบ</td><td><span class="tag bad">Breakout — ไม่ใช่ CRT</span></td></tr>
      <tr><td>ไม่ทะลุทั้งสองฝั่ง (Inside Bar)</td><td><span class="tag info">ยังไม่มี Setup</span></td></tr>
      <tr><td>กวาดทั้งสองฝั่งแล้วปิดในกรอบ (Outside Bar)</td><td><span class="tag warn">ไม่ชัดเจน — ควรข้าม</span></td></tr>
    </table></div>
    <div class="warnbox">กราฟด้านล่างคือ <b>Breakout</b>: C2 ปิดต่ำกว่า Low ของ C1 ราคาจึงมีแนวโน้มไปต่อ ไม่ใช่กลับตัว</div>` },
  { id:'l4', title:'4. Entry, SL และเป้าหมาย', chart:'bull', body:`
    <h3 style="margin-top:0">จุดเข้า (Entry) 3 แบบ</h3>
    <div class="table-wrap"><table>
      <tr><th>แบบ</th><th>วิธี</th><th>ข้อดี</th><th>ข้อเสีย</th></tr>
      <tr><td>1. Close of C2</td><td>เข้าทันทีที่ C2 ปิดในกรอบ</td><td>ง่าย ไม่ตกรถ</td><td>SL กว้าง RR ต่ำ</td></tr>
      <tr><td>2. Retracement</td><td>ตั้ง Limit ที่ 50% ของแท่ง C2 หรือที่ Order Block ภายใน C2</td><td>RR ดีขึ้น</td><td>อาจไม่ได้ Fill</td></tr>
      <tr><td>3. LTF Confirmation</td><td>ลง TF เล็ก รอ MSS + FVG แล้วจึงเข้า</td><td>SL แคบ RR สูง</td><td>ต้องเฝ้าจอ ซับซ้อนกว่า</td></tr>
    </table></div>
    <h3>Stop Loss</h3>
    <p>วางเลยปลายไส้ของ C2 (จุดที่ Sweep) ออกไปเล็กน้อย เผื่อ Spread ถ้าราคากลับไปทำลายจุดนี้ แปลว่าการ Sweep ล้มเหลว และ Setup ใช้ไม่ได้แล้ว</p>
    <h3>Take Profit</h3>
    <ul>
      <li><b>TP1:</b> 50% (Equilibrium) ของ C1 ปิดบางส่วนหรือเลื่อน SL มาที่ทุน</li>
      <li><b>TP2:</b> อีกฝั่งของ C1 (High สำหรับ Bullish, Low สำหรับ Bearish)</li>
    </ul>
    <div class="note"><b>สูตร RR:</b> RR = |TP − Entry| ÷ |Entry − SL|<br>ตัวอย่าง: Entry 102, SL 95.5, TP 112 → RR = 10 ÷ 6.5 ≈ 1 : 1.54 ซึ่งยังต่ำกว่า 1 : 2 นี่จึงเป็นเหตุผลที่หลายคนเลือกหาจุดเข้าใน LTF (ดูหัวข้อ “โมเดลเข้าเทรด”)</div>` },
  { id:'l5', title:'5. Timeframe Alignment', body:`
    <p>CRT ใช้ได้ทุก Timeframe แต่ต้องจับคู่ HTF (หา Setup) กับ LTF (หาจุดเข้า) ให้เหมาะสม</p>
    <div class="table-wrap"><table>
      <tr><th>CRT บน HTF</th><th>หาจุดเข้าบน LTF</th><th>สไตล์</th></tr>
      <tr><td>Monthly</td><td>Daily / H4</td><td>Position</td></tr>
      <tr><td>Weekly</td><td>H4 / H1</td><td>Swing</td></tr>
      <tr><td>Daily</td><td>H1 / M15</td><td>Swing / Intraday</td></tr>
      <tr><td><b>H4</b></td><td><b>M15 / M5</b></td><td>Intraday (นิยมที่สุด)</td></tr>
      <tr><td>H1</td><td>M5 / M1</td><td>Scalping</td></tr>
    </table></div>
    <div class="note">ทิศทาง (Bias) ควรมาจาก TF ที่ใหญ่กว่า CRT อีกหนึ่งระดับ เช่น ถ้าเทรด CRT บน H4 ให้ดู Bias จาก Daily</div>
    <h3>ลำดับการวิเคราะห์ (Top-down)</h3>
    <ol>
      <li><b>Daily/Weekly:</b> หา Bias และ Key Level</li>
      <li><b>H4:</b> รอ C1 และ C2 เกิดที่ Key Level</li>
      <li><b>M15/M5:</b> รอ MSS + FVG หลัง Sweep แล้วจึงเข้า</li>
    </ol>` },
  { id:'l6', title:'6. เวลาและแท่ง H4 สำคัญ', body:`
    <p>สาย ICT/CRT ให้ความสำคัญกับ <b>เวลา</b> เพราะสภาพคล่องจะไหลเข้ามาช่วงเปิดตลาดหลัก แท่ง H4 ที่อิงเวลานิวยอร์กจะเปิดที่ 17:00, 21:00, 01:00, 05:00, 09:00 และ 13:00</p>
    <div class="table-wrap"><table>
      <tr><th>แท่ง H4 (เวลา NY)</th><th>ช่วงตลาด</th><th>เวลาไทย (มี.ค.–พ.ย.)</th><th>เวลาไทย (พ.ย.–มี.ค.)</th></tr>
      <tr><td>17:00</td><td>เปิดวันใหม่ (Daily Open)</td><td>04:00</td><td>05:00</td></tr>
      <tr><td>21:00</td><td>เอเชีย</td><td>08:00</td><td>09:00</td></tr>
      <tr><td><b>01:00</b></td><td>ลอนดอน</td><td><b>12:00</b></td><td><b>13:00</b></td></tr>
      <tr><td><b>05:00</b></td><td>ก่อนนิวยอร์ก</td><td><b>16:00</b></td><td><b>17:00</b></td></tr>
      <tr><td><b>09:00</b></td><td>นิวยอร์ก</td><td><b>20:00</b></td><td><b>21:00</b></td></tr>
      <tr><td>13:00</td><td>บ่ายนิวยอร์ก</td><td>00:00</td><td>01:00</td></tr>
    </table></div>
    <div class="warnbox"><b>เช็กเวลาโบรกเกอร์:</b> แท่ง H4 จะตรงกับตารางนี้เมื่อโบรกเกอร์ใช้เวลาเซิร์ฟเวอร์ GMT+2/GMT+3 (ตัดวันตาม New York close) ซึ่งพบได้บ่อย ถ้าแท่ง H4 ของคุณเปิดคนละเวลา การนับ C1/C2 จะคลาดเคลื่อน</div>
    <p class="muted small">หมายเหตุ: แท่ง 01:00, 05:00 และ 09:00 เป็นแนวทางที่นิยมสอนกัน ไม่ใช่กฎตายตัว ควร Backtest กับสินทรัพย์ที่คุณเทรดเอง</p>` },
  { id:'l7', title:'7. Key Level และ Bias', chart:'keylevel', body:`
    <p>CRT เกิดขึ้นบ่อยมากในทุก Timeframe ถ้าเทรดทุกอันจะเจอสัญญาณหลอกเยอะ ตัวกรองที่สำคัญที่สุดคือ <b>ตำแหน่ง</b> และ <b>ทิศทาง</b></p>
    <h3>Key Level (PD Array) ที่นิยม</h3>
    <ul>
      <li>HTF Fair Value Gap (FVG)</li>
      <li>HTF Order Block</li>
      <li>Previous Day/Week High–Low (PDH/PDL, PWH/PWL)</li>
      <li>Equal Highs/Lows (จุดที่ Stop Loss กองรวมกัน)</li>
    </ul>
    <h3>Bias และ Premium/Discount</h3>
    <ul>
      <li>หา <b>Draw on Liquidity</b> ว่าใน HTF ราคามีแนวโน้มจะไปเก็บสภาพคล่องฝั่งไหน</li>
      <li>Bullish CRT มีคุณภาพดีกว่าเมื่อเกิดใน <b>Discount</b> (ครึ่งล่างของ Dealing Range ใหญ่)</li>
      <li>Bearish CRT มีคุณภาพดีกว่าเมื่อเกิดใน <b>Premium</b> (ครึ่งบน)</li>
    </ul>
    <div class="okbox">ตัวอย่าง A+ Setup: C2 กวาด Low ลงไปแตะ HTF FVG แล้วปิดกลับในกรอบ มีทั้ง Liquidity Sweep และ Key Level รองรับ</div>` },
  { id:'l8', title:'8. ข้อผิดพลาด & การวัดผล', chart:'failed', body:`
    <h3 style="margin-top:0">ข้อผิดพลาดที่พบบ่อย</h3>
    <ol>
      <li>เข้าก่อน C2 ปิด แล้วแท่งปิดนอกกรอบจนกลายเป็น Breakout</li>
      <li>นับไส้เป็นการปิด ทั้งที่ต้องดู <b>ราคาปิด</b> เท่านั้น</li>
      <li>เทรดทุก CRT โดยไม่ดู Bias และ Key Level</li>
      <li>เทรดช่วงข่าวแรง (CPI, NFP, FOMC) ที่ไส้กวาดได้ทั้งสองฝั่ง</li>
      <li>ใช้เวลา H4 ไม่ตรงกับโบรกเกอร์</li>
      <li>เพิ่ม Lot เพื่อเอาคืนหลังแพ้</li>
    </ol>
    <h3>วัด “ความแม่นยำ” ให้ถูกวิธี</h3>
    <p>ดูแค่ Win rate ไม่พอ ต้องดู <b>Expectancy</b> ด้วย คือผลตอบแทนเฉลี่ยต่อเทรด มีหน่วยเป็น R</p>
    <div class="note">Expectancy = (Win% × กำไรเฉลี่ย) − (Loss% × ขาดทุนเฉลี่ย)<br>เช่น Win 45%, กำไรเฉลี่ย 2R, ขาดทุนเฉลี่ย 1R → 0.45 × 2 − 0.55 × 1 = <b>+0.35R</b> ต่อเทรด</div>
    <p>ควร Backtest อย่างน้อย 50–100 เทรดก่อนสรุปว่าระบบได้ผลกับคุณ แล้วบันทึกไว้ในส่วน “บันทึกผล”</p>
    <div class="warnbox">กราฟด้านล่าง: Setup ถูกต้องทุกข้อ แต่ราคาก็ยังลงต่อจนโดน SL การแพ้แบบนี้เป็นเรื่องปกติของทุกระบบ</div>` },
];

/* ================= CRT ANALYZER (single source of truth) ================= */
function analyzeCRT(c1, c2) {
  const R = c1.h - c1.l, eq = (c1.h + c1.l) / 2;
  const sweptH = c2.h > c1.h, sweptL = c2.l < c1.l;
  const inside = c2.c < c1.h && c2.c > c1.l;
  const base = { R, eq, sweptH, sweptL, inside, notes: [] };

  if (sweptH && sweptL && inside) return { ...base, type:'outside', answer:'none', cls:'warn', title:'Outside Bar — ไม่ชัดเจน',
    msg:'C2 กวาดทั้ง High และ Low ของ C1 แล้วปิดกลับในกรอบ สภาพคล่องถูกเก็บไปแล้วทั้งสองฝั่ง ทิศทางจึงไม่ชัด ส่วนใหญ่ควรข้าม หรือใช้ C2 เป็นกรอบใหม่' };

  if (sweptL && inside) {
    const entry = c2.c, sl = c2.l, risk = entry - sl;
    const lv = { entry, sl, tp1: eq, tp2: c1.h, rr1: (eq - entry) / risk, rr2: (c1.h - entry) / risk };
    const r = { ...base, type:'bull', answer:'bull', cls:'ok', lv, title:'Bullish CRT ✓',
      msg:'C2 กวาด Low ของ C1 (Sell-side Liquidity) แล้วปิดกลับในกรอบ เป้าหมายคือ 50% และ High ของ C1' };
    if (entry >= eq) r.notes.push('C2 ปิดเหนือ 50% แล้ว TP1 จึงถูกแตะไปในแท่ง C2 เหลือเป้าหมายแค่ High ของ C1 และ RR ลดลง');
    if (lv.rr2 < 2) r.notes.push('RR ถึงเป้าหมายหลักต่ำกว่า 1:2 ถ้าเข้าที่ราคาปิด C2 ลองหาจุดเข้าใน LTF (MSS + FVG) เพื่อให้ SL แคบลง');
    if (c2.c < c2.o) r.notes.push('C2 เป็นแท่งแดงแม้จะปิดในกรอบ แรงปฏิเสธจึงอาจยังไม่ชัด ควรรอการยืนยันใน LTF');
    return r;
  }
  if (sweptH && inside) {
    const entry = c2.c, sl = c2.h, risk = sl - entry;
    const lv = { entry, sl, tp1: eq, tp2: c1.l, rr1: (entry - eq) / risk, rr2: (entry - c1.l) / risk };
    const r = { ...base, type:'bear', answer:'bear', cls:'ok', lv, title:'Bearish CRT ✓',
      msg:'C2 กวาด High ของ C1 (Buy-side Liquidity) แล้วปิดกลับในกรอบ เป้าหมายคือ 50% และ Low ของ C1' };
    if (entry <= eq) r.notes.push('C2 ปิดต่ำกว่า 50% แล้ว TP1 จึงถูกแตะไปในแท่ง C2 เหลือเป้าหมายแค่ Low ของ C1 และ RR ลดลง');
    if (lv.rr2 < 2) r.notes.push('RR ถึงเป้าหมายหลักต่ำกว่า 1:2 ถ้าเข้าที่ราคาปิด C2 ลองหาจุดเข้าใน LTF (MSS + FVG) เพื่อให้ SL แคบลง');
    if (c2.c > c2.o) r.notes.push('C2 เป็นแท่งเขียวแม้จะปิดในกรอบ แรงปฏิเสธจึงอาจยังไม่ชัด ควรรอการยืนยันใน LTF');
    return r;
  }
  if (c2.c <= c1.l) return { ...base, type:'breakDown', answer:'none', cls:'bad', title:'Breakout ลง — ไม่ใช่ CRT',
    msg:'C2 ปิดต่ำกว่าหรือเท่ากับ Low ของ C1 ตลาดยอมรับราคานอกกรอบ (Acceptance) จึงไม่ใช่การกวาดแล้วกลับ ห้ามเข้า Buy ตามหลัก CRT' };
  if (c2.c >= c1.h) return { ...base, type:'breakUp', answer:'none', cls:'bad', title:'Breakout ขึ้น — ไม่ใช่ CRT',
    msg:'C2 ปิดสูงกว่าหรือเท่ากับ High ของ C1 ตลาดยอมรับราคานอกกรอบ จึงไม่ใช่การกวาดแล้วกลับ ห้ามเข้า Sell ตามหลัก CRT' };
  return { ...base, type:'inside', answer:'none', cls:'info', title:'Inside Bar — ยังไม่มี Setup',
    msg:'C2 ไม่ได้ทะลุ High หรือ Low ของ C1 จึงยังไม่มี Liquidity Sweep ให้รอแท่งถัดไป หรือมองเป็นกรอบหลายแท่ง' };
}

function buildAnn(r, c1, c2, i, d = 2) {
  const lines = [
    { y:c1.h, label:'C1 High', color:C.high, from:i }, { y:c1.l, label:'C1 Low', color:C.low, from:i },
    { y:r.eq, label:'50%', color:C.eq, from:i, dash:true }];
  const marks = [], arrows = [];
  if (r.sweptL) marks.push({ i:i + 1, y:c2.l, text:'Sweep', pos:'below', color:C.low });
  if (r.sweptH) marks.push({ i:i + 1, y:c2.h, text:'Sweep', pos:'above', color:C.high });
  if (r.lv) {
    lines.push({ y:r.lv.sl, label:'SL', color:C.sl, from:i + 1, dash:true });
    arrows.push({ i1:i + 2, y1:r.lv.entry, i2:i + 2, y2:r.lv.tp2, color:C.tp });
  }
  return { lines, marks, arrows };
}

/* ================= UI: LESSONS ================= */
const LKEY = 'crt_lessons_v1';
const lessonDone = new Set(load(LKEY, []));
let lessonIdx = 0;

function renderLessonNav() {
  $('#lessonNav').innerHTML = LESSONS.map((l, i) =>
    `<button class="${i === lessonIdx ? 'active' : ''}" data-i="${i}"><span>${l.title}</span>${lessonDone.has(l.id) ? '<span class="dot">✓</span>' : ''}</button>`).join('');
  $('#lessonBar').style.width = (lessonDone.size / LESSONS.length * 100) + '%';
  $('#lessonCount').textContent = `${lessonDone.size}/${LESSONS.length}`;
}
function showLesson(i) {
  lessonIdx = i;
  const l = LESSONS[i], done = lessonDone.has(l.id);
  $('#lessonBody').innerHTML = `
    <h3 style="margin-top:0;font-size:1.35rem">${l.title}</h3>${l.body}
    ${l.chart ? patternChart(l.chart) + `<p class="caption">ตัวอย่าง: ${PATTERNS[l.chart].title}</p>` : ''}
    <div class="lesson-foot">
      <button class="btn ghost sm" data-act="prev" ${i === 0 ? 'disabled' : ''}>← ก่อนหน้า</button>
      <button class="btn sm" data-act="done">${done ? '✓ เรียนแล้ว (กดเพื่อยกเลิก)' : 'ทำเครื่องหมายว่าเรียนแล้ว'}</button>
      <button class="btn ghost sm" data-act="next" ${i === LESSONS.length - 1 ? 'disabled' : ''}>ถัดไป →</button>
    </div>`;
  renderLessonNav();
}
function initLessons() {
  $('#lessonNav').addEventListener('click', e => { const b = e.target.closest('button'); if (b) showLesson(+b.dataset.i); });
  $('#lessonBody').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act, id = LESSONS[lessonIdx].id;
    if (act === 'prev' && lessonIdx > 0) showLesson(lessonIdx - 1);
    if (act === 'next' && lessonIdx < LESSONS.length - 1) showLesson(lessonIdx + 1);
    if (act === 'done') {
      lessonDone.has(id) ? lessonDone.delete(id) : lessonDone.add(id);
      save(LKEY, [...lessonDone]);
      if (lessonDone.has(id) && lessonIdx < LESSONS.length - 1) showLesson(lessonIdx + 1); else showLesson(lessonIdx);
    }
  });
  showLesson(0);
}

/* ================= UI: PATTERNS ================= */
function initPatterns() {
  $('#patternGrid').innerHTML = Object.keys(PATTERNS).map(id => {
    const p = PATTERNS[id];
    return `<div class="card pattern-card">
      <h3>${p.title}<span class="tag ${p.tag[0]}">${p.tag[1]}</span></h3>
      <p>${p.desc}</p>${patternChart(id, 280)}
      <ul>${p.points.map(x => `<li>${x}</li>`).join('')}</ul></div>`;
  }).join('');
}

/* ================= UI: CHECKER ================= */
const CK_IDS = ['c1o','c1h','c1l','c1c','c2o','c2h','c2l','c2c'];
function setChecker(vals) { CK_IDS.forEach((id, i) => { $('#' + id).value = vals[i]; }); runChecker(); }
function runChecker(e) {
  if (e) e.preventDefault();
  const box = $('#checkResult');
  const raw = CK_IDS.map(id => $('#' + id).value.trim());
  const v = raw.map(Number);
  if (raw.some(x => x === '') || v.some(x => !Number.isFinite(x))) {
    box.innerHTML = `<div class="status bad"><b>ข้อมูลไม่ครบ</b><p>กรุณากรอกตัวเลขให้ครบทุกช่อง</p></div>`; return;
  }
  const dec = Math.min(6, Math.max(2, ...raw.map(x => (x.split('.')[1] || '').length)));
  const c1 = { o:v[0], h:v[1], l:v[2], c:v[3] }, c2 = { o:v[4], h:v[5], l:v[6], c:v[7] };
  const bad = [['C1', c1], ['C2', c2]].find(([, c]) => c.h < Math.max(c.o, c.c) || c.l > Math.min(c.o, c.c) || c.h <= c.l);
  if (bad) {
    box.innerHTML = `<div class="status bad"><b>ข้อมูล ${bad[0]} ไม่ถูกต้อง</b><p>High ต้องมากกว่าหรือเท่ากับ Open/Close, Low ต้องน้อยกว่าหรือเท่ากับ Open/Close และ High ต้องมากกว่า Low</p></div>`; return;
  }
  const r = analyzeCRT(c1, c2), f = x => fmt(x, dec), yn = b => b ? '<span class="pos">ใช่</span>' : '<span class="muted">ไม่</span>';
  const rrTxt = x => x > 0 ? `1 : ${x.toFixed(2)}` : '<span class="muted">ผ่านไปแล้ว</span>';
  let html = `<div class="status ${r.cls}"><b>${r.title}</b><p>${r.msg}</p></div>
    <table class="kv">
      <tr><td>กรอบ C1</td><td>${f(c1.l)} – ${f(c1.h)} (ขนาด ${f(r.R)})</td></tr>
      <tr><td>50% (Equilibrium)</td><td>${f(r.eq)}</td></tr>
      <tr><td>C2 กวาด High?</td><td>${yn(r.sweptH)}</td></tr>
      <tr><td>C2 กวาด Low?</td><td>${yn(r.sweptL)}</td></tr>
      <tr><td>C2 ปิดในกรอบ?</td><td>${yn(r.inside)}</td></tr>`;
  if (r.lv) html += `
      <tr><td>Entry (ราคาปิด C2)</td><td>${f(r.lv.entry)}</td></tr>
      <tr><td>Stop Loss (ปลายไส้ C2)</td><td class="neg">${f(r.lv.sl)}</td></tr>
      <tr><td>TP1 — 50%</td><td>${f(r.lv.tp1)} • RR ${rrTxt(r.lv.rr1)}</td></tr>
      <tr><td>TP2 — ${r.type === 'bull' ? 'High' : 'Low'} ของ C1</td><td class="pos">${f(r.lv.tp2)} • RR ${rrTxt(r.lv.rr2)}</td></tr>`;
  html += `</table>`;
  if (r.notes.length) html += `<div class="notes"><b>ข้อสังเกต:</b><ul>${r.notes.map(n => `<li>${n}</li>`).join('')}</ul></div>`;
  const candles = [{ ...c1, label:'C1' }, { ...c2, label:'C2' }, { o:0, h:0, l:0, c:0, label:'C3 ?', hidden:true }];
  html += renderChart(candles, buildAnn(r, c1, c2, 0, dec), { h:280, dec, title:'ผลการตรวจ CRT' });
  box.innerHTML = html;
}
function initChecker() {
  $('#checkerForm').addEventListener('submit', runChecker);
  $('#fillBull').onclick = () => setChecker([110, 112, 100, 103, 103, 105, 96, 102]);
  $('#fillBear').onclick = () => setChecker([102, 112, 100, 109, 109, 116, 107, 110]);
  runChecker();
}

/* ================= UI: PRACTICE SIMULATOR ================= */
const rnd = (a, b) => a + Math.random() * (b - a);
const r2 = x => Math.round(x * 100) / 100;
function genScenario() {
  const lo = rnd(100, 200), R = rnd(6, 14), hi = lo + R;
  const c1 = { o: lo + R * rnd(0.15, 0.85), h: hi, l: lo, c: lo + R * rnd(0.15, 0.85) };
  const ctx = []; let nextOpen = c1.o;
  for (let j = 0; j < 3; j++) {
    const c = nextOpen, o = c + rnd(-R * 0.5, R * 0.5);
    ctx.unshift({ o, c, h: Math.max(o, c) + rnd(0, R * 0.2), l: Math.min(o, c) - rnd(0, R * 0.2) });
    nextOpen = o;
  }
  const type = ['bull','bear','bull','bear','breakUp','breakDown','inside','outside'][Math.floor(Math.random() * 8)];
  const o = c1.c; let h, l, c;
  if (type === 'bull') { l = lo - R * rnd(0.08, 0.4); c = lo + R * rnd(0.08, 0.6); h = Math.min(Math.max(o, c) + R * rnd(0.02, 0.15), hi - R * 0.03); }
  if (type === 'bear') { h = hi + R * rnd(0.08, 0.4); c = hi - R * rnd(0.08, 0.6); l = Math.max(Math.min(o, c) - R * rnd(0.02, 0.15), lo + R * 0.03); }
  if (type === 'breakDown') { l = lo - R * rnd(0.25, 0.6); c = lo - R * rnd(0.04, 0.2); h = Math.min(o + R * rnd(0.02, 0.12), hi - R * 0.03); }
  if (type === 'breakUp') { h = hi + R * rnd(0.25, 0.6); c = hi + R * rnd(0.04, 0.2); l = Math.max(o - R * rnd(0.02, 0.12), lo + R * 0.03); }
  if (type === 'inside') {
    c = lo + R * rnd(0.25, 0.75);
    l = Math.min(lo + R * rnd(0.03, 0.12), Math.min(o, c) - R * 0.02);
    h = Math.max(hi - R * rnd(0.03, 0.12), Math.max(o, c) + R * 0.02);
  }
  if (type === 'outside') { h = hi + R * rnd(0.05, 0.3); l = lo - R * rnd(0.05, 0.3); c = lo + R * rnd(0.2, 0.8); }
  const round = x => ({ o: r2(x.o), h: r2(x.h), l: r2(x.l), c: r2(x.c) });
  const C1 = { ...round(c1), label:'C1' }, C2 = { ...round({ o, h, l, c }), label:'C2' };
  const candles = [...ctx.map(round), C1, C2, { o:0, h:0, l:0, c:0, label:'?', hidden:true }];
  return { candles, ci: 3, r: analyzeCRT(C1, C2) };
}
const sim = { score:0, total:0, streak:0, best: load('crt_sim_best', 0), cur:null, answered:false };
function drawSim(reveal) {
  const { candles, ci, r } = sim.cur, c1 = candles[ci], c2 = candles[ci + 1];
  const ann = reveal ? buildAnn(r, c1, c2, ci)
    : { lines: [{ y:c1.h, label:'C1 High', color:C.high, from:ci }, { y:c1.l, label:'C1 Low', color:C.low, from:ci }] };
  $('#simChart').innerHTML = renderChart(candles, ann, { h:300, title:'โจทย์ฝึก CRT' });
}
function updateScore() {
  $('#simScore').textContent = `${sim.score}/${sim.total}`;
  $('#simAcc').textContent = sim.total ? (sim.score / sim.total * 100).toFixed(0) + '%' : '–';
  $('#simStreak').textContent = sim.streak;
  $('#simBest').textContent = sim.best;
}
function newSim() {
  sim.cur = genScenario(); sim.answered = false; drawSim(false);
  $('#simFeedback').innerHTML = '<p class="muted">ดูแท่ง C2 เทียบกับกรอบของ C1 แล้วตัดสินใจ</p>';
  $$('.sim-btn').forEach(b => { b.disabled = false; b.classList.remove('correct', 'wrong'); });
  $('#simNext').hidden = true;
}
function answerSim(choice) {
  if (sim.answered) return;
  sim.answered = true;
  const r = sim.cur.r, ok = choice === r.answer;
  sim.total++; if (ok) { sim.score++; sim.streak++; } else sim.streak = 0;
  if (sim.streak > sim.best) { sim.best = sim.streak; save('crt_sim_best', sim.best); }
  $$('.sim-btn').forEach(b => {
    b.disabled = true;
    if (b.dataset.a === r.answer) b.classList.add('correct');
    else if (b.dataset.a === choice) b.classList.add('wrong');
  });
  const c1 = sim.cur.candles[sim.cur.ci], c2 = sim.cur.candles[sim.cur.ci + 1];
  $('#simFeedback').innerHTML = `<div class="status ${ok ? 'ok' : 'bad'}"><b>${ok ? 'ถูกต้อง!' : 'ยังไม่ถูก'} — ${r.title}</b><p>${r.msg}</p>
    <p class="small muted">C1: H ${fmt(c1.h)} / L ${fmt(c1.l)} • C2: H ${fmt(c2.h)} / L ${fmt(c2.l)} / Close ${fmt(c2.c)}</p></div>`;
  drawSim(true); updateScore(); $('#simNext').hidden = false;
}
function initSim() {
  $$('.sim-btn').forEach(b => b.addEventListener('click', () => answerSim(b.dataset.a)));
  $('#simNext').addEventListener('click', newSim);
  updateScore(); newSim();
}

/* ================= UI: CHECKLIST ================= */
const CHECK_ITEMS = [
  { t:'HTF Bias ชัดเจน (รู้ว่า Draw on Liquidity อยู่ฝั่งไหน)' },
  { t:'C1 อยู่ที่หรือใกล้ Key Level (FVG / OB / PDH / PDL)' },
  { t:'C2 กวาด High หรือ Low ของ C1 ชัดเจน', core:true },
  { t:'C2 ปิด (ราคาปิด) กลับเข้าในกรอบแล้ว', core:true },
  { t:'LTF มี MSS / CHoCH + FVG หรือ OB ยืนยัน' },
  { t:'อยู่ในช่วงเวลาสำคัญ (Killzone / แท่ง H4 สำคัญ)' },
  { t:'RR ถึงเป้าหมายหลัก ≥ 1 : 2' },
  { t:'ไม่มีข่าวแรงภายใน 30 นาที' },
  { t:'กำหนด Risk ต่อไม้ ≤ 1% ของพอร์ต' },
];
const CKEY = 'crt_checklist_v1';
let checks = load(CKEY, []);
function renderChecklist() {
  $('#checkList').innerHTML = CHECK_ITEMS.map((it, i) => `
    <label class="check-item"><input type="checkbox" data-i="${i}" ${checks.includes(i) ? 'checked' : ''}>
    <span>${it.t} ${it.core ? '<span class="tag bad">บังคับ</span>' : ''}</span></label>`).join('');
  const n = checks.length, coreOk = CHECK_ITEMS.every((it, i) => !it.core || checks.includes(i));
  let cls, title, msg;
  if (!coreOk) { cls = 'bad'; title = 'ยังไม่ใช่ CRT'; msg = 'ขาดเงื่อนไขบังคับ (Sweep + ปิดในกรอบ) ห้ามเข้าเทรด'; }
  else if (n >= 8) { cls = 'ok'; title = 'A Setup'; msg = 'เงื่อนไขครบเกือบทั้งหมด เข้าได้ตามแผนที่วางไว้'; }
  else if (n >= 6) { cls = 'warn'; title = 'B Setup'; msg = 'พอใช้ได้ ควรลดขนาด Position หรือรอการยืนยันเพิ่ม'; }
  else { cls = 'bad'; title = 'C Setup'; msg = 'เงื่อนไขไม่พอ ควรข้ามไม้นี้'; }
  $('#checkScore').innerHTML = `<h3 style="margin-top:0">ผลประเมิน: ${n}/${CHECK_ITEMS.length}</h3>
    <div class="bar" style="margin:10px 0 14px"><div style="width:${n / CHECK_ITEMS.length * 100}%"></div></div>
    <div class="status ${cls}"><b>${title}</b><p>${msg}</p></div>`;
}
function initChecklist() {
  $('#checkList').addEventListener('change', e => {
    const i = +e.target.dataset.i;
    checks = e.target.checked ? [...new Set([...checks, i])] : checks.filter(x => x !== i);
    save(CKEY, checks); renderChecklist();
  });
  $('#checkReset').onclick = () => { checks = []; save(CKEY, checks); renderChecklist(); };
  renderChecklist();
}

/* ================= UI: QUIZ ================= */
const QUIZ = [
  { q:'ใน Bullish CRT แท่ง C2 ต้องมีลักษณะอย่างไร?', o:['ปิดเหนือ High ของ C1','กวาดใต้ Low ของ C1 แล้วปิดกลับเข้ามาในกรอบ','เป็น Inside Bar อยู่ในกรอบ C1','กวาด Low แล้วปิดต่ำกว่า Low ของ C1'], a:1,
    why:'หัวใจของ CRT คือ “กวาดแล้วกลับ” (Sweep & Reclaim) ไส้ลงไปเก็บ Sell-side Liquidity แต่ราคาปิดกลับในกรอบ' },
  { q:'ถ้า C2 กวาด Low ของ C1 และ “ปิด” ต่ำกว่า Low ของ C1 หมายความว่าอะไร?', o:['Bullish CRT ที่แข็งแรงมาก','Bearish CRT','Breakout ลง — ไม่ใช่ CRT','Outside Bar'], a:2,
    why:'การปิดนอกกรอบคือ Acceptance ตลาดยอมรับราคาใหม่ ไม่ใช่การหลอก จึงไม่ใช่ Setup CRT' },
  { q:'เป้าหมายหลักของ Bullish CRT อยู่ที่ใด?', o:['High ของ C1','Low ของ C2','ราคาเปิดของ C2','High ของ C2'], a:0,
    why:'“กวาดฝั่งไหน วิ่งไปอีกฝั่ง” เมื่อกวาด Low เป้าหมายจึงเป็น High ของกรอบ C1 (Buy-side Liquidity)' },
  { q:'ตำแหน่ง Stop Loss ที่นิยมใน CRT คือ?', o:['ที่ 50% ของ C1','กลางเนื้อเทียน C2','เลยปลายไส้ของ C2 (จุด Sweep) ออกไปเล็กน้อย','ที่ High ของ C1'], a:2,
    why:'ถ้าราคากลับไปทำลายจุด Sweep แปลว่า Manipulation ล้มเหลว Setup จึงใช้ไม่ได้' },
  { q:'ถ้าใช้ CRT บน H4 ควรหาจุดเข้าใน Timeframe ใด?', o:['Daily','M15 / M5','Weekly','H4 เท่านั้น'], a:1,
    why:'H4 → M15/M5 เป็นคู่ที่นิยมที่สุด เพราะ LTF ช่วยให้ SL แคบลงและ RR ดีขึ้น' },
  { q:'ทำไมต้องรอให้ C2 ปิดก่อนตัดสินว่าเป็น CRT?', o:['เพราะโบรกเกอร์บังคับ','เพราะระหว่างแท่งยังไม่รู้ว่าจะปิดในกรอบหรือนอกกรอบ','เพราะ Spread กว้าง','ไม่จำเป็นต้องรอ'], a:1,
    why:'แท่งที่ดูเหมือนกวาดแล้วกลับ อาจปิดนอกกรอบกลายเป็น Breakout ได้ในนาทีสุดท้าย' },
  { q:'CRT เชื่อมโยงกับ Power of 3 (AMD) อย่างไร?', o:['C1 = Distribution, C2 = Accumulation','C1 = Accumulation, ไส้ C2 = Manipulation, C3 = Distribution','ไม่เกี่ยวข้องกัน','C3 = Manipulation'], a:1,
    why:'C1 สร้างกรอบ (สะสม) ไส้ C2 หลอกกวาดสภาพคล่อง และ C3 คือการเคลื่อนที่จริง' },
  { q:'CRT แบบใดถือว่ามีคุณภาพสูงกว่า?', o:['เกิดกลางกรอบ ไม่มี Key Level','สวนทาง HTF Bias','เกิดที่ HTF Key Level และสอดคล้องกับ Bias','เกิดช่วงข่าวแรง'], a:2,
    why:'ตำแหน่ง (Key Level) และทิศทาง (Bias) คือตัวกรองสัญญาณหลอกที่ดีที่สุด' },
  { q:'ถ้า C2 เป็น Inside Bar ควรทำอย่างไร?', o:['เข้า Buy ทันที','เข้า Sell ทันที','ยังไม่มี Setup — รอแท่งถัดไป หรือใช้กรอบหลายแท่ง','ถือว่าเป็น CRT ทั้งสองฝั่ง'], a:2,
    why:'ไม่มี Sweep ก็ไม่มี Manipulation จึงยังไม่ใช่ CRT' },
  { q:'จุดปิดกำไรบางส่วน (TP1) ที่นิยมคือ?', o:['50% (Equilibrium) ของ C1','Low ของ C1','High ของ C2','ราคาเปิด C1'], a:0,
    why:'50% ของกรอบเป็นจุดสมดุล นิยมใช้ปิดบางส่วนหรือเลื่อน SL มาที่ทุน' },
  { q:'ระบบที่มี Win rate 40% กำไรเฉลี่ย 2.5R ขาดทุนเฉลี่ย 1R มี Expectancy เท่าใด?', o:['-0.1R','+0.4R','+0.6R','+1.0R'], a:1,
    why:'0.4 × 2.5 − 0.6 × 1 = 1.0 − 0.6 = +0.4R ต่อเทรด แม้ Win rate ต่ำกว่า 50% ก็ยังมีกำไรได้' },
];
const quizState = { answered:0, correct:0 };
function renderQuizResult() {
  const { answered, correct } = quizState;
  $('#quizResult').innerHTML = `<b>ผลคะแนน: ${correct}/${QUIZ.length}</b> <span class="muted">(ตอบแล้ว ${answered} ข้อ)</span>
    ${answered === QUIZ.length ? `<p style="margin-top:8px">${correct >= 9 ? 'ยอดเยี่ยม! พร้อมไปฝึกกับกราฟจริงแล้ว' : correct >= 6 ? 'ดีมาก ลองทบทวนบทเรียนที่ยังพลาดอีกครั้ง' : 'แนะนำให้ทบทวนบทเรียนตั้งแต่ต้นอีกรอบ'}</p>` : ''}
    <div style="margin-top:10px"><button class="btn ghost sm" id="quizReset">ทำใหม่</button></div>`;
  $('#quizReset').onclick = initQuiz;
}
function initQuiz() {
  quizState.answered = 0; quizState.correct = 0;
  const box = $('#quizBox');
  box.innerHTML = QUIZ.map((q, qi) => `<div class="card quiz-q" data-q="${qi}">
    <p><b>${qi + 1}.</b> ${q.q}</p>
    <div class="opts">${q.o.map((o, oi) => `<button class="opt" data-o="${oi}">${o}</button>`).join('')}</div>
    <div class="why" hidden></div></div>`).join('');
  box.onclick = e => {
    const b = e.target.closest('.opt'); if (!b) return;
    const card = b.closest('.quiz-q'); if (card.dataset.done) return;
    card.dataset.done = '1';
    const q = QUIZ[+card.dataset.q], oi = +b.dataset.o, ok = oi === q.a;
    quizState.answered++; if (ok) quizState.correct++;
    $$('.opt', card).forEach((x, i) => { if (i === q.a) x.classList.add('correct'); else if (i === oi) x.classList.add('wrong'); });
    const why = $('.why', card); why.hidden = false;
    why.innerHTML = `${ok ? '<b class="pos">ถูกต้อง</b>' : '<b class="neg">ยังไม่ถูก</b>'} — ${q.why}`;
    renderQuizResult();
  };
  renderQuizResult();
}

/* ================= UI: JOURNAL ================= */
const JKEY = 'crt_journal_v1';
let journal = load(JKEY, []);
function journalStats(list) {
  const n = list.length; if (!n) return null;
  const rs = list.map(t => t.r), wins = rs.filter(r => r > 0), losses = rs.filter(r => r < 0);
  const sum = rs.reduce((a, b) => a + b, 0), sw = wins.reduce((a, b) => a + b, 0), sl = Math.abs(losses.reduce((a, b) => a + b, 0));
  let eq = 0, peak = 0, dd = 0;
  [...list].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).forEach(t => { eq += t.r; peak = Math.max(peak, eq); dd = Math.max(dd, peak - eq); });
  return { n, wr: wins.length / n * 100, exp: sum / n, total: sum, avgW: wins.length ? sw / wins.length : 0,
    avgL: losses.length ? sl / losses.length : 0, pf: sl ? sw / sl : (sw ? Infinity : 0), dd };
}
const sign = x => (x > 0 ? '+' : '') + x.toFixed(2);
function renderJournal() {
  const st = journalStats(journal);
  if (!st) {
    $('#journalStats').innerHTML = '';
    $('#journalTable').innerHTML = '<p class="muted">ยังไม่มีข้อมูล ลองบันทึกผล Backtest เทรดแรกของคุณ</p>'; return;
  }
  const cls = x => x > 0 ? 'pos' : x < 0 ? 'neg' : '';
  const byGrade = ['A','B','C'].map(g => ({ g, s: journalStats(journal.filter(t => t.grade === g)) })).filter(x => x.s);
  $('#journalStats').innerHTML = `<div class="stat-grid">
    <div class="stat"><span>จำนวนเทรด</span><b>${st.n}</b></div>
    <div class="stat"><span>Win rate</span><b>${st.wr.toFixed(1)}%</b></div>
    <div class="stat"><span>Expectancy / เทรด</span><b class="${cls(st.exp)}">${sign(st.exp)}R</b></div>
    <div class="stat"><span>ผลรวม</span><b class="${cls(st.total)}">${sign(st.total)}R</b></div>
    <div class="stat"><span>กำไรเฉลี่ย</span><b class="pos">${st.avgW.toFixed(2)}R</b></div>
    <div class="stat"><span>ขาดทุนเฉลี่ย</span><b class="neg">${st.avgL.toFixed(2)}R</b></div>
    <div class="stat"><span>Profit Factor</span><b>${st.pf === Infinity ? '∞' : st.pf.toFixed(2)}</b></div>
    <div class="stat"><span>Max Drawdown</span><b class="neg">${st.dd.toFixed(2)}R</b></div></div>
    <div class="card table-wrap" style="margin-bottom:16px"><b>แยกตามเกรด Setup</b>
    <table><tr><th>เกรด</th><th>จำนวน</th><th>Win rate</th><th>Expectancy</th><th>ผลรวม</th></tr>
    ${byGrade.map(({ g, s }) => `<tr><td>${g}</td><td>${s.n}</td><td>${s.wr.toFixed(1)}%</td><td class="${cls(s.exp)}">${sign(s.exp)}R</td><td class="${cls(s.total)}">${sign(s.total)}R</td></tr>`).join('')}
    </table>${st.n < 30 ? '<p class="small muted">* ตัวอย่างยังน้อย (ต่ำกว่า 30 เทรด) ผลสถิติอาจยังไม่น่าเชื่อถือ</p>' : ''}</div>`;
  const rows = [...journal].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  $('#journalTable').innerHTML = `<table><tr><th>วันที่</th><th>สินทรัพย์</th><th>TF</th><th>ทิศทาง</th><th>เกรด</th><th>ผล (R)</th><th>หมายเหตุ</th><th></th></tr>
    ${rows.map(t => `<tr><td>${esc(t.date)}</td><td>${esc(t.pair)}</td><td>${esc(t.tf)}</td><td>${esc(t.dir)}</td><td>${esc(t.grade)}</td>
      <td class="${cls(t.r)}">${sign(t.r)}</td><td>${esc(t.note)}</td><td><button class="icon-btn" data-del="${t.id}" title="ลบ">✕</button></td></tr>`).join('')}</table>`;
}
function initJournal() {
  $('#jDate').value = new Date().toISOString().slice(0, 10);
  $('#journalForm').addEventListener('submit', e => {
    e.preventDefault();
    const r = Number($('#jR').value);
    if (!$('#jPair').value.trim() || !Number.isFinite(r) || $('#jR').value === '') return;
    journal.push({ id: Date.now(), date: $('#jDate').value, pair: $('#jPair').value.trim().toUpperCase(), tf: $('#jTf').value,
      dir: $('#jDir').value, grade: $('#jGrade').value, r, note: $('#jNote').value.trim() });
    save(JKEY, journal); renderJournal();
    $('#jR').value = ''; $('#jNote').value = '';
  });
  $('#journalTable').addEventListener('click', e => {
    const b = e.target.closest('[data-del]'); if (!b) return;
    journal = journal.filter(t => t.id !== +b.dataset.del); save(JKEY, journal); renderJournal();
  });
  $('#jClear').onclick = () => { if (journal.length && confirm('ลบบันทึกทั้งหมดใช่หรือไม่?')) { journal = []; save(JKEY, journal); renderJournal(); } };
  $('#jExport').onclick = () => {
    if (!journal.length) return alert('ยังไม่มีข้อมูล');
    const q = v => `"${String(v).replace(/"/g, '""')}"`;
    const csv = ['date,pair,timeframe,direction,grade,result_r,note', ...journal.map(t => [t.date, t.pair, t.tf, t.dir, t.grade, t.r, t.note].map(q).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'crt-journal.csv'; a.click(); URL.revokeObjectURL(a.href);
  };
  renderJournal();
}

/* ================= GLOSSARY ================= */
const GLOSSARY = [
  ['Range / กรอบราคา', 'ช่วงระหว่าง High และ Low ของแท่งเทียน (หรือกลุ่มแท่ง)'],
  ['Equilibrium (50%)', 'จุดกึ่งกลางของกรอบ ใช้แบ่ง Premium (ครึ่งบน) และ Discount (ครึ่งล่าง)'],
  ['Liquidity (BSL / SSL)', 'กลุ่มคำสั่งที่รออยู่เหนือ High (Buy-side) และใต้ Low (Sell-side)'],
  ['Sweep / Raid', 'ราคาทะลุ High หรือ Low เพื่อเก็บสภาพคล่อง แล้วกลับตัว'],
  ['Turtle Soup', 'ชื่อเรียก Setup แบบ False Breakout คือกวาดจุดสูงหรือต่ำเดิมแล้วกลับเข้ากรอบ'],
  ['MSS / CHoCH', 'Market Structure Shift — ราคาทำลาย Swing ล่าสุดในทิศตรงข้าม เป็นสัญญาณแรกของการกลับตัว'],
  ['Displacement', 'แท่งเทียนที่วิ่งแรงและเร็ว มักทิ้ง FVG ไว้'],
  ['FVG (Fair Value Gap)', 'ช่องว่างระหว่างไส้แท่งที่ 1 กับแท่งที่ 3 ในชุดสามแท่ง ราคามักกลับมาเติม'],
  ['Order Block', 'แท่งตรงข้ามแท่งสุดท้ายก่อนเกิด Displacement'],
  ['PD Array', 'กลุ่ม Key Level สาย ICT เช่น FVG, OB, PDH/PDL'],
  ['Killzone', 'ช่วงเวลาที่มีสภาพคล่องและความผันผวนสูง เช่น London และ New York Open'],
  ['HTF / LTF', 'Higher / Lower Timeframe ใช้ TF ใหญ่หา Setup และ TF เล็กหาจุดเข้า'],
  ['Draw on Liquidity', 'เป้าหมายสภาพคล่องที่ราคามีแนวโน้มจะวิ่งไปหา'],
  ['R (Risk Unit)', 'หน่วยวัดผลเทียบกับความเสี่ยง 1R = ขาดทุนเต็ม SL หนึ่งครั้ง'],
  ['Expectancy', 'ผลตอบแทนเฉลี่ยต่อเทรด (R) เป็นตัววัดว่าระบบมีความได้เปรียบหรือไม่'],
  ['Profit Factor', 'กำไรรวม ÷ ขาดทุนรวม ถ้ามากกว่า 1 แปลว่าระบบมีกำไร'],
];

/* ================= INIT ================= */
document.addEventListener('DOMContentLoaded', () => {
  $('#heroChart').innerHTML = patternChart('bull', 300);
  $('#entryChart').innerHTML = renderChart(LTF, LTF_ANN, { h:340, title:'โมเดลเข้าเทรดบน M15' });
  $('#glossBox').innerHTML = GLOSSARY.map(([t, d]) => `<div><b>${t}</b>${d}</div>`).join('');
  initLessons(); initPatterns(); initChecker(); initSim(); initChecklist(); initQuiz(); initJournal();

  $('#menuBtn').addEventListener('click', () => $('#navLinks').classList.toggle('open'));
  $$('#navLinks a').forEach(a => a.addEventListener('click', () => $('#navLinks').classList.remove('open')));
  addEventListener('scroll', () => {
    const h = document.documentElement;
    $('#readProgress').style.width = (h.scrollTop / (h.scrollHeight - h.clientHeight) * 100) + '%';
  }, { passive: true });
});
