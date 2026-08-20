const fs = require("fs");
const path = require("path");
const assert = require("assert");

function loadFlashClass(file, mapName) {
  const src = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const match = src.match(new RegExp("var " + mapName + " = \\{\\};[\\s\\S]*?\\n  \\}"));
  assert.ok(match, `flashClass helper not found in ${file}`);
  let now = 1000;
  const clock = { now: () => now };
  const flashClass = new Function("Date", match[0] + "; return flashClass;")(clock);
  return { flashClass, tick: (ms) => { now += ms; } };
}

for (const [file, mapName] of [
  ["attachment-configurator.js", "lastLabelText"],
  ["app.js", "lastSchematicLabel"],
]) {
  const { flashClass, tick } = loadFlashClass(file, mapName);
  assert.strictEqual(flashClass("height", "H"), "");
  assert.strictEqual(flashClass("height", "H = 12 m"), " is-value-flash");
  assert.strictEqual(flashClass("height", "H = 12 m"), " is-value-flash");
  assert.strictEqual(flashClass("overhang", "X"), "");
  tick(1000);
  assert.strictEqual(flashClass("height", "H = 12 m"), "");
}

console.log("value-flash: all assertions passed");
