"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="boot">
      <h1>The workspace could not open</h1>
      <p>Check the local services, then try again.</p>
      <button className="button button-primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
