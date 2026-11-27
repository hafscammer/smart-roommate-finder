"""Synthetic data generator used to bootstrap the models before real interaction data exists.

Profiles come from lifestyle archetypes. Bios are assembled from phrase templates (including negations such as
"non-smoker"). Pair outcomes come from a hidden, non-linear preference function with noise, so the learned model
has real structure to find: asymmetric noise/cleanliness annoyance, steep penalties for large gaps, budget and
location effects. It is a stand-in for real accept/decline data (see README: retraining from real interactions).
"""
import numpy as np
from .schema import TRAITS, TAGS, norm
from .features import pair_row
from .places import BY_CITY

CITIES = [("faisalabad", .30, (100, 350)), ("lahore", .25, (120, 400)), ("islamabad", .15, (150, 450)),
          ("london", .15, (700, 1200)), ("toronto", .15, (800, 1300))]
PH = {
    "Smoker": ["I smoke on the balcony", "occasional smoker", "vape smoker"],
    "Night owl": ["I stay up late gaming", "night shift worker", "I code until 2 am"],
    "Early bird": ["up at 5 am for the gym", "early riser", "morning person"],
    "Neat freak": ["very tidy and organised", "I like a spotless home"],
    "Easy-going": ["relaxed about mess", "laid back and flexible"],
    "Social host": ["I love hosting friends", "game nights at home"],
    "Quiet type": ["I need quiet to study", "I enjoy peaceful evenings"],
    "Pet lover": ["I have a cat", "dog lover"],
    "Student": ["university student", "studying for exams", "medical student"],
    "Remote worker": ["I work from home", "remote developer", "freelance designer"],
    "Foodie": ["I love cooking", "food lover and home chef"],
    "Vegetarian": ["strict vegetarian", "I eat vegan"],
}
NEG = ["non-smoker", "I don't smoke", "no smoking please"]
FILL = ["Looking for a friendly home", "Respectful and friendly", "New to the city", "Love music and movies", "Reliable tenant"]
TRIG = {
    "Smoker": lambda u: u["smoke"] >= 1, "Night owl": lambda u: u["sleep"] >= 4, "Early bird": lambda u: u["sleep"] <= 2,
    "Neat freak": lambda u: u["clean"] >= 4, "Easy-going": lambda u: u["clean"] <= 2, "Social host": lambda u: u["guests"] >= 4,
    "Quiet type": lambda u: u["guests"] <= 2 and u["noise"] <= 2, "Pet lover": lambda u: u["pets"] >= 1,
    "Student": lambda u: False, "Remote worker": lambda u: u["wfh"] >= 1, "Foodie": lambda u: False, "Vegetarian": lambda u: u["veg"] >= 1,
}
ARCH = {"student": (3, 3, 2.5, 3), "pro": (2.5, 3.5, 2.5, 2.5), "night": (4.5, 2.5, 3.5, 4), "social": (3.5, 3, 4.5, 4.5), "quiet": (2, 4, 1.5, 1.5)}


def true_tags(u, claims=()):
    return [t for t in TAGS if TRIG[t](u) or t in claims]


def make_bio(rng, n, arche):
    parts, claims = [], set()
    for t in TAGS:
        if t == "Student": p = 0.7 if arche == "student" else 0.03
        elif t == "Foodie": p = 0.25
        else: p = 0.55 if TRIG[t](n) else 0.12
        if rng.random() < p:
            parts.append(str(rng.choice(PH[t]))); claims.add(t)
    if n["smoke"] == 0 and "Smoker" not in claims and rng.random() < 0.25:
        parts.append(str(rng.choice(NEG)))
    parts += [str(x) for x in rng.choice(FILL, size=int(rng.integers(1, 3)), replace=False)]
    rng.shuffle(parts)
    return ". ".join(parts), claims


def gen_user(rng):
    ci = rng.choice(len(CITIES), p=[c[1] for c in CITIES]); city, _, (lo, hi) = CITIES[ci]
    arche = str(rng.choice(list(ARCH)))
    tr = [int(np.clip(round(rng.normal(m, 1.0)), 1, 5)) for m in ARCH[arche]]
    mn = int(rng.uniform(lo, lo + (hi - lo) * 0.6)); mx = int(mn + rng.uniform(0.15, 0.6) * (hi - lo))
    u = dict(zip(TRAITS, tr))
    u.update(smoke=int(rng.random() < (0.25 if arche in ("night", "social") else 0.08)), pets=int(rng.random() < 0.2),
             wfh=int(rng.random() < (0.5 if arche == "pro" else 0.2)), veg=int(rng.random() < 0.12),
             nosmoke=int(rng.random() < 0.3), nopets=int(rng.random() < 0.12), furn=int(rng.random() < 0.5),
             role=str(rng.choice(["host", "seeker"])), type=str(rng.choice(["room", "flat", "house", "studio"], p=[.4, .35, .15, .1])),
             beds=int(rng.choice([1, 2, 3, 4], p=[.45, .35, .15, .05])), city=city, stay=str(rng.choice(["3", "6", "12"])),
             min=mn, max=mx, w={k: int(rng.choice([1, 3, 5], p=[.25, .45, .3])) for k in TRAITS})
    pl = BY_CITY.get(city, []); areas = [p["id"] for p in pl if p["kind"] == "area"]; anchors = [p["id"] for p in pl if p["kind"] != "area"]
    u["area"] = str(rng.choice(areas)) if areas else ""; u["anchor"] = str(rng.choice(anchors)) if (anchors and rng.random() < 0.5) else ""
    if u["smoke"]: u["nosmoke"] = 0
    if u["pets"]: u["nopets"] = 0
    n = norm(u)
    n["bio"], n["_claims"] = make_bio(rng, n, arche)
    n["_tags"] = true_tags(n, n["_claims"])
    return n


def raw_logit(me, o, tm, to):
    f = pair_row(me, o, tm, to); z = 0.0
    for k in TRAITS:
        d = f["d_" + k]
        z -= 2.4 * d ** 1.7 * (0.4 + me["w"][k] / 5) + 1.2 * d ** 1.7 * (0.4 + o["w"][k] / 5)
    if me["noise"] <= 2 and o["noise"] >= 4: z -= 1.2       # a quiet person with a loud roommate suffers more...
    if o["noise"] <= 2 and me["noise"] >= 4: z -= 0.3       # ...than the reverse
    if me["clean"] >= 4 and o["clean"] <= 2: z -= 1.4
    if abs(me["sleep"] - o["sleep"]) >= 4: z -= 0.9
    z += 1.8 * f["bud_ratio"] - 1.2 * f["bud_gap"] + (1.3 if f["same_city"] == 1 else -2.2 if f["same_city"] == 0 else 0)
    z += 0.5 * f["same_type"] - 0.5 * f["beds_diff"] + 0.3 * f["furn_match"] + (0.8 if f["complement"] else -0.1)
    for dk, w in (("area_km", 0.04), ("commute_km", 0.20), ("commute_km_rev", 0.08)):   # distance matters, capped so it does not double count the city effect
        if not np.isnan(f[dk]): z -= w * min(f[dk], 15)
    return z + 0.5 * f["both_smoke"] + 1.2 * f["tag_jaccard"]


def p_true(a, b, intercept):
    """Ground-truth probability that a would be happy with b (only the synthetic world knows this)."""
    return 1 / (1 + np.exp(-(raw_logit(a, b, a["_tags"], b["_tags"]) + intercept)))


def make_dataset(n_users=1500, n_pairs=40000, seed=7, with_meta=False):
    rng = np.random.default_rng(seed)
    users = [gen_user(rng) for _ in range(n_users)]
    by_city = {}
    for i, u in enumerate(users): by_city.setdefault(u["city"], []).append(i)
    pairs, z = [], []
    while len(pairs) < n_pairs:
        i = int(rng.integers(n_users))
        j = int(rng.choice(by_city[users[i]["city"]])) if rng.random() < 0.6 else int(rng.integers(n_users))
        a, b = users[i], users[j]
        if i == j or (a["nosmoke"] and b["smoke"]) or (b["nosmoke"] and a["smoke"]) or (a["nopets"] and b["pets"]) or (b["nopets"] and a["pets"]):
            continue
        pairs.append((i, j)); z.append(raw_logit(a, b, a["_tags"], b["_tags"]))
    z = np.array(z) + rng.normal(0, 0.6, len(z))
    lo, hi = -20.0, 20.0
    for _ in range(40):                                      # shift the intercept so ~40% of pairs are good matches
        mid = (lo + hi) / 2
        if (1 / (1 + np.exp(-(z + mid)))).mean() < 0.4: lo = mid
        else: hi = mid
    b = (lo + hi) / 2
    y = (rng.random(len(z)) < 1 / (1 + np.exp(-(z + b)))).astype(int)
    return (users, pairs, y, {"b": b}) if with_meta else (users, pairs, y)


# ---------------------------------------------------------------------------------------------
# Description -> lifestyle extraction data. Labels are what the TEXT says: if a trait is not
# mentioned the label is neutral (3), so the model never has to guess hidden information.
# ---------------------------------------------------------------------------------------------
TP = {
    "sleep": {1: ["I'm an early riser", "up at 5 am for the gym", "morning person", "I'm in bed by 9 pm", "I love waking up at dawn", "early to bed and early to rise", "I start work at 6 am"],
              3: ["I keep regular nine to five hours", "my schedule is flexible", "I'm neither an early nor a late person"],
              5: ["I stay up late gaming", "I'm a night owl", "I code until 2 am", "I work night shifts", "I'm most productive after midnight", "I go to bed very late", "late night person"]},
    "clean": {1: ["I'm relaxed about mess", "laid back about housework", "I'm not fussy about tidiness", "a bit messy but friendly", "dishes can wait a day for me", "I don't mind clutter"],
              3: ["reasonably tidy", "I clean up after myself", "normal level of cleanliness"],
              5: ["very tidy and organised", "I like a spotless home", "I clean every day", "neat freak", "I can't stand clutter", "I keep everything immaculate", "super organized and clean"]},
    "guests": {1: ["I rarely have guests", "I prefer a calm home without visitors", "I'm a homebody", "I like my space and privacy", "I don't invite people over", "I keep to myself at home"],
               3: ["occasional friends over", "I sometimes have guests", "a few visitors now and then"],
               5: ["I love hosting friends", "game nights at home", "always friends over", "I throw dinner parties", "my friends visit all the time", "I enjoy having people over often"]},
    "noise": {1: ["I need quiet to study", "I enjoy peaceful evenings", "I keep the volume low", "I'm sensitive to noise", "I prefer a silent home", "quiet household please"],
              3: ["moderate noise is fine", "normal volume at home", "I can live with some background noise"],
              5: ["I love loud music", "I like a lively house", "I play music and games loudly", "I enjoy a buzzing, noisy home", "I'm a drummer", "I'm loud and social"]},
}
IMP5 = ["{p}, it's a must", "it's essential for me: {p}", "{p} (non-negotiable)", "{p}, I really need this", "{p}, this is very important to me"]
IMP1 = ["{p}, but I don't mind either way", "{p}, though I'm flexible", "{p}, not a big deal", "{p} but it's not important"]
FLAGP = {
    "smoke": ["I smoke on the balcony", "occasional smoker", "vape smoker", "I smoke a few cigarettes a day"],
    "pets": ["I have a cat", "I have a dog", "dog lover with a puppy", "my pet rabbit lives with me"],
    "wfh": ["I work from home", "remote developer", "freelance designer working at home", "I'm working remotely"],
    "veg": ["strict vegetarian", "I eat vegan", "vegetarian household"],
    "nosmoke": ["please no smokers", "smoke-free home only", "I can't live with smokers", "non-smokers only"],
    "nopets": ["no pets please", "I'm allergic to animals so no pets", "pet-free home only"],
}
NEG_SELF = ["I'm a non-smoker", "I don't smoke", "I don't have pets", "I don't work from home"]


TP["noise"][1] += ["I'm a calm and quiet person", "I like it calm at home", "I can't concentrate with noise", "quiet lifestyle"]
TP["noise"][5] += ["I like having music on", "I'm a party person"]
TP["sleep"][5] += ["I sleep very late", "I play games at night", "I'm up until 3 am", "I work late"]
TP["sleep"][1] += ["I wake up at 5", "gym at 6 every morning", "I'm in bed early"]
TP["guests"][1] += ["I rarely bring friends home", "I keep to myself"]
TP["clean"][3] += ["I like it clean but I'm not obsessed"]
FLAGP["nosmoke"] += ["no smoking please", "no smoking in the house"]
FLAGP["nopets"] += ["allergic to cats", "I'm allergic to pets"]
FLAGP["pets"] += ["I have a cat named Milo"]
FLAGP["wfh"] += ["I work remotely"]


PROF = {
    "Student": ["I'm a university student", "I study computer science at college", "undergraduate student", "I'm doing my masters", "I'm a student preparing for exams"],
    "Medical student": ["I'm a medical student", "I'm a med student doing clinical rotations", "final year MBBS student"],
    "Software developer": ["I'm a software developer", "I work as a web developer", "I'm a programmer at a startup", "backend engineer writing code all day", "I'm a freelance developer", "I'm a data scientist"],
    "Designer": ["I'm a graphic designer", "I work as a UX designer", "freelance illustrator and designer", "I'm a product designer"],
    "Engineer": ["I'm a civil engineer", "I work as a mechanical engineer", "electrical engineer at a power company", "I'm a chemical engineer"],
    "Doctor": ["I'm a doctor at the city hospital", "I work as a physician", "I'm a house officer at a hospital", "junior surgeon", "I'm a dentist"],
    "Nurse": ["I'm a nurse", "I work as a registered nurse", "I'm studying and working in nursing"],
    "Teacher": ["I'm a school teacher", "I work as a lecturer at a university", "I tutor students for a living", "I'm a college professor"],
    "Finance": ["I'm an accountant", "I work in banking", "financial analyst at a bank", "I'm an auditor"],
    "Marketing": ["I work in marketing", "I'm a sales executive", "digital marketing specialist", "I do SEO and advertising"],
    "Hospitality": ["I'm a chef", "I work at a restaurant", "I'm a barista", "I work in hospitality"],
    "Lawyer": ["I'm a lawyer", "I work as an attorney", "I'm a paralegal at a law firm"],
    "Writer": ["I'm a writer", "I work as a journalist", "content creator and blogger", "I'm an editor at a publishing house"],
    "Entrepreneur": ["I run my own business", "I'm a startup founder", "entrepreneur building a company"],
    "Pharmacist": ["I'm a pharmacist", "I work in a hospital pharmacy", "pharmacy technician at a chemist shop", "I run the dispensary at a pharmacy"],
    "Architect": ["I'm an architect", "I work at an architecture firm", "junior architect designing buildings"],
    "Researcher": ["I'm a researcher", "I work as a scientist in a lab", "I'm a PhD researcher"],
}


def make_extraction(n=6000, seed=11):
    """Sentence-level samples: each sample is one short sentence mentioning at most two traits or one habit flag."""
    rng = np.random.default_rng(seed)
    keys = TRAITS + ["w_" + k for k in TRAITS] + list(FLAGP) + ["profession"]
    Y = {k: [] for k in keys}; texts = []

    def trait_phrase(k, lvl, wrap):
        p = str(rng.choice(TP[k][lvl])); imp = 3
        if wrap and lvl != 3:
            imp = int(rng.choice([1, 3, 5], p=[.2, .5, .3]))
            if imp == 5: p = str(rng.choice(IMP5)).format(p=p)
            elif imp == 1: p = str(rng.choice(IMP1)).format(p=p)
        return p, imp

    for _ in range(n):
        y = {k: 3 for k in TRAITS}; y.update({"w_" + k: 3 for k in TRAITS}); y.update({f: 0 for f in FLAGP}); y["profession"] = "none"
        r = rng.random()
        if r < 0.55:                                            # one trait (sometimes a second one joined with "and")
            k = str(rng.choice(TRAITS)); lvl = int(rng.choice([1, 3, 5])); p, imp = trait_phrase(k, lvl, True)
            y[k], y["w_" + k] = lvl, imp
            if rng.random() < 0.2:
                k2 = str(rng.choice([t for t in TRAITS if t != k])); l2 = int(rng.choice([1, 3, 5])); p2, _ = trait_phrase(k2, l2, False)
                y[k2] = l2; p = f"{p} and {p2}" if imp == 3 else f"{p2} and {p}"
            text = p
        elif r < 0.78:                                          # one habit / dealbreaker
            f = str(rng.choice(list(FLAGP))); y[f] = 1; text = str(rng.choice(FLAGP[f]))
        elif r < 0.92:                                          # one profession
            j = str(rng.choice(list(PROF))); y["profession"] = j; text = str(rng.choice(PROF[j]))
        else:                                                   # neutral: negations about self and filler
            text = str(rng.choice(NEG_SELF + FILL))
        texts.append(text)
        for kk in keys: Y[kk].append(y[kk])
    return texts, {k: np.array(v) for k, v in Y.items()}
