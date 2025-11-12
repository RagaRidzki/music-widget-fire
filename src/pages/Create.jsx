import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function Create() {
  
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState("");
  const [slug, setSlug] = useState(""); // hanya untuk info setelah selesai
  
  // minta signed URL + upload 1 file 
  async function uploadOneFile(file, slugArg, index) {
    const resp = await fetch("/api/upload-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type,
        // KUNCI: kirim null di file pertama agar server generate slug baru
        slug: slugArg || null,
        index,
      }),
    }).then((r) => r.json());

    if (resp.error) throw new Error(resp.error);

    const { error: upErr } = await supabase.storage
      .from("audio")
      .uploadToSignedUrl(resp.path, resp.token, file);

    if (upErr) throw upErr;

    return {
      slug: resp.slug,
      orderIndex: resp.orderIndex,
      publicUrl: resp.publicUrl,
      fileType: resp.fileType || file.type || "audio/mpeg",
      title: file.name.replace(/\.[^.]+$/, ""), // default judul dari nama file
    };
  }

  async function handleUpload() {
    if (files.length === 0) return alert("Pilih dulu minimal 1 lagu");
    if (files.length > 3) return alert("Maksimal 3 lagu!");

    setStatus("Uploading...");
    try {
      let currentSlug = ""; // KUNCI: selalu kosong → slug baru setiap batch
      const uploaded = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const result = await uploadOneFile(file, currentSlug, i);
        currentSlug = result.slug; // slug dari file pertama dipakai untuk file berikutnya di batch INI
        uploaded.push(result);
      }

      setStatus("Menyimpan widget...");
      // Simpan metadata widget (STEP 12)
      const save = await fetch("/api/widgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: currentSlug,
          title: `My Widget ${currentSlug}`,
          tracks: uploaded
            .map((u) => ({
              orderIndex: u.orderIndex ?? 0,
              publicUrl: u.publicUrl,
              fileType: u.fileType,
              title: u.title,
            }))
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .slice(0, 3),
        }),
      }).then(async (r) => {
        const txt = await r.text();
        try {
          return JSON.parse(txt);
        } catch {
          throw new Error(`Non-JSON (${r.status})`);
        }
      });

      if (save?.error) throw new Error(save.error);

      setSlug(currentSlug);
      setStatus(`✅ Widget jadi! Buka /${currentSlug}`);

      // OPSIONAL: kalau mau fitur "lanjutkan widget lama"
      // localStorage.setItem("slug", currentSlug);
      // lalu tampilkan tombol "Lanjutkan" terpisah (tidak otomatis).
    } catch (err) {
      console.error(err);
      setStatus(`❌ Error: ${err.message}`);
    }
  }

  const onInputChange = (e) => setFiles(Array.from(e.target.files || []));
  const onDrop = (e) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files || []).filter((f) =>
      /audio\/(mp3|mpeg|ogg|m4a)/.test(f.type)
    );
    setFiles(dropped);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">
            Buat Widget Baru
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            Upload sampai <span className="font-medium text-neutral-300">3 lagu</span> (mp3/ogg/m4a, max ~100MB/lagu),
            lalu kami buatkan widget playlist-mu otomatis.
          </p>
        </div>

        {/* Card Upload */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
          {/* Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className="mx-6 mt-6 rounded-xl border border-dashed border-neutral-700 bg-neutral-900/60"
          >
            <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-800/70">
                {/* cloud upload icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.35 10.04A7 7 0 005.3 7.1a5.5 5.5 0 00.8 10.9h12.2a4.5 4.5 0 001.05-8.96zM13 12v4h-2v-4H8l4-4 4 4h-3z"/>
                </svg>
              </div>

              <h2 className="text-lg font-medium">Drag & drop lagu kamu di sini</h2>
              <p className="mt-1 text-xs text-neutral-400">
                Format: mp3, ogg, m4a • Maksimal 3 file
              </p>

              <label className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-200 active:scale-[0.98]">
                <input
                  type="file"
                  accept="audio/mp3,audio/mpeg,audio/ogg,audio/m4a"
                  multiple
                  onChange={onInputChange}
                  className="hidden"
                />
                PILIH FILES
              </label>

              {files.length === 0 && (
                <p className="mt-3 text-xs text-neutral-500">atau seret file ke area ini</p>
              )}
            </div>
          </div>

          {/* Preview daftar file */}
          {files.length > 0 && (
            <div className="mx-6 mt-6 rounded-xl border border-neutral-800 bg-neutral-900/40">
              <div className="divide-y divide-neutral-800">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-neutral-800/70">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{f.name.replace(/\.[^.]+$/, "")}</div>
                      <div className="truncate text-xs text-neutral-400">
                        {(f.size / (1024 * 1024)).toFixed(1)} MB • {f.type || "audio"}
                      </div>
                    </div>
                    <div className="text-xs text-neutral-500">#{i + 1}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-6">
            <div className="text-xs text-neutral-500">
              Tips: Upload batch = 1 widget. Upload batch baru → widget baru.
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setFiles([]);
                  setSlug("");
                  setStatus("Siap bikin widget baru.");
                }}
                className="rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm hover:bg-neutral-800"
              >
                Reset
              </button>
              <button
                onClick={handleUpload}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-emerald-400 disabled:opacity-50"
                disabled={files.length === 0}
              >
                Upload & Buat Widget
              </button>
            </div>
          </div>
        </div>

        {/* Status & link hasil */}
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-neutral-300">{status}</p>
          {slug && (
            <a
              href={`/${slug}`}
              className="rounded-md bg-neutral-800 px-3 py-1.5 text-sm text-white underline-offset-4 hover:underline"
            >
              Buka /{slug}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
