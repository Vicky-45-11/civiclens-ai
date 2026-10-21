import type { Media } from "@/lib/types";

export function Photos({ media, kind, label }: { media: Media[]; kind: Media["kind"]; label: string }) {
  const items = media.filter((m) => m.kind === kind);
  if (items.length === 0) return null;
  return (
    <section aria-label={label}>
      <h3 className="mb-2 text-lg">{label}</h3>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((m) => (
          <li key={m.id}>
            <a href={m.url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element -- served by our API, already resized */}
              <img src={m.url} alt={`${label} photo`} width={m.width} height={m.height} className="w-full rounded-xl border border-line object-cover" loading="lazy" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
