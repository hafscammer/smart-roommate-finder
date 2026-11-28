-- Correct the eight migrated demo accounts using their ORIGINAL salts.
-- The original 120,000-iteration PBKDF2 hashes were created from Demo1234!.
-- Re-derive the same password at Cloudflare Workers' supported 100,000 iterations.
-- This supersedes the incorrect replacement values in migration 0002.
UPDATE users SET pass_hash='pbkdf2$100000$Q_N2id_Uy0VUMagdLwcQxQ$-MPQRTCgjSNAgp7iWcIBJXauBieRdf8cRKKX30eQwEw',fails=0,lock_until=0 WHERE id=1 AND email='ayesha@demo.test';
UPDATE users SET pass_hash='pbkdf2$100000$0_WblWV7Y4stIurEDQa21g$bpcuKPeoTmwFAuucOwU26oZiV9-GOCPkH3KW4afbF6w',fails=0,lock_until=0 WHERE id=2 AND email='hamza@demo.test';
UPDATE users SET pass_hash='pbkdf2$100000$nFhJfYah4b3jBpHUHwyIMw$pdU64z3S_7YDisYup_ZiiXDjhJWVkNlVYlXP-0ByDFQ',fails=0,lock_until=0 WHERE id=3 AND email='sara@demo.test';
UPDATE users SET pass_hash='pbkdf2$100000$5MhagxjaR2A02CqXROxIQg$_xH8-38HvWMx-yQqxoO1fACo1JTSeAFQTDWHqgNpKrE',fails=0,lock_until=0 WHERE id=4 AND email='daniel@demo.test';
UPDATE users SET pass_hash='pbkdf2$100000$FkPRsaReamI-hsyuQBS2dg$wIQYlleIpevUSWcQFkLF0rVGvdtighlHk3vi8DjxpnA',fails=0,lock_until=0 WHERE id=5 AND email='noor@demo.test';
UPDATE users SET pass_hash='pbkdf2$100000$cLoZZZiT9n8MOyIwz4OKlg$huQRpRrLdFUo-9if3xoBYjrVNKNOCBNMSWlnzpuxlfw',fails=0,lock_until=0 WHERE id=6 AND email='bilal@demo.test';
UPDATE users SET pass_hash='pbkdf2$100000$OJiBwXgr4h9w_i4NiE6pUA$WMLPdOpGvzbgp8CR9876SQtDwGh83zrPpYLRQ1pCxu0',fails=0,lock_until=0 WHERE id=7 AND email='emma@demo.test';
UPDATE users SET pass_hash='pbkdf2$100000$T8gSKDoB6UB6rqRObnvDPA$gqx4TVOs0c047mHLNRCeqbnRYijFh4muzZx7e8nTFZ8',fails=0,lock_until=0 WHERE id=8 AND email='zain@demo.test';
