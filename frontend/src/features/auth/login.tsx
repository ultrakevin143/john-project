"use client";

import { post } from "@/shared/api/client";
import { type Envelope, type User } from "@/shared/api/contracts";
import { Alert, Button, Input, Label } from "@/shared/ui/index";
import { ArrowRight, Droplets, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState("admin@waterhub.demo"),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [recovering, setRecovering] = useState(false),
    [code, setCode] = useState(""),
    [newPassword, setNewPassword] = useState(""),
    [notice, setNotice] = useState("");
  return (
    <div className="water-signin">
      <header className="signin-masthead">
        <Link href="/" className="brand">
          <Droplets size={28} />
          <span>
            Water Utility<strong>Data Hub</strong>
          </span>
        </Link>
      </header>
      <main className="signin-main">
        <section className="signin-panel" aria-labelledby="signin-title">
          <h1 id="signin-title">Sign in to your district</h1>
          <p>Cebu · Demonstration Water Utility</p>
          {notice && <p role="status">{notice}</p>}
          {recovering ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  await post("/auth/recover", { code, password: newPassword });
                  setCode("");
                  setNewPassword("");
                  setRecovering(false);
                  setNotice(
                    "Password updated. Sign in with your new password.",
                  );
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : "Recovery failed.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <p>
                Ask an administrator to verify your identity and provide a
                recovery code privately.
              </p>
              <div className="field">
                <Label htmlFor="recovery-code">Recovery code</Label>
                <Input
                  id="recovery-code"
                  type="password"
                  autoComplete="off"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  minLength={12}
                  maxLength={128}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              {error && <Alert title="Recovery failed">{error}</Alert>}
              <Button type="submit" disabled={busy}>
                {busy ? "Updating…" : "Set new password"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setRecovering(false);
                  setCode("");
                  setNewPassword("");
                  setError("");
                }}
              >
                Back to sign in
              </Button>
            </form>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  const result = await post<Envelope<User>>("/auth/login", {
                    email,
                    password,
                  });
                  setPassword("");
                  onLogin(result.data);
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : "Sign-in failed.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="field">
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="field">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <Alert title="Unable to sign in">{error}</Alert>}
              <Button type="submit" disabled={busy}>
                {busy ? "Opening workspace…" : "Open workspace"}
                <ArrowRight size={17} />
              </Button>
            </form>
          )}
          {!recovering && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setRecovering(true);
                setError("");
                setNotice("");
              }}
            >
              Forgot password?
            </Button>
          )}
          <div className="signin-security">
            <LockKeyhole size={15} />
            <p>Access follows your assigned district role.</p>
          </div>
        </section>
      </main>
      <footer className="signin-footer">
        <span>Independent Cebu prototype</span>
        <span>Synthetic records · No MCWD affiliation</span>
      </footer>
    </div>
  );
}
