"""Smart replies: classify what the other person just asked (intent) and propose answers filled from your profile."""
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_union

INTENT_TEXT = {
    "greeting": ["Hi!", "Hello, nice to meet you", "Hey there, thanks for connecting", "Good morning", "Hi, how are you?", "Hey! Great to match with you"],
    "ask_movein": ["When can you move in?", "What is your move-in date?", "When are you planning to move?", "Do you know when you want to move in?", "How soon do you need the room?", "What month are you looking to start?"],
    "ask_budget": ["What is your budget?", "How much can you pay per month?", "What rent are you looking at?", "Is your budget flexible?", "What price range works for you?", "How much rent do you want to pay?"],
    "ask_viewing": ["Can we meet for a viewing?", "Would you like to see the place this weekend?", "Are you free for a video call?", "Can we arrange a time to meet?", "When can you come to see the flat?", "Want to visit the room?"],
    "ask_rules": ["Do you smoke?", "Are you okay with pets?", "Do you have guests over often?", "How noisy are you at night?", "Do you cook at home or eat out?", "Any dealbreakers I should know about?"],
    "ask_about": ["Tell me about yourself", "What do you do for work?", "What are you studying?", "What are you looking for in a roommate?", "Can you describe your daily routine?", "What are you like to live with?"],
    "thanks": ["Thanks!", "Thank you so much", "Appreciate it", "Great, thanks for the info", "Thanks for replying", "Cheers, that helps"],
    "other": ["The weather is nice today", "I saw your profile", "Okay", "Sounds good", "Let me check and get back to you", "Interesting"],
}
SUGGEST = {
    "greeting": ["Hi! Nice to meet you.", "Hello! Thanks for connecting.", "Hey! How are you?"],
    "ask_movein": ["I'm hoping to move in {movein}.", "I'm flexible on dates. What works for you?", "As soon as the room is free would be ideal."],
    "ask_budget": ["My budget is ${min}-{max} per month.", "I can do up to ${max} per month.", "Does ${max} per month work for you?"],
    "ask_viewing": ["I'd love to view it. Are you free this weekend?", "Could we do a video call first?", "Weekday evenings work best for me."],
    "ask_rules": ["{rules}", "Happy to follow your house rules.", "What are your rules on guests and noise?"],
    "ask_about": ["{about}", "I'm tidy, respectful and easy to live with.", "What are you looking for in a roommate?"],
    "thanks": ["You're welcome!", "Happy to help.", "Anytime!"],
    "other": ["Sounds good!", "Could you tell me more?", "Let me think and get back to you."],
}


def make_intents(n=3000, seed=4):
    rng = np.random.default_rng(seed); keys = list(INTENT_TEXT); texts, y = [], []
    for _ in range(n):
        k = str(rng.choice(keys, p=[.1, .15, .15, .15, .15, .15, .08, .07])); t = str(rng.choice(INTENT_TEXT[k]))
        if rng.random() < 0.4: t = str(rng.choice(["Hey, ", "So ", "Quick question: ", "Hi! ", "By the way, "])) + t[0].lower() + t[1:]
        if rng.random() < 0.2: t += str(rng.choice([" :)", " please", " thanks"]))
        texts.append(t); y.append(k)
    return texts, np.array(y)


def fill(t, me):
    rules = ("I don't smoke" if not me.get("smoke") else "I smoke outside") + (" and I have pets." if me.get("pets") else " and I have no pets.")
    job = str(me.get("profession") or "").lower(); city = str(me.get("city") or "").title()
    about = f"I'm a {job} based in {city}." if job and city else "I'm a tidy, respectful person looking for a calm home."
    return t.format(movein=me.get("movein") or "next month", min=int(me.get("min") or 0), max=int(me.get("max") or 0), rules=rules, about=about)


class IntentModel:
    def fit(self, texts, y):
        self.vec = make_union(TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True), TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4), sublinear_tf=True, min_df=2))
        self.clf = LogisticRegression(C=10, max_iter=2000).fit(self.vec.fit_transform(texts), y); return self

    def predict_all(self, texts):
        return self.clf.predict(self.vec.transform(texts))

    def suggest(self, text, me):
        P = self.clf.predict_proba(self.vec.transform([str(text)[:500]]))[0]; i = int(P.argmax()); intent = str(self.clf.classes_[i]) if P[i] >= 0.35 else "other"
        return {"intent": intent, "confidence": round(float(P[i]), 3), "suggestions": [fill(t, me) for t in SUGGEST[intent]]}
