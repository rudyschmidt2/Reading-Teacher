#!/usr/bin/env node
// Read-only verification helper for Reading Teacher. JSON on stdout.
const url = process.env.VERIFY_URL || "http://127.0.0.1:3000/";
const cmd = process.argv[2] || "doctor";

function help() {
  console.log(JSON.stringify({
    commands: ["doctor"],
    url,
    note: "doctor only. It does not click, seed, or write.",
  }));
}

async function doctor() {
  try {
    const res = await fetch(url, { redirect: "manual" });
    const ok = res.status < 500;
    console.log(JSON.stringify({ ok, status: res.status, url }));
    process.exit(ok ? 0 : 1);
  } catch (err) {
    console.log(JSON.stringify({ ok: false, url, error: String(err && err.message || err) }));
    process.exit(1);
  }
}

if (cmd === "--help" || cmd === "help") help();
else if (cmd === "doctor") doctor();
else {
  console.log(JSON.stringify({ ok: false, error: "unknown command", cmd }));
  process.exit(1);
}
