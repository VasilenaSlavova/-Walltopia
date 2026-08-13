const nodemailer = require("nodemailer");

const esc = (value) => String(value == null ? "" : value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

function config() {
  return {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: process.env.ENGINEERING_SUPPORT_EMAIL,
  };
}

function renderInquiryEmail({ reference, projectName, message, createdAt }) {
  const rows = String(message || "").split(/\r?\n/);
  const divider = rows.indexOf("");
  const summary = (divider === -1 ? rows : rows.slice(0, divider))
    .filter(Boolean)
    .map((line) => {
      const split = line.indexOf(":");
      const label = split > -1 ? line.slice(0, split) : "Information";
      const value = split > -1 ? line.slice(split + 1).trim() : line;
      return `<tr><td style="padding:9px 12px;border-bottom:1px solid #e0e2e8;color:#73798a;font-size:12px;width:34%">${esc(label)}</td><td style="padding:9px 12px;border-bottom:1px solid #e0e2e8;color:#161927;font-size:13px;font-weight:600">${esc(value)}</td></tr>`;
    }).join("");
  const question = divider === -1 ? "" : rows.slice(divider + 1).join("\n").trim();

  return `<!doctype html>
<html><body style="margin:0;background:#f1f2f5;font-family:Arial,Helvetica,sans-serif;color:#161927">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f2f5;padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;background:#fff;border-top:4px solid #f41f2b">
        <tr><td style="padding:26px 30px 16px">
          <div style="font-size:11px;font-weight:700;letter-spacing:.8px;color:#f41f2b;text-transform:uppercase">Engineering Support inquiry</div>
          <h1 style="margin:7px 0 6px;font-size:24px;line-height:1.2;color:#161927">${esc(projectName)}</h1>
          <div style="font-size:12px;color:#858b9b">Reference ${esc(reference)} · ${esc(new Date(createdAt).toLocaleString("en-GB"))}</div>
        </td></tr>
        <tr><td style="padding:0 30px 22px">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e0e2e8">${summary}</table>
        </td></tr>
        <tr><td style="padding:0 30px 26px">
          <div style="font-size:11px;font-weight:700;letter-spacing:.6px;color:#f41f2b;text-transform:uppercase;margin-bottom:8px">Technical question</div>
          <div style="padding:16px 18px;background:#f6f7f9;border-left:3px solid #202333;font-size:14px;line-height:1.6;white-space:pre-wrap">${esc(question || "No additional message.")}</div>
        </td></tr>
        <tr><td style="padding:18px 30px;background:#202333;color:#b9bdc8;font-size:11px;line-height:1.5">
          Sent from Walltopia Preliminary Loads · Reply directly to the customer using the Reply-To address.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function sendInquiryEmail(data) {
  const cfg = config();
  const contactMatch = String(data.message || "").match(/Contact:.*<([^>]+)>/i);
  const contactNameMatch = String(data.message || "").match(/Contact:\s*([^<\r\n]+)/i);
  const contactName = data.contactName || (contactNameMatch ? contactNameMatch[1].trim() : "Walltopia customer");
  const replyTo = data.replyTo || (contactMatch ? contactMatch[1] : undefined);
  const subject = `[TEST] Engineering Support · ${data.projectName} · ${data.reference}`;
  const html = renderInquiryEmail(data);

  if (process.env.RESEND_API_KEY) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `engineering-inquiry-${data.reference}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "Walltopia Engineering Support <onboarding@resend.dev>",
        to: [process.env.ENGINEERING_SUPPORT_EMAIL],
        reply_to: replyTo,
        subject,
        html,
        text: data.message,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || `Resend returned ${response.status}`);
    return { status: "sent", provider: "resend", messageId: result.id };
  }

  if (!cfg.host || !cfg.from || !cfg.to) return { status: "not_configured" };

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user && cfg.pass ? { user: cfg.user, pass: cfg.pass } : undefined,
  });
  const info = await transporter.sendMail({
    from: { name: `${contactName} via Walltopia`, address: cfg.from },
    to: cfg.to,
    replyTo,
    subject,
    text: data.message,
    html,
  });
  return { status: "sent", provider: "smtp", messageId: info.messageId };
}

module.exports = { sendInquiryEmail, renderInquiryEmail };
