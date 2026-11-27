CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    pass_hash TEXT NOT NULL,
    fails INTEGER DEFAULT 0,
    lock_until INTEGER DEFAULT 0,
    token_version INTEGER DEFAULT 0,
    data_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY,
    from_user INTEGER NOT NULL,
    to_user INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    data_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY,
    from_user INTEGER NOT NULL,
    to_user INTEGER NOT NULL,
    message_text TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    data_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY,
    data_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY,
    by_user INTEGER NOT NULL,
    target_user INTEGER NOT NULL,
    value INTEGER,
    created_at INTEGER NOT NULL,
    data_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_requests_from ON requests(from_user);
CREATE INDEX IF NOT EXISTS idx_requests_to ON requests(to_user);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(from_user, to_user, created_at);
