import nodemailer from "nodemailer";

export function createTransport() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

export async function sendEmail({ subject, html }) {
  const transporter = createTransport();
  await transporter.sendMail({
    from: `"Job Scout 🤖" <${process.env.GMAIL_USER}>`,
    to: "tikigogreen@gmail.com",
    subject,
    html: wrapHtml(subject, html),
  });
  console.log(`📧 Email sent: ${subject}`);
}

function wrapHtml(title, body) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:20px;">
      <h2 style="color:#1a56db;border-bottom:2px solid #1a56db;padding-bottom:8px;">${title}</h2>
      <div style="margin-top:20px;line-height:1.6;font-size:15px;">
        ${body}
      </div>
      <hr style="margin-top:32px;border:none;border-top:1px solid #eee;">
      <p style="font-size:11px;color:#999;">Job Scout · github.com/contact-rurilabs/job-scout</p>
    </div>`;
}
