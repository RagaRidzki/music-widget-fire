// /api/oembed.js
export default async function handler(req, res) {
    // CORS basic
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(200).end();

    try {
        const { url: qUrl, maxwidth, maxheight } = req.query || {};
        const host = `https://${req.headers.host}`;

        // Canva biasanya kirim ?url=; kalau kosong, fallback ke homepage
        const u = qUrl ? new URL(qUrl) : new URL(host + "/");
        // Canonicalize ke host kamu (kalau beda)
        const allowedHosts = new Set([new URL(host).host, "music-widget-delta.vercel.app"]);
        if (!allowedHosts.has(u.host)) {
            u.host = new URL(host).host;
            u.protocol = "https:";
        }

        const slug = u.pathname.replace(/^\/+/, ""); // "" atau "abc123"
        const w = Math.min(parseInt(maxwidth || "400", 10) || 400, 1200);
        const h = Math.min(parseInt(maxheight || "180", 10) || 180, 800);

        // TANPA /embed: langsung ke /:slug (atau root)
        const iframePath = slug ? `/${slug}` : `/`;
        const iframeHTML = `<iframe src="${host}${iframePath}" width="${w}" height="${h}" style="border:0;overflow:hidden;border-radius:12px" allow="autoplay; clipboard-write" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;

        res.setHeader("Content-Type", "application/json; charset=utf-8");
        // Jangan set CSP di sini; kita atur di vercel.json (supaya konsisten untuk semua halaman)

        return res.status(200).json({
            version: "1.0",
            type: "rich",
            provider_name: "Music Widget",
            provider_url: host,
            title: `Music Widget${slug ? " – " + slug : ""}`,
            width: w,
            height: h,
            html: iframeHTML,
            // (opsional) thumbnail_url bisa ditambah kalau punya cover
        });
    } catch (e) {
        console.error(e);
        // Balas fallback 200 supaya Canva tetap “Sematan”
        const host = `https://${req.headers.host}`;
        return res.status(200).json({
            version: "1.0",
            type: "rich",
            provider_name: "Music Widget",
            provider_url: host,
            title: "Music Widget",
            width: 400,
            height: 180,
            html: `<iframe src="${host}/" width="400" height="180" style="border:0;overflow:hidden;border-radius:12px" allow="autoplay; clipboard-write" loading="lazy"></iframe>`
        });
    }
}
