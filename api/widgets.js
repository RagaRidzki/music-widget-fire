// /api/widgets.js
import { supabaseAdmin } from "./_supabaseAdmin.js";

function setCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "POST") {
      // body: { slug, title, tracks: [{orderIndex, publicUrl, title?, artist?, duration_sec?}] }
      const { slug, title, tracks } = req.body || {};
      if (!slug || !Array.isArray(tracks) || tracks.length === 0) {
        return res.status(400).json({ error: "slug & tracks required" });
      }

      // 1) Upsert widget (by slug) → dapat widget.id
      const { data: wData, error: wErr } = await supabaseAdmin
        .from("widgets")
        .upsert({ slug, title: title ?? null }, { onConflict: "slug" })
        .select()
        .single();

      if (wErr) return res.status(500).json({ error: wErr.message });

      const widgetId = wData.id;

      // 2) Bersihkan & urutkan tracks (max 3)
      const cleaned = tracks
        .map((t, i) => ({
          widget_id: widgetId,
          title: t.title ? String(t.title) : null,
          artist: t.artist ? String(t.artist) : null,
          url: String(t.publicUrl || t.url || ""),
          duration_sec: Number.isFinite(t.duration_sec) ? Math.max(0, Math.floor(t.duration_sec)) : null,
          order_index: Number.isFinite(t.orderIndex) ? t.orderIndex : i,
        }))
        .filter(t => t.url)
        .sort((a, b) => a.order_index - b.order_index)
        .slice(0, 3);

      if (cleaned.length === 0) {
        return res.status(400).json({ error: "tracks invalid/empty" });
      }

      // 3) Hapus tracks lama milik slug ini (biar idempoten), lalu insert batch
      const { error: delErr } = await supabaseAdmin
        .from("tracks")
        .delete()
        .eq("widget_id", widgetId);
      if (delErr) return res.status(500).json({ error: delErr.message });

      const { data: tData, error: tErr } = await supabaseAdmin
        .from("tracks")
        .insert(cleaned)
        .select()
        .order("order_index", { ascending: true });
      if (tErr) return res.status(500).json({ error: tErr.message });

      return res.status(200).json({
        widget: {
          id: widgetId,
          slug: wData.slug,
          title: wData.title,
          tracks: tData,
        },
      });
    }

    if (req.method === "GET") {
      const slug = (req.query.slug || "").toString().trim();
      if (!slug) return res.status(400).json({ error: "slug is required" });

      // 1) Ambil widget by slug
      const { data: wData, error: wErr } = await supabaseAdmin
        .from("widgets")
        .select("*")
        .eq("slug", slug)
        .single();

      if (wErr) {
        const code = wErr.code === "PGRST116" ? 404 : 500;
        return res.status(code).json({ error: wErr.message });
      }

      // 2) Ambil tracks terkait
      const { data: tData, error: tErr } = await supabaseAdmin
        .from("tracks")
        .select("*")
        .eq("widget_id", wData.id)
        .order("order_index", { ascending: true });

      if (tErr) return res.status(500).json({ error: tErr.message });

      return res.status(200).json({
        widget: {
          id: wData.id,
          slug: wData.slug,
          title: wData.title,
          tracks: tData || [],
        },
      });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Unexpected error" });
  }
}
