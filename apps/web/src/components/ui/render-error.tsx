"use client";

export function RenderError({ retry }: { retry: () => void }) {
  return (
    <main className="panel" style={{ maxWidth: 640, margin: "3rem auto", padding: "2rem" }}>
      <h1>We couldn’t load this page</h1>
      <p>Something went wrong while loading your account information. Please try again.</p>
      <button className="primary-button" type="button" onClick={retry}>
        Retry
      </button>
      <p>
        {/* Full navigation also works when the root router/layout failed. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/">Return to your dashboard</a>
      </p>
    </main>
  );
}
