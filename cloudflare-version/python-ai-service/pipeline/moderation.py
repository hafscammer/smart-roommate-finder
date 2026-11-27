"""Safety classifier for chat messages and bios: ok / toxic / scam / contact (off-platform contact details).
ML (TF-IDF words + characters, logistic regression) with a regex safety net for phone numbers and e-mails."""
import re
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_union

PHONE = re.compile(r"\+?\d[\d\s().-]{8,}\d")
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
OFFSITE = re.compile(r"whats ?app|telegram|instagram|snapchat|text me on|call me on|dm me", re.I)
REASON = {"toxic": "That message looks abusive, so it was not sent.", "scam": "That message looks like a scam or a request for money, so it was not sent.",
          "contact": "For your safety, avoid sharing phone numbers or other contact details before you have met.", "ok": ""}
OK = ["Hi! Is the room still available?", "What is the monthly rent?", "When can I move in?", "Do you allow pets?", "Could we arrange a viewing this weekend?", "Thanks for getting back to me.",
      "I work from home most days, is that okay?", "Is the rent inclusive of bills?", "I'm a quiet person and keep the place tidy.", "Looking forward to meeting you.", "I study at the university nearby.",
      "What are the house rules about guests?", "How far is it from the bus stop?", "That sounds great, thank you.", "Could you tell me about the neighbourhood?", "I'm a non-smoker and have no pets.",
      "I usually cook dinner at home.", "Would a video call work for you first?", "My lease starts next month.", "Do you prefer a longer stay?", "I'm a night owl but I keep the noise down."]
TOXIC = ["you are such an idiot", "shut up you stupid loser", "I hate people like you", "go away you worthless trash", "you are disgusting", "nobody wants you here", "you will regret this", "what a pathetic loser you are"]
SCAM = ["send the deposit first by western union", "I am abroad please wire the advance before viewing", "pay in gift cards and I will send the keys", "crypto payment only, send now",
        "click this link to confirm your booking and enter your card details", "transfer money to hold the room, no viewing needed", "guaranteed investment returns, send money now", "pay the full year upfront to a personal account and I will post the keys"]
CONTACT = ["call me on {phone}", "my whatsapp is {phone}", "email me at {email}", "text me on telegram @{name}", "add me on instagram {name}", "let's talk on whatsapp {phone}", "here is my number {phone}", "reach me at {email} instead"]


def _phone(rng):
    d = lambda k: "".join(str(x) for x in rng.integers(0, 10, k))
    return str(rng.choice([f"+92 3{d(2)} {d(7)}", f"03{d(2)} {d(7)}", f"({d(3)}) {d(3)}-{d(4)}", f"+44 7{d(3)} {d(6)}", f"+1 {d(3)} {d(3)} {d(4)}"]))


def make_moderation(n=4000, seed=21):
    rng = np.random.default_rng(seed); texts, y = [], []
    for _ in range(n):
        c = str(rng.choice(["ok", "toxic", "scam", "contact"], p=[.52, .16, .16, .16]))
        if c == "ok": core = " ".join(str(x) for x in rng.choice(OK, size=int(rng.integers(1, 3)), replace=False))
        elif c == "toxic": core = str(rng.choice(TOXIC))
        elif c == "scam": core = str(rng.choice(SCAM))
        else:
            name = "".join(chr(97 + int(i)) for i in rng.integers(0, 26, 6))
            core = str(rng.choice(CONTACT)).format(phone=_phone(rng), email=f"{name}{int(rng.integers(1, 99))}@{rng.choice(['gmail.com', 'yahoo.com', 'outlook.com'])}", name=name)
        if c != "ok" and rng.random() < 0.4: core = str(rng.choice(OK)) + " " + core
        texts.append(core); y.append(c)
    return texts, np.array(y)


class Moderator:
    def fit(self, texts, y):
        self.vec = make_union(TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, min_df=2),
                              TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), sublinear_tf=True, min_df=3, max_features=30000))
        self.clf = LogisticRegression(C=10, max_iter=2000).fit(self.vec.fit_transform(texts), y)
        return self

    def predict_all(self, texts):
        return self.clf.predict(self.vec.transform(texts))

    def moderate(self, text):
        text = str(text or "")[:1000]
        P = self.clf.predict_proba(self.vec.transform([text]))[0]; i = int(P.argmax()); label, p = str(self.clf.classes_[i]), float(P[i])
        if label == "ok" and (PHONE.search(text) or EMAIL.search(text) or OFFSITE.search(text)):
            label, p = "contact", max(1 - p, 0.9)
        action = "block" if label in ("toxic", "scam") and p >= 0.7 else "warn" if label == "contact" else "allow"
        return {"label": label, "score": round(p, 3), "action": action, "reason": REASON[label] if action != "allow" else ""}
