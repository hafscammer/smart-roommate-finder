// Sends e-mail through SMTP (SMTP_URL, needs the optional `nodemailer` package). Without SMTP it prints the message
// to the terminal and, outside production, returns the link so the demo UI can show it.
const cfg = require("../config");
let tx;
async function send({ to, subject, text, link }) {
  if (cfg.smtpUrl) { tx = tx || require("nodemailer").createTransport(cfg.smtpUrl); await tx.sendMail({ from: cfg.mailFrom, to, subject, text }); return {}; }
  console.log(`\n[mail:dev] To: ${to}\n  Subject: ${subject}\n  ${link || text}\n`);
  return cfg.prod ? {} : { devLink: link };
}
module.exports = { send };
