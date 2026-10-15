import { Chat } from "@/components/chat/chat";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pt-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Tudásbázis asszisztens</h1>
        <p className="text-muted-foreground text-xs">Bankmonitor demó</p>
      </header>
      <Chat />
    </main>
  );
}
