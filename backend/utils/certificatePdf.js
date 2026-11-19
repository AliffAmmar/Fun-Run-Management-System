// Certificate PDF (A4 landscape) with pdfkit. Generated on demand, never stored.
//
// Fixed layout: name centred, event, category, date, certificate number and a verification QR.
// Optional organizer background image fills the page; text colour is 'dark' or 'light'.
// Without a background, a built-in design is drawn (light page for dark text, dark page for light).
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { appUrl } = require('./email');

const W = 841.89; // A4 landscape, points
const H = 595.28;
const ORANGE = '#ea580c';

const verifyUrl = (certificateNo) => `${appUrl()}/verify/${encodeURIComponent(certificateNo)}`;

const fmtDate = (d) => new Date(d).toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' });

// Largest font size (≤ max) at which `text` fits in `width`.
function fitFontSize(doc, text, font, max, min, width) {
  doc.font(font);
  for (let size = max; size > min; size -= 1) {
    if (doc.fontSize(size).widthOfString(text) <= width) return size;
  }
  return min;
}

// data: { name, event_name, event_date, location, race_category, bib_number, certificate_no }
// design: { textColor: 'dark'|'light', background?: { data: Buffer },
//           sponsors?: [{ name, type, data }]  (logos; PNG/JPEG only, up to 6 shown) }
async function renderCertificatePdf(data, design = {}) {
  const light = design.textColor === 'light';
  const ink = light ? '#ffffff' : '#0f172a';
  const soft = light ? '#e2e8f0' : '#475569';
  const qrPng = await QRCode.toBuffer(verifyUrl(data.certificate_no), {
    width: 300,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
  });

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0, info: { Title: `Certificate ${data.certificate_no}` } });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  // ---- Background ----
  if (design.background?.data) {
    doc.image(design.background.data, 0, 0, { width: W, height: H });
  } else {
    doc.rect(0, 0, W, H).fill(light ? '#0f172a' : '#fffaf5');
    doc.lineWidth(6).rect(24, 24, W - 48, H - 48).stroke(ORANGE);
    doc.lineWidth(1.5).rect(36, 36, W - 72, H - 72).stroke(light ? '#fdba74' : '#fdba74');
  }

  const center = (text, y, font, size, color, opts = {}) => {
    doc.font(font).fontSize(size).fillColor(color).text(text, 60, y, { width: W - 120, align: 'center', ...opts });
  };

  // ---- Text ----
  center('RUN4FUN', 70, 'Helvetica-Bold', 14, design.background ? ink : ORANGE, { characterSpacing: 4 });
  center('CERTIFICATE OF PARTICIPATION', 100, 'Helvetica-Bold', 30, ink, { characterSpacing: 2 });
  center('This certifies that', 170, 'Helvetica', 16, soft);

  const nameSize = fitFontSize(doc, data.name, 'Helvetica-Bold', 44, 20, W - 160);
  center(data.name, 205 + (44 - nameSize) / 2, 'Helvetica-Bold', nameSize, ink);
  doc.moveTo(W / 2 - 220, 265).lineTo(W / 2 + 220, 265).lineWidth(1).stroke(design.background ? ink : ORANGE);

  center(`took part in the ${data.race_category} run of`, 285, 'Helvetica', 16, soft);
  const eventSize = fitFontSize(doc, data.event_name, 'Helvetica-Bold', 26, 14, W - 160);
  center(data.event_name, 312, 'Helvetica-Bold', eventSize, ink);
  center(
    [fmtDate(data.event_date), data.location].filter(Boolean).join('  ·  '),
    352,
    'Helvetica',
    14,
    soft
  );
  if (data.bib_number) center(`Bib ${data.bib_number}`, 376, 'Helvetica', 12, soft);

  // ---- Sponsors: "Supported by" + logos on white tiles, centred above the footer ----
  const logos = (design.sponsors || []).filter((s) => ['image/png', 'image/jpeg'].includes(s.type)).slice(0, 6);
  if (logos.length) {
    const tileW = 78;
    const tileH = 40;
    const gap = 10;
    const rowW = logos.length * tileW + (logos.length - 1) * gap;
    let x = (W - rowW) / 2;
    const y = 418;
    center('Supported by', 400, 'Helvetica', 9, soft);
    for (const s of logos) {
      doc.save().roundedRect(x, y, tileW, tileH, 4).fill('#ffffff').restore();
      try {
        doc.image(s.data, x + 4, y + 4, { fit: [tileW - 8, tileH - 8], align: 'center', valign: 'center' });
      } catch (err) {
        // unreadable logo: show the name instead
        doc.font('Helvetica').fontSize(8).fillColor('#0f172a').text(s.name, x + 4, y + 14, { width: tileW - 8, align: 'center' });
      }
      x += tileW + gap;
    }
  }

  // ---- Footer: certificate number (left), verification QR (right) ----
  const qrSize = 96;
  const footerY = H - 60 - qrSize;
  doc.image(qrPng, W - 70 - qrSize, footerY, { width: qrSize, height: qrSize });
  doc.font('Helvetica').fontSize(9).fillColor(soft).text('Scan to verify', W - 70 - qrSize, footerY + qrSize + 4, { width: qrSize, align: 'center' });

  doc.font('Helvetica-Bold').fontSize(12).fillColor(ink).text(`Certificate no. ${data.certificate_no}`, 70, footerY + 50);
  doc.font('Helvetica').fontSize(9).fillColor(soft).text(`Verify at ${verifyUrl(data.certificate_no)}`, 70, footerY + 68, { width: 420 });

  doc.end();
  return done;
}

module.exports = { renderCertificatePdf, verifyUrl };
