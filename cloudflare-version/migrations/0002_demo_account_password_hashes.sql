-- Restore the eight seeded demo logins after the original 120,000-iteration
-- PBKDF2 hashes became unverifiable on Cloudflare Workers (100,000 max).
-- Only replace the known demo accounts still carrying the incompatible format.
UPDATE users SET
  pass_hash = 'pbkdf2$100000$ISC264wfmyn7PMRbdbF5cw$Mqm_Z8ekL8nFfyp-m376B2zBNPWidHyfSv-NfBRV8sw',
  fails = 0,
  lock_until = 0
WHERE email = 'ayesha@demo.test' AND pass_hash LIKE 'pbkdf2$120000$%';

UPDATE users SET
  pass_hash = 'pbkdf2$100000$iGGQQ-oNNrQj8MsBcbe5eQ$mN4pE7uxn-Dc4BCKKcMhR5M-IRpIegIrBU8d2wc_UsI',
  fails = 0,
  lock_until = 0
WHERE email = 'hamza@demo.test' AND pass_hash LIKE 'pbkdf2$120000$%';

UPDATE users SET
  pass_hash = 'pbkdf2$100000$KTtjt7nXXxcWEKO8orcoPQ$Yy0yqNpqJmT2LmP6l_KFWn07P0W4L-FBeYfndKzRyGA',
  fails = 0,
  lock_until = 0
WHERE email = 'sara@demo.test' AND pass_hash LIKE 'pbkdf2$120000$%';

UPDATE users SET
  pass_hash = 'pbkdf2$100000$paFZHZ7VbD59lYpmJkjD1Q$Ak0xjPssUDzVh3MCber0rwRHAvFu7jwa9Xr2ScaSOQk',
  fails = 0,
  lock_until = 0
WHERE email = 'daniel@demo.test' AND pass_hash LIKE 'pbkdf2$120000$%';

UPDATE users SET
  pass_hash = 'pbkdf2$100000$0ztBgLMM442CHfzIckPp6g$C95E8_aic6rHt4orTrIGxb2oIgIx8BSs7_aTfTJcNks',
  fails = 0,
  lock_until = 0
WHERE email = 'noor@demo.test' AND pass_hash LIKE 'pbkdf2$120000$%';

UPDATE users SET
  pass_hash = 'pbkdf2$100000$VWsqbU2tQAufrGjBDwaCxQ$BHCCot2eoO-wsJ2DuahFlFzPDNaaH6mL-LW7Ze3O-00',
  fails = 0,
  lock_until = 0
WHERE email = 'bilal@demo.test' AND pass_hash LIKE 'pbkdf2$120000$%';

UPDATE users SET
  pass_hash = 'pbkdf2$100000$ncrFaEWuzsNn3Ysa4G0ubA$PPdu1Grx51sY_vgn4Do_RUp3Lhw19wpX7HIndnmgmV8',
  fails = 0,
  lock_until = 0
WHERE email = 'emma@demo.test' AND pass_hash LIKE 'pbkdf2$120000$%';

UPDATE users SET
  pass_hash = 'pbkdf2$100000$q_gepJ0xJCfC8dJP5Qi52w$rmZYnhzYLflOGzLYJYwXMSvScUcA3uAgIpaqjL5AqVA',
  fails = 0,
  lock_until = 0
WHERE email = 'zain@demo.test' AND pass_hash LIKE 'pbkdf2$120000$%';
