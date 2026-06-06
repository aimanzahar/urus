import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="min-h-dvh grid place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-6">
          <div className="w-9 h-9 rounded-[10px] bg-accent text-white grid place-items-center font-semibold text-lg">
            P
          </div>
          <span className="text-xl font-semibold tracking-tight">Plan</span>
        </div>
        <div className="card p-6">
          <h1 className="text-base font-semibold mb-1">Welcome back</h1>
          <p className="text-sm text-ink-soft mb-5">
            Enter the team password to open the workspace.
          </p>
          <LoginForm />
        </div>
        <p className="text-center text-xs text-ink-faint mt-5">
          Self-hosted planning workspace
        </p>
      </div>
    </main>
  );
}
