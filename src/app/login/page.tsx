import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Belépés · Tudásbázis asszisztens",
};

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

// Reads ?error and ?next at request time. Under Cache Components that has to
// sit inside Suspense; the fallback is the same form, so the static shell
// already contains a working login form (no JavaScript needed).
async function LoginFormFromParams({
  searchParams,
}: {
  searchParams: PageProps<"/login">["searchParams"];
}) {
  const params = await searchParams;
  return (
    <LoginForm
      failed={first(params.error) === "1"}
      next={first(params.next) ?? ""}
    />
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">
            Tudásbázis asszisztens
          </CardTitle>
          <CardDescription>
            Bankmonitor demó. A belépéshez add meg a kapott adatokat.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<LoginForm />}>
            <LoginFormFromParams searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
