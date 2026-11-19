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
