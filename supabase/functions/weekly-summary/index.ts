// ═══════════════════════════════════════════
// ReadReward — Weekly Parent Summary Email
// Deploy: supabase functions deploy weekly-summary --no-verify-jwt
// Set secret: supabase secrets set RESEND_API_KEY=re_aLHnoo34_3NrJcVM8pSRqAWoR1BKZCGfK
//
// To schedule (Supabase Dashboard → Database → Extensions → enable pg_cron):
// SELECT cron.schedule(
//   'weekly-summary',
//   '0 18 * * 0',  -- Every Sunday at 6pm UTC
//   $$SELECT net.http_post(
//     'https://iusahkqvdbdgzaatxjxn.supabase.co/functions/v1/weekly-summary',
//     '{"scheduled":true}'::jsonb,
//     '{}'::jsonb,
//     '{"Content-Type":"application/json","Authorization":"Bearer YOUR_ANON_KEY"}'::jsonb
//   );$$
// );
// ═══════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FROM_EMAIL = "coach@readreward.win";
const APP_URL = "https://readreward.vercel.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Send email via Resend ──
async function sendEmail(to: string, subject: string, html: string, apiKey: string) {
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `ReadReward <${FROM_EMAIL}>`,
      to: [to],
      subject,
      html,
    }),
  });
  const data = await resp.json();
  return { status: resp.status, data };
}

// ── Build email HTML ──
function buildEmailHtml(
  parentName: string,
  children: Array<{
    name: string;
    pagesThisWeek: number;
    streak: number;
    booksInProgress: number;
    booksCompleted: number;
    sessionsThisWeek: number;
    rewardsEarned: string[];
  }>,
  weekLabel: string,
) {
  const childRows = children.map(child => {
    const streakText = child.streak > 0 ? `🔥 ${child.streak}-day streak` : "No streak yet";
    const rewardText = child.rewardsEarned.length > 0
      ? child.rewardsEarned.join(", ")
      : "None this week";

    return `
      <div style="background:#1a1a3e;border-radius:16px;padding:20px;margin-bottom:16px;border:1px solid rgba(255,255,255,0.1);">
        <div style="font-size:20px;font-weight:900;color:#fff;margin-bottom:12px;">${child.name}</div>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;color:rgba(255,255,255,0.5);font-size:14px;">📖 Pages read</td>
            <td style="padding:8px 0;color:#FF6B35;font-weight:800;font-size:18px;text-align:right;">${child.pagesThisWeek}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:rgba(255,255,255,0.5);font-size:14px;">🔥 Streak</td>
            <td style="padding:8px 0;color:${child.streak > 0 ? '#FF6B35' : 'rgba(255,255,255,0.3)'};font-weight:700;font-size:14px;text-align:right;">${streakText}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:rgba(255,255,255,0.5);font-size:14px;">📚 Sessions</td>
            <td style="padding:8px 0;color:#4776E6;font-weight:800;font-size:16px;text-align:right;">${child.sessionsThisWeek}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:rgba(255,255,255,0.5);font-size:14px;">📕 Books active / done</td>
            <td style="padding:8px 0;color:#27AE60;font-weight:700;font-size:14px;text-align:right;">${child.booksInProgress} active · ${child.booksCompleted} done</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:rgba(255,255,255,0.5);font-size:14px;">🎁 Rewards earned</td>
            <td style="padding:8px 0;color:#9B59B6;font-weight:700;font-size:13px;text-align:right;">${rewardText}</td>
          </tr>
        </table>
      </div>
    `;
  }).join("");

  const totalPages = children.reduce((s, c) => s + c.pagesThisWeek, 0);
  const totalSessions = children.reduce((s, c) => s + c.sessionsThisWeek, 0);

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f0c29;font-family:'Segoe UI','Calibri',Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px;">
    
    <!-- Header -->
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:36px;margin-bottom:8px;">📚</div>
      <div style="font-size:24px;font-weight:900;color:#fff;">Weekly Reading Report</div>
      <div style="font-size:14px;color:rgba(255,255,255,0.4);margin-top:4px;">${weekLabel}</div>
    </div>

    <!-- Summary banner -->
    <div style="background:linear-gradient(135deg,#4776E6,#8E54E9);border-radius:16px;padding:20px;text-align:center;margin-bottom:24px;">
      <div style="font-size:14px;color:rgba(255,255,255,0.7);margin-bottom:4px;">Hi ${parentName}! Your family read</div>
      <div style="font-size:42px;font-weight:900;color:#fff;">${totalPages} pages</div>
      <div style="font-size:14px;color:rgba(255,255,255,0.6);margin-top:4px;">across ${totalSessions} reading ${totalSessions === 1 ? 'session' : 'sessions'} this week</div>
    </div>

    <!-- Per-child cards -->
    ${childRows}

    <!-- CTA -->
    <div style="text-align:center;margin:28px 0;">
      <a href="${APP_URL}" style="display:inline-block;background:linear-gradient(135deg,#FF6B35,#FF8E53);color:#fff;text-decoration:none;padding:14px 36px;border-radius:14px;font-weight:800;font-size:16px;">Open ReadReward →</a>
    </div>

    <!-- Footer -->
    <div style="text-align:center;color:rgba(255,255,255,0.2);font-size:12px;margin-top:32px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.06);">
      <p>ReadReward — Read more. Earn more.</p>
      <p style="margin-top:8px;">
        <a href="${APP_URL}/?unsubscribe=weekly" style="color:rgba(255,255,255,0.3);text-decoration:underline;">Unsubscribe from weekly summaries</a>
      </p>
    </div>

  </div>
</body>
</html>
  `;
}

// ── Main handler ──
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not set" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all parents
    const { data: parents, error: pErr } = await supabase
      .from("parents").select("id, username, email");
    if (pErr) throw new Error("Failed to load parents: " + pErr.message);

    const now = new Date();
    const weekEnd = new Date(now);
    const dayOfWeek = weekEnd.getDay();
    // Set to last Sunday
    weekEnd.setDate(weekEnd.getDate() - dayOfWeek);
    weekEnd.setHours(23, 59, 59, 999);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const weekLabel = `${weekStart.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} – ${weekEnd.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;

    const results: Array<{ parent: string; status: number; detail: string }> = [];

    for (const parent of (parents || [])) {
      try {
        // Get children
        const { data: children } = await supabase
          .from("children").select("id, name").eq("parent_id", parent.id);
        if (!children?.length) continue;

        // Get reading logs for this week
        const { data: logs } = await supabase
          .from("reading_logs").select("*")
          .in("child_id", children.map(c => c.id))
          .gte("created_at", weekStart.toISOString())
          .lte("created_at", weekEnd.toISOString());

        // Get books
        const { data: books } = await supabase
          .from("books").select("*")
          .in("child_id", children.map(c => c.id));

        // Get reward configs for labels
        const { data: rewardConfigs } = await supabase
          .from("reward_configs").select("reward_key, label, unit")
          .eq("parent_id", parent.id);

        // Get all logs for streak calculation
        const { data: allLogs } = await supabase
          .from("reading_logs").select("child_id, pages, created_at")
          .in("child_id", children.map(c => c.id))
          .order("created_at", { ascending: false });

        const childSummaries = children.map(child => {
          const childLogs = (logs || []).filter(l => l.child_id === child.id);
          const childBooks = (books || []).filter(b => b.child_id === child.id);
          const approvedLogs = childLogs.filter(l => l.status === "approved");

          // Pages this week (approved only)
          const pagesThisWeek = approvedLogs.reduce((s, l) => s + l.pages, 0);
          const sessionsThisWeek = childLogs.length;

          // Streak
          const childAllLogs = (allLogs || []).filter(l => l.child_id === child.id);
          const pagesByDay: Record<string, number> = {};
          childAllLogs.forEach(l => {
            const d = new Date(l.created_at);
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            pagesByDay[key] = (pagesByDay[key] || 0) + l.pages;
          });
          const readingDayTimestamps = Object.entries(pagesByDay)
            .filter(([_, p]) => p >= 20)
            .map(([key]) => {
              const [y, m, d] = key.split("-").map(Number);
              return new Date(y, m, d).getTime();
            })
            .sort((a, b) => b - a);

          let streak = 0;
          const today = new Date(); today.setHours(0,0,0,0);
          let check = today.getTime();
          const ONE_DAY = 86400000;
          if (!readingDayTimestamps.includes(check)) check -= ONE_DAY;
          while (readingDayTimestamps.includes(check)) { streak++; check -= ONE_DAY; }

          // Books
          const booksInProgress = childBooks.filter(b => !b.done).length;
          const booksCompleted = childBooks.filter(b => b.done).length;

          // Rewards earned this week
          const rewardsEarned: string[] = [];
          const rewardMap = new Map((rewardConfigs || []).map(r => [r.reward_key, r]));
          approvedLogs.forEach(l => {
            const rc = rewardMap.get(l.reward_type_id);
            if (rc) {
              const pts = Math.round(l.pages * (Number(rc.rate || 1)) / 10);
              rewardsEarned.push(`${pts} ${rc.unit} ${rc.label}`);
            }
          });

          return {
            name: child.name,
            pagesThisWeek,
            streak,
            booksInProgress,
            booksCompleted,
            sessionsThisWeek,
            rewardsEarned,
          };
        });

        // Skip if no activity at all this week
        const totalPages = childSummaries.reduce((s, c) => s + c.pagesThisWeek, 0);
        const totalSessions = childSummaries.reduce((s, c) => s + c.sessionsThisWeek, 0);
        if (totalSessions === 0) {
          results.push({ parent: parent.email, status: 0, detail: "No activity, skipped" });
          continue;
        }

        const html = buildEmailHtml(parent.username, childSummaries, weekLabel);
        const subject = `📚 ${parent.username}'s family read ${totalPages} pages this week!`;

        const emailResult = await sendEmail(parent.email, subject, html, resendKey);
        results.push({ parent: parent.email, status: emailResult.status, detail: JSON.stringify(emailResult.data).slice(0, 200) });

      } catch (err) {
        results.push({ parent: parent.email, status: 500, detail: (err as Error).message });
      }
    }

    const sent = results.filter(r => r.status === 200).length;
    return new Response(
      JSON.stringify({ sent, total: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
