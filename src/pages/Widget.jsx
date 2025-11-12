// src/pages/Widget.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

export default function Widget() {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [widget, setWidget] = useState(null);
  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState(true); // show/hide widget
  const [showList, setShowList] = useState(false); // toggle playlist panel
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  const [dbg, setDbg] = useState("");
  const playTimerRef = useRef(null); // nyimpen timer autoplay fallback
  const autoplayAfterSrcRef = useRef(false); // flag: sekali autoplay setelah source baru siap
  const switchingRef = useRef(false);

  // fetch widget
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const resp = await fetch(
          `/api/widgets?slug=${encodeURIComponent(slug)}`
        ).then(async (r) => {
          const t = await r.text();
          try {
            return JSON.parse(t);
          } catch {
            return { error: `Non-JSON (${r.status})`, raw: t };
          }
        });
        if (!active) return;
        if (resp.error) throw new Error(resp.error);
        setWidget(resp.widget);
        setIdx(0);
      } catch (e) {
        console.error(e);
        setWidget(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  const tracks = useMemo(() => widget?.tracks || [], [widget]);
  const current = tracks[idx];
  const srcUrl = (current?.url || current?.publicUrl || "").trim();

  // minta autoplay SEKALI setelah source siap (lewat onCanPlay)
  useEffect(() => {
    if (playTimerRef.current) {
      clearTimeout(playTimerRef.current);
      playTimerRef.current = null;
    }
    autoplayAfterSrcRef.current = true;
    switchingRef.current = false;
  }, [srcUrl]);

  const onLoadedMeta = (e) =>
    setDbg(`loadedmetadata: ${e.target.duration?.toFixed?.(2) ?? "n/a"}s`);
  // const onCanPlay = () => setDbg((p) => (p ? p + " | canplay" : "canplay"));
  const onPlay = () => setIsPlaying(true);
  const onPause = () => setIsPlaying(false);
  const onEnded = () => next(); // auto next
  const onError = (e) => {
    const el = e.target,
      err = el.error;
    setDbg(`error: code=${err?.code} networkState=${el.networkState}`);
    console.error("AUDIO ERROR", {
      code: err?.code,
      message: err?.message,
      src: el.currentSrc,
    });
  };

  const guessType = () => {
    const u = srcUrl.toLowerCase();
    if (u.endsWith(".mp3")) return "audio/mpeg";
    if (u.endsWith(".ogg")) return "audio/ogg";
    if (u.endsWith(".m4a") || u.endsWith(".mp4")) return "audio/mp4";
    return undefined;
  };

  function prev() {
    setIdx((i) => (i - 1 + tracks.length) % tracks.length);
  }
  function next() {
    setIdx((i) => (i + 1) % tracks.length);
  }
  const onCanPlay = async () => {
    if (autoplayAfterSrcRef.current) {
      autoplayAfterSrcRef.current = false;
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (e) {
        setDbg(`autoplay blocked: ${e?.message || e}`);
        setIsPlaying(false);
      }
    }
  };

  async function togglePlay() {
    const el = audioRef.current;
    if (!el) return;
    if (switchingRef.current) return; // cegah spam saat switch
    try {
      if (el.paused) {
        await el.play();
        setIsPlaying(true);
      } else {
        el.pause();
        setIsPlaying(false);
      }
    } catch (e) {
      setDbg(`play error: ${e?.message || e}`);
    }
  }

  if (loading || !widget || !open) {
    // saat ditutup, jangan render apa-apa
    if (!open) return null;
    return (
      <div className="fixed bottom-4 right-4 bg-white text-gray-900 rounded-lg shadow-lg p-3">
        Loading…
      </div>
    );
  }

  if (!open) return null;
  if (loading || !widget) {
    return (
      <div className="fixed bottom-4 right-4 bg-white text-gray-900 rounded-lg shadow-lg px-4 py-2.5 text-sm">
        Loading…
      </div>
    );
  }

  async function handleTrackClick(i) {
    const el = audioRef.current;
    if (!el) return;

    // bersihkan timer autoplay sebelumnya
    if (playTimerRef.current) {
      clearTimeout(playTimerRef.current);
      playTimerRef.current = null;
    }

    if (i === idx) {
      // track aktif -> toggle play/pause
      return togglePlay();
    }

    // ganti track: pause, reset posisi, lock switching
    switchingRef.current = true;
    try {
      el.pause();
    } catch {}
    el.currentTime = 0;

    // minta autoplay sekali ketika source baru siap
    autoplayAfterSrcRef.current = true;
    setIdx(i);

    // fallback tipis jika onCanPlay telat
    playTimerRef.current = setTimeout(async () => {
      try {
        await el.play();
        setIsPlaying(true);
      } catch {}
      switchingRef.current = false;
    }, 120);
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="relative w-40">
        {" "}
        {showList && (
          <div
            className="
              absolute bottom-full right-0 mb-3
              w-[260px] max-w-[min(90vw,260px)]
              bg-white border border-gray-200 rounded-lg
              shadow-[0_12px_32px_rgba(0,0,0,0.15)] overflow-hidden"
          >
            <div className="max-h-64 overflow-auto">
              {tracks.map((t, i) => {
                const active = i === idx;
                return (
                  <button
                    key={t.id || i}
                    onClick={() => handleTrackClick(i)}
                    className={`w-full text-left px-3.5 py-2.5 flex items-center gap-3
                            hover:bg-gray-50 transition ${
                              active ? "bg-gray-50" : ""
                            }`}
                  >
                    <div
                      className={`w-9 h-9 rounded
                                 ${active ? "bg-gray-900" : "bg-gray-200"}
                                 flex items-center justify-center text-white`}
                    >
                      {active && isPlaying ? (
                        // PAUSE saat track aktif & sedang play
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
                        </svg>
                      ) : (
                        // PLAY untuk track non-aktif atau aktif tapi sedang pause
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-sm font-medium truncate ${
                          active ? "text-gray-900" : "text-gray-800"
                        }`}
                      >
                        {t.title || `Track ${i + 1}`}
                      </div>
                      {t.artist && (
                        <div className="text-xs text-gray-500 truncate">
                          {t.artist}
                        </div>
                      )}
                    </div>
                    {Number.isFinite(t.duration_sec) && (
                      <div className="text-xs text-gray-500">
                        {Math.floor(t.duration_sec / 60)}:
                        {String(Math.floor(t.duration_sec % 60)).padStart(
                          2,
                          "0"
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {/* PILL kontrol: 2 kolom (Play | [Playlist Close]) */}
        <div className="w-full bg-white border border-gray-200 rounded-lg shadow-[0_6px_20px_rgba(0,0,0,0.10)]">
          <div className="grid grid-cols-2 items-center px-3 py-3">
            {/* LEFT: Play/Pause (lebih besar) */}
            <button
              onClick={togglePlay}
              className="w-12 h-12 flex items-center justify-center text-black"
              title="Play/Pause"
            >
              {isPlaying ? (
                <svg
                  width="30"
                  height="30"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
                </svg>
              ) : (
                <svg
                  width="30"
                  height="30"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* RIGHT: Playlist + Close (satu baris, ada jarak) */}
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowList((s) => !s)}
                className="w-8 h-8 flex items-center justify-center text-black"
                title="Playlist"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M4 6h12v2H4zM4 11h12v2H4zM4 16h12v2H4zM19 6h1v2h-1zM19 11h1v2h-1zM19 16h1v2h-1z" />
                </svg>
              </button>

              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 flex items-center justify-center text-black"
                title="Close"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.29 19.7 2.88 18.29 9.17 12 2.88 5.71 4.29 4.29 10.59 10.6l6.3-6.3z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        {/* AUDIO (tetap) */}
        <audio
          ref={audioRef}
          key={srcUrl}
          className="hidden"
          preload="auto"
          crossOrigin="anonymous"
          onCanPlay={onCanPlay}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIdx((i) => (i + 1) % tracks.length)}
        >
          {(() => {
            const u = srcUrl.toLowerCase();
            const t = u.endsWith(".mp3")
              ? "audio/mpeg"
              : u.endsWith(".ogg")
              ? "audio/ogg"
              : u.endsWith(".m4a") || u.endsWith(".mp4")
              ? "audio/mp4"
              : undefined;
            return t ? (
              <source src={srcUrl} type={t} />
            ) : (
              <source src={srcUrl} />
            );
          })()}
        </audio>
      </div>
    </div>
  );
}
