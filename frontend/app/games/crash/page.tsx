import type { Metadata } from "next"
import { CrashTable } from "@/components/crash/crash-table"

export const metadata: Metadata = {
  title: "Crash",
  description: "Crash'te çarpan artarken doğru anda cashout yap, roketi kaçırma.",
}

export default function CrashPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-3 py-3 md:px-5 md:py-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground">Crash</h1>
        <p className="text-sm text-muted-foreground">
          Çarpan her an artar. Doğru anda cashout yap ya da her şeyi kaybet.
        </p>
      </div>

      <CrashTable />
    </main>
  )
}
