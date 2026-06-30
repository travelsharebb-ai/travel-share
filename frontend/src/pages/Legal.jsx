import Shell from "../components/Shell";

const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || "support@example.com";

export default function Legal({ type }) {
  return (
    <Shell>
      <main className="page-shell">
        <article className="card max-w-4xl space-y-4 p-5 sm:p-8">
          <h1 className="font-serif text-4xl font-black">
            {type === "privacy" ? "Privacy Policy" : "Terms"}
          </h1>
          <p className="text-slatebody">
            TravelShare is designed for private, consent-forward travel and event memory sharing. Uploads remain pending until the album owner or organizer approves them.
          </p>
          <p className="text-slatebody">
            We do not sell uploaded content or use it for AI training. Location sharing is optional and can be exact, approximate, or hidden.
          </p>
          <p className="text-slatebody">
            Report abuse to <a href={`mailto:${supportEmail}`} className="text-primary">{supportEmail}</a>.
          </p>
        </article>
      </main>
    </Shell>
  );
}