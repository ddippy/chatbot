// สร้างหน้าแชตตัวอย่าง โดยตอนนี้ยังไม่มีการส่งคำถามไปประมวลผล
export default function Home() {
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

        {/* ตัวอย่างหัวข้อที่ผู้ใช้อาจอยากถาม */}
        <div className="mt-9 grid w-full gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[.03] p-4">
            <p className="text-sm font-medium text-white/85">หลักสูตรและสาขาวิชา</p>
            <p className="mt-1.5 text-xs leading-5 text-white/45">คณะมีหลักสูตรหรือสาขาอะไรบ้าง?</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[.03] p-4">
            <p className="text-sm font-medium text-white/85">การเรียนและการลงทะเบียน</p>
            <p className="mt-1.5 text-xs leading-5 text-white/45">ดูข้อมูลกำหนดการลงทะเบียนได้จากที่ไหน?</p>
          </div>
        </div>

        {/* ช่องพิมพ์และปุ่มส่งเป็นหน้าตาตัวอย่าง ยังไม่เชื่อมการทำงาน */}
        <div className="mt-8 w-full rounded-2xl border border-white/10 bg-[#12161e] p-2 shadow-2xl shadow-black/20">
          <label htmlFor="question" className="sr-only">
            พิมพ์คำถามเกี่ยวกับมหาวิทยาลัย
          </label>
          <div className="flex items-center gap-2">
            <input
              id="question"
              type="text"
              placeholder="พิมพ์คำถามของคุณ..."
              className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-white outline-none placeholder:text-white/35"
            />
            <button
              type="button"
              disabled
              className="rounded-xl bg-amber-200 px-4 py-3 text-sm font-medium text-[#17130a] opacity-50"
            >
              ส่งคำถาม
            </button>
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-white/35">
          ขั้นนี้เป็นหน้าตาตัวอย่าง ปุ่มส่งคำถามยังไม่ทำงาน
        </p>
      </section>

      {/* ข้อความท้ายหน้า */}
      <footer className="border-t border-white/[.06] px-5 py-4 text-center text-xs text-white/35">
        มหาวิทยาลัยเทคโนโลยีราชมงคลกรุงเทพ
      </footer>
    </main>
  );
}
