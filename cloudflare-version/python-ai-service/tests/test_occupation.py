import unittest
from pipeline.rules import occupation_evidence, extract_jobs


class OccupationExtractionTests(unittest.TestCase):
    def labels(self, text):
        return [x["label"] for x in occupation_evidence(text)]

    def test_common_roles_and_south_asian_titles(self):
        cases = {
            "I work as a frontend developer": "Software developer",
            "I'm a data analyst at a bank": "Finance",
            "I am an electrician": "Skilled trades",
            "I work as a pharmacist": "Pharmacist",
            "I'm a civil servant": "Government employee",
            "I serve in the Pakistan Army": "Police / Armed forces",
            "I'm a registered nurse": "Nurse",
            "I work as a video editor": "Design / Media",
            "I'm a clinical psychologist": "Psychology / Counseling",
        }
        for text, expected in cases.items():
            with self.subTest(text=text): self.assertIn(expected, self.labels(text))

    def test_degree_context_is_not_mislabelled_as_employment(self):
        labels = self.labels("I'm a software engineering student doing my BSSE")
        self.assertIn("Software engineering student", labels)
        self.assertNotIn("Student", labels)

    def test_no_guess_without_explicit_evidence(self):
        for text in ("I love computers", "I enjoy helping people", "I am hardworking and ambitious"):
            with self.subTest(text=text): self.assertEqual(extract_jobs(text), [])

    def test_does_not_attribute_someone_elses_job_to_the_user(self):
        cases = [("My brother is a doctor", []), ("My friend works as a nurse", []), ("I am not a doctor", []),
                 ("I want to become a software developer", []), ("My brother is a doctor and I am a student", ["Student"])]
        for text, expected in cases:
            with self.subTest(text=text): self.assertEqual(extract_jobs(text), expected)

    def test_natural_degree_phrasing(self):
        for text in ("I'm studying computer science at university", "I am doing my BSSE"):
            with self.subTest(text=text): self.assertIn("Software engineering student", extract_jobs(text))

    def test_evidence_is_traceable(self):
        ev = occupation_evidence("I currently work as a backend developer in Lahore")
        self.assertTrue(ev)
        self.assertIn("backend developer", ev[0]["text"].lower())
        self.assertGreaterEqual(ev[0]["confidence"], 0.9)


if __name__ == "__main__": unittest.main()
