"""Keyword lexicon used as a safety net next to the ML extractor (and mirrored in server/services/ai.js
as the fallback when the Python service is offline). The ML model wins; rules only fill what it left neutral."""
import re
from .schema import TRAITS

S = lambda p: re.compile(p, re.I)
HI_LO = {
    "sleep": (S(r"night owl|stay up late|up late|sleep (very )?late|late[- ]night|after midnight|\b[1-3] ?am\b|night shifts?|games? at night|work late"),
              S(r"early (riser|bird)|morning person|\b[4-6] ?am\b|gym at [4-7]|in bed (by|early)|dawn|wake up early")),
    "guests": (S(r"\bhost(ing)?\b|friends over|game nights?|dinner parties|visit all the time|always friends|people over"),
               S(r"rarely (have|bring|invite)|homebody|no visitors|without visitors|my space|privacy|don'?t invite|keep to myself")),
    "noise": (S(r"loud|lively|noisy|drummer|part(y|ies)|music on"), S(r"quiet|calm|peaceful|silent|low volume|sensitive to noise|can'?t concentrate")),
}
CLEAN_LO = S(r"relaxed about (the )?(mess|clean)|laid[- ]?back about|not fussy|\bmessy|don'?t mind (the )?(mess|clutter)|dishes can wait")
CLEAN_HI = S(r"\btidy|spotless|organi[sz]ed|\bneat\b|immaculate|clutter|clean every|very clean|super clean")
CUE = S(r"\b(must|need|needs|essential|non-negotiable|important|really want|have to)\b")
SPLIT = re.compile(r"(?<=[.!?;])\s+|\n+")
NOT_SMOKER = S(r"non-?smoker|don'?t smoke|do not smoke")
FLAG_RE = {
    "nosmoke": S(r"no smokers|smoke-free|non-?smokers only|can'?t live with smokers|no smoking|without smok"),
    "pets": S(r"(i have|my) (a |an )?(cat|dog|pet|rabbit|puppy|kitten)|dog lover|cat lover"),
    "nopets": S(r"no pets|pet-free|allergic|no animals"),
    "wfh": S(r"work(ing)? (from home|remotely)|works from home|remote|freelanc|\bwfh\b"),
    "veg": S(r"vegetarian|vegan"),
}


# High-precision occupation/entity lexicon. Specific roles come before broad categories;
# patterns cover common job titles, verb forms, abbreviations and South-Asian terms.
JOBS = [
    ("Medical student", S(r"\b(medical|medicine|mbbs|bds) student\b|\bmed student\b|final[- ]year mbbs|clinical student|\bdoing mbbs\b|\bstudying medicine\b")),
    ("Software engineering student", S(r"\b(software engineering|computer science|computer sciences|information technology|information systems|data science) student\b|\b(bs|bsc|bachelor'?s|ms|msc|master'?s) (in )?(computer science|software engineering|information technology|data science)\b|\b(bscs|bsse|bsit|bsds) student\b|\b(studying|pursuing|majoring in) (computer science|software engineering|information technology|data science)\b|\b(doing|pursuing|enrolled in) (my )?(bscs|bsse|bsit|bsds)\b")),
    ("Software developer", S(r"\b(software|web|frontend|front[- ]end|backend|back[- ]end|full[- ]stack|mobile|app) (developer|engineer)\b|\bdeveloper\b|\bprogrammer\b|\bcoder\b|\bdevops\b|\bdata scientist\b|\bsoftware engineer\b|\bqa engineer\b|\bquality assurance\b|\bcyber ?security\b|\bmachine learning engineer\b|\bai engineer\b|\b(build|building|develop|developing) (websites|web apps|mobile apps|software|applications)\b|\bworks? in (tech|technology|software)\b")),
    ("Designer", S(r"\b(graphic|ui|ux|product|fashion|interior|web) designer\b|\bdesigner\b|\billustrator\b|\banimator\b|\bvisual artist\b")),
    ("Doctor", S(r"\b(doctor|physician|surgeon|house officer|dentist|general practitioner|gp)\b|\bmedical officer\b")),
    ("Nurse", S(r"\b(nurse|nursing officer|registered nurse|midwife)\b")),
    ("Pharmacist", S(r"\b(pharmacist|pharmacy technician|pharmacy assistant)\b|\bpharmac(y|eutical)\b")),
    ("Engineer", S(r"\b(civil|mechanical|electrical|chemical|industrial|automotive|telecom|electronics|structural|environmental|petroleum|aerospace|software|network|cloud|qa|quality assurance) engineer\b|\bengineer\b")),
    ("Architect", S(r"\barchitect\b|\barchitectural designer\b")),
    ("Teacher", S(r"\b(school teacher|teacher|lecturer|professor|tutor|instructor|educator)\b|\bteach(es|ing) (maths?|english|science|students)\b")),
    ("Finance", S(r"\b(accountant|accounting|auditor|banker|banking|financial analyst|finance officer|investment analyst|tax consultant|bookkeeper|data analyst|business analyst)\b")),
    ("IT professional", S(r"\b(it support|systems administrator|system administrator|network administrator|database administrator|cloud engineer|it specialist)\b")),
    ("Marketing", S(r"\b(marketing|sales|seo|digital marketing|social media|brand|public relations|pr) (executive|manager|specialist|officer|analyst|coordinator)\b|\b(marketer|salesperson|salesman|saleswoman|copywriter|advertiser)\b|\bseo specialist\b")),
    ("Hospitality", S(r"\b(chef|cook|barista|waiter|waitress|server|hotel manager|hospitality|restaurant manager|baker)\b")),
    ("Lawyer", S(r"\b(lawyer|attorney|advocate|paralegal|solicitor|legal counsel)\b")),
    ("Writer", S(r"\b(writer|journalist|editor|content creator|blogger|author|copywriter|reporter)\b")),
    ("Entrepreneur", S(r"\b(entrepreneur|startup founder|business owner|founder|co[- ]founder|runs? my own business)\b")),
    ("Researcher", S(r"\b(researcher|scientist|research assistant|research fellow|phd researcher)\b")),
    ("Student", S(r"\b(student|undergrad|postgrad|university student|college student)\b|\b(studying|study) (at|in) (university|college)\b|\bpreparing for (my )?exams\b")),
    ("Government employee", S(r"\b(civil servant|government employee|government officer|public servant|bureaucrat|public sector employee|government service|works? for the government|federal employee)\b")),
    ("Police / Armed forces", S(r"\b(police officer|policeman|soldier|army officer|navy officer|air force officer|military personnel|armed forces|serving in the (army|navy|air force)|military officer|pakistan army|pakistan navy|pakistan air force)\b")),
    ("Skilled trades", S(r"\b(electrician|plumber|mechanic|technician|welder|carpenter|technologist|hvac technician|auto mechanic|maintenance technician|machinist)\b")),
    ("Data / Analytics", S(r"\b(data analyst|business intelligence analyst|bi analyst|analytics engineer|data engineer|statistician|power bi developer|tableau developer)\b")),
    ("Psychology / Counseling", S(r"\b(psychologist|clinical psychologist|therapist|counsell?or|psychotherapist|mental health professional)\b")),
    ("Design / Media", S(r"\b(video editor|photographer|videographer|motion designer|3d artist|3d modeler|animator|content strategist)\b")),
    ("Agriculture", S(r"\b(farmer|agronomist|agricultural engineer|veterinarian|vet|animal doctor)\b")),
    ("Transport / Logistics", S(r"\b(driver|pilot|delivery rider|courier|logistics|supply chain|truck driver)\b")),
    ("Human resources", S(r"\b(hr|human resources|recruiter|talent acquisition|hr manager)\b")),
    ("Customer support", S(r"\b(customer support|customer service|call center|help desk|support representative)\b")),
    ("Real estate", S(r"\b(real estate agent|realtor|property dealer|property consultant)\b")),
    ("Unemployed", S(r"\b(unemployed|currently not working|between jobs|looking for work)\b")),
]


OTHER_CONTEXT = S(r"\b(my|his|her|their|our) (friend|brother|sister|father|mother|husband|wife|cousin|roommate|colleague|boss|manager|son|daughter)\b.{0,65}\b(is|are|works?|studies|studied|became|was|were)\b")
NOT_SELF = S(r"\b(not|never) (a |an )?(doctor|nurse|teacher|engineer|developer|student|lawyer|accountant|designer)\b|\b(want|hope|plan|wish|aspire) to become (a |an )?")
SEEKING_ROLE = S(r"\b(looking for|hiring|seeking|need) (a |an )?")


def _self_match(text, match):
    """Filter job mentions about other people, negations and aspirations."""
    sentence_start = max(text.rfind(".", 0, match.start()), text.rfind("!", 0, match.start()), text.rfind("?", 0, match.start()), text.rfind("\n", 0, match.start())) + 1
    prefix = text[sentence_start:match.start()]
    other = OTHER_CONTEXT.search(prefix)
    if other and not re.search(r"\bI (am|work|study|teach|serve|run|manage)\b", prefix[other.end():], re.I):
        return False
    context = prefix + match.group(0)
    return not NOT_SELF.search(context) and not SEEKING_ROLE.search(prefix)


def extract_jobs(text):
    """Return occupation labels only when a self-description phrase is explicitly present."""
    text = str(text or "")
    out = [label for label, pattern in JOBS if any(_self_match(text, m) for m in pattern.finditer(text))]
    # Remove broad/overlapping labels when a specific occupation is present.
    if "Medical student" in out or "Software engineering student" in out: out = [x for x in out if x != "Student"]
    if "Software developer" in out: out = [x for x in out if x != "Engineer"]
    return out


def occupation_evidence(text):
    """Return short matched snippets so the UI can show why a role was inferred."""
    text = str(text or "")
    evidence = []
    for label, pattern in JOBS:
        match = next((m for m in pattern.finditer(text) if _self_match(text, m)), None)
        if match:
            evidence.append({"label": label, "text": text[max(0, match.start()-35):min(len(text), match.end()+35)].strip(), "confidence": 0.96})
    if any(x["label"] in ("Medical student", "Software engineering student") for x in evidence): evidence = [x for x in evidence if x["label"] != "Student"]
    if any(x["label"] == "Software developer" for x in evidence): evidence = [x for x in evidence if x["label"] != "Engineer"]
    return evidence[:3]


def extract_rules(text):
    sents = [s for s in SPLIT.split(str(text)) if s.strip()]
    traits, imp = {}, {}
    for k in TRAITS:
        lvl, cue = 3, False
        for s in sents:
            if k == "clean":
                v = 1 if CLEAN_LO.search(s) else 5 if CLEAN_HI.search(s) else 3
            else:
                hi, lo = HI_LO[k]; v = 5 if hi.search(s) else 1 if lo.search(s) else 3
            if v != 3:
                lvl, cue = v, bool(CUE.search(s)); break
        traits[k], imp[k] = lvl, 5 if (lvl != 3 and cue) else 3
    flags = {k: int(bool(r.search(text))) for k, r in FLAG_RE.items()}
    flags["smoke"] = int(bool(re.search(r"\b(smoke|smoker|vape|vaping)\b", text, re.I)) and not NOT_SMOKER.search(text) and not flags["nosmoke"])
    return traits, imp, flags
