// Gazetteer shared with the Python service (../shared/places.json). Approximate demo coordinates.
const fs = require("fs"), path = require("path");
const data = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "shared", "places.json"), "utf8"));
const byId = new Map(data.places.map(p => [p.id, p]));
const forCity = c => data.places.filter(p => p.city === String(c || "").trim().toLowerCase());
const km = (a, b) => {
  const x = byId.get(a), y = byId.get(b); if (!x || !y) return null;
  const r = Math.PI / 180, h = Math.sin(((y.lat - x.lat) * r) / 2) ** 2 + Math.cos(x.lat * r) * Math.cos(y.lat * r) * Math.sin(((y.lng - x.lng) * r) / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)) * 10) / 10;
};
module.exports = { all: data.places, byId, forCity, km, valid: id => id === "" || byId.has(id) };
