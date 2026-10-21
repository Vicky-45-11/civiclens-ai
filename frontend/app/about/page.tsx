import { PageTitle } from "@/components/ui";

export const metadata = { title: "About, privacy and limits" };

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="card p-5">
    <h2 className="text-2xl">{title}</h2>
    <div className="mt-2 space-y-2 text-ink-soft">{children}</div>
  </section>
);

export default function About() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageTitle eyebrow="Read this first" title="About, privacy and limits" />
      <Section title="What CivicLens is">
        <p>CivicLens AI lets residents report potholes, broken streetlights, overflowing bins, water leaks and damaged infrastructure with a photo and a location, and lets staff triage, assign and resolve them.</p>
        <p>
          <strong>It is not connected to any government or utility system.</strong> Reports stay inside this application. Any hand-off to an authority would have to be built and agreed separately by whoever deploys it, and this site would then say so.
        </p>
      </Section>
      <Section title="Human review">
        <p>Every new report is private until a moderator approves it. The AI never publishes, rejects, merges or assigns anything. Staff must confirm the severity themselves before a case can be triaged, and a case can only be marked resolved after someone uploads a photo of the finished work.</p>
      </Section>
      <Section title="The AI, honestly">
        <p>Two helpers look at your photo. Neither makes decisions.</p>
        <ul className="list-disc pl-5">
          <li>
            <strong>Category suggestion:</strong> uses a PyTorch image classifier <em>only</em> if the operator has trained and loaded one. No trained model ships with the code. Without one, the site says &quot;Demo mode&quot; and uses the category you pick.
          </li>
          <li>
            <strong>Severity suggestion:</strong> a simple image-statistics estimate (dark areas, edge detail, contrast). It is a hint to speed up triage, not a measurement.
          </li>
          <li>
            <strong>Duplicate hints:</strong> reports of the same kind within about 60 metres, ranked by distance and photo similarity. People merge duplicates.
          </li>
        </ul>
      </Section>
      <Section title="Your privacy">
        <ul className="list-disc pl-5">
          <li>Photos are re-encoded on upload, which removes hidden location and camera data.</li>
          <li>Public pages never show who reported an issue. Staff see the reporter&apos;s display name; only administrators can see email addresses.</li>
          <li>Please avoid people&apos;s faces, number plates and private property. Moderators reject photos that show them, and anyone signed in can flag a published report.</li>
          <li>A report&apos;s pin is shown at the location you chose, so choose the spot of the problem, not your home.</li>
          <li>Sign-in uses an HTTP-only cookie. Passwords are stored as salted scrypt hashes.</li>
          <li>Requests are rate limited to reduce spam and abuse.</li>
        </ul>
      </Section>
      <Section title="Limits">
        <ul className="list-disc pl-5">
          <li>Map tiles come from OpenStreetMap, so your browser contacts that service when a map is shown.</li>
          <li>The sample data in a demo deployment is fictional.</li>
          <li>This is not an emergency service. For danger to life, call your local emergency number.</li>
        </ul>
      </Section>
    </div>
  );
}
