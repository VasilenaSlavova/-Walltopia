// Guards the drawing-label flash rule (Vasi 19 Aug) against the failure that
// actually happened while building it: one input change repaints the results
// twice, and a naive "changed since last render?" check loses the flash on the
// second repaint. Runs the real helper lifted out of the shipped file.
// Run: node test/value-flash.test.js
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

  // First paint has nothing to compare against, so it must stay quiet.
  assert.strictEqual(flashClass("span", "A"), "", `${file}: first paint should not flash`);

  // The value lands -> flash.
  assert.strictEqual(flashClass("span", "A = 6.0 m"), " is-value-flash", `${file}: change should flash`);

  // Same change repainted immediately (the double render) must still flash.
  assert.strictEqual(flashClass("span", "A = 6.0 m"), " is-value-flash", `${file}: repaint should keep the flash`);

  // An unrelated key is untouched by that change.
  assert.strictEqual(flashClass("height", "H"), "", `${file}: unrelated key should not flash`);

  // Once the window closes the label settles back.
  tick(1000);
  assert.strictEqual(flashClass("span", "A = 6.0 m"), "", `${file}: flash should expire`);

  console.log(`ok ${file}`);
}
console.log("value-flash: all assertions passed");
