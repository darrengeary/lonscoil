// print-agent.js
// Usage: SERVER_BASE=http://localhost:3000 PRINTER_HOST=192.168.1.50 node print-agent.js <JOB_ID> [FROM_SEQ]
const net = require("net");

const SERVER_BASE = process.env.SERVER_BASE;       // e.g. https://lunchlog.ie
const PRINTER_HOST = process.env.PRINTER_HOST;     // ZT421 IP
const PRINTER_PORT = Number(process.env.PRINTER_PORT || 9100);

if (!SERVER_BASE || !PRINTER_HOST) {
  console.error("Set SERVER_BASE and PRINTER_HOST env vars.");
  process.exit(1);
}

const jobId = process.argv[2];
const fromArg = process.argv[3] ? Number(process.argv[3]) : null;

if (!jobId) {
  console.error("Usage: node print-agent.js <JOB_ID> [FROM_SEQ]");
  process.exit(1);
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  return await res.text();
}
async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  return await res.json();
}

function sendToPrinter(zpl) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.connect(PRINTER_PORT, PRINTER_HOST, () => {
      socket.write(zpl, "utf8", () => {
        socket.end();
      });
    });
    socket.on("error", reject);
    socket.on("close", resolve);
  });
}

async function run() {
  let from = fromArg || 1;
  const limit = 200; // chunk size

  console.log(`Printing job ${jobId} to ${PRINTER_HOST}:${PRINTER_PORT} starting from #${from}`);

  while (true) {
    const zplUrl = `${SERVER_BASE}/api/print-jobs/${jobId}/zpl?from=${from}&limit=${limit}`;
    const zpl = await fetchText(zplUrl);

    if (!zpl || !zpl.includes("^XA")) {
      console.log("No more labels (or empty chunk). Done.");
      break;
    }

    await sendToPrinter(zpl);

    const printedUpTo = from + limit - 1;
    const progUrl = `${SERVER_BASE}/api/print-jobs/${jobId}/progress`;
    const prog = await postJson(progUrl, { printedUpTo });

    console.log(`Sent chunk starting #${from}. Next seq: ${prog.nextSeq}`);

    if (prog.nextSeq <= from) {
      console.log("Server did not advance. Stopping.");
      break;
    }
    from = prog.nextSeq;
  }

  console.log("✅ Print run complete.");
}

run().catch((e) => {
  console.error("❌ Print failed:", e);
  process.exit(1);
});
