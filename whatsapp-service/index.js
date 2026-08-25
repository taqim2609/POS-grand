const express = require("express");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");

const PORT = process.env.WA_PORT || 3001;
const SECRET = process.env.WA_SECRET || "changeme";

const app = express();
app.use(express.json({ limit: "4mb" }));

let lastQr = null;
let ready = false;
let me = null;
let lastError = null;

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: "/app/whatsapp-service/.wwebjs_auth" }),
  puppeteer: {
    headless: true,
    executablePath: process.env.CHROME_BIN || undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--single-process"],
  },
});

client.on("qr", async (qr) => { try { lastQr = await qrcode.toDataURL(qr); } catch (e) { lastQr = null; } ready = false; });
client.on("ready", () => { ready = true; lastQr = null; me = client.info?.wid?._serialized || null; console.log("WA ready:", me); });
client.on("authenticated", () => { lastQr = null; });
client.on("auth_failure", (m) => { lastError = "auth_failure: " + m; ready = false; });
client.on("disconnected", (r) => { ready = false; me = null; console.log("WA disconnected:", r); });
client.initialize().catch((e) => { lastError = String(e); console.error("init error", e); });

const auth = (req, res, next) => {
  if ((req.headers["x-wa-secret"] || "") !== SECRET) return res.status(401).json({ error: "unauthorized" });
  next();
};
const toChatId = (to) => (to.includes("@") ? to : `${to.replace(/[^0-9]/g, "")}@c.us`);

app.get("/status", auth, (req, res) => res.json({ ready, qr: lastQr, me, error: lastError }));

app.post("/send", auth, async (req, res) => {
  if (!ready) return res.status(409).json({ error: "WhatsApp belum terhubung" });
  try {
    const m = await client.sendMessage(toChatId(req.body.to), String(req.body.message || ""));
    res.json({ ok: true, id: m.id?._serialized });
  } catch (e) { res.status(400).json({ error: String(e) }); }
});

app.get("/chats", auth, async (req, res) => {
  if (!ready) return res.status(409).json({ error: "WhatsApp belum terhubung" });
  try {
    const chats = await client.getChats();
    res.json(chats.slice(0, 40).map((c) => ({
      id: c.id._serialized, name: c.name || c.id.user, unread: c.unreadCount || 0,
      ts: c.timestamp || 0, last: c.lastMessage?.body || "",
    })));
  } catch (e) { res.status(400).json({ error: String(e) }); }
});

app.get("/messages", auth, async (req, res) => {
  if (!ready) return res.status(409).json({ error: "WhatsApp belum terhubung" });
  try {
    const chat = await client.getChatById(req.query.chatId);
    const msgs = await chat.fetchMessages({ limit: 40 });
    res.json(msgs.map((m) => ({ id: m.id._serialized, body: m.body, fromMe: m.fromMe, ts: m.timestamp })));
  } catch (e) { res.status(400).json({ error: String(e) }); }
});

app.post("/logout", auth, async (req, res) => {
  try { await client.logout(); ready = false; me = null; res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: String(e) }); }
});

app.listen(PORT, () => console.log(`WA service listening on ${PORT}`));
