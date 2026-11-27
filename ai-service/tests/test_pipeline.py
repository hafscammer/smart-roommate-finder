import os, sys, tempfile, unittest
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pipeline import train
from pipeline.predict import Predictor
from app import create_app

ME = {"id": 1, "name": "Me", "city": "Faisalabad", "min": 100, "max": 250, "sleep": 1, "clean": 5, "guests": 1, "noise": 1, "type": "room", "beds": 1, "role": "seeker",
      "w": {"sleep": 5, "clean": 3, "guests": 3, "noise": 5}, "bio": "Quiet medical student, early riser"}
TWIN = {**ME, "id": 2, "role": "host", "bio": "Early riser studying for exams"}
OPPOSITE = {**ME, "id": 3, "city": "London", "min": 800, "max": 1100, "sleep": 5, "clean": 1, "guests": 5, "noise": 5, "type": "house", "beds": 3, "bio": "Night owl who hosts loud game nights"}


class PipelineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dir = tempfile.mkdtemp()
        train.run(cls.dir, n_users=600, n_pairs=9000, seed=3, quiet=True)
        cls.pred = Predictor(cls.dir, n_users=600, n_pairs=9000, seed=3)
        cls.client = create_app(cls.pred).test_client()

    def test_metrics_beat_chance(self):
        m = self.pred.meta["metrics"]
        self.assertGreater(m["compat"]["auc"], 0.8)
        self.assertGreater(m["tags"]["micro_f1"], 0.9)

    def test_tags_use_text_and_negation(self):
        t = self.pred.tags([{"bio": "I don't smoke. University student who loves cooking", "sleep": 3, "clean": 3, "guests": 3, "noise": 3},
                            {"bio": "I smoke on the balcony", "sleep": 3, "clean": 3, "guests": 3, "noise": 3},
                            {"bio": "", "sleep": 5, "clean": 3, "guests": 3, "noise": 3}])
        self.assertNotIn("Smoker", t[0]); self.assertIn("Student", t[0]); self.assertIn("Foodie", t[0])
        self.assertIn("Smoker", t[1]); self.assertIn("Night owl", t[2])

    def test_similar_beats_opposite(self):
        res, _ = self.pred.score(ME, [TWIN, OPPOSITE])
        self.assertGreater(res[0]["s"], res[1]["s"] + 30)

    def test_dealbreakers_block(self):
        res, _ = self.pred.score({**ME, "nosmoke": 1}, [{**TWIN, "smoke": 1}])
        self.assertEqual(res[0]["s"], 0); self.assertIn("block", res[0])

    def test_factors_shape(self):
        res, _ = self.pred.score(ME, [OPPOSITE])
        f = res[0]["f"]; self.assertEqual(len(f), 7); self.assertTrue(all(0 <= s <= 1 for _, s in f))

    def test_extract_from_description(self):
        r = self.pred.extract("I'm a night owl developer and I work from home. I need a quiet home, it's a must. Please no smokers. I'm a non-smoker.")
        self.assertEqual(r["traits"]["sleep"], 5); self.assertEqual(r["traits"]["noise"], 1)
        self.assertEqual(r["flags"]["nosmoke"], 1); self.assertEqual(r["flags"]["wfh"], 1); self.assertEqual(r["flags"]["smoke"], 0)
        self.assertEqual(r["importance"]["noise"], 5)
        r = self.pred.extract("Very tidy and organised. I love hosting friends and loud music. I have a cat.")
        self.assertEqual((r["traits"]["clean"], r["traits"]["guests"], r["traits"]["noise"]), (5, 5, 5)); self.assertEqual(r["flags"]["pets"], 1)
        r = self.pred.extract("Hello"); self.assertEqual(set(r["traits"].values()), {3})

    def test_professions(self):
        cases = [("I'm a software developer and I work from home", "Software developer"), ("I work as a registered nurse at the city hospital", "Nurse"),
                 ("Final year medical student, I like quiet evenings", "Medical student"), ("I teach maths, I'm a school teacher", "Teacher"),
                 ("I'm a civil engineer", "Engineer"), ("Hello, looking for a room", "")]
        for text, want in cases:
            self.assertEqual(self.pred.extract(text)["profession"], want, text)
        extra = [("I am working as a data analyst at a bank", "Finance"), ("I'm a frontend developer", "Software developer"),
                 ("My job is electrician", "Skilled trades"), ("I work as a civil servant", "Government employee"),
                 ("I'm a graphic designer and content creator", "Designer"), ("I am a pharmacist", "Pharmacist"), ("I like software and engineering documentaries", "")]
        for text, want in extra:
            result = self.pred.extract(text)
            self.assertEqual(result["profession"], want, text)
            if want:
                self.assertTrue(result["occupation_evidence"], text)
                self.assertGreaterEqual(result["occupation_confidence"], 0.9)
            else:
                self.assertFalse(result["occupation_evidence"], text)

    def test_mutual_score_and_commute(self):
        me = {**ME, "city": "Lahore", "area": "lhr-gulberg", "anchor": "lhr-lums"}
        near = {**ME, "id": 5, "city": "Lahore", "area": "lhr-dha", "role": "host"}
        far = {**ME, "id": 6, "city": "Lahore", "area": "lhr-johar-town", "role": "host"}
        res, _ = self.pred.score(me, [near, far])
        self.assertGreater(res[0]["s"], res[1]["s"]); self.assertLess(res[0]["commute_km"], res[1]["commute_km"])
        self.assertTrue(all(k in res[0] for k in ("you", "them", "s"))); self.assertIn("Commute", [g for g, _ in res[0]["f"]])
        self.assertNotIn("Commute", [g for g, _ in self.pred.score(ME, [TWIN])[0][0]["f"]])

    def test_moderation(self):
        m = lambda t: self.pred.moderate(t)
        self.assertEqual(m("Hi! Is the room still available and what is the rent?")["action"], "allow")
        self.assertEqual(m("send the deposit first by western union, no viewing needed")["action"], "block")
        self.assertEqual(m("you are such a stupid loser, shut up")["action"], "block")
        self.assertEqual(m("sure, call me on 0300 1234567")["label"], "contact"); self.assertEqual(m("email me at someone@gmail.com")["action"], "warn")

    def test_rent_price_check(self):
        lon = self.pred.rent("London", "flat", 2, 1, "lon-camden"); fsd = self.pred.rent("Faisalabad", "flat", 2, 1, "fsd-center")
        self.assertTrue(lon["low"] <= lon["mid"] <= lon["high"]); self.assertGreater(lon["mid"], fsd["mid"] * 3)
        self.assertGreater(self.pred.rent("Lahore", "house", 3, 0, "")["mid"], self.pred.rent("Lahore", "room", 1, 0, "")["mid"])

    def test_smart_replies(self):
        r = self.pred.suggest("Hey, when can you move in?", {"movein": "2026-12-01", "min": 100, "max": 250})
        self.assertEqual(r["intent"], "ask_movein"); self.assertIn("2026-12-01", r["suggestions"][0])
        r = self.pred.suggest("What is your budget per month?", {"min": 100, "max": 250}); self.assertEqual(r["intent"], "ask_budget"); self.assertIn("$100-250", r["suggestions"][0])

    def test_retrain_hot_swap(self):
        import time
        os.environ["AI_ADMIN_TOKEN"] = "t0ken"; v0 = self.client.get("/health").get_json()["version"]
        self.assertEqual(self.client.post("/retrain", json={"interactions": []}).status_code, 403)
        r = self.client.post("/retrain", json={"interactions": [{"me": ME, "other": TWIN, "label": 1}, {"me": ME, "other": OPPOSITE, "label": 0}]}, headers={"X-Admin-Token": "t0ken"})
        self.assertEqual(r.status_code, 202)
        for _ in range(90):
            h = self.client.get("/health").get_json()
            if not h["training"]: break
            time.sleep(1)
        self.assertTrue(h["last_retrain"]["ok"], h["last_retrain"]); self.assertEqual(h["last_retrain"]["n_real"], 2); self.assertEqual(self.client.post("/analyze", json={"me": ME, "candidates": [TWIN]}).status_code, 200)

    def test_tags_are_one_or_two(self):
        desc = {**ME, "bio": "I'm a night owl nurse who loves hosting friends and cooking. No smokers please.", "sleep": 5, "guests": 5, "profession": "Nurse"}
        none = {**ME, "bio": "", "sleep": 3, "clean": 3, "guests": 3, "noise": 3, "profession": ""}
        strong = {**none, "smoke": 1, "sleep": 5}
        _, tags = self.pred.score(ME, [desc, none, strong])
        self.assertTrue(1 <= len(tags[0]) <= 2); self.assertEqual(tags[0][0], "Nurse")
        self.assertEqual(tags[1], [], "no description and nothing confident means no tag"); self.assertLessEqual(len(tags[2]), 1, "no description allows a single tag")
        self.assertTrue(all(len(t) <= 2 for t in self.pred.top_tags([ME, desc, TWIN, OPPOSITE])))

    def test_no_data_leakage_reported(self):
        m = self.pred.meta["metrics"]; self.assertIn("auc_leaky_split", m["compat"]); self.assertEqual(m["compat"]["split"], "user-disjoint (70/10/20)")
        self.assertIn(m["ranking"]["choice"], ("ltr", "mutual")); self.assertGreater(m["ranking"]["ndcg5"]["mutual"], m["ranking"]["ndcg5"]["rule"] - 0.02)

    def test_similar_people_and_personas(self):
        r = self.pred.similar(ME, [OPPOSITE, TWIN, {**TWIN, "id": 9, "sleep": 5, "clean": 1, "noise": 5, "bio": ""}], k=3)
        self.assertEqual(r[0]["id"], 2); self.assertGreater(r[0]["score"], r[-1]["score"]); self.assertIn("persona", self.pred.score(ME, [TWIN])[0][0])

    def test_collaborative_filtering(self):
        from pipeline.collab import Collab
        ev = [{"user": u, "item": i, "w": 1} for u in range(40) for i in ((u % 5) * 2, (u % 5) * 2 + 1, 99)]
        c = Collab().fit(ev); self.assertTrue(c.ok); self.assertGreater(c.sim(0, 1), c.sim(0, 4)); self.assertFalse(Collab().fit(ev[:5]).ok)

    def test_api(self):
        self.assertTrue(self.client.get("/health").get_json()["ok"])
        r = self.client.post("/analyze", json={"me": ME, "candidates": [TWIN, OPPOSITE]}).get_json()["results"]
        self.assertEqual([x["id"] for x in r], [2, 3]); self.assertIn("tags", r[0])
        self.assertEqual(self.client.post("/analyze", json={"me": 5}).status_code, 400)
        self.assertIn("traits", self.client.post("/extract", json={"bio": "I stay up late"}).get_json())
        self.assertEqual(self.client.post("/tags", data="nope").status_code, 400)
        self.assertEqual(len(self.client.post("/tags", json={"users": [ME]}).get_json()["tags"]), 1)


if __name__ == "__main__":
    unittest.main()
