// tracker.js — runs daily, detects silence and drafts follow-up emails
import Anthropic from "@anthropic-ai/sdk";
import { sendEmail } from "./email.js";
import { readFileSync } from "fs";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const SILENCE_THRESHOLD_DAYS = 14;

function daysSince(dateStr) {
  const applied = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - applied) / (1000 * 60 * 60 * 24));
}

function loadApplications() {
  return JSON.parse(readFileSync("./applied.json", "utf8"));
}

async function generateFollowUp(company, role, appliedDate, url) {
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: `Write a short, professional follow-up email for a job application.

Applicant: Atikom (Tiki) Juntakool — Engineering Manager with 12+ years experience, 19-person org, design systems, React/Next.js/TypeScript
Company: ${company}
Role: ${role}
Applied: ${appliedDate}
Job URL: ${url || "not available"}

Requirements:
- 3-4 sentences max
- Confident, not desperate
- Subject line included
- Reference specific role title
- End with a clear ask to connect
- Do NOT use "I hope this email finds you well" or similar filler

Format:
Subject: [subject line]

[email body]`,
      },
    ],
  });

  return response.content[0].text;
}

async function runTracker() {
  const apps = loadApplications();
  const now = new Date().toLocaleString("en-US", {
    timeZone: "America/Denver",
    dateStyle: "full",
    timeStyle: "short",
  });

  // Find silent applications (applied status, past threshold)
  const silent = apps.filter(
    (a) =>
      a.status === "applied" &&
      daysSince(a.applied) >= SILENCE_THRESHOLD_DAYS
  );

  // Build summary table of all active applications
  const active = apps.filter((a) =>
    ["applied", "interviewing", "silent"].includes(a.status)
  );

  const tableRows = active
    .sort((a, b) => new Date(a.applied) - new Date(b.applied))
    .map((a) => {
      const days = daysSince(a.applied);
      const statusColor =
        a.status === "interviewing"
          ? "#16a34a"
          : days >= SILENCE_THRESHOLD_DAYS
          ? "#dc2626"
          : "#d97706";
      const flag = days >= SILENCE_THRESHOLD_DAYS ? " 🔴" : days >= 7 ? " 🟡" : " 🟢";
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee;"><strong>${a.company}</strong></td>
        <td style="padding:8px;border-bottom:1px solid #eee;font-size:13px;">${a.role}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;font-size:13px;">${a.applied}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;font-size:13px;color:${statusColor};"><strong>${days}d${flag}</strong></td>
        <td style="padding:8px;border-bottom:1px solid #eee;font-size:13px;">${a.status}</td>
      </tr>`;
    })
    .join("");

  const table = `
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <thead>
        <tr style="background:#f0f4ff;">
          <th style="padding:8px;text-align:left;font-size:13px;">Company</th>
          <th style="padding:8px;text-align:left;font-size:13px;">Role</th>
          <th style="padding:8px;text-align:left;font-size:13px;">Applied</th>
          <th style="padding:8px;text-align:left;font-size:13px;">Age</th>
          <th style="padding:8px;text-align:left;font-size:13px;">Status</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
    <p style="font-size:12px;color:#666;">🟢 &lt;7 days · 🟡 7–13 days · 🔴 14+ days (follow-up recommended)</p>`;

  // Generate follow-up drafts for silent apps
  let followUpSection = "";
  if (silent.length > 0) {
    console.log(
      `📭 ${silent.length} application(s) past ${SILENCE_THRESHOLD_DAYS} days — generating follow-ups...`
    );

    const drafts = await Promise.all(
      silent.map(async (a) => {
        const draft = await generateFollowUp(
          a.company,
          a.role,
          a.applied,
          a.url
        );
        return `<div style="background:#fff8f0;border-left:4px solid #f97316;padding:16px;border-radius:4px;margin-bottom:16px;">
          <strong style="color:#f97316;">📨 Follow-up Draft: ${a.company} (${daysSince(a.applied)} days)</strong><br><br>
          <pre style="font-family:Arial,sans-serif;white-space:pre-wrap;font-size:14px;margin:0;">${draft}</pre>
        </div>`;
      })
    );

    followUpSection = `
      <h3 style="color:#dc2626;margin-top:32px;">⚠️ ${silent.length} Application(s) Need Follow-Up</h3>
      ${drafts.join("")}`;
  } else {
    followUpSection = `<p style="color:#16a34a;">✅ No applications past ${SILENCE_THRESHOLD_DAYS} days — you're on top of it.</p>`;
  }

  await sendEmail({
    subject: `📊 Application Tracker — ${active.length} active · ${silent.length} need follow-up`,
    html: `
      <h3 style="margin-top:0;">Active Pipeline (${active.length} roles)</h3>
      ${table}
      ${followUpSection}`,
  });

  console.log(
    `✅ Tracker done. ${active.length} active, ${silent.length} need follow-up.`
  );
}

runTracker().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
