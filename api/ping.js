export default function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();

    return res.status(200).json({
        ok: true,
        method: req.method,
        url: req.url,
        note: "Jika ini 200 untuk POST juga, maka fungsi serverless aktif.",
    });
}
