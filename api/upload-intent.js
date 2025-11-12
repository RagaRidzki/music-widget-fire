import { supabaseAdmin } from "./_supabaseAdmin.js";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 8);
const BUCKET = "audio";

const ALLOWED = ["mp3", "ogg", "m4a"];

export default async function handler(req, res) {
    if (req.method !== "POST")
        return res.status(405).json({ error: "Method not allowed" });

    try {
        const { fileName, fileType, slug, index } = req.body || {};

        if (!fileName || !fileType)
            return res.status(400).json({ error: "fileName & fileType required" });

        const ext = (fileName.split(".").pop() || "").toLowerCase();
        if (!ALLOWED.includes(ext))
            return res
                .status(400)
                .json({ error: `Only ${ALLOWED.join(", ")} are allowed` });

        const orderIndex =
            typeof index === "number" && index >= 0 && index <= 2 ? index : 0;

        const theSlug = slug && /^[a-z0-9]{6,12}$/.test(slug) ? slug : nanoid();

        const path = `${theSlug}/${orderIndex}.${ext}`;

        const { data, error } = await supabaseAdmin
            .storage
            .from(BUCKET)
            .createSignedUploadUrl(path, { upsert: true });

        if (error) {
            console.error("createSignedUploadUrl error:", error);
            return res.status(500).json({ error: error.message || "Create signed URL failed", details: error });
        }

        const { signedUrl, token } = data;

        const publicUrl = `${process.env.VITE_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;

        return res.status(200).json({
            slug: theSlug,
            path,
            token,
            signedUrl,
            publicUrl,
            orderIndex,
            fileType,
        });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Unexpected error" });
    }
}
