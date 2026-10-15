import { EmptyState } from "@/components/ui/empty-state";

// Placeholder until the chat UI lands in T-016.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Tudásbázis asszisztens</h1>
        <p className="text-muted-foreground text-xs">Bankmonitor demó</p>
      </header>
      <EmptyState
        title="A chat felület hamarosan elkészül."
        description="Itt tehetsz majd fel kérdést a tudásbázisnak, termék- és bankszűrővel, forráshivatkozással."
      />
    </main>
  );
}
