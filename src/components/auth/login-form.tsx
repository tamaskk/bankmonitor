"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// A plain HTML form posting to /api/login: it works before hydration and
// without JavaScript. The route answers with a redirect: back to /login with
// ?error=1, or on to ?next. The page passes both in from the URL.
export function LoginForm({
  failed = false,
  next = "",
}: {
  failed?: boolean;
  next?: string;
}) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      method="post"
      action="/api/login"
      className="flex flex-col gap-4"
      onSubmit={() => setSubmitting(true)}
    >
      <input type="hidden" name="next" value={next} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="user">Felhasználónév</Label>
        <Input
          id="user"
          name="user"
          autoComplete="username"
          required
          autoFocus
          aria-invalid={failed || undefined}
          className="h-11 sm:h-10"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Jelszó</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={failed || undefined}
          aria-describedby={failed ? "login-error" : undefined}
          className="h-11 sm:h-10"
        />
      </div>
      {failed ? (
        <p id="login-error" role="alert" className="text-destructive text-sm">
          Hibás felhasználónév vagy jelszó.
        </p>
      ) : null}
      <Button type="submit" disabled={submitting} className="h-11 sm:h-10">
        {submitting ? "Belépés…" : "Belépés"}
      </Button>
    </form>
  );
}
