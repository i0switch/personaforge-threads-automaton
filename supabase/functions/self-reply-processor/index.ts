import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing Supabase environment variables");
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

type Job = {
  id: string;
  user_id: string;
  persona_id: string;
  post_id: string;
  status: string;
  attempt_count: number;
  threads_post_id: string | null;
};

type Persona = {
  id: string;
  user_id: string;
  threads_access_token: string | null;
  threads_user_id: string | null;
  threads_username: string | null;
};

type SelfReplySettings = {
  enabled: boolean;
  messages: string[];
};

async function fetchLatestThreadsPostId(persona: Persona, token: string): Promise<string | null> {
  try {
    const userId = persona.threads_user_id;
    if (!userId) return null;

    const url = new URL(`https://graph.threads.net/v1.0/${userId}/threads`);
    url.searchParams.set("limit", "5");
    url.searchParams.set("fields", "id,caption,created_time");
    url.searchParams.set("access_token", token);

    const res = await fetch(url.toString(), { method: "GET" });
    const body = await res.text();
    console.log("Latest threads fetch:", res.status, body);
    if (!res.ok) return null;

    const data = JSON.parse(body);
    const first = data?.data?.[0];
    return first?.id ?? null;
  } catch (e) {
    console.error("fetchLatestThreadsPostId error", e);
    return null;
  }
}

async function sendReply(token: string, replyToId: string, message: string, images?: string[]) {
  let containerId: string;

  // Check if reply has images and validate them
  if (images && images.length > 0) {
    console.log(`Reply has ${images.length} images, validating...`);
    
    // Validate image URL format
    const imageUrl = images[0];
    const isValidUrl = (url: string): boolean => {
      try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    };

    if (!imageUrl || !isValidUrl(imageUrl)) {
      console.warn('Invalid image URL detected, creating text-only reply instead:', imageUrl);
      // Fallback to text-only reply for invalid image URLs
      const createUrl = new URL("https://graph.threads.net/v1.0/me/threads");
      createUrl.searchParams.set("access_token", token);

      const createRes = await fetch(createUrl.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ media_type: "TEXT", text: message, reply_to_id: replyToId }),
      });
      const createBody = await createRes.text();
      console.log("Fallback text reply container response:", createRes.status, createBody);
      if (!createRes.ok) throw new Error(`Failed to create fallback text reply container: ${createBody}`);

      const containerData = JSON.parse(createBody);
      containerId = containerData.id;
    } else {
      console.log('Valid image URL detected, creating image reply container');
      // For image replies, create container with IMAGE media type
      const createUrl = new URL("https://graph.threads.net/v1.0/me/threads");
      createUrl.searchParams.set("access_token", token);

      const createRes = await fetch(createUrl.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: "IMAGE",
          image_url: imageUrl,
          text: message,
          reply_to_id: replyToId
        }),
      });
      const createBody = await createRes.text();
      console.log("Image reply container response:", createRes.status, createBody);
      if (!createRes.ok) throw new Error(`Failed to create image reply container: ${createBody}`);

      const containerData = JSON.parse(createBody);
      containerId = containerData.id;
    }
  } else {
    console.log('Creating text-only reply container');
    // For text-only replies
    const createUrl = new URL("https://graph.threads.net/v1.0/me/threads");
    createUrl.searchParams.set("access_token", token);

    const createRes = await fetch(createUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ media_type: "TEXT", text: message, reply_to_id: replyToId }),
    });
    const createBody = await createRes.text();
    console.log("Text reply container response:", createRes.status, createBody);
    if (!createRes.ok) throw new Error(`Failed to create text reply container: ${createBody}`);

    const containerData = JSON.parse(createBody);
    containerId = containerData.id;
  }

  if (!containerId) throw new Error("No container id returned");

  // Wait longer for image processing if images are present
  const waitTime = images && images.length > 0 ? 5000 : 2000;
  console.log(`Waiting ${waitTime}ms for reply container processing...`);
  await new Promise(resolve => setTimeout(resolve, waitTime));

  // 2) Publish container
  const publishUrl = new URL("https://graph.threads.net/v1.0/me/threads_publish");
  publishUrl.searchParams.set("access_token", token);

  const publishRes = await fetch(publishUrl.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: containerId }),
  });
  const publishBody = await publishRes.text();
  console.log("Reply publish response:", publishRes.status, publishBody);
  if (!publishRes.ok) throw new Error(`Failed to publish reply: ${publishBody}`);

  const replyId = JSON.parse(publishBody)?.id;
  if (!replyId) throw new Error("No reply id returned");
  return replyId as string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { limit = 5 } = (await req.json().catch(() => ({}))) as { limit?: number };

    // Get pending jobs
    const { data: jobs, error: jobsError } = await supabaseAdmin
      .from("self_reply_jobs")
      .select("id,user_id,persona_id,post_id,status,attempt_count,threads_post_id")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(Math.min(Math.max(1, limit), 20));

    if (jobsError) throw jobsError;

    const results: any[] = [];

    for (const job of (jobs || []) as Job[]) {
      try {
        // Fetch persona
        const { data: persona, error: personaErr } = await supabaseAdmin
          .from("personas")
          .select("id,user_id,threads_access_token,threads_user_id,threads_username")
          .eq("id", job.persona_id)
          .maybeSingle();
        if (personaErr) throw personaErr;
        if (!persona) throw new Error("Persona not found");

        // Fetch original post to get image information
        const { data: originalPost, error: postErr } = await supabaseAdmin
          .from("posts")
          .select("images")
          .eq("id", job.post_id)
          .maybeSingle();
        if (postErr) throw postErr;

        // Fetch settings
        const { data: settings } = await supabaseAdmin
          .from("self_reply_settings")
          .select("enabled,messages")
          .eq("persona_id", job.persona_id)
          .eq("user_id", job.user_id)
          .maybeSingle();

        if (!settings || !settings.enabled || !settings.messages || settings.messages.length === 0) {
          // Skip gracefully
          await supabaseAdmin
            .from("self_reply_jobs")
            .update({ status: "skipped", attempt_count: (job.attempt_count || 0) + 1, last_error: "Disabled or no messages" })
            .eq("id", job.id);
          results.push({ jobId: job.id, status: "skipped", reason: "disabled_or_no_messages" });
          continue;
        }

        const token = (persona as Persona).threads_access_token?.trim();
        if (!token) throw new Error("Threads access token missing");

        const messages = (settings as SelfReplySettings).messages;
        const message = messages[Math.floor(Math.random() * messages.length)];

        // Determine target Threads post id
        let replyTargetId = job.threads_post_id;
        if (!replyTargetId) {
          replyTargetId = await fetchLatestThreadsPostId(persona as Persona, token);
          if (replyTargetId) {
            await supabaseAdmin
              .from("self_reply_jobs")
              .update({ threads_post_id: replyTargetId })
              .eq("id", job.id);
          }
        }
        if (!replyTargetId) throw new Error("Could not resolve Threads post id to reply to");

        // Include images from original post in the reply
        const images = originalPost?.images || [];
        const replyId = await sendReply(token, replyTargetId, message, images);

        await supabaseAdmin
          .from("self_reply_jobs")
          .update({ status: "sent", attempt_count: (job.attempt_count || 0) + 1, reply_id: replyId })
          .eq("id", job.id);

        results.push({ jobId: job.id, status: "sent", replyId });
      } catch (e: any) {
        console.error("Job failed", job?.id, e);
        await supabaseAdmin
          .from("self_reply_jobs")
          .update({ status: "failed", attempt_count: (job?.attempt_count || 0) + 1, last_error: String(e?.message || e) })
          .eq("id", job.id);
        results.push({ jobId: job?.id, status: "failed", error: String(e?.message || e) });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("self-reply-processor error", error);
    return new Response(JSON.stringify({ error: error.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
