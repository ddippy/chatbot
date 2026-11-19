// แทนอักขระ Unicode ที่จับคู่ไม่ครบ เพื่อให้ PostgreSQL รับข้อความได้
export function replaceUnpairedSurrogates(text) {
  let result = "";

  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);

    // เก็บคู่ surrogate ที่ถูกต้องไว้เหมือนเดิม
    if (code >= 0xd800 && code <= 0xdbff) {
      const nextCode = text.charCodeAt(index + 1);
      if (nextCode >= 0xdc00 && nextCode <= 0xdfff) {
        result += text[index] + text[index + 1];
        index += 1;
      } else {
        result += "\uFFFD";
      }
      continue;
    }

    // แทน low surrogate ที่ไม่มี high surrogate นำหน้าด้วยอักขระทดแทน
    if (code >= 0xdc00 && code <= 0xdfff) {
      result += "\uFFFD";
      continue;
    }

    result += text[index];
  }

  return result;
}

// ตัดตัวคั่น -- ที่ pnpm run อาจส่งต่อมาเป็น argument แรก
export function getCliArguments() {
  const args = process.argv.slice(2);
  if (args[0] === "--") args.shift();
  return args;
}

// แบ่งข้อความยาวเป็นชิ้นเล็กๆ โดยเหลือข้อความซ้อนกันเล็กน้อยระหว่างชิ้น
export function splitIntoChunks(text, chunkSize = 500, overlap = 80) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);

    // ถ้ามีช่องว่างใกล้จุดแบ่ง ให้ตัดตรงนั้นเพื่อลดโอกาสตัดกลางคำ
    if (end < text.length) {
      const minimumEnd = start + Math.floor(chunkSize * 0.7);
      const spacePosition = text.lastIndexOf(" ", end);
      if (spacePosition > minimumEnd) end = spacePosition;
    }

    const content = text.slice(start, end).trim();
    if (content) chunks.push(content);
    if (end >= text.length) break;

    // เลื่อนจุดเริ่มย้อนกลับเล็กน้อย เพื่อให้บริบทช่วงรอยต่อไม่หายไป
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}
