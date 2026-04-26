import Anthropic from "@anthropic-ai/sdk";
import nodemailer from "nodemailer";

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const RECIPIENT_EMAIL = "tikigogreen@gmail.com";
const SENDER_EMAIL = process.env.GMAIL_USER; // set in GitHub Secrets
const SENDER_PASSWORD = process.env.GMAIL_APP_PASSWORD; // Gmail App Password
const ANTHROPIC_MODEL =
  process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-latest";

// Companies already applied to — Claude will filter these out
const APPLIED_COMPANIES = [
  "Figma",
  "1Password",
  "Metabase",
  "Anthropic",
  "Recharge",
  "Assured",
  "Airbnb",
  "Webflow",
  "GitLab",
  "Veeva Systems",
  "SquareTrade",
  "Alteryx",
  "Commure",
  "Vercel",
  "OpenLoop",
  "Aleph",
  "Sayari",
  "Owner",
  "Boulevard",
];

// ─── SEARCH ──────────────────────────────────────────────────────────────────

async function runJobSearch() {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `You are a job search assistant for AJ, an Engineering Manager targeting remote Frontend/UI EM roles.

AJ's criteria:
- Title: Engineering Manager, Senior Engineering Manager, or Director of Engineering (frontend/UI focus)
- Must be: Remote US or Remote US + Canada
- Base salary: $225,000+ minimum (total comp of $250K+ if base isn't listed)
- Tech focus: Frontend, UI, Design Systems, React, TypeScript, Developer Experience, Consumer Products
- NOT a fit: backend-only, infrastructure/DevOps, mobile-only (iOS/Android native), data engineering, QA-only
- Start date: June 2, 2026

Companies ALREADY APPLIED TO — exclude these completely:
${APPLIED_COMPANIES.join(", ")}

Your task:
1. Search for Engineering Manager and Senior Engineering Manager frontend/UI remote roles posted in the last 48 hours
2. Search for Director of Engineering frontend/UI remote roles posted in the last 48 hours  
3. Search specifically on Greenhouse and Lever job boards for new frontend EM postings
4. Search for any notable companies hiring frontend engineering managers remotely right now

For each role you find that meets the criteria, provide:
- Company name
- Role title
- Compensation (if listed)
- Remote status (US only / US+Canada / worldwide)
- Direct application URL
- 1-sentence fit assessment for AJ specifically (mention if Angular→React migration, design systems, or consumer product focus is relevant)

Format your final answer as a clean digest. If you find nothing new that meets criteria, say so clearly. Be honest — if a role is borderline on comp or fit, flag it.`;

  console.log("🔍 Starting job search...");
  console.log(`🤖 Using Anthropic model: ${ANTHROPIC_MODEL}`);

  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 4096,
    tools: [{ type: "web_search_20250305", name: "web_search" }],
    messages: [{ role: "user", content: prompt }],
  });

  // Extract the final text response
  const textBlocks = response.content.filter((b) => b.type === "text");
  const summary = textBlocks.map((b) => b.text).join("\n");

  console.log("✅ Search complete");
  return summary;
}

// ─── EMAIL ───────────────────────────────────────────────────────────────────

async function sendEmail(summary) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: SENDER_EMAIL,
      pass: SENDER_PASSWORD,
    },
  });

  const now = new Date().toLocaleString("en-US", {
    timeZone: "America/Denver",
    dateStyle: "full",
    timeStyle: "short",
  });

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1a56db; border-bottom: 2px solid #1a56db; padding-bottom: 8px;">
        🎯 Job Scout Report — ${now}
      </h2>
      <div style="background: #f8f9fa; border-left: 4px solid #1a56db; padding: 16px; border-radius: 4px;">
        <p style="margin: 0; font-size: 13px; color: #666;">
          Criteria: Remote Frontend/UI EM · $225K+ base · US or US+Canada · Excludes ${APPLIED_COMPANIES.length} already-applied companies
        </p>
      </div>
      <div style="margin-top: 24px; white-space: pre-wrap; line-height: 1.6; font-size: 15px;">
        ${summary
          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
          .replace(/\n/g, "<br>")
          .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#1a56db;">$1</a>')}
      </div>
      <hr style="margin-top: 32px; border: none; border-top: 1px solid #eee;">
      <p style="font-size: 12px; color: #999;">
        Runs 2x daily · 8am & 6pm MT · job-scout on GitHub Actions
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: `"Job Scout 🤖" <${SENDER_EMAIL}>`,
    to: RECIPIENT_EMAIL,
    subject: `Job Scout — ${now}`,
    html: htmlBody,
  });

  console.log(`📧 Email sent to ${RECIPIENT_EMAIL}`);
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("Missing required secret: ANTHROPIC_API_KEY");
    }
    if (!SENDER_EMAIL || !SENDER_PASSWORD) {
      throw new Error("Missing required Gmail secrets for email delivery");
    }

    const summary = await runJobSearch();
    await sendEmail(summary);
  } catch (err) {
    console.error("❌ Error:", err?.message || err);
    if (err?.status) console.error("Status:", err.status);
    if (err?.error?.message) console.error("API Error:", err.error.message);
    process.exit(1);
  }
}

main();
