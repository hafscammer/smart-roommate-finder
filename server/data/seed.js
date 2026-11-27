const W = { sleep: 3, clean: 3, guests: 2, noise: 2 };
const P = (id, name, age, city, min, max, sleep, clean, guests, noise, smoke, pets, nosmoke, nopets, role, type, beds, furn, bio) =>
  ({ id, name, age, city, min, max, sleep, clean, guests, noise, smoke, pets, nosmoke, nopets, role, type, beds, furn, bio, w: { ...W } });
const PROF = { 1: "Student", 2: "Software developer", 3: "Designer", 4: "Hospitality", 5: "Medical student", 6: "Marketing", 7: "Teacher", 8: "Student" };
const AREA = { 1: ["fsd-madina-town", "fsd-uaf"], 2: ["fsd-d-ground", ""], 3: ["lhr-gulberg", ""], 4: ["lon-camden", "lon-canary-wharf"], 5: ["fsd-peoples-colony", "fsd-gcuf"], 6: ["lhr-johar-town", ""], 7: ["tor-kensington", ""], 8: ["fsd-samanabad", "fsd-uaf"] };
module.exports = [
  P(1, "Ayesha", 22, "Faisalabad", 120, 250, 2, 5, 2, 2, 0, 0, 1, 0, "seeker", "room", 1, 1, "Student at university, early riser, loves cooking and quiet evenings."),
  P(2, "Hamza", 25, "Faisalabad", 150, 300, 5, 2, 4, 4, 1, 0, 0, 0, "host", "flat", 2, 1, "Remote developer, late-night gamer, occasional smoker on the balcony."),
  P(3, "Sara", 24, "Lahore", 200, 350, 3, 4, 3, 3, 0, 1, 1, 0, "host", "room", 1, 0, "Freelance designer with a cat. Friendly, tidy, enjoys hosting friends."),
  P(4, "Daniel", 28, "London", 700, 1000, 4, 3, 3, 3, 0, 0, 0, 0, "seeker", "flat", 2, 1, "Works late shifts in a restaurant, loves food and football."),
  P(5, "Noor", 21, "Faisalabad", 100, 220, 1, 4, 1, 1, 0, 0, 1, 1, "seeker", "room", 1, 0, "Medical student, up at 5 am for the gym, needs a silent study space."),
  P(6, "Bilal", 26, "Lahore", 180, 320, 4, 3, 5, 5, 0, 0, 0, 0, "host", "house", 3, 1, "Sociable, loves game nights and cooking for guests. Works from home most days."),
  P(7, "Emma", 27, "Toronto", 800, 1100, 2, 5, 2, 2, 0, 1, 1, 0, "host", "studio", 1, 1, "Yoga teacher and dog lover. Morning person, very organised."),
  P(8, "Zain", 23, "Faisalabad", 130, 260, 5, 1, 3, 4, 1, 0, 0, 0, "seeker", "flat", 2, 0, "University student, vape smoker, studies late and sleeps in."),
].map(u => ({ ...u, profession: PROF[u.id] || "", area: AREA[u.id][0], anchor: AREA[u.id][1] }));
