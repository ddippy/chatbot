"use client";

import { useState, type FormEvent } from "react";
import { searchDocuments } from "../data/documents";

// กำหนดรูปแบบข้อมูลของข้อความแต่ละอันในบทสนทนา
type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

// สร้างหน้าแชตตัวอย่าง โดยคำตอบยังเป็นข้อความจำลอง
export default function Home() {
  // เก็บข้อความที่กำลังพิมพ์และประวัติข้อความบนหน้านี้
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // รับคำถามจากฟอร์ม แล้วค้นข้อความในข้อมูลตัวอย่าง
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) return;

    const results = searchDocuments(trimmedQuestion);

    // ถ้าค้นเจอ ให้แสดงข้อความพร้อมชื่อเอกสารและเลขหน้า
    const answer =
      results.length > 0
        ? results
            .map(
              (item) =>
                `${item.content}\nแหล่งอ้างอิง: ${item.documentName} หน้า ${item.page}`,
            )
            .join("\n\n")
        : "ยังไม่พบข้อมูลที่ตรงกับคำค้นนี้ในเอกสารตัวอย่าง";

    setMessages((currentMessages) => [
      ...currentMessages,
      { role: "user", content: trimmedQuestion },
      { role: "assistant", content: answer },
    ]);
    setQuestion("");
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
            <p className="mt-0.5 text-xs text-white/45">ผู้ช่วยข้อมูลมหาวิทยาลัย</p>
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
          ถามเกี่ยวกับคณะวิทยาศาสตร์และเทคโนโลยี มทร.กรุงเทพ
          แล้วผู้ช่วยจะค้นหาคำตอบจากเอกสารของมหาวิทยาลัย
        </p>

        {/* ปุ่มตัวอย่างคำถาม กดแล้วนำข้อความไปใส่ในช่องพิมพ์ */}
        <div className="mt-9 grid w-full gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setQuestion("ทะเบียน")}
            className="rounded-xl border border-white/10 bg-white/[.03] p-4 text-left transition hover:border-amber-200/40 hover:bg-white/[.06]"
          >
            <p className="text-sm font-medium text-white/85">ข้อมูลฝ่ายทะเบียน</p>
            <p className="mt-1.5 text-xs leading-5 text-white/45">ทะเบียน</p>
          </button>
          <button
            type="button"
            onClick={() => setQuestion("คำร้อง")}
            className="rounded-xl border border-white/10 bg-white/[.03] p-4 text-left transition hover:border-amber-200/40 hover:bg-white/[.06]"
          >
            <p className="text-sm font-medium text-white/85">การยื่นคำร้อง</p>
            <p className="mt-1.5 text-xs leading-5 text-white/45">คำร้อง</p>
          </button>
        </div>

        {/* แสดงคำถามและคำตอบตัวอย่างที่ส่งในหน้าเว็บ */}
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
              </div>
            ))}
          </div>
        )}

        {/* รับข้อความที่พิมพ์ แล้วส่งให้ฟังก์ชัน handleSubmit */}
        <form
          onSubmit={handleSubmit}
          className="mt-8 w-full rounded-2xl border border-white/10 bg-[#12161e] p-2 shadow-2xl shadow-black/20"
        >
          <label htmlFor="question" className="sr-only">
            พิมพ์คำถามเกี่ยวกับมหาวิทยาลัย
          </label>
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
              disabled={!question.trim()}
              className="rounded-xl bg-amber-200 px-4 py-3 text-sm font-medium text-[#17130a] transition enabled:hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ส่งคำถาม
            </button>
          </div>
        </form>
        <p className="mt-3 text-center text-xs text-white/35">
          ค้นจากข้อมูลเอกสารตัวอย่าง ยังไม่มีการใช้ AI
        </p>
      </section>

      {/* ข้อความท้ายหน้า */}
      <footer className="border-t border-white/[.06] px-5 py-4 text-center text-xs text-white/35">
        มหาวิทยาลัยเทคโนโลยีราชมงคลกรุงเทพ
      </footer>
    </main>
  );
}
