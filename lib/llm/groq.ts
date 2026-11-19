export const GROQ_PROVIDER_NAME = "Groq";
export const DEFAULT_GROQ_MODEL = "qwen/qwen3.8-27b";

// อ่านชื่อ Model Groq ที่ตั้งไว้ หรือใช้ค่าเริ่มต้นของโปรเจกต์
export function getGroqModelName() {
  return process.env.GROQ_CHAT_MODEL || process.env.GROQ_VISION_MODEL || DEFAULT_GROQ_MODEL;
}

// เรียก Groq API ฝั่ง Server เพื่อสร้างคำตอบจากบริบทที่ค้นได้
export async function generateGroqAnswer(
  systemInstruction: string,
  userPrompt: string,
) {
  const apiKey = process.env.GROQ_API_KEY;
  const model = getGroqModelName();

  if (!apiKey) {
    throw new Error("ไม่พบ GROQ_API_KEY กรุณาเพิ่ม Key ในไฟล์ .env.local");
  }

  let response: Response;
  try {
    response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        max_completion_tokens: 512,
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error("Groq ใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง");
    }

    console.error("เชื่อมต่อ Groq API ไม่สำเร็จ:", error);
    throw new Error("เชื่อมต่อ Groq ไม่ได้ กรุณาลองใหม่อีกครั้ง");
  }

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("โควตา Groq เต็ม กรุณารอสักครู่แล้วลองใหม่");
    }
    if (response.status === 503) {
      throw new Error("Groq กำลังมีผู้ใช้จำนวนมาก กรุณาลองใหม่อีกครั้งในภายหลัง");
    }

    console.error(`Groq API ตอบกลับ ${response.status}:`, result?.error?.message);
    throw new Error("Groq ยังไม่สามารถตอบคำถามได้");
  }

  const answer = result?.choices?.[0]?.message?.content;
  if (typeof answer !== "string" || !answer.trim()) {
    throw new Error("Groq ไม่ได้ส่งคำตอบกลับมา");
  }

  return answer.trim();
}
