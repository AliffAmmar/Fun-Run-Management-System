// Email contents. Each function returns { subject, text, html, attachments } for sendEmail().
const QRCode = require('qrcode');
const { appUrl, escapeHtml } = require('./email');
const { SHIRT_TYPE_LABEL } = require('./shirts');

const shirtText = (p) => [SHIRT_TYPE_LABEL[p.shirt_type], p.shirt_size].filter(Boolean).join(' ');

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const layout = (title, bodyHtml) => `<!doctype html>
<html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:#c2410c;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0">
      <div style="font-size:13px;letter-spacing:1px;text-transform:uppercase;opacity:.85">Run4Fun</div>
      <div style="font-size:22px;font-weight:bold;margin-top:4px">${title}</div>
    </div>
    <div style="background:#fff;padding:24px;border-radius:0 0 12px 12px">${bodyHtml}</div>
    <p style="font-size:12px;color:#64748b;text-align:center;margin-top:16px">
      You received this because of a registration on Run4Fun.
    </p>
  </div>
</body></html>`;

// Sent to the buyer when an order is paid (from fulfilOrder). Includes the order QR as an image:
// it encodes only the check-in link, never personal data.
async function orderConfirmationEmail({ order, event, buyer, participants }) {
  const checkinLink = `${appUrl()}/checkin/${order.order_no}`;
  const ticketsLink = `${appUrl()}/my-tickets?order=${encodeURIComponent(order.order_no)}`;
  const qrPng = await QRCode.toBuffer(checkinLink, { width: 360, margin: 2 });
  const isGroup = order.type === 'group';
  const bibs = participants.map((p) => p.bib_number).filter(Boolean).sort();
  const bibRange = bibs.length > 1 ? `${bibs[0]}–${bibs[bibs.length - 1]}` : bibs[0] || '';

  const subject = `Registration confirmed: ${event.event_name} (${order.order_no})`;

  const runnersText = participants.map((p) => `  ${p.bib_number || '----'}  ${p.name} (${shirtText(p)})`).join('\n');
  const text = [
    `Hi ${buyer.name},`,
    '',
    `Your registration for ${event.event_name} is confirmed.`,
    '',
    `Order: ${order.order_no}`,
    isGroup ? `Group: ${order.group_name} (${order.participant_count} runners)` : null,
    `Category: ${order.race_category}`,
    `Date: ${fmtDate(event.date)}`,
    `Location: ${event.location}`,
    `Amount paid: RM ${Number(order.total_amount).toFixed(2)}`,
    '',
    isGroup ? `Bib numbers (${bibRange}):` : 'Bib number:',
    runnersText,
    '',
    isGroup
      ? 'Kit collection: one QR code covers the whole group. Show it at the kit counter with your IC. You can collect for everyone, or runners can collect separately with the same QR (staff tick each runner).'
      : 'Kit collection: show the QR code in this email or in My Tickets, and bring your IC.',
    `My Tickets: ${ticketsLink}`,
  ]
    .filter((line) => line !== null)
    .join('\n');

  const row = (k, v) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#64748b">${k}</td><td style="padding:4px 0;font-weight:bold">${v}</td></tr>`;
  const html = layout(
    'Registration confirmed',
    `<p>Hi ${escapeHtml(buyer.name)},</p>
     <p>Your registration for <b>${escapeHtml(event.event_name)}</b> is confirmed.</p>
     <table style="border-collapse:collapse;margin:12px 0">
       ${row('Order', escapeHtml(order.order_no))}
       ${isGroup ? row('Group', `${escapeHtml(order.group_name)} (${order.participant_count} runners)`) : ''}
       ${row('Category', escapeHtml(order.race_category))}
       ${row('Date', escapeHtml(fmtDate(event.date)))}
       ${row('Location', escapeHtml(event.location))}
       ${row('Amount paid', `RM ${Number(order.total_amount).toFixed(2)}`)}
     </table>
     <div style="text-align:center;margin:20px 0">
       <img src="cid:order-qr" alt="QR code for ${escapeHtml(order.order_no)}" width="220" height="220" style="border:1px solid #e2e8f0;border-radius:8px">
       <div style="font-family:monospace;font-size:20px;font-weight:bold;margin-top:8px">${escapeHtml(order.order_no)}</div>
       <div style="font-size:13px;color:#475569;margin-top:4px">
         ${isGroup ? 'One QR for the whole group. Show it at the kit counter with your IC. You can collect for everyone, or runners can come separately with the same QR.' : 'Show this at kit collection and bring your IC.'}
       </div>
     </div>
     <p style="font-weight:bold;margin-bottom:4px">${isGroup ? `Bib numbers (${escapeHtml(bibRange)})` : 'Bib number'}</p>
     <table style="border-collapse:collapse;width:100%;font-size:14px">
       ${participants
         .map(
           (p) =>
             `<tr><td style="padding:3px 8px 3px 0;font-family:monospace;font-weight:bold;color:#c2410c">${escapeHtml(p.bib_number || '')}</td><td style="padding:3px 0">${escapeHtml(p.name)}</td><td style="padding:3px 0;color:#64748b">${escapeHtml(shirtText(p))}</td></tr>`
         )
         .join('')}
     </table>
     <p style="margin-top:24px"><a href="${ticketsLink}" style="background:#ea580c;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Open My Tickets</a></p>`
  );

  return {
    subject,
    text,
    html,
    attachments: [{ filename: `${order.order_no}-qr.png`, content: qrPng, cid: 'order-qr' }],
  };
}

// Password reset (UC3). The link is valid for 30 minutes and can be used once.
function passwordResetEmail({ user, token, minutes }) {
  const link = `${appUrl()}/reset-password/${token}`;
  const subject = 'Reset your Run4Fun password';
  const text = [
    `Hi ${user.name},`,
    '',
    'Someone (hopefully you) asked to reset your Run4Fun password.',
    `Open this link within ${minutes} minutes to choose a new password:`,
    link,
    '',
    "If you didn't ask for this, ignore this email. Your password stays the same.",
  ].join('\n');
  const html = layout(
    'Reset your password',
    `<p>Hi ${escapeHtml(user.name)},</p>
     <p>Someone (hopefully you) asked to reset your Run4Fun password. This link works for ${minutes} minutes and can be used once.</p>
     <p style="margin:24px 0"><a href="${link}" style="background:#ea580c;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Choose a new password</a></p>
     <p style="font-size:13px;color:#64748b">If the button doesn't work, copy this link:<br>${escapeHtml(link)}</p>
     <p style="font-size:13px;color:#64748b">If you didn't ask for this, ignore this email. Your password stays the same.</p>`
  );
  return { subject, text, html, attachments: [] };
}

// A participant's own certificate (PDF attached).
function certificateEmail({ participant, event, certificateNo, pdf }) {
  const subject = `Your certificate: ${event.event_name}`;
  const text = [
    `Hi ${participant.name},`,
    '',
    `Thank you for taking part in ${event.event_name}! Your certificate of participation is attached.`,
    '',
    `Certificate no.: ${certificateNo}`,
    `Anyone can check it is genuine at ${appUrl()}/verify/${certificateNo}`,
  ].join('\n');
  const html = layout(
    'Your certificate',
    `<p>Hi ${escapeHtml(participant.name)},</p>
     <p>Thank you for taking part in <b>${escapeHtml(event.event_name)}</b>! Your certificate of participation is attached.</p>
     <p style="font-size:13px;color:#64748b">Certificate no. <b>${escapeHtml(certificateNo)}</b>. Anyone can check it is genuine at
     <a href="${appUrl()}/verify/${encodeURIComponent(certificateNo)}">${appUrl()}/verify/${escapeHtml(certificateNo)}</a>.</p>`
  );
  return { subject, text, html, attachments: [{ filename: `${certificateNo}.pdf`, content: pdf, contentType: 'application/pdf' }] };
}

// One notice per order to the buyer, for members who have no email address.
function certificatesReadyEmail({ buyer, order, event, count }) {
  const link = `${appUrl()}/my-tickets?order=${encodeURIComponent(order.order_no)}`;
  const who = order.type === 'group' ? `${count} member(s) of ${order.group_name}` : 'your registration';
  const subject = `Certificates ready: ${event.event_name}`;
  const text = [
    `Hi ${buyer.name},`,
    '',
    `Certificates for ${who} (${order.order_no}) are ready.`,
    'They have no email address on file, so please download them from My Tickets and pass them on:',
    link,
  ].join('\n');
  const html = layout(
    'Certificates ready',
    `<p>Hi ${escapeHtml(buyer.name)},</p>
     <p>Certificates for ${escapeHtml(who)} (<b>${escapeHtml(order.order_no)}</b>) from <b>${escapeHtml(event.event_name)}</b> are ready.</p>
     <p>They have no email address on file, so please download them from My Tickets and pass them on.</p>
     <p style="margin-top:24px"><a href="${link}" style="background:#ea580c;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Open My Tickets</a></p>`
  );
  return { subject, text, html, attachments: [] };
}

// Sent when an admin changes someone's role.
function roleChangedEmail({ user, role }) {
  const organizer = role === 'organizer';
  const subject = organizer ? 'You can now organise events on Run4Fun' : 'Your Run4Fun account was changed to participant';
  const lines = organizer
    ? ['An admin has made your account an organizer.', `You can now create and manage events: ${appUrl()}/manage-events`]
    : ['An admin has changed your account to a participant. You can still register for events.'];
  const text = [`Hi ${user.name},`, '', ...lines].join('\n');
  const html = layout(
    organizer ? "You're now an organizer" : 'Account updated',
    `<p>Hi ${escapeHtml(user.name)},</p>${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('')}`
  );
  return { subject, text, html, attachments: [] };
}

// To each admin when someone asks for organizer access.
function organizerRequestEmail({ admin, user, organization, note }) {
  const link = `${appUrl()}/admin/users?tab=requests`;
  const subject = `Organizer request: ${user.name} (${organization})`;
  const text = [
    `Hi ${admin.name},`,
    '',
    `${user.name} (${user.email}) asked to become an organizer.`,
    `Organisation: ${organization}`,
    note ? `Note: ${note}` : null,
    '',
    `Review it: ${link}`,
  ]
    .filter((l) => l !== null)
    .join('\n');
  const html = layout(
    'New organizer request',
    `<p><b>${escapeHtml(user.name)}</b> (${escapeHtml(user.email)}) asked to become an organizer.</p>
     <p>Organisation: <b>${escapeHtml(organization)}</b>${note ? `<br>Note: ${escapeHtml(note)}` : ''}</p>
     <p style="margin-top:24px"><a href="${link}" style="background:#ea580c;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Review request</a></p>`
  );
  return { subject, text, html, attachments: [] };
}

// To the user when their organizer request is declined.
function organizerRequestDeclinedEmail({ user, organization, reason }) {
  const subject = 'Your Run4Fun organizer request';
  const lines = [
    `Your request for organizer access (${organization}) was declined.`,
    reason ? `Reason: ${reason}` : null,
    'You can send a new request from your Profile.',
  ].filter(Boolean);
  const text = [`Hi ${user.name},`, '', ...lines].join('\n');
  const html = layout(
    'Organizer request declined',
    `<p>Hi ${escapeHtml(user.name)},</p>${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('')}`
  );
  return { subject, text, html, attachments: [] };
}

module.exports = {
  orderConfirmationEmail,
  passwordResetEmail,
  certificateEmail,
  certificatesReadyEmail,
  roleChangedEmail,
  organizerRequestEmail,
  organizerRequestDeclinedEmail,
};
