import fs from 'fs';
const code = fs.readFileSync('src/App.jsx', 'utf8');
const lines = code.split('\n');
const stack = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const rx = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*?)(\/?)>/g;
  let m;
  while ((m = rx.exec(line))) {
    const isClosing = m[1] === "/";
    const tag = m[2];
    const isSelfClosing = m[4] === "/";
    if (["input", "path", "svg", "br", "img"].includes(tag.toLowerCase())) continue;
    if (["ArrowRightLeft", "Settings", "Users", "Clock", "Sun", "Moon", "Download", "Zap", "CalendarIcon", "Calendar"].includes(tag)) continue;
    if (isSelfClosing) continue;
    if (isClosing) {
      if (!stack.length) {
        console.log("Mismatch on line " + (i + 1) + ": expected NONE, found " + tag);
      } else {
        const top = stack.pop();
        if (top.tag !== tag) {
          console.log("Mismatch on line " + (i + 1) + ": expected " + top.tag + " (opened at " + top.line + "), found " + tag);
        }
      }
    } else {
      stack.push({ tag, line: i + 1 });
    }
  }
}
if (stack.length) console.log("Unclosed tags: ", stack.map(x => x.tag + "@" + x.line).join(', '));
