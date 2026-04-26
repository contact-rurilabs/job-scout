// add-application.js — adds a new application entry to applied.json
// Called by GitHub Actions workflow_dispatch with env vars:
//   COMPANY, ROLE, STATUS, URL
import { readFileSync, writeFileSync } from "fs";
import { sendEmail } from "./email.js";

const company = process.env.COMPANY;
const role = process.env.ROLE;
const status = process.env.STATUS || "applied";
const url = process.env.URL || "";

if (!company || !role) {
  console.error("❌ COMPANY and ROLE are required");
  process.exit(1);
}

const applied = JSON.parse(readFileSync("./applied.json", "utf8"));

// Check for duplicate
const existing = applied.find(
  (a) =>
    a.company.toLowerCase() === company.toLowerCase() &&
    a.role.toLowerCase() === role.toLowerCase()
);

if (existing) {
  console.log(`⚠️  Already exists: ${company} — ${role}`);
  process.exit(0);
}

const today = new Date().toISOString().split("T")[0];
const newEntry = { company, role, applied: today, status, url };

applied.push(newEntry);
writeFileSync("./applied.json", JSON.stringify(applied, null, 2));

console.log(`✅ Added: ${company} — ${role} (${status}) on ${today}`);

// Send confirmation email
await sendEmail({
  subject: `✅ Application logged: ${company} — ${role}`,
  html: `
    <p>New application added to your tracker:</p>
    <table style="border-collapse:collapse;margin-top:12px;">
      <tr><td style="padding:6px 12px;font-weight:bold;background:#f0f4ff;">Company</td><td style="padding:6px 12px;">${company}</td></tr>
      <tr><td style="padding:6px 12px;font-weight:bold;background:#f0f4ff;">Role</td><td style="padding:6px 12px;">${role}</td></tr>
      <tr><td style="padding:6px 12px;font-weight:bold;background:#f0f4ff;">Status</td><td style="padding:6px 12px;">${status}</td></tr>
      <tr><td style="padding:6px 12px;font-weight:bold;background:#f0f4ff;">Date</td><td style="padding:6px 12px;">${today}</td></tr>
      ${url ? `<tr><td style="padding:6px 12px;font-weight:bold;background:#f0f4ff;">URL</td><td style="padding:6px 12px;"><a href="${url}">${url}</a></td></tr>` : ""}
    </table>
    <p style="margin-top:16px;font-size:13px;color:#666;">
      This company is now excluded from future Job Scout search results.
    </p>`,
});
