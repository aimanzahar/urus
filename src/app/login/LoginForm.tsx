"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction } from "@/lib/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-full" disabled={pending}>
      {pending ? "Checking…" : "Enter workspace"}
    </button>
  );
}

export default function LoginForm() {
  const [state, formAction] = useActionState(loginAction, undefined);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input
        type="password"
        name="password"
        placeholder="Team password"
        autoFocus
        autoComplete="current-password"
        aria-label="Team password"
      />
      {state?.error ? (
        <p className="text-sm text-danger">{state.error}</p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
