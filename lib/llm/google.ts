export const GOOGLE_PROVIDER_NAME = "Google Gemini";
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

// อ่านชื่อ Model ที่กำลังใช้อยู่จากค่าตั้งค่าฝั่งเซิร์ฟเวอร์
export function getGoogleModelName() {
  return process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
}

// เรียก Gemini API ฝั่งเซิร์ฟเวอร์เพื่อสร้างคำตอบจากบริบทที่ค้นได้
export async function generateGoogleAnswer(
  systemInstruction: string,
  userPrompt: string,
) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = getGoogleModelName();

  if (!apiKey) {
    throw new Error("ไม่พบ GEMINI_API_KEY กรุณาเพิ่ม Key ในไฟล์ .env.local");
  }

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: userPrompt }],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 512,
          },
        }),
        signal: AbortSignal.timeout(30_000),
      },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error("Google AI ใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง");
    }

    console.error("เชื่อมต่อ Gemini API ไม่สำเร็จ:", error);
    throw new Error("เชื่อมต่อ Google AI ไม่ได้ กรุณาลองใหม่อีกครั้ง");
  }

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("โควตา Google AI เต็ม กรุณารอสักครู่แล้วลองใหม่");
    }
    if (response.status === 503) {
      throw new Error("Google AI กำลังมีผู้ใช้จำนวนมาก กรุณาลองใหม่อีกครั้งในภายหลัง");
    }

    console.error(`Gemini API ตอบกลับ ${response.status}:`, result?.error?.message);
    throw new Error("Google AI ยังไม่สามารถตอบคำถามได้");
  }

  const answer = result?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text || "")
    .join("")
    .trim();

  if (typeof answer !== "string" || !answer) {
    throw new Error("Google AI ไม่ได้ส่งคำตอบกลับมา");
  }

  return answer;
}
