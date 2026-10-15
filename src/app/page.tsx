import { Chat } from "@/components/chat/chat";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pt-8">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Tudásbázis asszisztens</h1>
          <p className="text-muted-foreground text-xs">Bankmonitor demó</p>
        </div>
        <form method="post" action="/api/logout">
          <Button type="submit" variant="ghost" className="h-11 sm:h-8">
            Kilépés
          </Button>
        </form>
      </header>
      <Chat />
    </main>
  );
}
