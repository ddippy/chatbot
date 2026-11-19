"use client";

import { useEffect, useState, type FormEvent } from "react";

// กำหนดรายชื่อ AI และ Model ที่ API ส่งมาให้หน้าเว็บ
type AiProviderOption = {
  id: "google" | "groq";
  name: string;
  model: string;
  enabled: boolean;
};

// กำหนดรูปแบบข้อมูลแหล่งอ้างอิงจาก API
type ChatSource = {
  documentName: string;
  pageNumber: number;
  similarity: number;
};

// กำหนดรูปแบบข้อมูลของข้อความแต่ละอันในบทสนทนา
type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  provider?: string;
  model?: string;
};

// สร้างหน้าแชตและเรียก API ฝั่งเซิร์ฟเวอร์เพื่อค้นเอกสารและตอบคำถาม
export default function Home() {
  // เก็บข้อความที่กำลังพิมพ์และประวัติข้อความบนหน้านี้
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [aiProviders, setAiProviders] = useState<AiProviderOption[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<"google" | "groq">("google");
  const selectedAi = aiProviders.find((provider) => provider.id === selectedProvider);

  // ขอชื่อ AI และ Model จาก Server เพื่อแสดงในส่วนหัวของเว็บไซต์
  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/chat", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("โหลดข้อมูล AI ไม่สำเร็จ");
        return (await response.json()) as { providers: AiProviderOption[] };
      })
      .then((data) => {
        setAiProviders(data.providers);
        const firstEnabled = data.providers.find((provider) => provider.enabled);
        if (firstEnabled) setSelectedProvider(firstEnabled.id);
      })
      .catch(() => {});

    return () => controller.abort();
  }, []);

  // ส่งคำถามไป API แล้วเพิ่มคำตอบและแหล่งอ้างอิงกลับมาในบทสนทนา
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || isLoading) return;

    setMessages((currentMessages) => [
      ...currentMessages,
      { role: "user", content: trimmedQuestion },
    ]);
    setQuestion("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmedQuestion, provider: selectedProvider }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "ระบบยังตอบคำถามไม่ได้");
      }

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          role: "assistant",
          content: result.answer,
          sources: result.sources,
          provider: result.provider,
          model: result.model,
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "กรุณาลองใหม่อีกครั้ง";
      setMessages((currentMessages) => [
        ...currentMessages,
        { role: "assistant", content: `ขออภัยครับ ${message}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#0b0d12] text-white">
      {/* แถบด้านบนแสดงชื่อผู้ช่วยของมหาวิทยาลัย */}
      <header className="border-b border-white/10">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-5 py-4 sm:px-8">
          <div className="flex size-10 items-center justify-center rounded-xl border border-amber-300/25 bg-amber-300/10 text-sm font-semibold text-amber-200">
            AI
          </div>
          <div>
            <p className="font-semibold tracking-wide">RMUTK AI</p>
            <p className="mt-0.5 text-xs text-white/45">
              ผู้ช่วยข้อมูลมหาวิทยาลัย · {selectedAi ? `${selectedAi.name} (${selectedAi.model})` : "กำลังโหลดชื่อ Model..."}
            </p>
          </div>
        </div>
      </header>

      {/* พื้นที่หลักแนะนำให้ผู้ใช้เริ่มถามคำถาม */}
      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-5 pb-10 pt-16 sm:px-8 sm:pt-24">
        <div className="mb-5 flex size-14 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/10 text-2xl text-amber-200">
          ✦
        </div>
        <h1 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
          สวัสดี มีอะไรให้ช่วยไหม?
        </h1>
        <p className="mt-4 max-w-xl text-center text-sm leading-7 text-white/55 sm:text-base">
          ถามจากเอกสารที่เพิ่มเข้าระบบ ระบบจะค้นข้อความที่เกี่ยวข้องและตอบพร้อมแหล่งอ้างอิง
        </p>

        {/* แสดงข้อความ คำตอบ และแหล่งอ้างอิงในบทสนทนา */}
        {messages.length > 0 && (
          <div aria-live="polite" className="mt-8 flex w-full flex-col gap-4">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                  message.role === "user"
                    ? "self-end bg-amber-200 text-[#17130a]"
                    : "self-start whitespace-pre-line border border-white/10 bg-[#12161e] text-white/75"
                }`}
              >
                {message.content}
                {message.role === "assistant" && message.provider && message.model && (
                  <p className="mt-2 text-[11px] text-white/35">
                    {message.provider} · {message.model}
                  </p>
                )}
                {message.role === "assistant" && message.sources && message.sources.length > 0 && (
                  <div className="mt-3 border-t border-white/10 pt-3 text-xs text-white/55">
                    <p className="mb-1.5 font-medium text-amber-200/80">แหล่งอ้างอิง</p>
                    {message.sources.map((source) => (
                      <p key={`${source.documentName}-${source.pageNumber}`}>
                        {source.documentName} หน้า {source.pageNumber}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* แจ้งสถานะระหว่างค้นเอกสารและสร้างคำตอบ */}
        {isLoading && (
          <p aria-live="polite" className="mt-4 w-full text-sm text-white/45">
            กำลังค้นเอกสารและเรียบเรียงคำตอบ...
          </p>
        )}

        {/* รับข้อความที่พิมพ์ แล้วส่งให้ฟังก์ชัน handleSubmit */}
        <form
          onSubmit={handleSubmit}
          className="mt-8 w-full rounded-2xl border border-white/10 bg-[#12161e] p-2 shadow-2xl shadow-black/20"
        >
          <label htmlFor="question" className="sr-only">
            พิมพ์คำถามเกี่ยวกับมหาวิทยาลัย
          </label>
          <div className="flex flex-wrap items-center gap-2 px-3 pb-2 text-xs">
            <label htmlFor="ai-provider" className="text-white/45">เลือก AI</label>
            <select
              id="ai-provider"
              value={selectedProvider}
              onChange={(event) => setSelectedProvider(event.target.value as "google" | "groq")}
              disabled={isLoading}
              className="rounded-lg border border-white/10 bg-[#0b0d12] px-2 py-1.5 text-white outline-none focus:border-amber-200/50 disabled:opacity-50"
            >
              {aiProviders.map((provider) => (
                <option key={provider.id} value={provider.id} disabled={!provider.enabled}>
                  {provider.name}{provider.enabled ? "" : " (ยังไม่ได้ตั้งค่า)"}
                </option>
              ))}
            </select>
            <span className="text-white/35">
              Model: {selectedAi?.model ?? "กำลังโหลด..."}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="question"
              type="text"
              placeholder="พิมพ์คำถามของคุณ..."
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-white outline-none placeholder:text-white/35"
            />
            <button
              type="submit"
              disabled={!question.trim() || isLoading}
              className="rounded-xl bg-amber-200 px-4 py-3 text-sm font-medium text-[#17130a] transition enabled:hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isLoading ? "กำลังคิด..." : "ส่งคำถาม"}
            </button>
          </div>
        </form>
        <p className="mt-3 text-center text-xs text-white/35">
          หากไม่พบข้อมูลสนับสนุน ระบบจะแจ้งว่าไม่มีคำตอบในเอกสาร
        </p>
      </section>

      {/* ข้อความท้ายหน้า */}
      <footer className="border-t border-white/[.06] px-5 py-4 text-center text-xs text-white/35">
        มหาวิทยาลัยเทคโนโลยีราชมงคลกรุงเทพ
      </footer>
    </main>
  );
}
